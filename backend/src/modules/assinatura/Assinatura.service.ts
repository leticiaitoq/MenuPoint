import MercadoPagoConfig, { PreApproval } from 'mercadopago'
import axios from 'axios'
import { randomUUID } from 'crypto'
import { env } from '@config/env'
import { AppError } from '@shared/errors/AppError'
import { CriarAssinaturaDTO } from './Assinatura.schema'
import prisma from '@config/prisma'
import { Plano, StatusAssinatura } from '@prisma/client'
import { pagamentoRecusado, planoDoSlug, GATEWAY_TEMPORARIO } from './Pagamento.temporario'
import { PLANOS, PeriodoCobranca, periodoDoTexto, valorDoPlano, fimDoPeriodo } from './Planos.config'

// FRONTEND_URL pode ter várias origens separadas por vírgula (CORS): o retorno do MP usa a primeira
const FRONTEND_PRINCIPAL = env.FRONTEND_URL.split(',')[0].trim().replace(/\/$/, '')

const mpClient = new MercadoPagoConfig({
  accessToken: env.MP_ACCESS_TOKEN,
})

const preApprovalClient = new PreApproval(mpClient)

// Checkout Pro com ORDER (Orders API): pagamento único, com retorno automático ao site
const mpApi = axios.create({
  baseURL: 'https://api.mercadopago.com',
  headers: { Authorization: `Bearer ${env.MP_ACCESS_TOKEN}` },
  timeout: 15000,
})

/** Id de order do Mercado Pago (ORD... em produção, ORDTST... em teste). */
export const ehOrderId = (id?: string | null) => Boolean(id && id.startsWith('ORD'))

