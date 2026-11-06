import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify'
import { CategoriaService } from './Categoria.service'
import { CategoriaRepository } from './Categoria.repository'
import {
  criarCategoriaSchema,
  atualizarCategoriaSchema,
} from './Categoria.schema'
import { AppError } from '@shared/errors/AppError'
import { JWTPayload } from '@modules/auth/Auth.schema'
import { authenticate } from '@shared/middlewares/authenticate'
import { authorize } from '../../authorize'
import { IngredienteCategoriaService, ingredienteCategoriaSchema } from './IngredienteCategoria.service'

import { z } from 'zod'

const repository = new CategoriaRepository()
const service    = new CategoriaService(repository)
const ingredientes = new IngredienteCategoriaService()

export async function categoriasRoutes(app: FastifyInstance): Promise<void> {

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
  app.register(async (auth) => {
    auth.addHook('onRequest', authenticate)

    // GET / — lista categorias do estabelecimento logado
    auth.get('/', async (request: FastifyRequest, reply: FastifyReply) => {
      const user = request.user as JWTPayload

      if (!user.estabelecimento_id) {
        throw new AppError('Usuário não vinculado a um estabelecimento', 400)
      }

      const categorias = await service.listarPorEstabelecimento(
        user.estabelecimento_id
      )
      return reply.send(categorias)
    })

    // GET /ingredientes/contagem — quantos ingredientes padrão cada categoria tem
    auth.get('/ingredientes/contagem', async (request: FastifyRequest, reply: FastifyReply) => {
      const user = request.user as JWTPayload
      if (!user.estabelecimento_id) {
        throw new AppError('Usuário não vinculado a um estabelecimento', 400)
      }
      return reply.send(await ingredientes.contagem(user.estabelecimento_id))
    })

    // GET /:categoria_id/ingredientes — ingredientes padrão da categoria
    auth.get('/:categoria_id/ingredientes', async (request: FastifyRequest, reply: FastifyReply) => {
      const { categoria_id } = request.params as { categoria_id: string }
      const user = request.user as JWTPayload
      if (!user.estabelecimento_id) {
        throw new AppError('Usuário não vinculado a um estabelecimento', 400)
      }
      return reply.send(await ingredientes.listar(categoria_id, user.estabelecimento_id))
    })

    auth.get('/:id', async (request: FastifyRequest, reply: FastifyReply) => {
      const { id } = request.params as { id: string }
      const categoria = await service.findById(id)
      return reply.send(categoria)
    })
  })

  app.register(async (adminRoutes) => {
    adminRoutes.addHook('onRequest', authorize('ADMIN'))

    adminRoutes.post('/', async (request: FastifyRequest, reply: FastifyReply) => {
      const user = request.user as JWTPayload

      if (!user.estabelecimento_id) {
        throw new AppError('Usuário não vinculado a um estabelecimento', 400)
      }

      const data      = criarCategoriaSchema.parse(request.body)
      const categoria = await service.create(
        { ...data, estabelecimento_id: user.estabelecimento_id },
        { estabelecimento_id: user.estabelecimento_id }
      )

      return reply.status(201).send(categoria)
    })

    adminRoutes.patch(
      '/reordenar',
      async (request: FastifyRequest, reply: FastifyReply) => {
        const user = request.user as JWTPayload

        if (!user.estabelecimento_id) {
          throw new AppError('Usuário não vinculado a um estabelecimento', 400)
        }

        const reordenarSchema = z
          .array(
            z.object({
              id:    z.string().uuid('ID inválido'),
              ordem: z.number().int().min(0),
            })
          )
          .min(1, 'Envie ao menos uma categoria para reordenar')

        const categorias = reordenarSchema.parse(request.body)

        await service.reordenar(categorias, {
          estabelecimento_id: user.estabelecimento_id,
        })

        return reply.status(200).send({
          message: 'Categorias reordenadas com sucesso',
        })
      }
    )

    adminRoutes.put(
      '/:id',
      async (request: FastifyRequest, reply: FastifyReply) => {
        const { id } = request.params as { id: string }
        const user   = request.user as JWTPayload

        if (!user.estabelecimento_id) {
          throw new AppError('Usuário não vinculado a um estabelecimento', 400)
        }

        const data      = atualizarCategoriaSchema.parse(request.body)
        const categoria = await service.update(id, data, {
          estabelecimento_id: user.estabelecimento_id,
        })

        return reply.send(categoria)
      }
    )

    adminRoutes.delete(
      '/:id',
      async (request: FastifyRequest, reply: FastifyReply) => {
        const { id } = request.params as { id: string }
        const user   = request.user as JWTPayload

        if (!user.estabelecimento_id) {
          throw new AppError('Usuário não vinculado a um estabelecimento', 400)
        }

        await service.delete(id, user.estabelecimento_id)
        return reply.status(204).send()
      }
    )

    // POST /:categoria_id/ingredientes — cria ingrediente padrão na categoria
    adminRoutes.post(
      '/:categoria_id/ingredientes',
      async (request: FastifyRequest, reply: FastifyReply) => {
        const { categoria_id } = request.params as { categoria_id: string }
        const user = request.user as JWTPayload
        if (!user.estabelecimento_id) {
          throw new AppError('Usuário não vinculado a um estabelecimento', 400)
        }
        const data = ingredienteCategoriaSchema.parse(request.body)
        const criado = await ingredientes.criar(categoria_id, data, user.estabelecimento_id)
        return reply.status(201).send(criado)
      }
    )

    // PUT /ingredientes/:id — edita
    adminRoutes.put(
      '/ingredientes/:id',
      async (request: FastifyRequest, reply: FastifyReply) => {
        const { id } = request.params as { id: string }
        const user = request.user as JWTPayload
        if (!user.estabelecimento_id) {
          throw new AppError('Usuário não vinculado a um estabelecimento', 400)
        }
        const data = ingredienteCategoriaSchema.parse(request.body)
        return reply.send(await ingredientes.atualizar(id, data, user.estabelecimento_id))
      }
    )

    // DELETE /ingredientes/:id — remove (os produtos que já importaram não mudam)
    adminRoutes.delete(
      '/ingredientes/:id',
      async (request: FastifyRequest, reply: FastifyReply) => {
        const { id } = request.params as { id: string }
        const user = request.user as JWTPayload
        if (!user.estabelecimento_id) {
          throw new AppError('Usuário não vinculado a um estabelecimento', 400)
        }
        await ingredientes.deletar(id, user.estabelecimento_id)
        return reply.status(204).send()
      }
    )

    adminRoutes.patch(
      '/:id/reativar',
      async (request: FastifyRequest, reply: FastifyReply) => {
        const { id } = request.params as { id: string }
        const user   = request.user as JWTPayload

        if (!user.estabelecimento_id) {
          throw new AppError('Usuário não vinculado a um estabelecimento', 400)
        }

        // Corpo opcional: { reativar_produtos: boolean }
        const { reativar_produtos } = z
          .object({ reativar_produtos: z.boolean().optional() })
          .parse(request.body ?? {})

        const categoria = await service.reativar(
          id,
          user.estabelecimento_id,
          reativar_produtos === true
        )
        return reply.send(categoria)
      }
    )
  })
}