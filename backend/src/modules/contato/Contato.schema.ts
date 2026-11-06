import { z } from 'zod'

// Formulário "Falar com especialista" (plano Enterprise) do site institucional.
export const contatoEspecialistaSchema = z.object({
  nome: z.string().trim().min(2, 'Informe seu nome').max(100, 'Nome muito longo'),

  email: z.string().trim().toLowerCase().email('E-mail inválido').max(150, 'E-mail muito longo'),

  telefone: z.string().trim().max(20, 'Telefone muito longo').optional().default(''),

  restaurante: z.string().trim().max(150, 'Nome do restaurante muito longo').optional().default(''),

  mensagem: z.string().trim().max(1000, 'Mensagem muito longa (máximo 1000 caracteres)').optional().default(''),

  // Isca para robôs: o site esconde este campo, então uma pessoa nunca o preenche.
  website: z.string().max(200).optional().default(''),
})

export type ContatoEspecialistaDTO = z.infer<typeof contatoEspecialistaSchema>
