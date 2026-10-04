import apiCliente from './apiCliente'

// ── Tipos ────────────────────────────────────────────────────────────────────
export interface Cliente {
  id: string
  nome: string
  email: string
  telefone: string
  email_verificado: boolean
}

// GET /auth/cliente/me (inclui o CPF, que não fica guardado no localStorage)
export interface ClientePerfil extends Cliente {
  cpf: string | null
  criado_em: string
}

export interface SessaoCliente {
  token: string
  refresh_token: string
  cliente: Cliente
}

export interface RegistrarClienteDTO {
  nome: string
  cpf: string
  telefone: string
  email: string
  senha: string
  confirmar_senha: string
}

export interface LoginClienteDTO {
  email: string
  senha: string
}

export type TipoCodigo = 'registro' | 'recuperacao'

/**
 * Texto de erro para mostrar na tela.
 * - o servidor respondeu: usa a mensagem dele (422 → mostra o 1º motivo da validação)
 * - timeout / sem rede: diz o que aconteceu de verdade
 * - erro de JavaScript no próprio front: mensagem genérica (detalhe no console)
 */
export function mensagemDeErro(err: any, padrao: string): string {
  if (err?.response) {
    const data = err.response.data
    const primeiro = Array.isArray(data?.errors) ? data.errors[0]?.message : undefined
    return primeiro ?? data?.message ?? padrao
  }

  if (err?.code === 'ECONNABORTED' || err?.code === 'ETIMEDOUT') {
    return 'O servidor demorou demais para responder.'
  }

  if (err?.isAxiosError || err?.code === 'ERR_NETWORK') {
    return 'Não foi possível conectar ao servidor. Verifique se a API está rodando.'
  }

  console.error('Erro inesperado no front:', err)
  return 'Ocorreu um erro inesperado. Tente novamente.'
}

/** true quando a requisição foi enviada mas nenhuma resposta voltou (timeout/rede) */
export function semRespostaDoServidor(err: any): boolean {
  return !err?.response && (err?.isAxiosError || err?.code === 'ECONNABORTED')
}

// ── Chamadas (rotas /api/v1/auth/cliente/*) ──────────────────────────────────
const ClienteService = {

  // Cria a conta. NÃO devolve token: o cliente só entra depois de confirmar o e-mail.
  async registrar(data: RegistrarClienteDTO): Promise<{ message: string; email: string }> {
    const r = await apiCliente.post('auth/cliente/register', data)
    return r.data
  },

  async login(data: LoginClienteDTO): Promise<SessaoCliente> {
    const r = await apiCliente.post<SessaoCliente>('auth/cliente/login', data)
    return r.data
  },

  // Confirma o e-mail do cadastro e já devolve a sessão (cliente entra logado)
  async confirmarEmail(email: string, codigo: string): Promise<SessaoCliente> {
    const r = await apiCliente.post<SessaoCliente>('auth/cliente/verificar-codigo', {
      email,
      codigo,
      tipo: 'registro',
    })
    return r.data
  },

  // Só confere o código da recuperação (a senha é trocada em redefinirSenha)
  async validarCodigoRecuperacao(email: string, codigo: string): Promise<void> {
    await apiCliente.post('auth/cliente/verificar-codigo', { email, codigo, tipo: 'recuperacao' })
  },

  async reenviarCodigo(email: string, tipo: TipoCodigo): Promise<void> {
    await apiCliente.post('auth/cliente/reenviar-codigo', { email, tipo })
  },

  async esqueciSenha(email: string): Promise<void> {
    await apiCliente.post('auth/cliente/esqueci-senha', { email })
  },

  async redefinirSenha(data: {
    email: string
    codigo: string
    nova_senha: string
    confirmar_senha: string
  }): Promise<void> {
    await apiCliente.post('auth/cliente/redefinir-senha', data)
  },

  async me(): Promise<ClientePerfil> {
    const r = await apiCliente.get<{ cliente: ClientePerfil }>('auth/cliente/me')
    return r.data.cliente
  },

  // Atualiza nome e telefone (e-mail e CPF não mudam por aqui)
  async atualizarPerfil(data: { nome: string; telefone: string }): Promise<ClientePerfil> {
    const r = await apiCliente.put<{ cliente: ClientePerfil }>('auth/cliente/me', data)
    return r.data.cliente
  },

  // Exige a senha atual. Devolve uma sessão nova (as outras são encerradas):
  // quem chama deve passá-la para `entrar()` do ClienteAuthContext.
  async alterarSenha(data: {
    senha_atual: string
    nova_senha: string
    confirmar_senha: string
  }): Promise<SessaoCliente> {
    const r = await apiCliente.post<SessaoCliente>('auth/cliente/alterar-senha', data)
    return r.data
  },

  // Invalida o refresh token no servidor (o contexto limpa o localStorage)
  async logout(refresh_token: string): Promise<void> {
    await apiCliente.post('auth/cliente/logout', { refresh_token })
  },
}

export default ClienteService
