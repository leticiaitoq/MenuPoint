import prisma from '@config/prisma'
import { Prisma } from '@prisma/client'
import { CriarReservaDTO } from './Reserva.schema'
import { montarJanela } from './Reserva.horario'

// Cliente do Prisma OU a transação em andamento (para checar conflito e gravar sem brecha no meio)
type Db = Prisma.TransactionClient | typeof prisma

export class ReservaRepository {

  async create(
    data: CriarReservaDTO & { estabelecimento_id: string; cliente_id?: string },
    db: Db = prisma
  ) {
    const { data_reserva, hora_inicio, hora_fim, ...rest } = data
    const janela = montarJanela(data_reserva, hora_inicio, hora_fim)

    return db.reserva.create({
      data: {
        ...rest,
        data_reserva: janela.data,
        hora_inicio: janela.inicio,
        hora_fim: janela.fim,
      },
      include: {
        mesa: { select: { id: true, numero: true, capacidade: true } },
      },
    })
  }

  // ── DO CLIENTE: reservas dele neste restaurante (mais próximas primeiro)

  async findByCliente(estabelecimento_id: string, cliente_id: string, desde: Date) {
    return prisma.reserva.findMany({
      where: {
        estabelecimento_id,
        cliente_id,
        data_reserva: { gte: desde },
      },
      include: { mesa: { select: { id: true, numero: true, capacidade: true } } },
      orderBy: [{ data_reserva: 'asc' }, { hora_inicio: 'asc' }],
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
    ignorar_id?: string,
    db: Db = prisma
  ) {
    return db.reserva.findFirst({
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

  // ── MESAS LIVRES NUM HORÁRIO (usado pelo cliente ao reservar)
  // Mesa livre = ativa, não inativa e SEM reserva PENDENTE/CONFIRMADA que se sobreponha ao intervalo.
  async mesasDisponiveis(
    estabelecimento_id: string,
    data_reserva: Date,
    hora_inicio: Date,
    hora_fim: Date,
    pessoas?: number
  ) {
    return prisma.mesa.findMany({
      where: {
        estabelecimento_id,
        ativo: true,
        status: { not: 'INATIVA' },
        ...(pessoas && { capacidade: { gte: pessoas } }),
        reservas: {
          none: {
            data_reserva,
            status: { in: ['PENDENTE', 'CONFIRMADA'] },
            hora_inicio: { lt: hora_fim },
            hora_fim: { gt: hora_inicio },
          },
        },
      },
      select: { id: true, numero: true, capacidade: true, localizacao: true },
      orderBy: { numero: 'asc' },
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