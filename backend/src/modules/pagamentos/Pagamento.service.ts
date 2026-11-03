import { AppError } from '@shared/errors/AppError'
import { PagamentoRepository } from './Pagamento.repository'
import {
  CriarPagamentoDTO,
  ConfirmarPagamentoDTO,
  EstornarPagamentoDTO,
  FinalizarMesaDTO,
} from './Pagamento.schema'
import prisma from '@config/prisma'
import { TAXA_SERVICO_PERCENTUAL, filtroContaAberta, travarMesa } from './conta'

// O enum do banco não separa débito/crédito: os dois viram CARTAO (o detalhe vai em `observacoes`)
const METODO_DO_BANCO = {
  PIX: 'PIX_PRESENCIAL',
  DEBITO: 'CARTAO',
  CREDITO: 'CARTAO',
  DINHEIRO: 'DINHEIRO',
} as const

const ROTULO_FORMA = {
  PIX: 'Pix',
  DEBITO: 'Cartão de débito',
  CREDITO: 'Cartão de crédito',
  DINHEIRO: 'Dinheiro',
} as const

const arredondar = (v: number) => Math.round(v * 100) / 100

export class PagamentoService {
  constructor(private readonly repository: PagamentoRepository) {}

  async criar(data: CriarPagamentoDTO, estabelecimento_id: string) {
    // Verifica se o pedido existe e pertence ao estabelecimento
    const pedido = await prisma.pedido.findFirst({
      where: { id: data.pedido_id, estabelecimento_id },
    })

    if (!pedido) {
      throw new AppError('Pedido não encontrado', 404)
    }

    if (pedido.status === 'CANCELADO') {
      throw new AppError('Não é possível registrar pagamento de pedido cancelado', 400)
    }

    // Verifica se já existe pagamento para este pedido
    const pagamentoExistente = await this.repository.findByPedido(data.pedido_id)
    if (pagamentoExistente) {
      throw new AppError('Já existe um pagamento registrado para este pedido', 409)
    }

    return this.repository.create({
      ...data,
      estabelecimento_id,
    } as any)
  }

  async findById(id: string, estabelecimento_id: string) {
    const pagamento = await this.repository.findByIdCompleto(id)

    if (!pagamento) {
      throw new AppError('Pagamento não encontrado', 404)
    }

    if ((pagamento as any).estabelecimento_id !== estabelecimento_id) {
      throw new AppError('Acesso não autorizado', 403)
    }

    return pagamento
  }

  async findByPedido(pedido_id: string, estabelecimento_id: string) {
    // Confirma que o pedido pertence ao estabelecimento
    const pedido = await prisma.pedido.findFirst({
      where: { id: pedido_id, estabelecimento_id },
    })

    if (!pedido) {
      throw new AppError('Pedido não encontrado', 404)
    }

    const pagamento = await this.repository.findByPedido(pedido_id)
    if (!pagamento) {
      throw new AppError('Pagamento não encontrado para este pedido', 404)
    }

    return pagamento
  }

  async listar(
    estabelecimento_id: string,
    filtros?: {
      status?: string
      metodo?: string
      data_inicio?: Date
      data_fim?: Date
    }
  ) {
    return this.repository.findByEstabelecimento(estabelecimento_id, filtros)
  }

  async confirmar(
    id: string,
    data: ConfirmarPagamentoDTO,
    confirmado_por_id: string,
    estabelecimento_id: string
  ) {
    const pagamento = await this.findById(id, estabelecimento_id)

    if ((pagamento as any).status !== 'PENDENTE') {
      throw new AppError(
        `Pagamento não pode ser confirmado pois está "${(pagamento as any).status}"`,
        400
      )
    }

    return this.repository.update(id, {
      status: 'CONFIRMADO',
      confirmado_por_id,
      confirmado_em: new Date(),
      ...(data.comprovante_url && { comprovante_url: data.comprovante_url }),
      ...(data.observacoes && { observacoes: data.observacoes }),
    })
  }

