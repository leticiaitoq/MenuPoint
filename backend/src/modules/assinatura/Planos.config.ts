export const PLANOS = {
  STARTER: { nome: 'Starter', slug: 'starter', valor: 97 },
  PRO:     { nome: 'Pro',     slug: 'pro',     valor: 197 },
} as const

export type PeriodoCobranca = 'MENSAL' | 'ANUAL'

//preço anual
export const DESCONTO_ANUAL_PERCENTUAL = 0

/** Valor cobrado de uma vez no checkout, conforme o plano e o período (mensal ou anual). */
export function valorDoPlano(plano: 'STARTER' | 'PRO', periodo: PeriodoCobranca): number {
  const mensal = PLANOS[plano].valor
  if (periodo === 'MENSAL') return mensal
  return Math.round(mensal * 12 * (1 - DESCONTO_ANUAL_PERCENTUAL / 100) * 100) / 100
}

/** Aceita 'mensal' | 'anual' (qualquer caixa); qualquer outra coisa vira MENSAL. */
export function periodoDoTexto(valor?: string | null): PeriodoCobranca {
  return (valor ?? '').trim().toUpperCase() === 'ANUAL' ? 'ANUAL' : 'MENSAL'
}

/** Quando o período pago termina (o cron expira a assinatura depois dessa data). */
export function fimDoPeriodo(inicio: Date, periodo: PeriodoCobranca): Date {
  const fim = new Date(inicio)
  fim.setMonth(fim.getMonth() + (periodo === 'ANUAL' ? 12 : 1))
  return fim
}
