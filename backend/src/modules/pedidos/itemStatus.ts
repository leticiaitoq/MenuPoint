/**
 * Regras do status por item (TypeScript puro, sem banco).
 *
 * Cada item do pedido anda sozinho pela cozinha:
 *   RECEBIDO → PREPARO → PRONTO → ENTREGUE
 * O pedido inteiro fica na etapa do item MAIS ATRASADO — assim o resto do sistema
 * (Caixa, conta da mesa, aviso ao cliente) continua entendendo o status do pedido
 * como antes: o pedido só está "PRONTO" quando todos os itens estão prontos e só
 * está "ENTREGUE" quando todos foram entregues.
 */
export const ETAPAS = ['RECEBIDO', 'PREPARO', 'PRONTO', 'ENTREGUE'] as const
export type EtapaItem = (typeof ETAPAS)[number]

export const posicaoEtapa = (status: string): number => ETAPAS.indexOf(status as EtapaItem)

/** Próxima etapa permitida para um item (null = já foi entregue ou status desconhecido). */
export function proximaEtapa(status: string): EtapaItem | null {
  const i = posicaoEtapa(status)
  return i >= 0 && i < ETAPAS.length - 1 ? ETAPAS[i + 1] : null
}

/** Status do pedido a partir dos itens: o mais atrasado. Sem itens válidos → null. */
export function statusDoPedido(statusDosItens: string[]): EtapaItem | null {
  const validos = statusDosItens.filter((s) => posicaoEtapa(s) >= 0)
  if (validos.length === 0) return null
  return validos.reduce((menor, s) => (posicaoEtapa(s) < posicaoEtapa(menor) ? s : menor)) as EtapaItem
}

/** Etapas que ficam ANTES de `status` (os itens nelas são alcançados quando o pedido inteiro avança). */
export const etapasAntesDe = (status: string): EtapaItem[] => ETAPAS.slice(0, Math.max(posicaoEtapa(status), 0))
