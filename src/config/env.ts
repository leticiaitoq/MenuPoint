// Carrega e valida as variáveis de ambiente usando Zod
// Se alguma variável obrigatória estiver faltando, a aplicação não sobe

import { z } from 'zod'

// Define o schema de validação das variáveis de ambiente
const envSchema = z.object({
  DATABASE_URL: z.string().url('DATABASE_URL deve ser uma URL válida'),
  JWT_SECRET: z.string().min(10, 'JWT_SECRET deve ter no mínimo 10 caracteres'),
  JWT_EXPIRES_IN: z.string().default('7d'),
  PORT: z.coerce.number().default(3333),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  FRONTEND_URL: z.string().default('*'),
})

// Tenta validar o process.env contra o schema
const parsed = envSchema.safeParse(process.env)

// Se inválido, mostra os erros e encerra o processo
if (!parsed.success) {
  console.error('❌ Variáveis de ambiente inválidas:')
  console.error(parsed.error.flatten().fieldErrors)
  process.exit(1)
}

// Exporta as variáveis já validadas e tipadas
export const env = parsed.data