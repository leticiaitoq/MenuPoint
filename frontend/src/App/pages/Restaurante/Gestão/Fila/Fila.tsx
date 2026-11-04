import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { HiCheck, HiSearch, HiX, HiClock, HiRefresh } from 'react-icons/hi';
import { MdTableRestaurant, MdDeliveryDining } from 'react-icons/md';
import { FiChevronRight } from 'react-icons/fi';
import RestaurantLayout from '../../../../shared/components/layout/Restaurantelayout';
import PedidoService, { Pedido as PedidoApi, StatusPedido as StatusApi } from '../../../../services/pedido.service';
import { mensagemDeErro } from '../../../../services/cliente.service';
import { ROTAS_CAIXA } from '../../../../routes/caixaRotas';
import './Fila.css';

// ── Tipos ──────────────────────────────────────────────────────────────────────
type StatusFila = 'recebido' | 'preparando' | 'pronto' | 'entregue';

interface PedidoFila {
  id: string;
  numero: string;
  cliente: string;
  /** "Mesa 05", "Entrega" ou "Retirada" */
  local: string;
  /** Pedido de mesa: liga a Fila ao Caixa */
  mesaId?: string;
  itens: { nome: string; quantidade: number; detalhes: string[] }[];
  total: number;
  criadoEm: string;
  status: StatusFila;
  /** Entregue na mesa e ainda não pago: continua na conta da mesa no Caixa */
  aguardandoPagamento: boolean;
}

interface ConfiguracaoColuna {
  status: StatusFila;
  rotulo: string;
  proximoStatus: StatusFila | null;
  corClasse: string;
}

const COLUNAS: ConfiguracaoColuna[] = [
  { status: 'recebido',   rotulo: 'Recebido',   proximoStatus: 'preparando', corClasse: 'fila__coluna--recebido' },
  { status: 'preparando', rotulo: 'Preparando', proximoStatus: 'pronto',     corClasse: 'fila__coluna--preparando' },
  { status: 'pronto',     rotulo: 'Pronto',     proximoStatus: 'entregue',   corClasse: 'fila__coluna--pronto' },
  { status: 'entregue',   rotulo: 'Entregue',   proximoStatus: null,         corClasse: 'fila__coluna--entregue' },
];

const DA_API: Partial<Record<StatusApi, StatusFila>> = {
  RECEBIDO: 'recebido', PREPARO: 'preparando', PRONTO: 'pronto', ENTREGUE: 'entregue',
};
const PARA_API: Record<StatusFila, StatusApi> = {
  recebido: 'RECEBIDO', preparando: 'PREPARO', pronto: 'PRONTO', entregue: 'ENTREGUE',
};

const INTERVALO_ATUALIZACAO_MS = 20000;

// ── Helpers ────────────────────────────────────────────────────────────────────
const formatarPreco = (valor: number): string => `R$ ${valor.toFixed(2).replace('.', ',')}`;

const tempoRelativo = (iso: string): string => {
  const min = Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 60000));
  if (min < 1) return 'agora';
  if (min < 60) return `${min} min atrás`;
  return `${Math.floor(min / 60)} h ${min % 60} min atrás`;
};

const rotuloLocal = (p: PedidoApi): string =>
  p.mesa ? `Mesa ${String(p.mesa.numero).padStart(2, '0')}` : p.modalidade === 'ENTREGA' ? 'Entrega' : 'Retirada';

const daApi = (p: PedidoApi, aguardando: Set<string>): PedidoFila | null => {
  const status = DA_API[p.status];
  if (!status) return null; // cancelado não entra na fila
  return {
    id: p.id,
    numero: `#${p.numero_pedido}`,
    cliente: p.cliente_nome,
    local: rotuloLocal(p),
    mesaId: p.mesa?.id,
    itens: p.itens.map((i) => ({
      nome: i.produto?.nome ?? 'Item',
      quantidade: i.quantidade,
      detalhes: [
        ...(i.observacoes?.trim() ? [i.observacoes.trim()] : []),
        ...((i.itens_adicionais ?? []).map((a) => a.nome_adicional).filter((n): n is string => !!n).map((n) => `+ ${n}`)),
      ],
    })),
    total: p.total,
    criadoEm: p.criado_em,
    status,
    aguardandoPagamento: status === 'entregue' && aguardando.has(p.id),
  };
};

const textoItens = (p: PedidoFila) => p.itens.map((i) => (i.quantidade > 1 ? `${i.quantidade}x ${i.nome}` : i.nome)).join(', ');

