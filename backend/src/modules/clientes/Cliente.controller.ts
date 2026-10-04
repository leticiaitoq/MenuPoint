import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify'
import { ClienteService } from './Cliente.service'
import { ClienteRepository } from './Cliente.repository'
import { AppError } from '@shared/errors/AppError'
import {
  ClienteJWTPayload,
  registrarClienteSchema,
  loginClienteSchema,
  verificarCodigoClienteSchema,
  reenviarCodigoClienteSchema,
  esqueciSenhaClienteSchema,
  redefinirSenhaClienteSchema,
  refreshTokenClienteSchema,
  atualizarPerfilClienteSchema,
  alterarSenhaClienteSchema,
} from './Cliente.schema'

const service = new ClienteService(new ClienteRepository())

/** Limite por IP. A mensagem de erro chega na tela do front. */
const limite = (max: number, timeWindow: string, mensagem: string) => ({
  config: {
    rateLimit: {
      max,
      timeWindow,
      errorResponseBuilder: () => ({ status: 'error', message: mensagem }),
    },
  },
})

/**
 * Rotas de autenticação do CLIENTE do restaurante.
 * Registradas em /api/v1/auth/cliente (veja app.ts).
 */
export async function clientesRoutes(app: FastifyInstance): Promise<void> {
  const jwtSign = (p: ClienteJWTPayload) => app.jwt.sign(p)

  // ── ROTAS PÚBLICAS ─────────────────────────────────────────────────────────
  app.register(async (pub) => {

    // POST /auth/cliente/register — 5 cadastros por hora por IP
    pub.post(
      '/register',
      limite(5, '1 hour', 'Muitas tentativas de cadastro. Tente novamente mais tarde.'),
      async (request: FastifyRequest, reply: FastifyReply) => {
        const data = registrarClienteSchema.parse(request.body)
        const result = await service.registrar(data)
        return reply.status(201).send({
          message: 'Cadastro realizado! Enviamos um código de confirmação para o seu e-mail.',
          ...result,
        })
      }
    )

    // POST /auth/cliente/login — 10 tentativas por minuto por IP
    pub.post(
      '/login',
      limite(10, '1 minute', 'Muitas tentativas de login. Tente novamente em 1 minuto.'),
      async (request: FastifyRequest, reply: FastifyReply) => {
        const data = loginClienteSchema.parse(request.body)
        const result = await service.login(data, jwtSign)
        return reply.status(200).send(result)
      }
    )

    // POST /auth/cliente/verificar-codigo
    // tipo "registro"    → confirma o e-mail e devolve { token, refresh_token, cliente }
    // tipo "recuperacao" → devolve só { message } (a senha é trocada em /redefinir-senha)
    pub.post(
      '/verificar-codigo',
      limite(8, '15 minutes', 'Muitas tentativas de verificação. Aguarde alguns minutos.'),
      async (request: FastifyRequest, reply: FastifyReply) => {
        const data = verificarCodigoClienteSchema.parse(request.body)
        const sessao = await service.verificarCodigo(data, jwtSign)
        return reply
          .status(200)
          .send(sessao ?? { message: 'Código verificado com sucesso!' })
      }
    )

    // POST /auth/cliente/reenviar-codigo
    pub.post(
      '/reenviar-codigo',
      limite(3, '10 minutes', 'Muitas solicitações de reenvio. Aguarde alguns minutos.'),
      async (request: FastifyRequest, reply: FastifyReply) => {
        const data = reenviarCodigoClienteSchema.parse(request.body)
        await service.reenviarCodigo(data)
        return reply.status(200).send({
          message: 'Se os dados estiverem corretos, um novo código foi enviado.',
        })
      }
    )

    // POST /auth/cliente/esqueci-senha
    pub.post(
      '/esqueci-senha',
      limite(5, '1 hour', 'Limite de recuperação de senha atingido. Tente novamente mais tarde.'),
      async (request: FastifyRequest, reply: FastifyReply) => {
        const data = esqueciSenhaClienteSchema.parse(request.body)
        await service.esqueciSenha(data)
        return reply.status(200).send({
          message: 'Se este e-mail estiver cadastrado, você receberá o código em breve.',
        })
      }
    )

    // POST /auth/cliente/redefinir-senha
    pub.post(
      '/redefinir-senha',
      limite(10, '1 hour', 'Muitas tentativas de redefinição de senha. Tente novamente mais tarde.'),
      async (request: FastifyRequest, reply: FastifyReply) => {
        const data = redefinirSenhaClienteSchema.parse(request.body)
        await service.redefinirSenha(data)
        return reply.status(200).send({
          message: 'Senha redefinida com sucesso. Faça login com sua nova senha.',
        })
      }
    )

    // POST /auth/cliente/refresh
    pub.post(
      '/refresh',
      limite(30, '1 minute', 'Muitas renovações de sessão. Aguarde um momento.'),
      async (request: FastifyRequest, reply: FastifyReply) => {
        const { refresh_token } = refreshTokenClienteSchema.parse(request.body)
        const result = await service.refreshToken(refresh_token, jwtSign)
        return reply.status(200).send(result)
      }
    )

    // POST /auth/cliente/logout
    pub.post('/logout', async (request: FastifyRequest, reply: FastifyReply) => {
      const { refresh_token } = refreshTokenClienteSchema.parse(request.body)
      await service.logout(refresh_token)
      return reply.status(204).send()
    })
  })

  // ── ROTAS PRIVADAS (token de cliente) ──────────────────────────────────────
  app.register(async (priv) => {
    priv.addHook('onRequest', async (request) => {
      await request.jwtVerify()
      const user = request.user as { perfil?: string }
      if (user.perfil !== 'CLIENTE') {
        throw new AppError('Acesso restrito a clientes', 403)
      }
    })

    // GET /auth/cliente/me
    priv.get('/me', async (request: FastifyRequest, reply: FastifyReply) => {
      const { sub } = request.user as ClienteJWTPayload
      const cliente = await service.me(sub)
      return reply.status(200).send({ cliente })
    })

    // PUT /auth/cliente/me — atualiza nome e telefone
    priv.put('/me', async (request: FastifyRequest, reply: FastifyReply) => {
      const { sub } = request.user as ClienteJWTPayload
      const data = atualizarPerfilClienteSchema.parse(request.body)
      const cliente = await service.atualizarPerfil(sub, data)
      return reply.status(200).send({ cliente })
    })

    // POST /auth/cliente/alterar-senha — exige a senha atual; devolve sessão nova
    priv.post(
      '/alterar-senha',
      limite(5, '15 minutes', 'Muitas tentativas de alterar a senha. Aguarde alguns minutos.'),
      async (request: FastifyRequest, reply: FastifyReply) => {
        const { sub } = request.user as ClienteJWTPayload
        const data = alterarSenhaClienteSchema.parse(request.body)
        const sessao = await service.alterarSenha(sub, data, jwtSign)
        return reply.status(200).send(sessao)
      }
    )
  })
}
