import { z } from 'zod'

const HORA = /^([01]\d|2[0-3]):[0-5]\d$/

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

  hora_inicio: z.string().regex(HORA, 'Hora deve estar no formato HH:MM'),

  hora_fim: z.string().regex(HORA, 'Hora deve estar no formato HH:MM'),

  num_pessoas: z
    .number()
    .int()
    .min(1, 'Número de pessoas deve ser ao menos 1')
    .max(50),

  observacoes: z.string().max(500).optional(),

  // true = o cliente não sabe quanto tempo vai ficar (hora_fim é só o tempo que a mesa fica segura)
  duracao_indefinida: z.boolean().optional(),
})

export type CriarReservaDTO = z.infer<typeof criarReservaSchema>

// Reserva feita pelo CLIENTE logado: nome/telefone/e-mail vêm da conta dele (servidor), não do corpo,
// e a mesa é obrigatória (é ela que sai da lista de disponíveis do restaurante).
// Pode ocupar várias mesas (grupo grande): `mesas_ids` traz todas; `mesa_id` é omitido.
export const criarReservaClienteSchema = criarReservaSchema
  .omit({ cliente_nome: true, cliente_telefone: true, cliente_email: true, mesa_id: true })
  .extend({
    mesas_ids: z
      .array(z.string().uuid('ID de mesa inválido'))
      .min(1, 'Escolha ao menos uma mesa')
      .max(30),
  })

export type CriarReservaClienteDTO = z.infer<typeof criarReservaClienteSchema>

// Reserva feita pelo CAIXA (restaurante) para uma mesa: dia, horário e descrição opcional.
// Nasce CONFIRMADA. Sem hora_fim, a mesa fica segura por 2h; sem num_pessoas, usa a capacidade da mesa.
export const criarReservaCaixaSchema = z.object({
  mesa_id: z.string().uuid('ID de mesa inválido'),
  data_reserva: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Data deve estar no formato YYYY-MM-DD'),
  hora_inicio: z.string().regex(HORA, 'Hora deve estar no formato HH:MM'),
  hora_fim: z.string().regex(HORA, 'Hora deve estar no formato HH:MM').optional(),
  descricao: z.string().trim().max(500).optional(),
})

export type CriarReservaCaixaDTO = z.infer<typeof criarReservaCaixaSchema>

export const atualizarStatusReservaSchema = z.object({
  status: z.enum(['CONFIRMADA', 'CONCLUIDA', 'CANCELADA'], {
    message: 'Status deve ser CONFIRMADA, CONCLUIDA ou CANCELADA',
  }),
  mesa_id: z.string().uuid('ID de mesa inválido').optional(),
  // Recado ao cliente junto da decisão (ex.: como as mesas e cadeiras extras serão arrumadas)
  mensagem: z.string().trim().max(500).optional(),
});

export const mensagemReservaSchema = z.object({
  mensagem: z.string().trim().min(1, 'Escreva a mensagem').max(500),
})

export type MensagemReservaDTO = z.infer<typeof mensagemReservaSchema>

export type AtualizarStatusReservaDTO = z.infer<typeof atualizarStatusReservaSchema>

// Query de GET /reservas/publico/:slug/mesas-disponiveis (cliente escolhendo a mesa)
export const mesasDisponiveisQuerySchema = z.object({
  data_reserva: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Data deve estar no formato YYYY-MM-DD'),
  hora_inicio: z.string().regex(HORA, 'Hora deve estar no formato HH:MM'),
  hora_fim: z.string().regex(HORA, 'Hora deve estar no formato HH:MM'),
  // Opcional: só devolve mesas que comportam essa quantidade de pessoas
  pessoas: z.coerce.number().int().min(1).max(50).optional(),
})

export type MesasDisponiveisQuery = z.infer<typeof mesasDisponiveisQuerySchema>

// Query de GET /reservas/publico/:slug/disponibilidade (horários livres de cada mesa no dia)
export const disponibilidadeQuerySchema = z.object({
  data_reserva: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Data deve estar no formato YYYY-MM-DD'),
  pessoas: z.coerce.number().int().min(1).max(50).optional(),
})

export type DisponibilidadeQuery = z.infer<typeof disponibilidadeQuerySchema>
