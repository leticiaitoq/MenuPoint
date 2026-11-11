import apiCliente from './apiCliente'

/**
 * Pedidos do CLIENTE (conta logada) — delivery e histórico fixo.
 *
 * O cliente tem UMA conta e dois "sistemas" que não se misturam no acesso (ver SistemaClienteContext),
 * mas cujo histórico é um só. A origem de cada pedido diz de onde ele veio:
 *   LOCAL    → pedido de mesa (QR Code, dentro do restaurante)
 *   DELIVERY → entrega ou retirada (link do restaurante, fora dele)
 */
export type OrigemPedido = 'LOCAL' | 'DELIVERY'
export type ModalidadePedidoCliente = 'MESA' | 'ENTREGA' | 'RETIRADA'
export type StatusPedidoCliente = 'RECEBIDO' | 'PREPARO' | 'PRONTO' | 'ENTREGUE' | 'CANCELADO'
export type FormaPagamentoDelivery = 'PIX_PRESENCIAL' | 'DINHEIRO' | 'CARTAO'

export interface EnderecoEntrega {
  rua: string
  numero: string
  complemento?: string
  bairro: string
  cidade: string
  estado: string
  cep: string
  referencia?: string
}

export interface ItemHistorico {
  id: string
  nome: string
  quantidade: number
  /** Preço unitário já com os extras (ingredientes acima do incluso) */
  preco: number
  imagem: string | null
}

/** Pedido no formato que as telas de histórico usam (local e delivery usam o MESMO) */
export interface PedidoHistorico {
  id: string
  numero: number
  origem: OrigemPedido
  modalidade: ModalidadePedidoCliente
  status: StatusPedidoCliente
  criadoEm: string
  total: number
  taxaEntrega: number
  formaPagamento: string | null
  /** Número da mesa (só pedido LOCAL) */
  mesaNumero: number | null
  restaurante: { nome: string; slug: string; logo: string | null } | null
  endereco: EnderecoEntrega | null
  motivoCancelamento: string | null
  itens: ItemHistorico[]
}

export interface CriarPedidoDeliveryDTO {
  modalidade: 'ENTREGA' | 'RETIRADA'
  cliente_nome: string
  cliente_telefone: string
  endereco_entrega?: EnderecoEntrega
  observacoes?: string
  forma_pagamento: FormaPagamentoDelivery
  troco_para?: number
  itens: {
    produto_id: string
    quantidade: number
    observacoes?: string
    para_levar?: boolean
    ingredientes?: { adicional_id: string; quantidade: number }[]
  }[]
}

export interface PedidoDeliveryCriado {
  id: string
  numero_pedido: number
  status: StatusPedidoCliente
  modalidade: 'ENTREGA' | 'RETIRADA'
  total: number
}

// O Prisma serializa Decimal como string ("49.90"): converte aqui, uma vez só
const num = (v: unknown) => (v == null ? 0 : Number(v))

const converter = (p: any): PedidoHistorico => ({
  id: p.id,
  numero: p.numero_pedido,
  origem: p.origem as OrigemPedido,
  modalidade: p.modalidade,
  status: p.status,
  criadoEm: p.criado_em,
  total: num(p.total),
  taxaEntrega: num(p.taxa_entrega),
  formaPagamento: p.forma_pagamento ?? null,
  mesaNumero: p.mesa?.numero ?? null,
  restaurante: p.estabelecimento
    ? { nome: p.estabelecimento.nome, slug: p.estabelecimento.slug, logo: p.estabelecimento.logo_url ?? null }
    : null,
  endereco: p.endereco_entrega ?? null,
  motivoCancelamento: p.cancelamento_motivo ?? null,
  itens: (p.itens ?? []).map((i: any) => ({
    id: i.id,
    nome: i.produto?.nome ?? 'Produto',
    quantidade: i.quantidade,
    preco:
      num(i.preco_unitario) +
      (i.itens_adicionais ?? []).reduce((s: number, a: any) => s + num(a.preco_extra), 0),
    imagem: i.produto?.imagem_url ?? null,
  })),
})

const PedidoClienteService = {
  /**
   * Histórico FIXO da conta (não some quando a conta da mesa fecha): local e delivery juntos.
   * `slug` restringe a um restaurante; `origem` filtra no servidor (as telas filtram no front).
   */
  async historico(filtros?: { slug?: string | null; origem?: OrigemPedido }): Promise<PedidoHistorico[]> {
    const r = await apiCliente.get<any[]>('pedidos/cliente/historico', {
      params: { slug: filtros?.slug || undefined, origem: filtros?.origem },
    })
    return r.data.map(converter)
  },

  /** Pedido de delivery (entrega/retirada). Preço, taxa e pedido mínimo são conferidos no servidor. */
  async criarDelivery(slug: string, dto: CriarPedidoDeliveryDTO): Promise<PedidoDeliveryCriado> {
    const r = await apiCliente.post<{ pedido: PedidoDeliveryCriado }>(
      `pedidos/publico/${encodeURIComponent(slug)}`,
      dto
    )
    return { ...r.data.pedido, total: num(r.data.pedido.total) }
  },
}

export default PedidoClienteService
