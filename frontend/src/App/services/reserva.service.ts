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
  /** Cliente marcou "não sei ainda": hora_fim é só o tempo que a mesa fica segura */
  duracao_indefinida?: boolean
  status: StatusReserva
  /** Quem cancelou (só em CANCELADA): CLIENTE, RESTAURANTE (cancelou) ou RECUSADA (recusou a pendente). */
  cancelada_por?: 'CLIENTE' | 'RESTAURANTE' | 'RECUSADA' | null
  /** Reserva em várias mesas: uma linha por mesa, todas com o mesmo grupo_id */
  grupo_id?: string | null
  /** Total de pessoas da reserva (num_pessoas é só a parte desta mesa) */
  pessoas_total?: number | null
  /** Assentos que faltam: o restaurante decide se aceita (cadeiras extras) */
  falta_assentos?: number
  /** Caixa reserva uma mesa para um dia e horário (descrição opcional). Nasce CONFIRMADA. */
  async criarPeloCaixa(dados: {
    mesa_id: string
    data_reserva: string
    hora_inicio: string
    hora_fim?: string
    descricao?: string
  }): Promise<Reserva> {
    const r = await api.post<Reserva>('reservas/caixa', dados)
    return r.data
  },

  /** Recado do restaurante ao cliente */
  mensagem_restaurante?: string | null
  mensagem_em?: string | null
  criado_em?: string
  atualizado_em?: string
  /** Só na resposta de criar/atualizar: todas as linhas (mesas) da reserva */
  mesas_do_grupo?: Reserva[]
  mesa: { id: string; numero: number; capacidade?: number } | null
}

/** Uma reserva "lógica": junta as linhas (mesas) do mesmo grupo */
export interface ReservaAgrupada {
  /** Primeira linha (dados comuns: cliente, horário, status, mensagem) */
  base: Reserva
  linhas: Reserva[]
  mesas: { id: string; numero: number; capacidade?: number }[]
  pessoas: number
  falta: number
}

/** Junta as linhas de reservas em várias mesas (mesmo grupo_id) numa só, mantendo a ordem */
export function agruparReservas(reservas: Reserva[]): ReservaAgrupada[] {
  const mapa = new Map<string, Reserva[]>()
  reservas.forEach((r) => {
    const chave = r.grupo_id ?? r.id
    mapa.set(chave, [...(mapa.get(chave) ?? []), r])
  })
  return Array.from(mapa.values()).map((linhas) => ({
    base: linhas[0],
    linhas,
    mesas: linhas.flatMap((l) => (l.mesa ? [l.mesa] : [])),
    pessoas: linhas[0].pessoas_total ?? linhas.reduce((t, l) => t + l.num_pessoas, 0),
    falta: linhas[0].falta_assentos ?? 0,
  }))
}

/**
 * Escolhe as mesas para um grupo: a menor mesa que comporta todos; senão, as maiores até cobrir
 * (sem sobrar mesa). Se mesmo todas não bastam, devolve todas e `falta` > 0.
 */
export function escolherMesas<T extends { id: string; capacidade: number; numero: number }>(
  livres: T[],
  pessoas: number
): { mesas: T[]; falta: number } {
  if (!livres.length || pessoas < 1) return { mesas: [], falta: Math.max(pessoas, 0) }
  const porTamanho = [...livres].sort((a, b) => a.capacidade - b.capacidade || a.numero - b.numero)
  const unica = porTamanho.find((m) => m.capacidade >= pessoas)
  if (unica) return { mesas: [unica], falta: 0 }

  const maioresPrimeiro = [...porTamanho].reverse()
  const escolhidas: T[] = []
  let soma = 0
  for (const m of maioresPrimeiro) {
    if (soma >= pessoas) break
    escolhidas.push(m)
    soma += m.capacidade
  }
  // tira mesa que sobrou (as menores primeiro) enquanto ainda cobre
  const ordenadas = [...escolhidas].sort((a, b) => a.capacidade - b.capacidade)
  while (ordenadas.length > 1 && soma - ordenadas[0].capacidade >= pessoas) {
    soma -= ordenadas[0].capacidade
    ordenadas.shift()
  }
  return { mesas: ordenadas.sort((a, b) => a.numero - b.numero), falta: Math.max(0, pessoas - soma) }
}

