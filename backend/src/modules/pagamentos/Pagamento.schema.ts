import { z } from 'zod'

export const criarPagamentoSchema = z.object({
  pedido_id: z.string().uuid('ID do pedido inválido'),

  metodo: z.enum(
  ["PIX_ONLINE", "PIX_PRESENCIAL", "DINHEIRO", "CARTAO"] as const,
  {
    message: "Forma de pagamento inválida"
  }
),

  valor: z.number().positive('Valor deve ser positivo'),

  chave_pix_usada: z.string().max(150).optional(),
  comprovante_url: z.string().url().optional(),

  valor_original: z.number().min(0).optional(),
  desconto_percentual: z.number().min(0).max(100).default(0),
  desconto_valor: z.number().min(0).default(0),

  observacoes: z.string().max(500).optional(),
})

export type CriarPagamentoDTO = z.infer<typeof criarPagamentoSchema>

export const confirmarPagamentoSchema = z.object({
  comprovante_url: z.string().url().optional(),
  observacoes: z.string().max(500).optional(),
})

export type ConfirmarPagamentoDTO = z.infer<typeof confirmarPagamentoSchema>

export const estornarPagamentoSchema = z.object({
  observacoes: z.string().min(1, 'Motivo do estorno é obrigatório').max(500),
})

export type EstornarPagamentoDTO = z.infer<typeof estornarPagamentoSchema>
