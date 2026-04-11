import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify'
import { AuthService } from './Auth.service'
import { AuthRepository } from './Auth.repository'
import {
  loginSchema,
  esqueciSenhaSchema,
  redefinirSenhaSchema,
  registrarSchema,
} from './Auth.schema'
import { JWTPayload } from './Auth.schema'

const repository = new AuthRepository()
const service = new AuthService(repository)

export async function authRoutes(app: FastifyInstance): Promise<void> {

  // ── ROTAS PÚBLICAS ───────────────────────────────────────────────────────
  app.register(async (publicRoutes) => {

    // POST /auth/register
    publicRoutes.post(
      '/register',
      async (request: FastifyRequest, reply: FastifyReply) => {
        const data = registrarSchema.parse(request.body)

        const result = await service.registrar(
          data,
          (payload: JWTPayload) => app.jwt.sign(payload)
        )

        return reply.status(201).send(result)
      }
    )

    // POST /auth/login
    publicRoutes.post(
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

    // POST /auth/esqueci-senha
    publicRoutes.post(
      '/esqueci-senha',
      async (request: FastifyRequest, reply: FastifyReply) => {
        const data = esqueciSenhaSchema.parse(request.body)

        await service.esqueciSenha(data)

        // Sempre retorna a mesma mensagem independente de o e-mail existir ou não
        return reply.status(200).send({
          message: 'Se este e-mail estiver cadastrado, você receberá as instruções em breve.',
        })
      }
    )

    // POST /auth/redefinir-senha
    publicRoutes.post(
      '/redefinir-senha',
      async (request: FastifyRequest, reply: FastifyReply) => {
        const data = redefinirSenhaSchema.parse(request.body)

        await service.redefinirSenha(data)

        return reply.status(200).send({
          message: 'Senha redefinida com sucesso. Faça login com sua nova senha.',
        })
      }
    )

  })

  // ── ROTAS PRIVADAS ───────────────────────────────────────────────────────
  app.register(async (privateRoutes) => {

    privateRoutes.addHook('onRequest', async (request, reply) => {
      await request.jwtVerify()
    })

    // GET /auth/me
    privateRoutes.get(
      '/me',
      async (request: FastifyRequest, reply: FastifyReply) => {
        const {
          sub, nome, email, perfil,
          escopo, estabelecimento_id, empresa_id,
        } = request.user as JWTPayload

        return reply.status(200).send({
          usuario: { sub, nome, email, perfil, escopo, estabelecimento_id, empresa_id },
        })
      }
    )

  })
}