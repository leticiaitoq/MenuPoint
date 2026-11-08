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


// Ingrediente/adicional estilo "totem". O cliente paga preco_extra só pelas unidades ACIMA de
// quantidade_inclusa; retirar não desconta. quantidade_inclusa = 0 significa "adicional" (não vem no produto).
export const NOME_GRUPO_INGREDIENTES = 'Ingredientes'

const ingredienteSchema = z
  .object({
    id: z.string().uuid().optional(),
    nome: z.string().trim().min(1, 'Nome do ingrediente é obrigatório').max(100, 'Nome deve ter no máximo 100 caracteres'),
    preco_extra: z.number().min(0, 'Preço extra não pode ser negativo').max(999999.99, 'Preço extra máximo é R$ 999.999,99').default(0),
    quantidade_inclusa: z.number().int().min(0).max(20, 'Máximo de 20 unidades').default(0),
    quantidade_maxima: z.number().int().min(1, 'A quantidade máxima deve ser ao menos 1').max(20, 'Máximo de 20 unidades').default(1),
    // Fixo: o cliente vê, mas não pode retirar (precisa vir incluso)
    fixo: z.boolean().default(false),
    disponivel: z.boolean().default(true),
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

export type IngredienteDTO = z.infer<typeof ingredienteSchema>

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

  descricao: z
    .string()
    .max(500, 'Descrição deve ter no máximo 500 caracteres')
    .optional(),

  preco: z
    .number()
    .positive('Preço deve ser maior que zero')
    .max(999999.99, 'Preço máximo é R$ 999.999,99'),

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

  ingredientes: z.array(ingredienteSchema).max(50, 'Máximo de 50 ingredientes').optional(),
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
  // null limpa a descrição (antes, apagar o texto no editar não surtia efeito)
  descricao: z.string().max(500, 'Descrição deve ter no máximo 500 caracteres').nullable().optional(),
  preco: z.number().positive().max(999999.99, 'Preço máximo é R$ 999.999,99').optional(),
  preco_promocional: z.number().positive().optional().nullable(),
  imagem_url: z.string().url().optional().nullable(),
  codigo_interno: z.string().max(50).optional(),
  tempo_preparo_min: z.number().int().min(1).optional(),
  disponivel: z.boolean().optional(),
  ativo: z.boolean().optional(),
  destaque: z.boolean().optional(),
  ordem: z.number().int().min(0).optional(),
  // Lista COMPLETA de ingredientes do produto (o que não estiver na lista é removido)
  ingredientes: z.array(ingredienteSchema).max(50, 'Máximo de 50 ingredientes').optional(),
})

export type AtualizarProdutoDTO = z.infer<typeof atualizarProdutoSchema>


export const reordenarProdutosSchema = z.array(
  z.object({
    id: z.string().uuid('ID inválido'),
    ordem: z.number().int().min(0),
  })
).min(1, 'Envie ao menos um produto para reordenar')

export type ReordenarProdutosDTO = z.infer<typeof reordenarProdutosSchema>