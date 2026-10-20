import api from './api'

// ── Tipos que espelham o que o backend devolve (GET /auth/me e /estabelecimentos) ──

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

// O que o PUT /estabelecimentos/:id aceita (tudo opcional). chave_pix e
// tipo_chave_pix NÃO entram aqui — são dado sensível e vão só pelo
// atualizarPix(), que exige senha e checa permissão no backend.
export interface AtualizarEstabelecimentoDTO {
  nome?: string
  telefone?: string // "" apaga o valor
  whatsapp?: string // "" apaga o valor
  email?: string // "" apaga o valor
  endereco?: Endereco
  tema?: 'CLARO' | 'ESCURO'
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
  async atualizar(id: string, data: AtualizarEstabelecimentoDTO): Promise<Estabelecimento> {
    const response = await api.put<Estabelecimento>(`/estabelecimentos/${id}`, data)
    return response.data
  },

  // Altera a chave PIX — dado sensível, sempre exige a senha atual do
  // usuário (verificada no backend) e só é aceita por quem tem permissão.
  async atualizarPix(id: string, data: AtualizarPixDTO): Promise<Estabelecimento> {
    const response = await api.patch<Estabelecimento>(`/estabelecimentos/${id}/pix`, data)
    return response.data
  },

  // Envia a logo (JPG/PNG até 5MB). O backend grava no Supabase Storage e devolve a URL pública.
  async enviarLogo(id: string, arquivo: File): Promise<string> {
    const form = new FormData()
    form.append('arquivo', arquivo)

    const response = await api.post<{ logo_url: string }>(`/estabelecimentos/${id}/logo`, form, {
      timeout: 60000,
      headers: { 'Content-Type': 'multipart/form-data' },
    })
    return response.data.logo_url
  },
}

export default EstabelecimentoService
