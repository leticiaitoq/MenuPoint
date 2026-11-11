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
import { parsePeriodo } from '@shared/utils/periodo'
import { criarPedidoDeliverySchema } from './Pedido.publico'

const repository = new PedidoRepository()
const service = new PedidoService(repository)
const pedidosCliente = new PedidoClienteService()

/**
 * Rotas do CLIENTE logado (token com perfil CLIENTE). Ficam em um plugin à parte para que o
 * hook de login do restaurante (abaixo) não se aplique a elas, e vice-versa.
 * O app.ts libera só /pedidos/cliente/* e /pedidos/publico/* para token de cliente.
 */
async function pedidosClienteRoutes(app: FastifyInstance): Promise<void> {
  app.addHook('onRequest', async (request) => {
    await request.jwtVerify()
    const user = request.user as JWTPayload
    if (user.perfil !== 'CLIENTE') {
      throw new AppError('Esta rota é exclusiva para clientes', 403)
    }
  })

  // POST /pedidos/publico/:slug — delivery (entrega ou retirada) pelo link do restaurante.
  // Só cliente logado pode pedir: o pedido fica ligado à conta e entra no histórico fixo.
  app.post(
    '/publico/:slug',
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
      const user = request.user as JWTPayload
      const { slug } = z.object({ slug: z.string().trim().min(1).max(100) }).parse(request.params)

      const parsed = criarPedidoDeliverySchema.safeParse(request.body)
      if (!parsed.success) {
        throw new AppError(parsed.error.issues[0]?.message ?? 'Dados do pedido inválidos', 400)
      }

      const pedido = await service.criarDeliveryDoCliente(slug, parsed.data, user.sub)
      return reply.status(201).send({ pedido })
    }
  )

  // GET /pedidos/cliente/historico?origem=LOCAL|DELIVERY&slug=meu-restaurante
  // Histórico fixo do cliente: mesa (LOCAL) e delivery juntos; `origem` separa os dois.
  app.get('/cliente/historico', async (request: FastifyRequest, reply: FastifyReply) => {
    const user = request.user as JWTPayload

    const { origem, slug } = z
      .object({
        origem: z.enum(['LOCAL', 'DELIVERY']).optional(),
        slug: z.string().trim().min(1).max(100).optional(),
      })
      .parse(request.query)

    const pedidos = await service.historicoDoCliente(user.sub, { origem, slug })
    return reply.send(pedidos)
  })
}

export async function pedidosRoutes(app: FastifyInstance): Promise<void> {
  app.register(pedidosClienteRoutes)
  app.register(pedidosRestauranteRoutes)
}

/** Rotas do RESTAURANTE (token de usuário: ADMIN, ATENDENTE ou CAIXA) */
async function pedidosRestauranteRoutes(app: FastifyInstance): Promise<void> {

  app.addHook('onRequest', async (request, reply) => {
    await request.jwtVerify()
  })

    const exigirCliente = (request: FastifyRequest): JWTPayload => {
    const user = request.user as JWTPayload
    if (user.perfil !== 'CLIENTE') {
      throw new AppError('Esta rota é exclusiva para clientes', 403)
    }
    return user
  }

   // POST /publico/:slug — cliente envia o pedido
  app.post(
    '/publico/:slug',
    {
      config: {
        rateLimit: {
          max: 10,
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
      const user = exigirCliente(request)
      const { slug } = request.params as { slug: string }
      const data = criarPedidoClienteSchema.parse(request.body)

      const pedido = await pedidosCliente.criar(slug, data, user.sub)
      return reply.status(201).send(pedido)
    }
  )

  // GET /publico/:slug/meus — pedidos de entrega e retirada do cliente neste restaurante
  app.get('/publico/:slug/meus', async (request: FastifyRequest, reply: FastifyReply) => {
    const user = exigirCliente(request)
    const { slug } = request.params as { slug: string }

    return reply.send(await pedidosCliente.listar(slug, user.sub))
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

      const { status, modalidade, mesa_id, data_inicio, data_fim, conta_aberta } = request.query as {
        status?: string // um ou vários separados por vírgula: RECEBIDO,PREPARO,PRONTO
        modalidade?: string // MESA | ENTREGA | RETIRADA (a origem LOCAL/DELIVERY é derivada no front)
        mesa_id?: string
        data_inicio?: string
        data_fim?: string
        conta_aberta?: string // 'true' = só pedidos da conta aberta da mesa (Caixa)
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
        ...(conta_aberta === 'true' && { conta_aberta: true }),
        ...parsePeriodo(data_inicio, data_fim),
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

  // PATCH /:id/itens/status — Fila: avança UM OU MAIS itens do pedido para a próxima etapa
  app.patch(
    '/:id/itens/status',
    async (request: FastifyRequest, reply: FastifyReply) => {
      const user = request.user as JWTPayload

      if (!user.estabelecimento_id) {
        throw new AppError('Usuário não vinculado a um estabelecimento', 400)
      }

      const { id } = z
        .object({ id: z.string().uuid('ID do pedido inválido') })
        .parse(request.params)
      const data = z
        .object({
          item_ids: z.array(z.string().uuid('ID de item inválido')).min(1, 'Escolha pelo menos 1 item').max(100),
          status: z.enum(['PREPARO', 'PRONTO', 'ENTREGUE']),
        })
        .parse(request.body)

      const pedido = await service.atualizarStatusItens(id, data, user.estabelecimento_id)
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
