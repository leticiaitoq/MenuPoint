import { z } from 'zod'
import { cpfValido } from '@shared/utils/documentos'
import { telefoneValido, formatarTelefone } from '@shared/utils/telefone'

// ── Campos reutilizados ──────────────────────────────────────────────────────
const email = z
  .string()
  .trim()
  .min(1, 'E-mail é obrigatório')
  .email('Formato de e-mail inválido')
  .toLowerCase()

// Mesma regra de senha do restaurante (o front mostra essas 4 regras)
const senhaForte = z
  .string()
  .min(8, 'Senha deve ter no mínimo 8 caracteres')
  .regex(/[A-Z]/, 'Senha deve ter ao menos uma letra maiúscula')
  .regex(/[a-z]/, 'Senha deve ter ao menos uma letra minúscula')
  .regex(/[0-9]/, 'Senha deve ter ao menos um número')

const codigo6 = z
  .string()
  .length(6, 'Código deve ter 6 dígitos')
  .regex(/^\d{6}$/, 'Código deve conter apenas números')

// ── JWT do cliente ───────────────────────────────────────────────────────────
// Mesmo formato do JWTPayload do restaurante, para o @fastify/jwt aceitar os dois.
// perfil/escopo = 'CLIENTE' é o que separa um do outro nas rotas.
export interface ClienteJWTPayload {
  sub: string
  nome: string
  email: string
  perfil: 'CLIENTE'
  escopo: 'CLIENTE'
  estabelecimento_id: null
  empresa_id: null
}

// ── Cadastro ─────────────────────────────────────────────────────────────────
export const registrarClienteSchema = z
  .object({
    nome: z
      .string()
      .trim()
      .min(3, 'Nome completo é obrigatório')
      .max(100, 'Nome deve ter no máximo 100 caracteres'),

    cpf: z
      .string()
      .regex(/^\d{3}\.\d{3}\.\d{3}-\d{2}$/, 'CPF inválido')
      .refine(cpfValido, 'CPF inválido'),

    telefone: z
      .string()
      .trim()
      .refine(telefoneValido, 'Telefone inválido. Use DDD + número')
      .transform(formatarTelefone),

    email,
    senha: senhaForte,
    confirmar_senha: z.string().min(1, 'Confirmação de senha é obrigatória'),
  })
  .refine((d) => d.senha === d.confirmar_senha, {
    message: 'As senhas não coincidem',
    path: ['confirmar_senha'],
  })

export type RegistrarClienteDTO = z.infer<typeof registrarClienteSchema>

// ── Login ────────────────────────────────────────────────────────────────────
export const loginClienteSchema = z.object({
  email,
  senha: z.string().min(1, 'Senha é obrigatória'),
})

export type LoginClienteDTO = z.infer<typeof loginClienteSchema>

// ── Código por e-mail (confirmar cadastro / recuperar senha) ─────────────────
export const verificarCodigoClienteSchema = z.object({
  email,
  codigo: codigo6,
  tipo: z.enum(['registro', 'recuperacao']),
})

export type VerificarCodigoClienteDTO = z.infer<typeof verificarCodigoClienteSchema>

export const reenviarCodigoClienteSchema = z.object({
  email,
  tipo: z.enum(['registro', 'recuperacao']),
})

export type ReenviarCodigoClienteDTO = z.infer<typeof reenviarCodigoClienteSchema>

// ── Recuperação de senha ─────────────────────────────────────────────────────
export const esqueciSenhaClienteSchema = z.object({ email })

export type EsqueciSenhaClienteDTO = z.infer<typeof esqueciSenhaClienteSchema>

export const redefinirSenhaClienteSchema = z
  .object({
    email,
    codigo: codigo6,
    nova_senha: senhaForte,
    confirmar_senha: z.string().min(1, 'Confirmação de senha é obrigatória'),
  })
  .refine((d) => d.nova_senha === d.confirmar_senha, {
    message: 'As senhas não coincidem',
    path: ['confirmar_senha'],
  })

export type RedefinirSenhaClienteDTO = z.infer<typeof redefinirSenhaClienteSchema>

// ── Refresh / logout ─────────────────────────────────────────────────────────
export const refreshTokenClienteSchema = z.object({
  refresh_token: z.string().min(1, 'Refresh token é obrigatório'),
})

// ── Perfil (área logada) ─────────────────────────────────────────────────────
// Só nome e telefone são editáveis. E-mail e CPF não mudam por aqui (o e-mail
// é o login e exigiria nova verificação).
export const atualizarPerfilClienteSchema = z.object({
  nome: z
    .string()
    .trim()
    .min(3, 'Nome completo é obrigatório')
    .max(100, 'Nome deve ter no máximo 100 caracteres'),

  telefone: z
    .string()
    .trim()
    .refine(telefoneValido, 'Telefone inválido. Use DDD + número')
    .transform(formatarTelefone),
})

export type AtualizarPerfilClienteDTO = z.infer<typeof atualizarPerfilClienteSchema>

export const alterarSenhaClienteSchema = z
  .object({
    senha_atual: z.string().min(1, 'Senha atual é obrigatória'),
    nova_senha: senhaForte,
    confirmar_senha: z.string().min(1, 'Confirmação de senha é obrigatória'),
  })
  .refine((d) => d.nova_senha === d.confirmar_senha, {
    message: 'As senhas não coincidem',
    path: ['confirmar_senha'],
  })
  .refine((d) => d.nova_senha !== d.senha_atual, {
    message: 'A nova senha deve ser diferente da atual',
    path: ['nova_senha'],
  })

export type AlterarSenhaClienteDTO = z.infer<typeof alterarSenhaClienteSchema>

// ── Respostas ────────────────────────────────────────────────────────────────
// O que vai para o front (nunca senha_hash). O CPF só sai em GET /me.
export interface ClienteResumoDTO {
  id: string
  nome: string
  email: string
  telefone: string
  email_verificado: boolean
}

// GET/PUT /me — o resumo + dados que só aparecem na tela de perfil
export interface ClientePerfilDTO extends ClienteResumoDTO {
  cpf: string | null
  criado_em: Date
}

export interface ClienteSessaoDTO {
  token: string
  refresh_token: string
  cliente: ClienteResumoDTO
}
