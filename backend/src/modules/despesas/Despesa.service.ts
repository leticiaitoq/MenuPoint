import { Prisma } from '@prisma/client'
import prisma from '@config/prisma'
import { AppError } from '@shared/errors/AppError'
import {
  CATEGORIAS_PADRAO_DESPESA,
  DespesaDTO,
  FiltroDespesa,
} from './Despesa.schema'

/** Limite de linhas por consulta (a tela filtra e pagina no navegador). */
const LIMITE_LISTAGEM = 5000

const paraData = (iso: string) => new Date(iso + 'T00:00:00Z')

const paraResposta = (d: {
  id: string
  descricao: string
  categoria: string
  fornecedor: string | null
  forma_pagamento: string
  valor: Prisma.Decimal
  data_despesa: Date
  observacoes: string | null
}) => ({
  id: d.id,
  descricao: d.descricao,
  categoria: d.categoria,
  fornecedor: d.fornecedor ?? '',
  forma_pagamento: d.forma_pagamento,
  valor: Number(d.valor),
  data_despesa: d.data_despesa.toISOString().slice(0, 10),
  observacoes: d.observacoes ?? '',
})

const filtroPeriodo = (f: Pick<FiltroDespesa, 'data_inicio' | 'data_fim'>) => {
  if (f.data_inicio && f.data_fim && f.data_inicio > f.data_fim) {
    throw new AppError('A data inicial não pode ser depois da data final', 400)
  }
  return {
    ...((f.data_inicio || f.data_fim) && {
      data_despesa: {
        ...(f.data_inicio && { gte: paraData(f.data_inicio) }),
        ...(f.data_fim && { lte: paraData(f.data_fim) }),
      },
    }),
  }
}

export class DespesaService {
  // ── Categorias ─────────────────────────────────────────────────────────────

  /** Padrão + as criadas pelo restaurante (sem repetir nome, ignorando maiúsculas). */
  async listarCategorias(estabelecimento_id: string) {
    const proprias = await prisma.categoriaDespesa.findMany({
      where: { estabelecimento_id },
      orderBy: { nome: 'asc' },
      select: { nome: true },
    })
    return [
      ...CATEGORIAS_PADRAO_DESPESA.map((nome) => ({ nome, padrao: true })),
      ...proprias.map((c) => ({ nome: c.nome, padrao: false })),
    ]
  }

  async criarCategoria(estabelecimento_id: string, nome: string) {
    const existentes = await this.listarCategorias(estabelecimento_id)
    if (existentes.some((c) => c.nome.toLowerCase() === nome.toLowerCase())) {
      throw new AppError('Já existe uma categoria com esse nome', 409)
    }
    await prisma.categoriaDespesa.create({ data: { estabelecimento_id, nome } })
    return { nome, padrao: false }
  }

  /** A categoria da despesa precisa existir (padrão ou criada por este restaurante). */
  private async validarCategoria(estabelecimento_id: string, categoria: string) {
    const existentes = await this.listarCategorias(estabelecimento_id)
    const igual = existentes.find((c) => c.nome.toLowerCase() === categoria.toLowerCase())
    if (!igual) throw new AppError('Categoria inválida. Escolha uma categoria existente.', 400)
    return igual.nome // grava com a grafia oficial
  }

  // ── Despesas ───────────────────────────────────────────────────────────────

  async listar(estabelecimento_id: string, filtro: FiltroDespesa) {
    const despesas = await prisma.despesa.findMany({
      where: {
        estabelecimento_id,
        ...filtroPeriodo(filtro),
        ...(filtro.categoria && { categoria: filtro.categoria }),
        ...(filtro.forma_pagamento && { forma_pagamento: filtro.forma_pagamento }),
      },
      orderBy: [{ data_despesa: 'desc' }, { criado_em: 'desc' }],
      take: LIMITE_LISTAGEM,
    })
    return despesas.map(paraResposta)
  }

  async criar(estabelecimento_id: string, dados: DespesaDTO) {
    const categoria = await this.validarCategoria(estabelecimento_id, dados.categoria)
    const despesa = await prisma.despesa.create({
      data: {
        estabelecimento_id,
        descricao: dados.descricao,
        categoria,
        fornecedor: dados.fornecedor || null,
        forma_pagamento: dados.forma_pagamento,
        valor: dados.valor,
        data_despesa: paraData(dados.data_despesa),
        observacoes: dados.observacoes || null,
      },
    })
    return paraResposta(despesa)
  }

  private async buscar(id: string, estabelecimento_id: string) {
    const despesa = await prisma.despesa.findFirst({ where: { id, estabelecimento_id } })
    if (!despesa) throw new AppError('Despesa não encontrada', 404)
    return despesa
  }

  async atualizar(id: string, estabelecimento_id: string, dados: DespesaDTO) {
    await this.buscar(id, estabelecimento_id)
    const categoria = await this.validarCategoria(estabelecimento_id, dados.categoria)
    const despesa = await prisma.despesa.update({
      where: { id },
      data: {
        descricao: dados.descricao,
        categoria,
        fornecedor: dados.fornecedor || null,
        forma_pagamento: dados.forma_pagamento,
        valor: dados.valor,
        data_despesa: paraData(dados.data_despesa),
        observacoes: dados.observacoes || null,
      },
    })
    return paraResposta(despesa)
  }

  async excluir(id: string, estabelecimento_id: string) {
    await this.buscar(id, estabelecimento_id)
    await prisma.despesa.delete({ where: { id } })
  }

  // ── Resumo (painel "Despesas do Estabelecimento" do Relatórios) ─────────────

  async resumo(estabelecimento_id: string, periodo: Pick<FiltroDespesa, 'data_inicio' | 'data_fim'>) {
    const grupos = await prisma.despesa.groupBy({
      by: ['categoria'],
      where: { estabelecimento_id, ...filtroPeriodo(periodo) },
      _sum: { valor: true },
      _count: { _all: true },
      orderBy: { _sum: { valor: 'desc' } },
    })

    const por_categoria = grupos.map((g) => ({
      categoria: g.categoria,
      total: Number(g._sum.valor ?? 0),
      quantidade: g._count._all,
    }))

    return {
      total: Math.round(por_categoria.reduce((acc, c) => acc + c.total, 0) * 100) / 100,
      quantidade: por_categoria.reduce((acc, c) => acc + c.quantidade, 0),
      por_categoria,
    }
  }
}
