import { z } from 'zod'

const adicionalSchema = z.object({
  nome: z
    .string()
    .min(1, 'Nome do adicional é obrigatório')
    .max(100, 'Nome deve ter no máximo 100 caracteres'),

  preco_extra: z
    .number()
    .min(0, 'Preço extra não pode ser negativo')
    .default(0),

  disponivel: z.boolean().default(true),

  ordem: z.number().int().min(0).default(0),
})


const grupoAdicionalSchema = z.object({
  nome: z
    .string()
    .min(1, 'Nome do grupo é obrigatório')
    .max(100, 'Nome deve ter no máximo 100 caracteres'),

  obrigatorio: z.boolean().default(false),

  selecao_multipla: z.boolean().default(false),

  min_selecoes: z
    .number()
    .int()
    .min(0)
    .default(0),

  max_selecoes: z
    .number()
    .int()
    .min(1, 'Máximo de seleções deve ser ao menos 1')
    .default(1),

  ordem: z.number().int().min(0).default(0),

  adicionais: z
    .array(adicionalSchema)
    .min(1, 'O grupo deve ter ao menos um adicional'),
})

.refine(
  (data) => data.min_selecoes <= data.max_selecoes,
  {
    message: 'Mínimo de seleções não pode ser maior que o máximo',
    path: ['min_selecoes'],
  }
)


export const criarProdutoSchema = z.object({
  categoria_id: z
    .string()
    .uuid('ID da categoria inválido'),

  nome: z
    .string()
    .min(1, 'Nome é obrigatório')
    .max(150, 'Nome deve ter no máximo 150 caracteres'),

  descricao: z.string().optional(),

  preco: z
    .number()
    .positive('Preço deve ser maior que zero'),

  preco_promocional: z
    .number()
    .positive('Preço promocional deve ser maior que zero')
    .optional(),

  imagem_url: z
    .string()
    .url('URL da imagem inválida')
    .optional(),

  codigo_interno: z
    .string()
    .max(50)
    .optional(),

  tempo_preparo_min: z
    .number()
    .int()
    .min(1)
    .optional(),

  disponivel: z.boolean().default(true),

  destaque: z.boolean().default(false),

  ordem: z.number().int().min(0).default(0),

  grupos_adicionais: z
    .array(grupoAdicionalSchema)
    .optional(),
})

.refine(
  (data) => {
    if (data.preco_promocional && data.preco_promocional >= data.preco) {
      return false
    }
    return true
  },
  {
    message: 'Preço promocional deve ser menor que o preço normal',
    path: ['preco_promocional'],
  }
)

export type CriarProdutoDTO = z.infer<typeof criarProdutoSchema>


export const atualizarProdutoSchema = z.object({
  categoria_id: z.string().uuid().optional(),
  nome: z.string().min(1).max(150).optional(),
  descricao: z.string().optional(),
  preco: z.number().positive().optional(),
  preco_promocional: z.number().positive().optional().nullable(),
  imagem_url: z.string().url().optional().nullable(),
  codigo_interno: z.string().max(50).optional(),
  tempo_preparo_min: z.number().int().min(1).optional(),
  disponivel: z.boolean().optional(),
  ativo: z.boolean().optional(),
  destaque: z.boolean().optional(),
  ordem: z.number().int().min(0).optional(),
})

export type AtualizarProdutoDTO = z.infer<typeof atualizarProdutoSchema>


export const reordenarProdutosSchema = z.array(
  z.object({
    id: z.string().uuid('ID inválido'),
    ordem: z.number().int().min(0),
  })
).min(1, 'Envie ao menos um produto para reordenar')

export type ReordenarProdutosDTO = z.infer<typeof reordenarProdutosSchema>