import { z } from 'zod'
import { cpfValido, cnpjValido } from '@shared/utils/documentos'

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
    pagamento_pendente?: boolean
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

// ── CONFIRMAR E-MAIL / CÓDIGO ──────────────────────────────────────────────────

export const verificarCodigoSchema = z.object({
  email: z
    .string()
    .min(1, 'E-mail é obrigatório')
    .email('Formato de e-mail inválido')
    .toLowerCase(),
  codigo: z
    .string()
    .length(6, 'Código deve ter 6 dígitos')
    .regex(/^\d{6}$/, 'Código deve conter apenas números'),
  tipo: z.enum(['registro', 'recuperacao']),
})

export type VerificarCodigoDTO = z.infer<typeof verificarCodigoSchema>

export const reenviarCodigoSchema = z.object({
  email: z
    .string()
    .min(1, 'E-mail é obrigatório')
    .email('Formato de e-mail inválido')
    .toLowerCase(),
  tipo: z.enum(['registro', 'recuperacao']),
})

export type ReenviarCodigoDTO = z.infer<typeof reenviarCodigoSchema>

// ── REDEFINIR SENHA ──────────────────────────────────────────────────────────
export const redefinirSenhaSchema = z.object({
  email: z
    .string()
    .min(1, 'E-mail é obrigatório')
    .email('Formato de e-mail inválido')
    .toLowerCase(),
  codigo: z
    .string()
    .length(6, 'Código deve ter 6 dígitos')
    .regex(/^\d{6}$/, 'Código deve conter apenas números'),
  nova_senha: z.string().min(6, 'Nova senha deve ter no mínimo 6 caracteres'),
  confirmar_senha: z.string().min(1, 'Confirmação de senha é obrigatória'),
}).refine((data) => data.nova_senha === data.confirmar_senha, {
  message: 'As senhas não coincidem',
  path: ['confirmar_senha'],
})

export type RedefinirSenhaDTO = z.infer<typeof redefinirSenhaSchema>

// ── REGISTRO ─────────────────────────────────────────────────────────────────
// Cadastro em 2 etapas (o front envia tudo de uma vez no final):
//   Etapa 1 — restaurante: nome, CNPJ, razão social e endereço
//   Etapa 2 — responsável: nome, CPF, e-mail e senha
// Cria Empresa + Estabelecimento + Usuário (ADMIN) na mesma transação.
const UFS = [
  'AC', 'AL', 'AP', 'AM', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA', 'MT', 'MS', 'MG', 'PA',
  'PB', 'PR', 'PE', 'PI', 'RJ', 'RN', 'RS', 'RO', 'RR', 'SC', 'SP', 'SE', 'TO',
]

export const registrarSchema = z.object({
  // ── Etapa 1: restaurante ──
  nome_restaurante: z
    .string()
    .trim()
    .min(2, 'Nome do restaurante é obrigatório')
    .max(150, 'Nome deve ter no máximo 150 caracteres'),

  cnpj: z
    .string()
    .regex(/^\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2}$/, 'CNPJ inválido')
    .refine(cnpjValido, 'CNPJ inválido'),

  razao_social: z
    .string()
    .trim()
    .min(3, 'Razão social é obrigatória')
    .max(200, 'Razão social deve ter no máximo 200 caracteres'),

  cep: z
    .string()
    .regex(/^\d{5}-?\d{3}$/, 'CEP inválido')
    .transform((v) => v.replace(/^(\d{5})-?(\d{3})$/, '$1-$2')),

  estado: z
    .string()
    .length(2, 'Estado deve ter 2 caracteres')
    .toUpperCase()
    .refine((uf) => UFS.includes(uf), 'Estado inválido'),

  cidade: z.string().trim().min(1, 'Cidade é obrigatória').max(80),
  endereco: z.string().trim().min(1, 'Endereço é obrigatório').max(150),
  numero: z.string().trim().min(1, 'Número é obrigatório').max(10),
  bairro: z.string().trim().min(1, 'Bairro é obrigatório').max(80),

  // ── Etapa 2: responsável (dono) ──
  nome_responsavel: z
    .string()
    .trim()
    .min(3, 'Nome completo é obrigatório')
    .max(100, 'Nome deve ter no máximo 100 caracteres'),

  cpf: z
    .string()
    .regex(/^\d{3}\.\d{3}\.\d{3}-\d{2}$/, 'CPF inválido')
    .refine(cpfValido, 'CPF inválido'),

  email: z
    .string()
    .min(1, 'E-mail é obrigatório')
    .email('Formato de e-mail inválido')
    .toLowerCase(),

  senha: z
    .string()
    .min(8, 'Senha deve ter no mínimo 8 caracteres')
    .regex(/[A-Z]/, 'Senha deve ter ao menos uma letra maiúscula')
    .regex(/[a-z]/, 'Senha deve ter ao menos uma letra minúscula')
    .regex(/[0-9]/, 'Senha deve ter ao menos um número'),
  confirmar_senha: z.string().min(1, 'Confirmação de senha é obrigatória'),

  // Plano escolhido no site (?plano=starter|pro). Sem ele, o cadastro segue o fluxo antigo.
  plano: z.string().trim().max(30).optional(),

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
    pagamento_pendente?: boolean
  }
}

// ── VERIFICAR SENHA (passo 1 do fluxo "alterar dados sensíveis") ──────────────
export const verificarSenhaSchema = z.object({
  senha: z.string().min(1, 'Informe sua senha'),
})

export type VerificarSenhaDTO = z.infer<typeof verificarSenhaSchema>

// ── ALTERAR DADOS SENSÍVEIS (exige a senha atual) ─────────────────────────────
export const atualizarDadosSensiveisSchema = z
  .object({
    senha_atual: z.string().min(1, 'Informe sua senha para confirmar'),
    nome_responsavel: z
      .string()
      .trim()
      .min(3, 'Nome completo é obrigatório')
      .max(100, 'Nome deve ter no máximo 100 caracteres')
      .optional(),
    email: z
      .string()
      .trim()
      .toLowerCase()
      .email('Formato de e-mail inválido')
      .optional(),
    razao_social: z
      .string()
      .trim()
      .min(3, 'Razão social é obrigatória')
      .max(200, 'Razão social deve ter no máximo 200 caracteres')
      .optional(),
    nome_empresa: z
      .string()
      .trim()
      .min(2, 'Nome da empresa é obrigatório')
      .max(150, 'Nome da empresa deve ter no máximo 150 caracteres')
      .optional(),
  })
  .refine(
    (d) =>
      d.nome_responsavel !== undefined ||
      d.email !== undefined ||
      d.razao_social !== undefined ||
      d.nome_empresa !== undefined,
    { message: 'Nenhuma alteração informada', path: ['senha_atual'] }
  )

export type AtualizarDadosSensiveisDTO = z.infer<typeof atualizarDadosSensiveisSchema>

// ── REFRESH TOKEN ─────────────────────────────────────────────────────────────
export const refreshTokenSchema = z.object({
  refresh_token: z.string().min(1, 'Refresh token é obrigatório'),
})

export type RefreshTokenDTO = z.infer<typeof refreshTokenSchema>