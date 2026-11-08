/** npx ts-node -r tsconfig-paths/register --transpile-only src/shared/utils/periodo.test.ts */
import assert from 'node:assert/strict'
import { parsePeriodo } from './periodo'

assert.deepEqual(parsePeriodo(), {})
assert.ok(parsePeriodo('2026-11-01', '2026-11-30').data_fim instanceof Date)
assert.throws(() => parsePeriodo('abc'), /inválida/)
assert.throws(() => parsePeriodo('2026-12-01', '2026-11-01'), /depois/)
console.log('periodo: todos os testes passaram')
