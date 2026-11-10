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
import { despesasRoutes } from '@modules/despesas/Despesa.controller'
import { relatoriosRoutes } from '@modules/relatorios/Relatorio.controller'
import { empresasRoutes } from '@modules/empresas/Empresa.controller'
import { clientesRoutes } from '@modules/clientes/Cliente.controller'
import { assinaturaRoutes } from '@modules/assinatura/Assinatura.controller'
import { contatoRoutes } from '@modules/contato/Contato.controller'
// import { uploadRoutes } from '@modules/upload/Upload.controller'

// GETs públicos que o cliente logado (perfil CLIENTE) pode chamar
const ROTAS_PUBLICAS_GET = /^\/api\/v1\/(estabelecimentos|categorias)\/publico\//

// Reservas feitas pelo próprio cliente: só estas rotas (GET mesas livres e POST criar) aceitam token CLIENTE.
// As demais rotas de /reservas continuam só do restaurante.
const ROTAS_CLIENTE_RESERVA = /^\/api\/v1\/reservas\/publico\//

// Pedidos do próprio cliente: delivery (/pedidos/publico/:slug) e histórico fixo (/pedidos/cliente/*).
// As rotas conferem sozinhas se o perfil é CLIENTE; o resto de /pedidos continua só do restaurante.
const ROTAS_CLIENTE_PEDIDO = /^\/api\/v1\/pedidos\/(publico|cliente)\//

// Rotas públicas da mesa (QR Code). O convidado não tem token; o cliente logado manda o dele só
// para o pedido ficar ligado à conta (token inválido/expirado vira convidado, nunca erro).
const ROTAS_MESA_PUBLICA = /^\/api\/v1\/mesas\/qrcode\//

export function buildApp(): FastifyInstance {
  const app = Fastify({

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
    max: 100,
    timeWindow: '1 minute',
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

    // Token de CLIENTE (perfil CLIENTE) não entra nas rotas do restaurante.
    // O JWT é assinado com o mesmo secret, então sem esta barreira um cliente
    // logado conseguiria chamar rotas que só conferem "tem token válido".
    // Rotas /auth/* ficam de fora (cada módulo de auth faz a própria checagem).
    // Quando existirem rotas feitas para o cliente (ex.: pedidos), libere o prefixo aqui.
    api.addHook('onRequest', async (request) => {
      if (request.url.startsWith('/api/v1/auth/')) return


      // Rotas públicas de leitura (cardápio por slug) também servem o cliente logado
      if (request.method === 'GET' && ROTAS_PUBLICAS_GET.test(request.url)) return

      // Cliente pedindo no delivery / vendo o próprio histórico, e pedido da mesa pelo QR Code
      if (ROTAS_CLIENTE_PEDIDO.test(request.url) || ROTAS_MESA_PUBLICA.test(request.url)) return

      // Cliente reservando (a própria rota confere se o perfil é CLIENTE)
      if (
        (request.method === 'GET' || request.method === 'POST') &&
        ROTAS_CLIENTE_RESERVA.test(request.url)
      ) return

      const authorization = request.headers.authorization
      if (!authorization?.startsWith('Bearer ')) return

      const payload = (api.jwt as any).decode(authorization.slice(7)) as
        | { perfil?: string }
        | null

      if (payload?.perfil === 'CLIENTE') {
        throw new AppError('Acesso não permitido para este tipo de conta', 403)
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
    api.register(despesasRoutes,        { prefix: '/despesas' })
    api.register(relatoriosRoutes,      { prefix: '/relatorios' })
    api.register(empresasRoutes, { prefix: '/empresas' })
    api.register(assinaturaRoutes,      { prefix: '/assinatura' })
    api.register(contatoRoutes, { prefix: '/contato' })
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

  // Violação de índice único (P2002) que nenhum service tratou na mão: é conflito (409), não
  // erro interno. Pega também duas requisições simultâneas que passam juntas pela checagem prévia.
  if (error.name === 'PrismaClientKnownRequestError' && (error as { code?: string }).code === 'P2002') {
    const alvo = String((error as { meta?: { target?: unknown } }).meta?.target ?? '')
    const mensagem = alvo.includes('cpf')
      ? 'Este CPF já está cadastrado'
      : alvo.includes('cnpj')
        ? 'Este CNPJ já está cadastrado'
        : alvo.includes('email')
          ? 'Este e-mail já está cadastrado'
          : alvo.includes('slug')
            ? 'Este endereço já está em uso'
            : 'Já existe um registro com esses dados'
    request.log.warn({ alvo }, 'Conflito de unicidade (P2002) devolvido como 409')
    return reply.status(409).send({ status: 'error', message: mensagem })
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