import { Prisma } from '@prisma/client'
import { AppError } from '@shared/errors/AppError'

// Regras financeiras da conta de mesa num lugar só (pagamento inteiro, parcial, abatimento e
// as proteções dos pedidos usam as MESMAS funções, então os valores nunca divergem).

/**
 * Taxa de serviço das contas de mesa. Quem manda é o servidor: o percentual que o front envia é ignorado.
 * (Para torná-la configurável por restaurante será preciso um campo novo em `estabelecimentos`.)
 */
export const TAXA_SERVICO_PERCENTUAL = 10

export const STATUS_EM_ANDAMENTO: ('RECEBIDO' | 'PREPARO' | 'PRONTO')[] = ['RECEBIDO', 'PREPARO', 'PRONTO']

/** Arredondamento monetário padrão (centavos) */
export const r2 = (v: number) => Math.round(v * 100) / 100

export const calcularTaxa = (subtotal: number) => r2((subtotal * TAXA_SERVICO_PERCENTUAL) / 100)
export const totalComTaxa = (subtotal: number) => r2(subtotal + calcularTaxa(subtotal))

export type Tx = Prisma.TransactionClient

/**
 * Trava a(s) linha(s) da(s) mesa(s) até o fim da transação (SELECT ... FOR UPDATE).
 * Duas operações financeiras na mesma mesa passam a acontecer uma de cada vez, então a checagem
 * de saldo feita dentro da transação continua valendo na hora de gravar.
 * Ids são travados em ordem fixa para evitar deadlock entre transferências cruzadas.
 */
export async function travarMesa(tx: Tx, ...mesaIds: string[]) {
  const ids = Array.from(new Set(mesaIds)).sort()
  for (const id of ids) {
    await tx.$queryRaw`SELECT id FROM mesas WHERE id = ${id}::uuid FOR UPDATE`
  }
}

/** Soma dos pagamentos parciais/abatimentos ainda não liquidados da mesa */
export async function totalPagoEmParciais(tx: Tx, mesa_id: string, estabelecimento_id: string) {
  const abertos = await tx.pagamentoMesa.findMany({
    where: { mesa_id, estabelecimento_id, liquidado_em: null },
    select: { valor: true },
  })
  return r2(abertos.reduce((s, p) => s + Number(p.valor), 0))
}

/**
 * Subtotal (sem taxa) da conta aberta da mesa: pedidos em andamento ainda não pagos.
 * `ignorarPedidoId` serve para simular "como ficaria a conta sem este pedido".
 */
export async function subtotalDaConta(
  tx: Tx,
  mesa_id: string,
  estabelecimento_id: string,
  opcoes: { ignorarPedidoId?: string } = {}
) {
  const pedidos = await tx.pedido.findMany({
    where: {
      mesa_id,
      estabelecimento_id,
      status: { in: STATUS_EM_ANDAMENTO },
      ...(opcoes.ignorarPedidoId && { id: { not: opcoes.ignorarPedidoId } }),
    },
    select: { total: true, pagamento: { select: { status: true } } },
  })
  return r2(
    pedidos
      .filter((p) => p.pagamento?.status !== 'CONFIRMADO')
      .reduce((s, p) => s + Number(p.total), 0)
  )
}

/** true se a conta (com taxa) ficaria menor que o que já foi pago em parciais */
export const contaFicaAbaixoDoPago = (subtotalNovo: number, pago: number) =>
  pago > 0 && pago > totalComTaxa(subtotalNovo) + 0.005

/**
 * Impede cancelar/editar pedidos de um jeito que deixe a conta menor que o valor já pago em
 * parcial/abatimento (não existe crédito nem estorno automático para esse caso).
 */
export async function garantirContaCobrePagos(
  tx: Tx,
  mesa_id: string,
  estabelecimento_id: string,
  subtotalNovo: number,
  acao: string
) {
  const pago = await totalPagoEmParciais(tx, mesa_id, estabelecimento_id)
  if (contaFicaAbaixoDoPago(subtotalNovo, pago)) {
    throw new AppError(
      `${acao} deixaria a conta (R$ ${totalComTaxa(subtotalNovo).toFixed(2)}) menor que o já pago em parcial (R$ ${pago.toFixed(2)}). Desfaça o pagamento parcial primeiro.`,
      409
    )
  }
}

export interface ItemParaAlocar {
  item_pedido_id: string
  /** Unidades que o caixa quer quitar (já limitadas ao que falta pagar) */
  quantidade: number
  /** Valor de UMA unidade, já com taxa de serviço */
  custo_unitario: number
}

export interface Alocacao {
  item_pedido_id: string
  quantidade: number
  valor: number
}

/**
 * ABATIMENTO com itens: o valor quita unidades INTEIRAS, na ordem escolhida, até acabar o dinheiro.
 * O que sobrar fica como crédito geral da conta (não é perdido: já está em `valor` do pagamento).
 */
export function alocarUnidades(valor: number, itens: ItemParaAlocar[]): { alocacoes: Alocacao[]; sobra: number } {
  const alocacoes: Alocacao[] = []
  let sobra = r2(valor)
  for (const item of itens) {
    const unidades =
      item.custo_unitario > 0
        ? Math.min(item.quantidade, Math.floor((sobra + 0.005) / item.custo_unitario))
        : item.quantidade
    if (unidades > 0) {
      const v = r2(item.custo_unitario * unidades)
      alocacoes.push({ item_pedido_id: item.item_pedido_id, quantidade: unidades, valor: v })
      sobra = r2(sobra - v)
    }
  }
  return { alocacoes, sobra }
}

/**
 * Faz a soma das alocações bater EXATAMENTE com o valor registrado (a diferença, de centavos de
 * arredondamento, vai para a última alocação). Evita alocar mais do que foi realmente pago.
 */
export function ajustarAlocacoes(alocacoes: Alocacao[], valorAlvo: number): Alocacao[] {
  if (alocacoes.length === 0) return alocacoes
  const soma = r2(alocacoes.reduce((s, a) => s + a.valor, 0))
  const diferenca = r2(valorAlvo - soma)
  if (diferenca === 0) return alocacoes
  const copia = alocacoes.map((a) => ({ ...a }))
  const ultima = copia[copia.length - 1]
  ultima.valor = Math.max(r2(ultima.valor + diferenca), 0)
  return copia
}
