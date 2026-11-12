/**
 * Quem pode mudar o status de um pedido (TypeScript puro, sem banco).
 *
 * Regra: quem sabe do fato é quem muda o estado.
 *  - Cancelar: só ADMIN e CAIXA (mexe no dinheiro e na conta).
 *  - ENTREGUE em pedido de DELIVERY (entrega ou retirada): só ADMIN e CAIXA. A cozinha não sabe se
 *    o pedido saiu ou se o cliente retirou; quem despacha e recebe é o Caixa.
 *  - ENTREGUE em pedido de MESA: qualquer perfil do restaurante (o garçom serve o prato).
 *  - PREPARO e PRONTO: qualquer perfil do restaurante (a Fila é usada por todos).
 *
 * RECEBIDO → PREPARO não é restrito de propósito: enquanto não existir um estado de aceite do
 * delivery, essa é também a ação da cozinha na Fila.
 */
export type Modalidade = 'MESA' | 'ENTREGA' | 'RETIRADA'

const PERFIS_RESTAURANTE = ['ADMIN', 'ATENDENTE', 'CAIXA']
const PERFIS_GERENTES = ['ADMIN', 'CAIXA']

export function perfilPodeMudarStatus(perfil: string, modalidade: Modalidade | string, destino: string): boolean {
  // Qualquer outro perfil (ex.: CLIENTE) nunca muda o status por aqui
  if (!PERFIS_RESTAURANTE.includes(perfil)) return false

  if (destino === 'CANCELADO') return PERFIS_GERENTES.includes(perfil)
  if (destino === 'ENTREGUE' && modalidade !== 'MESA') return PERFIS_GERENTES.includes(perfil)

  return true
}

/**
 * Item de delivery nunca é entregue pela Fila (rota de itens): o delivery sai por inteiro,
 * pelo Caixa. Entregar item por item só faz sentido na mesa (levar a bebida antes do prato).
 */
export const itemPodeSerEntreguePelaFila = (modalidade: Modalidade | string): boolean => modalidade === 'MESA'
