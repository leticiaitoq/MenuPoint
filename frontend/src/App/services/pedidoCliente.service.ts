import apiCliente from './apiCliente'
import { mensagemDeErro } from './cliente.service'
import { ItemCarrinho } from '../shared/components/Carrinho/Carrinho'

/** Pagamento é acertado na entrega/retirada */
export type FormaPagamentoOnline = 'PIX_PRESENCIAL' | 'DINHEIRO' | 'CARTAO'
export type ModalidadeOnline = 'ENTREGA' | 'RETIRADA'
export type StatusPedidoCliente = 'RECEBIDO' | 'PREPARO' | 'PRONTO' | 'ENTREGUE' | 'CANCELADO'

export interface CriarPedidoClienteDTO {
  modalidade: ModalidadeOnline
  cliente_nome: string
  cliente_telefone: string
  endereco_id?: string
  forma_pagamento: FormaPagamentoOnline
  troco_para?: number
  observacoes?: string
  itens: {
    produto_id: string
    quantidade: number
    observacoes?: string
    para_levar?: boolean
    ingredientes?: { adicional_id: string; quantidade: number }[]
  }[]
}

export interface PedidoCriado {
  id: string
  numero_pedido: number
  status: StatusPedidoCliente
  modalidade: ModalidadeOnline
  subtotal: number
  taxa_entrega: number
  total: number
  forma_pagamento: FormaPagamentoOnline | null
}

export interface PedidoDoCliente {
  id: string
  numero_pedido: number
  modalidade: ModalidadeOnline
  status: StatusPedidoCliente
  criado_em: string
  subtotal: number
  taxa_entrega: number
  total: number
  forma_pagamento: FormaPagamentoOnline | 'PIX_ONLINE' | null
  troco_para: number | null
  endereco_entrega: { rua: string; numero: string; complemento?: string; bairro: string; cidade: string; estado: string } | null
  cancelamento_motivo: string | null
  itens: {
    id: string
    nome: string
    imagem_url: string | null
    quantidade: number
    preco_total: number
    observacoes: string | null
  }[]
}

/** Converte o carrinho para o formato do pedido */
export function itensDoCarrinho(itens: ItemCarrinho[]): CriarPedidoClienteDTO['itens'] {
  return itens.map((i) => {
    if (!i.produtoId) throw new Error('Um item do carrinho está desatualizado. Remova e adicione de novo.')
    return {
      produto_id: i.produtoId,
      quantidade: i.quantidade,
      ...(i.observacao ? { observacoes: i.observacao } : {}),
      ...(i.paraLevar ? { para_levar: true } : {}),
      ...(i.ingredientes?.length ? { ingredientes: i.ingredientes } : {}),
    }
  })
}

const PedidoClienteService = {
  /** POST /pedidos/publico/:slug */
  async criar(slug: string, dados: CriarPedidoClienteDTO): Promise<PedidoCriado> {
    try {
      const r = await apiCliente.post<PedidoCriado>(`pedidos/publico/${encodeURIComponent(slug)}`, dados)
      return r.data
    } catch (err) {
      throw new Error(mensagemDeErro(err, 'Não foi possível enviar o pedido. Tente novamente.'))
    }
  },

  /** GET /pedidos/publico/:slug/meus */
  async meus(slug: string): Promise<PedidoDoCliente[]> {
    try {
      const r = await apiCliente.get<PedidoDoCliente[]>(`pedidos/publico/${encodeURIComponent(slug)}/meus`)
      return r.data
    } catch (err) {
      throw new Error(mensagemDeErro(err, 'Não foi possível carregar seus pedidos.'))
    }
  },
}

export default PedidoClienteService
