import { AppError } from '@shared/errors/AppError'
import { randomUUID } from 'crypto'
import prisma from '@config/prisma'
import { registrarAuditoria } from './auditoria'
import { AbatimentoDTO, PagamentoParcialDTO } from './Pagamento.schema'
import {
  TAXA_SERVICO_PERCENTUAL,
  filtroContaAberta,
  Tx,
  r2,
  travarMesa,
  alocarUnidades,
  ajustarAlocacoes,
} from './conta'

// O enum do banco não separa débito/crédito: os dois viram CARTAO
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


interface ContaItem {
  item_pedido_id: string
  pedido_id: string
  numero_pedido: number
  cliente_nome: string
  produto_nome: string
  adicionais: string[]
  quantidade: number
  quantidade_paga: number
  valor_linha: number // total da linha (qtd × unitário, já com adicionais), sem taxa
  valor_unitario: number // já inclui adicionais
  valor_unitario_com_taxa: number
}

// Lê a conta aberta da mesa: itens (e quanto de cada um já foi pago) e os pagamentos parciais abertos
async function carregarConta(
  tx: Tx,
  mesa_id: string,
  estabelecimento_id: string,
  pct: number
) {
  const pedidos = await tx.pedido.findMany({
    where: filtroContaAberta(mesa_id, estabelecimento_id),
    include: {
      pagamento: { select: { status: true } },
      itens: {
        include: {
          produto: { select: { nome: true } },
          itens_adicionais: { select: { nome_adicional: true } },
        },
      },
    },
    orderBy: { numero_pedido: 'asc' },
  })

  const abertos = await tx.pagamentoMesa.findMany({
    where: { mesa_id, estabelecimento_id, liquidado_em: null },
    include: { itens: true },
    orderBy: { criado_em: 'asc' },
  })

  const pagoPorItem = new Map<string, number>()
  abertos.forEach((p) =>
    p.itens.forEach((i) =>
      pagoPorItem.set(i.item_pedido_id, (pagoPorItem.get(i.item_pedido_id) ?? 0) + i.quantidade)
    )
  )

  // Pedido que já tem pagamento confirmado não entra na conta
  const aPagar = pedidos.filter((p) => p.pagamento?.status !== 'CONFIRMADO')

  const itens: ContaItem[] = aPagar.flatMap((p) =>
    p.itens.map((i) => {
      const unitario = Number(i.preco_total) / i.quantidade
      return {
        item_pedido_id: i.id,
        pedido_id: p.id,
        numero_pedido: p.numero_pedido,
        cliente_nome: p.cliente_nome,
        produto_nome: i.produto?.nome ?? 'Item',
        adicionais: i.itens_adicionais.map((a) => a.nome_adicional),
        quantidade: i.quantidade,
        quantidade_paga: Math.min(pagoPorItem.get(i.id) ?? 0, i.quantidade),
        valor_linha: Number(i.preco_total),
        valor_unitario: r2(unitario),
        valor_unitario_com_taxa: unitario * (1 + pct / 100),
      }
    })
  )

  const subtotal = r2(aPagar.reduce((s, p) => s + Number(p.total), 0))
  const taxa = r2((subtotal * pct) / 100)
  const totalConta = r2(subtotal + taxa)
  const pago = r2(abertos.reduce((s, p) => s + Number(p.valor), 0))
  const restante = Math.max(r2(totalConta - pago), 0)

  return { itens, subtotal, taxa, totalConta, pago, restante, abertos }
}

async function exigirMesa(mesa_id: string, estabelecimento_id: string) {
  const mesa = await prisma.mesa.findFirst({
    where: { id: mesa_id, estabelecimento_id },
    select: { id: true, numero: true },
  })
  if (!mesa) throw new AppError('Mesa não encontrada', 404)
  return mesa
}

