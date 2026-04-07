import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify'
import { CategoriaService } from './Categoria.service'
import { CategoriaRepository } from './Categoria.repository'
import {
  criarCategoriaSchema,
  atualizarCategoriaSchema,
} from './Categoria.schema'
import { AppError } from '@shared/errors/AppError'
import { JWTPayload } from '@modules/auth/Auth.schema'
import { z } from 'zod'
import { authenticate } from '@shared/middlewares/authenticate'


const repository = new CategoriaRepository()
const service = new CategoriaService(repository)

export async function categoriasRoutes(
  app: FastifyInstance
): Promise<void> {

  // ROTA PÚBLICA —  rota que o cliente usa ao abrir o cardápio pelo QR Code
  app.get(
    '/publico/:estabelecimento_id',
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { estabelecimento_id } = request.params as {
        estabelecimento_id: string
      }

      const categorias = await service.listarComProdutos(estabelecimento_id)
      return reply.send(categorias)
    }
  )

  //ROTAS PRIVADAS

  app.post(
    '/',
    { preHandler: [authenticate] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const user = request.user as JWTPayload

      if (user.perfil !== 'ADMIN') {
        throw new AppError('Apenas administradores podem criar categorias', 403)
      }

      if (!user.estabelecimento_id) {
        throw new AppError('Usuário não vinculado a um estabelecimento', 400)
      }

      const data = criarCategoriaSchema.parse(request.body)
      const categoria = await service.create(
        { ...data, estabelecimento_id: user.estabelecimento_id },
        { estabelecimento_id: user.estabelecimento_id }
      )

      return reply.status(201).send(categoria)
    }
  )


  app.get(
    '/',
    { preHandler: [authenticate] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const user = request.user as JWTPayload

      if (!user.estabelecimento_id) {
        throw new AppError('Usuário não vinculado a um estabelecimento', 400)
      }

      const categorias = await service.listarPorEstabelecimento(
        user.estabelecimento_id
      )
      return reply.send(categorias)
    }
  )

    // Reordenar as categorias
  app.patch(
    '/reordenar',
    { preHandler: [authenticate] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const user = request.user as JWTPayload

      if (user.perfil !== 'ADMIN') {
        throw new AppError('Apenas administradores podem reordenar categorias', 403)
      }

      if (!user.estabelecimento_id) {
        throw new AppError('Usuário não vinculado a um estabelecimento', 400)
      }
      const reordenarSchema = z.array(
        z.object({
          id: z.string().uuid('ID inválido'),
          ordem: z.number().int().min(0),
        })
      ).min(1, 'Envie ao menos uma categoria para reordenar')

      const categorias = reordenarSchema.parse(request.body)

      await service.reordenar(
        categorias,
        { estabelecimento_id: user.estabelecimento_id }
      )

      return reply.status(200).send({ message: 'Categorias reordenadas com sucesso' })
    }
  )

  app.get(
    '/:id',
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { id } = request.params as { id: string }
      const categoria = await service.findById(id)
      return reply.send(categoria)
    }
  )

  app.put(
    '/:id',
    { preHandler: [authenticate] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { id } = request.params as { id: string }
      const user = request.user as JWTPayload

      if (user.perfil !== 'ADMIN') {
        throw new AppError(
          'Apenas administradores podem atualizar categorias',
          403
        )
      }

      if (!user.estabelecimento_id) {
        throw new AppError('Usuário não vinculado a um estabelecimento', 400)
      }

      const data = atualizarCategoriaSchema.parse(request.body)
      const categoria = await service.update(
        id,
        data,
        { estabelecimento_id: user.estabelecimento_id }
      )
      
      return reply.send(categoria)
    }
  )

  app.delete(
    '/:id',
    { preHandler: [authenticate] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { id } = request.params as { id: string }
      const user = request.user as JWTPayload

      if (user.perfil !== 'ADMIN') {
        throw new AppError(
          'Apenas administradores podem desativar categorias',
          403
        )
      }

      if (!user.estabelecimento_id) {
        throw new AppError('Usuário não vinculado a um estabelecimento', 400)
      }

      await service.delete(id, user.estabelecimento_id)

      return reply.status(204).send()
    }
  )
}