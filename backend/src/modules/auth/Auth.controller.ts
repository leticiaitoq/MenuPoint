import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify'
import { AuthService } from './Auth.service'
import { AuthRepository } from './Auth.repository'
import { AppError } from '@shared/errors/AppError'
import {
  loginSchema,
  esqueciSenhaSchema,
  redefinirSenhaSchema,
  registrarSchema,
  refreshTokenSchema,
  verificarCodigoSchema,
  reenviarCodigoSchema,
  atualizarDadosSensiveisSchema,
  verificarSenhaSchema,
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
              statusCode: 429,
              status: 'error',
              message: `Muitas tentativas de registro. Tente novamente em ${Math.ceil(Number(context.ttl) / 60000)} minuto(s).`,
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
              statusCode: 429,
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
              statusCode: 429,
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
      '/verificar-codigo',
      {
        config: {
          rateLimit: {
            max: 8,
            timeWindow: '15 minutes',
            errorResponseBuilder: () => ({
              statusCode: 429,
              status: 'error',
              message: 'Muitas tentativas de verificação. Aguarde alguns minutos.',
            }),
          },
        },
      },
      async (request: FastifyRequest, reply: FastifyReply) => {
        const data = verificarCodigoSchema.parse(request.body)
        await service.verificarCodigo(data)
        return reply.status(200).send({ message: 'Código verificado com sucesso!' })
      }
    )

    pub.post(
      '/reenviar-codigo',
      {
        config: {
          rateLimit: {
            max: 3,
            timeWindow: '10 minutes',
            errorResponseBuilder: (_req, context) => ({
              statusCode: 429,
              status: 'error',
              message: `Muitas solicitações de reenvio. Tente novamente em ${Math.ceil(Number(context.ttl) / 60000)} minuto(s).`,
            }),
          },
        },
      },
      async (request: FastifyRequest, reply: FastifyReply) => {
        const data = reenviarCodigoSchema.parse(request.body)
        await service.reenviarCodigo(data)
        return reply.status(200).send({
          message: 'Se os dados estiverem corretos, um novo código foi enviado.',
        })
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
              statusCode: 429,
              status: 'error',
              message: `Limite de recuperação de senha atingido. Tente novamente em ${Math.ceil(Number(context.ttl) / 60000)} minuto(s).`,
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
              statusCode: 429,
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
    // Perfil do usuário logado — usuário, empresa e estabelecimento — lido do
    // BANCO (não do JWT). Assim a tela de perfil mostra o que realmente foi
    // cadastrado e dá para conferir o vínculo usuário → estabelecimento → empresa.
    // Também devolve um token novo com os dados atuais: sessões antigas (sem
    // estabelecimento_id, por exemplo) se "curam" sem exigir novo login.
    priv.get('/me', async (request: FastifyRequest, reply: FastifyReply) => {
      const { sub } = request.user as JWTPayload

      const dados = await repository.findPerfilPorId(sub)

      if (!dados) {
        throw new AppError('Usuário não encontrado', 404)
      }

      if (!dados.ativo) {
        throw new AppError('Usuário inativo', 401)
      }

      const { empresa, estabelecimento, ...usuario } = dados

      const payloadAtualizado: JWTPayload = {
        sub: usuario.id,
        nome: usuario.nome,
        email: usuario.email,
        perfil: usuario.perfil,
        escopo: usuario.escopo,
        estabelecimento_id: usuario.estabelecimento_id,
        empresa_id: usuario.empresa_id,
      }

      return reply.status(200).send({
        token: app.jwt.sign(payloadAtualizado),
        usuario: { ...usuario, sub: usuario.id },
        empresa,
        estabelecimento,
        // true = usuário → estabelecimento → empresa apontam uns para os outros.
        vinculo_ok: Boolean(
          empresa &&
            estabelecimento &&
            estabelecimento.empresa_id === empresa.id &&
            usuario.estabelecimento_id === estabelecimento.id
        ),
      })
    })
    // POST /auth/verificar-senha
    // Só confirma a senha atual (não altera nada). Usado antes de abrir a edição
    // de dados sensíveis, para o usuário não preencher tudo e só então descobrir
    // que errou a senha. Mesmo limite de tentativas da rota que altera de fato.
    priv.post(
      '/verificar-senha',
      {
        config: {
          rateLimit: {
            max: 5,
            timeWindow: '15 minutes',
            errorResponseBuilder: () => ({
              statusCode: 429,
              status: 'error',
              message: 'Muitas tentativas. Aguarde alguns minutos e tente novamente.',
            }),
          },
        },
      },
      async (request: FastifyRequest, reply: FastifyReply) => {
        const { sub } = request.user as JWTPayload
        const data = verificarSenhaSchema.parse(request.body)
        await service.verificarSenha(sub, data)
        return reply.status(200).send({ valido: true })
      }
    )

    // PUT /auth/me/dados
    // Altera nome do responsável, e-mail de acesso, razão social e nome da empresa.
    // Exige a senha atual. Limite: 5 tentativas a cada 15 minutos (evita adivinhar a senha).
    priv.put(
      '/me/dados',
      {
        config: {
          rateLimit: {
            max: 5,
            timeWindow: '15 minutes',
            errorResponseBuilder: () => ({
              statusCode: 429,
              status: 'error',
              message: 'Muitas tentativas. Aguarde alguns minutos e tente novamente.',
            }),
          },
        },
      },
      async (request: FastifyRequest, reply: FastifyReply) => {
        const { sub } = request.user as JWTPayload
        const data = atualizarDadosSensiveisSchema.parse(request.body)
        const resultado = await service.atualizarDadosSensiveis(sub, data, (p) => app.jwt.sign(p))
        return reply.status(200).send(resultado)
      }
    )
  })
}