export class PagamentoMesaService {
  // Conta da mesa: itens com o que já foi pago, totais e pagamentos parciais registrados
  async resumo(mesa_id: string, estabelecimento_id: string) {
    const pct = TAXA_SERVICO_PERCENTUAL
    const mesa = await exigirMesa(mesa_id, estabelecimento_id)
    const conta = await prisma.$transaction((tx) => carregarConta(tx, mesa_id, estabelecimento_id, pct))

    return {
      mesa: { id: mesa.id, numero: mesa.numero },
      taxa_servico_percentual: pct,
      itens: conta.itens.map(({ valor_unitario_com_taxa, ...i }) => ({
        ...i,
        valor_unitario_com_taxa: r2(valor_unitario_com_taxa),
      })),
      subtotal: conta.subtotal,
      taxa_servico: conta.taxa,
      total_conta: conta.totalConta,
      pago: conta.pago,
      restante: conta.restante,
      pagamentos: conta.abertos.map((p) => ({
        id: p.id,
        grupo_id: p.grupo_id,
        tipo: p.tipo,
        metodo: p.metodo,
        valor: Number(p.valor),
        valor_recebido: p.valor_recebido != null ? Number(p.valor_recebido) : null,
        troco: p.troco != null ? Number(p.troco) : null,
        observacoes: p.observacoes,
        criado_em: p.criado_em,
        itens: p.itens.map((i) => ({
          item_pedido_id: i.item_pedido_id,
          quantidade: i.quantidade,
          valor: Number(i.valor),
        })),
      })),
    }
  }

