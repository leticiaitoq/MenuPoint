import api from './api'

export interface ChamadoMesa {
  id: string
  tipo: 'GARCOM' | 'CONTA'
  /** Só no pedido de conta: como o cliente avisou que vai pagar */
  forma_pagamento: 'PIX_ONLINE' | 'PIX_PRESENCIAL' | 'DINHEIRO' | 'CARTAO' | null
  criado_em: string
  mesa: { id: string; numero: number }
}

const ChamadoMesaService = {
  /** Chamados de garçom e pedidos de conta em aberto (mais antigos primeiro) */
  async listarAbertos(): Promise<ChamadoMesa[]> {
    const r = await api.get<ChamadoMesa[]>('mesas/chamados')
    return r.data
  },

  /** Dá baixa: o garçom foi até a mesa */
  async atender(id: string): Promise<void> {
    await api.patch(`mesas/chamados/${id}/atender`)
  },
}

export default ChamadoMesaService
