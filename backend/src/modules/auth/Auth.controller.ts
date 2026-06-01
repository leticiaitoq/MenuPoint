import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify'
import { AuthService } from './Auth.service'
import { AuthRepository } from './Auth.repository'
import {
  loginSchema,
  esqueciSenhaSchema,
  redefinirSenhaSchema,
  registrarSchema,
  refreshTokenSchema,
  JWTPayload,
} from './Auth.schema'

const repository = new AuthRepository()
const service = new AuthService(repository)


const RATE = {
  login: {
    max: 10,
    timeWindow: '1 minute',
    ban: 2,           // após 2 violações do limite, bloqueia por 10 minutos
    banTimeWindow: '10 minutes',
  },
  esqueciSenha: {
    max: 5,
    timeWindow: '1 hour',
  },
  register: {
    max: 5,
    timeWindow: '1 hour',
  },
  refresh: {
    max: 30,
    timeWindow: '1 minute',
  },
  redefinirSenha: {
    max: 10,
    timeWindow: '1 hour',
  },
} as const

export async function authRoutes(app: FastifyInstance): Promise<void> {

  // ── ROTAS PÚBLICAS ────────────────────────────────────────────────────────
  app.register(async (pub) => {

    // POST /auth/register
    // Limite: 5 registros por hora por IP
    pub.post(
      '/register',
      {
        config: {
          rateLimit: {
            max: RATE.register.max,
            timeWindow: RATE.register.timeWindow,
            errorResponseBuilder: (_req, context) => ({
              status: 'error',
              message: `Muitas tentativas de registro. Tente novamente em ${Math.ceil(Number(context.after) / 60000)} minuto(s).`,
              limite: context.max,
              resetEm: new Date(Date.now() + Number(context.ttl)).toISOString(),
            }),
          },
        },
      },
      async (request: FastifyRequest, reply: FastifyReply) => {
        const data = registrarSchema.parse(request.body)
        const result = await service.registrar(data, (p) => app.jwt.sign(p))
        return reply.status(201).send(result)
      }
    )

    // POST /auth/login
    // Limite: 10 tentativas por minuto por IP
    pub.post(
      '/login',
      {
        config: {
          rateLimit: {
            max: RATE.login.max,
            timeWindow: RATE.login.timeWindow,
            ban: RATE.login.ban,
            errorResponseBuilder: (_req, context) => ({
              status: 'error',
              message: context.ban
                ? `Muitas tentativas de login. IP bloqueado por 10 minutos.`
                : `Muitas tentativas de login. Tente novamente em 1 minuto.`,
              bloqueado: Boolean(context.ban),
              resetEm: new Date(Date.now() + Number(context.ttl)).toISOString(),
            }),
          },
        },
      },
      async (request: FastifyRequest, reply: FastifyReply) => {
        const data = loginSchema.parse(request.body)
        const result = await service.login(data, (p) => app.jwt.sign(p))
        return reply.status(200).send(result)
      }
    )

    pub.post(
      '/refresh',
      {
        config: {
          rateLimit: {
            max: RATE.refresh.max,
            timeWindow: RATE.refresh.timeWindow,
            errorResponseBuilder: () => ({
              status: 'error',
              message: 'Muitas renovações de token. Aguarde um momento.',
            }),
          },
        },
      },
      async (request: FastifyRequest, reply: FastifyReply) => {
        const data = refreshTokenSchema.parse(request.body)
        const result = await service.refreshToken(data, (p) => app.jwt.sign(p))
        return reply.status(200).send(result)
      }
    )

   pub.post(
      '/esqueci-senha',
      {
        config: {
          rateLimit: {
            max: RATE.esqueciSenha.max,
            timeWindow: RATE.esqueciSenha.timeWindow,
            errorResponseBuilder: (_req, context) => ({
              status: 'error',
              message: `Limite de recuperação de senha atingido. Tente novamente em ${Math.ceil(Number(context.after) / 3600000)} hora(s).`,
              resetEm: new Date(Date.now() + Number(context.ttl)).toISOString(),
            }),
          },
        },
      },
      async (request: FastifyRequest, reply: FastifyReply) => {
        const data = esqueciSenhaSchema.parse(request.body)
        await service.esqueciSenha(data)
        // Resposta sempre igual, independente do e-mail existir ou não.
        return reply.status(200).send({
          message: 'Se este e-mail estiver cadastrado, você receberá as instruções em breve.',
        })
      }
    )

    pub.post(
      '/redefinir-senha',
      {
        config: {
          rateLimit: {
            max: RATE.redefinirSenha.max,
            timeWindow: RATE.redefinirSenha.timeWindow,
            errorResponseBuilder: () => ({
              status: 'error',
              message: 'Muitas tentativas de redefinição de senha. Tente novamente mais tarde.',
            }),
          },
        },
      },
      async (request: FastifyRequest, reply: FastifyReply) => {
        const data = redefinirSenhaSchema.parse(request.body)
        await service.redefinirSenha(data)
        return reply.status(200).send({
          message: 'Senha redefinida com sucesso. Faça login com sua nova senha.',
        })
      }
    )
  pub.post('/logout', async (request, reply) => {
  const { refresh_token } = refreshTokenSchema.parse(request.body)
  await service.logout(refresh_token)
  return reply.status(204).send()
})
  })



  // ── ROTAS PRIVADAS ────────────────────────────────────────────────────────
  app.register(async (priv) => {
    priv.addHook('onRequest', async (request) => {
      await request.jwtVerify()
    })

    // GET /auth/me
    priv.get('/me', async (request: FastifyRequest, reply: FastifyReply) => {
      const {
        sub, nome, email, perfil, escopo, estabelecimento_id, empresa_id,
      } = request.user as JWTPayload

      return reply.status(200).send({
        usuario: { sub, nome, email, perfil, escopo, estabelecimento_id, empresa_id },
      })
    })
  })
}