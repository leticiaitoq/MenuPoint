import { AppError } from '@shared/errors/AppError'
import { PedidoRepository } from './Pedido.repository'
import { CriarPedidoDTO, AtualizarStatusPedidoDTO, AtualizarPedidoDTO, criarPedidoSchema } from './Pedido.schema'
import prisma from '@config/prisma'
import { enviarMensagemWhatsApp } from '@config/whatsapp'
import { templateNovoPedido, templateStatusPedido } from '@shared/whatsapp/template'
import { env } from '@config/env'
import {
  travarMesa,
  subtotalDaConta,
  garantirContaCobrePagos,
  filtroContaAberta,
  r2,
} from '@modules/pagamentos/conta'
import { etapasAntesDe, proximaEtapa, statusDoPedido } from './itemStatus'
import {
  CriarPedidoDeliveryDTO,
  MODALIDADES_POR_ORIGEM,
  OrigemPedido,
  montarItensPublicos,
  origemDoPedido,
  restauranteAbertoAgora,
} from './Pedido.publico'

export class PedidoService {
  constructor(private readonly repository: PedidoRepository) {}

  async criar(
    data: CriarPedidoDTO,
    estabelecimento_id: string,
    atendido_por_id?: string
  ) {
    let subtotal = 0

    // O preço vem SEMPRE do banco: o valor enviado pelo front é ignorado
    // (senão qualquer um poderia lançar um pedido com preço adulterado).
    const itensComPreco: typeof data.itens = []

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

      const precoUnitario = Number(produto.preco_promocional ?? produto.preco)

      const totalAdicionais = item.itens_adicionais.reduce(
        (acc, ad) => acc + ad.preco_extra,
        0
      )

      subtotal += (precoUnitario + totalAdicionais) * item.quantidade
      itensComPreco.push({ ...item, preco_unitario: precoUnitario })
    }

    // Valida a mesa (ela só passa a OCUPADA depois que o pedido for gravado)
    if (data.modalidade === 'MESA' && data.mesa_id) {
      const mesa = await prisma.mesa.findFirst({
        where: { id: data.mesa_id, estabelecimento_id, ativo: true },
      })

      if (!mesa) {
        throw new AppError('Mesa não encontrada', 404)
      }

      if (mesa.status === 'INATIVA') {
        throw new AppError(`Mesa ${mesa.numero} está inativa`, 400)
      }
    }

    const total = subtotal + (data.taxa_entrega ?? 0) - (data.desconto ?? 0)

    const pedido = await this.repository.criarComItens({
      ...data,
      itens: itensComPreco,
      estabelecimento_id,
      ...(atendido_por_id && { atendido_por_id }),
      subtotal: Math.round(subtotal * 100) / 100,
      total: Math.max(Math.round(total * 100) / 100, 0),
    })

    if (data.modalidade === 'MESA' && data.mesa_id) {
      await prisma.mesa.update({
        where: { id: data.mesa_id },
        data: { status: 'OCUPADA' },
      })
    }

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
      status?: string[]
      modalidade?: string
      mesa_id?: string
      data_inicio?: Date
      data_fim?: Date
      conta_aberta?: boolean
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

    const mesaId: string | null = (pedido as any).mesa_id ?? null
    let pedidoAtualizado: any

