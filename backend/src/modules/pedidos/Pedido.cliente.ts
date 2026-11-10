import prisma from '@config/prisma'
import { AppError } from '@shared/errors/AppError'
import { PedidoService } from './Pedido.service'
import { PedidoRepository } from './Pedido.repository'
import { criarPedidoSchema } from './Pedido.schema'
import { CriarPedidoClienteDTO } from './Pedido.cliente.schema'

const DIAS = ['domingo', 'segunda', 'terca', 'quarta', 'quinta', 'sexta', 'sabado'] as const
const r2 = (n: number) => Math.round(n * 100) / 100
const brl = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

/**
 * Sem horário cadastrado (ou dia sem abertura/fechamento), considera FECHADO.
 */
export function restauranteAbertoAgora(horario: unknown, agora = new Date()): boolean {
  if (!horario || typeof horario !== 'object') return false

  const partes = new Intl.DateTimeFormat('pt-BR', {
    timeZone: 'America/Sao_Paulo',
    weekday: 'long',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(agora)

  const valor = (tipo: string) => partes.find((p) => p.type === tipo)?.value ?? ''
  const dia = valor('weekday').normalize('NFD').replace(/[\u0300-\u036f]/g, '').split('-')[0].toLowerCase()
  const minutosAgora = (Number(valor('hour')) % 24) * 60 + Number(valor('minute'))

  const config = (horario as Record<string, any>)[dia]
  if (!config) return false
  if (!config.aberto) return false
  if (!config.abertura || !config.fechamento) return false

  const paraMinutos = (hhmm: string) => {
    const [h, m] = hhmm.split(':').map(Number)
    return h * 60 + m
  }
  const abre = paraMinutos(config.abertura)
  const fecha = paraMinutos(config.fechamento)

  // Horário que passa da meia-noite (ex.: 18:00 às 02:00)
  return abre <= fecha
    ? minutosAgora >= abre && minutosAgora < fecha
    : minutosAgora >= abre || minutosAgora < fecha
}

export class PedidoClienteService {
  private readonly pedidos = new PedidoService(new PedidoRepository())

  private async restaurantePorSlug(slug: string) {
    const estabelecimento = await prisma.estabelecimento.findFirst({
      where: { slug: slug.trim().toLowerCase(), ativo: true },
    })
    if (!estabelecimento) throw new AppError('Restaurante não encontrado', 404)
    return estabelecimento
  }

  /**
   * Monta os itens do pedido lendo TUDO do banco (produto, preço, ingredientes) e calcula o subtotal.
   */
  private async montarItens(estabelecimento_id: string, itens: CriarPedidoClienteDTO['itens']) {
    const idsProdutos = Array.from(new Set(itens.map((i) => i.produto_id)))
    const produtos = await prisma.produto.findMany({
      where: { id: { in: idsProdutos }, estabelecimento_id },
    })
    const produtoPorId = new Map(produtos.map((p) => [p.id, p]))

    const idsIngredientes = Array.from(
      new Set(itens.flatMap((i) => (i.ingredientes ?? []).map((g) => g.adicional_id)))
    )
    const doBanco = idsIngredientes.length
      ? await prisma.adicional.findMany({
          where: {
            id: { in: idsIngredientes },
            disponivel: true,
            grupo: { produto: { estabelecimento_id } },
          },
          include: { grupo: { select: { produto_id: true } } },
        })
      : []
    const ingredientePorId = new Map(doBanco.map((a) => [a.id, a]))

    let subtotal = 0

    const itensMontados = itens.map((item) => {
      const produto = produtoPorId.get(item.produto_id)
      if (!produto) throw new AppError('Um dos produtos do carrinho não existe mais. Atualize o cardápio.', 404)
      if (!produto.disponivel) throw new AppError(`"${produto.nome}" não está disponível no momento`, 400)

      const itens_adicionais: { adicional_id: string; nome_adicional: string; preco_extra: number }[] = []
      const sem: string[] = []
      const extras: string[] = []
      const vistos = new Set<string>()

      for (const escolha of item.ingredientes ?? []) {
        if (vistos.has(escolha.adicional_id)) throw new AppError('Ingrediente repetido no mesmo item', 400)
        vistos.add(escolha.adicional_id)

        const ing = ingredientePorId.get(escolha.adicional_id)
        if (!ing || ing.grupo.produto_id !== item.produto_id) {
          throw new AppError('Um dos ingredientes escolhidos não está mais disponível. Atualize o cardápio.', 400)
        }
        if (escolha.quantidade > ing.quantidade_maxima) {
          throw new AppError(`Máximo de ${ing.quantidade_maxima} para ${ing.nome}`, 400)
        }
        if (ing.fixo && escolha.quantidade < ing.quantidade_inclusa) {
          throw new AppError(`${ing.nome} faz parte do produto e não pode ser retirado`, 400)
        }

        const extra = Math.max(0, escolha.quantidade - ing.quantidade_inclusa)
        for (let n = 0; n < extra; n++) {
          itens_adicionais.push({
            adicional_id: ing.id,
            nome_adicional: ing.nome,
            preco_extra: Number(ing.preco_extra),
          })
        }

        if (escolha.quantidade < ing.quantidade_inclusa) {
          sem.push(escolha.quantidade === 0 ? ing.nome : `${ing.nome} (${escolha.quantidade} em vez de ${ing.quantidade_inclusa})`)
        } else if (extra > 0) {
          extras.push(`${ing.nome} x${extra}`)
        }
      }

      const precoUnitario = Number(produto.preco_promocional ?? produto.preco)
      const totalAdicionais = itens_adicionais.reduce((acc, a) => acc + a.preco_extra, 0)
      subtotal += (precoUnitario + totalAdicionais) * item.quantidade

      // A cozinha lê isto: o que tirar, o que acrescentar e o recado do cliente
      const observacao = [
        item.para_levar ? 'PARA LEVAR' : '',
        sem.length ? `Sem: ${sem.join(', ')}` : '',
        extras.length ? `Extra: ${extras.join(', ')}` : '',
        item.observacoes ?? '',
      ]
        .filter(Boolean)
        .join(' | ')
        .slice(0, 500)

      return {
        produto_id: item.produto_id,
        quantidade: item.quantidade,
        preco_unitario: 0, // ignorado: o PedidoService usa o preço do banco
        ...(observacao ? { observacoes: observacao } : {}),
        itens_adicionais,
      }
    })

    return { itensMontados, subtotal: r2(subtotal) }
  }

  async criar(slug: string, dados: CriarPedidoClienteDTO, cliente_id: string) {
    const restaurante = await this.restaurantePorSlug(slug)

    if (dados.modalidade === 'ENTREGA' && !restaurante.aceita_entrega) {
      throw new AppError('Este restaurante não está aceitando entregas no momento', 400)
    }
    if (dados.modalidade === 'RETIRADA' && !restaurante.aceita_retirada) {
      throw new AppError('Este restaurante não está aceitando retiradas no momento', 400)
    }
    if (!restauranteAbertoAgora(restaurante.horario_funcionamento)) {
      throw new AppError('O restaurante está fechado no momento. Confira o horário de funcionamento.', 400)
    }

    const { itensMontados, subtotal } = await this.montarItens(restaurante.id, dados.itens)

    const pedidoMinimo = Number(restaurante.pedido_minimo)
    if (subtotal < pedidoMinimo) {
      throw new AppError(`O pedido mínimo deste restaurante é ${brl(pedidoMinimo)}`, 400)
    }

    // Taxa de entrega SEMPRE do cadastro do restaurante (nada vem do front)
    const taxa = dados.modalidade === 'ENTREGA' ? Number(restaurante.taxa_entrega) : 0
    const total = r2(subtotal + taxa)

    if (dados.forma_pagamento === 'DINHEIRO' && dados.troco_para !== undefined && dados.troco_para < total) {
      throw new AppError(`O valor para troco precisa ser maior ou igual ao total (${brl(total)})`, 400)
    }

    // Endereço: precisa ser um endereço salvo DESTE cliente
    let endereco_entrega: Record<string, string> | undefined
    let referencia: string | null = null
    if (dados.modalidade === 'ENTREGA') {
      const endereco = await prisma.enderecoCliente.findFirst({
        where: { id: dados.endereco_id, cliente_id },
      })
      if (!endereco) throw new AppError('Endereço não encontrado. Escolha outro endereço.', 404)

      endereco_entrega = {
        rua: endereco.rua,
        numero: endereco.numero,
        ...(endereco.complemento ? { complemento: endereco.complemento } : {}),
        bairro: endereco.bairro,
        cidade: endereco.cidade,
        estado: endereco.estado,
        cep: endereco.cep,
      }
      referencia = endereco.referencia
    }

    const observacoes =
      [referencia ? `Referência: ${referencia}` : '', dados.observacoes ?? ''].filter(Boolean).join(' | ').slice(0, 1000) ||
      undefined

    // Passa pelo schema do pedido para garantir o mesmo formato do fluxo do restaurante
    const pedidoDto = criarPedidoSchema.parse({
      cliente_id,
      modalidade: dados.modalidade,
      cliente_nome: dados.cliente_nome,
      cliente_telefone: dados.cliente_telefone,
      endereco_entrega,
      observacoes,
      taxa_entrega: taxa,
      desconto: 0,
      forma_pagamento: dados.forma_pagamento,
      ...(dados.forma_pagamento === 'DINHEIRO' && dados.troco_para !== undefined ? { troco_para: dados.troco_para } : {}),
      itens: itensMontados,
    })

    const pedido = await this.pedidos.criar(pedidoDto, restaurante.id)

    return {
      id: pedido.id,
      numero_pedido: pedido.numero_pedido,
      status: pedido.status,
      modalidade: pedido.modalidade,
      subtotal: Number(pedido.subtotal),
      taxa_entrega: Number(pedido.taxa_entrega),
      total: Number(pedido.total),
      forma_pagamento: pedido.forma_pagamento,
    }
  }

  /** Pedidos de entrega e retirada do cliente neste restaurante (os 50 mais recentes) */
  async listar(slug: string, cliente_id: string) {
    const restaurante = await this.restaurantePorSlug(slug)

    const pedidos = await prisma.pedido.findMany({
      where: {
        cliente_id,
        estabelecimento_id: restaurante.id,
        modalidade: { in: ['ENTREGA', 'RETIRADA'] },
      },
      orderBy: { criado_em: 'desc' },
      take: 50,
      include: {
        itens: {
          include: {
            produto: { select: { nome: true, imagem_url: true } },
            itens_adicionais: { select: { preco_extra: true } },
          },
        },
      },
    })

    return pedidos.map((p) => ({
      id: p.id,
      numero_pedido: p.numero_pedido,
      modalidade: p.modalidade,
      status: p.status,
      criado_em: p.criado_em,
      subtotal: Number(p.subtotal),
      taxa_entrega: Number(p.taxa_entrega),
      total: Number(p.total),
      forma_pagamento: p.forma_pagamento,
      troco_para: p.troco_para === null ? null : Number(p.troco_para),
      endereco_entrega: p.endereco_entrega,
      cancelamento_motivo: p.cancelamento_motivo,
      itens: p.itens.map((i) => ({
        id: i.id,
        nome: i.produto.nome,
        imagem_url: i.produto.imagem_url,
        quantidade: i.quantidade,
        // preco_total do item não inclui os extras; o total do pedido inclui (por unidade)
        preco_total: r2(
          Number(i.preco_total) + i.itens_adicionais.reduce((acc, ad) => acc + Number(ad.preco_extra), 0) * i.quantidade
        ),
        observacoes: i.observacoes,
      })),
    }))
  }
}
