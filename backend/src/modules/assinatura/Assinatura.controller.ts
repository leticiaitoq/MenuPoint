import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify'
import { AssinaturaService } from './Assinatura.service'
import { criarAssinaturaSchema, webhookMPSchema } from './Assinatura.schema'
import { AppError } from '@shared/errors/AppError'
import { JWTPayload } from '@modules/auth/Auth.schema'
import { env } from '@config/env'
import prisma from '@config/prisma'

const service = new AssinaturaService()

export async function assinaturaRoutes(app: FastifyInstance): Promise<void> {

  /**
   * POST /api/v1/assinatura/criar
   *
   * Chamado pelo botão "Assinar" do site.
   * Requer autenticação — usa o empresa_id do token JWT.
   * Body: { plan_id, email }
   * Retorna: { init_point, assinatura_id, status }
   *
   * O frontend faz: window.location.href = data.init_point
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
   * POST /api/v1/assinatura/webhook
   *
   * Endpoint PÚBLICO — o Mercado Pago chama automaticamente quando
   * o status de uma assinatura muda (pagamento aprovado, cancelado, etc.).
   *
   * ⚠️  Registre esta URL no painel do MP em:
   *     Configurações → Notificações IPN/Webhooks
   *
   * Em desenvolvimento, use ngrok e atualize API_URL no .env:
   *     API_URL=https://xxxx.ngrok-free.app
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

      const resultado = await service.processarWebhook(id, type)

      // MP espera status 200 para parar de retentar o envio
      return reply.status(200).send(resultado)
    }
  )

  /**
   * GET /api/v1/assinatura/planos
   *
   * Retorna os planos disponíveis com os IDs reais do MP.
   * O frontend usa isso para montar os cards de plano dinamicamente,
   * sem ter nenhum ID hardcoded no código.
   */
  app.get(
    '/planos',
    async (_request: FastifyRequest, reply: FastifyReply) => {
      return reply.send([
        {
          id:     env.MP_PLAN_ID_BASICO,
          nome:   'Starter',
          slug:   'starter',
          valor:  49.90,
          plano:  'STARTER',
        },
        {
          id:     env.MP_PLAN_ID_PRO,
          nome:   'Pro',
          slug:   'pro',
          valor:  99.90,
          plano:  'PRO',
        },
      ])
    }
  )

  /**
   * GET /api/v1/assinatura/minha
   *
   * Retorna a assinatura ativa (ou mais recente) da empresa autenticada.
   * Útil para o painel do cliente exibir o status da assinatura.
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