  // PARCIAL (itens escolhidos, valor dividido em 1+ formas) ou ABATIMENTO (valor livre, itens opcionais)
  async registrar(
    mesa_id: string,
    tipo: 'PARCIAL' | 'ABATIMENTO',
    data: PagamentoParcialDTO | AbatimentoDTO,
    registrado_por_id: string,
    estabelecimento_id: string
  ) {
    const mesa = await exigirMesa(mesa_id, estabelecimento_id)
    // A taxa é do servidor: o percentual enviado pelo front é ignorado
    const pct = TAXA_SERVICO_PERCENTUAL

    return prisma.$transaction(async (tx) => {
      // Uma operação financeira por vez na mesa: o saldo lido abaixo vale até o fim da transação
      await travarMesa(tx, mesa_id)
      const conta = await carregarConta(tx, mesa_id, estabelecimento_id, pct)

      if (conta.itens.length === 0) {
        throw new AppError(`A Mesa ${mesa.numero} não tem conta aberta`, 400)
      }
      if (conta.restante <= 0.004) {
        throw new AppError('A conta desta mesa já está quitada. Feche a conta para liberar a mesa.', 400)
      }

      // Seleção de itens (junta repetições e confere o que ainda falta pagar)
      const porId = new Map(conta.itens.map((i) => [i.item_pedido_id, i]))
      const selecionados = new Map<string, number>()
      ;(data.itens ?? []).forEach((i) =>
        selecionados.set(i.item_pedido_id, (selecionados.get(i.item_pedido_id) ?? 0) + i.quantidade)
      )
      for (const [id, qtd] of selecionados) {
        const item = porId.get(id)
        if (!item) {
          throw new AppError('Um dos itens não pertence à conta aberta desta mesa', 400)
        }
        const faltam = item.quantidade - item.quantidade_paga
        if (qtd > faltam) {
          throw new AppError(
            faltam === 0
              ? `"${item.produto_nome}" já está pago`
              : `"${item.produto_nome}": ${faltam === 1 ? 'resta 1 unidade' : `restam ${faltam} unidades`} para pagar`,
            409
          )
        }
      }

      const alocacoes: { item_pedido_id: string; quantidade: number; valor: number }[] = []
      // Cada linha vira um PagamentoMesa (uma por forma de pagamento)
      const linhas: {
        forma: keyof typeof METODO_DO_BANCO
        valor: number
        recebido: number | null
        troco: number
      }[] = []

      if (tipo === 'PARCIAL') {
        const dto = data as PagamentoParcialDTO
        for (const [id, qtd] of selecionados) {
          alocacoes.push({
            item_pedido_id: id,
            quantidade: qtd,
            valor: r2(porId.get(id)!.valor_unitario_com_taxa * qtd),
          })
        }
        const somaItens = r2(alocacoes.reduce((s, a) => s + a.valor, 0))
        // Quitou TODOS os itens que faltavam: absorve os centavos de arredondamento da taxa
        // (a taxa é calculada sobre o subtotal; por item pode sobrar/faltar 1 ou 2 centavos)
        const quitaTudo = conta.itens.every(
          (i) => (selecionados.get(i.item_pedido_id) ?? 0) === i.quantidade - i.quantidade_paga
        )
        const valorItens =
          quitaTudo && Math.abs(conta.restante - somaItens) <= Math.max(0.05, 0.02 * selecionados.size)
            ? conta.restante
            : Math.min(somaItens, conta.restante)
        // As alocações nunca podem somar mais (nem menos) do que o valor efetivamente pago
        const ajustadas = ajustarAlocacoes(alocacoes, valorItens)
        alocacoes.length = 0
        alocacoes.push(...ajustadas)
        const somaFormas = r2(dto.formas.reduce((s, f) => s + f.valor, 0))
        // O servidor é quem manda no valor: aceita uma folga de centavos (arredondamento por item
        // no front) e acerta a diferença na última forma, para fechar exatamente
        const folga = Math.max(0.05, 0.02 * selecionados.size)
        if (Math.abs(somaFormas - valorItens) > folga) {
          throw new AppError(
            `A soma das formas de pagamento (R$ ${somaFormas.toFixed(2)}) é diferente do valor dos itens (R$ ${valorItens.toFixed(2)})`,
            400
          )
        }
        const formasAjustadas = dto.formas.map((f) => ({ ...f }))
        const ultima = formasAjustadas[formasAjustadas.length - 1]
        ultima.valor = r2(ultima.valor + (valorItens - somaFormas))
        if (ultima.valor <= 0) {
          throw new AppError('Ajuste os valores das formas de pagamento', 400)
        }
        for (const f of formasAjustadas) {
          let recebido: number | null = null
          let troco = 0
          if (f.forma === 'DINHEIRO') {
            recebido = f.valor_recebido ?? f.valor
            if (recebido < f.valor - 0.005) {
              throw new AppError('O valor recebido em dinheiro é menor que o valor a pagar', 400)
            }
            troco = r2(recebido - f.valor)
          }
          linhas.push({ forma: f.forma, valor: f.valor, recebido, troco })
        }
      } else {
        const dto = data as AbatimentoDTO
        const dado = dto.valor
        if (dto.forma !== 'DINHEIRO' && dado > conta.restante + 0.005) {
          throw new AppError(
            `O valor informado (R$ ${dado.toFixed(2)}) é maior que o saldo da conta (R$ ${conta.restante.toFixed(2)})`,
            400
          )
        }
        // Em dinheiro, o que passar do saldo vira troco
        const abatido = r2(Math.min(dado, conta.restante))
        linhas.push({
          forma: dto.forma,
          valor: abatido,
          recebido: dto.forma === 'DINHEIRO' ? dado : null,
          troco: dto.forma === 'DINHEIRO' ? r2(dado - abatido) : 0,
        })

        // Se escolheu itens, o valor quita unidades inteiras deles, na ordem escolhida;
        // o que sobrar fica como crédito geral da conta
        const { alocacoes: quitadas } = alocarUnidades(
          abatido,
          Array.from(selecionados).map(([id, qtd]) => ({
            item_pedido_id: id,
            quantidade: qtd,
            custo_unitario: porId.get(id)!.valor_unitario_com_taxa,
          }))
        )
        alocacoes.push(...quitadas)
      }

      const totalAbatido = r2(linhas.reduce((s, l) => s + l.valor, 0))
      if (totalAbatido <= 0) {
        throw new AppError('O valor a pagar precisa ser maior que zero', 400)
      }
      if (totalAbatido > conta.restante + 0.005) {
        throw new AppError('O valor é maior que o saldo restante da conta', 400)
      }

      // Todas as formas de UM pagamento dividido compartilham o grupo (desfazer remove o grupo todo)
      const grupo_id = randomUUID()
      const ids: string[] = []
      for (let i = 0; i < linhas.length; i++) {
        const l = linhas[i]
        const criado = await tx.pagamentoMesa.create({
          data: {
            estabelecimento_id,
            mesa_id,
            registrado_por_id,
            grupo_id,
            tipo,
            metodo: METODO_DO_BANCO[l.forma],
            valor: l.valor,
            valor_recebido: l.recebido,
            troco: l.forma === 'DINHEIRO' ? l.troco : null,
            observacoes: [
              tipo === 'PARCIAL' ? 'Pagamento parcial' : 'Abatimento de valor',
              ROTULO_FORMA[l.forma],
              data.observacoes?.trim() || null,
            ].filter(Boolean).join(' · '),
            // Os itens quitados ficam na primeira linha (o conjunto todo quitou os itens)
            ...(i === 0 && alocacoes.length > 0 ? { itens: { create: alocacoes } } : {}),
          },
          select: { id: true },
        })
        ids.push(criado.id)
      }

      return {
        ids,
        tipo,
        valor: totalAbatido,
        troco: r2(linhas.reduce((s, l) => s + l.troco, 0)),
        restante: r2(conta.restante - totalAbatido),
        itens_quitados: alocacoes.length,
        // O que o servidor realmente quitou (a tela mostra isto, não a prévia)
        alocacoes: alocacoes.map((a) => ({ item_pedido_id: a.item_pedido_id, quantidade: a.quantidade, valor: a.valor })),
      }
    })
  }

