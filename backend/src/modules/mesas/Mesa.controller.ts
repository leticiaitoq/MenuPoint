import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify'
import { MesaService } from './Mesa.service'
import { MesaRepository } from './Mesa.repository'
import {
  criarMesaSchema,
  atualizarMesaSchema,
  atualizarStatusMesaSchema,
  criarPedidoPublicoMesaSchema,
} from './Mesa.schema'
import { AppError } from '@shared/errors/AppError'
import { JWTPayload } from '@modules/auth/Auth.schema'
import { clienteIdOpcional } from '@modules/pedidos/Pedido.publico'
import { chegadaPeloCliente } from '@modules/reservas/Reserva.chegada'

const repository = new MesaRepository()
const service = new MesaService(repository)

export async function mesasRoutes(app: FastifyInstance): Promise<void> {

  app.register(async (publicRoutes) => {

    publicRoutes.get(
      '/qrcode/:token',
      async (request: FastifyRequest, reply: FastifyReply) => {
        const { token } = request.params as { token: string }
        const mesa = await service.infoPublica(token)
        return reply.send(mesa)
      }
    )

    // POST /mesas/qrcode/:token/chegada — o cliente confirma que chegou à mesa reservada (sem login).
    // Valida pelo telefone da reserva (ou pela conta logada). Limite por IP: ninguém testa telefones em série.
    publicRoutes.post(
      '/qrcode/:token/chegada',
      {
        config: {
          rateLimit: {
            max: 5,
            timeWindow: '1 minute',
            errorResponseBuilder: () => ({
              statusCode: 429,
              status: 'error',
              message: 'Muitas tentativas. Aguarde um minuto e tente de novo.',
            }),
          },
        },
      },
      async (request: FastifyRequest, reply: FastifyReply) => {
        const { token } = request.params as { token: string }
        const { telefone } = (request.body ?? {}) as { telefone?: string }
        const mesa = await service.findByToken(token)
        const clienteId = await clienteIdOpcional(request)
        return reply.send(await chegadaPeloCliente(mesa, telefone, clienteId))
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

        // Convidado (sem login) pede normalmente; logado tem o pedido ligado à conta (histórico fixo)
        const clienteId = await clienteIdOpcional(request)
        const pedido = await service.criarPedidoPublico(token, parsed.data, clienteId)
        return reply.status(201).send({ pedido })
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