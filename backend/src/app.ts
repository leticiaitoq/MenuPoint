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
import { situacaoDoUsuario } from '@shared/middlewares/usuarioAtivo'

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
import { clientesRoutes } from '@modules/clientes/Cliente.controller'
import { assinaturaRoutes } from '@modules/assinatura/Assinatura.controller'
// import { uploadRoutes } from '@modules/upload/Upload.controller'

// GETs públicos que o cliente logado (perfil CLIENTE) pode chamar
const ROTAS_PUBLICAS_GET = /^\/api\/v1\/(estabelecimentos|categorias)\/publico\//

export function buildApp(): FastifyInstance {
  const app = Fastify({
    // Atrás do proxy do Azure o request.ip seria o IP interno do proxy (todos os
    // usuários no mesmo balde do rate limit). Com trustProxy o Fastify usa o
    // X-Forwarded-For. Ajuste para um número de hops (ex.: 1) se o app ficar
    // exposto diretamente à internet em algum ambiente.
    trustProxy: true,

    logger: env.NODE_ENV === 'development'
      ? { transport: { target: 'pino-pretty' } }
      : true,
  })

//Registro de ligação com o backend
// FRONTEND_URL aceita uma ou mais origens separadas por vírgula
// (ex: "https://www.menupoint.space,https://menupoint.space")
const origensPermitidas = env.FRONTEND_URL.split(',').map((url) => url.trim())

app.register(cors, {
  origin: env.NODE_ENV === 'development'
    ? (origin, cb) => cb(null, true)
    : [...origensPermitidas, 'http://localhost:3000'],
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true,
})
// Rate limiting global — proteção contra brute-force
  app.register(rateLimit, {
    global: true,
    max: 300,
    timeWindow: '1 minute',
    // Chave do balde: usuário autenticado (token VÁLIDO) > IP.
    // Token inválido/forjado cai no balde do IP, então não dá para escapar do
    // limite trocando o token. Várias telas do mesmo restaurante, atrás do
    // mesmo IP, não derrubam umas às outras.
    keyGenerator: (request) => {
      const authorization = request.headers.authorization
      if (authorization?.startsWith('Bearer ')) {
        try {
          const payload = request.server.jwt.verify(authorization.slice(7)) as {
            id?: string
            sub?: string
          }
          const id = payload?.id ?? payload?.sub
          if (id) return `user:${id}`
        } catch {
          // token inválido: usa o IP
        }
      }
      // Alguns proxies (Azure App Service) mandam "ip:porta" no X-Forwarded-For
      return `ip:${request.ip.replace(/:\d+$/, '')}`
    },
    errorResponseBuilder: () => ({
      statusCode: 429,
      status: 'error',
      message: 'Muitas requisições. Tente novamente em alguns instantes.',
    }),
  })

  // Multipart para upload de arquivos
  app.register(multipart, {
    limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
  })

// Swagger só fora de produção (swagger-ui é devDependency e expõe toda a API)
if (env.NODE_ENV !== 'production') {
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
}

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

    // Token de CLIENTE (perfil CLIENTE) não entra nas rotas do restaurante.
    // O JWT é assinado com o mesmo secret, então sem esta barreira um cliente
    // logado conseguiria chamar rotas que só conferem "tem token válido".
    // Rotas /auth/* ficam de fora (cada módulo de auth faz a própria checagem).
    // Quando existirem rotas feitas para o cliente (ex.: pedidos), libere o prefixo aqui.
    api.addHook('onRequest', async (request) => {
      if (request.url.startsWith('/api/v1/auth/')) return

      // Rotas públicas de leitura (cardápio por slug) também servem o cliente logado
      if (request.method === 'GET' && ROTAS_PUBLICAS_GET.test(request.url)) return

      const authorization = request.headers.authorization
      if (!authorization?.startsWith('Bearer ')) return

      const payload = (api.jwt as any).decode(authorization.slice(7)) as
        | { perfil?: string }
        | null

      if (payload?.perfil === 'CLIENTE') {
        throw new AppError('Acesso não permitido para este tipo de conta', 403)
      }
    })

    // Funcionário desligado/desativado perde o acesso mesmo com token ainda válido, e o perfil
    // vale o do BANCO (não o do token): rebaixar alguém tem efeito em até 30s.
    // Só age com token válido; sem token ou token inválido, quem responde é o jwtVerify da rota.
    api.addHook('onRequest', async (request) => {
      if (request.url.startsWith('/api/v1/auth/')) return
      const authorization = request.headers.authorization
      if (!authorization?.startsWith('Bearer ')) return

      let payload: { sub?: string; perfil?: string } | null = null
      try {
        payload = (api.jwt as any).verify(authorization.slice(7))
      } catch {
        return
      }
      if (!payload?.sub || payload.perfil === 'CLIENTE') return

      const situacao = await situacaoDoUsuario(payload.sub)
      if (!situacao.ativo) {
        throw new AppError('Usuário desativado', 401)
      }
      if (situacao.perfil !== payload.perfil) {
        throw new AppError('Seu perfil foi alterado. Entre novamente.', 401)
      }
    })

    api.register(authRoutes,            { prefix: '/auth' })
    api.register(clientesRoutes,        { prefix: '/auth/cliente' })
    api.register(usuariosRoutes,        { prefix: '/usuarios' })
    api.register(estabelecimentosRoutes,{ prefix: '/estabelecimentos' })
    api.register(categoriasRoutes,      { prefix: '/categorias' })
    api.register(produtosRoutes,        { prefix: '/produtos' })
    api.register(mesasRoutes,           { prefix: '/mesas' })
    api.register(pagamentosRoutes,      { prefix: '/pagamentos'})
    api.register(pedidosRoutes,         { prefix: '/pedidos' })
    api.register(reservasRoutes,        { prefix: '/reservas' })
    api.register(empresasRoutes, { prefix: '/empresas' })
    api.register(assinaturaRoutes,      { prefix: '/assinatura' })
    // api.register(uploadRoutes,          { prefix: '/upload' })
  }, { prefix: '/api/v1' })

  // Qualquer erro lançado em qualquer rota cai aqui
 app.setErrorHandler((error: FastifyError, request, reply) => {
  if (error instanceof AppError) {
    return reply.status(error.statusCode).send({
      status: 'error',
      message: error.message,
      ...(error.code ? { code: error.code } : {}),
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

  // Erros 4xx que não são nossos (ex.: limite de requisições do rate-limit = 429).
  // Sem isto caíam no 500 abaixo e a tela mostrava "erro interno" em vez do aviso real.
  const statusCode = (error as { statusCode?: number }).statusCode
  if (typeof statusCode === 'number' && statusCode >= 400 && statusCode < 500) {
    return reply.status(statusCode).send({
      status: 'error',
      message: error.message,
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