    if (data.status === 'CANCELADO') {
      // Cancelar mexe no dinheiro da mesa: valida e grava na MESMA transação, com a mesa travada
      pedidoAtualizado = await prisma.$transaction(async (tx) => {
        if (mesaId) await travarMesa(tx, mesaId)

        // Item já pago em pagamento parcial: desfaça o parcial antes de cancelar o pedido
        const itemPago = await tx.pagamentoMesaItem.findFirst({
          where: { item_pedido: { pedido_id: id }, pagamento_mesa: { liquidado_em: null } },
          select: { id: true },
        })
        if (itemPago) {
          throw new AppError(
            'Este pedido tem itens já pagos em pagamento parcial. Desfaça o pagamento parcial antes de cancelar.',
            409
          )
        }

        // Pedido já pago não se cancela: o valor precisa ser estornado antes
        const pago = await tx.pagamento.findFirst({
          where: { pedido_id: id, status: 'CONFIRMADO' },
          select: { id: true },
        })
        if (pago) {
          throw new AppError(
            'Este pedido já tem pagamento confirmado. Estorne o valor antes de cancelar.',
            409
          )
        }

        // A conta não pode ficar menor que o que já foi pago em parcial/abatimento
        if (mesaId) {
          const subtotalSemEste = await subtotalDaConta(tx, mesaId, estabelecimento_id, {
            ignorarPedidoId: id,
          })
          await garantirContaCobrePagos(tx, mesaId, estabelecimento_id, subtotalSemEste, 'Cancelar este pedido')
        }

        return tx.pedido.update({
          where: { id },
          data: { status: 'CANCELADO', cancelamento_motivo: data.cancelamento_motivo },
        })
      })
    } else {
      pedidoAtualizado = await prisma.$transaction(async (tx) => {
        // Avançar o pedido inteiro leva junto os itens que ainda estão atrás da nova etapa;
        // os que já tinham passado dela (ex.: entregues antes, um a um) não voltam.
        await tx.itemPedido.updateMany({
          where: { pedido_id: id, status: { in: etapasAntesDe(data.status) as any[] } },
          data: { status: data.status as any },
        })

        return tx.pedido.update({
          where: { id },
          data: {
            status: data.status as any,
            ...(data.cancelamento_motivo && {
              cancelamento_motivo: data.cancelamento_motivo,
            }),
            ...(data.status === 'ENTREGUE' && { entregue_em: new Date() }),
          },
        })
      })
    }

    // Mesa: ENTREGAR não libera a mesa — o pedido continua na conta até ser pago (ou cancelado).
    // Só cancelar pode liberar, e só se não sobrar nenhum pedido na conta aberta da mesa.
    if (data.status === 'CANCELADO' && mesaId) {
      const aindaNaConta = await prisma.pedido.count({
        where: { ...filtroContaAberta(mesaId, estabelecimento_id), id: { not: id } },
      })
      if (aindaNaConta === 0) {
        await prisma.mesa.update({ where: { id: mesaId }, data: { status: 'LIVRE' } })
      }
    }

    // Incrementa total_vendido ao entregar (itens já entregues um a um já foram contados)
    if (data.status === 'ENTREGUE') {
      const aindaNaoContados = ((pedido as any).itens ?? []).filter((i: any) => i.status !== 'ENTREGUE')
      for (const item of aindaNaoContados) {
        await prisma.produto.update({
          where: { id: item.produto_id },
          data: { total_vendido: { increment: item.quantidade } },
        })
      }
    }

    this.notificarCliente(pedido, data.status)

