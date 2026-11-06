import axios from 'axios'

const apiPublica = axios.create({
  baseURL: `${process.env.REACT_APP_API_URL}/api/v1`,
  timeout: 20000,
  headers: { 'Content-Type': 'application/json' },
})

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

export interface PedidoMesaPublico {
  id: string
  numero_pedido: number
  status: 'RECEBIDO' | 'PREPARO' | 'PRONTO' | 'ENTREGUE'
  criado_em: string
  total: number | string
  itens: {
    id: string
    quantidade: number
    preco_unitario: number | string
    preco_total: number | string
    itens_adicionais?: { preco_extra: number | string }[]
    produto: { nome: string; imagem_url: string | null }
  }[]
}

export interface HistoricoMesaPublico {
  mesa: { id: string; numero: number; status?: string }
  pedidos: PedidoMesaPublico[]
}

const MesaPublicaService = {

  async buscarPorToken(token: string): Promise<MesaPublica> {
    const r = await apiPublica.get<MesaPublica>(`mesas/qrcode/${encodeURIComponent(token)}`)
    return r.data
  },

  /** Envia o pedido da mesa para a cozinha (rota pública, sem login). O preço é calculado pelo servidor. */
  async criarPedido(
    token: string,
    dados: {
      cliente_nome: string
      itens: {
        produto_id: string
        quantidade: number
        observacoes?: string
        para_levar?: boolean
        ingredientes?: { adicional_id: string; quantidade: number }[]
      }[]
    }
  ): Promise<{ id: string; numero_pedido: number; status: string; total: number | string }> {
    const r = await apiPublica.post<{ pedido: { id: string; numero_pedido: number; status: string; total: number | string } }>(
      `mesas/qrcode/${encodeURIComponent(token)}/pedidos`,
      dados
    )
    return r.data.pedido
  },

  /** Pedidos recentes da mesa (tela "Meus Pedidos" do cliente local). Rota pública, sem login. */
  async listarPedidos(token: string): Promise<HistoricoMesaPublico> {
    const r = await apiPublica.get<HistoricoMesaPublico>(`mesas/qrcode/${encodeURIComponent(token)}/pedidos`)
    return r.data
  },
}

export default MesaPublicaService
