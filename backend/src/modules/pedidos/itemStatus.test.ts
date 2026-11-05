/**
 * Testes das regras de status por item. Sem framework: usa só o `assert` do Node.
 *
 *   cd backend
 *   npx ts-node -r tsconfig-paths/register --transpile-only src/modules/pedidos/itemStatus.test.ts
 */
import assert from 'node:assert/strict'
import { etapasAntesDe, proximaEtapa, statusDoPedido } from './itemStatus'

let total = 0
const teste = (nome: string, fn: () => void) => {
  fn()
  total++
  console.log(`  ✓ ${nome}`)
}

teste('proximaEtapa segue RECEBIDO → PREPARO → PRONTO → ENTREGUE', () => {
  assert.equal(proximaEtapa('RECEBIDO'), 'PREPARO')
  assert.equal(proximaEtapa('PREPARO'), 'PRONTO')
  assert.equal(proximaEtapa('PRONTO'), 'ENTREGUE')
  assert.equal(proximaEtapa('ENTREGUE'), null)
  assert.equal(proximaEtapa('CANCELADO'), null)
})

teste('o pedido fica na etapa do item mais atrasado', () => {
  assert.equal(statusDoPedido(['PRONTO', 'PREPARO']), 'PREPARO')
  assert.equal(statusDoPedido(['ENTREGUE', 'PRONTO']), 'PRONTO')
  assert.equal(statusDoPedido(['ENTREGUE', 'RECEBIDO', 'PRONTO']), 'RECEBIDO')
})

teste('só vira ENTREGUE quando todos os itens foram entregues', () => {
  assert.equal(statusDoPedido(['ENTREGUE', 'ENTREGUE']), 'ENTREGUE')
  assert.notEqual(statusDoPedido(['ENTREGUE', 'PRONTO']), 'ENTREGUE')
})

teste('sem itens válidos não há status', () => {
  assert.equal(statusDoPedido([]), null)
  assert.equal(statusDoPedido(['CANCELADO']), null)
})

teste('etapasAntesDe lista o que fica para trás ao avançar o pedido inteiro', () => {
  assert.deepEqual(etapasAntesDe('PREPARO'), ['RECEBIDO'])
  assert.deepEqual(etapasAntesDe('ENTREGUE'), ['RECEBIDO', 'PREPARO', 'PRONTO'])
  assert.deepEqual(etapasAntesDe('RECEBIDO'), [])
})

console.log(`\n${total} testes passaram.`)
