import { Pagamento } from '@prisma/client'
import { BaseRepository } from '@shared/abstracts/BaseRepository'
import prisma from '@config/prisma'
import { CriarPagamentoDTO } from './Pagamento.schema'

type AtualizarPagamentoDTO = Record<string, any>

export class PagamentoRepository extends BaseRepository<
  Pagamento,
  CriarPagamentoDTO,
  AtualizarPagamentoDTO
> {
  protected modelName = 'pagamento' as any

  async findByPedido(pedido_id: string): Promise<Pagamento | null> {
    return prisma.pagamento.findUnique({
      where: { pedido_id },
      include: {
        pedido: {
          select: {
            id: true,
            numero_pedido: true,
            cliente_nome: true,
            total: true,
            status: true,
          },
        },
        confirmado_por: {
          select: { id: true, nome: true },
        },
      },
    }) as any
  }

  async findByIdCompleto(id: string) {
    return prisma.pagamento.findUnique({
      where: { id },
      include: {
        pedido: {
          select: {
            id: true,
            numero_pedido: true,
            cliente_nome: true,
            total: true,
            status: true,
            modalidade: true,
          },
        },
        confirmado_por: {
          select: { id: true, nome: true },
        },
      },
    })
  }

  async findByEstabelecimento(
    estabelecimento_id: string,
    filtros?: {
      status?: string
      metodo?: string
      data_inicio?: Date
      data_fim?: Date
    }
  ) {
    return prisma.pagamento.findMany({
      where: {
        estabelecimento_id,
        ...(filtros?.status && { status: filtros.status as any }),
        ...(filtros?.metodo && { metodo: filtros.metodo as any }),
        ...(filtros?.data_inicio || filtros?.data_fim
          ? {
              criado_em: {
                ...(filtros.data_inicio && { gte: filtros.data_inicio }),
                ...(filtros.data_fim && { lte: filtros.data_fim }),
              },
            }
          : {}),
      },
      include: {
        pedido: {
          select: {
            id: true,
            numero_pedido: true,
            cliente_nome: true,
            total: true,
            modalidade: true,
          },
        },
        confirmado_por: {
          select: { id: true, nome: true },
        },
      },
      orderBy: { criado_em: 'desc' },
    })
  }
}
