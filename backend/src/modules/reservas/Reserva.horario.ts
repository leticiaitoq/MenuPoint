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
