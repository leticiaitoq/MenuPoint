import { z } from 'zod'

const dataISO = z
  .string({ error: 'Informe a data' })
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Data deve estar no formato AAAA-MM-DD')
  .refine((v) => !Number.isNaN(new Date(v + 'T00:00:00Z').getTime()), 'Data inválida')

export const MAX_DIAS_RELATORIO = 366

export const periodoRelatorioSchema = z
  .object({ data_inicio: dataISO, data_fim: dataISO })
  .refine((p) => p.data_inicio <= p.data_fim, {
    message: 'A data inicial não pode ser depois da data final',
    path: ['data_inicio'],
  })
  .refine(
    (p) => {
      const dias = (Date.parse(p.data_fim + 'T00:00:00Z') - Date.parse(p.data_inicio + 'T00:00:00Z')) / 86_400_000
      return dias < MAX_DIAS_RELATORIO
    },
    { message: `O período pode ter no máximo ${MAX_DIAS_RELATORIO} dias`, path: ['data_fim'] }
  )

export type PeriodoRelatorio = z.infer<typeof periodoRelatorioSchema>
