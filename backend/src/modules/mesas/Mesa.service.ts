import prisma from '@config/prisma'
import { Mesa, StatusMesa } from '@prisma/client'
import { AppError } from '@shared/errors/AppError'
import { MesaRepository } from './Mesa.repository'
import {
  CriarMesaDTO,
  CriarPedidoPublicoMesaDTO,
  AtualizarMesaDTO,
  AtualizarStatusMesaDTO,
} from './Mesa.schema'
import { env } from '@config/env'
import { PedidoService } from '@modules/pedidos/Pedido.service'
import { PedidoRepository } from '@modules/pedidos/Pedido.repository'
import { criarPedidoSchema } from '@modules/pedidos/Pedido.schema'
import { montarItensPublicos } from '@modules/pedidos/Pedido.publico'
import crypto from 'crypto'

// Só pedidos dos últimos N horas aparecem no histórico público da mesa
const JANELA_HISTORICO_HORAS = 6

export class MesaService {

  constructor(
    private readonly repository: MesaRepository
  ) {}

  async create(
    data: CriarMesaDTO,
    estabelecimento_id: string
  ): Promise<Mesa> {

    const numeroExistente = await this.repository.findByNumero(
      data.numero,
      estabelecimento_id
    )

    if (numeroExistente) {
      if (!numeroExistente.ativo) {
        throw new AppError(
          `Mesa ${data.numero} já existe mas está inativa. Reative-a em vez de criar uma nova.`,
          409
        )
      }
      throw new AppError(
        `Já existe uma mesa com o número ${data.numero}`,
        409
      )
    }

    const qr_code_token = crypto.randomUUID()

    const qr_code_url = `${env.FRONTEND_URL}/mesa/${qr_code_token}`

    try {
      return await this.repository.create({
        ...data,
        estabelecimento_id,
        qr_code_token,
        qr_code_url,
      })
    } catch (err) {
      // Duas requisições com o mesmo número ao mesmo tempo passam pela checagem acima;
      // quem barra de verdade é o índice único do banco (estabelecimento_id + numero).
      if ((err as { code?: string })?.code === 'P2002') {
        throw new AppError(`Já existe uma mesa com o número ${data.numero}`, 409)
      }
      throw err
    }
  }

  async findById(id: string, estabelecimento_id: string): Promise<Mesa> {
    const mesa = await this.repository.findById(id)

    if (!mesa) {
      throw new AppError('Mesa não encontrada', 404)
    }

    if (mesa.estabelecimento_id !== estabelecimento_id) {
      throw new AppError('Acesso não autorizado', 403)
    }

    return mesa
  }

  async findByToken(token: string) {
    const mesa = await this.repository.findByToken(token)

    if (!mesa) {
      throw new AppError('QR Code inválido ou mesa não encontrada', 404)
    }

    if (!mesa.ativo) {
      throw new AppError('Esta mesa está inativa', 400)
    }

    const estab = (mesa as any).estabelecimento
    if (estab && !estab.aceita_mesa) {
      throw new AppError(
        'Este estabelecimento não aceita pedidos em mesa no momento',
        400
      )
    }

    return mesa
  }

  /**
   * Histórico público da mesa (tela "Meus Pedidos" de quem escaneou o QR Code).
   * Devolve só o necessário para acompanhar o pedido: NADA de nome, telefone ou
   * observações de outros clientes. Pedidos em andamento aparecem sempre (mesa aberta);
   * os já entregues só dentro da janela de horas, para não mostrar quem ocupou a mesa antes.
   */
  async pedidosPublicos(token: string) {
    const mesa = await this.findByToken(token)

    const desde = new Date(Date.now() - JANELA_HISTORICO_HORAS * 60 * 60 * 1000)

    const pedidos = await prisma.pedido.findMany({
      where: {
        mesa_id: mesa.id,
        // Só a conta ABERTA: quando o caixa fecha a conta (pedidos liquidados/pagos) o histórico
        // do convidado some. Quem quer guardar o histórico precisa estar logado (ver
        // PedidoService.historicoDoCliente, que usa cliente_id e nunca expira).
        liquidado_em: null,
        NOT: { pagamento: { is: { status: 'CONFIRMADO' as const } } },
        OR: [
          // Em andamento: aparece SEMPRE que a mesa está aberta, por mais antigo que seja o pedido
          // (ex.: mesa aberta pelo caixa há horas, antes de o cliente chegar)
          { status: { in: ['RECEBIDO', 'PREPARO', 'PRONTO'] } },
          // Já entregues: só os recentes, para não mostrar o que foi de quem sentou antes
          { status: 'ENTREGUE', criado_em: { gte: desde } },
        ],
      },
      orderBy: { criado_em: 'desc' },
      take: 50,
      select: {
        id: true,
        numero_pedido: true,
        status: true,
        criado_em: true,
        total: true,
        itens: {
          select: {
            id: true,
            quantidade: true,
            preco_unitario: true,
            preco_total: true,
            itens_adicionais: { select: { preco_extra: true } },
            produto: { select: { nome: true, imagem_url: true } },
          },
        },
      },
    })

    return { mesa: { id: mesa.id, numero: mesa.numero, status: mesa.status }, pedidos }
  }

