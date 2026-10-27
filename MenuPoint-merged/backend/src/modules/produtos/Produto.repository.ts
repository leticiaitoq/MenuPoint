import { Produto } from '@prisma/client'
import { BaseRepository } from '@shared/abstracts/BaseRepository'
import prisma from '@config/prisma'
import { CriarProdutoDTO, AtualizarProdutoDTO } from './Produto.schema'

export class ProdutoRepository extends BaseRepository <
  Produto,
  CriarProdutoDTO,
  AtualizarProdutoDTO
> {
  protected modelName = 'produto' as any

  async findByIdCompleto(id: string) {
    return prisma.produto.findUnique({
      where: { id },
      include: {
        categoria: {
          select: { id: true, nome: true },
        },
        grupos_adicionais: {
          include: {
            adicionais: {
              orderBy: { ordem: 'asc' },
            },
          },
          orderBy: { ordem: 'asc' },
        },
      },
    })
  }

  async findByEstabelecimento(
    estabelecimento_id: string,
    filtros?: {
      categoria_id?: string
      disponivel?: boolean
      destaque?: boolean
    }
  ) {
    return prisma.produto.findMany({
      where: {
        estabelecimento_id,
        ...filtros,
      },
      include: {
        categoria: {
          select: { id: true, nome: true },
        },
        grupos_adicionais: {
          include: {
            adicionais: {
              where: { disponivel: true },
              orderBy: { ordem: 'asc' },
            },
          },
          orderBy: { ordem: 'asc' },
        },
      },
      orderBy: [
        { categoria_id: 'asc' },
        { ordem: 'asc' },
      ],
    })
  }

  async createComAdicionais(data: CriarProdutoDTO & {
    estabelecimento_id: string
  }) {
    const { grupos_adicionais, ...produtoData } = data

    return prisma.produto.create({
      data: {
        ...produtoData,
        ...(grupos_adicionais && {
          grupos_adicionais: {
            create: grupos_adicionais.map((grupo) => ({
              nome: grupo.nome,
              obrigatorio: grupo.obrigatorio,
              selecao_multipla: grupo.selecao_multipla,
              min_selecoes: grupo.min_selecoes,
              max_selecoes: grupo.max_selecoes,
              ordem: grupo.ordem,
              adicionais: {
                create: grupo.adicionais.map((adicional) => ({
                  nome: adicional.nome,
                  preco_extra: adicional.preco_extra,
                  disponivel: adicional.disponivel,
                  ordem: adicional.ordem,
                })),
              },
            })),
          },
        }),
      },
      include: {
        grupos_adicionais: {
          include: { adicionais: true },
        },
      },
    })
  }

  async incrementarVendas(id: string, quantidade: number): Promise<void> {
    await prisma.produto.update({
      where: { id },
      data: {
        total_vendido: { increment: quantidade },
      },
    })
  }

  async findMaisVendidos(
    estabelecimento_id: string,
    limite: number = 10
  ) {
    return prisma.produto.findMany({
      where: { estabelecimento_id, disponivel: true },
      orderBy: { total_vendido: 'desc' },
      take: limite,
      select: {
        id: true,
        nome: true,
        imagem_url: true,
        preco: true,
        total_vendido: true,
        categoria: {
          select: { nome: true },
        },
      },
    })
  }

  async reordenar(
    produtos: { id: string; ordem: number }[]
  ): Promise<void> {
    await prisma.$transaction(
      produtos.map(({ id, ordem }) =>
        prisma.produto.update({
          where: { id },
          data: { ordem },
        })
      )
    )
  }
}