import { AppError } from '@shared/errors/AppError'
import { PedidoRepository } from './Pedido.repository'
import { CriarPedidoDTO, AtualizarStatusPedidoDTO } from './Pedido.schema'
import prisma from '@config/prisma'
import { enviarMensagemWhatsApp } from '@config/whatsapp'
import { templateNovoPedido, templateStatusPedido } from '@shared/whatsapp/template'
import { env } from '@config/env'

export class PedidoService {
  constructor(private readonly repository: PedidoRepository) {}

  async criar(data: CriarPedidoDTO, estabelecimento_id: string) {
    let subtotal = 0

    for (const item of data.itens) {
      const produto = await prisma.produto.findFirst({
        where: { id: item.produto_id, estabelecimento_id },
      })

      if (!produto) {
        throw new AppError(`Produto ${item.produto_id} não encontrado`, 404)
      }

      if (!produto.disponivel) {
        throw new AppError(`Produto "${produto.nome}" não está disponível`, 400)
      }

      const totalAdicionais = item.itens_adicionais.reduce(
        (acc, ad) => acc + ad.preco_extra,
        0
      )

      subtotal += (item.preco_unitario + totalAdicionais) * item.quantidade
    }

    // Valida e ocupa a mesa se modalidade MESA
    if (data.modalidade === 'MESA' && data.mesa_id) {
      const mesa = await prisma.mesa.findFirst({
        where: { id: data.mesa_id, estabelecimento_id, ativo: true },
      })

      if (!mesa) {
        throw new AppError('Mesa não encontrada', 404)
      }

      await prisma.mesa.update({
        where: { id: data.mesa_id },
        data: { status: 'OCUPADA' },
      })
    }

    const total = subtotal + (data.taxa_entrega ?? 0) - (data.desconto ?? 0)

    const pedido = await this.repository.criarComItens({
      ...data,
      estabelecimento_id,
      subtotal,
      total: Math.max(total, 0),
    })

    // ── Notificação WhatsApp para o ESTABELECIMENTO ───────────────────────
    // Roda em background — não bloqueia a resposta ao cliente
    if (env.ZAPI_INSTANCE_ID) {
      prisma.estabelecimento
        .findUnique({
          where: { id: estabelecimento_id },
          select: { whatsapp: true },
        })
        .then((estabelecimento: { whatsapp: string | null } | null) => {
          if (!estabelecimento?.whatsapp) return

          const mensagem = templateNovoPedido({
            numero_pedido: pedido.numero_pedido,
            cliente_nome: pedido.cliente_nome,
            cliente_telefone: pedido.cliente_telefone,
            modalidade: pedido.modalidade,
            total: Number(pedido.total),
            itens: (pedido.itens as any[]).map((i) => ({
              nome: i.produto?.nome ?? 'Produto',
              quantidade: i.quantidade,
            })),
          })

          enviarMensagemWhatsApp(estabelecimento.whatsapp, mensagem)
            .then((enviado) => {
              if (enviado) {
                prisma.pedido
                  .update({
                    where: { id: pedido.id },
                    data: { whatsapp_enviado: true },
                  })
                  .catch(console.error)
              }
            })
            .catch(console.error)
        })
        .catch(console.error)
    }
    // ─────────────────────────────────────────────────────────────────────

    return pedido
  }

  async findById(id: string, estabelecimento_id: string) {
    const pedido = await this.repository.findByIdCompleto(id)

    if (!pedido) {
      throw new AppError('Pedido não encontrado', 404)
    }

    if ((pedido as any).estabelecimento_id !== estabelecimento_id) {
      throw new AppError('Acesso não autorizado', 403)
    }

    return pedido
  }

  async listar(
    estabelecimento_id: string,
    filtros?: {
      status?: string
      modalidade?: string
      data_inicio?: Date
      data_fim?: Date
    }
  ) {
    return this.repository.findByEstabelecimento(estabelecimento_id, filtros)
  }

  async atualizarStatus(
    id: string,
    data: AtualizarStatusPedidoDTO,
    estabelecimento_id: string
  ) {
    const pedido = await this.findById(id, estabelecimento_id)

    const fluxoValido: Record<string, string[]> = {
      RECEBIDO: ['PREPARO', 'CANCELADO'],
      PREPARO: ['PRONTO', 'CANCELADO'],
      PRONTO: ['ENTREGUE', 'CANCELADO'],
      ENTREGUE: [],
      CANCELADO: [],
    }

    const statusAtual = (pedido as any).status
    const statusPermitidos = fluxoValido[statusAtual] ?? []

    if (!statusPermitidos.includes(data.status)) {
      throw new AppError(
        `Não é possível alterar o status de "${statusAtual}" para "${data.status}"`,
        400
      )
    }

    if (data.status === 'CANCELADO' && !data.cancelamento_motivo) {
      throw new AppError('Motivo de cancelamento é obrigatório', 400)
    }

    const pedidoAtualizado = await this.repository.update(id, {
      status: data.status,
      ...(data.cancelamento_motivo && {
        cancelamento_motivo: data.cancelamento_motivo,
      }),
      ...(data.status === 'ENTREGUE' && { entregue_em: new Date() }),
    })

    // Libera a mesa quando o pedido finaliza
    if (['ENTREGUE', 'CANCELADO'].includes(data.status) && (pedido as any).mesa_id) {
      await prisma.mesa.update({
        where: { id: (pedido as any).mesa_id },
        data: { status: 'LIVRE' },
      })
    }

    // Incrementa total_vendido ao entregar
    if (data.status === 'ENTREGUE') {
      for (const item of (pedido as any).itens ?? []) {
        await prisma.produto.update({
          where: { id: item.produto_id },
          data: { total_vendido: { increment: item.quantidade } },
        })
      }
    }

    // ── Notificação WhatsApp para o CLIENTE ───────────────────────────────
    // Roda em background — não bloqueia a resposta
    const statusQueNotificamCliente = ['PREPARO', 'PRONTO', 'ENTREGUE', 'CANCELADO']

    if (env.ZAPI_INSTANCE_ID && statusQueNotificamCliente.includes(data.status)) {
      const mensagemCliente = templateStatusPedido(
        (pedido as any).cliente_nome,
        (pedido as any).numero_pedido,
        data.status
      )

      enviarMensagemWhatsApp(
        (pedido as any).cliente_telefone,
        mensagemCliente
      ).catch(console.error)
    }
    // ─────────────────────────────────────────────────────────────────────

    return pedidoAtualizado
  }

  async atribuirAtendente(
    id: string,
    atendido_por_id: string,
    estabelecimento_id: string
  ) {
    await this.findById(id, estabelecimento_id)
    return this.repository.update(id, { atendido_por_id })
  }
}