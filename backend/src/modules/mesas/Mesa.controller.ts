import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify'
import { MesaService } from './Mesa.service'
import { MesaRepository } from './Mesa.repository'
import {
  criarMesaSchema,
  atualizarMesaSchema,
  atualizarStatusMesaSchema,
  criarPedidoPublicoMesaSchema,
} from './Mesa.schema'
import { z } from 'zod'
import { AppError } from '@shared/errors/AppError'
import { ChamadoMesaService } from './ChamadoMesa.service'
import { JWTPayload } from '@modules/auth/Auth.schema'

const repository = new MesaRepository()
const service = new MesaService(repository)
const chamados = new ChamadoMesaService()

// Rotas públicas do QR: limite por IP (o Wi-Fi do restaurante é compartilhado, por isso folgado)
const limiteChamado = {
  config: {
    rateLimit: {
      max: 20,
      timeWindow: '1 minute',
      errorResponseBuilder: () => ({
        statusCode: 429,
        status: 'error',
        message: 'Muitas solicitações em pouco tempo. Aguarde um instante e tente de novo.',
      }),
    },
  },
}

const pedirContaSchema = z.object({
  forma_pagamento: z.enum(['PIX_PRESENCIAL', 'DINHEIRO', 'CARTAO']).optional(),
})

