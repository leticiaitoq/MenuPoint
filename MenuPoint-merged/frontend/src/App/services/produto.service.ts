import api from './api'

export interface Adicional {
  id?: string
  nome: string
  preco_extra: number
  disponivel: boolean
  ordem: number
}

export interface GrupoAdicional {
  id?: string
  nome: string
  obrigatorio: boolean
  selecao_multipla: boolean
  min_selecoes: number
  max_selecoes: number
  ordem: number
  adicionais: Adicional[]
}

export interface Produto {
  id: string
  categoria_id: string
  categoria?: { id: string; nome: string }
  nome: string
  descricao: string | null
  preco: number
  preco_promocional: number | null
  imagem_url: string | null
  codigo_interno: string | null
  tempo_preparo_min: number | null
  disponivel: boolean
  ativo: boolean
  destaque: boolean
  ordem: number
  total_vendido?: number
  grupos_adicionais?: GrupoAdicional[]
}

export interface CriarProdutoDTO {
  categoria_id: string
  nome: string
  descricao?: string
  preco: number
  preco_promocional?: number
  imagem_url?: string
  codigo_interno?: string
  tempo_preparo_min?: number
  disponivel?: boolean
  destaque?: boolean
  ordem?: number
  grupos_adicionais?: Omit<GrupoAdicional, 'id'>[]
}

export interface AtualizarProdutoDTO {
  categoria_id?: string
  nome?: string
  descricao?: string | null
  preco?: number
  preco_promocional?: number | null
  imagem_url?: string | null
  codigo_interno?: string
  tempo_preparo_min?: number
  disponivel?: boolean
  ativo?: boolean
  destaque?: boolean
  ordem?: number
}

export interface FiltrosProduto {
  categoria_id?: string
  disponivel?: boolean
  destaque?: boolean
}

// O Prisma serializa Decimal como string no JSON ("49.90"). Converte para number
// aqui, para as telas poderem usar toFixed()/toLocaleString() sem surpresas.
const normalizarProduto = (p: any): Produto => ({
  ...p,
  preco: Number(p.preco),
  preco_promocional: p.preco_promocional == null ? null : Number(p.preco_promocional),
  grupos_adicionais: p.grupos_adicionais?.map((g: any) => ({
    ...g,
    adicionais: g.adicionais?.map((a: any) => ({ ...a, preco_extra: Number(a.preco_extra) })),
  })),
})

const ProdutoService = {

  // Lista os produtos do estabelecimento do usuário logado (token já envia o vínculo)
  async listar(filtros?: FiltrosProduto): Promise<Produto[]> {
    const response = await api.get<Produto[]>('produtos', { params: filtros })
    return response.data.map(normalizarProduto)
  },

  async maisVendidos(limite?: number): Promise<Produto[]> {
    const response = await api.get<Produto[]>('produtos/mais-vendidos', {
      params: limite ? { limite } : undefined,
    })
    return response.data.map(normalizarProduto)
  },

  async buscarPorId(id: string): Promise<Produto> {
    const response = await api.get<Produto>(`produtos/${id}`)
    return normalizarProduto(response.data)
  },

  async criar(data: CriarProdutoDTO): Promise<Produto> {
    const response = await api.post<Produto>('produtos', data)
    return normalizarProduto(response.data)
  },

  async atualizar(id: string, data: AtualizarProdutoDTO): Promise<Produto> {
    const response = await api.put<Produto>(`produtos/${id}`, data)
    return normalizarProduto(response.data)
  },

  async alternarDisponibilidade(id: string): Promise<Produto> {
    const response = await api.patch<Produto>(`produtos/${id}/disponibilidade`)
    return normalizarProduto(response.data)
  },

  async reordenar(itens: { id: string; ordem: number }[]): Promise<void> {
    await api.patch('produtos/reordenar', itens)
  },

  async remover(id: string): Promise<void> {
    await api.delete(`produtos/${id}`)
  },

  async reativar(id: string): Promise<Produto> {
    const response = await api.patch<Produto>(`produtos/${id}/reativar`)
    return normalizarProduto(response.data)
  },

  // Envia a foto para o Storage e devolve a URL pública, para ser usada
  // no campo imagem_url do criar()/atualizar()
  async uploadImagem(arquivo: File): Promise<string> {
    const formData = new FormData()
    formData.append('arquivo', arquivo)

    const response = await api.post<{ imagem_url: string }>(
      'produtos/upload-imagem',
      formData,
      { headers: { 'Content-Type': 'multipart/form-data' } }
    )

    return response.data.imagem_url
  },

}

export default ProdutoService
