import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify'
import { PedidoService } from './Pedido.service'
import { PedidoRepository } from './Pedido.repository'
import {
  criarPedidoSchema,
  atualizarStatusPedidoSchema,
} from './Pedido.schema'
import { AppError } from '@shared/errors/AppError'
import { JWTPayload } from '@modules/auth/Auth.schema'
import { z } from 'zod'

const repository = new PedidoRepository()
const service = new PedidoService(repository)

export async function pedidosRoutes(app: FastifyInstance): Promise<void> {

  app.addHook('onRequest', async (request, reply) => {
    await request.jwtVerify()
  })

  // POST / — cria pedido
  app.post(
    '/',
    async (request: FastifyRequest, reply: FastifyReply) => {
      const user = request.user as JWTPayload

      if (!user.estabelecimento_id) {
        throw new AppError('Usuário não vinculado a um estabelecimento', 400)
      }

      const data = criarPedidoSchema.parse(request.body)
      const pedido = await service.criar(data, user.estabelecimento_id)

      return reply.status(201).send(pedido)
    }
  )

  // GET / — lista pedidos com filtros opcionais
  app.get(
    '/',
    async (request: FastifyRequest, reply: FastifyReply) => {
      const user = request.user as JWTPayload

      if (!user.estabelecimento_id) {
        throw new AppError('Usuário não vinculado a um estabelecimento', 400)
      }

      const { status, modalidade, data_inicio, data_fim } = request.query as {
        status?: string
        modalidade?: string
        data_inicio?: string
        data_fim?: string
      }

      const pedidos = await service.listar(user.estabelecimento_id, {
        ...(status && { status }),
        ...(modalidade && { modalidade }),
        ...(data_inicio && { data_inicio: new Date(data_inicio) }),
        ...(data_fim && { data_fim: new Date(data_fim) }),
      })

      return reply.send(pedidos)
    }
  )

  // GET /:id — busca pedido por ID com todos os detalhes
  app.get(
    '/:id',
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { id } = request.params as { id: string }
      const user = request.user as JWTPayload

      if (!user.estabelecimento_id) {
        throw new AppError('Usuário não vinculado a um estabelecimento', 400)
      }

      const pedido = await service.findById(id, user.estabelecimento_id)
      return reply.send(pedido)
    }
  )

  // PATCH /:id/status — atualiza status do pedido
  app.patch(
    '/:id/status',
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { id } = request.params as { id: string }
      const user = request.user as JWTPayload

      if (!user.estabelecimento_id) {
        throw new AppError('Usuário não vinculado a um estabelecimento', 400)
      }

      const data = atualizarStatusPedidoSchema.parse(request.body)
      const pedido = await service.atualizarStatus(
        id,
        data,
        user.estabelecimento_id
      )

      return reply.send(pedido)
    }
  )

  // PATCH /:id/atendente — vincula atendente ao pedido
  app.patch(
    '/:id/atendente',
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { id } = request.params as { id: string }
      const user = request.user as JWTPayload

      if (!user.estabelecimento_id) {
        throw new AppError('Usuário não vinculado a um estabelecimento', 400)
      }

      const { atendido_por_id } = z
        .object({ atendido_por_id: z.string().uuid('ID inválido') })
        .parse(request.body)

      const pedido = await service.atribuirAtendente(
        id,
        atendido_por_id,
        user.estabelecimento_id
      )

      return reply.send(pedido)
    }
  )
}
