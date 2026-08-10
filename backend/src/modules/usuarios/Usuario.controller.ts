import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify'
import { UsuarioService } from './Usuario.service'
import { UsuarioRepository } from './Usuario.repository'
import {
  criarUsuarioSchema,
  atualizarUsuarioSchema,
} from './Usuario.schema'
import { AppError } from '@shared/errors/AppError'
import { JWTPayload } from '@modules/auth/Auth.schema'
import { authenticate } from '@shared/middlewares/authenticate'
import { authorize } from '../../authorize'

const repository = new UsuarioRepository()
const service    = new UsuarioService(repository)

export async function usuariosRoutes(app: FastifyInstance): Promise<void> {

  app.post('/', async (request: FastifyRequest, reply: FastifyReply) => {
    const data    = criarUsuarioSchema.parse(request.body)
    const usuario = await service.create(data)
    return reply.status(201).send(usuario)
  })

  app.register(async (auth) => {
    auth.addHook('onRequest', authenticate)


    auth.get('/', async (request: FastifyRequest, reply: FastifyReply) => {
      const user = request.user as JWTPayload

      if (user.escopo === 'GLOBAL' && user.empresa_id) {
        return reply.send(await service.listarPorEmpresa(user.empresa_id))
      }

      if (user.estabelecimento_id) {
        return reply.send(
          await service.listarPorEstabelecimento(user.estabelecimento_id)
        )
      }

      throw new AppError('Não foi possível determinar o escopo do usuário', 400)
    })

    auth.get('/:id', async (request: FastifyRequest, reply: FastifyReply) => {
      const { id } = request.params as { id: string }
      return reply.send(await service.findById(id))
    })

    auth.put('/:id', async (request: FastifyRequest, reply: FastifyReply) => {
      const { id } = request.params as { id: string }
      const user   = request.user as JWTPayload

      if (user.perfil !== 'ADMIN' && user.sub !== id) {
        throw new AppError('Sem permissão para atualizar este usuário', 403)
      }

      const data    = atualizarUsuarioSchema.parse(request.body)
      const usuario = await service.update(id, data)
      return reply.send(usuario)
    })
  })

  app.register(async (adminRoutes) => {
    adminRoutes.addHook('onRequest', authorize('ADMIN'))

    adminRoutes.delete('/:id', async (request: FastifyRequest, reply: FastifyReply) => {
      const { id } = request.params as { id: string }
      const user   = request.user as JWTPayload

      if (user.sub === id) {
        throw new AppError('Você não pode desativar sua própria conta', 400)
      }

      await service.update(id, { ativo: false })
      return reply.status(204).send()
    })

    adminRoutes.patch(
      '/:id/reativar',
      async (request: FastifyRequest, reply: FastifyReply) => {
        const { id }  = request.params as { id: string }
        const usuario = await service.reativar(id)
        return reply.send(usuario)
      }
    )
  })
}