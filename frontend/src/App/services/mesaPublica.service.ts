import axios from 'axios'

/**
 * Erro das chamadas públicas da mesa, já com o texto que o servidor mandou
 * (ex.: "Não dá para fechar a conta agora: ainda faltam 2 itens..."). `status` é o código HTTP.
 */
export class ErroApi extends Error {
  status?: number
  constructor(mensagem: string, status?: number) {
    super(mensagem)
    this.name = 'ErroApi'
    this.status = status
  }
}

const comoErro = (err: any, padrao: string): ErroApi => {
  if (!err?.response) return new ErroApi('Sem conexão com o servidor. Verifique a internet e tente de novo.')
  const data = err.response.data
  const mensagem = Array.isArray(data?.errors) ? data.errors[0]?.message : data?.message
  return new ErroApi(mensagem ?? padrao, err.response.status)
}

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

/** Formas de pagamento que o cliente pode avisar ao pedir a conta (valores do enum FormaPagamento do backend) */
export type FormaPagamentoConta = 'PIX_PRESENCIAL' | 'DINHEIRO' | 'CARTAO'


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

/** "Ver conta": consumo da mesa e total a pagar (mesmos números do Caixa) */
export interface ContaMesaPublica {
  mesa: { numero: number }
  pedidos: {
    id: string
    numero_pedido: number
    status: 'RECEBIDO' | 'PREPARO' | 'PRONTO' | 'ENTREGUE'
    criado_em: string
    total: number
    itens: { id: string; nome: string; quantidade: number; preco_total: number; entregue: boolean }[]
  }[]
  subtotal: number
  taxa_servico_percentual: number
  taxa_servico: number
  total_com_servico: number
  ja_pago: number
  restante: number
  itens_sem_entrega: number
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
  /** Cliente na mesa pede atendimento */
async chamarGarcom(token: string): Promise<void> {
    try {
      await apiPublica.post(`mesas/qrcode/${encodeURIComponent(token)}/chamar-garcom`)
    } catch (err) {
      throw comoErro(err, 'Não foi possível chamar o garçom.')
    }
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
    try {
      await apiPublica.post(
        `mesas/qrcode/${encodeURIComponent(token)}/pedir-conta`,
        formaPagamento ? { forma_pagamento: formaPagamento } : {}
      )
    } catch (err) {
      throw comoErro(err, 'Não foi possível pedir a conta.')
    }
  },

  /** "Ver conta" (rota pública): o que a mesa consumiu e quanto será cobrado */
  async verConta(token: string): Promise<ContaMesaPublica> {
    try {
      const r = await apiPublica.get<ContaMesaPublica>(`mesas/qrcode/${encodeURIComponent(token)}/conta`)
      return r.data
    } catch (err) {
      throw comoErro(err, 'Não foi possível carregar a conta.')
    }
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
