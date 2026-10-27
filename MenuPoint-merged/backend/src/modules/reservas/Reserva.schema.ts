import { z } from 'zod'

export const criarReservaSchema = z.object({
  mesa_id: z.string().uuid('ID de mesa inválido').optional(),

  cliente_nome: z
    .string()
    .min(2, 'Nome deve ter ao menos 2 caracteres')
    .max(100),

  cliente_telefone: z
    .string()
    .min(8, 'Telefone inválido')
    .max(20),

  cliente_email: z
    .string()
    .email('E-mail inválido')
    .optional(),

  data_reserva: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Data deve estar no formato YYYY-MM-DD'),

  hora_inicio: z
    .string()
    .regex(/^\d{2}:\d{2}$/, 'Hora deve estar no formato HH:MM'),

  hora_fim: z
    .string()
    .regex(/^\d{2}:\d{2}$/, 'Hora deve estar no formato HH:MM'),

  num_pessoas: z
    .number()
    .int()
    .min(1, 'Número de pessoas deve ser ao menos 1')
    .max(50),

  observacoes: z.string().max(500).optional(),
})

export type CriarReservaDTO = z.infer<typeof criarReservaSchema>

export const atualizarStatusReservaSchema = z.object({
  status: z.enum(['CONFIRMADA', 'CONCLUIDA', 'CANCELADA'], {
    message: 'Status deve ser CONFIRMADA, CONCLUIDA ou CANCELADA',
  }),
  mesa_id: z.string().uuid('ID de mesa inválido').optional(),
});

export type AtualizarStatusReservaDTO = z.infer<typeof atualizarStatusReservaSchema>