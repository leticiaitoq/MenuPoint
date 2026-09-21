import { z } from 'zod'

export const criarEmpresaSchema = z.object({
  nome: z
    .string()
    .min(1, 'Nome é obrigatório')
    .max(150, 'Nome deve ter no máximo 150 caracteres'),

  cnpj: z
    .string()
    .regex(/^\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2}$/, 'CNPJ inválido')
    .optional(),

  plano: z.enum(["STARTER", "PRO", "BUSINESS", "ENTERPRISE"], {
  message: "Plano inválido"
  }),
})

export type CriarEmpresaDTO = z.infer<typeof criarEmpresaSchema>

export const atualizarEmpresaSchema = z.object({
  nome: z.string().min(1).max(150).optional(),

  cnpj: z
    .string()
    .regex(/^\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2}$/, 'CNPJ inválido')
    .optional(),

  plano: z.enum(['STARTER', 'PRO', 'BUSINESS', 'ENTERPRISE']).optional(),

  ativo: z.boolean().optional(),
})

export type AtualizarEmpresaDTO = z.infer<typeof atualizarEmpresaSchema>
