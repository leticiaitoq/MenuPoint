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