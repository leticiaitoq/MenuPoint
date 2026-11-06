import { z } from 'zod'

export const criarPagamentoSchema = z.object({
  pedido_id: z.string().uuid('ID do pedido inválido'),

  metodo: z.enum(
  ["PIX_ONLINE", "PIX_PRESENCIAL", "DINHEIRO", "CARTAO"] as const,
  {
    message: "Forma de pagamento inválida"
  }
),

  // Ignorado: o valor é sempre o total do pedido no banco
  valor: z.number().positive('Valor deve ser positivo').optional(),

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

// Desfazer pagamento parcial: motivo obrigatório (vai para a auditoria)
export const desfazerParcialSchema = z.object({
  motivo: z.string().trim().min(3, 'Informe o motivo').max(300),
})

export type EstornarPagamentoDTO = z.infer<typeof estornarPagamentoSchema>

// Caixa: fechar a conta INTEIRA da mesa (todos os pedidos em andamento de uma vez).
// Os valores (subtotal, taxa, total) são calculados no servidor; o front só diz como foi pago.
const formaMesaSchema = z.enum(['PIX', 'DEBITO', 'CREDITO', 'DINHEIRO'] as const, {
  message: 'Forma de pagamento inválida',
})

export const finalizarMesaSchema = z.object({
  // Só pode faltar quando os pagamentos parciais já quitaram a conta inteira
  forma: formaMesaSchema.optional(),
  // Só para DINHEIRO: quanto o cliente entregou (para calcular o troco)
  valor_recebido: z.number().positive().optional(),
  // Desconto MANUAL (exige motivo; limitado por perfil — ver conta.ts)
  desconto_valor: z.number().min(0).default(0),
  desconto_motivo: z.string().trim().min(3, 'Informe o motivo do desconto').max(300).optional(),
  // Cupom: o servidor valida o código e calcula o valor (o valor enviado pelo front não vale)
  cupom: z.string().trim().toUpperCase().max(40).optional(),
  // Ignorado: a taxa de serviço é definida pelo servidor (conta.ts)
  taxa_servico_percentual: z.number().min(0).max(30).optional(),
  observacoes: z.string().max(300).optional(),
}).refine((d) => d.desconto_valor === 0 || !!d.desconto_motivo, {
  message: 'Informe o motivo do desconto',
  path: ['desconto_motivo'],
})

export type FinalizarMesaDTO = z.infer<typeof finalizarMesaSchema>

// ── Pagamentos parciais da mesa ─────────────────────────────────────────────

const itemSelecionadoSchema = z.object({
  item_pedido_id: z.string().uuid('item_pedido_id inválido'),
  quantidade: z.number().int().positive(),
})

// PAGAMENTO PARCIAL: o cliente paga só os itens escolhidos (o valor é calculado no servidor)
export const pagamentoParcialSchema = z.object({
  // O valor dos itens pode ser dividido entre várias formas (ex.: parte Pix, parte dinheiro)
  formas: z
    .array(
      z.object({
        forma: formaMesaSchema,
        valor: z.number().positive(),
        valor_recebido: z.number().positive().optional(), // só DINHEIRO (para o troco)
      })
    )
    .min(1, 'Informe a forma de pagamento')
    .max(6, 'Formas de pagamento demais'),
  itens: z.array(itemSelecionadoSchema).min(1, 'Selecione ao menos um item').max(200),
  // Ignorado: a taxa de serviço é definida pelo servidor (conta.ts)
  taxa_servico_percentual: z.number().min(0).max(30).optional(),
  observacoes: z.string().max(300).optional(),
})

// ABATER UM VALOR: o cliente entrega um valor e ele é descontado da conta; os itens são opcionais
export const abatimentoSchema = z.object({
  forma: formaMesaSchema,
  valor: z.number().positive('Informe o valor a abater'),
  itens: z.array(itemSelecionadoSchema).max(200).optional(),
  // Ignorado: a taxa de serviço é definida pelo servidor (conta.ts)
  taxa_servico_percentual: z.number().min(0).max(30).optional(),
  observacoes: z.string().max(300).optional(),
})

export type PagamentoParcialDTO = z.infer<typeof pagamentoParcialSchema>
export type AbatimentoDTO = z.infer<typeof abatimentoSchema>
