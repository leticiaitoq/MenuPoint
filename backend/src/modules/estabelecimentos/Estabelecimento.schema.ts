import { z } from 'zod'

const enderecoSchema = z.object({
  rua: z.string().min(1, 'Rua é obrigatória'),
  numero: z.string().min(1, 'Número é obrigatório'),
  complemento: z.string().optional(),
  bairro: z.string().min(1, 'Bairro é obrigatório'),
  cidade: z.string().min(1, 'Cidade é obrigatória'),
  estado: z
    .string()
    .length(2, 'Estado deve ter 2 caracteres')
    .toUpperCase(),
  cep: z
    .string()
    .regex(/^\d{5}-?\d{3}$/, 'CEP inválido'),
})

const diaSchema = z.object({
  aberto: z.boolean(),
  abertura: z.string().nullable(),
  fechamento: z.string().nullable(),
})

const horarioSchema = z.object({
  segunda: diaSchema,
  terca: diaSchema,
  quarta: diaSchema,
  quinta: diaSchema,
  sexta: diaSchema,
  sabado: diaSchema,
  domingo: diaSchema,
})


export const criarEstabelecimentoSchema = z.object({
  nome: z
    .string()
    .min(1, 'Nome é obrigatório')
    .max(150, 'Nome deve ter no máximo 150 caracteres'),

  slug: z
    .string()
    .min(1, 'Slug é obrigatório')
    .max(100, 'Slug deve ter no máximo 100 caracteres')
    .regex(/^[a-z0-9-]+$/, 'Slug deve conter apenas letras minúsculas, números e hífens')
    .toLowerCase(),

  cnpj: z
    .string()
    .regex(/^\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2}$/, 'CNPJ inválido')
    .optional(),

  telefone: z
    .string()
    .min(1, 'Telefone é obrigatório')
    .max(20, 'Telefone inválido'),

  whatsapp: z
    .string()
    .min(1, 'WhatsApp é obrigatório')
    .max(20, 'WhatsApp inválido'),

  email: z
    .string()
    .email('E-mail inválido')
    .toLowerCase()
    .optional(),

  endereco: enderecoSchema,

  logo_url: z.string().url('URL da logo inválida').optional(),
  banner_url: z.string().url('URL do banner inválida').optional(),

  tema: z.enum(['CLARO', 'ESCURO']).default('CLARO'),

  chave_pix: z.string().max(150).optional(),

  tipo_chave_pix: z
    .enum(['CPF', 'CNPJ', 'EMAIL', 'TELEFONE', 'ALEATORIA'])
    .optional(),

  tempo_entrega_min: z
    .number()
    .int()
    .min(1, 'Tempo mínimo deve ser maior que 0')
    .default(30),

  tempo_entrega_max: z
    .number()
    .int()
    .min(1, 'Tempo máximo deve ser maior que 0')
    .default(60),

  taxa_entrega: z
    .number()
    .min(0, 'Taxa de entrega não pode ser negativa')
    .default(0),

  pedido_minimo: z
    .number()
    .min(0, 'Pedido mínimo não pode ser negativo')
    .default(0),

  aceita_entrega: z.boolean().default(true),
  aceita_retirada: z.boolean().default(true),
  aceita_mesa: z.boolean().default(true),

  horario_funcionamento: horarioSchema.optional(),

  empresa_id: z.string().uuid('ID da empresa inválido').optional(),
})

.refine(
  (data) => data.tempo_entrega_max >= data.tempo_entrega_min,
  {
    message: 'Tempo máximo de entrega deve ser maior ou igual ao mínimo',
    path: ['tempo_entrega_max'],
  }
)

export type CriarEstabelecimentoDTO = z.infer<typeof criarEstabelecimentoSchema>

export const atualizarEstabelecimentoSchema = z.object({
  nome: z.string().min(3).max(150).optional(),
  cnpj: z
    .string()
    .regex(/^\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2}$/, 'CNPJ inválido')
    .optional(),
  telefone: z.string().max(20).optional(),
  whatsapp: z.string().max(20).optional(),
  email: z.string().email().toLowerCase().optional(),
  endereco: enderecoSchema.optional(),
  logo_url: z.string().url().optional(),
  banner_url: z.string().url().optional(),
  tema: z.enum(['CLARO', 'ESCURO']).optional(),
  chave_pix: z.string().max(150).optional(),
  tipo_chave_pix: z
    .enum(['CPF', 'CNPJ', 'EMAIL', 'TELEFONE', 'ALEATORIA'])
    .optional(),
  tempo_entrega_min: z.number().int().min(1).optional(),
  tempo_entrega_max: z.number().int().min(1).optional(),
  taxa_entrega: z.number().min(0).optional(),
  pedido_minimo: z.number().min(0).optional(),
  aceita_entrega: z.boolean().optional(),
  aceita_retirada: z.boolean().optional(),
  aceita_mesa: z.boolean().optional(),
  horario_funcionamento: horarioSchema.optional(),
  ativo: z.boolean().optional(),
})

export type AtualizarEstabelecimentoDTO = z.infer<typeof atualizarEstabelecimentoSchema>