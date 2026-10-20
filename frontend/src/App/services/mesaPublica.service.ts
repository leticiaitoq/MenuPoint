import axios from 'axios'

/**
 * Cliente HTTP SEM token, de propósito. O link/QR da mesa é público e quem abre pode ter,
 * no mesmo navegador, a sessão do restaurante OU de um cliente. O backend recusa (403)
 * token de cliente fora das rotas liberadas, então esta consulta nunca envia Authorization:
 * funciona igual para convidado, cliente logado e dono do restaurante.
 */
const apiPublica = axios.create({
  baseURL: `${process.env.REACT_APP_API_URL}/api/v1`,
  timeout: 20000,
  headers: { 'Content-Type': 'application/json' },
})

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
    const r = await apiPublica.get<MesaPublica>(`mesas/qrcode/${encodeURIComponent(token)}`)
    return r.data
  },
}

export default MesaPublicaService
