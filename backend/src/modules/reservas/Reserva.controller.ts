import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify'
import { ReservaService } from './Reserva.service'
import { ReservaRepository } from './Reserva.repository'
import {
  criarReservaSchema,
  criarReservaClienteSchema,
  atualizarStatusReservaSchema,
  mesasDisponiveisQuerySchema,
  disponibilidadeQuerySchema,
  mensagemReservaSchema,
  criarReservaCaixaSchema,
} from './Reserva.schema'
import { AppError } from '@shared/errors/AppError'
import { chegadaPeloCaixa } from './Reserva.chegada'
import { JWTPayload } from '@modules/auth/Auth.schema'

const repository = new ReservaRepository()
const service = new ReservaService(repository)

export async function reservasRoutes(app: FastifyInstance): Promise<void> {

  app.addHook('onRequest', async (request) => {
    await request.jwtVerify()
  })

  // ── ROTAS DO CLIENTE (token com perfil CLIENTE) ───────────────────────────
  // O token do cliente não tem estabelecimento_id: o restaurante vem do slug na URL.
  // O app.ts libera só as rotas /reservas/publico/* para CLIENTE (GET e POST);
  // o resto continua só do restaurante.

  const exigirCliente = (request: FastifyRequest): JWTPayload => {
    const user = request.user as JWTPayload
    if (user.perfil !== 'CLIENTE') {
      throw new AppError('Esta rota é exclusiva para clientes', 403)
    }
    return user
  }

  // GET /publico/:slug/mesas-disponiveis?data_reserva=2026-11-10&hora_inicio=19:00&hora_fim=21:00&pessoas=4
  app.get('/publico/:slug/mesas-disponiveis', async (request: FastifyRequest, reply: FastifyReply) => {
    exigirCliente(request)

    const { slug } = request.params as { slug: string }
    const query = mesasDisponiveisQuerySchema.parse(request.query)

    const mesas = await service.mesasDisponiveis(slug, query)
    return reply.send(mesas)
  })

  // GET /publico/:slug/disponibilidade?data_reserva=2026-11-10&pessoas=4 — horários livres de cada mesa no dia
  app.get('/publico/:slug/disponibilidade', async (request: FastifyRequest, reply: FastifyReply) => {
    exigirCliente(request)

    const { slug } = request.params as { slug: string }
    const query = disponibilidadeQuerySchema.parse(request.query)

    const disponibilidade = await service.disponibilidadeDoDia(slug, query)
    return reply.send(disponibilidade)
  })

  // GET /publico/:slug/minhas — reservas do cliente logado neste restaurante (de hoje em diante)
  app.get('/publico/:slug/minhas', async (request: FastifyRequest, reply: FastifyReply) => {
    const user = exigirCliente(request)

    const { slug } = request.params as { slug: string }
    const reservas = await service.listarDoCliente(slug, user.sub)
    return reply.send(reservas)
  })

  // POST /publico/:slug — cliente cria a reserva (fica PENDENTE até o restaurante confirmar)
  app.post('/publico/:slug', async (request: FastifyRequest, reply: FastifyReply) => {
    const user = exigirCliente(request)

    const { slug } = request.params as { slug: string }
    const data = criarReservaClienteSchema.parse(request.body)

    const reserva = await service.criarParaCliente(slug, data, user.sub)
    return reply.status(201).send(reserva)
  })

  // POST /publico/:slug/:id/cancelar — cliente cancela a própria reserva
  // (POST e não DELETE porque o app.ts só libera GET/POST do cliente nesse prefixo)
  app.post('/publico/:slug/:id/cancelar', async (request: FastifyRequest, reply: FastifyReply) => {
    const user = exigirCliente(request)

    const { slug, id } = request.params as { slug: string; id: string }
    const reserva = await service.cancelarDoCliente(slug, id, user.sub)
    return reply.send(reserva)
  })

  // ── ROTAS DO RESTAURANTE ──────────────────────────────────────────────────

  // POST /caixa — o Caixa reserva uma mesa (dia, horário e descrição opcional); nasce CONFIRMADA
  app.post('/caixa', async (request: FastifyRequest, reply: FastifyReply) => {
    const user = request.user as JWTPayload

    if (!user.estabelecimento_id) {
      throw new AppError('Usuário não vinculado a um estabelecimento', 400)
    }

    const data = criarReservaCaixaSchema.parse(request.body)
    const reserva = await service.criarPeloCaixa(data, user.estabelecimento_id, user.sub)

    return reply.status(201).send(reserva)
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

  // POST /:id/chegada — o Caixa marcou "Cliente chegou": a reserva é concluída e a mesa fica
  // ocupada em nome de quem reservou (mesmo que ainda não tenha feito pedido)
  app.post('/:id/chegada', async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as { id: string }
    const user = request.user as JWTPayload
    if (!user.estabelecimento_id) {
      throw new AppError('Usuário não vinculado a um estabelecimento', 400)
    }
    return reply.send(await chegadaPeloCaixa(id, user.estabelecimento_id))
  })

  // POST /:id/mensagem — recado do restaurante ao cliente (e-mail + aviso no app)
  app.post('/:id/mensagem', async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as { id: string }
    const user = request.user as JWTPayload

    if (!user.estabelecimento_id) {
      throw new AppError('Usuário não vinculado a um estabelecimento', 400)
    }

    const data = mensagemReservaSchema.parse(request.body)
    const reserva = await service.enviarMensagem(id, data, user.estabelecimento_id)
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