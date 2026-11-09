import prisma from '@config/prisma'
import { AssinaturaService, ehOrderId } from './Assinatura.service'

// CRON da assinatura (roda dentro do próprio servidor, sem dependência extra). Faz duas coisas:
//  1) Reconciliação: reconsulta no Mercado Pago as cobranças PENDENTES recentes. Cobre o webhook
//     que não chegou (servidor fora do ar, falha de rede) e o cliente que pagou e fechou a aba.
//  2) Vencimento: assinatura paga por ORDER (pagamento único) dura o período pago (1 mês ou
//     1 ano). Passou da data, vira EXPIRADA e a empresa volta a ficar pendente de pagamento:
//     no próximo login o sistema leva à tela de pagamento para renovar.
// Assinaturas antigas (PreApproval, recorrentes) NÃO são mexidas aqui: o Mercado Pago cobra e avisa.

const INTERVALO_MS = 10 * 60 * 1000
const JANELA_RECONCILIAR_MS = 48 * 60 * 60 * 1000

const service = new AssinaturaService()

export async function executarCronAssinaturas(): Promise<void> {
  // 1) Reconciliação
  try {
    const pendentes = await prisma.assinatura.findMany({
      where: {
        status: 'PENDENTE',
        gateway: 'mercadopago',
        gateway_id: { startsWith: 'ORD' },
        atualizado_em: { gte: new Date(Date.now() - JANELA_RECONCILIAR_MS) },
      },
      select: { gateway_id: true },
    })
    for (const p of pendentes) {
      if (!ehOrderId(p.gateway_id)) continue
      try {
        await service.processarOrder(p.gateway_id as string)
      } catch {
        // tenta de novo na próxima rodada
      }
    }
  } catch (err: any) {
    console.error(`[cron-assinatura] reconciliação falhou: ${err?.message ?? err}`)
  }

  // 2) Vencimento
  try {
    const vencidas = await prisma.assinatura.findMany({
      where: { status: 'ATIVA', gateway_id: { startsWith: 'ORD' }, expira_em: { lt: new Date() } },
      select: { id: true, empresa_id: true },
    })
    for (const v of vencidas) {
      await prisma.assinatura.update({ where: { id: v.id }, data: { status: 'EXPIRADA' } })
      const outraAtiva = await prisma.assinatura.findFirst({
        where: { empresa_id: v.empresa_id, status: 'ATIVA' },
        select: { id: true },
      })
      if (!outraAtiva) {
        await prisma.empresa.update({ where: { id: v.empresa_id }, data: { ativo: false } })
      }
      console.log(`[cron-assinatura] assinatura ${v.id} expirada (empresa ${v.empresa_id})`)
    }
  } catch (err: any) {
    console.error(`[cron-assinatura] vencimento falhou: ${err?.message ?? err}`)
  }
}

export function iniciarCronAssinaturas(): void {
  setTimeout(executarCronAssinaturas, 30_000).unref()
  setInterval(executarCronAssinaturas, INTERVALO_MS).unref()
  console.log('⏱️  Cron de assinaturas ligado (a cada 10 min)')
}
