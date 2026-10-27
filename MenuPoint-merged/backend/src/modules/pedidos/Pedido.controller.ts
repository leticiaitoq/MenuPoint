import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify'
import { PedidoService } from './Pedido.service'
import { PedidoRepository } from './Pedido.repository'
import {
  criarPedidoSchema,
  atualizarStatusPedidoSchema,
  atualizarPedidoSchema,
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
      const pedido = await service.criar(data, user.estabelecimento_id, user.sub)

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

      const { status, modalidade, mesa_id, data_inicio, data_fim } = request.query as {
        status?: string // um ou vários separados por vírgula: RECEBIDO,PREPARO,PRONTO
        modalidade?: string
        mesa_id?: string
        data_inicio?: string
        data_fim?: string
      }

      const statusValidos = ['RECEBIDO', 'PREPARO', 'PRONTO', 'ENTREGUE', 'CANCELADO']
      const listaStatus = status
        ? status.split(',').map((s) => s.trim().toUpperCase()).filter(Boolean)
        : []

      if (listaStatus.some((s) => !statusValidos.includes(s))) {
        throw new AppError('Status inválido no filtro', 400)
      }
      if (mesa_id && !z.string().uuid().safeParse(mesa_id).success) {
        throw new AppError('mesa_id inválido', 400)
      }

      const pedidos = await service.listar(user.estabelecimento_id, {
        ...(listaStatus.length > 0 && { status: listaStatus }),
        ...(mesa_id && { mesa_id }),
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

  // PUT /:id — edita nome do cliente, observações e itens de um pedido em andamento
  app.put(
    '/:id',
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { id } = request.params as { id: string }
      const user = request.user as JWTPayload

      if (!user.estabelecimento_id) {
        throw new AppError('Usuário não vinculado a um estabelecimento', 400)
      }

      const data = atualizarPedidoSchema.parse(request.body)
      const pedido = await service.atualizar(id, data, user.estabelecimento_id)

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

  // POST /transferir — Caixa: transfere pedidos de uma mesa para outra
  app.post(
    '/transferir',
    async (request: FastifyRequest, reply: FastifyReply) => {
      const user = request.user as JWTPayload

      if (!user.estabelecimento_id) {
        throw new AppError('Usuário não vinculado a um estabelecimento', 400)
      }
      if (!['ADMIN', 'CAIXA'].includes(user.perfil)) {
        throw new AppError('Apenas caixa ou administrador podem transferir pedidos', 403)
      }

      const data = z
        .object({
          origem_mesa_id: z.string().uuid('origem_mesa_id inválido'),
          destino_mesa_id: z.string().uuid('destino_mesa_id inválido'),
          pedido_ids: z.array(z.string().uuid()).min(1).optional(),
          confirmar_mesa_ocupada: z.boolean().optional(),
        })
        .parse(request.body)

      const resultado = await service.transferirPedidos(data, user.estabelecimento_id)
      return reply.send(resultado)
    }
  )

  // POST /juntar — Caixa: une vários pedidos da MESMA mesa em um só
  app.post(
    '/juntar',
    async (request: FastifyRequest, reply: FastifyReply) => {
      const user = request.user as JWTPayload

      if (!user.estabelecimento_id) {
        throw new AppError('Usuário não vinculado a um estabelecimento', 400)
      }
      if (!['ADMIN', 'CAIXA'].includes(user.perfil)) {
        throw new AppError('Apenas caixa ou administrador podem juntar pedidos', 403)
      }

      const data = z
        .object({
          mesa_id: z.string().uuid('mesa_id inválido'),
          pedido_ids: z.array(z.string().uuid()).min(2, 'Escolha pelo menos 2 pedidos'),
        })
        .parse(request.body)

      const resultado = await service.juntarPedidos(data, user.estabelecimento_id)
      return reply.send(resultado)
    }
  )

  // POST /mesa/:mesa_id/cancelar — Caixa: cancela todos os pedidos em andamento da mesa
  app.post(
    '/mesa/:mesa_id/cancelar',
    async (request: FastifyRequest, reply: FastifyReply) => {
      const user = request.user as JWTPayload

      if (!user.estabelecimento_id) {
        throw new AppError('Usuário não vinculado a um estabelecimento', 400)
      }
      // Ação sensível: só caixa e administrador
      if (!['ADMIN', 'CAIXA'].includes(user.perfil)) {
        throw new AppError('Apenas caixa ou administrador podem cancelar pedidos', 403)
      }

      const { mesa_id } = z
        .object({ mesa_id: z.string().uuid('mesa_id inválido') })
        .parse(request.params)
      const { motivo } = z
        .object({ motivo: z.string().trim().min(3, 'Informe o motivo').max(500) })
        .parse(request.body)

      const resultado = await service.cancelarPedidosDaMesa(
        mesa_id,
        motivo,
        user.estabelecimento_id
      )

      return reply.send(resultado)
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
