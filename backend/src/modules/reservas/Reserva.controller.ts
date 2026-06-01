import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify'
import { ReservaService } from './Reserva.service'
import { ReservaRepository } from './Reserva.repository'
import { criarReservaSchema, atualizarStatusReservaSchema } from './Reserva.schema'
import { AppError } from '@shared/errors/AppError'
import { JWTPayload } from '@modules/auth/Auth.schema'

const repository = new ReservaRepository()
const service = new ReservaService(repository)

export async function reservasRoutes(app: FastifyInstance): Promise<void> {

  app.addHook('onRequest', async (request) => {
    await request.jwtVerify()
  })

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