  // Desfaz um pagamento parcial que ainda não foi liquidado (ex.: registrado por engano).
  // Exige motivo e grava quem desfez. Se o pagamento foi dividido em várias formas, desfaz o
  // GRUPO inteiro: assim nenhum item fica "pago" sem dinheiro (nem dinheiro sem item).
  async desfazer(
    mesa_id: string,
    id: string,
    motivo: string,
    usuario_id: string,
    estabelecimento_id: string
  ) {
    await exigirMesa(mesa_id, estabelecimento_id)
    return prisma.$transaction(async (tx) => {
      await travarMesa(tx, mesa_id)
      const alvo = await tx.pagamentoMesa.findFirst({
        where: { id, mesa_id, estabelecimento_id, liquidado_em: null },
        select: { id: true, grupo_id: true },
      })
      if (!alvo) throw new AppError('Pagamento parcial não encontrado ou já liquidado', 404)

      const grupo = await tx.pagamentoMesa.findMany({
        where: alvo.grupo_id
          ? { grupo_id: alvo.grupo_id, mesa_id, estabelecimento_id, liquidado_em: null }
          : { id: alvo.id },
        include: { itens: true },
      })

      await registrarAuditoria(tx, {
        estabelecimento_id,
        usuario_id,
        acao: 'PAGAMENTO_MESA_DESFEITO',
        entidade: 'PagamentoMesa',
        entidade_id: alvo.id,
        motivo,
        dados: {
          mesa_id,
          pagamentos: grupo.map((p) => ({
            id: p.id,
            tipo: p.tipo,
            metodo: p.metodo,
            valor: Number(p.valor),
            registrado_por_id: p.registrado_por_id,
            criado_em: p.criado_em.toISOString(),
            itens: p.itens.map((i) => ({
              item_pedido_id: i.item_pedido_id,
              quantidade: i.quantidade,
              valor: Number(i.valor),
            })),
          })),
        },
      })

      await tx.pagamentoMesa.deleteMany({ where: { id: { in: grupo.map((p) => p.id) } } })
      return { removido: true, pagamentos_removidos: grupo.length }
    })
  }
}
