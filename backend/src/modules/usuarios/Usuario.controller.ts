import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify'
import { UsuarioService } from './Usuario.service'
import { UsuarioRepository } from './Usuario.repository'
import {
  criarUsuarioSchema,
  atualizarUsuarioSchema,
} from './Usuario.schema'
import { JWTPayload } from '@modules/auth/Auth.schema'
import { AppError } from '@shared/errors/AppError'

const repository = new UsuarioRepository()
const service = new UsuarioService(repository)

export async function usuariosRoutes(app: FastifyInstance): Promise<void> {

  // Aplica autenticação em TODAS as rotas desse módulo
  app.addHook('onRequest', async (request, reply) => {
    await request.jwtVerify()
  })

  // Post
  app.post(
    '/',
    async (request: FastifyRequest, reply: FastifyReply) => {
      const user = request.user as JWTPayload

      if (user.perfil !== 'ADMIN') {
        throw new AppError('Apenas administradores podem criar usuários', 403)
      }

      const data = criarUsuarioSchema.parse(request.body)
      const usuario = await service.create(data)

      return reply.status(201).send(usuario)
    }
  )

  // Get
  app.get(
    '/',
    async (request: FastifyRequest, reply: FastifyReply) => {
      const user = request.user as JWTPayload

      // Usuário GLOBAL= vê todos da empresa
      // Usuário LOCAL = vê só os do seu estabelecimento
      if (user.escopo === 'GLOBAL' && user.empresa_id) {
        const usuarios = await service.listarPorEmpresa(user.empresa_id)
        return reply.send(usuarios)
      }

      if (user.estabelecimento_id) {
        const usuarios = await service.listarPorEstabelecimento(
          user.estabelecimento_id
        )
        return reply.send(usuarios)
      }

      throw new AppError('Não foi possível determinar o escopo do usuário', 400)
    }
  )

  // Get por Id
  app.get(
    '/:id',
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { id } = request.params as { id: string }
      const usuario = await service.findById(id)
      return reply.send(usuario)
    }
  )

  // ── Put
  app.put(
    '/:id',
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { id } = request.params as { id: string }
      const user = request.user as JWTPayload

      if (user.perfil !== 'ADMIN' && user.sub !== id) {
        throw new AppError('Sem permissão para atualizar este usuário', 403)
      }

      const data = atualizarUsuarioSchema.parse(request.body)
      const usuario = await service.update(id, data)

      return reply.send(usuario)
    }
  )

  // Delete (mas apenas desativa)
  app.delete(
    '/:id',
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { id } = request.params as { id: string }
      const user = request.user as JWTPayload

      if (user.perfil !== 'ADMIN') {
        throw new AppError('Apenas administradores podem desativar usuários', 403)
      }

      if (user.sub === id) {
        throw new AppError('Você não pode desativar sua própria conta', 400)
      }

      // Soft delete — Comando para marcar usuário como desativo
      await service.update(id, { ativo: false })

      return reply.status(204).send()
    }
  )
}