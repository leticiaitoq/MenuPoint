import { z } from 'zod'

const envSchema = z.object({
  DATABASE_URL: z.string().url('DATABASE_URL deve ser uma URL válida'),
  JWT_SECRET: z.string().min(10, 'menupoint_prj'),
  JWT_EXPIRES_IN: z.string().default('7d'),
  JWT_REFRESH_SECRET: z.string(),
  PORT: z.coerce.number().default(3333),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  FRONTEND_URL: z.string().default('http://localhost:5173'),

  //E-mail

  MAIL_HOST: z.string().default('smtp.gmail.com'),
  MAIL_PORT: z.coerce.number().default(465),
  MAIL_USER: z.string().email('MAIL_USER deve ser um e-mail válido'),
  MAIL_PASS: z.string().min(1, 'MAIL_PASS é obrigatório'),
  MAIL_FROM: z.string().default('Menupoint <noreply@menupoint.com>'),

  //Whatspp
  ZAPI_INSTANCE_ID: z.string().optional(),
  ZAPI_TOKEN: z.string().optional(),
  WHATSAPP_NOTIFICACOES: z.string().optional(),


  // Mercado Pago — Assinaturas (site)
  MP_ACCESS_TOKEN:  z.string().min(1, 'MP_ACCESS_TOKEN é obrigatório'),
  MP_PUBLIC_KEY:    z.string().min(1, 'MP_PUBLIC_KEY é obrigatório'),
  MP_PLAN_ID_BASICO: z.string().min(1, 'MP_PLAN_ID_BASICO é obrigatório'),
  MP_PLAN_ID_PRO:    z.string().min(1, 'MP_PLAN_ID_PRO é obrigatório'),

  // URL pública do backend (usada no notification_url do MP)
  API_URL: z.string().url().default('http://localhost:3333')
})

const parsed = envSchema.safeParse(process.env)

if (!parsed.success) {
  console.error('Variáveis de ambiente inválidas:')
  console.error(parsed.error.flatten().fieldErrors)
  process.exit(1)
}

export const env = parsed.data