    return pedidoAtualizado
  }

  // Avisa o cliente por WhatsApp quando o pedido muda de etapa.
  // Roda em background — não bloqueia a resposta.
  private notificarCliente(pedido: any, status: string) {
    const statusQueNotificamCliente = ['PREPARO', 'PRONTO', 'ENTREGUE', 'CANCELADO']

    if (
      env.ZAPI_INSTANCE_ID &&
      pedido.cliente_telefone && // pedido de mesa lançado no salão pode não ter telefone
      statusQueNotificamCliente.includes(status)
    ) {
      const mensagemCliente = templateStatusPedido(pedido.cliente_nome, pedido.numero_pedido, status)
      enviarMensagemWhatsApp(pedido.cliente_telefone, mensagemCliente).catch(console.error)
    }
  }

  // Cozinha/Fila — avança UM OU MAIS ITENS do pedido para a próxima etapa, sem mexer nos outros.
  // É o que permite entregar a comida assim que ela fica pronta, sem esperar o pedido inteiro.
  // O pedido fica na etapa do item mais atrasado (só vira ENTREGUE quando o último item sair).
  async atualizarStatusItens(
    id: string,
    data: { item_ids: string[]; status: 'PREPARO' | 'PRONTO' | 'ENTREGUE' },
    estabelecimento_id: string
  ) {
    const pedido: any = await this.findById(id, estabelecimento_id)

    if (!['RECEBIDO', 'PREPARO', 'PRONTO'].includes(pedido.status)) {
      throw new AppError('Só é possível avançar itens de pedidos em andamento', 400)
    }

    const ids = Array.from(new Set(data.item_ids))
    const itens: any[] = (pedido.itens ?? []).filter((i: any) => ids.includes(i.id))
    if (itens.length !== ids.length) {
      throw new AppError('Algum item informado não pertence a este pedido', 400)
    }

    for (const item of itens) {
      if (proximaEtapa(item.status) !== data.status) {
        throw new AppError(
          `"${item.produto?.nome ?? 'Item'}" está em "${item.status}" e não pode ir para "${data.status}"`,
          400
        )
      }
    }

    // Todos os itens escolhidos estão na mesma etapa (a anterior à pedida)
    const etapaAnterior = itens[0].status
    const agora = new Date()

    const novoStatusPedido = await prisma.$transaction(async (tx) => {
      // Só avança quem ainda está na etapa que a tela mostrava: se outra pessoa já avançou
      // o mesmo item, não deixamos pular uma etapa.
      const { count } = await tx.itemPedido.updateMany({
        where: { id: { in: ids }, pedido_id: id, status: etapaAnterior },
        data: { status: data.status as any },
      })
      if (count !== ids.length) {
        throw new AppError('Algum item já foi atualizado por outra pessoa. Atualize a fila e tente de novo.', 409)
      }

      if (data.status === 'ENTREGUE') {
        for (const item of itens) {
          await tx.produto.update({
            where: { id: item.produto_id },
            data: { total_vendido: { increment: item.quantidade } },
          })
        }
      }

      const todos = await tx.itemPedido.findMany({ where: { pedido_id: id }, select: { status: true } })
      const novo = statusDoPedido(todos.map((i) => i.status as string))

      if (novo && novo !== pedido.status) {
        await tx.pedido.update({
          where: { id },
          data: {
            status: novo as any,
            ...(novo === 'ENTREGUE' && { entregue_em: agora }),
          },
        })
        return novo
      }
      return null
    })

    // O cliente só é avisado quando o PEDIDO muda de etapa (todos os itens chegaram nela)
    if (novoStatusPedido) this.notificarCliente(pedido, novoStatusPedido)

    return this.findById(id, estabelecimento_id)
  }

  // Caixa — TRANSFERIR PEDIDOS: move pedidos em andamento de uma mesa para OUTRA mesa
  // (`pedido_ids` omitido = todos). Se a mesa de destino já tem pedidos (outro cliente) ou está
  // reservada, só move com `confirmar_mesa_ocupada`. Numa transação: ou move tudo e acerta os
  // status das mesas, ou não muda nada.
  async transferirPedidos(
    data: {
      origem_mesa_id: string
      destino_mesa_id: string
      pedido_ids?: string[]
      confirmar_mesa_ocupada?: boolean
    },
    estabelecimento_id: string
  ) {
    const { origem_mesa_id, destino_mesa_id, pedido_ids, confirmar_mesa_ocupada } = data

    if (origem_mesa_id === destino_mesa_id) {
      throw new AppError('A mesa de destino precisa ser diferente da mesa de origem', 400)
    }

    return prisma.$transaction(async (tx) => {
      // Uma operação por vez nas duas mesas (ordem fixa, sem deadlock)
      await travarMesa(tx, origem_mesa_id, destino_mesa_id)

      const origem = await tx.mesa.findFirst({
        where: { id: origem_mesa_id, estabelecimento_id },
        select: { id: true, numero: true },
      })
      if (!origem) throw new AppError('Mesa de origem não encontrada', 404)

      const destino = await tx.mesa.findFirst({
        where: { id: destino_mesa_id, estabelecimento_id },
        select: { id: true, numero: true, status: true, ativo: true },
      })
      if (!destino) throw new AppError('Mesa de destino não encontrada', 404)
      if (!destino.ativo || destino.status === 'INATIVA') {
        throw new AppError(`A Mesa ${destino.numero} está inativa`, 400)
      }

      const pedidosOrigem = await tx.pedido.findMany({
        where: filtroContaAberta(origem.id, estabelecimento_id),
        select: { id: true, numero_pedido: true },
      })
      if (pedidosOrigem.length === 0) {
        throw new AppError(`A Mesa ${origem.numero} não tem conta aberta`, 400)
      }

      let aMover = pedidosOrigem
      if (pedido_ids && pedido_ids.length > 0) {
        const escolhidos = new Set(pedido_ids)
        aMover = pedidosOrigem.filter((p) => escolhidos.has(p.id))
        if (aMover.length !== escolhidos.size) {
          throw new AppError('Algum pedido informado não está na conta aberta desta mesa', 400)
        }
      }

      const pedidosNoDestino = await tx.pedido.count({
        where: filtroContaAberta(destino.id, estabelecimento_id),
      })
      const destinoOcupada =
        pedidosNoDestino > 0 || destino.status === 'OCUPADA' || destino.status === 'RESERVADA'

      if (destinoOcupada && !confirmar_mesa_ocupada) {
        throw new AppError(
          `A Mesa ${destino.numero} já está ${destino.status === 'RESERVADA' && pedidosNoDestino === 0 ? 'reservada' : 'ocupada'}. Confirme para transferir mesmo assim.`,
          409
        )
      }

      const origemLiberada = aMover.length === pedidosOrigem.length

      // Pagamentos parciais pertencem à conta da mesa: só acompanham se a conta inteira se mover
      const parciaisAbertos = await tx.pagamentoMesa.count({
        where: { mesa_id: origem.id, estabelecimento_id, liquidado_em: null },
      })
      if (parciaisAbertos > 0 && !origemLiberada) {
        throw new AppError(
          `A Mesa ${origem.numero} tem pagamentos parciais registrados: transfira todos os pedidos de uma vez ou desfaça os pagamentos parciais.`,
          409
        )
      }
      if (parciaisAbertos > 0) {
        await tx.pagamentoMesa.updateMany({
          where: { mesa_id: origem.id, estabelecimento_id, liquidado_em: null },
          data: { mesa_id: destino.id },
        })
      }

      await tx.pedido.updateMany({
        where: { id: { in: aMover.map((p) => p.id) } },
        data: { mesa_id: destino.id },
      })
      await tx.mesa.update({ where: { id: destino.id }, data: { status: 'OCUPADA' } })

      if (origemLiberada) {
        await tx.mesa.update({ where: { id: origem.id }, data: { status: 'LIVRE' } })
      }

      return {
        transferidos: aMover.length,
        numeros_pedidos: aMover.map((p) => p.numero_pedido),
        origem_liberada: origemLiberada,
        destino_numero: destino.numero,
      }
    })
  }

  // Caixa — JUNTAR PEDIDOS: une vários pedidos da MESMA mesa em um só.
  // O pedido mais antigo vira o pedido unido: recebe os itens (com os preços originais), a soma
  // dos valores e as observações dos outros. Os outros ficam CANCELADOS ("Unido ao pedido #N")
  // com valores zerados, então o cliente de cada um vê o que aconteceu e nada é contado em dobro.
  async juntarPedidos(
    data: { mesa_id: string; pedido_ids: string[] },
    estabelecimento_id: string
  ) {
    const ids = Array.from(new Set(data.pedido_ids))
    if (ids.length < 2) {
      throw new AppError('Escolha pelo menos 2 pedidos para juntar', 400)
    }

    return prisma.$transaction(async (tx) => {
      await travarMesa(tx, data.mesa_id)

      const pedidos = await tx.pedido.findMany({
        where: { id: { in: ids }, estabelecimento_id },
        include: { pagamento: { select: { status: true } } },
        orderBy: { numero_pedido: 'asc' },
      })

      if (pedidos.length !== ids.length) {
        throw new AppError('Algum pedido não foi encontrado', 404)
      }
      if (pedidos.some((p) => p.mesa_id !== data.mesa_id)) {
        throw new AppError('Só é possível juntar pedidos da mesma mesa', 400)
      }
      if (pedidos.some((p) => p.status === 'CANCELADO' || p.liquidado_em)) {
        throw new AppError('Só é possível juntar pedidos da conta aberta (não cancelados nem pagos)', 400)
      }
      // Misturar entregue com não entregue faria a cozinha refazer o que já foi servido
      const entregues = pedidos.filter((p) => p.status === 'ENTREGUE').length
      if (entregues > 0 && entregues < pedidos.length) {
        throw new AppError(
          'Não é possível juntar pedidos já entregues com pedidos ainda em preparo. Junte só os entregues entre si ou só os que ainda estão na cozinha.',
          400
        )
      }
      if (pedidos.some((p) => p.pagamento?.status === 'CONFIRMADO')) {
        throw new AppError(
          'Um dos pedidos já tem pagamento confirmado e não pode ser unido.',
          409
        )
      }

      const [principal, ...outros] = pedidos
      const outrosIds = outros.map((p) => p.id)

      // Os itens (e seus adicionais) passam para o pedido principal
      await tx.itemPedido.updateMany({
        where: { pedido_id: { in: outrosIds } },
        data: { pedido_id: principal.id },
      })

      const arredondar = (v: number) => Math.round(v * 100) / 100
      const soma = (campo: 'subtotal' | 'taxa_entrega' | 'desconto') =>
        arredondar(pedidos.reduce((acc, p) => acc + Number(p[campo]), 0))

      const subtotal = soma('subtotal')
      const taxa_entrega = soma('taxa_entrega')
      const desconto = soma('desconto')
      const total = Math.max(arredondar(subtotal + taxa_entrega - desconto), 0)

      // O pedido unido fica na etapa mais atrasada: itens novos ainda precisam ser preparados
      const ordemStatus = ['RECEBIDO', 'PREPARO', 'PRONTO', 'ENTREGUE']
      const status = [...pedidos]
        .map((p) => p.status as string)
        .sort((a, b) => ordemStatus.indexOf(a) - ordemStatus.indexOf(b))[0] as
        | 'RECEBIDO'
        | 'PREPARO'
        | 'PRONTO'
        | 'ENTREGUE'

      const unicos = (valores: (string | null)[]) =>
        Array.from(
          new Map(
            valores
              .map((v) => (v ?? '').trim().replace(/\s+/g, ' '))
              .filter(Boolean)
              .map((v) => [v.toLowerCase(), v] as const)
          ).values()
        )

      const clienteNome = unicos(pedidos.map((p) => p.cliente_nome)).join(' / ').slice(0, 100)
      const observacoes = unicos(pedidos.map((p) => p.observacoes)).join(' / ')

      await tx.pedido.update({
        where: { id: principal.id },
        data: {
          status,
          cliente_nome: clienteNome || principal.cliente_nome,
          observacoes: observacoes || null,
          subtotal,
          taxa_entrega,
          desconto,
          total,
        },
      })

      await tx.pedido.updateMany({
        where: { id: { in: outrosIds } },
        data: {
          status: 'CANCELADO',
          cancelamento_motivo: `Unido ao pedido #${principal.numero_pedido}`,
          subtotal: 0,
          taxa_entrega: 0,
          desconto: 0,
          total: 0,
        },
      })

      return {
        pedido_principal_id: principal.id,
        pedido_principal: principal.numero_pedido,
        unidos: pedidos.map((p) => p.numero_pedido),
        status,
      }
    })
  }

  // Caixa: cancela TODOS os pedidos em andamento de uma mesa e libera a mesa.
  // Numa transação: ou cancela tudo e libera a mesa, ou não muda nada.
  async cancelarPedidosDaMesa(mesa_id: string, motivo: string, estabelecimento_id: string) {
    const motivoLimpo = motivo.trim()
    if (!motivoLimpo) {
      throw new AppError('Motivo de cancelamento é obrigatório', 400)
    }

    const mesa = await prisma.mesa.findFirst({
      where: { id: mesa_id, estabelecimento_id },
      select: { id: true, numero: true },
    })
    if (!mesa) {
      throw new AppError('Mesa não encontrada', 404)
    }

    return prisma.$transaction(async (tx) => {
      await travarMesa(tx, mesa_id)

      const pedidos = await tx.pedido.findMany({
        where: filtroContaAberta(mesa_id, estabelecimento_id),
        select: {
          id: true,
          numero_pedido: true,
          status: true,
          pagamento: { select: { status: true } },
        },
      })

      if (pedidos.length === 0) {
        throw new AppError(`A Mesa ${mesa.numero} não tem conta aberta`, 400)
      }

      // Pedido já servido não se cancela (a comida saiu e as vendas já foram contadas)
      if (pedidos.some((p) => p.status === 'ENTREGUE')) {
        throw new AppError(
          `A Mesa ${mesa.numero} tem pedidos já entregues. Para encerrar sem cobrar, feche a conta com desconto total.`,
          409
        )
      }

      // Já recebeu algo em pagamento parcial/abatimento: desfaça antes de cancelar a mesa
      const parciais = await tx.pagamentoMesa.count({
        where: { mesa_id, estabelecimento_id, liquidado_em: null },
      })
      if (parciais > 0) {
        throw new AppError(
          `A Mesa ${mesa.numero} tem pagamentos parciais registrados. Desfaça-os antes de cancelar.`,
          409
        )
      }

      // Pedido já pago não se cancela: o valor precisa ser estornado antes
      if (pedidos.some((p) => p.pagamento?.status === 'CONFIRMADO')) {
        throw new AppError(
          `A Mesa ${mesa.numero} já tem pagamento confirmado. Estorne o valor antes de cancelar.`,
          409
        )
      }

      await tx.pedido.updateMany({
        where: { id: { in: pedidos.map((p) => p.id) } },
        data: { status: 'CANCELADO', cancelamento_motivo: motivoLimpo },
      })

      await tx.mesa.update({ where: { id: mesa_id }, data: { status: 'LIVRE' } })

      return {
        cancelados: pedidos.length,
        numeros_pedidos: pedidos.map((p) => p.numero_pedido),
      }
    })
  }

  async atualizar(id: string, data: AtualizarPedidoDTO, estabelecimento_id: string) {
    const pedido: any = await this.findById(id, estabelecimento_id)

    if (!['RECEBIDO', 'PREPARO', 'PRONTO'].includes(pedido.status)) {
      throw new AppError('Só é possível editar pedidos em andamento', 400)
    }

    if (pedido.pagamento && pedido.pagamento.status === 'CONFIRMADO') {
      throw new AppError('Pedido com pagamento confirmado não pode ser editado', 400)
    }

    const existentes: any[] = pedido.itens ?? []

    // Pedidos com adicionais ou com o mesmo produto em linhas separadas ainda não são
    // editáveis por aqui: recriar os itens apagaria os adicionais.
    const produtosExistentes = existentes.map((i) => i.produto_id)
    const temAdicional = existentes.some((i) => (i.itens_adicionais?.length ?? 0) > 0)
    const temLinhaRepetida = new Set(produtosExistentes).size !== produtosExistentes.length
    if (temAdicional || temLinhaRepetida) {
      throw new AppError(
        'Este pedido tem adicionais ou itens repetidos e ainda não pode ser editado por aqui',
        400
      )
    }

    // Junta linhas repetidas que o front tenha enviado
    const quantidades = new Map<string, number>()
    for (const item of data.itens) {
      quantidades.set(item.produto_id, (quantidades.get(item.produto_id) ?? 0) + item.quantidade)
    }
    for (const qtd of quantidades.values()) {
      if (qtd > 999) throw new AppError('Quantidade deve ser no máximo 999 por item', 400)
    }

    const porProduto = new Map<string, any>(existentes.map((i) => [i.produto_id, i]))

    // Preço: item que já estava no pedido mantém o preço de quando foi lançado;
    // item novo usa o preço atual do produto (e precisa estar disponível).
    const novos: { produto_id: string; quantidade: number; preco_unitario: number }[] = []
    const mantidos: { id: string; quantidade: number; preco_unitario: number }[] = []

    for (const [produto_id, quantidade] of quantidades) {
      const jaExiste = porProduto.get(produto_id)

      if (jaExiste) {
        mantidos.push({
          id: jaExiste.id,
          quantidade,
          preco_unitario: Number(jaExiste.preco_unitario),
        })
        continue
      }

      const produto = await prisma.produto.findFirst({
        where: { id: produto_id, estabelecimento_id },
      })
      if (!produto) throw new AppError(`Produto ${produto_id} não encontrado`, 404)
      if (!produto.disponivel) {
        throw new AppError(`Produto "${produto.nome}" não está disponível`, 400)
      }

      novos.push({
        produto_id,
        quantidade,
        preco_unitario: Number(produto.preco_promocional ?? produto.preco),
      })
    }

    const idsMantidos = new Set(mantidos.map((m) => m.id))
    const idsRemovidos = existentes.filter((i) => !idsMantidos.has(i.id)).map((i) => i.id)

    const subtotal =
      Math.round(
        [...mantidos, ...novos].reduce((acc, i) => acc + i.preco_unitario * i.quantidade, 0) * 100
      ) / 100
    const total =
      Math.max(
        Math.round(
          (subtotal + Number(pedido.taxa_entrega ?? 0) - Number(pedido.desconto ?? 0)) * 100
        ) / 100,
        0
      )

    await prisma.$transaction(async (tx) => {
      if (pedido.mesa_id) {
        await travarMesa(tx, pedido.mesa_id)

        // Itens que já têm unidades pagas em pagamento parcial não podem sumir nem encolher
        // (apagar o item apagaria o registro do que foi pago)
        const alocados = await tx.pagamentoMesaItem.findMany({
          where: {
            item_pedido_id: { in: existentes.map((i) => i.id) },
            pagamento_mesa: { liquidado_em: null },
          },
          select: { item_pedido_id: true, quantidade: true },
        })
        const pagoPorItem = new Map<string, number>()
        alocados.forEach((a) =>
          pagoPorItem.set(a.item_pedido_id, (pagoPorItem.get(a.item_pedido_id) ?? 0) + a.quantidade)
        )
        for (const item of existentes) {
          const pagas = pagoPorItem.get(item.id) ?? 0
          if (pagas === 0) continue
          const nome = item.produto?.nome ?? 'Item'
          const mantido = mantidos.find((m) => m.id === item.id)
          if (!mantido) {
            throw new AppError(
              `"${nome}" tem ${pagas} unidade(s) já paga(s) em pagamento parcial e não pode ser removido. Desfaça o pagamento parcial antes.`,
              409
            )
          }
          if (mantido.quantidade < pagas) {
            throw new AppError(
              `"${nome}" tem ${pagas} unidade(s) já paga(s) em pagamento parcial: a quantidade não pode ficar abaixo de ${pagas}. Desfaça o pagamento parcial antes.`,
              409
            )
          }
        }

        // A conta editada não pode ficar menor que o já pago em parcial/abatimento
        const subtotalOutros = await subtotalDaConta(tx, pedido.mesa_id, estabelecimento_id, {
          ignorarPedidoId: id,
        })
        await garantirContaCobrePagos(tx, pedido.mesa_id, estabelecimento_id, r2(subtotalOutros + total), 'Esta edição')
      }

      if (idsRemovidos.length > 0) {
        await tx.itemPedido.deleteMany({ where: { id: { in: idsRemovidos }, pedido_id: id } })
      }

      for (const m of mantidos) {
        await tx.itemPedido.update({
          where: { id: m.id },
          data: { quantidade: m.quantidade, preco_total: m.preco_unitario * m.quantidade },
        })
      }

      if (novos.length > 0) {
        await tx.itemPedido.createMany({
          data: novos.map((n) => ({
            pedido_id: id,
            produto_id: n.produto_id,
            quantidade: n.quantidade,
            preco_unitario: n.preco_unitario,
            preco_total: n.preco_unitario * n.quantidade,
          })),
        })
      }

      // Item novo entra na cozinha como RECEBIDO: o pedido volta à etapa do item mais atrasado
      const statusItens = await tx.itemPedido.findMany({ where: { pedido_id: id }, select: { status: true } })
      const statusPedido = statusDoPedido(statusItens.map((i) => i.status as string))

      await tx.pedido.update({
        where: { id },
        data: {
          cliente_nome: data.cliente_nome,
          observacoes: data.observacoes ? data.observacoes : null,
          subtotal,
          total,
          ...(statusPedido && { status: statusPedido as any }),
        },
      })
    })

    return this.findById(id, estabelecimento_id)
  }

  async atribuirAtendente(
    id: string,
    atendido_por_id: string,
    estabelecimento_id: string
  ) {
    await this.findById(id, estabelecimento_id)
    return this.repository.update(id, { atendido_por_id })
  }

  // ───────────────────────────────────────────────────────────────────────────
  // CLIENTE (conta logada) — delivery e histórico fixo
  // ───────────────────────────────────────────────────────────────────────────

  /**
   * Pedido de DELIVERY (entrega ou retirada) feito pelo cliente logado, pelo link do restaurante.
   * Tudo que vale dinheiro vem do banco: preço dos produtos, taxa de entrega e pedido mínimo.
   * O pedido nasce ligado à conta (cliente_id), então entra no histórico fixo do cliente.
   */
  async criarDeliveryDoCliente(slug: string, dados: CriarPedidoDeliveryDTO, cliente_id: string) {
    const estabelecimento = await prisma.estabelecimento.findFirst({
      where: { slug: slug.trim().toLowerCase(), ativo: true },
      select: {
        id: true,
        nome: true,
        aceita_entrega: true,
        aceita_retirada: true,
        taxa_entrega: true,
        pedido_minimo: true,
        horario_funcionamento: true,
      },
    })
    if (!estabelecimento) throw new AppError('Restaurante não encontrado', 404)

    if (dados.modalidade === 'ENTREGA' && !estabelecimento.aceita_entrega) {
      throw new AppError(`${estabelecimento.nome} não está aceitando entregas no momento`, 400)
    }
    if (dados.modalidade === 'RETIRADA' && !estabelecimento.aceita_retirada) {
      throw new AppError(`${estabelecimento.nome} não está aceitando retiradas no momento`, 400)
    }
    if (!restauranteAbertoAgora(estabelecimento.horario_funcionamento)) {
      throw new AppError('O restaurante está fechado no momento. Confira o horário de funcionamento.', 400)
    }

    const conta = await prisma.cliente.findFirst({
      where: { id: cliente_id, ativo: true },
      select: { id: true },
    })
    if (!conta) throw new AppError('Conta de cliente não encontrada', 404)

    const itens = await montarItensPublicos(estabelecimento.id, dados.itens)

    // Pedido mínimo: confere com os preços do banco (o front só mostra o aviso)
    const minimo = Number(estabelecimento.pedido_minimo)
    if (minimo > 0) {
      const produtos = await prisma.produto.findMany({
        where: { id: { in: itens.map((i) => i.produto_id) }, estabelecimento_id: estabelecimento.id },
        select: { id: true, preco: true, preco_promocional: true },
      })
      const precoPorId = new Map(produtos.map((p) => [p.id, Number(p.preco_promocional ?? p.preco)]))
      const subtotal = itens.reduce((acc, i) => {
        const extras = i.itens_adicionais.reduce((s, a) => s + a.preco_extra, 0)
        return acc + ((precoPorId.get(i.produto_id) ?? 0) + extras) * i.quantidade
      }, 0)
      if (subtotal < minimo) {
        throw new AppError(
          `O pedido mínimo deste restaurante é R$ ${minimo.toFixed(2).replace('.', ',')}`,
          400
        )
      }
    }

    const dto = criarPedidoSchema.parse({
      modalidade: dados.modalidade,
      cliente_id,
      cliente_nome: dados.cliente_nome,
      cliente_telefone: dados.cliente_telefone,
      ...(dados.modalidade === 'ENTREGA' && dados.endereco_entrega
        ? { endereco_entrega: dados.endereco_entrega }
        : {}),
      ...(dados.observacoes ? { observacoes: dados.observacoes } : {}),
      // Taxa só existe na entrega e sempre é a do cadastro do restaurante
      taxa_entrega: dados.modalidade === 'ENTREGA' ? Number(estabelecimento.taxa_entrega) : 0,
      forma_pagamento: dados.forma_pagamento,
      ...(dados.troco_para !== undefined && dados.forma_pagamento === 'DINHEIRO'
        ? { troco_para: dados.troco_para }
        : {}),
      itens,
    })

    const pedido = await this.criar(dto, estabelecimento.id)

    return {
      id: pedido.id,
      numero_pedido: pedido.numero_pedido,
      status: pedido.status,
      modalidade: pedido.modalidade,
      total: pedido.total,
    }
  }

  /**
   * Histórico FIXO do cliente logado: todos os pedidos ligados à conta, dos dois sistemas
   * (mesa/QR Code e delivery) juntos. Não some quando a conta da mesa é fechada.
   * `origem` separa os dois (LOCAL = restaurante, DELIVERY = link do restaurante).
   */
  async historicoDoCliente(
    cliente_id: string,
    filtros: { origem?: OrigemPedido; slug?: string } = {}
  ) {
    const pedidos = await prisma.pedido.findMany({
      where: {
        cliente_id,
        ...(filtros.origem && { modalidade: { in: MODALIDADES_POR_ORIGEM[filtros.origem] } }),
        ...(filtros.slug && { estabelecimento: { slug: filtros.slug.trim().toLowerCase() } }),
      },
      orderBy: { criado_em: 'desc' },
      take: 200,
      select: {
        id: true,
        numero_pedido: true,
        modalidade: true,
        status: true,
        criado_em: true,
        entregue_em: true,
        subtotal: true,
        taxa_entrega: true,
        desconto: true,
        total: true,
        forma_pagamento: true,
        endereco_entrega: true,
        cancelamento_motivo: true,
        mesa: { select: { numero: true } },
        estabelecimento: { select: { nome: true, slug: true, logo_url: true } },
        itens: {
          select: {
            id: true,
            quantidade: true,
            preco_unitario: true,
            preco_total: true,
            observacoes: true,
            itens_adicionais: { select: { preco_extra: true } },
            produto: { select: { nome: true, imagem_url: true } },
          },
        },
      },
    })

    return pedidos.map((p) => ({ ...p, origem: origemDoPedido(p.modalidade) }))
  }
}