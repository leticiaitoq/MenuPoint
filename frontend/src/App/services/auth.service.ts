import api from './api'
import type { Estabelecimento } from './estabelecimento.service'

export interface LoginDTO {
  email: string
  senha: string
}

export interface Usuario {
  id: string
  nome: string
  email: string
  perfil: 'ADMIN' | 'ATENDENTE' | 'CAIXA'
  escopo: 'GLOBAL' | 'LOCAL'
  estabelecimento_id: string | null
  empresa_id: string | null
}

// Dados do usuário lidos direto do banco (GET /auth/me)
export interface UsuarioPerfil extends Usuario {
  cpf: string | null
  ativo: boolean
  email_verificado: boolean
  ultimo_acesso: string | null
  criado_em: string
}

export interface EmpresaPerfil {
  id: string
  nome: string
  razao_social: string | null
  cnpj: string | null
  plano: string
  ativo: boolean
  criado_em: string
}

export interface PerfilResponse {
  token: string
  usuario: UsuarioPerfil
  empresa: EmpresaPerfil | null
  estabelecimento: Estabelecimento | null
  // true = usuário, estabelecimento e empresa apontam uns para os outros
  vinculo_ok: boolean
}

export interface VerificarSenhaDTO {
  senha: string
}

export interface AtualizarDadosSensiveisDTO {
  senha_atual: string
  nome_responsavel?: string
  email?: string
  razao_social?: string
  nome_empresa?: string
}

export interface LoginResponse {
  token: string
  refresh_token: string
  usuario: Usuario
}

export interface VerifyCodeDTO {
  email: string
  code: string
  tipo: 'registro' | 'recuperacao'
}

export interface RegistrarDTO {
  nome_restaurante: string
   nome_fantasia?: string
  razao_social?: string
  nome_responsavel?: string
  cpf?: string
  cnpj?: string
  email: string
  cep?: string
  estado?: string
  cidade?: string
  endereco?: string
  numero?: string
  bairro?: string
  senha: string
  confirmar_senha: string
}

const AuthService = {

  // Cria uma nova conta (empresa + usuário admin)
  async registrar(data: RegistrarDTO): Promise<LoginResponse> {
    const response = await api.post<LoginResponse>('/auth/register', data)
    return response.data
  },

  // Faz login e retorna token + dados do usuário
  async login(data: LoginDTO): Promise<LoginResponse> {
    const response = await api.post<LoginResponse>('auth/login', data)
    return response.data
  },

  // Usuário + empresa + estabelecimento lidos do BANCO (não do token)
  async me(): Promise<PerfilResponse> {
    const response = await api.get<PerfilResponse>('auth/me')
    return response.data
  },

  // Só confere a senha atual (não altera nada). Passo 1 do fluxo de dados sensíveis.
  async verificarSenha(data: VerificarSenhaDTO): Promise<void> {
    await api.post('auth/verificar-senha', data)
  },

  // Altera nome do responsável, e-mail, razão social e nome da empresa. Exige a senha atual.
  async atualizarDadosSensiveis(
    data: AtualizarDadosSensiveisDTO
  ): Promise<{ token: string; email_alterado: boolean }> {
    const response = await api.put<{ token: string; email_alterado: boolean }>('auth/me/dados', data)
    return response.data
  },

  // Verifica o código de 6 dígitos recebido por e-mail (cadastro ou recuperação)
  async verifyCode(data: VerifyCodeDTO): Promise<void> {
    await api.post('/auth/verificar-codigo', {
      email: data.email,
      codigo: data.code,
      tipo: data.tipo,
    })
  },

  // Reenvia o código de 6 dígitos para o e-mail informado
  async resendCode(email: string, tipo: 'registro' | 'recuperacao'): Promise<void> {
    await api.post('/auth/reenviar-codigo', { email, tipo })
  },

  // Envia e-mail de recuperação de senha (código de 6 dígitos)
  async esqueciSenha(email: string): Promise<void> {
    await api.post('/auth/esqueci-senha', { email })
  },

  // Redefine a senha com o código de 6 dígitos recebido por e-mail
  async redefinirSenha(data: {
    email: string
    codigo: string
    nova_senha: string
    confirmar_senha: string
  }): Promise<void> {
    await api.post('/auth/redefinir-senha', data)
  },

    // Limpa os dados da sessão salvos localmente
  logout(): void {
    localStorage.removeItem('@menupoint:token')
    localStorage.removeItem('@menupoint:refresh_token')
    localStorage.removeItem('@menupoint:usuario')
  },

}

export default AuthService