import { FastifyInstance, FastifyRequest } from 'fastify'
import { z } from 'zod'
import { authorize } from '../../authorize'
import { AppError } from '@shared/errors/AppError'
import { JWTPayload } from '@modules/auth/Auth.schema'
import { DespesaService } from './Despesa.service'
import { despesaSchema, categoriaDespesaSchema, filtroDespesaSchema } from './Despesa.schema'

const service = new DespesaService()

const idSchema = z.object({ id: z.string().uuid('ID inválido') })
const periodoSchema = filtroDespesaSchema.pick({ data_inicio: true, data_fim: true })

const estabelecimentoDe = (request: FastifyRequest): string => {
  const user = request.user as JWTPayload
  if (!user.estabelecimento_id) {
    throw new AppError('Usuário não vinculado a um estabelecimento', 400)
  }
  return user.estabelecimento_id
}

/**
 * Despesas do restaurante. Dinheiro do negócio: só ADMIN acessa.
 * Registradas em /api/v1/despesas (veja app.ts).
 */
export async function despesasRoutes(app: FastifyInstance): Promise<void> {
  app.addHook('onRequest', authorize('ADMIN'))

  // GET /despesas?data_inicio=2026-11-01&data_fim=2026-11-30&categoria=Aluguel&forma_pagamento=PIX
  app.get('/', async (request, reply) => {
    const filtro = filtroDespesaSchema.parse(request.query)
    return reply.send(await service.listar(estabelecimentoDe(request), filtro))
  })

  // GET /despesas/resumo?data_inicio=...&data_fim=... — total e total por categoria (Relatórios)
  app.get('/resumo', async (request, reply) => {
    const periodo = periodoSchema.parse(request.query)
    return reply.send(await service.resumo(estabelecimentoDe(request), periodo))
  })

  // GET /despesas/categorias — padrão + as criadas pelo restaurante
  app.get('/categorias', async (request, reply) => {
    return reply.send(await service.listarCategorias(estabelecimentoDe(request)))
  })

  // POST /despesas/categorias
  app.post('/categorias', async (request, reply) => {
    const { nome } = categoriaDespesaSchema.parse(request.body)
    return reply.status(201).send(await service.criarCategoria(estabelecimentoDe(request), nome))
  })

  app.post('/', async (request, reply) => {
    const dados = despesaSchema.parse(request.body)
    return reply.status(201).send(await service.criar(estabelecimentoDe(request), dados))
  })

  app.put('/:id', async (request, reply) => {
    const { id } = idSchema.parse(request.params)
    const dados = despesaSchema.parse(request.body)
    return reply.send(await service.atualizar(id, estabelecimentoDe(request), dados))
  })

  app.delete('/:id', async (request, reply) => {
    const { id } = idSchema.parse(request.params)
    await service.excluir(id, estabelecimentoDe(request))
    return reply.status(204).send()
  })
}
