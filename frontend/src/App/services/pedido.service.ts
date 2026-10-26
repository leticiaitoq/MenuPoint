import api from './api'

export type StatusPedido = 'RECEBIDO' | 'PREPARO' | 'PRONTO' | 'ENTREGUE' | 'CANCELADO'
export type ModalidadePedido = 'MESA' | 'ENTREGA' | 'RETIRADA'

export interface ItemPedido {
  id: string
  produto_id: string
  quantidade: number
  preco_unitario: number
  preco_total: number
  observacoes: string | null
  produto: { id: string; nome: string }
  itens_adicionais?: { id: string; nome_adicional?: string; preco_extra?: number }[]
}

export interface Pedido {
  id: string
  numero_pedido: number
  modalidade: ModalidadePedido
  status: StatusPedido
  cliente_nome: string
  observacoes: string | null
  subtotal: number
  total: number
  desconto?: number
  taxa_entrega?: number
  cancelamento_motivo?: string | null
  forma_pagamento?: 'PIX_ONLINE' | 'PIX_PRESENCIAL' | 'DINHEIRO' | 'CARTAO' | null
  criado_em: string
  mesa: { id: string; numero: number } | null
  /** Vem em GET /pedidos e GET /pedidos/:id */
  atendido_por?: { id: string; nome: string } | null
  pagamento?: {
    id: string
    status: 'PENDENTE' | 'CONFIRMADO' | 'ESTORNADO' | 'FALHOU'
    metodo: 'PIX_ONLINE' | 'PIX_PRESENCIAL' | 'DINHEIRO' | 'CARTAO'
    valor?: number
    desconto_valor?: number
  } | null
  itens: ItemPedido[]
}

// Corpo do POST /pedidos para pedido de MESA lançado no salão.
// O preço NÃO é enviado: o backend usa o preço atual do produto no banco.
export interface CriarPedidoMesaDTO {
  mesa_id: string
  cliente_nome: string
  observacoes?: string
  itens: { produto_id: string; quantidade: number }[]
}

// Corpo do PUT /pedidos/:id (edição de pedido em andamento)
export interface AtualizarPedidoDTO {
  cliente_nome: string
  observacoes?: string
  itens: { produto_id: string; quantidade: number }[]
}

// Corpo do POST /pedidos/transferir (Caixa: transferir pedidos de uma mesa para outra)
export interface TransferirPedidosDTO {
  origem_mesa_id: string
  destino_mesa_id: string
  /** Omitido = todos os pedidos em andamento da mesa de origem */
  pedido_ids?: string[]
  /** Obrigatório quando a mesa de destino já está ocupada/reservada */
  confirmar_mesa_ocupada?: boolean
}

export interface ResultadoTransferencia {
  transferidos: number
  numeros_pedidos: number[]
  origem_liberada: boolean
  destino_numero: number
}

// Corpo do POST /pedidos/juntar (Caixa: unir vários pedidos da MESMA mesa em um só)
export interface JuntarPedidosDTO {
  mesa_id: string
  pedido_ids: string[]
}

export interface ResultadoJuncao {
  pedido_principal_id: string
  pedido_principal: number
  unidos: number[]
  status: StatusPedido
}

export interface FiltrosPedido {
  status?: StatusPedido[]
  modalidade?: ModalidadePedido
  mesa_id?: string
  /** ISO 8601 — filtra por criado_em */
  data_inicio?: string
  data_fim?: string
}

// O Prisma serializa Decimal como string ("49.90"): converte para number aqui
const normalizar = (p: any): Pedido => ({
  ...p,
  subtotal: Number(p.subtotal),
  total: Number(p.total),
  desconto: p.desconto != null ? Number(p.desconto) : 0,
  taxa_entrega: p.taxa_entrega != null ? Number(p.taxa_entrega) : 0,
  pagamento: p.pagamento
    ? {
        ...p.pagamento,
        valor: p.pagamento.valor != null ? Number(p.pagamento.valor) : undefined,
        desconto_valor:
          p.pagamento.desconto_valor != null ? Number(p.pagamento.desconto_valor) : undefined,
      }
    : null,
  itens: (p.itens ?? []).map((i: any) => ({
    ...i,
    preco_unitario: Number(i.preco_unitario),
    preco_total: Number(i.preco_total),
  })),
})

const PedidoService = {

  async listar(filtros?: FiltrosPedido): Promise<Pedido[]> {
    const response = await api.get<any[]>('pedidos', {
      params: {
        status: filtros?.status?.join(','),
        modalidade: filtros?.modalidade,
        mesa_id: filtros?.mesa_id,
        data_inicio: filtros?.data_inicio,
        data_fim: filtros?.data_fim,
      },
    })
    return response.data.map(normalizar)
  },

  // Caixa: cancela todos os pedidos em andamento da mesa e libera a mesa (só ADMIN/CAIXA).
  async cancelarMesa(mesaId: string, motivo: string): Promise<{ cancelados: number }> {
    const response = await api.post<{ cancelados: number }>(`pedidos/mesa/${mesaId}/cancelar`, { motivo })
    return response.data
  },

  // Caixa: remove UM pedido da comanda (vira CANCELADO com o motivo). A mesa só é liberada
  // se não sobrar outro pedido em andamento nela. Pedido já pago não pode ser cancelado.
  async cancelarPedido(id: string, motivo: string): Promise<void> {
    await api.patch(`pedidos/${id}/status`, { status: 'CANCELADO', cancelamento_motivo: motivo })
  },

  // Caixa: transfere pedidos de uma mesa para outra — só ADMIN/CAIXA.
  async transferir(dto: TransferirPedidosDTO): Promise<ResultadoTransferencia> {
    const response = await api.post<ResultadoTransferencia>('pedidos/transferir', dto)
    return response.data
  },

  // Caixa: une vários pedidos da mesma mesa em um só (o mais antigo recebe os itens dos outros,
  // que ficam cancelados como "Unido ao pedido #N") — só ADMIN/CAIXA.
  async juntar(dto: JuntarPedidosDTO): Promise<ResultadoJuncao> {
    const response = await api.post<ResultadoJuncao>('pedidos/juntar', dto)
    return response.data
  },

  async buscarPorId(id: string): Promise<Pedido> {
    const response = await api.get<any>(`pedidos/${id}`)
    return normalizar(response.data)
  },

  // Edita nome, observações e itens de um pedido em andamento.
  // Itens que já estavam no pedido mantêm o preço original; itens novos usam o preço atual.
  async atualizar(id: string, dto: AtualizarPedidoDTO): Promise<Pedido> {
    const response = await api.put<any>(`pedidos/${id}`, dto)
    return normalizar(response.data)
  },

  // Lança um pedido de mesa. O backend pega o preço do banco e marca a mesa como OCUPADA.
  async criarDeMesa(dto: CriarPedidoMesaDTO): Promise<Pedido> {
    const response = await api.post<any>('pedidos', {
      modalidade: 'MESA',
      mesa_id: dto.mesa_id,
      cliente_nome: dto.cliente_nome,
      observacoes: dto.observacoes || undefined,
      itens: dto.itens.map((i) => ({
        produto_id: i.produto_id,
        quantidade: i.quantidade,
      })),
    })
    return normalizar(response.data)
  },

}

export default PedidoService
