import Fastify, { FastifyInstance } from 'fastify'
import jwt from '@fastify/jwt'
import cors from '@fastify/cors'
import rateLimit from '@fastify/rate-limit'
import multipart from '@fastify/multipart'
import { env } from '@config/env'
import { jwtConfig } from '@config/jwt'
import { AppError } from '@shared/errors/AppError'
import { FastifyError } from 'fastify'
import { FastifyRequest, FastifyReply } from 'fastify'
import { ZodError } from 'zod'

import fastifySwagger from '@fastify/swagger'
import fastifySwaggerUi from '@fastify/swagger-ui'

import { authRoutes } from '@modules/auth/Auth.controller'
import { usuariosRoutes } from '@modules/usuarios/Usuario.controller'
import { estabelecimentosRoutes } from '@modules/estabelecimentos/Estabelecimento.controller'
import { categoriasRoutes } from '@modules/categorias/Categoria.controller'
import { produtosRoutes } from '@modules/produtos/Produto.controller'
import { mesasRoutes } from '@modules/mesas/Mesa.controller'
import { pedidosRoutes } from '@modules/pedidos/Pedido.controller'
import { pagamentosRoutes } from '@modules/pagamentos/Pagamento.controller'
import { reservasRoutes } from '@modules/reservas/Reserva.controller'
import { empresasRoutes } from '@modules/empresas/Empresa.controller'
// import { clientesRoutes } from '@modules/clientes/Cliente.controller'
import { assinaturaRoutes } from '@modules/assinatura/Assinatura.controller'
// import { uploadRoutes } from '@modules/upload/Upload.controller'

export function buildApp(): FastifyInstance {
  const app = Fastify({

    logger: env.NODE_ENV === 'development'
      ? { transport: { target: 'pino-pretty' } }
      : true,
  })

//Registro de ligação com o backend
app.register(cors, {
  origin: env.NODE_ENV === 'development'
    ? (origin, cb) => cb(null, true)  
    : [env.FRONTEND_URL, 'http://localhost:3000'],
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true,
})
// Rate limiting global — proteção contra brute-force
  app.register(rateLimit, {
    global: true,
    max: 100,
    timeWindow: '1 minute',
    errorResponseBuilder: () => ({
      status: 'error',
      message: 'Muitas requisições. Tente novamente em alguns instantes.',
    }),
  })

  // Multipart para upload de arquivos
  app.register(multipart, {
    limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
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
    api.register(pagamentosRoutes,      { prefix: '/pagamentos'})
    api.register(pedidosRoutes,         { prefix: '/pedidos' })
    api.register(reservasRoutes,        { prefix: '/reservas' })
    api.register(empresasRoutes, { prefix: '/empresas' })
    // api.register(clientesRoutes,        { prefix: '/clientes' })
    api.register(assinaturaRoutes,      { prefix: '/assinatura' })
    // api.register(uploadRoutes,          { prefix: '/upload' })
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
