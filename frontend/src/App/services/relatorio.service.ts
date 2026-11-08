import api from './api'

export interface PeriodoRelatorio {
  /** AAAA-MM-DD */
  data_inicio: string
  data_fim: string
}

export interface ResumoRelatorio {
  periodo: PeriodoRelatorio
  /** Vendas do período (entrega/retirada entregues + mesas com a conta fechada no Caixa) */
  faturamento: number
  pedidos_finalizados: number
  ticket_medio: number
  /** Pedidos feitos no período, sem os cancelados (inclui os ainda em andamento) */
  pedidos_total: number
  produtos_mais_vendidos: { produto_id: string; nome: string; quantidade: number }[]
  /** Um item por dia do período, inclusive os sem venda */
  faturamento_diario: { data: string; valor: number }[]
  pedidos_por_categoria: { categoria: string; quantidade: number; percentual: number }[]
  melhor_dia: { data: string; valor: number } | null
}

/** Texto de erro para a tela (usa a mensagem do servidor, quando houver). */
export function mensagemErroRelatorio(err: any, padrao: string): string {
  if (err?.response) {
    if (err.response.status === 403) return 'Apenas o administrador do restaurante pode ver os relatórios.'
    const data = err.response.data
    const primeiro = Array.isArray(data?.errors) ? data.errors[0]?.message : undefined
    return primeiro ?? data?.message ?? padrao
  }
  if (err?.code === 'ECONNABORTED' || err?.code === 'ETIMEDOUT') return 'O servidor demorou demais para responder.'
  if (err?.isAxiosError || err?.code === 'ERR_NETWORK') return 'Não foi possível conectar ao servidor.'
  return padrao
}

const RelatorioService = {
  // GET /api/v1/relatorios/resumo
  async resumo(periodo: PeriodoRelatorio): Promise<ResumoRelatorio> {
    const r = await api.get<ResumoRelatorio>('relatorios/resumo', { params: periodo })
    return r.data
  },
}

export default RelatorioService
