import { Pedido } from '@prisma/client'
import { BaseRepository } from '@shared/abstracts/BaseRepository'
import prisma from '@config/prisma'
import { CriarPedidoDTO } from './Pedido.schema'

type AtualizarPedidoDTO = Record<string, any>

export class PedidoRepository extends BaseRepository<
  Pedido,
  CriarPedidoDTO,
  AtualizarPedidoDTO
> {
  protected modelName = 'pedido' as any

  async findByIdCompleto(id: string) {
    return prisma.pedido.findUnique({
      where: { id },
      include: {
        itens: {
          include: {
            produto: {
              select: { id: true, nome: true, imagem_url: true },
            },
            itens_adicionais: true,
          },
        },
        mesa: { select: { id: true, numero: true } },
        atendido_por: { select: { id: true, nome: true } },
        pagamento: true,
      },
    })
  }

  async findByEstabelecimento(
    estabelecimento_id: string,
    filtros?: {
      status?: string
      modalidade?: string
      data_inicio?: Date
      data_fim?: Date
    }
  ) {
    return prisma.pedido.findMany({
      where: {
        estabelecimento_id,
        ...(filtros?.status && { status: filtros.status as any }),
        ...(filtros?.modalidade && { modalidade: filtros.modalidade as any }),
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
        itens: {
          include: {
            produto: {
              select: { id: true, nome: true },
            },
            itens_adicionais: true,
          },
        },
        mesa: { select: { id: true, numero: true } },
        pagamento: { select: { id: true, status: true, metodo: true } },
      },
      orderBy: { criado_em: 'desc' },
    })
  }

  async criarComItens(data: CriarPedidoDTO & {
    estabelecimento_id: string
    subtotal: number
    total: number
  }) {
    const { itens, ...pedidoData } = data

    return prisma.pedido.create({
      data: {
        ...pedidoData,
        subtotal: pedidoData.subtotal, 
        total: pedidoData.total, 
        itens: {
          create: itens.map((item) => ({
            produto_id: item.produto_id,
            quantidade: item.quantidade,
            preco_unitario: item.preco_unitario,
            preco_total: item.preco_unitario * item.quantidade,
            observacoes: item.observacoes,
            itens_adicionais: {
              create: item.itens_adicionais.map((ad) => ({
                adicional_id: ad.adicional_id,
                nome_adicional: ad.nome_adicional,
                preco_extra: ad.preco_extra,
              })),
            },
          })),
        },
      },
      include: {
        itens: {
          include: {
            produto: { select: { id: true, nome: true } },
            itens_adicionais: true,
          },
        },
      },
    })
  }
}