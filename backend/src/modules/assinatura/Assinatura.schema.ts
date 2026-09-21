import { z } from 'zod'
import { env } from '@config/env'

// IDs de plano válidos — qualquer outro vai retornar 400
const PLAN_IDS_VALIDOS = [
  env.MP_PLAN_ID_BASICO,
  env.MP_PLAN_ID_PRO,
] as const

export const criarAssinaturaSchema = z.object({
  plan_id: z
    .string()
    .min(1, 'plan_id é obrigatório')
    .refine(
      (id) => PLAN_IDS_VALIDOS.includes(id as any),
      { message: 'plan_id inválido. Use GET /api/v1/assinatura/planos para ver os planos disponíveis.' }
    ),
  email: z.string().email('E-mail inválido'),
})

export type CriarAssinaturaDTO = z.infer<typeof criarAssinaturaSchema>

export const webhookMPSchema = z.object({
  type:   z.string(),
  action: z.string().optional(),
  data: z.object({
    id: z.string(),
  }),
})

export type WebhookMPDTO = z.infer<typeof webhookMPSchema>