  async estornar(
    id: string,
    data: EstornarPagamentoDTO,
    estabelecimento_id: string
  ) {
    const pagamento = await this.findById(id, estabelecimento_id)

    if ((pagamento as any).status !== 'CONFIRMADO') {
      throw new AppError(
        'Apenas pagamentos confirmados podem ser estornados',
        400
      )
    }

    return this.repository.update(id, {
      status: 'ESTORNADO',
      observacoes: data.observacoes,
    })
  }

  // Caixa — PAGAMENTO INTEIRO: fecha a conta de uma mesa de uma vez.
  // Numa transação: confirma o pagamento de cada pedido da conta aberta (o valor é rateado entre
  // eles, com taxa de serviço e desconto), marca os pedidos como ENTREGUE e libera a mesa.
  async finalizarMesa(
    mesa_id: string,
    data: FinalizarMesaDTO,
    confirmado_por_id: string,
    estabelecimento_id: string
  ) {
    const mesa = await prisma.mesa.findFirst({
      where: { id: mesa_id, estabelecimento_id },
      select: { id: true, numero: true },
    })
    if (!mesa) throw new AppError('Mesa não encontrada', 404)

    return prisma.$transaction(async (tx) => {
      // Uma operação financeira por vez na mesa (o saldo lido abaixo vale até o fim da transação)
      await travarMesa(tx, mesa_id)

      const pedidos = await tx.pedido.findMany({
        where: filtroContaAberta(mesa_id, estabelecimento_id),
        include: {
          itens: { select: { produto_id: true, quantidade: true } },
          pagamento: { select: { id: true, status: true } },
        },
        orderBy: { numero_pedido: 'asc' },
      })
      if (pedidos.length === 0) {
        throw new AppError(`A Mesa ${mesa.numero} não tem conta aberta`, 400)
      }

      // Pedido que já tem pagamento confirmado não entra na conta (só é encerrado)
      const aPagar = pedidos.filter((p) => p.pagamento?.status !== 'CONFIRMADO')
      if (aPagar.length === 0) {
        throw new AppError('Todos os pedidos desta mesa já estão pagos', 400)
      }

      // A taxa é do servidor: o percentual enviado pelo front é ignorado
      const pct = TAXA_SERVICO_PERCENTUAL
      const subtotal = arredondar(aPagar.reduce((s, p) => s + Number(p.total), 0))
      const taxaTotal = arredondar((subtotal * pct) / 100)
      if (data.desconto_valor > subtotal + taxaTotal) {
        throw new AppError('O desconto não pode ser maior que o total da conta', 400)
      }
      const totalAPagar = arredondar(subtotal + taxaTotal - data.desconto_valor)

      // Pagamentos parciais / abatimentos já feitos: o cliente só paga o que falta
      const parciais = await tx.pagamentoMesa.findMany({
        where: { mesa_id, estabelecimento_id, liquidado_em: null },
        select: { valor: true, metodo: true },
        orderBy: { criado_em: 'asc' },
      })
      const jaPago = arredondar(parciais.reduce((s, p) => s + Number(p.valor), 0))
      const restante = arredondar(totalAPagar - jaPago)

      if (restante < -0.005) {
        throw new AppError(
          `Os pagamentos parciais (R$ ${jaPago.toFixed(2)}) superam o total da conta (R$ ${totalAPagar.toFixed(2)}). Reduza o desconto.`,
          409
        )
      }
      if (restante > 0.004 && !data.forma) {
        throw new AppError('Informe a forma de pagamento', 400)
      }

      let troco = 0
      if (data.forma === 'DINHEIRO' && restante > 0.004) {
        if (data.valor_recebido === undefined || data.valor_recebido < restante) {
          throw new AppError('O valor recebido é menor que o valor que falta pagar', 400)
        }
        troco = arredondar(data.valor_recebido - restante)
      }

      const agora = new Date()
      // Conta já quitada em parciais: mantém o método do último pagamento
      const metodo = data.forma
        ? METODO_DO_BANCO[data.forma]
        : (parciais.length > 0 ? parciais[parciais.length - 1].metodo : 'PIX_PRESENCIAL')
      const detalhe = [
        data.forma ? ROTULO_FORMA[data.forma] : null,
        jaPago > 0 ? `inclui R$ ${jaPago.toFixed(2)} já pagos em parcial` : null,
        troco > 0 ? `troco R$ ${troco.toFixed(2)}` : null,
        data.observacoes?.trim() || null,
      ].filter(Boolean).join(' · ')

      // Rateio: cada pedido paga a sua parte; o último absorve a diferença de centavos
      let valorJaRateado = 0
      let descontoJaRateado = 0
      for (let i = 0; i < aPagar.length; i++) {
        const p = aPagar[i]
        const base = Number(p.total)
        const taxa = arredondar((base * pct) / 100)
        const ultimo = i === aPagar.length - 1

        const desconto = ultimo
          ? arredondar(data.desconto_valor - descontoJaRateado)
          : subtotal > 0 ? arredondar((data.desconto_valor * base) / subtotal) : 0
        const valor = ultimo
          ? arredondar(totalAPagar - valorJaRateado)
          : arredondar(base + taxa - desconto)

        valorJaRateado = arredondar(valorJaRateado + valor)
        descontoJaRateado = arredondar(descontoJaRateado + desconto)

        const dados = {
          valor,
          metodo,
          status: 'CONFIRMADO' as const,
          confirmado_por_id,
          confirmado_em: agora,
          valor_original: arredondar(base + taxa),
          desconto_valor: desconto,
          observacoes: detalhe,
        }

        if (p.pagamento) {
          await tx.pagamento.update({ where: { id: p.pagamento.id }, data: dados })
        } else {
          await tx.pagamento.create({
            data: { pedido_id: p.id, estabelecimento_id, ...dados },
          })
        }
      }

      // Encerra todos os pedidos da conta. Os que já tinham sido entregues na mesa só saem da conta
      // (liquidado_em); os que ainda não tinham sido entregues passam a ENTREGUE agora.
      const aindaNaoEntregues = pedidos.filter((p) => p.status !== 'ENTREGUE')

      await tx.pedido.updateMany({
        where: { id: { in: pedidos.map((p) => p.id) } },
        data: { status: 'ENTREGUE', forma_pagamento: metodo, liquidado_em: agora },
      })
      if (aindaNaoEntregues.length > 0) {
        await tx.pedido.updateMany({
          where: { id: { in: aindaNaoEntregues.map((p) => p.id) } },
          data: { entregue_em: agora },
        })
      }

      // Soma nas vendas do produto SÓ o que ainda não tinha sido contado: os pedidos entregues
      // antes pelo fluxo normal já foram somados na hora da entrega (evita contar duas vezes)
      const vendidos = new Map<string, number>()
      aindaNaoEntregues.forEach((p) =>
        p.itens.forEach((i) =>
          vendidos.set(i.produto_id, (vendidos.get(i.produto_id) ?? 0) + i.quantidade)
        )
      )
      for (const [produto_id, quantidade] of vendidos) {
        await tx.produto.update({
          where: { id: produto_id },
          data: { total_vendido: { increment: quantidade } },
        })
      }

      // Os pagamentos parciais fazem parte desta conta: deixam de ficar "abertos"
      await tx.pagamentoMesa.updateMany({
        where: { mesa_id, estabelecimento_id, liquidado_em: null },
        data: { liquidado_em: agora },
      })

      await tx.mesa.update({ where: { id: mesa_id }, data: { status: 'LIVRE' } })

      return {
        subtotal,
        taxa_servico: taxaTotal,
        desconto: data.desconto_valor,
        total: totalAPagar,
        ja_pago_parcial: jaPago,
        restante,
        valor_recebido: data.valor_recebido ?? null,
        troco,
        pedidos: pedidos.map((p) => p.numero_pedido),
      }
    })
  }
}
