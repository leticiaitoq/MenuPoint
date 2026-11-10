import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify'
import { z } from 'zod'
import { AssinaturaService } from './Assinatura.service'
import { criarAssinaturaSchema, webhookMPSchema } from './Assinatura.schema'
import { AppError } from '@shared/errors/AppError'
import { JWTPayload } from '@modules/auth/Auth.schema'
import { env } from '@config/env'
import prisma from '@config/prisma'
import { PLANOS, valorDoPlano } from './Planos.config'
import { createHmac, timingSafeEqual } from 'crypto'

const service = new AssinaturaService()

// Confere a assinatura (x-signature) da notificação do Mercado Pago com a chave secreta do webhook.
function assinaturaDoWebhookValida(request: FastifyRequest, dataId: string): boolean {
  const secret = env.MP_WEBHOOK_SECRET
  if (!secret) return true

  const cabecalho = String(request.headers['x-signature'] ?? '')
  const requestId = String(request.headers['x-request-id'] ?? '')
  const partes = Object.fromEntries(
    cabecalho.split(',').map((p) => {
      const [k, ...v] = p.trim().split('=')
      return [k, v.join('=')]
    })
  ) as Record<string, string>
  if (!partes.ts || !partes.v1) return false

  const manifesto = `id:${dataId.toLowerCase()};request-id:${requestId};ts:${partes.ts};`
  const esperado = createHmac('sha256', secret).update(manifesto).digest('hex')
  const a = Buffer.from(esperado)
  const b = Buffer.from(partes.v1)
  return a.length === b.length && timingSafeEqual(a, b)
}

export async function assinaturaRoutes(app: FastifyInstance): Promise<void> {

  /**
   * Chamado pelo botão "Assinar" do site.
   */
  app.post(
    '/criar',
    {
      onRequest: [async (request) => request.jwtVerify()],
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const user = request.user as JWTPayload

      // empresa_id vem do token; garante que só a própria empresa assina
      if (!user.empresa_id) {
        throw new AppError('Usuário não vinculado a uma empresa', 400)
      }

      const data = criarAssinaturaSchema.parse(request.body)
      const resultado = await service.criar(data, user.empresa_id)
      return reply.status(201).send(resultado)
    }
  )

  /**
   * Pagamento real (Mercado Pago) logo após o cadastro: cria a assinatura no MP
   * para a cobrança pendente da empresa e devolve { init_point }.
   */
  app.post(
    '/checkout',
    {
      onRequest: [async (request) => request.jwtVerify()],
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const user = request.user as JWTPayload

      if (!user.empresa_id) {
        throw new AppError('Usuário não vinculado a uma empresa', 400)
      }

      const resultado = await service.criarCheckout(user.empresa_id, user.email)
      return reply.status(201).send(resultado)
    }
  )

  /**
   * POST /api/v1/assinatura/plano
   * Tela /planos: define (ou troca) o plano da cobrança pendente antes do pagamento.
   */
  app.post(
    '/plano',
    {
      onRequest: [async (request) => request.jwtVerify()],
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const user = request.user as JWTPayload

      if (!user.empresa_id) {
        throw new AppError('Usuário não vinculado a uma empresa', 400)
      }

      const { plano, periodo } = z
        .object({ plano: z.string().min(1), periodo: z.enum(['mensal', 'anual']).optional() })
        .parse(request.body)
      const resultado = await service.escolherPlano(user.empresa_id, plano, periodo)
      return reply.status(200).send(resultado)
    }
  )

  /**
   * Consulta o Mercado Pago e atualiza o status da assinatura da empresa na hora.
   */
  app.post(
    '/sincronizar',
    {
      onRequest: [async (request) => request.jwtVerify()],
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const user = request.user as JWTPayload

      if (!user.empresa_id) {
        throw new AppError('Usuário não vinculado a uma empresa', 400)
      }

      const resultado = await service.sincronizarStatus(user.empresa_id)
      return reply.send(resultado)
    }
  )

  /**
   * Endpoint PÚBLICO — o Mercado Pago chama automaticamente quando
   * o status de uma assinatura muda (pagamento aprovado, cancelado, etc.).
   */
  app.post(
    '/webhook',
    async (request: FastifyRequest, reply: FastifyReply) => {
      // MP pode mandar como query param OU como body — tratamos os dois
      const query = request.query as Record<string, string>
      const body  = request.body  as Record<string, any>

      const id   = query['data.id'] ?? body?.data?.id
      const type = query['type']    ?? body?.type ?? ''

      if (!id) {
        // MP às vezes envia pings de teste sem id — responde 200 pra não retentar
        return reply.status(200).send({ ok: true })
      }

      if (!assinaturaDoWebhookValida(request, String(id))) {
        return reply.status(401).send({ ok: false })
      }

      const resultado = await service.processarWebhook(String(id), type)

      // MP espera status 200 para parar de retentar o envio
      return reply.status(200).send(resultado)
    }
  )

  /**
   * Retorna os planos disponíveis com os IDs reais do MP.
   */
  app.get(
    '/planos',
    async (_request: FastifyRequest, reply: FastifyReply) => {
      return reply.send([
        { id: env.MP_PLAN_ID_BASICO, plano: 'STARTER', ...PLANOS.STARTER, valor_anual: valorDoPlano('STARTER', 'ANUAL') },
        { id: env.MP_PLAN_ID_PRO,    plano: 'PRO',     ...PLANOS.PRO,     valor_anual: valorDoPlano('PRO', 'ANUAL') },
      ])
    }
  )

  /**
   * Retorna a assinatura ativa (ou mais recente) da empresa autenticada.
   */
  app.get(
    '/minha',
    {
      onRequest: [async (request) => request.jwtVerify()],
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const user = request.user as JWTPayload

      if (!user.empresa_id) {
        throw new AppError('Usuário não vinculado a uma empresa', 400)
      }
      const assinatura = await prisma.assinatura.findFirst({
        where: { empresa_id: user.empresa_id },
        orderBy: { criado_em: 'desc' },
      })
      if (!assinatura) {
        return reply.status(404).send({ message: 'Nenhuma assinatura encontrada' })
      }

      return reply.send(assinatura)
    }
  )
}