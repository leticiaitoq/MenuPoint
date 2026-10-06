import { z } from 'zod'

const envSchema = z.object({
  DATABASE_URL: z.string().url('DATABASE_URL deve ser uma URL válida'),
  JWT_SECRET: z.string().min(10, 'menupoint_prj'),
  JWT_EXPIRES_IN: z.string().default('7d'),
  JWT_REFRESH_SECRET: z.string(),
  PORT: z.coerce.number().default(3333),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  FRONTEND_URL: z.string().default('http://localhost:5173'),

  // E-mail (Resend — https://resend.com/api-keys)
  RESEND_API_KEY: z.string().min(1, 'RESEND_API_KEY é obrigatório'),
  // Remetente: precisa ser de um domínio verificado no Resend (SPF/DKIM) para não cair no spam
  MAIL_FROM: z.string().default('Menupoint <noreply@menupoint.com>'),
  // Opcional: para onde vão as respostas dos usuários (ex.: suporte@seudominio.com)
  MAIL_REPLY_TO: z.string().optional(),

  // Código de verificação de e-mail
  CODIGO_EXPIRA_MINUTOS: z.coerce.number().int().min(1).default(15),
  // Intervalo mínimo entre dois reenvios de código para o mesmo usuário
  REENVIO_INTERVALO_SEGUNDOS: z.coerce.number().int().min(0).default(60),

  //Whatspp
  ZAPI_INSTANCE_ID: z.string().optional(),
  ZAPI_TOKEN: z.string().optional(),
  WHATSAPP_NOTIFICACOES: z.string().optional(),


  // Supabase Storage — logo do restaurante (opcional: sem isso o upload avisa que não está configurado)
  SUPABASE_URL: z.string().url().optional(),
  SUPABASE_SERVICE_KEY: z.string().optional(),
  SUPABASE_BUCKET: z.string().default('logos'),

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