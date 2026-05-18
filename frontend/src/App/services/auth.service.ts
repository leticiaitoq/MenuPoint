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
  usuario: Usuario
}

export interface VerifyCodeDTO {
  email: string
  code: string
}

export interface RegistrarDTO {
  nome_restaurante: string
  cnpj?: string
  email: string
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

  // Verifica o código OTP recebido por e-mail (cadastro ou recuperação)
  async verifyCode(data: VerifyCodeDTO): Promise<LoginResponse> {
    const response = await api.post<LoginResponse>('/auth/verify-code', data)
    return response.data
  },

  // Reenvia o código OTP para o e-mail informado
  async resendCode(email: string): Promise<void> {
    await api.post('/auth/resend-code', { email })
  },

  // Envia e-mail de recuperação de senha
  async esqueciSenha(email: string): Promise<void> {
    await api.post('/auth/esqueci-senha', { email })
  },

  // Redefine a senha com o token recebido por e-mail
  async redefinirSenha(data: {
    token: string
    nova_senha: string
    confirmar_senha: string
  }): Promise<void> {
    await api.post('/auth/redefinir-senha', data)
  },

}

export default AuthService