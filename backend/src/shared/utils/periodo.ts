import { AppError } from '@shared/errors/AppError'

/**
 * Converte e valida o período recebido na query (`data_inicio` / `data_fim`, texto ISO).
 * Data inválida ou período invertido viram erro 400 (antes viravam erro 500 do banco).
 */
export function parsePeriodo(
  data_inicio?: string,
  data_fim?: string
): { data_inicio?: Date; data_fim?: Date } {
  const converter = (valor: string | undefined, campo: string) => {
    if (!valor) return undefined
    const data = new Date(valor)
    if (Number.isNaN(data.getTime())) {
      throw new AppError(`${campo} inválida. Use o formato AAAA-MM-DD ou ISO 8601.`, 400)
    }
    return data
  }

  const inicio = converter(data_inicio, 'data_inicio')
  const fim = converter(data_fim, 'data_fim')

  if (inicio && fim && inicio.getTime() > fim.getTime()) {
    throw new AppError('data_inicio não pode ser depois de data_fim', 400)
  }

  return {
    ...(inicio && { data_inicio: inicio }),
    ...(fim && { data_fim: fim }),
  }
}
