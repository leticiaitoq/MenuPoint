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

  // A ordem NÃO vem do cliente: é calculada automaticamente pelo service
  // (nova categoria vai para o fim da lista). Para mudar depois, use PATCH /reordenar.

  ativo: z.boolean().default(true),

  // Sempre sobrescrito pelo controller com o estabelecimento do usuário
  // logado (nunca confiar no valor vindo do cliente) — por isso é opcional
  // aqui, senão o parse falha quando o frontend simplesmente não o envia.
  estabelecimento_id: z.string().uuid("ID do estabelecimento inválido").optional(),
})

// `ordem` é preenchida pelo service (automática), não pelo cliente
export type CriarCategoriaDTO = z.infer<typeof criarCategoriaSchema> & { ordem?: number }

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

  // null limpa o ícone (ex.: trocou uma categoria pronta por uma personalizada)
  icone: z
    .string()
    .max(10)
    .nullable()
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

  // Só vale ao reativar (ativo: true): também torna os produtos da categoria disponíveis
  reativar_produtos: z.boolean().optional(),
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