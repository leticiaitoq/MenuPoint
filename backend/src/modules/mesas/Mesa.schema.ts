import { z } from 'zod'


// Limites alinhados com as colunas do banco (numero/capacidade são INT4, localizacao VARCHAR(100)).
// Sem teto, um número gigante estoura o INT e vira erro 500 em vez de erro de validação.
export const MESA_NUMERO_MAX = 9999
export const MESA_CAPACIDADE_MAX = 100
export const MESA_LOCALIZACAO_MAX = 100

export const criarMesaSchema = z.object({
  numero: z
    .number({ error: 'Número da mesa deve ser um número' })
    .int('Número da mesa deve ser inteiro')
    .min(1, 'Número da mesa deve ser maior que zero')
    .max(MESA_NUMERO_MAX, `Número da mesa deve ser no máximo ${MESA_NUMERO_MAX}`),

  capacidade: z
    .number({ error: 'Capacidade deve ser um número' })
    .int('Capacidade deve ser inteira')
    .min(1, 'Capacidade deve ser ao menos 1 pessoa')
    .max(MESA_CAPACIDADE_MAX, `Capacidade deve ser no máximo ${MESA_CAPACIDADE_MAX} pessoas`),

  // Texto livre: remove espaços das pontas e trata "" como "não informado"
  localizacao: z
    .string()
    .trim()
    .max(MESA_LOCALIZACAO_MAX, `Localização deve ter no máximo ${MESA_LOCALIZACAO_MAX} caracteres`)
    .optional()
    .transform((v) => (v ? v : undefined)),

  // Status com que a mesa nasce. Só LIVRE ou RESERVADA: OCUPADA/INATIVA nascem de outras ações.
  status: z.enum(['LIVRE', 'RESERVADA']).optional(),
})

export type CriarMesaDTO = z.infer<typeof criarMesaSchema>


export const atualizarMesaSchema = z.object({
  numero: z
    .number()
    .int()
    .min(1)
    .max(MESA_NUMERO_MAX)
    .optional(),

  capacidade: z
    .number()
    .int()
    .min(1)
    .max(MESA_CAPACIDADE_MAX)
    .optional(),

  localizacao: z
    .string()
    .trim()
    .max(MESA_LOCALIZACAO_MAX)
    .optional(),

  ativo: z.boolean().optional(),
})

export type AtualizarMesaDTO = z.infer<typeof atualizarMesaSchema>

export const atualizarStatusMesaSchema = z.object({
  status: z
    .enum(['LIVRE', 'OCUPADA', 'RESERVADA', 'INATIVA'])
    .refine((val) => val !== undefined, {
      message: 'Status inválido',
    }),
})
export type AtualizarStatusMesaDTO = z.infer<typeof atualizarStatusMesaSchema>


export interface MesaResponseDTO {
  id: string
  estabelecimento_id: string
  numero: number
  capacidade: number
  qr_code_token: string
  qr_code_url: string | null
  localizacao: string | null
  status: string
  ativo: boolean
  criado_em: Date
}

// ── Pedido feito pelo cliente da mesa (rota pública, sem login) ──────────────
// Só aceita o essencial: o preço NUNCA vem do cliente (o service usa o do banco)
// e adicionais não são aceitos aqui (o service confiaria no preço enviado).
export const PEDIDO_PUBLICO_MAX_ITENS = 30
export const PEDIDO_PUBLICO_MAX_QUANTIDADE = 20

// Item de pedido feito pelo cliente (mesa ou delivery). Só ids e quantidades: nomes e preços vêm do banco.
export const itemPedidoPublicoSchema =
  z.object({
    produto_id: z.string().uuid('Produto inválido'),
    quantidade: z
      .number()
      .int()
      .min(1, 'Quantidade deve ser ao menos 1')
      .max(PEDIDO_PUBLICO_MAX_QUANTIDADE, `Quantidade máxima por item: ${PEDIDO_PUBLICO_MAX_QUANTIDADE}`),
    observacoes: z.string().trim().max(500, 'Observação muito longa').optional(),
    // Item para viagem (a cozinha vê "PARA LEVAR" no começo da observação)
    para_levar: z.boolean().optional(),
    // Quantidade escolhida de cada ingrediente/adicional do produto. Só ids e quantidades:
    // nomes e preços são sempre lidos do banco.
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

export const criarPedidoPublicoMesaSchema = z.object({
  cliente_nome: z
    .string({ error: 'Informe o nome' })
    .trim()
    .min(1, 'Informe o nome')
    .max(100, 'Nome deve ter no máximo 100 caracteres'),
  itens: z
    .array(
      itemPedidoPublicoSchema
    )
    .min(1, 'O pedido deve ter ao menos 1 item')
    .max(PEDIDO_PUBLICO_MAX_ITENS, `Máximo de ${PEDIDO_PUBLICO_MAX_ITENS} itens por pedido`),
  // Código aleatório do aparelho do visitante (ver Pedido.convidado_ref). Só é guardado sem login.
  convidado_ref: z.string().uuid('Código de visitante inválido').optional(),
})

export type CriarPedidoPublicoMesaDTO = z.infer<typeof criarPedidoPublicoMesaSchema>

// Cliente que entrou na conta depois de pedir como visitante: pede para ligar esses pedidos a ele
export const vincularPedidosConvidadoSchema = z.object({
  convidado_ref: z.string().uuid('Código de visitante inválido'),
})
