import prisma from '@config/prisma'
import { AppError } from '@shared/errors/AppError'
import { MesaService } from './Mesa.service'
import { MesaRepository } from './Mesa.repository'
import {
  filtroContaAberta,
  calcularTaxa,
  totalComTaxa,
  totalPagoEmParciais,
  TAXA_SERVICO_PERCENTUAL,
  r2,
} from '@modules/pagamentos/conta'

export type FormaPagamentoConta = 'PIX_PRESENCIAL' | 'DINHEIRO' | 'CARTAO'

const mesaService = new MesaService(new MesaRepository())

/** Itens que ainda não chegaram à mesa (cozinha ainda não entregou) */
const ITEM_SEM_ENTREGA = { status: { notIn: ['ENTREGUE', 'CANCELADO'] as ('ENTREGUE' | 'CANCELADO')[] } }

const lista = (nomes: string[]) =>
  nomes.length <= 1 ? nomes.join('') : `${nomes.slice(0, -1).join(', ')} e ${nomes[nomes.length - 1]}`

export class ChamadoMesaService {
  // ── Cliente local (QR Code, sem login) ─────────────────────────────────────

  /**
   * "Chamar garçom". Se a mesa já tem um chamado de garçom aberto, não cria outro:
   * a equipe já foi avisada e o cliente recebe a mesma confirmação.
   */
  async chamarGarcom(token: string) {
    const mesa = await mesaService.findByToken(token) // 404 QR inválido, 400 mesa/restaurante inativos

    const aberto = await prisma.chamadoMesa.findFirst({
      where: { mesa_id: mesa.id, tipo: 'GARCOM', status: 'ABERTO' },
      select: { id: true },
    })
    if (aberto) return { id: aberto.id, ja_aberto: true }

    const chamado = await prisma.chamadoMesa.create({
      data: { estabelecimento_id: mesa.estabelecimento_id, mesa_id: mesa.id, tipo: 'GARCOM' },
      select: { id: true },
    })
    return { id: chamado.id, ja_aberto: false }
  }

  /**
   * "Fechar a conta". 409 se a mesa não tem nada em aberto para pagar.
   * Pedido de conta repetido não duplica: só atualiza a forma de pagamento avisada.
   */
  async pedirConta(token: string, forma_pagamento?: FormaPagamentoConta) {
    const mesa = await mesaService.findByToken(token)

    // Mesma definição de "conta aberta" que o Caixa usa
    const pedidosDaConta = await prisma.pedido.findMany({
      where: filtroContaAberta(mesa.id, mesa.estabelecimento_id),
      select: {
        id: true,
        itens: { where: ITEM_SEM_ENTREGA, select: { quantidade: true, produto: { select: { nome: true } } } },
      },
    })

    if (pedidosDaConta.length === 0) {
      throw new AppError('Ainda não há pedidos em aberto nesta mesa. Faça um pedido para poder fechar a conta.', 409)
    }

    // Só dá para pedir a conta quando tudo o que foi pedido já chegou à mesa
    const naoEntregues = pedidosDaConta.flatMap((p) => p.itens)
    if (naoEntregues.length > 0) {
      const unidades = naoEntregues.reduce((acc, i) => acc + i.quantidade, 0)
      const nomes = Array.from(new Set(naoEntregues.map((i) => i.produto.nome))).slice(0, 3)
      const resumo = nomes.length ? ` (${lista(nomes)}${new Set(naoEntregues.map((i) => i.produto.nome)).size > 3 ? ' e outros' : ''})` : ''
      throw new AppError(
        `Não dá para fechar a conta agora: ${unidades === 1 ? 'ainda falta 1 item ser entregue' : `ainda faltam ${unidades} itens serem entregues`} na mesa${resumo}. Assim que chegar, é só pedir a conta de novo.`,
        409
      )
    }

    const aberto = await prisma.chamadoMesa.findFirst({
      where: { mesa_id: mesa.id, tipo: 'CONTA', status: 'ABERTO' },
      select: { id: true },
    })
    if (aberto) {
      if (forma_pagamento) {
        await prisma.chamadoMesa.update({ where: { id: aberto.id }, data: { forma_pagamento } })
      }
      return { id: aberto.id, ja_aberto: true }
    }

    const chamado = await prisma.chamadoMesa.create({
      data: {
        estabelecimento_id: mesa.estabelecimento_id,
        mesa_id: mesa.id,
        tipo: 'CONTA',
        ...(forma_pagamento && { forma_pagamento }),
      },
      select: { id: true },
    })
    return { id: chamado.id, ja_aberto: false }
  }

