import { AppError } from '@shared/errors/AppError'
import { Prisma } from '@prisma/client'
import { ReservaRepository } from './Reserva.repository'
import { CriarReservaDTO, AtualizarStatusReservaDTO } from './Reserva.schema'
import prisma from '@config/prisma'

export class ReservaService {
  constructor(private readonly repository: ReservaRepository) {}

  // ── CRIAR ────────────────────────────────────────────────────────────────

  async criar(data: CriarReservaDTO, estabelecimento_id: string) {

    const dataBase = new Date(data.data_reserva + 'T00:00:00')

    const [hIni, mIni] = data.hora_inicio.split(':').map(Number)
    const [hFim, mFim] = data.hora_fim.split(':').map(Number)

    const horaInicioDate = new Date(dataBase)
    horaInicioDate.setHours(hIni, mIni)

    const horaFimDate = new Date(dataBase)
    horaFimDate.setHours(hFim, mFim)

    if (horaFimDate <= horaInicioDate) {
      throw new AppError('Hora fim deve ser posterior à hora início', 400)
    }

    if (data.mesa_id) {
      const conflito = await this.repository.verificarConflito(
        estabelecimento_id,
        data.mesa_id,
        dataBase,
        horaInicioDate,
        horaFimDate
      )

      if (conflito) {
        throw new AppError(
          'Esta mesa já possui uma reserva neste horário. Escolha outro horário ou mesa.',
          409
        )
      }
    }

    return this.repository.create({ ...data, estabelecimento_id })
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