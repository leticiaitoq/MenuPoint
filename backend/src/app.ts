import Fastify, { FastifyInstance } from 'fastify'
import jwt from '@fastify/jwt'
import cors from '@fastify/cors'
import { env } from '@config/env'
import { jwtConfig } from '@config/jwt'
import { AppError } from '@shared/errors/AppError'
import { FastifyError } from 'fastify'
import { FastifyRequest, FastifyReply } from 'fastify'

import fastifySwagger from '@fastify/swagger'
import fastifySwaggerUi from '@fastify/swagger-ui'

import { authRoutes } from '@modules/auth/Auth.controller'
import { usuariosRoutes } from '@modules/usuarios/Usuario.controller'
import { estabelecimentosRoutes } from '@modules/estabelecimentos/Estabelecimento.controller'
import { categoriasRoutes } from '@modules/categorias/Categoria.controller'
import { produtosRoutes } from '@modules/produtos/Produto.controller'
import { mesasRoutes } from '@modules/mesas/Mesa.controller'

export function buildApp(): FastifyInstance {
  const app = Fastify({

    logger: env.NODE_ENV === 'development'
      ? { transport: { target: 'pino-pretty' } }
      : true,
  })

//Registro de ligação com o backend
app.register(cors, {
  origin: env.NODE_ENV === 'development'
    ? ['http://localhost:3000', 'http://localhost:5173']
    : env.FRONTEND_URL,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true,
})

app.register(fastifySwagger, {
  openapi: {
    info: {
      title: 'Menupoint API',
      version: '1.0.0',
    },
  },
})

app.register(fastifySwaggerUi, {
  routePrefix: '/docs',
})

  // Registra o JWT com as configurações centralizadas
  app.register(jwt, jwtConfig)

 app.decorate(
  'authenticate',
  async function (request: FastifyRequest, reply: FastifyReply): Promise<void> {
    await request.jwtVerify()
  }
)

  // ── Rotas
  app.register(async (api) => {
    api.register(authRoutes,            { prefix: '/auth' })
    api.register(usuariosRoutes,        { prefix: '/usuarios' })
    api.register(estabelecimentosRoutes,{ prefix: '/estabelecimentos' })
    api.register(categoriasRoutes,      { prefix: '/categorias' })
    api.register(produtosRoutes,        { prefix: '/produtos' })
    api.register(mesasRoutes,           { prefix: '/mesas' })
  }, { prefix: '/api/v1' })

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