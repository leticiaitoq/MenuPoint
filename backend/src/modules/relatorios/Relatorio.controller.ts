import { FastifyInstance, FastifyRequest } from 'fastify'
import { authorize } from '../../authorize'
import { AppError } from '@shared/errors/AppError'
import { JWTPayload } from '@modules/auth/Auth.schema'
import { RelatorioService } from './Relatorio.service'
import { periodoRelatorioSchema } from './Relatorio.schema'

const service = new RelatorioService()

const estabelecimentoDe = (request: FastifyRequest): string => {
  const user = request.user as JWTPayload
  if (!user.estabelecimento_id) {
    throw new AppError('Usuário não vinculado a um estabelecimento', 400)
  }
  return user.estabelecimento_id
}

/**
 * Relatórios do restaurante (faturamento, produtos, categorias). Só ADMIN acessa.
 * Registradas em /api/v1/relatorios (veja app.ts).
 */
export async function relatoriosRoutes(app: FastifyInstance): Promise<void> {
  app.addHook('onRequest', authorize('ADMIN'))

  // GET /relatorios/resumo?data_inicio=2026-11-01&data_fim=2026-11-30
  app.get('/resumo', async (request, reply) => {
    const { data_inicio, data_fim } = periodoRelatorioSchema.parse(request.query)
    return reply.send(await service.resumo(estabelecimentoDe(request), data_inicio, data_fim))
  })
}
