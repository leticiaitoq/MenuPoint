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
  sub: string                    // ID do usuário
  nome: string
  email: string
  perfil: string                 // ADMIN | ATENDENTE | CAIXA
  escopo: string                 // GLOBAL | LOCAL
  estabelecimento_id: string | null
  empresa_id: string | null
}

// Define o que a rota de login devolve ao cliente

export interface LoginResponseDTO {
  token: string
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

// ── DTO ESQUECI SENHA ────────────────────────────────────────────────────────
export const esqueciSenhaSchema = z.object({
  email: z
    .string()
    .min(1, 'E-mail é obrigatório')
    .email('Formato de e-mail inválido')
    .toLowerCase(),
})

export type EsqueciSenhaDTO = z.infer<typeof esqueciSenhaSchema>

// Redefinir senha

export const redefinirSenhaSchema = z.object({
  token: z
    .string()
    .min(1, 'Token é obrigatório'),

  nova_senha: z
    .string()
    .min(1, 'Nova senha é obrigatória')
    .min(6, 'Nova senha deve ter no mínimo 6 caracteres'),

  confirmar_senha: z
    .string()
    .min(1, 'Confirmação de senha é obrigatória'),
})
// Valida que as senhas são iguais
.refine(
  (data) => data.nova_senha === data.confirmar_senha,
  {
    message: 'As senhas não coincidem',
    path: ['confirmar_senha'],
  }
)

export type RedefinirSenhaDTO = z.infer<typeof redefinirSenhaSchema>