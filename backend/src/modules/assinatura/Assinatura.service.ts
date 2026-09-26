import MercadoPagoConfig, { PreApproval } from 'mercadopago'
import { env } from '@config/env'
import { AppError } from '@shared/errors/AppError'
import { CriarAssinaturaDTO } from './Assinatura.schema'
import prisma from '@config/prisma'
import { Plano, StatusAssinatura } from '@prisma/client'

const mpClient = new MercadoPagoConfig({
  accessToken: env.MP_ACCESS_TOKEN,
})

const preApprovalClient = new PreApproval(mpClient)

// Mapeia o plan_id do MP para o enum Plano do banco
const PLAN_ID_TO_PLANO: Record<string, Plano> = {
  [env.MP_PLAN_ID_BASICO]: 'STARTER',
  [env.MP_PLAN_ID_PRO]:    'PRO',
}

// Valor de cada plano (em BRL) — usado ao salvar a assinatura
const PLAN_ID_TO_VALOR: Record<string, number> = {
  [env.MP_PLAN_ID_BASICO]: 49.90,
  [env.MP_PLAN_ID_PRO]:    99.90,
}

export class AssinaturaService {

  async criar(data: CriarAssinaturaDTO, empresa_id: string) {
    const plano = PLAN_ID_TO_PLANO[data.plan_id]
    if (!plano) {
      throw new AppError('Plano inválido', 400)
    }

    // Cancela assinaturas pendentes antigas desta empresa para não acumular
    await prisma.assinatura.updateMany({
      where: { empresa_id, status: 'PENDENTE' },
      data:  { status: 'CANCELADA', cancelada_em: new Date() },
    })

    try {
      const body: any = {
        preapproval_plan_id: data.plan_id,
        payer_email:         data.email,
        back_url:            `${env.FRONTEND_URL}/assinatura/sucesso`,
        notification_url:    `${env.API_URL}/api/v1/assinatura/webhook`,
        status:              'pending',
        reason:              'Plano MenuPoint',
      }

      const mpAssinatura = await preApprovalClient.create({ body })

      if (!mpAssinatura.init_point) {
        throw new AppError('Mercado Pago não retornou o link de checkout', 502)
      }

      // Salva a assinatura no banco logo após criar no MP
      await prisma.assinatura.create({
        data: {
          empresa_id,
          plano,
          status:       'PENDENTE',
          gateway:      'mercadopago',
          gateway_id:   mpAssinatura.id ?? null,
          checkout_url: mpAssinatura.init_point,
          valor:        PLAN_ID_TO_VALOR[data.plan_id],
          periodo:      'MENSAL',
        },
      })

      return {
        init_point:    mpAssinatura.init_point,
        assinatura_id: mpAssinatura.id,
        status:        mpAssinatura.status,
      }
    } catch (err: any) {
      if (err instanceof AppError) throw err
      const msg = err?.cause?.[0]?.description ?? err?.message ?? 'Erro ao criar assinatura'
      throw new AppError(`Mercado Pago: ${msg}`, 502)
    }
  }

  async processarWebhook(id: string, type: string) {
    if (type !== 'subscription_preapproval') {
      return { ignorado: true }
    }

    try {
      const mpAssinatura = await preApprovalClient.get({ id } as any)
      const raw = mpAssinatura as any

      const statusMP: string = raw.status ?? ''

      // Mapeia status do MP para o enum do banco
      const statusMap: Record<string, StatusAssinatura> = {
        authorized: 'ATIVA',
        cancelled:  'CANCELADA',
        paused:     'CANCELADA',
        pending:    'PENDENTE',
      }
      const novoStatus: StatusAssinatura = statusMap[statusMP] ?? 'FALHOU'

      // Atualiza a assinatura no banco pelo gateway_id
      const assinaturaAtualizada = await prisma.assinatura.updateMany({
        where: { gateway_id: id, gateway: 'mercadopago' },
        data: {
          status:        novoStatus,
          ...(novoStatus === 'ATIVA' && {
            inicia_em: new Date(),
            expira_em: raw.next_payment_date ? new Date(raw.next_payment_date) : null,
          }),
          ...(novoStatus === 'CANCELADA' && {
            cancelada_em: new Date(),
          }),
        },
      })

      // Se ficou ATIVA, atualiza também o plano da empresa
      if (novoStatus === 'ATIVA' && raw.preapproval_plan_id) {
        const plano = PLAN_ID_TO_PLANO[raw.preapproval_plan_id]
        if (plano) {
          // Busca a assinatura para pegar o empresa_id
          const assinatura = await prisma.assinatura.findFirst({
            where: { gateway_id: id, gateway: 'mercadopago' },
          })

          if (assinatura) {
            await prisma.empresa.update({
              where: { id: assinatura.empresa_id },
              data:  { plano, ativo: true },
            })
          }
        }
      }

      return {
        assinatura_id:     raw.id,
        payer_email:       raw.payer_email,
        status:            novoStatus,
        plan_id:           raw.preapproval_plan_id,
        proximo_debito:    raw.next_payment_date,
        registros_atualizados: assinaturaAtualizada.count,
      }
    } catch (err: any) {
      if (err instanceof AppError) throw err
      throw new AppError('Erro ao consultar assinatura no MP', 502)
    }
  }
}