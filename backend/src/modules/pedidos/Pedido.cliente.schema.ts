import { z } from 'zod'
import { telefoneValido, formatarTelefone } from '@shared/utils/telefone'

const MAX_ITENS = 50
const MAX_QUANTIDADE = 99

/**
 * Pedido feito pelo cliente logado (app delivery): entrega ou retirada, pagamento na hora.
 */
export const criarPedidoClienteSchema = z
  .object({
    modalidade: z.enum(['ENTREGA', 'RETIRADA'], { message: 'Escolha entrega ou retirada' }),

    cliente_nome: z.string().trim().min(1, 'Informe seu nome').max(100, 'Nome deve ter no máximo 100 caracteres'),

    cliente_telefone: z
      .string()
      .trim()
      .max(20, 'Telefone deve ter no máximo 20 caracteres')
      .refine(telefoneValido, 'Informe um telefone válido com DDD, ex.: (16) 99999-9999')
      .transform(formatarTelefone),

    // Endereço salvo do cliente (obrigatório na entrega)
    endereco_id: z.string().uuid('Endereço inválido').optional(),

    // Pagamento é acertado na entrega/retirada: o cliente só escolhe como vai pagar
    forma_pagamento: z.enum(['PIX_PRESENCIAL', 'DINHEIRO', 'CARTAO'], { message: 'Escolha a forma de pagamento' }),
    troco_para: z.number().positive('Valor do troco inválido').max(100000).optional(),

    observacoes: z.string().trim().max(500, 'Observação muito longa').optional(),

    itens: z
      .array(
        z.object({
          produto_id: z.string().uuid('Produto inválido'),
          quantidade: z
            .number()
            .int()
            .min(1, 'Quantidade deve ser ao menos 1')
            .max(MAX_QUANTIDADE, `Quantidade máxima por item: ${MAX_QUANTIDADE}`),
          observacoes: z.string().trim().max(500, 'Observação muito longa').optional(),
          para_levar: z.boolean().optional(),
          ingredientes: z
            .array(
              z.object({
                adicional_id: z.string().uuid('Ingrediente inválido'),
                quantidade: z.number().int().min(0).max(20, 'Quantidade máxima por ingrediente: 20'),
              })
            )
            .max(60, 'Ingredientes demais no mesmo item')
            .optional(),
        })
      )
      .min(1, 'O pedido deve ter ao menos 1 item')
      .max(MAX_ITENS, `Máximo de ${MAX_ITENS} itens por pedido`),
  })
  .refine((d) => d.modalidade !== 'ENTREGA' || Boolean(d.endereco_id), {
    message: 'Escolha o endereço de entrega',
    path: ['endereco_id'],
  })

export type CriarPedidoClienteDTO = z.infer<typeof criarPedidoClienteSchema>
