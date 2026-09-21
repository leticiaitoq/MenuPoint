import api from './api'

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
  estado?: string
  cidade?: string
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

  // Retorna os dados do usuário logado pelo token
  async me(): Promise<{ usuario: Usuario }> {
    const response = await api.get<{ usuario: Usuario }>('auth/me')
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
    localStorage.removeItem('@menupoint:usuario')
  },

}

export default AuthService