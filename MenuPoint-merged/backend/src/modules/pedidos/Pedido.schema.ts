import { z } from 'zod'

const itemAdicionalSchema = z.object({
  adicional_id: z.string().uuid('ID do adicional inválido'),
  nome_adicional: z.string().min(1).max(100),
  preco_extra: z.number().min(0),
})

const itemPedidoSchema = z.object({
  produto_id: z.string().uuid('ID do produto inválido'),
  quantidade: z
    .number()
    .int()
    .min(1, 'Quantidade deve ser ao menos 1')
    .max(999, 'Quantidade deve ser no máximo 999'),
  // Ignorado: o service sempre usa o preço do produto no banco. Fica só por compatibilidade.
  preco_unitario: z.number().min(0, 'Preço unitário inválido').default(0),
  observacoes: z.string().max(500).optional(),
  itens_adicionais: z.array(itemAdicionalSchema).default([]),
})

const enderecoEntregaSchema = z.object({
  rua: z.string().min(1),
  numero: z.string().min(1),
  complemento: z.string().optional(),
  bairro: z.string().min(1),
  cidade: z.string().min(1),
  estado: z.string().length(2).toUpperCase(),
  cep: z.string().regex(/^\d{5}-?\d{3}$/, 'CEP inválido'),
})

export const criarPedidoSchema = z.object({
  cliente_id: z.string().uuid().optional(),
  mesa_id: z.string().uuid().optional(),
  reserva_id: z.string().uuid().optional(),

  modalidade: z.enum(
  ["ENTREGA", "MESA", "RETIRADA"] as const,
  {
    message: "Tipo inválido"
  }
),

  cliente_nome: z
    .string()
    .trim()
    .min(1, 'Nome do cliente é obrigatório')
    .max(100, 'Nome do cliente deve ter no máximo 100 caracteres'),

  // Pedido de mesa lançado no salão não precisa de telefone (a coluna é NOT NULL, então guarda "").
  // Entrega e retirada continuam exigindo (a refine abaixo confere).
  cliente_telefone: z
    .string()
    .trim()
    .max(20, 'Telefone deve ter no máximo 20 caracteres')
    .default(''),

  endereco_entrega: enderecoEntregaSchema.optional(),

  observacoes: z.string().max(1000).optional(),

  taxa_entrega: z.number().min(0).default(0),
  desconto: z.number().min(0).default(0),

  forma_pagamento: z
    .enum(['PIX_ONLINE', 'PIX_PRESENCIAL', 'DINHEIRO', 'CARTAO'])
    .optional(),

  troco_para: z.number().min(0).optional(),

  itens: z
    .array(itemPedidoSchema)
    .min(1, 'O pedido deve ter ao menos 1 item')
    .max(100, 'O pedido deve ter no máximo 100 itens'),
})
  .refine(
    (data) => data.modalidade === 'MESA' || data.cliente_telefone.length > 0,
    {
      message: 'Telefone do cliente é obrigatório',
      path: ['cliente_telefone'],
    }
  )
  .refine(
    (data) => {
      if (data.modalidade === 'ENTREGA' && !data.endereco_entrega) {
        return false
      }
      return true
    },
    {
      message: 'Endereço de entrega é obrigatório para modalidade ENTREGA',
      path: ['endereco_entrega'],
    }
  )
  .refine(
    (data) => {
      if (data.modalidade === 'MESA' && !data.mesa_id) {
        return false
      }
      return true
    },
    {
      message: 'mesa_id é obrigatório para modalidade MESA',
      path: ['mesa_id'],
    }
  )

export type CriarPedidoDTO = z.infer<typeof criarPedidoSchema>

export const atualizarStatusPedidoSchema = z.object({
  status: z.enum(
  ["RECEBIDO", "PREPARO", "PRONTO", "ENTREGUE", "CANCELADO"] as const,
  {
    message: "Status inválido"
  }),
  cancelamento_motivo: z.string().max(500).optional(),
})

export type AtualizarStatusPedidoDTO = z.infer<typeof atualizarStatusPedidoSchema>


// Edição de um pedido em andamento: nome do cliente, observações e lista de itens.
// Preço nunca vem do front: itens que já estavam no pedido mantêm o preço de quando foram lançados;
// itens novos usam o preço atual do produto.
export const atualizarPedidoSchema = z.object({
  cliente_nome: z
    .string()
    .trim()
    .min(1, 'Nome do cliente é obrigatório')
    .max(100, 'Nome do cliente deve ter no máximo 100 caracteres'),

  observacoes: z
    .string()
    .trim()
    .max(1000, 'Observações devem ter no máximo 1000 caracteres')
    .optional(),

  itens: z
    .array(
      z.object({
        produto_id: z.string().uuid('ID do produto inválido'),
        quantidade: z
          .number()
          .int()
          .min(1, 'Quantidade deve ser ao menos 1')
          .max(999, 'Quantidade deve ser no máximo 999'),
      })
    )
    .min(1, 'O pedido deve ter ao menos 1 item')
    .max(100, 'O pedido deve ter no máximo 100 itens'),
})

export type AtualizarPedidoDTO = z.infer<typeof atualizarPedidoSchema>
