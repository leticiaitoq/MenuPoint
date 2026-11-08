import { AppError } from '@shared/errors/AppError'
import { Prisma } from '@prisma/client'
import { ReservaRepository } from './Reserva.repository'
import {
  CriarReservaDTO,
  CriarReservaClienteDTO,
  AtualizarStatusReservaDTO,
  MesasDisponiveisQuery,
} from './Reserva.schema'
import { montarJanela, agoraNoBrasil } from './Reserva.horario'
import prisma from '@config/prisma'

// Quantas reservas em aberto (pendentes/confirmadas, de hoje em diante) um cliente pode ter no mesmo
// restaurante. Sem isso, uma pessoa poderia "segurar" todas as mesas e o controle de disponibilidade
// do restaurante perderia o sentido.
const MAX_RESERVAS_ABERTAS_POR_CLIENTE = 3

export class ReservaService {
  constructor(private readonly repository: ReservaRepository) {}

  // ── CRIAR ────────────────────────────────────────────────────────────────
  // Com mesa: confere o conflito e grava na MESMA transação, sob um lock por mesa. Assim duas
  // pessoas reservando a mesma mesa no mesmo horário não passam as duas pela checagem.

  async criar(data: CriarReservaDTO, estabelecimento_id: string, cliente_id?: string) {
    const janela = montarJanela(data.data_reserva, data.hora_inicio, data.hora_fim)

    if (janela.fim <= janela.inicio) {
      throw new AppError('Hora fim deve ser posterior à hora início', 400)
    }

    const dados = { ...data, estabelecimento_id, ...(cliente_id && { cliente_id }) }

    if (!data.mesa_id) {
      return this.repository.create(dados)
    }

    const mesa_id = data.mesa_id

    return prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${mesa_id}))`

      const conflito = await this.repository.verificarConflito(
        estabelecimento_id,
        mesa_id,
        janela.data,
        janela.inicio,
        janela.fim,
        undefined,
        tx
      )

      if (conflito) {
        throw new AppError(
          'Esta mesa já possui uma reserva neste horário. Escolha outro horário ou mesa.',
          409
        )
      }

      return this.repository.create(dados, tx)
    })
  }

  // ── CLIENTE: acha o restaurante pelo slug (o token do cliente não tem estabelecimento_id)

  private async buscarEstabelecimentoPorSlug(slug: string) {
    const estabelecimento = await prisma.estabelecimento.findFirst({
      where: { slug, ativo: true },
      select: { id: true },
    })

    if (!estabelecimento) {
      throw new AppError('Restaurante não encontrado', 404)
    }

    return estabelecimento
  }

  // ── CLIENTE: CRIAR RESERVA ───────────────────────────────────────────────
  // Nasce PENDENTE: o restaurante confirma depois (PATCH /:id/status).
  // Nome, telefone e e-mail vêm da CONTA do cliente logado (nunca do corpo da requisição).

  async criarParaCliente(slug: string, data: CriarReservaClienteDTO, cliente_id: string) {
    const estabelecimento = await this.buscarEstabelecimentoPorSlug(slug)

    const cliente = await prisma.cliente.findFirst({
      where: { id: cliente_id, ativo: true },
      select: { nome: true, telefone: true, email: true },
    })

    if (!cliente) {
      throw new AppError('Conta de cliente não encontrada', 404)
    }

    // Não reserva no passado (horário de Brasília)
    const agora = agoraNoBrasil()
    const [h, m] = data.hora_inicio.split(':').map(Number)
    if (data.data_reserva < agora.data || (data.data_reserva === agora.data && h * 60 + m <= agora.minutos)) {
      throw new AppError('Escolha uma data e um horário que ainda não passaram', 400)
    }

    const abertas = await prisma.reserva.count({
      where: {
        estabelecimento_id: estabelecimento.id,
        cliente_id,
        status: { in: ['PENDENTE', 'CONFIRMADA'] },
        data_reserva: { gte: new Date(`${agora.data}T00:00:00.000Z`) },
      },
    })

    if (abertas >= MAX_RESERVAS_ABERTAS_POR_CLIENTE) {
      throw new AppError(
        `Você já tem ${MAX_RESERVAS_ABERTAS_POR_CLIENTE} reservas em aberto neste restaurante. Cancele uma para fazer outra.`,
        400
      )
    }

    // Garante que a mesa é DESTE restaurante (o id vem do navegador, não dá pra confiar)
    const mesa = await prisma.mesa.findFirst({
      where: { id: data.mesa_id, estabelecimento_id: estabelecimento.id, ativo: true },
    })

    if (!mesa || mesa.status === 'INATIVA') {
      throw new AppError('Mesa não encontrada neste restaurante', 404)
    }

    if (mesa.capacidade < data.num_pessoas) {
      throw new AppError(`Esta mesa comporta no máximo ${mesa.capacidade} pessoas`, 400)
    }

    return this.criar(
      {
        ...data,
        cliente_nome: cliente.nome,
        cliente_telefone: cliente.telefone,
        ...(cliente.email && { cliente_email: cliente.email }),
      },
      estabelecimento.id,
      cliente_id
    )
  }

  // ── CLIENTE: MINHAS RESERVAS (de hoje em diante) ─────────────────────────

  async listarDoCliente(slug: string, cliente_id: string) {
    const estabelecimento = await this.buscarEstabelecimentoPorSlug(slug)
    const hoje = new Date(`${agoraNoBrasil().data}T00:00:00.000Z`)

    return this.repository.findByCliente(estabelecimento.id, cliente_id, hoje)
  }

  // ── CLIENTE: CANCELAR A PRÓPRIA RESERVA ──────────────────────────────────
  // Só mexe na reserva: a mesa volta a aparecer como disponível no horário porque a disponibilidade
  // é calculada pelas reservas ativas (não pelo status da mesa).

  async cancelarDoCliente(slug: string, id: string, cliente_id: string) {
    const estabelecimento = await this.buscarEstabelecimentoPorSlug(slug)
    const reserva = await this.repository.findByIdCompleto(id)

    if (
      !reserva ||
      (reserva as any).estabelecimento_id !== estabelecimento.id ||
      (reserva as any).cliente_id !== cliente_id
    ) {
      throw new AppError('Reserva não encontrada', 404)
    }

    const status = (reserva as any).status
    if (!['PENDENTE', 'CONFIRMADA'].includes(status)) {
      throw new AppError(`Esta reserva já está ${status}. Não é possível cancelar.`, 400)
    }

    return this.repository.update(id, { status: 'CANCELADA' })
  }

  // ── CLIENTE: MESAS DISPONÍVEIS ───────────────────────────────────────────

  async mesasDisponiveis(slug: string, query: MesasDisponiveisQuery) {
    const estabelecimento = await this.buscarEstabelecimentoPorSlug(slug)

    const janela = montarJanela(query.data_reserva, query.hora_inicio, query.hora_fim)

    if (janela.fim <= janela.inicio) {
      throw new AppError('Hora fim deve ser posterior à hora início', 400)
    }

    return this.repository.mesasDisponiveis(
      estabelecimento.id,
      janela.data,
      janela.inicio,
      janela.fim,
      query.pessoas
    )
  }

  // ── BUSCAR POR ID ────────────────────────────────────────────────────────

  async findById(id: string, estabelecimento_id: string) {
    const reserva = await this.repository.findByIdCompleto(id)

    if (!reserva) {
      throw new AppError('Reserva não encontrada', 404)
    }

    if ((reserva as any).estabelecimento_id !== estabelecimento_id) {
      throw new AppError('Acesso não autorizado', 403)
    }

    return reserva
  }

  // ── LISTAR ───────────────────────────────────────────────────────────────

  async listar(
    estabelecimento_id: string,
    filtros?: {
      status?: string
      data_inicio?: Date
      data_fim?: Date
    }
  ) {
    return this.repository.findByEstabelecimento(estabelecimento_id, filtros)
  }

  // ── ATUALIZAR STATUS ─────────────────────────────────────────────────────

  async atualizarStatus(
    id: string,
    data: AtualizarStatusReservaDTO,
    confirmada_por_id: string,
    estabelecimento_id: string
  ) {
    const reserva = await this.findById(id, estabelecimento_id)
    const statusAtual = (reserva as any).status

    if (statusAtual === 'CONCLUIDA' || statusAtual === 'CANCELADA') {
      throw new AppError(
        `Reserva já está ${statusAtual}. Não é possível alterar o status.`,
        400
      )
    }

    if (data.status === 'CONFIRMADA' && statusAtual !== 'PENDENTE') {
      throw new AppError('Apenas reservas PENDENTES podem ser confirmadas', 400)
    }

    if (data.status === 'CONFIRMADA' && data.mesa_id) {
      const dataBase = new Date((reserva as any).data_reserva)

      const conflito = await this.repository.verificarConflito(
        estabelecimento_id,
        data.mesa_id,
        dataBase,
        (reserva as any).hora_inicio,
        (reserva as any).hora_fim,
        id
      )

      if (conflito) {
        throw new AppError(
          'Mesa indisponível neste horário. Escolha outra mesa.',
          409
        )
      }
    }

    return this.repository.update(id, {
      status: data.status,
      confirmada_por_id,
      ...(data.mesa_id && { mesa_id: data.mesa_id }),
    })
  }

  // ── CANCELAR ─────────────────────────────────────────────────────────────

  async cancelar(id: string, estabelecimento_id: string) {
    const reserva = await this.findById(id, estabelecimento_id)

    if (['CONCLUIDA', 'CANCELADA'].includes((reserva as any).status)) {
      throw new AppError(
        `Reserva já está ${(reserva as any).status}. Não é possível cancelar.`,
        400
      )
    }

    await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      await tx.reserva.update({
        where: { id },
        data: { status: 'CANCELADA' },
      })

      // Libera a mesa se estava marcada como RESERVADA por esta reserva
      if ((reserva as any).mesa_id) {
        await tx.mesa.updateMany({
          where: {
            id: (reserva as any).mesa_id,
            status: 'RESERVADA',
          },
          data: { status: 'LIVRE' },
        })
      }
    })
  }
}