  /**
   * "Ver conta" do cliente local: o que a mesa já consumiu e quanto será cobrado, com os MESMOS
   * números do Caixa (conta aberta, taxa de serviço e pagamentos parciais já feitos).
   * Não mostra nome, telefone nem observações de ninguém.
   */
  async contaPublica(token: string) {
    const mesa = await mesaService.findByToken(token)

    const pedidos = await prisma.pedido.findMany({
      where: filtroContaAberta(mesa.id, mesa.estabelecimento_id),
      orderBy: { criado_em: 'asc' },
      select: {
        id: true,
        numero_pedido: true,
        status: true,
        criado_em: true,
        total: true,
        itens: {
          where: { status: { not: 'CANCELADO' } },
          select: { id: true, quantidade: true, preco_total: true, status: true, produto: { select: { nome: true } } },
        },
      },
    })

    const subtotal = r2(pedidos.reduce((acc, p) => acc + Number(p.total), 0))
    const taxa = calcularTaxa(subtotal)
    const totalComServico = totalComTaxa(subtotal)
    const jaPago = await totalPagoEmParciais(prisma, mesa.id, mesa.estabelecimento_id)
    const itensSemEntrega = pedidos.reduce(
      (acc, p) => acc + p.itens.filter((i) => i.status !== 'ENTREGUE').length,
      0
    )

    return {
      mesa: { numero: mesa.numero },
      pedidos: pedidos.map((p) => ({
        id: p.id,
        numero_pedido: p.numero_pedido,
        status: p.status,
        criado_em: p.criado_em,
        total: Number(p.total),
        itens: p.itens.map((i) => ({
          id: i.id,
          nome: i.produto.nome,
          quantidade: i.quantidade,
          preco_total: Number(i.preco_total),
          entregue: i.status === 'ENTREGUE',
        })),
      })),
      subtotal,
      taxa_servico_percentual: TAXA_SERVICO_PERCENTUAL,
      taxa_servico: taxa,
      total_com_servico: totalComServico,
      ja_pago: jaPago,
      restante: r2(Math.max(0, totalComServico - jaPago)),
      itens_sem_entrega: itensSemEntrega,
    }
  }

  // ── Restaurante (login) ────────────────────────────────────────────────────

  /** Chamados em aberto, do mais antigo para o mais novo (quem espera há mais tempo aparece primeiro). */
  async listarAbertos(estabelecimento_id: string) {
    const abertos = await prisma.chamadoMesa.findMany({
      where: { estabelecimento_id, status: 'ABERTO' },
      orderBy: { criado_em: 'asc' },
      select: {
        id: true,
        tipo: true,
        forma_pagamento: true,
        criado_em: true,
        mesa: { select: { id: true, numero: true } },
      },
    })

    // Pedido de conta cuja mesa já foi quitada no Caixa ficou velho: dá baixa sozinho.
    const doTipoConta = abertos.filter((c) => c.tipo === 'CONTA')
    if (doTipoConta.length === 0) return abertos

    const comContaAberta = await prisma.pedido.findMany({
      where: {
        estabelecimento_id,
        mesa_id: { in: doTipoConta.map((c) => c.mesa.id) },
        status: { in: ['RECEBIDO', 'PREPARO', 'PRONTO', 'ENTREGUE'] },
        liquidado_em: null,
        NOT: { pagamento: { is: { status: 'CONFIRMADO' } } },
      },
      select: { mesa_id: true },
      distinct: ['mesa_id'],
    })
    const mesasComConta = new Set(comContaAberta.map((p) => p.mesa_id))
    const obsoletos = doTipoConta.filter((c) => !mesasComConta.has(c.mesa.id)).map((c) => c.id)

    if (obsoletos.length > 0) {
      await prisma.chamadoMesa.updateMany({
        where: { id: { in: obsoletos } },
        data: { status: 'ATENDIDO', atendido_em: new Date() },
      })
    }
    return abertos.filter((c) => !obsoletos.includes(c.id))
  }

  /** Dá baixa no chamado (o garçom foi até a mesa). Repetir não dá erro. */
  async atender(id: string, estabelecimento_id: string, usuario_id: string) {
    const chamado = await prisma.chamadoMesa.findFirst({
      where: { id, estabelecimento_id },
      select: { id: true, status: true },
    })
    if (!chamado) throw new AppError('Chamado não encontrado', 404)

    if (chamado.status === 'ATENDIDO') return { id, status: 'ATENDIDO' as const }

    await prisma.chamadoMesa.update({
      where: { id },
      data: { status: 'ATENDIDO', atendido_em: new Date(), atendido_por_id: usuario_id },
    })
    return { id, status: 'ATENDIDO' as const }
  }
}
