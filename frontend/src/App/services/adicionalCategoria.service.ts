import api from './api'

/**
 * Ingredientes/adicionais PADRÃO de uma categoria (ex.: em "Lanches", o X-Queijo duplo vem com
 * 1 pão, 2 carnes e 2 queijos; em "Pizzas", "Borda recheada" é um adicional).
 *
 * Servem de modelo: ao cadastrar um produto da categoria, o restaurante importa o que quiser,
 * ajusta as quantidades e cria itens novos só para aquele produto.
 *
 *  - quantidade_inclusa: unidades que já vêm no produto (sem custo). 0 = adicional.
 *  - quantidade_maxima:  o máximo que o cliente pode pedir.
 *  - preco:              cobrado por cada unidade ACIMA da inclusa.
 */

export interface AdicionalCategoria {
  id: string
  categoria_id: string
  nome: string
  /** Preço extra em reais, por unidade acima da quantidade inclusa */
  preco: number
  descricao: string | null
  ativo: boolean
  /** Unidades que já vêm no produto (0 = adicional) */
  quantidade_inclusa: number
  /** Máximo que o cliente pode pedir */
  quantidade_maxima: number
  /** Fixo: o cliente vê, mas não pode retirar */
  fixo: boolean
}

export type NovoAdicionalCategoria = Omit<AdicionalCategoria, 'id' | 'categoria_id'>

// Formato que a API devolve (preco_extra vem como texto, por ser decimal)
interface IngredienteApi {
  id: string
  categoria_id: string
  nome: string
  descricao: string | null
  preco_extra: number | string
  quantidade_inclusa: number
  quantidade_maxima: number
  fixo: boolean
  ativo: boolean
}

const dePrefixoApi = (a: IngredienteApi): AdicionalCategoria => ({
  id: a.id,
  categoria_id: a.categoria_id,
  nome: a.nome,
  preco: Number(a.preco_extra),
  descricao: a.descricao,
  ativo: a.ativo,
  quantidade_inclusa: a.quantidade_inclusa,
  quantidade_maxima: a.quantidade_maxima,
  fixo: !!a.fixo,
})

const paraApi = (d: NovoAdicionalCategoria) => ({
  nome: d.nome,
  descricao: d.descricao,
  preco_extra: d.preco,
  quantidade_inclusa: d.quantidade_inclusa,
  quantidade_maxima: d.quantidade_maxima,
  fixo: d.fixo,
  ativo: d.ativo,
})

const AdicionalCategoriaService = {

  async listar(categoria_id: string): Promise<AdicionalCategoria[]> {
    const r = await api.get<IngredienteApi[]>(`categorias/${categoria_id}/ingredientes`)
    return r.data.map(dePrefixoApi)
  },

  /** Quantidade de ingredientes por categoria (para mostrar contadores na tabela). */
  async contarPorCategoria(): Promise<Record<string, number>> {
    const r = await api.get<Record<string, number>>('categorias/ingredientes/contagem')
    return r.data
  },

  async criar(categoria_id: string, data: NovoAdicionalCategoria): Promise<AdicionalCategoria> {
    const r = await api.post<IngredienteApi>(`categorias/${categoria_id}/ingredientes`, paraApi(data))
    return dePrefixoApi(r.data)
  },

  async atualizar(id: string, data: NovoAdicionalCategoria): Promise<AdicionalCategoria> {
    const r = await api.put<IngredienteApi>(`categorias/ingredientes/${id}`, paraApi(data))
    return dePrefixoApi(r.data)
  },

  async deletar(id: string): Promise<void> {
    await api.delete(`categorias/ingredientes/${id}`)
  },

}

export default AdicionalCategoriaService
