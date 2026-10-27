import apiCliente from './apiCliente'
import type { Endereco, HorarioFuncionamento } from './estabelecimento.service'
import type { CategoriaComProdutos } from './categoria.service'

/** Campos públicos do restaurante (GET /estabelecimentos/publico/:slug) */
export interface RestaurantePublico {
  id: string
  nome: string
  slug: string
  logo_url: string | null
  banner_url: string | null
  tema: 'CLARO' | 'ESCURO'
  tipo_cozinha: string | null
  telefone: string | null
  whatsapp: string | null
  endereco: Partial<Endereco> | null
  horario_funcionamento: HorarioFuncionamento | null
  // Decimal do Prisma chega como texto
  taxa_entrega: string | number
  pedido_minimo: string | number
  tempo_entrega_min: number
  tempo_entrega_max: number
  aceita_entrega: boolean
  aceita_retirada: boolean
  aceita_mesa: boolean
}

const RestaurantePublicoService = {
  async buscarPorSlug(slug: string): Promise<RestaurantePublico> {
    const r = await apiCliente.get<RestaurantePublico>(
      `estabelecimentos/publico/${encodeURIComponent(slug)}`
    )
    return r.data
  },

  async cardapio(estabelecimentoId: string): Promise<CategoriaComProdutos[]> {
    const r = await apiCliente.get<CategoriaComProdutos[]>(
      `categorias/publico/${estabelecimentoId}`
    )
    return r.data
  },
}

export default RestaurantePublicoService