/** Trecho do dia em que a mesa NÃO pode ser reservada (reserva existente + intervalo mínimo) */
export interface BloqueioMesa {
  inicio: string
  fim: string
}

export interface DisponibilidadeMesa extends MesaDisponivel {
  bloqueios: BloqueioMesa[]
}

export interface Disponibilidade {
  /** null = o restaurante não cadastrou o horário de funcionamento */
  funcionamento: { aberto: boolean; abertura: string | null; fechamento: string | null } | null
  mesas: DisponibilidadeMesa[]
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
  /** Todas as mesas da reserva (grupo grande ocupa mais de uma) */
  mesas_ids: string[]
  data_reserva: string
  hora_inicio: string
  hora_fim: string
  num_pessoas: number
  observacoes?: string
  duracao_indefinida?: boolean
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

/** Data local (do navegador) no formato YYYY-MM-DD. Sem argumento, é hoje. */
export const hojeLocal = (ms: number = Date.now()): string => {
  const d = new Date(ms)
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  return `${d.getFullYear()}-${mm}-${dd}`
}

/** "2026-11-07" + 3 → "2026-11-10" */
export const somarDias = (dia: string, dias: number): string => {
  const [a, m, d] = dia.split('-').map(Number)
  return hojeLocal(new Date(a, m - 1, d + dias).getTime())
}

/** "Hoje", "Amanhã" ou "sáb, 14/11" — para mostrar a data da reserva */
export const rotuloDia = (dia: string, hoje: string = hojeLocal()): string => {
  if (dia === hoje) return 'Hoje'
  if (dia === somarDias(hoje, 1)) return 'Amanhã'
  const [a, m, d] = dia.split('-').map(Number)
  const semana = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb'][new Date(a, m - 1, d).getDay()]
  return `${semana}, ${String(d).padStart(2, '0')}/${String(m).padStart(2, '0')}`
}

// ── Regras de horário (iguais às do servidor, que confere de novo ao reservar) ─────────────
/** A mesa fica segura por este tempo a partir do horário escolhido */
export const DURACAO_RESERVA_MIN = 120
/** Quando o cliente não sabe quanto tempo vai ficar, a mesa fica segura por este tempo */
export const DURACAO_INDEFINIDA_MIN = 180
/** Reserva para hoje só com esta antecedência em relação ao horário desejado (o servidor confere) */
export const ANTECEDENCIA_MINIMA_HOJE_MIN = 120
/** Opções do campo "quanto tempo vai ficar" (minutos; 'indefinida' = não sei ainda) */
export const OPCOES_DURACAO: { valor: number | 'indefinida'; rotulo: string }[] = [
  { valor: 60, rotulo: '1h' },
  { valor: 120, rotulo: '2h' },
  { valor: 180, rotulo: '3h' },
  { valor: 240, rotulo: '4h' },
  { valor: 'indefinida', rotulo: 'Não sei ainda' },
]
/** Minutos que a mesa fica segura para a opção escolhida */
export const minutosDaDuracao = (d: number | 'indefinida'): number =>
  d === 'indefinida' ? DURACAO_INDEFINIDA_MIN : d
export const ULTIMO_MINUTO_DO_DIA = 23 * 60 + 59
/** Intervalo mínimo entre duas reservas da mesma mesa (mesmo valor do backend) */
export const MARGEM_ENTRE_RESERVAS_MIN = 30
const PASSO_HORARIOS_MIN = 30

const minutosParaHora = (min: number): string =>
  `${String(Math.floor(min / 60)).padStart(2, '0')}:${String(min % 60).padStart(2, '0')}`

/** Horário final da reserva: início + duração, no máximo 23:59 (não atravessa a meia-noite) */
export const horaFimDaReserva = (inicio: string, duracaoMin: number = DURACAO_RESERVA_MIN): string =>
  minutosParaHora(Math.min(horaParaMinutos(inicio) + duracaoMin, ULTIMO_MINUTO_DO_DIA))

/** A reserva que começa em `inicio` cabe na mesa sem bater nos bloqueios? */
export function horarioLivreNaMesa(
  mesa: Pick<DisponibilidadeMesa, 'bloqueios'>,
  inicio: string,
  duracaoMin: number = DURACAO_RESERVA_MIN
): boolean {
  const ini = horaParaMinutos(inicio)
  const fim = Math.min(ini + duracaoMin, ULTIMO_MINUTO_DO_DIA)
  if (fim <= ini) return false
  return !mesa.bloqueios.some((b) => ini < horaParaMinutos(b.fim) && fim > horaParaMinutos(b.inicio))
}

/** Não dá para começar uma reserva nos últimos X minutos antes de fechar (o servidor confere) */
export const FOLGA_ANTES_DE_FECHAR_MIN = 30

/** Vale começar a reserva neste horário? (dentro do funcionamento e com a folga antes de fechar) */
export function horarioDentroDoFuncionamento(
  funcionamento: Disponibilidade['funcionamento'],
  inicio: string
): boolean {
  if (!funcionamento) return true
  if (!funcionamento.aberto) return false
  if (!funcionamento.abertura || !funcionamento.fechamento) return true
  const t = horaParaMinutos(inicio)
  const abre = horaParaMinutos(funcionamento.abertura)
  const fecha = horaParaMinutos(funcionamento.fechamento)
  if (fecha > abre) return t >= abre && t <= fecha - FOLGA_ANTES_DE_FECHAR_MIN
  return t >= abre || t <= fecha - FOLGA_ANTES_DE_FECHAR_MIN
}

/** Horários de início livres da mesa no dia (de 30 em 30 min, dentro do funcionamento e sem passar) */
export function horariosLivres(
  mesa: Pick<DisponibilidadeMesa, 'bloqueios'>,
  funcionamento: Disponibilidade['funcionamento'],
  dia: string,
  agora: number = Date.now(),
  duracaoMin: number = DURACAO_RESERVA_MIN
): string[] {
  if (funcionamento && !funcionamento.aberto) return []

  const abertura = horaParaMinutos(funcionamento?.abertura ?? '11:00')
  const fechamentoBruto = horaParaMinutos(funcionamento?.fechamento ?? '23:00')
  // Fechamento depois da meia-noite (ou igual à abertura): vale até o fim do dia
  const limite = fechamentoBruto > abertura ? fechamentoBruto : ULTIMO_MINUTO_DO_DIA + 1

  const d = new Date(agora)
  const minutosAgora = hojeLocal(agora) === dia ? d.getHours() * 60 + d.getMinutes() : -1

  const lista: string[] = []
  for (let t = abertura; t < limite && t < ULTIMO_MINUTO_DO_DIA; t += PASSO_HORARIOS_MIN) {
    // Hoje: só a partir de 2h depois de agora
    if (minutosAgora >= 0 && t < minutosAgora + ANTECEDENCIA_MINIMA_HOJE_MIN) continue
    const hhmm = minutosParaHora(t)
    if (!horarioDentroDoFuncionamento(funcionamento, hhmm)) continue
    if (horarioLivreNaMesa(mesa, hhmm, duracaoMin)) lista.push(hhmm)
  }
  return lista
}

/**
 * Resume horários de início livres em faixas: ['11:00','11:30','12:00','21:30'] → ['11:00–12:00','21:30'].
 * Horários seguidos (a cada `passo` min) viram uma faixa só, para a tela não listar um botão por horário.
 */
export function agruparHorarios(horarios: string[], passo: number = PASSO_HORARIOS_MIN): string[] {
  const faixas: string[] = []
  let ini = ''
  let ult = ''
  const fechar = () => {
    if (ini) faixas.push(ini === ult ? ini : `${ini}–${ult}`)
  }
  for (const h of [...horarios].sort()) {
    if (ult && horaParaMinutos(h) - horaParaMinutos(ult) === passo) {
      ult = h
    } else {
      fechar()
      ini = ult = h
    }
  }
  fechar()
  return faixas
}

// ── Conflitos entre reservas (alerta do Caixa) ───────────────────────────────
export interface ConflitoReserva {
  a: Reserva
  b: Reserva
  tipo: 'sobreposicao' | 'proximas'
  /** Minutos entre o fim da primeira e o início da segunda (negativo = se sobrepõem) */
  intervaloMin: number
}

/**
 * Reservas ativas da MESMA mesa, no mesmo dia, que se sobrepõem ou ficam a menos de
 * MARGEM_ENTRE_RESERVAS_MIN uma da outra.
 */
export function detectarConflitos(reservas: Reserva[]): ConflitoReserva[] {
  const grupos = new Map<string, Reserva[]>()
  reservas
    .filter((r) => r.mesa_id && STATUS_RESERVA_ATIVA.includes(r.status))
    .forEach((r) => {
      const chave = `${r.mesa_id}|${dataDaReserva(r)}`
      grupos.set(chave, [...(grupos.get(chave) ?? []), r])
    })

  const conflitos: ConflitoReserva[] = []
  grupos.forEach((lista) => {
    const ordenada = [...lista].sort((x, y) => horaDaIso(x.hora_inicio).localeCompare(horaDaIso(y.hora_inicio)))
    for (let i = 0; i < ordenada.length; i++) {
      for (let j = i + 1; j < ordenada.length; j++) {
        const intervalo = horaParaMinutos(horaDaIso(ordenada[j].hora_inicio)) - horaParaMinutos(horaDaIso(ordenada[i].hora_fim))
        if (intervalo >= MARGEM_ENTRE_RESERVAS_MIN) continue
        conflitos.push({
          a: ordenada[i],
          b: ordenada[j],
          tipo: intervalo < 0 ? 'sobreposicao' : 'proximas',
          intervaloMin: intervalo,
        })
      }
    }
  })
  return conflitos
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

  /** Horários livres de cada mesa no dia (já considera as reservas dos outros clientes) */
  async disponibilidade(slug: string, dia: string, pessoas?: number): Promise<Disponibilidade> {
    const r = await apiCliente.get<Disponibilidade>(
      `reservas/publico/${encodeURIComponent(slug)}/disponibilidade`,
      { params: { data_reserva: dia, pessoas } }
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
  /** Reservas de um período (YYYY-MM-DD a YYYY-MM-DD), em ordem de data e horário */
  async listarPeriodo(inicio: string, fim: string): Promise<Reserva[]> {
    const r = await api.get<Reserva[]>('reservas', {
      params: { data_inicio: inicio, data_fim: fim },
    })
    return r.data
  },

  async atualizarStatus(
    id: string,
    status: 'CONFIRMADA' | 'CONCLUIDA' | 'CANCELADA',
    mensagem?: string
  ): Promise<Reserva> {
    const r = await api.patch<Reserva>(`reservas/${id}/status`, {
      status,
      ...(mensagem?.trim() && { mensagem: mensagem.trim() }),
    })
    return r.data
  },

  /** Recado do restaurante ao cliente (e-mail + aviso no app dele) */
  async enviarMensagem(id: string, mensagem: string): Promise<Reserva> {
    const r = await api.post<Reserva>(`reservas/${id}/mensagem`, { mensagem })
    return r.data
  },
}
