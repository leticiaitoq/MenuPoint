import api from './api'
import { prepararImagem } from './imagem'

export type DiaSemana =
  | 'segunda'
  | 'terca'
  | 'quarta'
  | 'quinta'
  | 'sexta'
  | 'sabado'
  | 'domingo'

export interface DiaHorario {
  aberto: boolean
  abertura: string | null // "HH:MM"
  fechamento: string | null // "HH:MM"
}

export type HorarioFuncionamento = Record<DiaSemana, DiaHorario>

export interface Endereco {
  rua: string
  numero: string
  complemento?: string
  bairro: string
  cidade: string
  estado: string
  cep: string
}

export type TipoChavePix = 'CPF' | 'CNPJ' | 'EMAIL' | 'TELEFONE' | 'ALEATORIA'

export interface Estabelecimento {
  id: string
  empresa_id: string | null
  nome: string
  slug: string
  cnpj: string | null
  telefone: string | null
  whatsapp: string | null
  email: string | null
  endereco: Partial<Endereco> | null
  logo_url: string | null
  banner_url: string | null
  tema: 'CLARO' | 'ESCURO'
  tipo_cozinha: string | null
  chave_pix: string | null
  tipo_chave_pix: TipoChavePix | null
  tempo_entrega_min: number
  tempo_entrega_max: number
  // Decimal do Prisma chega como texto ("5" ou "5.00")
  taxa_entrega: string | number
  pedido_minimo: string | number
  aceita_entrega: boolean
  aceita_retirada: boolean
  aceita_mesa: boolean
  horario_funcionamento: unknown
  ativo: boolean
  criado_em: string
}

export interface AtualizarEstabelecimentoDTO {
  nome?: string
  telefone?: string // "" apaga o valor
  whatsapp?: string // "" apaga o valor
  email?: string // "" apaga o valor
  endereco?: Endereco
  tema?: 'CLARO' | 'ESCURO'
  tipo_cozinha?: string // "" apaga o valor
  tempo_entrega_min?: number
  tempo_entrega_max?: number
  taxa_entrega?: number
  pedido_minimo?: number
  aceita_entrega?: boolean
  aceita_retirada?: boolean
  aceita_mesa?: boolean
  horario_funcionamento?: HorarioFuncionamento
}

// O que o PATCH /estabelecimentos/:id/pix aceita — sempre com a senha atual
export interface AtualizarPixDTO {
  senha_atual: string
  chave_pix?: string | null
  tipo_chave_pix?: TipoChavePix | null
}

const EstabelecimentoService = {
  async buscar(id: string): Promise<Estabelecimento> {
    const response = await api.get<Estabelecimento>(`/estabelecimentos/${id}`)
    return response.data
  },

  async atualizar(id: string, data: AtualizarEstabelecimentoDTO): Promise<Estabelecimento> {
    const response = await api.put<Estabelecimento>(`/estabelecimentos/${id}`, data)
    return response.data
  },

  // Só o dono da empresa pode alterar a chave PIX
  async podeAlterarPix(id: string): Promise<boolean> {
    try {
      const response = await api.get<{ pode_alterar: boolean }>(`/estabelecimentos/${id}/pix/permissao`)
      return response.data.pode_alterar === true
    } catch {
      return false
    }
  },

  async atualizarPix(id: string, data: AtualizarPixDTO): Promise<Estabelecimento> {
    const response = await api.patch<Estabelecimento>(`/estabelecimentos/${id}/pix`, data)
    return response.data
  },

  // Envia a logo (JPG/PNG até 5MB). O backend grava no Supabase Storage e devolve a URL pública.
  async enviarLogo(id: string, arquivo: File): Promise<string> {
    const pronta = await prepararImagem(arquivo, { maxLado: 800 })
    const form = new FormData()
    form.append('arquivo', pronta)

    const response = await api.post<{ logo_url: string }>(`/estabelecimentos/${id}/logo`, form, {
      timeout: 60000,
      headers: { 'Content-Type': 'multipart/form-data' },
    })
    return response.data.logo_url
  },

    // Volta para a logo padrão
  async removerLogo(id: string): Promise<void> {
    await api.delete(`/estabelecimentos/${id}/logo`)
  },
}



export default EstabelecimentoService
