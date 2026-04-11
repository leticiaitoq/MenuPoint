import { z } from 'zod'

export const criarCategoriaSchema = z.object({
  nome: z
    .string()
    .min(1, 'Nome é obrigatório')
    .max(100, 'Nome deve ter no máximo 100 caracteres'),

  descricao: z
    .string()
    .max(255, 'Descrição deve ter no máximo 255 caracteres')
    .optional(),

  icone: z
    .string()
    .max(10, 'Ícone deve ter no máximo 10 caracteres')
    .optional(),

  imagem_url: z
    .string()
    .url('URL da imagem inválida')
    .optional(),

  ordem: z
    .number()
    .int('Ordem deve ser um número inteiro')
    .min(0, 'Ordem não pode ser negativa')
    .default(0),

  ativo: z.boolean().default(true),

  estabelecimento_id: z.string().uuid("ID do estabelecimento inválido"),
})

export type CriarCategoriaDTO = z.infer<typeof criarCategoriaSchema>

export const atualizarCategoriaSchema = z.object({
  nome: z
    .string()
    .min(1)
    .max(100)
    .optional(),

  descricao: z
    .string()
    .max(255)
    .optional(),

  icone: z
    .string()
    .max(10)
    .optional(),

  imagem_url: z
    .string()
    .url('URL da imagem inválida')
    .optional(),

  ordem: z
    .number()
    .int()
    .min(0)
    .optional(),

  ativo: z.boolean().optional(),
})

export type AtualizarCategoriaDTO = z.infer<typeof atualizarCategoriaSchema>

export interface CategoriaResponseDTO {
  id: string
  estabelecimento_id: string
  nome: string
  descricao: string | null
  icone: string | null
  imagem_url: string | null
  ordem: number
  ativo: boolean
  criado_em: Date
}