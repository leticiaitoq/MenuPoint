/**
 * Testes das regras financeiras centrais (conta.ts). Sem framework: usa só o `assert` do Node.
 *
 *   cd backend
 *   npx ts-node -r tsconfig-paths/register --transpile-only src/modules/pagamentos/conta.test.ts
 */
import assert from 'node:assert/strict'
import {
  ajustarAlocacoes,
  alocarUnidades,
  calcularTaxa,
  contaFicaAbaixoDoPago,
  filtroContaAberta,
  garantirContaCobrePagos,
  subtotalDaConta,
  totalComTaxa,
  travarMesa,
} from './conta'

let total = 0
const teste = async (nome: string, fn: () => void | Promise<void>) => {
  total++
  try {
    await fn()
    console.log(`  ✓ ${nome}`)
  } catch (e) {
    console.error(`  ✖ ${nome}\n    ${(e as Error).message}`)
    process.exitCode = 1
  }
}

const main = async () => {
  console.log('conta.ts')

  await teste('taxa de serviço de 10% com arredondamento em centavos', () => {
    assert.equal(calcularTaxa(100), 10)
    assert.equal(totalComTaxa(100), 110)
    assert.equal(calcularTaxa(33.33), 3.33)
    assert.equal(totalComTaxa(33.33), 36.66)
  })

  await teste('abatimento quita unidades inteiras na ordem escolhida e sobra vira crédito', () => {
    const itens = [
      { item_pedido_id: 'A', quantidade: 2, custo_unitario: 11 },
      { item_pedido_id: 'B', quantidade: 1, custo_unitario: 22 },
    ]
    // R$ 30: A (2 un = 22) quita; sobram 8, não dá para uma unidade de B
    let r = alocarUnidades(30, itens)
    assert.deepEqual(r.alocacoes, [{ item_pedido_id: 'A', quantidade: 2, valor: 22 }])
    assert.equal(r.sobra, 8)
    // R$ 44: quita tudo
    r = alocarUnidades(44, itens)
    assert.equal(r.alocacoes.length, 2)
    assert.equal(r.sobra, 0)
    // R$ 10: não cobre nenhuma unidade
    r = alocarUnidades(10, itens)
    assert.deepEqual(r.alocacoes, [])
    assert.equal(r.sobra, 10)
    // R$ 15: só 1 unidade de A
    r = alocarUnidades(15, itens)
    assert.deepEqual(r.alocacoes, [{ item_pedido_id: 'A', quantidade: 1, valor: 11 }])
    assert.equal(r.sobra, 4)
  })

  await teste('a ordem dos itens escolhidos define quem é quitado primeiro', () => {
    const itens = [
      { item_pedido_id: 'B', quantidade: 1, custo_unitario: 22 },
      { item_pedido_id: 'A', quantidade: 2, custo_unitario: 11 },
    ]
    const r = alocarUnidades(25, itens)
    assert.deepEqual(r.alocacoes.map((a) => a.item_pedido_id), ['B'])
    assert.equal(r.sobra, 3)
  })

  await teste('alocações nunca somam mais (nem menos) que o valor pago', () => {
    const base = [
      { item_pedido_id: 'A', quantidade: 1, valor: 60.01 },
      { item_pedido_id: 'B', quantidade: 1, valor: 50.01 },
    ]
    const soma = (a: { valor: number }[]) => Math.round(a.reduce((s, x) => s + x.valor, 0) * 100) / 100
    assert.equal(soma(ajustarAlocacoes(base, 110)), 110) // reduz 0,02
    assert.equal(soma(ajustarAlocacoes(base, 110.05)), 110.05) // aumenta 0,03
    assert.equal(ajustarAlocacoes(base, 110.02), base) // já bate: mesma referência
    assert.deepEqual(ajustarAlocacoes([], 10), [])
    assert.equal(base[1].valor, 50.01) // não altera o original
  })

  await teste('conta não pode ficar abaixo do já pago em parcial', () => {
    assert.equal(contaFicaAbaixoDoPago(100, 110), false) // conta 110, pago 110
    assert.equal(contaFicaAbaixoDoPago(100, 110.01), true)
    assert.equal(contaFicaAbaixoDoPago(100, 0), false)
    assert.equal(contaFicaAbaixoDoPago(50, 60), true) // conta 55, pago 60
    assert.equal(contaFicaAbaixoDoPago(0, 10), true) // cancelou tudo com crédito aberto
  })

  await teste('garantirContaCobrePagos recusa (409) e aceita conforme o valor pago', async () => {
    const tx: any = { pagamentoMesa: { findMany: async () => [{ valor: 60 }] } }
    await assert.rejects(
      () => garantirContaCobrePagos(tx, 'mesa', 'est', 50, 'Cancelar este pedido'),
      (e: any) => e.statusCode === 409 && /menor que o já pago/.test(e.message)
    )
    await garantirContaCobrePagos(tx, 'mesa', 'est', 60, 'Cancelar este pedido') // conta 66 >= 60
  })

  await teste('subtotalDaConta soma a conta aberta (entregues não pagos inclusos) e pode simular sem um pedido', async () => {
    let filtro: any
    const tx: any = {
      pedido: {
        findMany: async (arg: any) => {
          filtro = arg.where
          return [{ total: 50 }, { total: 20.5 }]
        },
      },
    }
    assert.equal(await subtotalDaConta(tx, 'mesa', 'est'), 70.5)
    // o filtro é o da conta aberta: em andamento OU entregue, não liquidado e não pago
    assert.deepEqual(filtro.status.in, ['RECEBIDO', 'PREPARO', 'PRONTO', 'ENTREGUE'])
    assert.equal(filtro.liquidado_em, null)
    assert.deepEqual(filtro.NOT, { pagamento: { is: { status: 'CONFIRMADO' } } })
    assert.equal(filtro.id, undefined)
    await subtotalDaConta(tx, 'mesa', 'est', { ignorarPedidoId: 'p1' })
    assert.deepEqual(filtro.id, { not: 'p1' })
  })

  await teste('filtroContaAberta inclui pedidos entregues e exclui pagos/encerrados', () => {
    const f = filtroContaAberta('m1', 'e1')
    assert.equal(f.mesa_id, 'm1')
    assert.equal(f.estabelecimento_id, 'e1')
    assert.ok(f.status.in.includes('ENTREGUE'))
    assert.ok(!(f.status.in as string[]).includes('CANCELADO'))
    assert.equal(f.liquidado_em, null)
  })

  await teste('travarMesa trava cada mesa uma vez e em ordem fixa (evita deadlock)', async () => {
    const travadas: string[] = []
    const tx: any = { $queryRaw: async (_s: TemplateStringsArray, id: string) => { travadas.push(id) } }
    await travarMesa(tx, 'b', 'a', 'b')
    assert.deepEqual(travadas, ['a', 'b'])
  })

  console.log(`\n${total} testes${process.exitCode ? ' — COM FALHAS' : ' — todos passaram'}`)
}

void main()
