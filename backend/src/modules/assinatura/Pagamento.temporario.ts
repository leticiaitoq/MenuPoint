import { Plano, Prisma } from '@prisma/client'
import prisma from '@config/prisma'
import { AppError } from '@shared/errors/AppError'

// ─────────────────────────────────────────────────────────────────────────────
// PAGAMENTO TEMPORÁRIO (sem cobrança real)
//
// Fluxo: o cadastro cria a cobrança como PENDENTE → o usuário clica em
// "Confirmar pagamento" → aqui ela vira ATIVA e a empresa é liberada.
//
// Tudo isso está neste arquivo + uma rota (POST /assinatura/confirmar-pagamento).
// Para trocar pelo Mercado Pago depois:
//   • criarCobrancaPendente  → criar a assinatura no MP (Assinatura.service já faz isso)
//   • confirmarPagamento     → deixa de existir: quem confirma passa a ser o webhook
//     (Assinatura.service.processarWebhook), que já ativa a assinatura e a empresa.
// ─────────────────────────────────────────────────────────────────────────────

export const GATEWAY_TEMPORARIO = 'manual'

const VALOR_PLANO: Partial<Record<Plano, number>> = {
  STARTER: 49.9,
  PRO: 99.9,
}

/** Aceita o que o site mandar em ?plano= ("basico" é o nome antigo do Starter). */
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

/** Chamado dentro da transação do cadastro: deixa a empresa aguardando o pagamento. */
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

/** true = a empresa se cadastrou, escolheu plano e ainda não confirmou o pagamento. */
export async function temPagamentoPendente(empresa_id: string | null): Promise<boolean> {
  if (!empresa_id) return false
  const pendente = await prisma.assinatura.findFirst({
    where: { empresa_id, status: 'PENDENTE', gateway: GATEWAY_TEMPORARIO },
    select: { id: true },
  })
  return Boolean(pendente)
}

/** Considera o pagamento aprovado e libera o acesso da empresa. */
export async function confirmarPagamento(empresa_id: string): Promise<void> {
  // Só confirma cobrança criada no cadastro: uma empresa suspensa pelo suporte
  // não tem cobrança pendente, então não consegue se reativar por aqui.
  const pendente = await prisma.assinatura.findFirst({
    where: { empresa_id, status: 'PENDENTE', gateway: GATEWAY_TEMPORARIO },
    orderBy: { criado_em: 'desc' },
  })

  if (!pendente) {
    throw new AppError('Nenhum pagamento pendente para esta conta', 404)
  }

  await prisma.$transaction([
    prisma.assinatura.update({
      where: { id: pendente.id },
      data: { status: 'ATIVA', inicia_em: new Date() },
    }),
    prisma.empresa.update({
      where: { id: empresa_id },
      data: { ativo: true, plano: pendente.plano },
    }),
  ])
}
