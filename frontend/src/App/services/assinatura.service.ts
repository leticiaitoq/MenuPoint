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
}

export default AssinaturaService