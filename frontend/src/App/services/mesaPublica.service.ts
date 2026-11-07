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

/** Formas de pagamento que o cliente pode avisar ao pedir a conta (valores do enum FormaPagamento do backend) */
export type FormaPagamentoConta = 'PIX_PRESENCIAL' | 'DINHEIRO' | 'CARTAO'


const MesaPublicaService = {
  /** Resolve o token do QR Code na mesa (e no restaurante) a que ele pertence */
  async buscarPorToken(token: string): Promise<MesaPublica> {
    const r = await apiPublica.get<MesaPublica>(`mesas/qrcode/${encodeURIComponent(token)}`)
    return r.data
  },
  /** Cliente na mesa pede atendimento */
async chamarGarcom(token: string): Promise<void> {
  await apiPublica.post(`mesas/qrcode/${encodeURIComponent(token)}/chamar-garcom`)
},
  /**
   * Cliente na mesa pede a conta ao garçom.
   *
   * Contrato para o backend:
   *   POST /api/v1/mesas/qrcode/:token/pedir-conta   (público, sem Authorization)
   *   body (opcional): { "forma_pagamento"?: "PIX_PRESENCIAL" | "DINHEIRO" | "CARTAO" }
   *   2xx = pedido registrado e equipe avisada | 404 = token inválido | 409 = mesa sem pedidos em aberto
   */
  async pedirConta(token: string, formaPagamento?: FormaPagamentoConta): Promise<void> {
    await apiPublica.post(
      `mesas/qrcode/${encodeURIComponent(token)}/pedir-conta`,
      formaPagamento ? { forma_pagamento: formaPagamento } : {}
    )
  },

}

export default MesaPublicaService
