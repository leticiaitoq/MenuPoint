import MercadoPagoConfig, { PreApproval } from 'mercadopago'
import { env } from '@config/env'
import { AppError } from '@shared/errors/AppError'
import { CriarAssinaturaDTO } from './Assinatura.schema'
import prisma from '@config/prisma'
import { Plano, StatusAssinatura } from '@prisma/client'
import { pagamentoRecusado, planoDoSlug, GATEWAY_TEMPORARIO } from './Pagamento.temporario'
import { PLANOS } from './Planos.config'

// FRONTEND_URL pode ter várias origens separadas por vírgula (CORS): o retorno do MP usa a primeira
const FRONTEND_PRINCIPAL = env.FRONTEND_URL.split(',')[0].trim().replace(/\/$/, '')

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
  [env.MP_PLAN_ID_BASICO]: PLANOS.STARTER.valor,
  [env.MP_PLAN_ID_PRO]:    PLANOS.PRO.valor,
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
        back_url:            `${FRONTEND_PRINCIPAL}/assinatura/sucesso`,
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

  /**
   * ESCOLHA DO PLANO (tela /planos): define ou troca o plano da cobrança pendente antes do
   * pagamento. Trocar o plano descarta o link de checkout antigo (o valor mudou).
   */
  async escolherPlano(empresa_id: string, slug: string) {
    const plano = planoDoSlug(slug)
    if (!plano) throw new AppError('Plano inválido', 400)

    const ativa = await prisma.assinatura.findFirst({
      where: { empresa_id, status: 'ATIVA' },
      select: { id: true },
    })
    if (ativa) throw new AppError('Sua empresa já possui uma assinatura ativa', 409)

    const valor = PLANOS[plano as 'STARTER' | 'PRO'].valor

    const pendente = await prisma.assinatura.findFirst({
      where: { empresa_id, status: 'PENDENTE' },
      orderBy: { criado_em: 'desc' },
    })

    if (pendente) {
      if (pendente.plano !== plano) {
        await prisma.assinatura.update({
          where: { id: pendente.id },
          data: { plano, valor, gateway: GATEWAY_TEMPORARIO, gateway_id: null, checkout_url: null },
        })
      }
    } else {
      // Pagamento recusado/cancelado antes: abre uma nova tentativa com o plano escolhido
      await prisma.assinatura.create({
        data: { empresa_id, plano, status: 'PENDENTE', gateway: GATEWAY_TEMPORARIO, valor, periodo: 'MENSAL' },
      })
    }

    return { plano, valor }
  }

  /**
   * CHECKOUT DO CADASTRO: cria a assinatura no Mercado Pago para a cobrança
   * PENDENTE criada no cadastro e devolve o link de pagamento (init_point).
   * Sem plano pré-criado no MP: valor e recorrência vêm daqui (VALOR do plano).
   */
  async criarCheckout(empresa_id: string, email: string) {
    let pendente = await prisma.assinatura.findFirst({
      where: { empresa_id, status: 'PENDENTE' },
      orderBy: { criado_em: 'desc' },
    })

    // Pagamento recusado/cancelado antes: abre uma nova tentativa com o mesmo plano
    if (!pendente && (await pagamentoRecusado(empresa_id))) {
      const ultima = await prisma.assinatura.findFirst({
        where: { empresa_id },
        orderBy: { criado_em: 'desc' },
      })
      if (ultima) {
        pendente = await prisma.assinatura.create({
          data: {
            empresa_id,
            plano:   ultima.plano,
            status:  'PENDENTE',
            gateway: 'mercadopago',
            valor:   ultima.valor,
            periodo: 'MENSAL',
          },
        })
      }
    }

    if (!pendente) {
      throw new AppError('Nenhum pagamento pendente para esta conta', 404)
    }

    // E-mail que o Mercado Pago vai exigir no checkout (o pagador precisa ser exatamente este)
    const emailPagador = (env.MP_PAYER_EMAIL_TESTE?.trim() || email).toLowerCase()

    // Já gerou o link antes (usuário voltou do checkout sem pagar): reaproveita, mas só se o
    // e-mail do pagador desse link ainda for o esperado.
    if (pendente.gateway === 'mercadopago' && pendente.checkout_url && pendente.gateway_id) {
      try {
        const antiga: any = await preApprovalClient.get({ id: pendente.gateway_id } as any)
        if (String(antiga?.payer_email ?? '').toLowerCase() === emailPagador) {
          return { init_point: pendente.checkout_url }
        }
      } catch {
        // não conseguiu conferir o link antigo: gera um novo abaixo
      }
    }

    try {
      const mpAssinatura = await preApprovalClient.create({
        body: {
          reason:             `MenuPoint - Plano ${pendente.plano}`,
          external_reference: empresa_id,
          // Modo teste: MP_PAYER_EMAIL_TESTE substitui o e-mail do cadastro (pagador de teste do MP)
          payer_email:        emailPagador,
          back_url:           `${FRONTEND_PRINCIPAL}/assinatura/sucesso`,
          notification_url:   `${env.API_URL}/api/v1/assinatura/webhook`,
          status:             'pending',
          auto_recurring: {
            frequency:          1,
            frequency_type:     'months',
            transaction_amount: Number(pendente.valor),
            currency_id:        'BRL',
          },
        } as any,
      })

      if (!mpAssinatura.init_point) {
        throw new AppError('Mercado Pago não retornou o link de checkout', 502)
      }

      await prisma.assinatura.update({
        where: { id: pendente.id },
        data: {
          gateway:      'mercadopago',
          gateway_id:   mpAssinatura.id ?? null,
          checkout_url: mpAssinatura.init_point,
        },
      })

      return { init_point: mpAssinatura.init_point }
    } catch (err: any) {
      if (err instanceof AppError) throw err
      console.error('[checkout] erro do Mercado Pago:', JSON.stringify(err?.cause ?? err?.message ?? err))
      const msg = err?.cause?.[0]?.description ?? err?.message ?? 'Erro ao criar assinatura'
      throw new AppError(`Mercado Pago: ${msg}`, 502)
    }
  }

  /**
   * Confere agora no Mercado Pago o status da assinatura pendente da empresa (mesma regra do
   * webhook). A tela de retorno usa isso para não depender só do webhook, que pode demorar
   * ou nem estar configurado.
   */
  async sincronizarStatus(empresa_id: string) {
    const ultima = await prisma.assinatura.findFirst({
      where: { empresa_id },
      orderBy: { criado_em: 'desc' },
    })
    if (!ultima) {
      throw new AppError('Nenhuma assinatura encontrada', 404)
    }

    if (ultima.status === 'PENDENTE' && ultima.gateway === 'mercadopago' && ultima.gateway_id) {
      let statusMP: string | null = null
      try {
        const r: any = await this.processarWebhook(ultima.gateway_id, 'subscription_preapproval')
        statusMP = r?.status_mp ?? null
        console.log(`[sincronizar] empresa=${empresa_id} assinatura_mp=${ultima.gateway_id} status_mp=${statusMP}`)
      } catch (err: any) {
        // Falha ao consultar o MP: devolve o status que já temos e a tela tenta de novo
        console.error(`[sincronizar] falha ao consultar o MP: ${err?.message ?? err}`)
      }
      let atual = await prisma.assinatura.findUnique({ where: { id: ultima.id } })

      // Ainda pendente: a pessoa pode ter pago por um link gerado antes (outra assinatura do MP
      // da mesma empresa). Procura uma assinatura autorizada com o mesmo external_reference.
      if (atual?.status === 'PENDENTE') {
        try {
          const busca: any = await (preApprovalClient as any).search({
            options: { external_reference: empresa_id, status: 'authorized' },
          })
          const autorizada = busca?.results?.[0]
          if (autorizada?.id) {
            await prisma.assinatura.update({
              where: { id: ultima.id },
              data: { gateway: 'mercadopago', gateway_id: String(autorizada.id) },
            })
            const r2: any = await this.processarWebhook(String(autorizada.id), 'subscription_preapproval')
            statusMP = r2?.status_mp ?? statusMP
            atual = await prisma.assinatura.findUnique({ where: { id: ultima.id } })
          }
        } catch (err: any) {
          console.error(`[sincronizar] busca por assinatura autorizada falhou: ${err?.message ?? err}`)
        }
      }

      return { status: atual?.status ?? ultima.status, status_mp: statusMP }
    }

    return { status: ultima.status }
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

      // Se ficou ATIVA, libera a empresa com o plano da própria assinatura salva no cadastro
      if (novoStatus === 'ATIVA') {
        const assinatura = await prisma.assinatura.findFirst({
          where: { gateway_id: id, gateway: 'mercadopago' },
        })

        if (assinatura) {
          await prisma.empresa.update({
            where: { id: assinatura.empresa_id },
            data:  { plano: assinatura.plano, ativo: true },
          })
        }
      }

      return {
        assinatura_id:     raw.id,
        payer_email:       raw.payer_email,
        status:            novoStatus,
        status_mp:         statusMP,
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