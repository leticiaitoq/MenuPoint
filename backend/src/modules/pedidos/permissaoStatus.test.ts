/**
 * Testes da permissão por perfil nas mudanças de status. Sem framework: usa só o `assert` do Node.
 *
 *   cd backend
 *   npx ts-node -r tsconfig-paths/register --transpile-only src/modules/pedidos/permissaoStatus.test.ts
 */
import assert from 'node:assert/strict'
import { itemPodeSerEntreguePelaFila, perfilPodeMudarStatus } from './permissaoStatus'

let total = 0
const teste = (nome: string, fn: () => void) => {
  fn()
  total++
  console.log(`  ✓ ${nome}`)
}

const DELIVERY = ['ENTREGA', 'RETIRADA'] as const
const RESTAURANTE = ['ADMIN', 'ATENDENTE', 'CAIXA'] as const

teste('cancelar: só ADMIN e CAIXA, em qualquer modalidade', () => {
  for (const modalidade of ['MESA', ...DELIVERY]) {
    assert.equal(perfilPodeMudarStatus('ADMIN', modalidade, 'CANCELADO'), true)
    assert.equal(perfilPodeMudarStatus('CAIXA', modalidade, 'CANCELADO'), true)
    assert.equal(perfilPodeMudarStatus('ATENDENTE', modalidade, 'CANCELADO'), false)
  }
})

teste('ENTREGUE em delivery: só ADMIN e CAIXA', () => {
  for (const modalidade of DELIVERY) {
    assert.equal(perfilPodeMudarStatus('ADMIN', modalidade, 'ENTREGUE'), true)
    assert.equal(perfilPodeMudarStatus('CAIXA', modalidade, 'ENTREGUE'), true)
    assert.equal(perfilPodeMudarStatus('ATENDENTE', modalidade, 'ENTREGUE'), false)
  }
})

teste('ENTREGUE em mesa: qualquer perfil do restaurante (o garçom serve)', () => {
  for (const perfil of RESTAURANTE) {
    assert.equal(perfilPodeMudarStatus(perfil, 'MESA', 'ENTREGUE'), true)
  }
})

teste('PREPARO e PRONTO: qualquer perfil do restaurante, em qualquer modalidade', () => {
  for (const perfil of RESTAURANTE) {
    for (const modalidade of ['MESA', ...DELIVERY]) {
      assert.equal(perfilPodeMudarStatus(perfil, modalidade, 'PREPARO'), true)
      assert.equal(perfilPodeMudarStatus(perfil, modalidade, 'PRONTO'), true)
    }
  }
})

teste('perfil que não é do restaurante nunca muda status (ex.: CLIENTE)', () => {
  for (const destino of ['PREPARO', 'PRONTO', 'ENTREGUE', 'CANCELADO']) {
    assert.equal(perfilPodeMudarStatus('CLIENTE', 'MESA', destino), false)
    assert.equal(perfilPodeMudarStatus('', 'ENTREGA', destino), false)
  }
})

teste('item só é entregue pela Fila na mesa; delivery sai pelo Caixa', () => {
  assert.equal(itemPodeSerEntreguePelaFila('MESA'), true)
  assert.equal(itemPodeSerEntreguePelaFila('ENTREGA'), false)
  assert.equal(itemPodeSerEntreguePelaFila('RETIRADA'), false)
})

console.log(`\n${total} testes passaram.`)