// ── Componente principal ───────────────────────────────────────────────────────
const Fila: React.FC = () => {
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  // Vindo do Caixa ("Ver na fila"): mostra só os pedidos daquela mesa
  const mesaFiltro = params.get('mesa');

  const [pedidos, setPedidos] = useState<PedidoFila[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erroLista, setErroLista] = useState<string | null>(null);
  const [atualizadoEm, setAtualizadoEm] = useState<Date | null>(null);

  const [colunaAtiva, setColunaAtiva] = useState<StatusFila>('recebido');
  const [pedidoSelecionadoId, setPedidoSelecionadoId] = useState<string | null>(null);
  const [modalAberto, setModalAberto] = useState(false);
  const [colunaDoModal, setColunaDoModal] = useState<ConfiguracaoColuna | null>(null);
  const [salvando, setSalvando] = useState(false);
  const [erroAcao, setErroAcao] = useState<string | null>(null);

  // ── Dados reais ──
  // Ativos (qualquer data) + entregues de hoje + entregues de mesa que ainda esperam o pagamento no Caixa
  const carregar = useCallback(async (silencioso = false) => {
    if (!silencioso) setCarregando(true);
    try {
      const inicioDoDia = new Date();
      inicioDoDia.setHours(0, 0, 0, 0);

      const [ativos, entreguesHoje, aguardandoCaixa] = await Promise.all([
        PedidoService.listar({ status: ['RECEBIDO', 'PREPARO', 'PRONTO'] }),
        PedidoService.listar({ status: ['ENTREGUE'], data_inicio: inicioDoDia.toISOString() }),
        PedidoService.listar({ status: ['ENTREGUE'], modalidade: 'MESA', conta_aberta: true }),
      ]);

      const aguardando = new Set(aguardandoCaixa.map((p) => p.id));
      const unicos = new Map<string, PedidoApi>();
      [...ativos, ...entreguesHoje, ...aguardandoCaixa].forEach((p) => unicos.set(p.id, p));

      const lista = Array.from(unicos.values())
        .map((p) => daApi(p, aguardando))
        .filter((p): p is PedidoFila => p !== null)
        // O mais antigo primeiro: é o que a cozinha precisa atender antes
        .sort((a, b) => new Date(a.criadoEm).getTime() - new Date(b.criadoEm).getTime());

      setPedidos(lista);
      setErroLista(null);
      setAtualizadoEm(new Date());
    } catch (err: any) {
      // Atualização em segundo plano que falha não apaga o que já está na tela
      if (!silencioso) setErroLista(mensagemDeErro(err, 'Não foi possível carregar a fila de pedidos.'));
    } finally {
      if (!silencioso) setCarregando(false);
    }
  }, []);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  // Atualização automática (sem WebSocket): a cada 20s, e quando a aba volta a ficar visível
  useEffect(() => {
    const timer = window.setInterval(() => {
      if (!document.hidden && !modalAberto) void carregar(true);
    }, INTERVALO_ATUALIZACAO_MS);
    const aoVoltar = () => { if (!document.hidden) void carregar(true); };
    document.addEventListener('visibilitychange', aoVoltar);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener('visibilitychange', aoVoltar);
    };
  }, [carregar, modalAberto]);

  // ── Derivados ──
  const visiveis = useMemo(
    () => (mesaFiltro ? pedidos.filter((p) => p.mesaId === mesaFiltro) : pedidos),
    [pedidos, mesaFiltro]
  );
  const nomeDaMesaFiltrada = useMemo(
    () => pedidos.find((p) => p.mesaId === mesaFiltro)?.local ?? 'Mesa selecionada',
    [pedidos, mesaFiltro]
  );
  const pedidosPorStatus = (status: StatusFila) => visiveis.filter((p) => p.status === status);
  const pedidoSelecionado = visiveis.find((p) => p.id === pedidoSelecionadoId) ?? null;

  // ── Ações ──
  const carregarColuna = (status: StatusFila) => {
    setColunaAtiva(status);
    setPedidoSelecionadoId(null);
  };

  const selecionarPedido = (pedido: PedidoFila) =>
    setPedidoSelecionadoId((prev) => (prev === pedido.id ? null : pedido.id));

  const abrirModal = (coluna: ConfiguracaoColuna) => {
    if (!pedidoSelecionado) return;
    setErroAcao(null);
    setColunaDoModal(coluna);
    setModalAberto(true);
  };

  const fecharModal = () => {
    if (salvando) return;
    setModalAberto(false);
    setColunaDoModal(null);
    setErroAcao(null);
  };

  const confirmarAvanco = async () => {
    if (!pedidoSelecionado || !colunaDoModal?.proximoStatus || salvando) return;
    const novoStatus = colunaDoModal.proximoStatus;

    setSalvando(true);
    setErroAcao(null);
    try {
      await PedidoService.atualizarStatus(pedidoSelecionado.id, PARA_API[novoStatus]);
      setModalAberto(false);
      setColunaDoModal(null);
      setPedidoSelecionadoId(null);
      setColunaAtiva(novoStatus);
      await carregar(true);
    } catch (err: any) {
      setErroAcao(mensagemDeErro(err, 'Não foi possível atualizar o pedido.'));
    } finally {
      setSalvando(false);
    }
  };

  const abrirNoCaixa = (pedido: PedidoFila, e?: React.MouseEvent) => {
    e?.stopPropagation();
    if (pedido.mesaId) navigate(ROTAS_CAIXA.pagarMesa(pedido.mesaId));
  };

  const limparFiltroMesa = () => setParams({});

  // ── Render: linha da tabela ──
  const renderLinhaPedido = (pedido: PedidoFila) => {
    const estaSelecionado = pedidoSelecionadoId === pedido.id;
    return (
      <tr
        key={pedido.id}
        className={`fila__linha-pedido ${estaSelecionado ? 'fila__linha-pedido--selecionado' : ''}`}
        onClick={() => selecionarPedido(pedido)}
      >
        <td className="fila__td fila__td--numero">
          {pedido.numero}
          {estaSelecionado && <HiCheck className="fila__icone-check" />}
        </td>
        <td className="fila__td">{pedido.cliente}</td>
        <td className="fila__td">
          <span className="fila__mesa">
            <MdTableRestaurant /> {pedido.local}
          </span>
        </td>
        <td className="fila__td">{textoItens(pedido)}</td>
        <td className="fila__td fila__td--preco">{formatarPreco(pedido.total)}</td>
        <td className="fila__td fila__td--tempo">
          <HiClock className="fila__icone-tempo" /> {tempoRelativo(pedido.criadoEm)}
        </td>
        <td className="fila__td">
          {pedido.mesaId && (
            <>
              {pedido.aguardandoPagamento && <span className="fila__badge-pagamento">Aguardando pagamento</span>}
              <button className="fila__btn-caixa" onClick={(e) => abrirNoCaixa(pedido, e)}>
                Caixa <FiChevronRight />
              </button>
            </>
          )}
        </td>
      </tr>
    );
  };

  // ── Render: coluna ──
  const renderColuna = (coluna: ConfiguracaoColuna) => {
    const lista = pedidosPorStatus(coluna.status);
    const carregada = colunaAtiva === coluna.status;
    const pedidoNoCard = carregada && pedidoSelecionado?.status === coluna.status ? pedidoSelecionado : null;
    const podeAvancar = carregada && !!pedidoNoCard && coluna.proximoStatus !== null;

    return (
      <div key={coluna.status} className={`fila__coluna ${coluna.corClasse}`}>
        <div className="fila__coluna-header">
          <span className="fila__coluna-rotulo">{coluna.rotulo}</span>
          <span className="fila__coluna-contador">{lista.length}</span>
        </div>

        <div className="fila__card-pedido">
          {!carregada ? (
            <button className="fila__btn-buscar" onClick={() => carregarColuna(coluna.status)}>
              <HiSearch /> Ver pedidos
            </button>
          ) : pedidoNoCard ? (
            <div className="fila__card-info">
              <p className="fila__card-numero">{pedidoNoCard.numero}</p>
              <p className="fila__card-cliente">
                <MdTableRestaurant /> {pedidoNoCard.local}
              </p>
              <p className="fila__card-cliente">👤 {pedidoNoCard.cliente}</p>
              <ul className="fila__card-itens">
                {pedidoNoCard.itens.map((item, i) => (
                  <li key={i}>
                    {item.quantidade}x {item.nome}
                    {item.detalhes.length > 0 && <small> ({item.detalhes.join('; ')})</small>}
                  </li>
                ))}
              </ul>
              <p className="fila__card-total">{formatarPreco(pedidoNoCard.total)}</p>
              {pedidoNoCard.mesaId && (
                <button className="fila__btn-caixa fila__btn-caixa--card" onClick={() => abrirNoCaixa(pedidoNoCard)}>
                  Abrir conta no Caixa <FiChevronRight />
                </button>
              )}
            </div>
          ) : (
            <p className="fila__card-instrucao">
              {lista.length === 0 ? 'Nenhum pedido nesta etapa' : 'Selecione um pedido abaixo'}
            </p>
          )}

          {carregada && (
            <button
              className={`fila__btn-avancar ${podeAvancar ? 'fila__btn-avancar--ativo' : 'fila__btn-avancar--desabilitado'}`}
              onClick={() => podeAvancar && abrirModal(coluna)}
              disabled={!podeAvancar}
            >
              {coluna.proximoStatus === null ? (
                <><HiCheck /> Finalizado</>
              ) : (
                <>Avançar <FiChevronRight /></>
              )}
            </button>
          )}
        </div>
      </div>
    );
  };

  const pedidosVisiveis = pedidosPorStatus(colunaAtiva);
  const totalAtivos = visiveis.filter((p) => p.status !== 'entregue').length;

  return (
    <RestaurantLayout>
      <div className="fila">

        {/* ── Cabeçalho ── */}
        <div className="fila__header">
          <div>
            <h2 className="fila__titulo">Fila de Pedidos</h2>
            <p className="fila__subtitulo">
              Pedidos reais, ligados ao Caixa
              {atualizadoEm && ` · atualizado às ${atualizadoEm.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`}
            </p>
          </div>
          <div className="fila__resumo">
            <span className="fila__resumo-item">
              Pedidos ativos: <strong>{totalAtivos}</strong>
            </span>
            {COLUNAS.filter((c) => c.status !== 'entregue').map((coluna) => (
              <span key={coluna.status} className={`fila__resumo-badge fila__resumo-badge--${coluna.status}`}>
                {coluna.rotulo} · {pedidosPorStatus(coluna.status).length}
              </span>
            ))}
            <button className="fila__btn-atualizar" onClick={() => void carregar()} disabled={carregando} aria-label="Atualizar fila">
              <HiRefresh /> Atualizar
            </button>
          </div>
        </div>

        {mesaFiltro && (
          <div className="fila__filtro-chip">
            Mostrando só: <strong>{nomeDaMesaFiltrada}</strong>
            <button onClick={limparFiltroMesa} aria-label="Limpar filtro de mesa"><HiX /></button>
          </div>
        )}

        {erroLista && (
          <p className="fila__erro" role="alert">
            {erroLista} <button onClick={() => void carregar()}>Tentar novamente</button>
          </p>
        )}

        {carregando && pedidos.length === 0 ? (
          <div className="fila__estado-inicial">
            <MdDeliveryDining className="fila__estado-icone" />
            <p>Carregando a fila…</p>
          </div>
        ) : (
          <>
            {/* ── Kanban ── */}
            <div className="fila__kanban">{COLUNAS.map(renderColuna)}</div>

            {/* ── Tabela de pedidos da coluna ativa ── */}
            <div className="fila__tabela-container">
              <div className="fila__tabela-header">
                <span className="fila__tabela-titulo">
                  <HiRefresh /> {COLUNAS.find((c) => c.status === colunaAtiva)?.rotulo}
                </span>
                <span className="fila__tabela-dica">
                  Clique em um pedido para selecioná-lo e avançar o status
                </span>
              </div>

              {pedidosVisiveis.length === 0 ? (
                <p className="fila__tabela-vazia">Nenhum pedido nesta etapa.</p>
              ) : (
                <div className="fila__tabela-scroll">
                  <table className="fila__tabela">
                    <thead>
                      <tr>
                        <th className="fila__th">Pedido</th>
                        <th className="fila__th">Cliente</th>
                        <th className="fila__th">Local</th>
                        <th className="fila__th">Itens</th>
                        <th className="fila__th">Total</th>
                        <th className="fila__th">Tempo</th>
                        <th className="fila__th">Caixa</th>
                      </tr>
                    </thead>
                    <tbody>{pedidosVisiveis.map(renderLinhaPedido)}</tbody>
                  </table>
                </div>
              )}
            </div>
          </>
        )}
      </div>

      {/* ── Modal de confirmação ── */}
      {modalAberto && pedidoSelecionado && colunaDoModal && (
        <div className="fila__modal-overlay" onClick={fecharModal}>
          <div className="fila__modal" onClick={(e) => e.stopPropagation()}>
            <button className="fila__modal-fechar" onClick={fecharModal} disabled={salvando}>
              <HiX />
            </button>

            <div className="fila__modal-icone">
              <FiChevronRight />
            </div>

            <h3 className="fila__modal-titulo">Avançar pedido?</h3>
            <p className="fila__modal-descricao">
              O pedido <strong>{pedidoSelecionado.numero}</strong> de <strong>{pedidoSelecionado.cliente}</strong> será movido de{' '}
              <strong>{colunaDoModal.rotulo}</strong> para{' '}
              <strong>{COLUNAS.find((c) => c.status === colunaDoModal.proximoStatus)?.rotulo}</strong>.
            </p>
            {colunaDoModal.proximoStatus === 'entregue' && pedidoSelecionado.mesaId && (
              <p className="fila__modal-descricao">
                Ele continua na conta da <strong>{pedidoSelecionado.local}</strong> até o pagamento no Caixa.
              </p>
            )}
            {erroAcao && <p className="fila__erro" role="alert">{erroAcao}</p>}

            <div className="fila__modal-acoes">
              <button className="fila__modal-btn-cancelar" onClick={fecharModal} disabled={salvando}>
                Cancelar
              </button>
              <button className="fila__modal-btn-confirmar" onClick={() => void confirmarAvanco()} disabled={salvando}>
                <HiCheck /> {salvando ? 'Salvando…' : 'Confirmar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </RestaurantLayout>
  );
};

export default Fila;
