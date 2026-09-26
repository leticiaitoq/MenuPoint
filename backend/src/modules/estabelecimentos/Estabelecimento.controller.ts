import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify'
import { EstabelecimentoService } from './Estabelecimento.service'
import { EstabelecimentoRepository } from './Estabelecimento.repository'
import {
  criarEstabelecimentoSchema,
  atualizarEstabelecimentoSchema,
  atualizarPixSchema,
} from './Estabelecimento.schema'
import { AppError } from '@shared/errors/AppError'
import { JWTPayload } from '@modules/auth/Auth.schema'
import { authenticate } from '@shared/middlewares/authenticate'

const repository = new EstabelecimentoRepository()
const service = new EstabelecimentoService(repository)

export async function estabelecimentosRoutes(app: FastifyInstance) {

  // Rota Pública
  app.get('/publico/:slug', async (request, reply) => {
    const { slug } = request.params as { slug: string }
    const estabelecimento = await service.findBySlugPublico(slug)
    return reply.send(estabelecimento)
  })

  // Rotas Privadas
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

  // PATCH /:id/pix — chave PIX é dado sensível: exige senha atual e só o
  // dono da empresa (ADMIN + escopo GLOBAL) pode alterar.
  app.patch(
    '/:id/pix',
    { preHandler: [authenticate] },
    async (request, reply) => {
      const { id } = request.params as { id: string }
      const user = request.user as JWTPayload

      if (user.escopo === 'LOCAL' && user.estabelecimento_id !== id) {
        throw new AppError('Acesso não autorizado', 403)
      }

      const data = atualizarPixSchema.parse(request.body)
      const estabelecimento = await service.atualizarPix(
        id,
        { id: user.sub, perfil: user.perfil, escopo: user.escopo },
        data
      )

      return reply.send(estabelecimento)
    }
  )

  // POST /estabelecimentos/:id/logo — multipart (campo "arquivo"), JPG/PNG até 5MB
  app.post(
    '/:id/logo',
    { preHandler: [authenticate] },
    async (request, reply) => {
      const { id } = request.params as { id: string }
      const user = request.user as JWTPayload

      if (user.escopo === 'LOCAL' && user.estabelecimento_id !== id) {
        throw new AppError('Acesso não autorizado', 403)
      }

      if (user.perfil !== 'ADMIN') {
        throw new AppError('Apenas administradores podem alterar a logo', 403)
      }

      const arquivo = await request.file()
      if (!arquivo) {
        throw new AppError('Envie uma imagem', 400)
      }

      let buffer: Buffer
      try {
        buffer = await arquivo.toBuffer()
      } catch (err: any) {
        if (err?.code === 'FST_REQ_FILE_TOO_LARGE') {
          throw new AppError('Imagem muito grande (máximo 5MB)', 413)
        }
        throw err
      }

      const logo_url = await service.atualizarLogo(id, { buffer, mimetype: arquivo.mimetype })
      return reply.send({ logo_url })
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

  app.patch(
    '/:id/reativar',
    { preHandler: [authenticate] },
    async (request, reply) => {
      const { id } = request.params as { id: string }
      const user = request.user as JWTPayload

      if (user.perfil !== 'ADMIN') {
        throw new AppError('Apenas administradores podem reativar estabelecimentos', 403)
      }

      const estabelecimento = await service.reativar(id)
      return reply.send(estabelecimento)
    }
  )
}