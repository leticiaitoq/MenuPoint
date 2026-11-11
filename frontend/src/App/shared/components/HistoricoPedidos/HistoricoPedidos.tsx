import React, { useMemo, useState } from 'react'
import { HiCheckCircle } from 'react-icons/hi'
import type { OrigemPedido, PedidoHistorico } from '../../../services/pedidoCliente.service'
import './HistoricoPedidos.css'

/**
 * Lista de pedidos do cliente — a MESMA tela para os dois sistemas (mesa e delivery).
 * O histórico é um só; `origem` separa o que veio do restaurante (LOCAL) do que veio do delivery.
 * Quem usa decide se mostra o filtro de origem (conta logada) ou não (convidado só tem a mesa).
 */
export type FiltroOrigem = 'todos' | OrigemPedido
type Situacao = 'pendente' | 'pronto' | 'finalizado' | 'cancelado'
type FiltroSituacao = 'todos' | 'pendentes' | 'prontos' | 'finalizados' | 'cancelados'

interface Props {
  pedidos: PedidoHistorico[]
  carregando: boolean
  erro?: string | null
  /** Filtro atual de origem. Só aparece na tela se `onOrigemChange` for passado. */
  origem?: FiltroOrigem
  onOrigemChange?: (origem: FiltroOrigem) => void
  /** Texto quando a pessoa ainda não tem nenhum pedido */
  vazioTexto?: string
  /** Conteúdo acima dos filtros (ex.: resumo da mesa) */
  topo?: React.ReactNode
}

const ROTULO_ORIGEM: Record<FiltroOrigem, string> = {
  todos: 'Todos',
  LOCAL: 'Restaurante local',
  DELIVERY: 'Delivery',
}

const ROTULO_SITUACAO_FILTRO: Record<FiltroSituacao, string> = {
  todos: 'Todos',
  pendentes: 'Pendentes',
  prontos: 'Prontos',
  finalizados: 'Finalizados',
  cancelados: 'Cancelados',
}

const situacaoDe = (p: PedidoHistorico): Situacao =>
  p.status === 'CANCELADO'
    ? 'cancelado'
    : p.status === 'ENTREGUE'
      ? 'finalizado'
      : p.status === 'PRONTO'
        ? 'pronto'
        : 'pendente'

const FILTRO_DA_SITUACAO: Record<Situacao, Exclude<FiltroSituacao, 'todos'>> = {
  pendente: 'pendentes',
  pronto: 'prontos',
  finalizado: 'finalizados',
  cancelado: 'cancelados',
}

const dinheiro = (v: number) => `R$ ${v.toFixed(2).replace('.', ',')}`

const dataHora = (iso: string) => {
  const d = new Date(iso)
  const hora = d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
  const dia = d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })
  return `${hora} · ${dia}`
}

/** "Mesa 05", "Entrega" ou "Retirada" */
const ondeFoi = (p: PedidoHistorico) =>
  p.modalidade === 'MESA'
    ? `Mesa ${String(p.mesaNumero ?? '').padStart(2, '0')}`
    : p.modalidade === 'ENTREGA'
      ? 'Entrega'
      : 'Retirada'

const rotuloStatus = (p: PedidoHistorico): React.ReactNode => {
  switch (situacaoDe(p)) {
    case 'pendente':
      return p.status === 'PREPARO' ? '🔵 Em preparo' : '🔵 Recebido'
    case 'pronto':
      return p.modalidade === 'RETIRADA' ? '🟡 Pronto p/ retirada' : '🟡 Pronto'
    case 'finalizado':
      return (
        <>
          <HiCheckCircle className="hist-cli__status-icon" />{' '}
          {p.modalidade === 'ENTREGA' ? 'Entregue' : p.modalidade === 'RETIRADA' ? 'Retirado' : 'Finalizado'}
        </>
      )
    case 'cancelado':
      return '✖ Cancelado'
  }
}

/** Frase do rodapé do card: o cliente só acompanha, quem dá baixa é o restaurante */
const mensagemRodape = (p: PedidoHistorico): string | null => {
  switch (situacaoDe(p)) {
    case 'pendente':
      return 'Aguardando...'
    case 'pronto':
      return p.modalidade === 'MESA'
        ? 'Pronto! Já vai à mesa'
        : p.modalidade === 'RETIRADA'
          ? 'Pronto! Pode retirar'
          : 'Pronto! Já vai sair'
    default:
      return null
  }
}

