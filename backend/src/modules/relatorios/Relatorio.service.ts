import prisma from '@config/prisma'

/** Brasil (sem horário de verão desde 2019): os dias do relatório seguem o horário de Brasília. */
const FUSO = '-03:00'
const FUSO_MS = 3 * 60 * 60 * 1000

const r2 = (n: number) => Math.round(n * 100) / 100

const inicioDoDia = (iso: string) => new Date(`${iso}T00:00:00.000${FUSO}`)
const fimDoDia = (iso: string) => new Date(`${iso}T23:59:59.999${FUSO}`)

/** Dia (AAAA-MM-DD) em que o instante caiu no horário de Brasília */
const diaLocal = (d: Date) => new Date(d.getTime() - FUSO_MS).toISOString().slice(0, 10)

const MAX_CATEGORIAS_NO_GRAFICO = 5

export class RelatorioService {
  /**
   * Resumo financeiro do período.
   *
   * O que conta como VENDA (faturamento):
   *  - entrega e retirada: pedido ENTREGUE, na data da entrega;
   *  - mesa: só quando a conta é fechada no Caixa (liquidado_em), na data do fechamento —
   *    pedido entregue na mesa com a conta ainda aberta é dinheiro que não entrou.
   * Valor: o que foi realmente pago (pagamento CONFIRMADO, já com desconto e taxa de serviço);
   * sem pagamento registrado, vale o total do pedido.
   */
  async resumo(estabelecimento_id: string, data_inicio: string, data_fim: string) {
    const de = inicioDoDia(data_inicio)
    const ate = fimDoDia(data_fim)
    const noPeriodo = { gte: de, lte: ate }

    const [vendas, pedidos_total] = await Promise.all([
      prisma.pedido.findMany({
        where: {
          estabelecimento_id,
          status: 'ENTREGUE',
          OR: [
            { mesa_id: null, entregue_em: noPeriodo },
            { mesa_id: null, entregue_em: null, criado_em: noPeriodo }, // pedidos antigos, sem a data da entrega
            { mesa_id: { not: null }, liquidado_em: noPeriodo },
          ],
        },
        select: {
          mesa_id: true,
          total: true,
          criado_em: true,
          entregue_em: true,
          liquidado_em: true,
          pagamento: { select: { valor: true, status: true } },
          itens: {
            select: {
              quantidade: true,
              produto: { select: { id: true, nome: true, categoria: { select: { nome: true } } } },
            },
          },
        },
      }),
      // Pedidos feitos no período, sem os cancelados (inclui os que ainda estão em andamento)
      prisma.pedido.count({
        where: { estabelecimento_id, status: { not: 'CANCELADO' }, criado_em: noPeriodo },
      }),
    ])

    let faturamento = 0
    const porDia = new Map<string, number>()
    const produtos = new Map<string, { nome: string; quantidade: number }>()
    const categorias = new Map<string, number>()

    for (const p of vendas) {
      const valor =
        p.pagamento?.status === 'CONFIRMADO' ? Number(p.pagamento.valor) : Number(p.total)
      faturamento += valor

      const quando = p.mesa_id ? p.liquidado_em : (p.entregue_em ?? p.criado_em)
      if (quando) {
        const dia = diaLocal(quando)
        porDia.set(dia, (porDia.get(dia) ?? 0) + valor)
      }

      for (const item of p.itens) {
        const prod = item.produto
        const atual = produtos.get(prod.id) ?? { nome: prod.nome, quantidade: 0 }
        atual.quantidade += item.quantidade
        produtos.set(prod.id, atual)

        const cat = prod.categoria?.nome ?? 'Sem categoria'
        categorias.set(cat, (categorias.get(cat) ?? 0) + item.quantidade)
      }
    }

    faturamento = r2(faturamento)
    const pedidos_finalizados = vendas.length

    // ── Série diária: todos os dias do período, inclusive os sem venda (gráfico contínuo)
    const faturamento_diario: { data: string; valor: number }[] = []
    for (
      let t = Date.parse(data_inicio + 'T00:00:00Z');
      t <= Date.parse(data_fim + 'T00:00:00Z');
      t += 86_400_000
    ) {
      const dia = new Date(t).toISOString().slice(0, 10)
      faturamento_diario.push({ data: dia, valor: r2(porDia.get(dia) ?? 0) })
    }

    const melhor = faturamento_diario.reduce<{ data: string; valor: number } | null>(
      (m, d) => (d.valor > 0 && (!m || d.valor > m.valor) ? d : m),
      null
    )

    // ── Produtos mais vendidos (top 4)
    const produtos_mais_vendidos = Array.from(produtos.entries())
      .map(([produto_id, v]) => ({ produto_id, nome: v.nome, quantidade: v.quantidade }))
      .sort((a, b) => b.quantidade - a.quantidade || a.nome.localeCompare(b.nome, 'pt-BR'))
      .slice(0, 4)

    // ── Itens vendidos por categoria (% das unidades). Passou de 5, o resto vira "Outras".
    const totalUnidades = Array.from(categorias.values()).reduce((a, b) => a + b, 0)
    const ordenadas = Array.from(categorias.entries())
      .map(([categoria, quantidade]) => ({ categoria, quantidade }))
      .sort((a, b) => b.quantidade - a.quantidade)
    const principais = ordenadas.slice(0, MAX_CATEGORIAS_NO_GRAFICO)
    const resto = ordenadas.slice(MAX_CATEGORIAS_NO_GRAFICO).reduce((a, c) => a + c.quantidade, 0)
    if (resto > 0) principais.push({ categoria: 'Outras', quantidade: resto })

    const pedidos_por_categoria = principais.map((c) => ({
      categoria: c.categoria,
      quantidade: c.quantidade,
      percentual: totalUnidades > 0 ? Math.round((c.quantidade / totalUnidades) * 100) : 0,
    }))

    return {
      periodo: { data_inicio, data_fim },
      faturamento,
      pedidos_finalizados,
      ticket_medio: pedidos_finalizados > 0 ? r2(faturamento / pedidos_finalizados) : 0,
      pedidos_total,
      produtos_mais_vendidos,
      faturamento_diario,
      pedidos_por_categoria,
      melhor_dia: melhor,
    }
  }
}