  /**
   * Pedido feito pelo cliente da mesa (QR Code), sem login.
   * Reaproveita o PedidoService do restaurante, então valem as mesmas regras:
   * preço sempre do banco, produto precisa existir/estar disponível no restaurante
   * da mesa, mesa não pode estar inativa e o restaurante é avisado por WhatsApp.
   */
  async criarPedidoPublico(
    token: string,
    dados: CriarPedidoPublicoMesaDTO,
    /** Preenchido só quando quem pede está com a conta de cliente logada: é o que guarda o pedido no histórico fixo dele */
    cliente_id?: string
  ) {
    const mesa = await this.findByToken(token) // 404 se QR inválido, 400 se mesa inativa/sem mesa

    // Mesmas regras de ingredientes/preço do delivery (Pedido.publico.ts)
    const itensMontados = await montarItensPublicos(mesa.estabelecimento_id, dados.itens)

    // Passa pelo schema do pedido para garantir o mesmo formato do fluxo do restaurante
    const pedidoDto = criarPedidoSchema.parse({
      modalidade: 'MESA',
      mesa_id: mesa.id,
      cliente_nome: dados.cliente_nome,
      cliente_telefone: '',
      ...(cliente_id ? { cliente_id } : {}),
      itens: itensMontados,
    })

    const pedidos = new PedidoService(new PedidoRepository())
    const pedido = await pedidos.criar(pedidoDto, mesa.estabelecimento_id)

    // Devolve só o necessário (nada de dados internos do restaurante)
    return {
      id: pedido.id,
      numero_pedido: pedido.numero_pedido,
      status: pedido.status,
      total: pedido.total,
    }
  }

  async listar(
    estabelecimento_id: string,
    apenasAtivas = true
  ): Promise<Mesa[]> {
    return this.repository.findByEstabelecimento(
      estabelecimento_id,
      apenasAtivas
    )
  }

  async update(
    id: string,
    data: AtualizarMesaDTO,
    estabelecimento_id: string
  ): Promise<Mesa> {
    const mesa = await this.findById(id, estabelecimento_id)

    if (data.numero && data.numero !== mesa.numero) {
      const numeroExistente = await this.repository.findByNumero(
        data.numero,
        estabelecimento_id
      )

      if (numeroExistente && numeroExistente.id !== id) {
        throw new AppError(
          `Já existe uma mesa com o número ${data.numero}`,
          409
        )
      }
    }

    return this.repository.update(id, data)
  }

  async reativar(id: string, estabelecimento_id: string): Promise<Mesa> {
    const mesa = await this.repository.findById(id)

    if (!mesa) {
      throw new AppError('Mesa não encontrada', 404)
    }

    if (mesa.estabelecimento_id !== estabelecimento_id) {
      throw new AppError('Acesso não autorizado', 403)
    }

    if (mesa.ativo) {
      throw new AppError('Mesa já está ativa', 400)
    }

    return this.repository.update(id, { ativo: true })
  }

  async atualizarStatus(
  id: string,
  data: AtualizarStatusMesaDTO,
  estabelecimento_id: string
): Promise<Mesa> {
  const mesa = await this.findById(id, estabelecimento_id)

  if (!mesa.ativo) {
    throw new AppError('Não é possível alterar o status de uma mesa inativa', 400)
  }

  // Mesa com pedido em andamento não pode ser liberada nem reservada
  if (data.status !== 'OCUPADA') {
    const emAndamento = await prisma.pedido.count({
      where: {
        mesa_id: id,
        estabelecimento_id,
        status: { in: ['RECEBIDO', 'PREPARO', 'PRONTO'] },
      },
    })

    if (emAndamento > 0) {
      throw new AppError(
        `A Mesa ${mesa.numero} tem pedido em andamento. Finalize ou cancele o pedido antes.`,
        400
      )
    }
  }

  return this.repository.update(id, {
    status: data.status as StatusMesa
  })
}

  async resumoOcupacao(estabelecimento_id: string) {
    return this.repository.resumoOcupacao(estabelecimento_id)
  }


  async remove(id: string, estabelecimento_id: string): Promise<void> {
    const mesa = await this.findById(id, estabelecimento_id)

    if (mesa.status === 'OCUPADA') {
      throw new AppError(
        'Não é possível desativar uma mesa ocupada. Libere a mesa primeiro.',
        400
      )
    }

    await this.repository.update(id, { ativo: false })
  }
}