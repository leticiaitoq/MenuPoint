import { z } from 'zod'
import { telefoneValido, formatarTelefone } from '@shared/utils/telefone'

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

const hora = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Horário inválido (use HH:MM)')

const diaSchema = z
  .object({
    aberto: z.boolean(),
    abertura: hora.nullable(),
    fechamento: hora.nullable(),
  })
  .refine((d) => !d.aberto || (d.abertura !== null && d.fechamento !== null), {
    message: 'Informe abertura e fechamento dos dias abertos',
    path: ['abertura'],
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

// Telefone/WhatsApp: aceita com ou sem máscara, grava sempre formatado.
// Texto vazio apaga o valor (vira null) — são campos opcionais.
const telefoneBR = (rotulo: string) =>
  z
    .string()
    .trim()
    .refine((v) => v === '' || telefoneValido(v), `${rotulo} inválido — informe DDD + número`)
    .transform((v) => (v === '' ? null : formatarTelefone(v)))

// Texto opcional que o usuário pode limpar: "" vira null (apaga o valor no banco).
const textoOuNulo = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .transform((v) => (v === '' ? null : v))
    .nullable()

export const atualizarEstabelecimentoSchema = z
  .object({
    nome: z.string().trim().min(2, 'Nome é obrigatório').max(150).optional(),
    cnpj: z
      .string()
      .regex(/^\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2}$/, 'CNPJ inválido')
      .optional(),
    telefone: telefoneBR('Telefone').optional(),
    whatsapp: telefoneBR('WhatsApp').optional(),
    email: z
      .string()
      .trim()
      .toLowerCase()
      .transform((v) => (v === '' ? null : v))
      .pipe(z.string().email('E-mail inválido').nullable())
      .optional(),
    endereco: enderecoSchema.optional(),
    logo_url: z.string().url().nullable().optional(),
    banner_url: z.string().url().nullable().optional(),
    tema: z.enum(['CLARO', 'ESCURO']).optional(),
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
  .refine(
    (d) =>
      d.tempo_entrega_min === undefined ||
      d.tempo_entrega_max === undefined ||
      d.tempo_entrega_max >= d.tempo_entrega_min,
    {
      message: 'Tempo máximo de entrega deve ser maior ou igual ao mínimo',
      path: ['tempo_entrega_max'],
    }
  )

export type AtualizarEstabelecimentoDTO = z.infer<typeof atualizarEstabelecimentoSchema>

// ── PIX é dado sensível: schema próprio, sempre exigindo a senha atual do
// usuário (verificada no service). Nunca aceito pelo PUT genérico acima.
export const atualizarPixSchema = z
  .object({
    senha_atual: z.string().min(1, 'Informe sua senha'),
    chave_pix: textoOuNulo(150).optional(),
    tipo_chave_pix: z
      .enum(['CPF', 'CNPJ', 'EMAIL', 'TELEFONE', 'ALEATORIA'])
      .nullable()
      .optional(),
  })
  .refine((d) => !d.chave_pix || d.tipo_chave_pix, {
    message: 'Informe o tipo da chave PIX',
    path: ['tipo_chave_pix'],
  })

export type AtualizarPixDTO = z.infer<typeof atualizarPixSchema>