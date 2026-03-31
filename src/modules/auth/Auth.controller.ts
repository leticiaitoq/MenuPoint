import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify'
import { AuthService } from './Auth.service'
import { AuthRepository } from './Auth.repository'
import { loginSchema } from './Auth.schema'
import { JWTPayload } from './Auth.schema'

// Instancia o Repository para injetar no Service
const repository = new AuthRepository()
const service = new AuthService(repository)

// Registra as rotas
export async function authRoutes(app: FastifyInstance): Promise<void> {

  //Post
  app.post(
    '/login',
    async (request: FastifyRequest, reply: FastifyReply) => {
      const data = loginSchema.parse(request.body)
      const result = await service.login(
        data,
        (payload: JWTPayload) => app.jwt.sign(payload)
      )

      return reply.status(200).send(result)
    }
  )

  // Get
  app.get(
    '/me',
    {
      onRequest: [async (request, reply) => {
        await request.jwtVerify()
      }],
    },
    async (request: FastifyRequest, reply: FastifyReply) => {

      const usuario = request.user as JWTPayload

      return reply.status(200).send({ usuario })
    }
  )
}