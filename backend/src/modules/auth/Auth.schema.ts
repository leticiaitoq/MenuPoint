import { z } from 'zod'

export const loginSchema = z.object({
  email: z
    .string()
    .min(1, 'E-mail é obrigatório')
    .email('Formato de e-mail inválido')
    .toLowerCase(),
  senha: z
    .string()
    .min(1, 'Senha é obrigatória')
    .min(6, 'Senha deve ter no mínimo 6 caracteres'),
})

export type LoginDTO = z.infer<typeof loginSchema>

export interface JWTPayload {
  sub: string
  nome: string
  email: string
  perfil: string                 // ADMIN | ATENDENTE | CAIXA | CLIENTE
  escopo: string                 // GLOBAL | LOCAL | CLIENTE
  estabelecimento_id: string | null
  empresa_id: string | null
}

export interface LoginResponseDTO {
  token: string
  refresh_token: string
  usuario: {
    id: string
    nome: string
    email: string
    perfil: string
    escopo: string
    estabelecimento_id: string | null
    empresa_id: string | null
  }
}

// ── ESQUECI SENHA ────────────────────────────────────────────────────────────
export const esqueciSenhaSchema = z.object({
  email: z
    .string()
    .min(1, 'E-mail é obrigatório')
    .email('Formato de e-mail inválido')
    .toLowerCase(),
})

export type EsqueciSenhaDTO = z.infer<typeof esqueciSenhaSchema>

// ── REDEFINIR SENHA ──────────────────────────────────────────────────────────
export const redefinirSenhaSchema = z.object({
  token: z.string().min(1, 'Token é obrigatório'),
  nova_senha: z.string().min(6, 'Nova senha deve ter no mínimo 6 caracteres'),
  confirmar_senha: z.string().min(1, 'Confirmação de senha é obrigatória'),
}).refine((data) => data.nova_senha === data.confirmar_senha, {
  message: 'As senhas não coincidem',
  path: ['confirmar_senha'],
})

export type RedefinirSenhaDTO = z.infer<typeof redefinirSenhaSchema>

// ── REGISTRO ─────────────────────────────────────────────────────────────────
export const registrarSchema = z.object({
  nome_restaurante: z
    .string()
    .min(1, 'Nome do restaurante é obrigatório')
    .max(150, 'Nome deve ter no máximo 150 caracteres'),

  cnpj: z
    .string()
    .regex(/^\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2}$/, 'CNPJ inválido')
    .optional(),

  email: z
    .string()
    .min(1, 'E-mail é obrigatório')
    .email('Formato de e-mail inválido')
    .toLowerCase(),

  senha: z.string().min(6, 'Senha deve ter no mínimo 6 caracteres'),
  confirmar_senha: z.string().min(1, 'Confirmação de senha é obrigatória'),

  // Gerado pelo webhook após pagamento da assinatura ser confirmado
  token_pagamento: z
    .string()
    .min(1, 'Token de pagamento inválido.')
    .optional(),
})
.refine((data) => data.senha === data.confirmar_senha, {
  message: 'As senhas não coincidem',
  path: ['confirmar_senha'],
})

export type RegistrarDTO = z.infer<typeof registrarSchema>

export interface RegistrarResponseDTO {
  token: string
  refresh_token: string
  usuario: {
    id: string
    nome: string
    email: string
    perfil: string
    escopo: string
    estabelecimento_id: string
    empresa_id: string
  }
}

// ── REFRESH TOKEN ─────────────────────────────────────────────────────────────
export const refreshTokenSchema = z.object({
  refresh_token: z.string().min(1, 'Refresh token é obrigatório'),
})

export type RefreshTokenDTO = z.infer<typeof refreshTokenSchema>