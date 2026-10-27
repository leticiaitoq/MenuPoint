import prisma from '@config/prisma'
import { CriarReservaDTO } from './Reserva.schema'

export class ReservaRepository {

  async create(data: CriarReservaDTO & { estabelecimento_id: string }) {
    const { data_reserva, hora_inicio, hora_fim, ...rest } = data

    const dataBase = new Date(data_reserva + 'T00:00:00')

    const [hIni, mIni] = hora_inicio.split(':').map(Number)
    const [hFim, mFim] = hora_fim.split(':').map(Number)

    const horaInicioDate = new Date(dataBase)
    horaInicioDate.setHours(hIni, mIni, 0, 0)

    const horaFimDate = new Date(dataBase)
    horaFimDate.setHours(hFim, mFim, 0, 0)

    return prisma.reserva.create({
      data: {
        ...rest,
        data_reserva: dataBase,
        hora_inicio: horaInicioDate,
        hora_fim: horaFimDate,
      },
      include: {
        mesa: { select: { id: true, numero: true, capacidade: true } },
      },
    })
  }

  // ── BUSCAR POR ID

  async findByIdCompleto(id: string) {
    return prisma.reserva.findUnique({
      where: { id },
      include: {
        mesa: { select: { id: true, numero: true, capacidade: true } },
        confirmada_por: { select: { id: true, nome: true } },
        pedidos: {
          select: {
            id: true,
            numero_pedido: true,
            status: true,
            total: true,
          },
        },
      },
    })
  }

  // ── LISTAR COM FILTROS

  async findByEstabelecimento(
    estabelecimento_id: string,
    filtros?: {
      status?: string
      data_inicio?: Date
      data_fim?: Date
    }
  ) {
    return prisma.reserva.findMany({
      where: {
        estabelecimento_id,
        ...(filtros?.status && { status: filtros.status as any }),
        // Filtra por intervalo de datas se informado
        ...(filtros?.data_inicio || filtros?.data_fim
          ? {
              data_reserva: {
                ...(filtros?.data_inicio && { gte: filtros.data_inicio }),
                ...(filtros?.data_fim && { lte: filtros.data_fim }),
              },
            }
          : {}),
      },
      include: {
        mesa: { select: { id: true, numero: true } },
        confirmada_por: { select: { id: true, nome: true } },
      },
      // Mais recente primeiro dentro do dia, depois por hora
      orderBy: [{ data_reserva: 'asc' }, { hora_inicio: 'asc' }],
    })
  }

  async verificarConflito(
    estabelecimento_id: string,
    mesa_id: string,
    data_reserva: Date,
    hora_inicio: Date,
    hora_fim: Date,
    ignorar_id?: string
  ) {
    return prisma.reserva.findFirst({
      where: {
        estabelecimento_id,
        mesa_id,
        data_reserva,
        status: { in: ['PENDENTE', 'CONFIRMADA'] },
        ...(ignorar_id ? { id: { not: ignorar_id } } : {}),
        AND: [
          { hora_inicio: { lt: hora_fim } },
          { hora_fim: { gt: hora_inicio } },
        ],
      },
    })
  }

  // ── ATUALIZAR

  async update(
    id: string,
    data: Partial<{
      status: any
      mesa_id: string | null
      confirmada_por_id: string
    }>
  ) {
    return prisma.reserva.update({
      where: { id },
      data,
      include: {
        mesa: { select: { id: true, numero: true } },
        confirmada_por: { select: { id: true, nome: true } },
      },
    })
  }

  // ── DELETAR
  
  async delete(id: string) {
    return prisma.reserva.delete({ where: { id } })
  }
}