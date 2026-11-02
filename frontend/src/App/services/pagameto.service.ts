import api from './api'

export type FormaPagamentoApi = 'PIX' | 'DEBITO' | 'CREDITO' | 'DINHEIRO'

export interface FinalizarMesaDTO {
  forma: FormaPagamentoApi
  /** Só para DINHEIRO: quanto o cliente entregou (o servidor calcula o troco) */
  valor_recebido?: number
  desconto_valor?: number
  /** Percentual da taxa de serviço (padrão 10) */
  taxa_servico_percentual?: number
  observacoes?: string
}

export interface ResultadoFinalizacao {
  subtotal: number
  taxa_servico: number
  desconto: number
  total: number
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
}

export default PagamentoService
