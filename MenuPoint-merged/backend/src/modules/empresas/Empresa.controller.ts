import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify'
import { EmpresaService } from './Empresa.service'
import { EmpresaRepository } from './Empresa.repository'
import { criarEmpresaSchema, atualizarEmpresaSchema } from './Empresa.schema'
import { AppError } from '@shared/errors/AppError'
import { JWTPayload } from '@modules/auth/Auth.schema'
import { authenticate } from '@shared/middlewares/authenticate'

const repository = new EmpresaRepository()
const service = new EmpresaService(repository)

export async function empresasRoutes(app: FastifyInstance): Promise<void> {

  // Todas as rotas de empresa exigem autenticação
  app.addHook('onRequest', async (request, reply) => {
    await request.jwtVerify()
  })

  // POST / — cria uma empresa (apenas ADMINs com escopo GLOBAL)
  app.post(
    '/',
    async (request: FastifyRequest, reply: FastifyReply) => {
      const user = request.user as JWTPayload

      if (user.perfil !== 'ADMIN' || user.escopo !== 'GLOBAL') {
        throw new AppError('Apenas administradores globais podem criar empresas', 403)
      }

      const data = criarEmpresaSchema.parse(request.body)
      const empresa = await service.create(data)

      return reply.status(201).send(empresa)
    }
  )

  // GET / — lista todas as empresas ativas (escopo GLOBAL)
  app.get(
    '/',
    async (request: FastifyRequest, reply: FastifyReply) => {
      const user = request.user as JWTPayload

      if (user.escopo !== 'GLOBAL') {
        throw new AppError('Acesso restrito a administradores globais', 403)
      }

      const empresas = await service.listarTodas()
      return reply.send(empresas)
    }
  )

  // GET /:id — busca empresa com estabelecimentos
  app.get(
    '/:id',
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { id } = request.params as { id: string }
      const user = request.user as JWTPayload

      // Escopo LOCAL só pode ver a própria empresa
      if (user.escopo === 'LOCAL' && user.empresa_id !== id) {
        throw new AppError('Acesso não autorizado', 403)
      }

      const empresa = await service.buscarComDetalhes(id)
      return reply.send(empresa)
    }
  )

  // PUT /:id — atualiza empresa
  app.put(
    '/:id',
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { id } = request.params as { id: string }
      const user = request.user as JWTPayload

      if (user.perfil !== 'ADMIN') {
        throw new AppError('Apenas administradores podem atualizar empresas', 403)
      }

      if (user.escopo === 'LOCAL' && user.empresa_id !== id) {
        throw new AppError('Acesso não autorizado', 403)
      }

      const data = atualizarEmpresaSchema.parse(request.body)
      const empresa = await service.update(id, data)

      return reply.send(empresa)
    }
  )

  // DELETE /:id — desativa empresa (soft delete)
  app.delete(
    '/:id',
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { id } = request.params as { id: string }
      const user = request.user as JWTPayload

      if (user.perfil !== 'ADMIN' || user.escopo !== 'GLOBAL') {
        throw new AppError('Apenas administradores globais podem desativar empresas', 403)
      }

      await service.desativar(id)
      return reply.status(204).send()
    }
  )

  // PATCH /:id/reativar — reativa empresa desativada
  app.patch(
    '/:id/reativar',
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { id } = request.params as { id: string }
      const user = request.user as JWTPayload

      if (user.perfil !== 'ADMIN' || user.escopo !== 'GLOBAL') {
        throw new AppError('Apenas administradores globais podem reativar empresas', 403)
      }

      const empresa = await service.reativar(id)
      return reply.send(empresa)
    }
  )
}
