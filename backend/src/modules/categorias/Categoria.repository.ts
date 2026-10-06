import { Categoria } from '@prisma/client'
import { BaseRepository } from '@shared/abstracts/BaseRepository'
import prisma from '@config/prisma'
import {
  CriarCategoriaDTO,
  AtualizarCategoriaDTO,
} from './Categoria.schema'

export class CategoriaRepository extends BaseRepository <
  Categoria,
  CriarCategoriaDTO,
  AtualizarCategoriaDTO
> {
  protected modelName = 'categoria' as any

  async findByEstabelecimento(
    estabelecimento_id: string,
    apenasAtivas = false
  ): Promise<Categoria[]> {
    return prisma.categoria.findMany({
      where: {
        estabelecimento_id,
        ...(apenasAtivas && { ativo: true }),
      },
      orderBy: { ordem: 'asc' },
    })
  }

  async findByEstabelecimentoComProdutos(
    estabelecimento_id: string
  ): Promise<Categoria[]> {
    return prisma.categoria.findMany({
      where: {
        estabelecimento_id,
        ativo: true,
      },
      include: {
        produtos: {
          where: { disponivel: true },
          // destaques primeiro; dentro de cada grupo vale a ordem definida pelo restaurante
          orderBy: [{ destaque: 'desc' }, { ordem: 'asc' }],
          include: {
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
        },
      },
      orderBy: { ordem: 'asc' },
    }) as any
  }

  async findByNome(
    nome: string,
    estabelecimento_id: string
  ): Promise<Categoria | null> {
    return prisma.categoria.findFirst({
      where: {
        nome: { equals: nome, mode: 'insensitive' },
        estabelecimento_id,
      },
    })
  }

  async proximaOrdem(estabelecimento_id: string): Promise<number> {
    const { _max } = await prisma.categoria.aggregate({
      where: { estabelecimento_id },
      _max: { ordem: true },
    })
    return (_max.ordem ?? 0) + 1
  }

  async contarProdutos(categoria_id: string): Promise<number> {
    return prisma.produto.count({ where: { categoria_id } })
  }

  /** Desativa a categoria e, na mesma transação, todos os produtos dela. */
  async desativarComProdutos(id: string): Promise<{ produtos_desativados: number }> {
    const [, produtos] = await prisma.$transaction([
      prisma.categoria.update({ where: { id }, data: { ativo: false } }),
      prisma.produto.updateMany({
        where: { categoria_id: id, disponivel: true },
        data: { disponivel: false },
      }),
    ])
    return { produtos_desativados: produtos.count }
  }

  /** Reativa a categoria e, opcionalmente, os produtos dela, na mesma transação. */
  async reativarComProdutos(
    id: string,
    reativarProdutos: boolean
  ): Promise<{ produtos_reativados: number }> {
    if (!reativarProdutos) {
      await prisma.categoria.update({ where: { id }, data: { ativo: true } })
      return { produtos_reativados: 0 }
    }

    const [, produtos] = await prisma.$transaction([
      prisma.categoria.update({ where: { id }, data: { ativo: true } }),
      prisma.produto.updateMany({
        where: { categoria_id: id, disponivel: false },
        data: { disponivel: true },
      }),
    ])
    return { produtos_reativados: produtos.count }
  }

  async reordenar(
    categorias: { id: string; ordem: number }[]
  ): Promise<void> {
    await prisma.$transaction(
      categorias.map(({ id, ordem }) =>
        prisma.categoria.update({
          where: { id },
          data: { ordem },
        })
      )
    )
  }
}