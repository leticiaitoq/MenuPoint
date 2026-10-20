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
  criado_em: string
  mesa: { id: string; numero: number } | null
  /** Só vem em GET /pedidos/:id (buscarPorId) */
  atendido_por?: { id: string; nome: string } | null
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

export interface FiltrosPedido {
  status?: StatusPedido[]
  modalidade?: ModalidadePedido
  mesa_id?: string
}

// O Prisma serializa Decimal como string ("49.90"): converte para number aqui
const normalizar = (p: any): Pedido => ({
  ...p,
  subtotal: Number(p.subtotal),
  total: Number(p.total),
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
      },
    })
    return response.data.map(normalizar)
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
