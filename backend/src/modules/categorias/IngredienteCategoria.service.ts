import { z } from 'zod'
import prisma from '@config/prisma'
import { AppError } from '@shared/errors/AppError'

export const ingredienteCategoriaSchema = z
  .object({
    nome: z.string().trim().min(1, 'Informe o nome').max(100, 'Nome deve ter no máximo 100 caracteres'),
    descricao: z.string().trim().max(255, 'Descrição deve ter no máximo 255 caracteres').nullable().optional(),
    preco_extra: z.number().min(0, 'Preço não pode ser negativo').max(999999.99, 'Preço máximo é R$ 999.999,99').default(0),
    quantidade_inclusa: z.number().int().min(0).max(20, 'Máximo de 20 unidades').default(0),
    quantidade_maxima: z.number().int().min(1, 'A quantidade máxima deve ser ao menos 1').max(20, 'Máximo de 20 unidades').default(1),
    fixo: z.boolean().default(false),
    ativo: z.boolean().default(true),
    ordem: z.number().int().min(0).optional(),
  })
  .refine((d) => d.quantidade_inclusa <= d.quantidade_maxima, {
    message: 'A quantidade inclusa não pode ser maior que a máxima',
    path: ['quantidade_inclusa'],
  })
  .refine((d) => !d.fixo || d.quantidade_inclusa >= 1, {
    message: 'Um ingrediente fixo precisa vir incluso (pelo menos 1 unidade)',
    path: ['fixo'],
  })

export type IngredienteCategoriaDTO = z.infer<typeof ingredienteCategoriaSchema>

export class IngredienteCategoriaService {
  // Garante que a categoria é do restaurante de quem está logado
  private async categoriaDoEstabelecimento(categoria_id: string, estabelecimento_id: string) {
    const categoria = await prisma.categoria.findFirst({ where: { id: categoria_id, estabelecimento_id } })
    if (!categoria) throw new AppError('Categoria não encontrada', 404)
    return categoria
  }

  private async doEstabelecimento(id: string, estabelecimento_id: string) {
    const ing = await prisma.ingredienteCategoria.findFirst({
      where: { id, categoria: { estabelecimento_id } },
    })
    if (!ing) throw new AppError('Ingrediente não encontrado', 404)
    return ing
  }

  async listar(categoria_id: string, estabelecimento_id: string) {
    await this.categoriaDoEstabelecimento(categoria_id, estabelecimento_id)
    return prisma.ingredienteCategoria.findMany({
      where: { categoria_id },
      orderBy: [{ ordem: 'asc' }, { criado_em: 'asc' }],
    })
  }

  /** { [categoria_id]: quantidade } para mostrar o contador na tabela de categorias */
  async contagem(estabelecimento_id: string): Promise<Record<string, number>> {
    const grupos = await prisma.ingredienteCategoria.groupBy({
      by: ['categoria_id'],
      where: { categoria: { estabelecimento_id } },
      _count: { _all: true },
    })
    return Object.fromEntries(grupos.map((g) => [g.categoria_id, g._count._all]))
  }

  async criar(categoria_id: string, data: IngredienteCategoriaDTO, estabelecimento_id: string) {
    await this.categoriaDoEstabelecimento(categoria_id, estabelecimento_id)

    const repetido = await prisma.ingredienteCategoria.findFirst({
      where: { categoria_id, nome: { equals: data.nome, mode: 'insensitive' } },
    })
    if (repetido) throw new AppError(`"${data.nome}" já está cadastrado nesta categoria`, 409)

    const ultimo = await prisma.ingredienteCategoria.aggregate({
      where: { categoria_id },
      _max: { ordem: true },
    })

    return prisma.ingredienteCategoria.create({
      data: { ...data, categoria_id, ordem: data.ordem ?? (ultimo._max.ordem ?? -1) + 1 },
    })
  }

  async atualizar(id: string, data: IngredienteCategoriaDTO, estabelecimento_id: string) {
    const atual = await this.doEstabelecimento(id, estabelecimento_id)

    const repetido = await prisma.ingredienteCategoria.findFirst({
      where: { categoria_id: atual.categoria_id, id: { not: id }, nome: { equals: data.nome, mode: 'insensitive' } },
    })
    if (repetido) throw new AppError(`"${data.nome}" já está cadastrado nesta categoria`, 409)

    return prisma.ingredienteCategoria.update({ where: { id }, data })
  }

  async deletar(id: string, estabelecimento_id: string) {
    await this.doEstabelecimento(id, estabelecimento_id)
    // É só um modelo: produtos que já importaram este ingrediente têm a própria cópia e não mudam
    await prisma.ingredienteCategoria.delete({ where: { id } })
  }
}
