import api from './api'

export type FormaPagamentoApi = 'PIX' | 'DEBITO' | 'CREDITO' | 'DINHEIRO'

export interface FinalizarMesaDTO {
  /** Pode faltar só quando os pagamentos parciais já quitaram a conta inteira */
  forma?: FormaPagamentoApi
  /** Só para DINHEIRO: quanto o cliente entregou (o servidor calcula o troco) */
  valor_recebido?: number
  /** Desconto MANUAL: exige `desconto_motivo` e respeita o teto do perfil (definido no servidor) */
  desconto_valor?: number
  desconto_motivo?: string
  /** Código do cupom: o servidor valida e calcula o valor (não envie junto com desconto_valor) */
  cupom?: string
  /** Percentual da taxa de serviço (padrão 10) */
  taxa_servico_percentual?: number
  observacoes?: string
}

// ── Conta da mesa e pagamentos parciais ─────────────────────────────────────────

export interface ItemDaConta {
  item_pedido_id: string
  pedido_id: string
  numero_pedido: number
  cliente_nome: string
  produto_nome: string
  adicionais: string[]
  quantidade: number
  quantidade_paga: number
  /** Total da linha (quantidade × unitário, com adicionais), sem taxa de serviço */
  valor_linha: number
  valor_unitario: number
  valor_unitario_com_taxa: number
}

export interface PagamentoParcialRegistrado {
  id: string
  tipo: 'PARCIAL' | 'ABATIMENTO'
  metodo: 'PIX_ONLINE' | 'PIX_PRESENCIAL' | 'DINHEIRO' | 'CARTAO'
  valor: number
  valor_recebido: number | null
  troco: number | null
  observacoes: string | null
  criado_em: string
  itens: { item_pedido_id: string; quantidade: number; valor: number }[]
}

export interface ResumoConta {
  mesa: { id: string; numero: number }
  taxa_servico_percentual: number
  itens: ItemDaConta[]
  subtotal: number
  taxa_servico: number
  /** Subtotal + taxa de serviço (sem desconto) */
  total_conta: number
  /** Soma dos pagamentos parciais/abatimentos ainda abertos */
  pago: number
  restante: number
  pagamentos: PagamentoParcialRegistrado[]
}

export interface FormaDoParcial {
  forma: FormaPagamentoApi
  valor: number
  /** Só DINHEIRO: quanto o cliente entregou (para o troco) */
  valor_recebido?: number
}

export interface ItemSelecionado {
  item_pedido_id: string
  quantidade: number
}

export interface ResultadoParcial {
  ids: string[]
  tipo: 'PARCIAL' | 'ABATIMENTO'
  valor: number
  troco: number
  restante: number
  itens_quitados: number
  /** O que o servidor realmente quitou */
  alocacoes: { item_pedido_id: string; quantidade: number; valor: number }[]
}

export interface ResultadoFinalizacao {
  subtotal: number
  taxa_servico: number
  desconto: number
  total: number
  ja_pago_parcial: number
  restante: number
  valor_recebido: number | null
  troco: number
  pedidos: number[]
}

const PagamentoService = {
  // Caixa: paga a conta INTEIRA da mesa — confirma o pagamento de cada pedido em andamento,
  // entrega os pedidos e libera a mesa (só ADMIN/CAIXA). Os valores são calculados no servidor.
  async finalizarMesa(mesaId: string, dto: FinalizarMesaDTO): Promise<ResultadoFinalizacao> {
    const response = await api.post<ResultadoFinalizacao>(`pagamentos/mesa/${mesaId}/finalizar`, dto)
    return response.data
  },

  // Conta da mesa: itens com o que já foi pago, totais e pagamentos parciais registrados
  async resumoMesa(mesaId: string): Promise<ResumoConta> {
    const response = await api.get<ResumoConta>(`pagamentos/mesa/${mesaId}/resumo`)
    return response.data
  },

  // PAGAMENTO PARCIAL: o cliente paga só os itens escolhidos, dividindo em 1+ formas
  async registrarParcial(
    mesaId: string,
    dto: { formas: FormaDoParcial[]; itens: ItemSelecionado[]; taxa_servico_percentual?: number }
  ): Promise<ResultadoParcial> {
    const response = await api.post<ResultadoParcial>(`pagamentos/mesa/${mesaId}/parcial`, dto)
    return response.data
  },

  // ABATER UM VALOR: desconta da conta o valor que o cliente entregou (itens opcionais)
  async abater(
    mesaId: string,
    dto: { forma: FormaPagamentoApi; valor: number; itens?: ItemSelecionado[]; taxa_servico_percentual?: number }
  ): Promise<ResultadoParcial> {
    const response = await api.post<ResultadoParcial>(`pagamentos/mesa/${mesaId}/abater`, dto)
    return response.data
  },

  // Desfaz um pagamento parcial/abatimento que ainda não foi liquidado
  // (o motivo é obrigatório e fica na auditoria junto com quem desfez)
  async desfazerParcial(mesaId: string, pagamentoId: string, motivo: string): Promise<void> {
    await api.post(`pagamentos/mesa/${mesaId}/parcial/${pagamentoId}/desfazer`, { motivo })
  },
}

export default PagamentoService
