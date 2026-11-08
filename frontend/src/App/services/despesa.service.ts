import api from './api'

// ── Tipos ────────────────────────────────────────────────────────────────────
export type FormaPagamentoDespesa = 'PIX' | 'BOLETO' | 'CARTAO' | 'DINHEIRO'

/** Rótulos que a tela mostra para cada forma de pagamento da despesa */
export const FORMAS_PAGAMENTO_DESPESA: { valor: FormaPagamentoDespesa; rotulo: string }[] = [
  { valor: 'PIX', rotulo: 'Pix' },
  { valor: 'BOLETO', rotulo: 'Boleto' },
  { valor: 'CARTAO', rotulo: 'Cartão' },
  { valor: 'DINHEIRO', rotulo: 'Dinheiro' },
]

export const rotuloFormaPagamento = (valor: FormaPagamentoDespesa): string =>
  FORMAS_PAGAMENTO_DESPESA.find((f) => f.valor === valor)?.rotulo ?? valor

export const formaPagamentoDoRotulo = (rotulo: string): FormaPagamentoDespesa =>
  FORMAS_PAGAMENTO_DESPESA.find((f) => f.rotulo === rotulo)?.valor ?? 'PIX'

export interface DespesaApi {
  id: string
  descricao: string
  categoria: string
  fornecedor: string
  forma_pagamento: FormaPagamentoDespesa
  valor: number
  /** AAAA-MM-DD */
  data_despesa: string
  observacoes: string
}

export interface DespesaPayload {
  descricao: string
  categoria: string
  fornecedor?: string
  forma_pagamento: FormaPagamentoDespesa
  valor: number
  data_despesa: string
  observacoes?: string
}

export interface CategoriaDespesaApi {
  nome: string
  /** true = categoria que já vem no sistema (não é do restaurante) */
  padrao: boolean
}

export interface ResumoDespesas {
  total: number
  quantidade: number
  por_categoria: { categoria: string; total: number; quantidade: number }[]
}

export interface PeriodoDespesa {
  data_inicio?: string
  data_fim?: string
}

// ── Erros ────────────────────────────────────────────────────────────────────
/** Texto de erro para a tela (usa a mensagem que o servidor mandou, quando houver). */
export function mensagemErroDespesa(err: any, padrao: string): string {
  if (err?.response) {
    if (err.response.status === 403) return 'Apenas o administrador do restaurante pode acessar as despesas.'
    const data = err.response.data
    const primeiro = Array.isArray(data?.errors) ? data.errors[0]?.message : undefined
    return primeiro ?? data?.message ?? padrao
  }
  if (err?.code === 'ECONNABORTED' || err?.code === 'ETIMEDOUT') return 'O servidor demorou demais para responder.'
  if (err?.isAxiosError || err?.code === 'ERR_NETWORK') return 'Não foi possível conectar ao servidor.'
  return padrao
}

// ── Chamadas (rotas /api/v1/despesas/*) ──────────────────────────────────────
const DespesaService = {
  async listar(periodo: PeriodoDespesa = {}): Promise<DespesaApi[]> {
    const r = await api.get<DespesaApi[]>('despesas', { params: periodo })
    return r.data
  },

  async criar(dados: DespesaPayload): Promise<DespesaApi> {
    const r = await api.post<DespesaApi>('despesas', dados)
    return r.data
  },

  async atualizar(id: string, dados: DespesaPayload): Promise<DespesaApi> {
    const r = await api.put<DespesaApi>(`despesas/${id}`, dados)
    return r.data
  },

  async excluir(id: string): Promise<void> {
    await api.delete(`despesas/${id}`)
  },

  async categorias(): Promise<CategoriaDespesaApi[]> {
    const r = await api.get<CategoriaDespesaApi[]>('despesas/categorias')
    return r.data
  },

  async criarCategoria(nome: string): Promise<CategoriaDespesaApi> {
    const r = await api.post<CategoriaDespesaApi>('despesas/categorias', { nome })
    return r.data
  },

  /** Total e total por categoria no período (painel do Relatórios) */
  async resumo(periodo: PeriodoDespesa = {}): Promise<ResumoDespesas> {
    const r = await api.get<ResumoDespesas>('despesas/resumo', { params: periodo })
    return r.data
  },
}

export default DespesaService
