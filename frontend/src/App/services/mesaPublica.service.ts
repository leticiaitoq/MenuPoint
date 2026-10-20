import apiCliente from './apiCliente'

/** Mesa + restaurante devolvidos pelo GET /mesas/qrcode/:token (rota pública, sem login) */
export interface MesaPublica {
  id: string
  numero: number
  capacidade: number
  status: 'LIVRE' | 'OCUPADA' | 'RESERVADA' | 'INATIVA'
  estabelecimento: {
    id: string
    nome: string
    slug: string
    logo_url: string | null
    tema: 'CLARO' | 'ESCURO'
    aceita_mesa: boolean
  }
}

const MesaPublicaService = {
  /** Resolve o token do QR Code na mesa (e no restaurante) a que ele pertence */
  async buscarPorToken(token: string): Promise<MesaPublica> {
    const r = await apiCliente.get<MesaPublica>(`mesas/qrcode/${encodeURIComponent(token)}`)
    return r.data
  },
}

export default MesaPublicaService
