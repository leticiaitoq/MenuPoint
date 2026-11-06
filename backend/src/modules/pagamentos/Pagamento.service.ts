import { AppError } from '@shared/errors/AppError'
import { PagamentoRepository } from './Pagamento.repository'
import {
  CriarPagamentoDTO,
  ConfirmarPagamentoDTO,
  EstornarPagamentoDTO,
  FinalizarMesaDTO,
} from './Pagamento.schema'
import prisma from '@config/prisma'
import {
  TAXA_SERVICO_PERCENTUAL,
  CUPONS,
  TETO_DESCONTO_MANUAL_PERCENTUAL,
  filtroContaAberta,
  travarMesa,
} from './conta'
import { registrarAuditoria } from './auditoria'

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

    // Pedido de mesa é pago pelo fechamento da conta (o pagamento "por pedido" deixaria os
    // pagamentos parciais da mesa sobrando e o fechamento passaria a dar 409)
    if (pedido.mesa_id && !pedido.liquidado_em) {
      throw new AppError(
        'Este pedido faz parte da conta de uma mesa. Receba pelo Caixa (fechar conta ou pagamento parcial).',
        409
      )
    }

    // Verifica se já existe pagamento para este pedido
    const pagamentoExistente = await this.repository.findByPedido(data.pedido_id)
    if (pagamentoExistente) {
      throw new AppError('Já existe um pagamento registrado para este pedido', 409)
    }

    // O valor é SEMPRE o total do pedido no banco; desconto não é aceito neste fluxo
    // (descontos passam pelo fechamento da mesa, com motivo e auditoria)
    const total = Number(pedido.total)
    return this.repository.create({
      ...data,
      valor: total,
      valor_original: total,
      desconto_percentual: 0,
      desconto_valor: 0,
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
    estornado_por_id: string,
    estabelecimento_id: string
  ) {
    const pagamento = await this.findById(id, estabelecimento_id)

    if ((pagamento as any).status !== 'CONFIRMADO') {
      throw new AppError(
        'Apenas pagamentos confirmados podem ser estornados',
        400
      )
    }

    return prisma.$transaction(async (tx) => {
      // Condição de status no update: dois estornos simultâneos não passam os dois
      const r = await tx.pagamento.updateMany({
        where: { id, estabelecimento_id, status: 'CONFIRMADO' },
        data: {
          status: 'ESTORNADO',
          estornado_em: new Date(),
          estornado_por_id,
          estorno_motivo: data.observacoes,
        },
      })
      if (r.count === 0) {
        throw new AppError('Este pagamento já foi estornado', 409)
      }
      await registrarAuditoria(tx, {
        estabelecimento_id,
        usuario_id: estornado_por_id,
        acao: 'PAGAMENTO_ESTORNADO',
        entidade: 'Pagamento',
        entidade_id: id,
        motivo: data.observacoes,
        dados: {
          valor: Number((pagamento as any).valor),
          metodo: (pagamento as any).metodo,
          pedido_id: (pagamento as any).pedido_id,
        },
      })
      return tx.pagamento.findUnique({ where: { id } })
    })
  }

  // Caixa — PAGAMENTO INTEIRO: fecha a conta de uma mesa de uma vez.
  // Numa transação: confirma o pagamento de cada pedido da conta aberta (o valor é rateado entre
  // eles, com taxa de serviço e desconto), marca os pedidos como ENTREGUE e libera a mesa.
  async finalizarMesa(
    mesa_id: string,
    data: FinalizarMesaDTO,
    confirmado_por_id: string,
    perfil: string,
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
          itens: { select: { id: true, produto_id: true, quantidade: true, status: true } },
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
      const totalBruto = arredondar(subtotal + taxaTotal)

      // Desconto: o servidor decide o valor. Cupom = código validado aqui; manual = com teto por
      // perfil e motivo obrigatório. Os dois juntos não são aceitos (evita acumular descontos).
      if (data.cupom && data.desconto_valor > 0) {
        throw new AppError('Use cupom OU desconto manual, não os dois', 400)
      }
      let desconto = 0
      let descontoMotivo: string | null = null
      if (data.cupom) {
        const cupom = CUPONS[data.cupom]
        if (!cupom) throw new AppError('Cupom inválido', 400)
        desconto = arredondar((subtotal * cupom.percentual) / 100)
        descontoMotivo = `Cupom ${data.cupom} (${cupom.percentual}%)`
      } else if (data.desconto_valor > 0) {
        const teto = TETO_DESCONTO_MANUAL_PERCENTUAL[perfil] ?? 0
        if (data.desconto_valor > arredondar((totalBruto * teto) / 100) + 0.005) {
          throw new AppError(
            `Desconto acima do limite do seu perfil (${teto}% da conta). Peça a um administrador.`,
            403
          )
        }
        desconto = arredondar(data.desconto_valor)
        descontoMotivo = data.desconto_motivo ?? null
      }
      if (desconto > totalBruto) {
        throw new AppError('O desconto não pode ser maior que o total da conta', 400)
      }
      const totalAPagar = arredondar(totalBruto - desconto)

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

        const desconto_pedido = ultimo
          ? arredondar(desconto - descontoJaRateado)
          : subtotal > 0 ? arredondar((desconto * base) / subtotal) : 0
        const valor = ultimo
          ? arredondar(totalAPagar - valorJaRateado)
          : arredondar(base + taxa - desconto_pedido)

        valorJaRateado = arredondar(valorJaRateado + valor)
        descontoJaRateado = arredondar(descontoJaRateado + desconto_pedido)

        const dados = {
          valor,
          metodo,
          status: 'CONFIRMADO' as const,
          confirmado_por_id,
          confirmado_em: agora,
          valor_original: arredondar(base + taxa),
          desconto_valor: desconto_pedido,
          desconto_motivo: descontoMotivo,
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

      if (desconto > 0) {
        await registrarAuditoria(tx, {
          estabelecimento_id,
          usuario_id: confirmado_por_id,
          acao: 'DESCONTO_APLICADO',
          entidade: 'Mesa',
          entidade_id: mesa_id,
          motivo: descontoMotivo,
          dados: { desconto, subtotal, taxa_servico: taxaTotal, cupom: data.cupom ?? null, perfil },
        })
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
      // Fechar a conta entrega o que ainda estava na cozinha: todos os itens ficam ENTREGUE
      await tx.itemPedido.updateMany({
        where: { pedido_id: { in: pedidos.map((p) => p.id) }, status: { not: 'ENTREGUE' } },
        data: { status: 'ENTREGUE' },
      })

      // Soma nas vendas do produto SÓ o que ainda não tinha sido contado: os pedidos entregues
      // antes pelo fluxo normal já foram somados na hora da entrega (evita contar duas vezes)
      const vendidos = new Map<string, number>()
      // (itens entregues um a um na Fila também já foram somados na hora, então ficam de fora)
      aindaNaoEntregues.forEach((p) =>
        p.itens
          .filter((i) => i.status !== 'ENTREGUE')
          .forEach((i) =>
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
        desconto,
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
