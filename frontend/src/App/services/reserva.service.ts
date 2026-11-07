import api from './api'
import apiCliente from './apiCliente'

// ── Tipos ────────────────────────────────────────────────────────────────────
export type StatusReserva = 'PENDENTE' | 'CONFIRMADA' | 'CONCLUIDA' | 'CANCELADA'

/** Reservas que ainda "seguram" a mesa (as únicas que contam para a disponibilidade) */
export const STATUS_RESERVA_ATIVA: StatusReserva[] = ['PENDENTE', 'CONFIRMADA']

export interface Reserva {
  id: string
  mesa_id: string | null
  cliente_id?: string | null
  cliente_nome: string
  cliente_telefone: string
  cliente_email: string | null
  /** Coluna DATE: chega como "2026-11-10T00:00:00.000Z" (use dataDaReserva) */
  data_reserva: string
  /** Coluna TIME: chega como "1970-01-01T19:00:00.000Z" (use horaDaReserva) */
  hora_inicio: string
  hora_fim: string
  num_pessoas: number
  observacoes: string | null
  status: StatusReserva
  mesa: { id: string; numero: number; capacidade?: number } | null
}

export interface MesaDisponivel {
  id: string
  numero: number
  capacidade: number
  localizacao: string | null
}

export interface ConsultaMesasDisponiveis {
  /** YYYY-MM-DD */
  data_reserva: string
  /** HH:MM */
  hora_inicio: string
  hora_fim: string
  pessoas?: number
}

/** Corpo do POST do cliente: nome/telefone/e-mail vêm da conta dele, no servidor */
export interface CriarReservaClienteDTO {
  mesa_id: string
  data_reserva: string
  hora_inicio: string
  hora_fim: string
  num_pessoas: number
  observacoes?: string
}

// ── Datas/horas (o servidor grava e devolve em UTC, sem conversão de fuso) ───
/** "2026-11-10T00:00:00.000Z" → "2026-11-10" */
export const dataDaReserva = (r: Pick<Reserva, 'data_reserva'>): string => r.data_reserva.slice(0, 10)

/** "1970-01-01T19:00:00.000Z" → "19:00" */
export const horaDaIso = (iso: string): string => iso.slice(11, 16)

/** "19:30" → 1170 (minutos desde meia-noite) */
export const horaParaMinutos = (hhmm: string): number => {
  const [h, m] = hhmm.split(':').map(Number)
  return h * 60 + m
}

/** Hoje (data local do navegador) no formato YYYY-MM-DD */
export const hojeLocal = (): string => {
  const d = new Date()
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  return `${d.getFullYear()}-${mm}-${dd}`
}

// ── Cliente logado (delivery): /reservas/publico/:slug/* ─────────────────────
const ReservaClienteService = {
  /** Mesas livres naquela data/horário (já sem as que têm reserva pendente ou confirmada) */
  async mesasDisponiveis(slug: string, consulta: ConsultaMesasDisponiveis): Promise<MesaDisponivel[]> {
    const r = await apiCliente.get<MesaDisponivel[]>(
      `reservas/publico/${encodeURIComponent(slug)}/mesas-disponiveis`,
      { params: consulta }
    )
    return r.data
  },

  /** Cria a reserva (nasce PENDENTE; o restaurante confirma pelo Caixa) */
  async criar(slug: string, dados: CriarReservaClienteDTO): Promise<Reserva> {
    const r = await apiCliente.post<Reserva>(`reservas/publico/${encodeURIComponent(slug)}`, dados)
    return r.data
  },

  /** Reservas do cliente neste restaurante, de hoje em diante */
  async minhas(slug: string): Promise<Reserva[]> {
    const r = await apiCliente.get<Reserva[]>(`reservas/publico/${encodeURIComponent(slug)}/minhas`)
    return r.data
  },

  async cancelar(slug: string, id: string): Promise<Reserva> {
    const r = await apiCliente.post<Reserva>(
      `reservas/publico/${encodeURIComponent(slug)}/${encodeURIComponent(id)}/cancelar`
    )
    return r.data
  },
}

export default ReservaClienteService

// ── Restaurante (Caixa): /reservas ───────────────────────────────────────────
export const ReservaRestauranteService = {
  /** Reservas de um dia (YYYY-MM-DD), em ordem de horário */
  async listarDoDia(dia: string): Promise<Reserva[]> {
    const r = await api.get<Reserva[]>('reservas', {
      params: { data_inicio: dia, data_fim: dia },
    })
    return r.data
  },

  async atualizarStatus(
    id: string,
    status: 'CONFIRMADA' | 'CONCLUIDA' | 'CANCELADA'
  ): Promise<Reserva> {
    const r = await api.patch<Reserva>(`reservas/${id}/status`, { status })
    return r.data
  },
}
