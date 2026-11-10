import apiCliente from './apiCliente'
import { mensagemDeErro } from './cliente.service'

/** Endereço de entrega salvo na conta do cliente */
export interface EnderecoCliente {
  id: string
  tipo: string
  cep: string
  rua: string
  numero: string
  complemento: string | null
  bairro: string
  cidade: string
  estado: string
  referencia: string | null
  telefone: string | null
  principal: boolean
}

export type NovoEnderecoCliente = Omit<EnderecoCliente, 'id' | 'complemento' | 'referencia' | 'telefone'> & {
  complemento?: string
  referencia?: string
  telefone?: string
}

const EnderecoClienteService = {
  async listar(): Promise<EnderecoCliente[]> {
    try {
      const r = await apiCliente.get<EnderecoCliente[]>('auth/cliente/enderecos')
      return r.data
    } catch (err) {
      throw new Error(mensagemDeErro(err, 'Não foi possível carregar seus endereços.'))
    }
  },

  async criar(dados: NovoEnderecoCliente): Promise<EnderecoCliente> {
    try {
      const r = await apiCliente.post<EnderecoCliente>('auth/cliente/enderecos', dados)
      return r.data
    } catch (err) {
      throw new Error(mensagemDeErro(err, 'Não foi possível salvar o endereço.'))
    }
  },

  async atualizar(id: string, dados: NovoEnderecoCliente): Promise<EnderecoCliente> {
    try {
      const r = await apiCliente.put<EnderecoCliente>(`auth/cliente/enderecos/${id}`, dados)
      return r.data
    } catch (err) {
      throw new Error(mensagemDeErro(err, 'Não foi possível salvar as alterações.'))
    }
  },

  async definirPrincipal(id: string): Promise<EnderecoCliente> {
    const r = await apiCliente.patch<EnderecoCliente>(`auth/cliente/enderecos/${id}/principal`)
    return r.data
  },

  async excluir(id: string): Promise<void> {
    try {
      await apiCliente.delete(`auth/cliente/enderecos/${id}`)
    } catch (err) {
      throw new Error(mensagemDeErro(err, 'Não foi possível excluir o endereço.'))
    }
  },
}

export default EnderecoClienteService