export async function mesasRoutes(app: FastifyInstance): Promise<void> {

  app.register(async (publicRoutes) => {

    publicRoutes.get(
      '/qrcode/:token',
      async (request: FastifyRequest, reply: FastifyReply) => {
        const { token } = request.params as { token: string }
        const mesa = await service.findByToken(token)
        return reply.send(mesa)
      }
    )

    // GET /mesas/qrcode/:token/pedidos — histórico da mesa para o cliente local (sem login)
    publicRoutes.get(
      '/qrcode/:token/pedidos',
      async (request: FastifyRequest, reply: FastifyReply) => {
        const { token } = request.params as { token: string }
        const historico = await service.pedidosPublicos(token)
        return reply.send(historico)
      }
    )

    // POST /mesas/qrcode/:token/pedidos — cliente local envia o pedido para a cozinha (sem login).
    // Rota pública: limite por IP para ninguém lotar a cozinha com pedidos falsos.
    publicRoutes.post(
      '/qrcode/:token/pedidos',
      {
        config: {
          rateLimit: {
            max: 6,
            timeWindow: '1 minute',
            errorResponseBuilder: () => ({
              statusCode: 429,
              status: 'error',
              message: 'Muitos pedidos em pouco tempo. Aguarde um momento e tente de novo.',
            }),
          },
        },
      },
      async (request: FastifyRequest, reply: FastifyReply) => {
        const { token } = request.params as { token: string }

        const parsed = criarPedidoPublicoMesaSchema.safeParse(request.body)
        if (!parsed.success) {
          throw new AppError(parsed.error.issues[0]?.message ?? 'Dados do pedido inválidos', 400)
        }

        const pedido = await service.criarPedidoPublico(token, parsed.data)
        return reply.status(201).send({ pedido })
      }
    )

    // POST /mesas/qrcode/:token/chamar-garcom — cliente na mesa pede atendimento (sem login)
    publicRoutes.post(
      '/qrcode/:token/chamar-garcom',
      limiteChamado,
      async (request: FastifyRequest, reply: FastifyReply) => {
        const { token } = request.params as { token: string }
        return reply.status(201).send(await chamados.chamarGarcom(token))
      }
    )

    // GET /mesas/qrcode/:token/conta — "Ver conta" do cliente local: consumo da mesa e total a pagar (sem login)
    publicRoutes.get(
      '/qrcode/:token/conta',
      async (request: FastifyRequest, reply: FastifyReply) => {
        const { token } = request.params as { token: string }
        return reply.send(await chamados.contaPublica(token))
      }
    )

    // POST /mesas/qrcode/:token/pedir-conta — cliente na mesa pede a conta (sem login)
    // body opcional: { forma_pagamento?: 'PIX_PRESENCIAL' | 'DINHEIRO' | 'CARTAO' }
    publicRoutes.post(
      '/qrcode/:token/pedir-conta',
      limiteChamado,
      async (request: FastifyRequest, reply: FastifyReply) => {
        const { token } = request.params as { token: string }
        const parsed = pedirContaSchema.safeParse(request.body ?? {})
        if (!parsed.success) {
          throw new AppError(parsed.error.issues[0]?.message ?? 'Forma de pagamento inválida', 400)
        }
        return reply.status(201).send(await chamados.pedirConta(token, parsed.data.forma_pagamento))
      }
    )

  })

  app.register(async (privateRoutes) => {

    privateRoutes.addHook('onRequest', async (request, reply) => {
      await request.jwtVerify()
    })

    //Post
    privateRoutes.post(
      '/',
      async (request: FastifyRequest, reply: FastifyReply) => {
        const user = request.user as JWTPayload

        if (user.perfil !== 'ADMIN') {
          throw new AppError('Apenas administradores podem criar mesas', 403)
        }

        if (!user.estabelecimento_id) {
          throw new AppError('Usuário não vinculado a um estabelecimento', 400)
        }

        const data = criarMesaSchema.parse(request.body)
        const mesa = await service.create(data, user.estabelecimento_id)

        return reply.status(201).send(mesa)
      }
    )

    //Get
    privateRoutes.get(
      '/',
      async (request: FastifyRequest, reply: FastifyReply) => {
        const user = request.user as JWTPayload

        if (!user.estabelecimento_id) {
          throw new AppError('Usuário não vinculado a um estabelecimento', 400)
        }

        const { todas } = request.query as { todas?: string }
        const apenasAtivas = todas !== 'true'

        const mesas = await service.listar(
          user.estabelecimento_id,
          apenasAtivas
        )

        return reply.send(mesas)
      }
    )

    privateRoutes.get(
      '/ocupacao',
      async (request: FastifyRequest, reply: FastifyReply) => {
        const user = request.user as JWTPayload

        if (!user.estabelecimento_id) {
          throw new AppError('Usuário não vinculado a um estabelecimento', 400)
        }

        const resumo = await service.resumoOcupacao(user.estabelecimento_id)
        return reply.send(resumo)
      }
    )

    // GET /mesas/chamados — chamados de garçom e pedidos de conta em aberto (tela de Mesas)
    privateRoutes.get(
      '/chamados',
      async (request: FastifyRequest, reply: FastifyReply) => {
        const user = request.user as JWTPayload
        if (!user.estabelecimento_id) {
          throw new AppError('Usuário não vinculado a um estabelecimento', 400)
        }
        return reply.send(await chamados.listarAbertos(user.estabelecimento_id))
      }
    )

    // PATCH /mesas/chamados/:id/atender — dá baixa quando o garçom atende
    privateRoutes.patch(
      '/chamados/:id/atender',
      async (request: FastifyRequest, reply: FastifyReply) => {
        const user = request.user as JWTPayload
        if (!user.estabelecimento_id) {
          throw new AppError('Usuário não vinculado a um estabelecimento', 400)
        }
        const { id } = z.object({ id: z.string().uuid('ID inválido') }).parse(request.params)
        return reply.send(await chamados.atender(id, user.estabelecimento_id, user.sub))
      }
    )

    privateRoutes.get(
      '/:id',
      async (request: FastifyRequest, reply: FastifyReply) => {
        const { id } = request.params as { id: string }
        const user = request.user as JWTPayload

        if (!user.estabelecimento_id) {
          throw new AppError('Usuário não vinculado a um estabelecimento', 400)
        }

        const mesa = await service.findById(id, user.estabelecimento_id)
        return reply.send(mesa)
      }
    )

    // Put
    privateRoutes.put(
      '/:id',
      async (request: FastifyRequest, reply: FastifyReply) => {
        const { id } = request.params as { id: string }
        const user = request.user as JWTPayload

        if (user.perfil !== 'ADMIN') {
          throw new AppError('Apenas administradores podem atualizar mesas', 403)
        }

        if (!user.estabelecimento_id) {
          throw new AppError('Usuário não vinculado a um estabelecimento', 400)
        }

        const data = atualizarMesaSchema.parse(request.body)
        const mesa = await service.update(id, data, user.estabelecimento_id)

        return reply.send(mesa)
      }
    )

    // PATCH
    privateRoutes.patch(
      '/:id/status',
      async (request: FastifyRequest, reply: FastifyReply) => {
        const { id } = request.params as { id: string }
        const user = request.user as JWTPayload

        if (!user.estabelecimento_id) {
          throw new AppError('Usuário não vinculado a um estabelecimento', 400)
        }

        const data = atualizarStatusMesaSchema.parse(request.body)
        const mesa = await service.atualizarStatus(
          id,
          data,
          user.estabelecimento_id
        )

        return reply.send(mesa)
      }
    )

    privateRoutes.patch(
      '/:id/reativar',
      async (request: FastifyRequest, reply: FastifyReply) => {
        const { id } = request.params as { id: string }
        const user = request.user as JWTPayload

        if (user.perfil !== 'ADMIN') {
          throw new AppError('Apenas administradores podem reativar mesas', 403)
        }

        if (!user.estabelecimento_id) {
          throw new AppError('Usuário não vinculado a um estabelecimento', 400)
        }

        const mesa = await service.reativar(id, user.estabelecimento_id)
        return reply.send(mesa)
      }
    )

    // Soft Delete
    privateRoutes.delete(
      '/:id',
      async (request: FastifyRequest, reply: FastifyReply) => {
        const { id } = request.params as { id: string }
        const user = request.user as JWTPayload

        if (user.perfil !== 'ADMIN') {
          throw new AppError('Apenas administradores podem desativar mesas', 403)
        }

        if (!user.estabelecimento_id) {
          throw new AppError('Usuário não vinculado a um estabelecimento', 400)
        }

        await service.remove(id, user.estabelecimento_id)
        return reply.status(204).send()
      }
    )

  })
}