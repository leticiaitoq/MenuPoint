import api from './api'

export interface Categoria {
  id: string
  nome: string
  descricao: string | null
  icone: string | null
  imagem_url: string | null
  ordem: number
  ativo: boolean
}

export interface CategoriaComProdutos extends Categoria {
  produtos: Produto[]
}

export interface Produto {
  id: string
  nome: string
  descricao: string | null
  preco: number
  preco_promocional: number | null
  imagem_url: string | null
  disponivel: boolean
  destaque: boolean
  ordem: number
  grupos_adicionais: GrupoAdicional[]
}

export interface GrupoAdicional {
  id: string
  nome: string
  obrigatorio: boolean
  selecao_multipla: boolean
  min_selecoes: number
  max_selecoes: number
  adicionais: Adicional[]
}

export interface Adicional {
  id: string
  nome: string
  preco_extra: number
  disponivel: boolean
}

const CategoriaService = {

  async listarComProdutos(
    estabelecimento_id: string
  ): Promise<CategoriaComProdutos[]> {
    const response = await api.get<CategoriaComProdutos[]>(
      `/categorias/publico/${estabelecimento_id}`
    )
    return response.data
  },

  async listar(): Promise<Categoria[]> {
    const response = await api.get<Categoria[]>('categorias')
    return response.data
  },

  async criar(data: Partial<Categoria>): Promise<Categoria> {
    const response = await api.post<Categoria>('categorias', data)
    return response.data
  },

  async atualizar(id: string, data: Partial<Categoria>): Promise<Categoria> {
    const response = await api.put<Categoria>(`categorias/${id}`, data)
    return response.data
  },

  async deletar(id: string): Promise<void> {
    await api.delete(`categorias/${id}`)
  },

}

export default CategoriaService