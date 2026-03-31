import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify'
import { EstabelecimentoService } from './Estabelecimento.service'
import { EstabelecimentoRepository } from './Estabelecimento.repository'
import {
  criarEstabelecimentoSchema,
  atualizarEstabelecimentoSchema,
} from './Estabelecimento.schema'
import { AppError } from '@shared/errors/AppError'
import { JWTPayload } from '@modules/auth/Auth.schema'
import { authenticate } from '@shared/middlewares/authenticate'

const repository = new EstabelecimentoRepository()
const service = new EstabelecimentoService(repository)

export async function estabelecimentosRoutes(app: FastifyInstance) {

  // 🚀 ROTA PÚBLICA
  app.get('/publico/:slug', async (request, reply) => {
    const { slug } = request.params as { slug: string }
    const estabelecimento = await service.findBySlugPublico(slug)
    return reply.send(estabelecimento)
  })

  // 🔒 ROTAS PRIVADAS
  app.post(
    '/',
    { preHandler: [authenticate] },
    async (request, reply) => {
      const user = request.user as JWTPayload

      if (user.perfil !== 'ADMIN') {
        throw new AppError('Apenas administradores podem criar estabelecimentos', 403)
      }

      const data = criarEstabelecimentoSchema.parse(request.body)
      const estabelecimento = await service.create(data)

      return reply.status(201).send(estabelecimento)
    }
  )

  app.get(
    '/',
    { preHandler: [authenticate] },
    async (request, reply) => {
      const user = request.user as JWTPayload

      if (user.escopo === 'GLOBAL' && user.empresa_id) {
        const lista = await service.listarPorEmpresa(user.empresa_id)
        return reply.send(lista)
      }

      if (user.estabelecimento_id) {
        const estabelecimento = await service.findByIdCompleto(user.estabelecimento_id)
        return reply.send([estabelecimento])
      }

      throw new AppError('Não foi possível determinar o escopo', 400)
    }
  )

  app.get(
    '/:id',
   { preHandler: [authenticate] },
    async (request, reply) => {
      const { id } = request.params as { id: string }
      const user = request.user as JWTPayload

      if (user.escopo === 'LOCAL' && user.estabelecimento_id !== id) {
        throw new AppError('Acesso não autorizado', 403)
      }

      const estabelecimento = await service.findByIdCompleto(id)
      return reply.send(estabelecimento)
    }
  )

  app.put(
    '/:id',
    { preHandler: [authenticate] },
    async (request, reply) => {
      const { id } = request.params as { id: string }
      const user = request.user as JWTPayload

      if (user.escopo === 'LOCAL' && user.estabelecimento_id !== id) {
        throw new AppError('Acesso não autorizado', 403)
      }

      if (user.perfil !== 'ADMIN') {
        throw new AppError('Apenas administradores podem atualizar estabelecimentos', 403)
      }

      const data = atualizarEstabelecimentoSchema.parse(request.body)
      const estabelecimento = await service.update(id, data)

      return reply.send(estabelecimento)
    }
  )

  app.delete(
    '/:id',
    { preHandler: [authenticate] },
    async (request, reply) => {
      const { id } = request.params as { id: string }
      const user = request.user as JWTPayload

      if (user.perfil !== 'ADMIN') {
        throw new AppError('Apenas administradores podem desativar estabelecimentos', 403)
      }

      await service.desativar(id)
      return reply.status(204).send()
    }
  )
}