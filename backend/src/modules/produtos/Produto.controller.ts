import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify'
import { ProdutoService } from './Produto.service'
import { ProdutoRepository } from './Produto.repository'
import {
  criarProdutoSchema,
  atualizarProdutoSchema,
  reordenarProdutosSchema,
} from './Produto.schema'
import { AppError } from '@shared/errors/AppError'
import { JWTPayload } from '@modules/auth/Auth.schema'
import { authenticate } from '@shared/middlewares/authenticate'
import { authorize } from '../../authorize'


const repository = new ProdutoRepository()
const service    = new ProdutoService(repository)

export async function produtosRoutes(app: FastifyInstance): Promise<void> {

  app.register(async (auth) => {
    auth.addHook('onRequest', authenticate)

    auth.get('/', async (request: FastifyRequest, reply: FastifyReply) => {
      const user = request.user as JWTPayload

      if (!user.estabelecimento_id) {
        throw new AppError('Usuário não vinculado a um estabelecimento', 400)
      }

      const { categoria_id, disponivel, destaque } = request.query as {
        categoria_id?: string
        disponivel?: string
        destaque?: string
      }

      const produtos = await service.listarPorEstabelecimento(
        user.estabelecimento_id,
        {
          ...(categoria_id && { categoria_id }),
          ...(disponivel !== undefined && { disponivel: disponivel === 'true' }),
          ...(destaque   !== undefined && { destaque:   destaque   === 'true' }),
        }
      )

      return reply.send(produtos)
    })

    auth.get(
      '/mais-vendidos',
      async (request: FastifyRequest, reply: FastifyReply) => {
        const user = request.user as JWTPayload

        if (!user.estabelecimento_id) {
          throw new AppError('Usuário não vinculado a um estabelecimento', 400)
        }

        const { limite } = request.query as { limite?: string }

        const produtos = await service.maisVendidos(
          user.estabelecimento_id,
          limite ? Number(limite) : undefined
        )

        return reply.send(produtos)
      }
    )

    auth.get('/:id', async (request: FastifyRequest, reply: FastifyReply) => {
      const { id } = request.params as { id: string }
      const user   = request.user as JWTPayload

      if (!user.estabelecimento_id) {
        throw new AppError('Usuário não vinculado a um estabelecimento', 400)
      }

      const produto = await service.findCompleto(id, user.estabelecimento_id)
      return reply.send(produto)
    })

    auth.patch(
      '/:id/disponibilidade',
      async (request: FastifyRequest, reply: FastifyReply) => {
        const { id } = request.params as { id: string }
        const user   = request.user as JWTPayload

        if (!user.estabelecimento_id) {
          throw new AppError('Usuário não vinculado a um estabelecimento', 400)
        }

        const produto = await service.alternarDisponibilidade(
          id,
          user.estabelecimento_id
        )

        return reply.send(produto)
      }
    )
  })

  app.register(async (adminRoutes) => {
    adminRoutes.addHook('onRequest', authorize('ADMIN'))

    // POST / — cria produto
    adminRoutes.post('/', async (request: FastifyRequest, reply: FastifyReply) => {
      const user = request.user as JWTPayload

      if (!user.estabelecimento_id) {
        throw new AppError('Usuário não vinculado a um estabelecimento', 400)
      }

      const data    = criarProdutoSchema.parse(request.body)
      const produto = await service.create(data, user.estabelecimento_id)

      return reply.status(201).send(produto)
    })

    adminRoutes.patch(
      '/reordenar',
      async (request: FastifyRequest, reply: FastifyReply) => {
        const user = request.user as JWTPayload

        if (!user.estabelecimento_id) {
          throw new AppError('Usuário não vinculado a um estabelecimento', 400)
        }

        const produtos = reordenarProdutosSchema.parse(request.body)
        await service.reordenar(produtos, user.estabelecimento_id)

        return reply.send({ message: 'Produtos reordenados com sucesso' })
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

        const data    = atualizarProdutoSchema.parse(request.body)
        const produto = await service.update(id, data, user.estabelecimento_id)

        return reply.send(produto)
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

        await service.remove(id, user.estabelecimento_id)
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

        const produto = await service.reativar(id, user.estabelecimento_id)
        return reply.send(produto)
      }
    )
  })
}