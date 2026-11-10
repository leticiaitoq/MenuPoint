import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify'
import { z } from 'zod'
import { AppError } from '@shared/errors/AppError'
import { ClienteJWTPayload } from './Cliente.schema'
import { ClienteEnderecoService, criarEnderecoClienteSchema } from './ClienteEndereco.service'

const service = new ClienteEnderecoService()
const idSchema = z.object({ id: z.string().uuid('Endereço inválido') })

/**
 * Endereços de entrega do cliente logado.
 * Registrado em /api/v1/auth/cliente/enderecos (veja app.ts).
 */
export async function clienteEnderecosRoutes(app: FastifyInstance): Promise<void> {
  app.addHook('onRequest', async (request) => {
    await request.jwtVerify()
    const user = request.user as ClienteJWTPayload
    if (user.perfil !== 'CLIENTE') {
      throw new AppError('Esta rota é exclusiva para clientes', 403)
    }
  })

  const clienteId = (request: FastifyRequest) => (request.user as ClienteJWTPayload).sub

  // GET / — endereços salvos
  app.get('/', async (request: FastifyRequest, reply: FastifyReply) => {
    return reply.send(await service.listar(clienteId(request)))
  })

  // POST / — salva um novo endereço
  app.post('/', async (request: FastifyRequest, reply: FastifyReply) => {
    const data = criarEnderecoClienteSchema.parse(request.body)
    const endereco = await service.criar(clienteId(request), data)
    return reply.status(201).send(endereco)
  })

  // PUT /:id — edita um endereço salvo
  app.put('/:id', async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = idSchema.parse(request.params)
    const data = criarEnderecoClienteSchema.parse(request.body)
    return reply.send(await service.atualizar(clienteId(request), id, data))
  })

  // PATCH /:id/principal — marca como endereço principal
  app.patch('/:id/principal', async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = idSchema.parse(request.params)
    return reply.send(await service.definirPrincipal(clienteId(request), id))
  })

  // DELETE /:id — exclui um endereço salvo
  app.delete('/:id', async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = idSchema.parse(request.params)
    await service.excluir(clienteId(request), id)
    return reply.status(204).send()
  })
}
