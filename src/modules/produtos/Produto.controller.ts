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

const repository = new ProdutoRepository()
const service = new ProdutoService(repository)

export async function produtosRoutes(app: FastifyInstance): Promise<void> {

  app.addHook('onRequest', async (request, reply) => {
    await request.jwtVerify()
  })

  app.post(
    '/',
    async (request: FastifyRequest, reply: FastifyReply) => {
      const user = request.user as JWTPayload

      if (user.perfil !== 'ADMIN') {
        throw new AppError('Apenas administradores podem criar produtos', 403)
      }

      if (!user.estabelecimento_id) {
        throw new AppError('Usuário não vinculado a um estabelecimento', 400)
      }

      const data = criarProdutoSchema.parse(request.body)
      const produto = await service.create(data, user.estabelecimento_id)

      return reply.status(201).send(produto)
    }
  )

  app.get(
    '/',
    async (request: FastifyRequest, reply: FastifyReply) => {
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
          ...(disponivel !== undefined && {
            disponivel: disponivel === 'true',
          }),
          ...(destaque !== undefined && {
            destaque: destaque === 'true',
          }),
        }
      )

      return reply.send(produtos)
    }
  )

  app.get(
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

  app.patch(
    '/reordenar',
    async (request: FastifyRequest, reply: FastifyReply) => {
      const user = request.user as JWTPayload

      if (user.perfil !== 'ADMIN') {
        throw new AppError('Apenas administradores podem reordenar produtos', 403)
      }

      if (!user.estabelecimento_id) {
        throw new AppError('Usuário não vinculado a um estabelecimento', 400)
      }

      const produtos = reordenarProdutosSchema.parse(request.body)
      await service.reordenar(produtos, user.estabelecimento_id)

      return reply.send({ message: 'Produtos reordenados com sucesso' })
    }
  )

  app.get(
    '/:id',
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { id } = request.params as { id: string }
      const user = request.user as JWTPayload

      if (!user.estabelecimento_id) {
        throw new AppError('Usuário não vinculado a um estabelecimento', 400)
      }

      const produto = await service.findCompleto(id, user.estabelecimento_id)
      return reply.send(produto)
    }
  )

  app.put(
    '/:id',
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { id } = request.params as { id: string }
      const user = request.user as JWTPayload

      if (user.perfil !== 'ADMIN') {
        throw new AppError('Apenas administradores podem atualizar produtos', 403)
      }

      if (!user.estabelecimento_id) {
        throw new AppError('Usuário não vinculado a um estabelecimento', 400)
      }

      const data = atualizarProdutoSchema.parse(request.body)
      const produto = await service.update(id, data, user.estabelecimento_id)

      return reply.send(produto)
    }
  )

  app.patch(
    '/:id/disponibilidade',
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { id } = request.params as { id: string }
      const user = request.user as JWTPayload

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

  app.delete(
    '/:id',
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { id } = request.params as { id: string }
      const user = request.user as JWTPayload

      if (user.perfil !== 'ADMIN') {
        throw new AppError('Apenas administradores podem desativar produtos', 403)
      }

      if (!user.estabelecimento_id) {
        throw new AppError('Usuário não vinculado a um estabelecimento', 400)
      }

      await service.remove(id, user.estabelecimento_id)
      return reply.status(204).send()
    }
  )
}