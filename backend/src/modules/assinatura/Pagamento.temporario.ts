import { Plano, Prisma } from '@prisma/client'
import prisma from '@config/prisma'
import { PLANOS } from './Planos.config'

export const GATEWAY_TEMPORARIO = 'manual'

const VALOR_PLANO: Partial<Record<Plano, number>> = {
  STARTER: PLANOS.STARTER.valor,
  PRO: PLANOS.PRO.valor,
}

export function planoDoSlug(slug?: string | null): Plano | null {
  switch ((slug ?? '').trim().toLowerCase()) {
    case 'starter':
    case 'basico':
      return 'STARTER'
    case 'pro':
      return 'PRO'
    default:
      return null
  }
}

export async function criarCobrancaPendente(
  tx: Prisma.TransactionClient,
  empresa_id: string,
  plano: Plano
): Promise<void> {
  await tx.empresa.update({ where: { id: empresa_id }, data: { ativo: false } })

  await tx.assinatura.create({
    data: {
      empresa_id,
      plano,
      status: 'PENDENTE',
      gateway: GATEWAY_TEMPORARIO,
      valor: VALOR_PLANO[plano] ?? 0,
      periodo: 'MENSAL',
    },
  })
}

export async function temPagamentoPendente(empresa_id: string | null): Promise<boolean> {
  if (!empresa_id) return false
  const pendente = await prisma.assinatura.findFirst({
    where: { empresa_id, status: 'PENDENTE' },
    select: { id: true },
  })
  if (pendente) return true
  return pagamentoRecusado(empresa_id)
}

/** Empresa inativa, sem nenhuma assinatura ATIVA e com tentativa de pagamento que falhou. */
export async function pagamentoRecusado(empresa_id: string): Promise<boolean> {
  const empresa = await prisma.empresa.findUnique({ where: { id: empresa_id }, select: { ativo: true } })
  if (!empresa || empresa.ativo) return false
  const [ativa, falha] = await Promise.all([
    prisma.assinatura.findFirst({ where: { empresa_id, status: 'ATIVA' }, select: { id: true } }),
    prisma.assinatura.findFirst({ where: { empresa_id, status: { in: ['FALHOU', 'CANCELADA'] } }, select: { id: true } }),
  ])
  return !ativa && Boolean(falha)
}