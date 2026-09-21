import { z } from 'zod'


export const criarMesaSchema = z.object({
  numero: z
    .number()
    .int('Número da mesa deve ser inteiro')
    .min(1, 'Número da mesa deve ser maior que zero'),

  capacidade: z
    .number()
    .int('Capacidade deve ser inteira')
    .min(1, 'Capacidade deve ser ao menos 1 pessoa'),

  localizacao: z
    .string()
    .max(100, 'Localização deve ter no máximo 100 caracteres')
    .optional(),
})

export type CriarMesaDTO = z.infer<typeof criarMesaSchema>


export const atualizarMesaSchema = z.object({
  numero: z
    .number()
    .int()
    .min(1)
    .optional(),

  capacidade: z
    .number()
    .int()
    .min(1)
    .optional(),

  localizacao: z
    .string()
    .max(100)
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