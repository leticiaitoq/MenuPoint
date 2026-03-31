import Fastify, { FastifyInstance } from 'fastify'
import jwt from '@fastify/jwt'
import cors from '@fastify/cors'
import { env } from '@config/env'
import { jwtConfig } from '@config/jwt'
import { AppError } from '@shared/errors/AppError'
import { FastifyError } from 'fastify'
import { FastifyRequest, FastifyReply } from 'fastify'
import { authRoutes } from '@modules/auth/Auth.controller'
import { usuariosRoutes } from '@modules/usuarios/Usuario.controller'
import { estabelecimentosRoutes } from '@modules/estabelecimentos/Estabelecimento.controller'
import { categoriasRoutes } from '@modules/categorias/Categoria.controller'

export function buildApp(): FastifyInstance {
  const app = Fastify({

    logger: env.NODE_ENV === 'development'
      ? { transport: { target: 'pino-pretty' } }
      : true,
  })

    // Registra o CORS com a URL do frontend
  app.register(cors, {
    origin: env.FRONTEND_URL,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  })

  // Registra o JWT com as configurações centralizadas
  app.register(jwt, jwtConfig)

 app.decorate(
  'authenticate',
  async function (request: FastifyRequest, reply: FastifyReply): Promise<void> {
    await request.jwtVerify()
  }
)


  // Rotas
    app.register(authRoutes, { prefix: '/auth' })
    app.register(usuariosRoutes, { prefix: '/usuarios' })
    app.register(estabelecimentosRoutes, { prefix: '/estabelecimentos' })
    app.register(categoriasRoutes, { prefix: '/categorias' })

  // ── ROTAS ────────────────────────────────────────────────
  // As rotas serão registradas aqui conforme os módulos forem criados
  // app.register(authRoutes, { prefix: '/auth' })
  // app.register(produtosRoutes, { prefix: '/produtos' })

  // Erros
  // Qualquer erro lançado em qualquer rota cai aqui
 app.setErrorHandler((error: FastifyError, request, reply) => {
  if (error instanceof AppError) {
    return reply.status(error.statusCode).send({
      status: 'error',
      message: error.message,
    })
  }

  if (error.name === 'ZodError') {
    return reply.status(422).send({
      status: 'error',
      message: 'Dados inválidos',
      errors: JSON.parse(error.message),
    })
  }

  if (
    error.name === 'JsonWebTokenError' ||
    error.name === 'TokenExpiredError'
  ) {
    return reply.status(401).send({
      status: 'error',
      message: 'Token inválido ou expirado',
    })
  }

  request.log.error(error)

  return reply.status(500).send({
    status: 'error',
    message: 'Erro interno do servidor',
  })
})
  return app
}