import { AppError } from '@shared/errors/AppError'
import { PedidoRepository } from './Pedido.repository'
import { CriarPedidoDTO, AtualizarStatusPedidoDTO, AtualizarPedidoDTO } from './Pedido.schema'
import prisma from '@config/prisma'
import { enviarMensagemWhatsApp } from '@config/whatsapp'
import { templateNovoPedido, templateStatusPedido } from '@shared/whatsapp/template'
import { env } from '@config/env'

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

    // Pedido já pago não se cancela: o valor precisa ser estornado antes
    if (data.status === 'CANCELADO') {
      const pago = await prisma.pagamento.findFirst({
        where: { pedido_id: id, status: 'CONFIRMADO' },
        select: { id: true },
      })
      if (pago) {
        throw new AppError(
          'Este pedido já tem pagamento confirmado. Estorne o valor antes de cancelar.',
          409
        )
      }
    }

    const pedidoAtualizado = await this.repository.update(id, {
      status: data.status,
      ...(data.cancelamento_motivo && {
        cancelamento_motivo: data.cancelamento_motivo,
      }),
      ...(data.status === 'ENTREGUE' && { entregue_em: new Date() }),
    })

    // Libera a mesa quando o pedido finaliza — mas só se não sobrou outro pedido em andamento
    // nela (mesa com vários pedidos não pode ficar "livre" por causa de um só)
    if (['ENTREGUE', 'CANCELADO'].includes(data.status) && (pedido as any).mesa_id) {
      const aindaEmAndamento = await prisma.pedido.count({
        where: {
          mesa_id: (pedido as any).mesa_id,
          id: { not: id },
          status: { in: ['RECEBIDO', 'PREPARO', 'PRONTO'] },
        },
      })
      if (aindaEmAndamento === 0) {
        await prisma.mesa.update({
          where: { id: (pedido as any).mesa_id },
          data: { status: 'LIVRE' },
        })
      }
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

    if (
      env.ZAPI_INSTANCE_ID &&
      (pedido as any).cliente_telefone && // pedido de mesa lançado no salão pode não ter telefone
      statusQueNotificamCliente.includes(data.status)
    ) {
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

      const emAndamento: ('RECEBIDO' | 'PREPARO' | 'PRONTO')[] = ['RECEBIDO', 'PREPARO', 'PRONTO']

      const pedidosOrigem = await tx.pedido.findMany({
        where: { mesa_id: origem.id, estabelecimento_id, status: { in: emAndamento } },
        select: { id: true, numero_pedido: true },
      })
      if (pedidosOrigem.length === 0) {
        throw new AppError(`A Mesa ${origem.numero} não tem pedido em andamento`, 400)
      }

      let aMover = pedidosOrigem
      if (pedido_ids && pedido_ids.length > 0) {
        const escolhidos = new Set(pedido_ids)
        aMover = pedidosOrigem.filter((p) => escolhidos.has(p.id))
        if (aMover.length !== escolhidos.size) {
          throw new AppError('Algum pedido informado não está em andamento nesta mesa', 400)
        }
      }

      const pedidosNoDestino = await tx.pedido.count({
        where: { mesa_id: destino.id, estabelecimento_id, status: { in: emAndamento } },
      })
      const destinoOcupada =
        pedidosNoDestino > 0 || destino.status === 'OCUPADA' || destino.status === 'RESERVADA'

      if (destinoOcupada && !confirmar_mesa_ocupada) {
        throw new AppError(
          `A Mesa ${destino.numero} já está ${destino.status === 'RESERVADA' && pedidosNoDestino === 0 ? 'reservada' : 'ocupada'}. Confirme para transferir mesmo assim.`,
          409
        )
      }

      await tx.pedido.updateMany({
        where: { id: { in: aMover.map((p) => p.id) } },
        data: { mesa_id: destino.id },
      })
      await tx.mesa.update({ where: { id: destino.id }, data: { status: 'OCUPADA' } })

      const origemLiberada = aMover.length === pedidosOrigem.length
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
      if (pedidos.some((p) => !['RECEBIDO', 'PREPARO', 'PRONTO'].includes(p.status))) {
        throw new AppError('Só é possível juntar pedidos em andamento', 400)
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
      const ordemStatus = ['RECEBIDO', 'PREPARO', 'PRONTO']
      const status = [...pedidos]
        .map((p) => p.status as string)
        .sort((a, b) => ordemStatus.indexOf(a) - ordemStatus.indexOf(b))[0] as
        | 'RECEBIDO'
        | 'PREPARO'
        | 'PRONTO'

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
      const pedidos = await tx.pedido.findMany({
        where: {
          mesa_id,
          estabelecimento_id,
          status: { in: ['RECEBIDO', 'PREPARO', 'PRONTO'] },
        },
        select: {
          id: true,
          numero_pedido: true,
          pagamento: { select: { status: true } },
        },
      })

      if (pedidos.length === 0) {
        throw new AppError(`A Mesa ${mesa.numero} não tem pedido em andamento`, 400)
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

      await tx.pedido.update({
        where: { id },
        data: {
          cliente_nome: data.cliente_nome,
          observacoes: data.observacoes ? data.observacoes : null,
          subtotal,
          total,
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
}