/** Traduz o status da order do Mercado Pago para o status da assinatura. */
function statusDaOrder(order: any): { status: StatusAssinatura; status_mp: string } {
  const st = String(order?.status ?? '').toLowerCase()
  const detalhe = String(order?.status_detail ?? '').toLowerCase()
  const pagamentos: any[] = Array.isArray(order?.transactions?.payments) ? order.transactions.payments : []
  const pago =
    (st === 'processed' && detalhe === 'accredited') ||
    pagamentos.some(
      (p) => String(p?.status).toLowerCase() === 'processed' && String(p?.status_detail).toLowerCase() === 'accredited'
    )
  if (pago) return { status: 'ATIVA', status_mp: 'approved' }
  if (['canceled', 'cancelled', 'refunded'].includes(st)) return { status: 'CANCELADA', status_mp: st }
  if (['failed', 'expired'].includes(st)) return { status: 'FALHOU', status_mp: st }
  return { status: 'PENDENTE', status_mp: st || 'pending' }
}

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
  async escolherPlano(empresa_id: string, slug: string, periodoTexto?: string) {
    const plano = planoDoSlug(slug)
    if (!plano) throw new AppError('Plano inválido', 400)
    const periodo: PeriodoCobranca = periodoDoTexto(periodoTexto)

    const ativa = await prisma.assinatura.findFirst({
      where: { empresa_id, status: 'ATIVA' },
      select: { id: true },
    })
    if (ativa) throw new AppError('Sua empresa já possui uma assinatura ativa', 409)

    const valor = valorDoPlano(plano as 'STARTER' | 'PRO', periodo)

    const pendente = await prisma.assinatura.findFirst({
      where: { empresa_id, status: 'PENDENTE' },
      orderBy: { criado_em: 'desc' },
    })

    if (pendente) {
      // Trocar plano ou período muda o valor: descarta o link de checkout antigo
      if (pendente.plano !== plano || pendente.periodo !== periodo) {
        await prisma.assinatura.update({
          where: { id: pendente.id },
          data: { plano, periodo, valor, gateway: GATEWAY_TEMPORARIO, gateway_id: null, checkout_url: null },
        })
      }
    } else {
      // Pagamento recusado/cancelado/vencido antes: abre uma nova tentativa
      await prisma.assinatura.create({
        data: { empresa_id, plano, periodo, status: 'PENDENTE', gateway: GATEWAY_TEMPORARIO, valor },
      })
    }

    return { plano, periodo, valor }
  }

  /**
   * CHECKOUT (Checkout Pro com ORDER): cria uma order no Mercado Pago para a cobrança PENDENTE
   * da empresa (mensal ou anual) e devolve o link de pagamento. Ao pagar, o Mercado Pago devolve
   * o cliente sozinho para /assinatura/sucesso (auto_return) e avisa o backend pelo webhook.
   */
  async criarCheckout(empresa_id: string, email: string) {
    let pendente = await prisma.assinatura.findFirst({
      where: { empresa_id, status: 'PENDENTE' },
      orderBy: { criado_em: 'desc' },
    })

    // Pagamento recusado/cancelado/vencido antes: abre uma nova tentativa com o mesmo plano e período
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
            periodo: ultima.periodo,
            status:  'PENDENTE',
            gateway: 'mercadopago',
            valor:   valorDoPlano(ultima.plano as 'STARTER' | 'PRO', ultima.periodo),
          },
        })
      }
    }

    if (!pendente) {
      throw new AppError('Nenhum pagamento pendente para esta conta', 404)
    }

    // Já gerou o link antes (usuário voltou do checkout sem pagar): reaproveita enquanto a order
    // ainda estiver aberta no Mercado Pago
    if (ehOrderId(pendente.gateway_id) && pendente.checkout_url) {
      try {
        const { data: antiga } = await mpApi.get(`/v1/orders/${pendente.gateway_id}`)
        if (statusDaOrder(antiga).status === 'PENDENTE') {
          return { init_point: pendente.checkout_url }
        }
      } catch {
        // não conseguiu conferir o link antigo: gera um novo abaixo
      }
    }

    // Modo teste: MP_PAYER_EMAIL_TESTE substitui o e-mail do cadastro (comprador de teste do MP)
    const emailPagador = (env.MP_PAYER_EMAIL_TESTE?.trim() || email).toLowerCase()
    const valor = Number(pendente.valor).toFixed(2)
    const nomePlano = PLANOS[pendente.plano as 'STARTER' | 'PRO']?.nome ?? pendente.plano
    const titulo = `MenuPoint - Plano ${nomePlano} (${pendente.periodo === 'ANUAL' ? 'anual' : 'mensal'})`
    const voltar = `${FRONTEND_PRINCIPAL}/assinatura/sucesso`

    try {
      const { data: order } = await mpApi.post(
        '/v1/orders',
        {
          type: 'online',
          processing_mode: 'manual',
          total_amount: valor,
          external_reference: pendente.id, // volta no webhook: identifica a cobrança
          description: titulo,
          expiration_time: 'P1D',
          payer: { email: emailPagador },
          config: {
            notification_url: `${env.API_URL}/api/v1/assinatura/webhook`,
            online: {
              success_url: voltar,
              failure_url: voltar,
              pending_url: voltar,
              auto_return: 'approved', // devolve o cliente ao site sozinho (como no quadro: back_url)
            },
          },
          items: [
            { title: titulo, unit_price: valor, quantity: 1, unit_measure: 'unit', total_amount: valor },
          ],
        },
        { headers: { 'X-Idempotency-Key': randomUUID() } }
      )

      if (!order?.checkout_url || !order?.id) {
        throw new AppError('Mercado Pago não retornou o link de checkout', 502)
      }

      await prisma.assinatura.update({
        where: { id: pendente.id },
        data: { gateway: 'mercadopago', gateway_id: String(order.id), checkout_url: order.checkout_url },
      })

      return { init_point: order.checkout_url as string }
    } catch (err: any) {
      if (err instanceof AppError) throw err
      const detalhe = err?.response?.data
      console.error('[checkout] erro do Mercado Pago:', JSON.stringify(detalhe ?? err?.message ?? err))
      const msg = detalhe?.errors?.[0]?.message ?? detalhe?.message ?? err?.message ?? 'Erro ao criar pagamento'
      throw new AppError(`Mercado Pago: ${msg}`, 502)
    }
  }

  /**
   * Consulta a order no Mercado Pago e atualiza a assinatura dona dela. Serve ao webhook, ao
   * "sincronizar" (tela de retorno) e ao cron: as três vias usam esta mesma regra, então não
   * há divergência entre elas e repetir a chamada é seguro.
   */
  async processarOrder(orderId: string) {
    let order: any
    try {
      order = (await mpApi.get(`/v1/orders/${orderId}`)).data
    } catch (err: any) {
      console.error(`[order] falha ao consultar ${orderId}: ${err?.response?.status ?? ''} ${err?.message ?? err}`)
      throw new AppError('Erro ao consultar pagamento no Mercado Pago', 502)
    }

    const assinaturaId = String(order?.external_reference ?? '')
    const assinatura = assinaturaId
      ? await prisma.assinatura.findUnique({ where: { id: assinaturaId } }).catch(() => null)
      : null
    if (!assinatura) return { ignorado: true, motivo: 'assinatura não encontrada' }

    // Só vale a order que cobra exatamente o valor desta assinatura
    if (Number(order?.total_amount) !== Number(assinatura.valor)) {
      console.error(`[order] valor divergente: order=${order?.total_amount} assinatura=${assinatura.valor}`)
      return { ignorado: true, motivo: 'valor divergente' }
    }

    const { status: novoStatus, status_mp } = statusDaOrder(order)

    if (novoStatus === 'ATIVA') {
      const agora = new Date()
      // Condicional: se o webhook e o "sincronizar" chegarem juntos, só um deles ativa
      const r = await prisma.assinatura.updateMany({
        where: { id: assinatura.id, status: { not: 'ATIVA' } },
        data: {
          status: 'ATIVA',
          gateway: 'mercadopago',
          gateway_id: String(order.id),
          inicia_em: agora,
          expira_em: fimDoPeriodo(agora, assinatura.periodo),
        },
      })
      if (r.count > 0) {
        // Assinaturas anteriores da empresa (ex.: período vencido) deixam de valer
        await prisma.assinatura.updateMany({
          where: { empresa_id: assinatura.empresa_id, id: { not: assinatura.id }, status: 'ATIVA' },
          data: { status: 'EXPIRADA' },
        })
        await prisma.empresa.update({
          where: { id: assinatura.empresa_id },
          data: { plano: assinatura.plano, ativo: true },
        })
      }
    } else if (novoStatus !== 'PENDENTE' && assinatura.status === 'PENDENTE') {
      await prisma.assinatura.update({
        where: { id: assinatura.id },
        data: {
          status: novoStatus,
          ...(novoStatus === 'CANCELADA' && { cancelada_em: new Date() }),
        },
      })
    }

    return { assinatura_id: assinatura.id, order_id: order.id, status: novoStatus, status_mp }
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

    // Pagamento por ORDER (Checkout Pro): consulta a order e devolve o status atual
    if (ultima.status === 'PENDENTE' && ultima.gateway === 'mercadopago' && ehOrderId(ultima.gateway_id)) {
      let statusMP: string | null = null
      try {
        const r: any = await this.processarOrder(ultima.gateway_id as string)
        statusMP = r?.status_mp ?? null
      } catch (err: any) {
        console.error(`[sincronizar] falha ao consultar a order: ${err?.message ?? err}`)
      }
      const atual = await prisma.assinatura.findUnique({ where: { id: ultima.id } })
      return { status: atual?.status ?? ultima.status, status_mp: statusMP }
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
          // Só vale uma assinatura autorizada que seja MESMO desta empresa (external_reference) e
          // que ainda não esteja ligada a outra assinatura do banco. Sem essa conferência, uma
          // assinatura paga de outra conta de teste poderia liberar esta empresa por engano.
          const candidatas: any[] = Array.isArray(busca?.results) ? busca.results : []
          const autorizada = candidatas.find(
            (r) => r?.status === 'authorized' && String(r?.external_reference ?? '') === empresa_id
          )
          const emUso = autorizada?.id
            ? await prisma.assinatura.findFirst({
                where: { gateway_id: String(autorizada.id), id: { not: ultima.id } },
                select: { id: true },
              })
            : null
          if (autorizada?.id && !emUso) {
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
    // Pagamento por ORDER (Checkout Pro)
    if (type === 'order') {
      return this.processarOrder(id)
    }

    // Assinaturas antigas (PreApproval): continuam sendo tratadas como antes
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

      // O Mercado Pago devolve em external_reference a empresa dona desta assinatura. Só
      // atualiza o registro dessa empresa, para nunca ativar uma empresa com o pagamento de outra.
      const empresaDona = String(raw.external_reference ?? '')

      // Atualiza a assinatura no banco pelo gateway_id
      const assinaturaAtualizada = await prisma.assinatura.updateMany({
        where: { gateway_id: id, gateway: 'mercadopago', ...(empresaDona && { empresa_id: empresaDona }) },
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
          where: { gateway_id: id, gateway: 'mercadopago', ...(empresaDona && { empresa_id: empresaDona }) },
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