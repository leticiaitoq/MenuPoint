import { Prisma } from '@prisma/client'
import { Tx } from './conta'

export type AcaoFinanceira =
  | 'PAGAMENTO_MESA_DESFEITO'
  | 'PAGAMENTO_ESTORNADO'
  | 'DESCONTO_APLICADO'

interface RegistroAuditoria {
  estabelecimento_id: string
  usuario_id: string
  acao: AcaoFinanceira
  entidade: 'PagamentoMesa' | 'Pagamento' | 'Mesa' | 'Pedido'
  entidade_id?: string
  motivo?: string | null
  dados?: Prisma.InputJsonValue
}

/**
 * Grava quem fez o quê no dinheiro. Deve ser chamada DENTRO da mesma transação da ação,
 * para que a ação e o rastro nasçam (ou falhem) juntos.
 */
export async function registrarAuditoria(tx: Tx, r: RegistroAuditoria) {
  await tx.auditoriaFinanceira.create({
    data: {
      estabelecimento_id: r.estabelecimento_id,
      usuario_id: r.usuario_id,
      acao: r.acao,
      entidade: r.entidade,
      entidade_id: r.entidade_id ?? null,
      motivo: r.motivo ?? null,
      ...(r.dados !== undefined && { dados: r.dados }),
    },
  })
}
