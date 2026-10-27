import api from './api'

export interface Mesa {
  id: string
  numero: number
  capacidade: number
  qr_code_token: string
  qr_code_url: string
  localizacao: string | null
  status: 'LIVRE' | 'OCUPADA' | 'RESERVADA' | 'INATIVA'
  ativo: boolean
}

// Corpo do POST /mesas (o backend valida de novo: número 1–9999, capacidade 1–100)
export interface CriarMesaDTO {
  numero: number
  capacidade: number
  localizacao?: string
  status?: 'LIVRE' | 'RESERVADA'
}

export interface ResumoOcupacao {
  total: number
  livre: number
  ocupada: number
  reservada: number
  inativa: number
}

const MesaService = {

  async buscarPorToken(token: string): Promise<Mesa> {
    const response = await api.get<Mesa>(`mesas/qrcode/${token}`)
    return response.data
  },

  async listar(todas = false): Promise<Mesa[]> {
    const response = await api.get<Mesa[]>('mesas', {
      params: { todas: todas ? 'true' : undefined },
    })
    return response.data
  },

  async resumoOcupacao(): Promise<ResumoOcupacao> {
    const response = await api.get<ResumoOcupacao>('mesas/ocupacao')
    return response.data
  },

  async criar(data: CriarMesaDTO): Promise<Mesa> {
    const response = await api.post<Mesa>('mesas', data)
    return response.data
  },

  async atualizarStatus(
    id: string,
    status: Mesa['status']
  ): Promise<Mesa> {
    const response = await api.patch<Mesa>(`mesas/${id}/status`, { status })
    return response.data
  },

  async reativar(id: string): Promise<Mesa> {
    const response = await api.patch<Mesa>(`mesas/${id}/reativar`)
    return response.data
  },

  async deletar(id: string): Promise<void> {
    await api.delete(`mesas/${id}`)
  },

}

export default MesaService