const HistoricoPedidos: React.FC<Props> = ({
  pedidos,
  carregando,
  erro,
  origem = 'todos',
  onOrigemChange,
  vazioTexto = 'Você ainda não fez nenhum pedido.',
  topo,
}) => {
  const [situacao, setSituacao] = useState<FiltroSituacao>('todos')

  // Primeiro a origem; as contagens da situação respeitam a origem escolhida
  const daOrigem = useMemo(
    () => (origem === 'todos' ? pedidos : pedidos.filter((p) => p.origem === origem)),
    [pedidos, origem]
  )

  const contagensOrigem = useMemo(
    () => ({
      todos: pedidos.length,
      LOCAL: pedidos.filter((p) => p.origem === 'LOCAL').length,
      DELIVERY: pedidos.filter((p) => p.origem === 'DELIVERY').length,
    }),
    [pedidos]
  )

  const contagensSituacao = useMemo(() => {
    const c: Record<FiltroSituacao, number> = { todos: daOrigem.length, pendentes: 0, prontos: 0, finalizados: 0, cancelados: 0 }
    daOrigem.forEach((p) => {
      c[FILTRO_DA_SITUACAO[situacaoDe(p)]] += 1
    })
    return c
  }, [daOrigem])

  const filtrados = useMemo(
    () => (situacao === 'todos' ? daOrigem : daOrigem.filter((p) => FILTRO_DA_SITUACAO[situacaoDe(p)] === situacao)),
    [daOrigem, situacao]
  )

  // "Cancelados" só aparece quando existe algum
  const situacoesVisiveis = (Object.keys(ROTULO_SITUACAO_FILTRO) as FiltroSituacao[]).filter(
    (f) => f !== 'cancelados' || contagensSituacao.cancelados > 0 || situacao === 'cancelados'
  )

  return (
    <div className="hist-cli">
      {topo}

      {/* Filtro de ORIGEM: de onde veio o pedido (só para conta logada, que tem os dois) */}
      {onOrigemChange && (
        <div className="hist-cli__origens" role="tablist" aria-label="Origem do pedido">
          {(['todos', 'LOCAL', 'DELIVERY'] as FiltroOrigem[]).map((o) => (
            <button
              key={o}
              type="button"
              role="tab"
              aria-selected={origem === o}
              className={`hist-cli__origem-btn${origem === o ? ' hist-cli__origem-btn--ativo' : ''}`}
              onClick={() => {
                setSituacao('todos')
                onOrigemChange(o)
              }}
            >
              {ROTULO_ORIGEM[o]}
              <span className="hist-cli__filtro-badge">{contagensOrigem[o]}</span>
            </button>
          ))}
        </div>
      )}

      {/* Filtro de SITUAÇÃO */}
      <div className="hist-cli__filtros">
        {situacoesVisiveis.map((f) => (
          <button
            key={f}
            type="button"
            className={`hist-cli__filtro-btn${situacao === f ? ' hist-cli__filtro-btn--ativo' : ''}`}
            onClick={() => setSituacao(f)}
          >
            {ROTULO_SITUACAO_FILTRO[f]}
            <span className="hist-cli__filtro-badge">{contagensSituacao[f]}</span>
          </button>
        ))}
      </div>

      <div className="hist-cli__lista">
        {carregando ? (
          <p className="hist-cli__vazio">Carregando pedidos...</p>
        ) : erro && pedidos.length === 0 ? (
          <p className="hist-cli__vazio">{erro}</p>
        ) : filtrados.length === 0 ? (
          <p className="hist-cli__vazio">
            {pedidos.length === 0 ? vazioTexto : 'Nenhum pedido nesta aba.'}
          </p>
        ) : (
          filtrados.map((pedido) => {
            const sit = situacaoDe(pedido)
            const rodape = mensagemRodape(pedido)
            const endereco = pedido.endereco

            return (
              <div key={pedido.id} className="hist-cli__card">
                <div className="hist-cli__card-header">
                  <div className="hist-cli__card-info">
                    <h2 className="hist-cli__card-numero">Pedido #{pedido.numero}</h2>
                    <span className={`hist-cli__status hist-cli__status--${sit}`}>{rotuloStatus(pedido)}</span>
                  </div>

                  <p className="hist-cli__card-meta">
                    {dataHora(pedido.criadoEm)}&nbsp;&nbsp;|&nbsp;&nbsp;{ondeFoi(pedido)}
                    <span className={`hist-cli__origem-tag hist-cli__origem-tag--${pedido.origem.toLowerCase()}`}>
                      {ROTULO_ORIGEM[pedido.origem]}
                    </span>
                  </p>

                  {pedido.modalidade === 'ENTREGA' && endereco && (
                    <p className="hist-cli__card-meta">
                      {endereco.rua}, {endereco.numero}
                      {endereco.complemento ? `, ${endereco.complemento}` : ''} — {endereco.bairro}
                    </p>
                  )}
                </div>

                <div className="hist-cli__card-body">
                  <div className="hist-cli__itens">
                    {pedido.itens.map((item) => (
                      <div key={item.id} className="hist-cli__item">
                        <img
                          src={item.imagem || '/icons/restaurant-logo.png'}
                          alt={item.nome}
                          className="hist-cli__item-img"
                          onError={(e) => {
                            e.currentTarget.src = '/icons/restaurant-logo.png'
                          }}
                        />
                        <div className="hist-cli__item-info">
                          <span className="hist-cli__item-nome">
                            {item.quantidade}x {item.nome}
                          </span>
                          <span className="hist-cli__item-preco">{dinheiro(item.preco * item.quantidade)}</span>
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="hist-cli__card-rodape">
                    <div className="hist-cli__totais">
                      {pedido.taxaEntrega > 0 && (
                        <span className="hist-cli__total-label">Taxa de entrega {dinheiro(pedido.taxaEntrega)}</span>
                      )}
                      <span className="hist-cli__total-label">Total</span>
                      <span className="hist-cli__total-destaque">{dinheiro(pedido.total)}</span>
                    </div>

                    {rodape && <span className="hist-cli__btn hist-cli__btn--aguardando">{rodape}</span>}
                    {sit === 'cancelado' && pedido.motivoCancelamento && (
                      <span className="hist-cli__motivo">Motivo: {pedido.motivoCancelamento}</span>
                    )}
                  </div>
                </div>
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}

export default HistoricoPedidos
