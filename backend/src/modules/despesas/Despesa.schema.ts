import { z } from 'zod'

/** Categorias que todo restaurante já tem (as próprias ficam na tabela categorias_despesa). */
export const CATEGORIAS_PADRAO_DESPESA = [
  'Custos dos Produtos',
  'Contas',
  'Marketing',
  'Aluguel',
  'Taxas e Comissões',
  'Outros',
] as const

export const FORMAS_PAGAMENTO_DESPESA = ['PIX', 'BOLETO', 'CARTAO', 'DINHEIRO'] as const

const dataISO = z
  .string({ error: 'Informe a data' })
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Data deve estar no formato AAAA-MM-DD')
  .refine((v) => !Number.isNaN(new Date(v + 'T00:00:00Z').getTime()), 'Data inválida')

const nomeCategoria = z
  .string({ error: 'Informe a categoria' })
  .trim()
  .min(1, 'Informe a categoria')
  .max(50, 'Categoria deve ter no máximo 50 caracteres')

export const despesaSchema = z.object({
  descricao: z
    .string({ error: 'Informe a descrição' })
    .trim()
    .min(1, 'Informe a descrição')
    .max(100, 'Descrição deve ter no máximo 100 caracteres'),
  categoria: nomeCategoria,
  fornecedor: z.string().trim().max(100, 'Fornecedor deve ter no máximo 100 caracteres').optional().or(z.literal('')),
  forma_pagamento: z.enum(FORMAS_PAGAMENTO_DESPESA, { message: 'Forma de pagamento inválida' }),
  valor: z
    .number({ error: 'Informe o valor' })
    .gt(0, 'O valor deve ser maior que zero')
    .max(99999999, 'Valor muito alto'),
  data_despesa: dataISO,
  observacoes: z.string().trim().max(500, 'Observações devem ter no máximo 500 caracteres').optional().or(z.literal('')),
})

export type DespesaDTO = z.infer<typeof despesaSchema>

export const categoriaDespesaSchema = z.object({ nome: nomeCategoria })

export const filtroDespesaSchema = z.object({
  data_inicio: dataISO.optional(),
  data_fim: dataISO.optional(),
  categoria: z.string().trim().max(50).optional(),
  forma_pagamento: z.enum(FORMAS_PAGAMENTO_DESPESA).optional(),
})

export type FiltroDespesa = z.infer<typeof filtroDespesaSchema>
