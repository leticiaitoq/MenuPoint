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
          orderBy: { ordem: 'asc' },
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