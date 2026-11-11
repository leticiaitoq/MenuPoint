import { z } from 'zod'
import type { FastifyRequest } from 'fastify'
import prisma from '@config/prisma'
import { AppError } from '@shared/errors/AppError'

// Mesmos limites do pedido público da mesa (Mesa.schema.ts)
const PEDIDO_PUBLICO_MAX_ITENS = 30
const PEDIDO_PUBLICO_MAX_QUANTIDADE = 20

// Item enviado pelo cliente (só ids e quantidades: nomes e preços vêm sempre do banco)
const itemPedidoPublicoSchema = z.object({
  produto_id: z.string().uuid('Produto inválido'),
  quantidade: z
    .number()
    .int()
    .min(1, 'Quantidade deve ser ao menos 1')
    .max(PEDIDO_PUBLICO_MAX_QUANTIDADE, `Quantidade máxima por item: ${PEDIDO_PUBLICO_MAX_QUANTIDADE}`),
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

/**
 * Pedidos feitos pelo CLIENTE (sem passar pelo caixa/garçom).
 *
 * Existem dois "sistemas" de cliente, e a origem do pedido é sempre derivada da modalidade:
 *   - LOCAL    → modalidade MESA (QR Code da mesa, dentro do restaurante)
 *   - DELIVERY → modalidade ENTREGA ou RETIRADA (link do restaurante, fora dele)
 * Não existe coluna "origem": derivar da modalidade evita dois campos que podem divergir.
 */
export type OrigemPedido = 'LOCAL' | 'DELIVERY'

export const origemDoPedido = (modalidade: string): OrigemPedido =>
  modalidade === 'MESA' ? 'LOCAL' : 'DELIVERY'

/** Modalidades de cada origem (usado nos filtros do banco) */
export const MODALIDADES_POR_ORIGEM: Record<OrigemPedido, ('MESA' | 'ENTREGA' | 'RETIRADA')[]> = {
  LOCAL: ['MESA'],
  DELIVERY: ['ENTREGA', 'RETIRADA'],
}

// ── Schema do pedido de delivery (entrega ou retirada) ───────────────────────
const enderecoEntregaSchema = z.object({
  rua: z.string().trim().min(1, 'Informe a rua').max(150),
  numero: z.string().trim().min(1, 'Informe o número').max(20),
  complemento: z.string().trim().max(100).optional(),
  bairro: z.string().trim().min(1, 'Informe o bairro').max(100),
  cidade: z.string().trim().min(1, 'Informe a cidade').max(100),
  estado: z.string().trim().length(2, 'Estado deve ter 2 letras').toUpperCase(),
  cep: z.string().regex(/^\d{5}-?\d{3}$/, 'CEP inválido'),
  referencia: z.string().trim().max(150).optional(),
})

export const criarPedidoDeliverySchema = z
  .object({
    modalidade: z.enum(['ENTREGA', 'RETIRADA'], { error: 'Escolha entrega ou retirada' }),
    cliente_nome: z.string().trim().min(1, 'Informe o nome').max(100),
    cliente_telefone: z.string().trim().min(8, 'Informe um telefone válido').max(20),
    endereco_entrega: enderecoEntregaSchema.optional(),
    observacoes: z.string().trim().max(1000).optional(),
    // Delivery é pago na entrega/retirada. Pix online ainda não existe, então não é aceito aqui.
    forma_pagamento: z.enum(['PIX_PRESENCIAL', 'DINHEIRO', 'CARTAO'], {
      error: 'Escolha a forma de pagamento',
    }),
    troco_para: z.number().min(0).optional(),
    itens: z
      .array(itemPedidoPublicoSchema)
      .min(1, 'O pedido deve ter ao menos 1 item')
      .max(PEDIDO_PUBLICO_MAX_ITENS, `Máximo de ${PEDIDO_PUBLICO_MAX_ITENS} itens por pedido`),
  })
  .refine((d) => d.modalidade !== 'ENTREGA' || !!d.endereco_entrega, {
    message: 'Endereço de entrega é obrigatório',
    path: ['endereco_entrega'],
  })

export type CriarPedidoDeliveryDTO = z.infer<typeof criarPedidoDeliverySchema>

// ── Montagem dos itens (ingredientes, "sem", "extra", "para levar") ──────────
type ItemPublico = z.infer<typeof itemPedidoPublicoSchema>

/**
 * Converte os itens enviados pelo cliente no formato do PedidoService.
 * Busca TUDO no banco (nome, preço, quantidade inclusa e máxima): só entram ingredientes
 * que pertençam ao produto do item e estejam disponíveis. Mesma regra para mesa e delivery.
 */
export async function montarItensPublicos(estabelecimento_id: string, itens: ItemPublico[]) {
  const idsIngredientes = Array.from(
    new Set(itens.flatMap((i) => (i.ingredientes ?? []).map((g) => g.adicional_id)))
  )
  const doBanco = idsIngredientes.length
    ? await prisma.adicional.findMany({
        where: {
          id: { in: idsIngredientes },
          disponivel: true,
          grupo: { produto: { estabelecimento_id } },
        },
        include: { grupo: { select: { produto_id: true } } },
      })
    : []
  const ingredientePorId = new Map(doBanco.map((a) => [a.id, a]))

  return itens.map((item) => {
    const itens_adicionais: { adicional_id: string; nome_adicional: string; preco_extra: number }[] = []
    const sem: string[] = []
    const extras: string[] = []
    const vistos = new Set<string>()

    for (const escolha of item.ingredientes ?? []) {
      if (vistos.has(escolha.adicional_id)) throw new AppError('Ingrediente repetido no mesmo item', 400)
      vistos.add(escolha.adicional_id)

      const ing = ingredientePorId.get(escolha.adicional_id)
      if (!ing || ing.grupo.produto_id !== item.produto_id) {
        throw new AppError('Um dos ingredientes escolhidos não está mais disponível. Atualize o cardápio.', 400)
      }
      if (escolha.quantidade > ing.quantidade_maxima) {
        throw new AppError(`Máximo de ${ing.quantidade_maxima} para ${ing.nome}`, 400)
      }

      // Ingrediente fixo não pode ser retirado nem reduzido
      if (ing.fixo && escolha.quantidade < ing.quantidade_inclusa) {
        throw new AppError(`${ing.nome} faz parte do produto e não pode ser retirado`, 400)
      }

      // Regra do totem: paga só o que passa do incluso; tirar não desconta
      const extra = Math.max(0, escolha.quantidade - ing.quantidade_inclusa)
      for (let n = 0; n < extra; n++) {
        itens_adicionais.push({
          adicional_id: ing.id,
          nome_adicional: ing.nome,
          preco_extra: Number(ing.preco_extra),
        })
      }

      if (escolha.quantidade < ing.quantidade_inclusa) {
        sem.push(
          escolha.quantidade === 0
            ? ing.nome
            : `${ing.nome} (${escolha.quantidade} em vez de ${ing.quantidade_inclusa})`
        )
      } else if (extra > 0) {
        extras.push(`${ing.nome} x${extra}`)
      }
    }

    // A cozinha lê isto: o que tirar, o que acrescentar e o recado do cliente
    const observacao = [
      item.para_levar ? 'PARA LEVAR' : '',
      sem.length ? `Sem: ${sem.join(', ')}` : '',
      extras.length ? `Extra: ${extras.join(', ')}` : '',
      item.observacoes ?? '',
    ]
      .filter(Boolean)
      .join(' | ')
      .slice(0, 500)

    return {
      produto_id: item.produto_id,
      quantidade: item.quantidade,
      preco_unitario: 0, // ignorado: o service usa o preço do banco
      ...(observacao ? { observacoes: observacao } : {}),
      itens_adicionais,
    }
  })
}

// ── Login opcional ────────────────────────────────────────────────────────────
/**
 * Rotas públicas (convidado) aceitam o token de cliente de forma OPCIONAL:
 *  - token válido de CLIENTE → devolve o id da conta (o pedido fica no histórico fixo dele)
 *  - sem token, expirado ou de outro perfil → undefined (segue como convidado, o pedido NÃO é bloqueado)
 */
export async function clienteIdOpcional(request: FastifyRequest): Promise<string | undefined> {
  if (!request.headers.authorization?.startsWith('Bearer ')) return undefined
  try {
    await request.jwtVerify()
    const user = request.user as { sub: string; perfil?: string }
    return user.perfil === 'CLIENTE' ? user.sub : undefined
  } catch {
    return undefined
  }
}
