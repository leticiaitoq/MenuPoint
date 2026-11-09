/**
 * Datas/horas da reserva, sempre em UTC.
 *
 * `data_reserva` é uma coluna DATE e `hora_inicio`/`hora_fim` são TIME. Montar esses valores com
 * `new Date(...)` + `setHours` dependia do fuso do servidor; em UTC o valor gravado é sempre o
 * mesmo que o cliente digitou (19:00 fica 19:00), seja qual for a máquina onde a API roda.
 */

export interface JanelaReserva {
  data: Date
  inicio: Date
  fim: Date
}

const horaParaDate = (hhmm: string): Date => {
  const [h, m] = hhmm.split(':').map(Number)
  return new Date(Date.UTC(1970, 0, 1, h, m, 0, 0))
}

export function montarJanela(data_reserva: string, hora_inicio: string, hora_fim: string): JanelaReserva {
  return {
    data: new Date(`${data_reserva}T00:00:00.000Z`),
    inicio: horaParaDate(hora_inicio),
    fim: horaParaDate(hora_fim),
  }
}

/** Data e hora de agora no restaurante (Brasil), para barrar reservas no passado. */
export function agoraNoBrasil(): { data: string; minutos: number } {
  const partes = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Sao_Paulo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(new Date())

  const pega = (tipo: string) => partes.find((p) => p.type === tipo)?.value ?? '0'

  return {
    data: `${pega('year')}-${pega('month')}-${pega('day')}`,
    minutos: Number(pega('hour')) * 60 + Number(pega('minute')),
  }
}

/**
 * Intervalo mínimo entre duas reservas da MESMA mesa no mesmo dia (limpeza e troca de clientes).
 * Uma reserva nova só entra se começar pelo menos isto depois do fim da anterior (e terminar pelo
 * menos isto antes do início da seguinte). O frontend tem a mesma constante só para o alerta do Caixa.
 */
export const MARGEM_ENTRE_RESERVAS_MIN = 30

/** Reserva para o MESMO dia só com esta antecedência (em minutos) em relação ao horário desejado. */
export const ANTECEDENCIA_MINIMA_HOJE_MIN = 120

const ULTIMO_MINUTO = 23 * 60 + 59

const minutosParaDate = (min: number): Date =>
  new Date(Date.UTC(1970, 0, 1, 0, Math.max(0, Math.min(min, ULTIMO_MINUTO)), 0, 0))

export const minutosDoDate = (d: Date): number => d.getUTCHours() * 60 + d.getUTCMinutes()

export const dateParaHHMM = (d: Date): string =>
  `${String(d.getUTCHours()).padStart(2, '0')}:${String(d.getUTCMinutes()).padStart(2, '0')}`

/** A janela alargada pela margem: é contra ela que se confere se há reserva batendo. */
export function comMargem(inicio: Date, fim: Date): { inicio: Date; fim: Date } {
  return {
    inicio: minutosParaDate(minutosDoDate(inicio) - MARGEM_ENTRE_RESERVAS_MIN),
    fim: minutosParaDate(minutosDoDate(fim) + MARGEM_ENTRE_RESERVAS_MIN),
  }
}

const DIAS = ['domingo', 'segunda', 'terca', 'quarta', 'quinta', 'sexta', 'sabado'] as const

export interface Funcionamento {
  aberto: boolean
  abertura: string | null
  fechamento: string | null
}

/** Horário de funcionamento do restaurante no dia da reserva (null = restaurante não configurou). */
export function funcionamentoNoDia(horarios: unknown, data_reserva: string): Funcionamento | null {
  if (!horarios || typeof horarios !== 'object') return null
  const dia = DIAS[new Date(`${data_reserva}T00:00:00.000Z`).getUTCDay()]
  const h = (horarios as Record<string, Partial<Funcionamento> | undefined>)[dia]
  if (!h) return null
  return { aberto: Boolean(h.aberto), abertura: h.abertura ?? null, fechamento: h.fechamento ?? null }
}

/** Última hora de chegada: o cliente não pode começar a reserva nos últimos X minutos antes de fechar. */
export const FOLGA_ANTES_DE_FECHAR_MIN = 30

const hhmmParaMin = (hhmm: string): number => {
  const [h, m] = hhmm.split(':').map(Number)
  return h * 60 + m
}

/**
 * Vale começar a reserva neste horário? Dentro do funcionamento e com pelo menos
 * FOLGA_ANTES_DE_FECHAR_MIN minutos antes de fechar. Cobre o restaurante que fecha de madrugada
 * (fechamento <= abertura). Sem horário configurado (null) qualquer hora vale.
 */
export function horarioDentroDoFuncionamento(func: Funcionamento | null, hora_inicio: string): boolean {
  if (!func) return true
  if (!func.aberto) return false
  if (!func.abertura || !func.fechamento) return true

  const t = hhmmParaMin(hora_inicio)
  const abre = hhmmParaMin(func.abertura)
  let fecha = hhmmParaMin(func.fechamento)
  const limite = (x: number) => x - FOLGA_ANTES_DE_FECHAR_MIN

  if (fecha > abre) return t >= abre && t <= limite(fecha)
  // fecha depois da meia-noite
  return t >= abre || t <= limite(fecha)
}
