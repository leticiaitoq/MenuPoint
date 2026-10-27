import { FastifyRequest, FastifyReply } from 'fastify'
import { AppError } from '@shared/errors/AppError'
import { JWTPayload } from '@modules/auth/Auth.schema'

export type Perfil = 'ADMIN' | 'ATENDENTE' | 'CAIXA' | 'CLIENTE'

// ─────────────────────────────────────────────────────────────────────────────
// authorize(...perfis)
//
// Hook que verifica se o usuário autenticado possui um dos perfis informados.
// Já chama jwtVerify() internamente — não precisa de outro addHook de auth.
//
// Uso em sub-roteador (padrão recomendado):
//
//   app.register(async (adminRoutes) => {
//     adminRoutes.addHook('onRequest', authorize('ADMIN'))
//     adminRoutes.post('/', criarHandler)
//     adminRoutes.delete('/:id', deletarHandler)
//   })
//
// Uso em rota individual:
//
//   app.delete('/:id', { preHandler: authorize('ADMIN') }, handler)
// ─────────────────────────────────────────────────────────────────────────────

export function authorize(...perfisPermitidos: Perfil[]) {
  return async (request: FastifyRequest, _reply: FastifyReply): Promise<void> => {
    // Verifica e decodifica o JWT
    await request.jwtVerify()

    const user = request.user as JWTPayload

    if (!perfisPermitidos.includes(user.perfil as Perfil)) {
      throw new AppError(
        `Acesso negado. Perfil necessário: ${perfisPermitidos.join(' ou ')}`,
        403
      )
    }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// authenticate
//
// Apenas verifica autenticação, sem restrição de perfil.
// Equivalente ao addHook('onRequest', async (req) => req.jwtVerify())
// mas importável como preHandler individual.
// ─────────────────────────────────────────────────────────────────────────────

export async function authenticate(
  request: FastifyRequest,
  _reply: FastifyReply
): Promise<void> {
  await request.jwtVerify()
}

// ─────────────────────────────────────────────────────────────────────────────
// requireEstabelecimento(request, estabelecimento_id)
//
// Verifica se o usuário pertence ao estabelecimento da requisição.
// Usuários com escopo GLOBAL passam sem verificação (admins da plataforma).
//
// Uso: chamar dentro do handler, após jwtVerify:
//
//   requireEstabelecimento(request, estabelecimento_id)
// ─────────────────────────────────────────────────────────────────────────────

export function requireEstabelecimento(
  request: FastifyRequest,
  estabelecimento_id: string
): void {
  const user = request.user as JWTPayload

  // Admins globais da plataforma têm acesso a qualquer estabelecimento
  if (user.escopo === 'GLOBAL') return

  if (user.estabelecimento_id !== estabelecimento_id) {
    throw new AppError('Acesso não autorizado a este estabelecimento', 403)
  }
}