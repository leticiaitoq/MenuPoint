import { Produto } from '@prisma/client'
import { BaseRepository } from '@shared/abstracts/BaseRepository'
import prisma from '@config/prisma'
import { CriarProdutoDTO, AtualizarProdutoDTO, IngredienteDTO, NOME_GRUPO_INGREDIENTES } from './Produto.schema'

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
    const { grupos_adicionais, ingredientes, ...produtoData } = data

    const criado = await prisma.produto.create({
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

    if (ingredientes?.length) {
      await this.sincronizarIngredientes(criado.id, ingredientes)
      return (await this.findByIdCompleto(criado.id)) as any
    }
    return criado
  }

  /**
   * Grava a lista de ingredientes do produto (grupo "Ingredientes"), sem apagar histórico:
   *  - com id existente  → atualiza
   *  - sem id            → cria
   *  - saiu da lista     → apaga; se já foi usado em algum pedido, só marca como indisponível
   * Grupos antigos (de antes dos ingredientes) não são tocados.
   */
  async sincronizarIngredientes(produto_id: string, lista: IngredienteDTO[]): Promise<void> {
    await prisma.$transaction(async (tx) => {
      let grupo = await tx.grupoAdicional.findFirst({
        where: { produto_id, nome: NOME_GRUPO_INGREDIENTES },
      })
      if (!grupo) {
        grupo = await tx.grupoAdicional.create({
          data: {
            produto_id,
            nome: NOME_GRUPO_INGREDIENTES,
            obrigatorio: false,
            selecao_multipla: true,
            min_selecoes: 0,
            max_selecoes: 50,
            ordem: 0,
          },
        })
      }

      const existentes = await tx.adicional.findMany({ where: { grupo_id: grupo.id } })
      const idsExistentes = new Set(existentes.map((e) => e.id))
      const idsRecebidos = new Set(lista.map((i) => i.id).filter(Boolean) as string[])

      for (const ex of existentes) {
        if (idsRecebidos.has(ex.id)) continue
        const usado = await tx.itemAdicional.count({ where: { adicional_id: ex.id } })
        if (usado > 0) {
          await tx.adicional.update({ where: { id: ex.id }, data: { disponivel: false } })
        } else {
          await tx.adicional.delete({ where: { id: ex.id } })
        }
      }

      for (const [idx, ing] of lista.entries()) {
        const dados = {
          nome: ing.nome,
          preco_extra: ing.preco_extra,
          quantidade_inclusa: ing.quantidade_inclusa,
          quantidade_maxima: ing.quantidade_maxima,
          fixo: ing.fixo,
          disponivel: ing.disponivel,
          ordem: ing.ordem ?? idx,
        }
        if (ing.id && idsExistentes.has(ing.id)) {
          await tx.adicional.update({ where: { id: ing.id }, data: dados })
        } else {
          await tx.adicional.create({ data: { ...dados, grupo_id: grupo.id } })
        }
      }
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