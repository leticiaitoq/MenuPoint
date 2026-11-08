import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify'
import { PagamentoService } from './Pagamento.service'
import { PagamentoRepository } from './Pagamento.repository'
import {
  criarPagamentoSchema,
  confirmarPagamentoSchema,
  estornarPagamentoSchema,
  finalizarMesaSchema,
  pagamentoParcialSchema,
  abatimentoSchema,
} from './Pagamento.schema'
import { AppError } from '@shared/errors/AppError'
import { JWTPayload } from '@modules/auth/Auth.schema'
import { z } from 'zod'
import { parsePeriodo } from '@shared/utils/periodo'
import { PagamentoMesaService } from './PagamentoMesa.service'

const repository = new PagamentoRepository()
const service = new PagamentoService(repository)
const mesaService = new PagamentoMesaService()

export async function pagamentosRoutes(app: FastifyInstance): Promise<void> {

  app.addHook('onRequest', async (request, reply) => {
    await request.jwtVerify()
  })

  // POST / — registra pagamento de um pedido
  app.post(
    '/',
    async (request: FastifyRequest, reply: FastifyReply) => {
      const user = request.user as JWTPayload

      if (!user.estabelecimento_id) {
        throw new AppError('Usuário não vinculado a um estabelecimento', 400)
      }

      const data = criarPagamentoSchema.parse(request.body)
      const pagamento = await service.criar(data, user.estabelecimento_id)

      return reply.status(201).send(pagamento)
    }
  )

  // ── Pagamentos parciais da mesa (Caixa) ─────────────────────────────────────

  const caixa = (request: FastifyRequest) => {
    const user = request.user as JWTPayload
    if (!user.estabelecimento_id) {
      throw new AppError('Usuário não vinculado a um estabelecimento', 400)
    }
    if (user.perfil !== 'ADMIN' && user.perfil !== 'CAIXA') {
      throw new AppError('Apenas ADMIN ou CAIXA podem registrar pagamentos', 403)
    }
    return { user, estabelecimento_id: user.estabelecimento_id }
  }
  const mesaIdSchema = z.object({ mesa_id: z.string().uuid('mesa_id inválido') })

  // GET /mesa/:mesa_id/resumo — conta da mesa: itens, o que já foi pago e o saldo
  app.get('/mesa/:mesa_id/resumo', async (request: FastifyRequest, reply: FastifyReply) => {
    const { estabelecimento_id } = caixa(request)
    const { mesa_id } = mesaIdSchema.parse(request.params)
    return reply.send(await mesaService.resumo(mesa_id, estabelecimento_id))
  })

  // POST /mesa/:mesa_id/parcial — paga só os itens escolhidos
  app.post('/mesa/:mesa_id/parcial', async (request: FastifyRequest, reply: FastifyReply) => {
    const { user, estabelecimento_id } = caixa(request)
    const { mesa_id } = mesaIdSchema.parse(request.params)
    const data = pagamentoParcialSchema.parse(request.body)
    const r = await mesaService.registrar(mesa_id, 'PARCIAL', data, user.sub, estabelecimento_id)
    return reply.status(201).send(r)
  })

  // POST /mesa/:mesa_id/abater — abate um valor da conta (itens opcionais)
  app.post('/mesa/:mesa_id/abater', async (request: FastifyRequest, reply: FastifyReply) => {
    const { user, estabelecimento_id } = caixa(request)
    const { mesa_id } = mesaIdSchema.parse(request.params)
    const data = abatimentoSchema.parse(request.body)
    const r = await mesaService.registrar(mesa_id, 'ABATIMENTO', data, user.sub, estabelecimento_id)
    return reply.status(201).send(r)
  })

  // DELETE /mesa/:mesa_id/parcial/:id — desfaz um pagamento parcial ainda não liquidado
  app.delete('/mesa/:mesa_id/parcial/:id', async (request: FastifyRequest, reply: FastifyReply) => {
    const { estabelecimento_id } = caixa(request)
    const { mesa_id, id } = z
      .object({ mesa_id: z.string().uuid(), id: z.string().uuid() })
      .parse(request.params)
    return reply.send(await mesaService.desfazer(mesa_id, id, estabelecimento_id))
  })

  // POST /mesa/:mesa_id/finalizar — Caixa: paga a conta INTEIRA da mesa (CAIXA ou ADMIN)
  app.post(
    '/mesa/:mesa_id/finalizar',
    async (request: FastifyRequest, reply: FastifyReply) => {
      const user = request.user as JWTPayload

      if (!user.estabelecimento_id) {
        throw new AppError('Usuário não vinculado a um estabelecimento', 400)
      }
      if (user.perfil !== 'ADMIN' && user.perfil !== 'CAIXA') {
        throw new AppError('Apenas ADMIN ou CAIXA podem registrar pagamentos', 403)
      }

      const { mesa_id } = z
        .object({ mesa_id: z.string().uuid('mesa_id inválido') })
        .parse(request.params)
      const data = finalizarMesaSchema.parse(request.body)

      const resultado = await service.finalizarMesa(
        mesa_id,
        data,
        user.sub,
        user.estabelecimento_id
      )
      return reply.send(resultado)
    }
  )

  // GET / — lista pagamentos com filtros opcionais
  app.get(
    '/',
    async (request: FastifyRequest, reply: FastifyReply) => {
      const user = request.user as JWTPayload

      if (!user.estabelecimento_id) {
        throw new AppError('Usuário não vinculado a um estabelecimento', 400)
      }

      const { status, metodo, data_inicio, data_fim } = request.query as {
        status?: string
        metodo?: string
        data_inicio?: string
        data_fim?: string
      }

      const pagamentos = await service.listar(user.estabelecimento_id, {
        ...(status && { status }),
        ...(metodo && { metodo }),
        ...parsePeriodo(data_inicio, data_fim),
      })

      return reply.send(pagamentos)
    }
  )

  // GET /pedido/:pedido_id — busca pagamento pelo ID do pedido
  app.get(
    '/pedido/:pedido_id',
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { pedido_id } = request.params as { pedido_id: string }
      const user = request.user as JWTPayload

      if (!user.estabelecimento_id) {
        throw new AppError('Usuário não vinculado a um estabelecimento', 400)
      }

      const pagamento = await service.findByPedido(
        pedido_id,
        user.estabelecimento_id
      )
      return reply.send(pagamento)
    }
  )

  // GET /:id — busca pagamento por ID
  app.get(
    '/:id',
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { id } = request.params as { id: string }
      const user = request.user as JWTPayload

      if (!user.estabelecimento_id) {
        throw new AppError('Usuário não vinculado a um estabelecimento', 400)
      }

      const pagamento = await service.findById(id, user.estabelecimento_id)
      return reply.send(pagamento)
    }
  )

  // PATCH /:id/confirmar — confirma o pagamento (CAIXA ou ADMIN)
  app.patch(
    '/:id/confirmar',
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { id } = request.params as { id: string }
      const user = request.user as JWTPayload

      if (!user.estabelecimento_id) {
        throw new AppError('Usuário não vinculado a um estabelecimento', 400)
      }

      if (user.perfil !== 'ADMIN' && user.perfil !== 'CAIXA') {
        throw new AppError('Apenas ADMIN ou CAIXA podem confirmar pagamentos', 403)
      }

      const data = confirmarPagamentoSchema.parse(request.body)
      const pagamento = await service.confirmar(
        id,
        data,
        user.sub,
        user.estabelecimento_id
      )

      return reply.send(pagamento)
    }
  )

  // PATCH /:id/estornar — estorna pagamento (apenas ADMIN)
  app.patch(
    '/:id/estornar',
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { id } = request.params as { id: string }
      const user = request.user as JWTPayload

      if (user.perfil !== 'ADMIN') {
        throw new AppError('Apenas administradores podem estornar pagamentos', 403)
      }

      if (!user.estabelecimento_id) {
        throw new AppError('Usuário não vinculado a um estabelecimento', 400)
      }

      const data = estornarPagamentoSchema.parse(request.body)
      const pagamento = await service.estornar(
        id,
        data,
        user.estabelecimento_id
      )

      return reply.send(pagamento)
    }
  )
}
