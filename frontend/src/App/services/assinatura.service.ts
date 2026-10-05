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

  // ── Pagamento temporário (sem cobrança real) ──
  // Para usar o Mercado Pago no lugar: troque confirmarPagamento por criar() + init_point.
  async minha(): Promise<{ plano: string; status: string; valor: string | number }> {
    const { data } = await api.get('/assinatura/minha')
    return data
  },

  async confirmarPagamento(): Promise<void> {
    await api.post('/assinatura/confirmar-pagamento')
  },
}

export default AssinaturaService