/**
 * Adicionais cadastrados direto na categoria (ex.: "Borda recheada" em Pizzas).
 *
 * ATENÇÃO: o backend ainda NÃO tem endpoint para isso (hoje os adicionais ficam em
 * grupos dentro de cada produto). Enquanto a API não existe, os dados ficam no
 * localStorage do navegador. Todas as funções são async e têm a mesma forma dos
 * outros services, então, quando o endpoint existir, basta trocar o corpo delas
 * por chamadas `api.get/post/put/delete` — a tela não precisa mudar.
 */

export interface AdicionalCategoria {
  id: string
  categoria_id: string
  nome: string
  /** Preço extra em reais */
  preco: number
  descricao: string | null
  ativo: boolean
}

export type NovoAdicionalCategoria = Omit<AdicionalCategoria, 'id' | 'categoria_id'>

const CHAVE = '@menupoint:adicionais-categoria'

const lerTodos = (): AdicionalCategoria[] => {
  try {
    const bruto = localStorage.getItem(CHAVE)
    const lista = bruto ? JSON.parse(bruto) : []
    return Array.isArray(lista) ? lista : []
  } catch {
    return []
  }
}

const gravarTodos = (lista: AdicionalCategoria[]): void => {
  try {
    localStorage.setItem(CHAVE, JSON.stringify(lista))
  } catch {
    throw new Error('Não foi possível salvar o adicional neste navegador.')
  }
}

const novoId = (): string =>
  typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `ad-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`

const AdicionalCategoriaService = {

  async listar(categoria_id: string): Promise<AdicionalCategoria[]> {
    return lerTodos().filter((a) => a.categoria_id === categoria_id)
  },

  /** Quantidade de adicionais por categoria (para mostrar contadores na tabela). */
  async contarPorCategoria(): Promise<Record<string, number>> {
    return lerTodos().reduce<Record<string, number>>((acc, a) => {
      acc[a.categoria_id] = (acc[a.categoria_id] ?? 0) + 1
      return acc
    }, {})
  },

  async criar(categoria_id: string, data: NovoAdicionalCategoria): Promise<AdicionalCategoria> {
    const novo: AdicionalCategoria = { id: novoId(), categoria_id, ...data }
    gravarTodos([...lerTodos(), novo])
    return novo
  },

  async atualizar(id: string, data: NovoAdicionalCategoria): Promise<AdicionalCategoria> {
    const todos = lerTodos()
    const atual = todos.find((a) => a.id === id)
    if (!atual) throw new Error('Adicional não encontrado.')
    const atualizado = { ...atual, ...data }
    gravarTodos(todos.map((a) => (a.id === id ? atualizado : a)))
    return atualizado
  },

  async deletar(id: string): Promise<void> {
    gravarTodos(lerTodos().filter((a) => a.id !== id))
  },

}

export default AdicionalCategoriaService
