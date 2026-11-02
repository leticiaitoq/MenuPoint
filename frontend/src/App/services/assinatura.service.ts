import api from './api'

export interface Plano {
  id: string
  nome: string
  slug: string
  valor: number
  plano: string
}

const AssinaturaService = {
  async listarPlanos(): Promise<Plano[]> {
    const { data } = await api.get('/assinatura/planos')
    return data
  },

  async criar(plan_id: string, email: string): Promise<{ init_point: string }> {
    const { data } = await api.post('/assinatura/criar', { plan_id, email })
    return data
  },

  /** Pagamento real: gera o link do Mercado Pago para a cobrança pendente do cadastro. */
  async checkout(): Promise<{ init_point: string }> {
    const { data } = await api.post('/assinatura/checkout')
    return data
  },

  /** Define (ou troca) o plano da cobrança pendente, antes de ir para o pagamento. */
  async escolherPlano(plano: string): Promise<{ plano: string; valor: number }> {
    const { data } = await api.post('/assinatura/plano', { plano })
    return data
  },

  /** Confere o pagamento direto no Mercado Pago e devolve o status atual. */
  async sincronizar(): Promise<{ status: string; status_mp?: string | null }> {
    const { data } = await api.post('/assinatura/sincronizar')
    return data
  },

  /** Assinatura mais recente da empresa (status, plano e valor). */
  async minha(): Promise<{ plano: string; status: string; valor: string | number }> {
    const { data } = await api.get('/assinatura/minha')
    return data
  },
}

export default AssinaturaService