import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify'
import { ReservaService } from './Reserva.service'
import { ReservaRepository } from './Reserva.repository'
import {
  criarReservaSchema,
  atualizarStatusReservaSchema,
  mesasDisponiveisQuerySchema,
} from './Reserva.schema'
import { AppError } from '@shared/errors/AppError'
import { JWTPayload } from '@modules/auth/Auth.schema'

const repository = new ReservaRepository()
const service = new ReservaService(repository)

export async function reservasRoutes(app: FastifyInstance): Promise<void> {

  app.addHook('onRequest', async (request) => {
    await request.jwtVerify()
  })

  // ── ROTAS DO CLIENTE (token com perfil CLIENTE) ───────────────────────────
  // O token do cliente não tem estabelecimento_id: o restaurante vem do slug na URL.
  // O app.ts libera só estas duas rotas para CLIENTE (o resto continua só do restaurante).

  const exigirCliente = (request: FastifyRequest) => {
    const user = request.user as JWTPayload
    if (user.perfil !== 'CLIENTE') {
      throw new AppError('Esta rota é exclusiva para clientes', 403)
    }
  }

  // GET /publico/:slug/mesas-disponiveis?data_reserva=2026-11-10&hora_inicio=19:00&hora_fim=21:00&pessoas=4
  app.get('/publico/:slug/mesas-disponiveis', async (request: FastifyRequest, reply: FastifyReply) => {
    exigirCliente(request)

    const { slug } = request.params as { slug: string }
    const query = mesasDisponiveisQuerySchema.parse(request.query)

    const mesas = await service.mesasDisponiveis(slug, query)
    return reply.send(mesas)
  })

  // POST /publico/:slug — cliente cria a reserva (fica PENDENTE até o restaurante confirmar)
  app.post('/publico/:slug', async (request: FastifyRequest, reply: FastifyReply) => {
    exigirCliente(request)

    const { slug } = request.params as { slug: string }
    const data = criarReservaSchema.parse(request.body)

    const reserva = await service.criarParaCliente(slug, data)
    return reply.status(201).send(reserva)
  })

  // ── ROTAS DO RESTAURANTE ──────────────────────────────────────────────────

  app.post('/', async (request: FastifyRequest, reply: FastifyReply) => {
    const user = request.user as JWTPayload

    if (!user.estabelecimento_id) {
      throw new AppError('Usuário não vinculado a um estabelecimento', 400)
    }

    const data = criarReservaSchema.parse(request.body)
    const reserva = await service.criar(data, user.estabelecimento_id)

    return reply.status(201).send(reserva)
  })


  app.get('/', async (request: FastifyRequest, reply: FastifyReply) => {
    const user = request.user as JWTPayload

    if (!user.estabelecimento_id) {
      throw new AppError('Usuário não vinculado a um estabelecimento', 400)
    }

    const { status, data_inicio, data_fim } = request.query as {
      status?: string
      data_inicio?: string
      data_fim?: string
    }

    const reservas = await service.listar(user.estabelecimento_id, {
      ...(status     && { status }),
      ...(data_inicio && { data_inicio: new Date(data_inicio) }),
      ...(data_fim    && { data_fim: new Date(data_fim) }),
    })

    return reply.send(reservas)
  })


  app.get('/:id', async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as { id: string }
    const user = request.user as JWTPayload

    if (!user.estabelecimento_id) {
      throw new AppError('Usuário não vinculado a um estabelecimento', 400)
    }

    const reserva = await service.findById(id, user.estabelecimento_id)
    return reply.send(reserva)
  })


  app.patch('/:id/status', async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as { id: string }
    const user = request.user as JWTPayload

    if (!user.estabelecimento_id) {
      throw new AppError('Usuário não vinculado a um estabelecimento', 400)
    }

    const data = atualizarStatusReservaSchema.parse(request.body)

    const reserva = await service.atualizarStatus(
      id,
      data,
      user.sub,         
      user.estabelecimento_id
    )

    return reply.send(reserva)
  })

  app.delete('/:id', async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as { id: string }
    const user = request.user as JWTPayload

    if (!user.estabelecimento_id) {
      throw new AppError('Usuário não vinculado a um estabelecimento', 400)
    }

    await service.cancelar(id, user.estabelecimento_id)
    return reply.status(204).send()
  })
}