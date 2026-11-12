import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { HiCheck, HiSearch, HiX, HiClock, HiRefresh, HiOutlineClipboardList } from 'react-icons/hi';
import { MdTableRestaurant, MdDeliveryDining } from 'react-icons/md';
import { FiChevronRight } from 'react-icons/fi';
import RestaurantLayout from '../../../../shared/components/layout/Restaurantelayout';
import ModalAlerta from '../../../../shared/components/ModalAlerta/ModalAlerta';
import ComandaCozinha from '../../../../shared/components/ComandaCozinha/ComandaCozinha';
import { useComandaMesa } from '../../../../shared/components/ComandaCozinha/useComandaMesa';
import PedidoService, { Pedido as PedidoApi, StatusPedido as StatusApi, ModalidadePedido } from '../../../../services/pedido.service';
import { mensagemDeErro } from '../../../../services/cliente.service';
import './Fila.css';

// ── Tipos ──────────────────────────────────────────────────────────────────────
type StatusFila = 'recebido' | 'preparando' | 'pronto' | 'entregue';

/** Cada comida do pedido anda sozinha pela cozinha: tem a sua própria etapa */
interface ItemFila {
  id: string;
  nome: string;
  quantidade: number;
  detalhes: string[];
  preco: number;
  status: StatusFila;
}

interface PedidoFila {
  id: string;
  numero: string;
  cliente: string;
  /** "Mesa 05", "Entrega" ou "Retirada" */
  local: string;
  /** Pedido de mesa: libera a comanda da cozinha */
  mesaId?: string;
  mesaNumero?: number;
  /** Delivery (ENTREGA/RETIRADA) sai pelo Caixa: a Fila acompanha só até "Pronto" */
  modalidade: ModalidadePedido;
  itens: ItemFila[];
  criadoEm: string;
  /** Etapa do pedido inteiro (= a do item mais atrasado) */
  status: StatusFila;
  /** Entregue na mesa e ainda não pago: continua na conta da mesa no Caixa */
  aguardandoPagamento: boolean;
}

/** Um pedido "fatiado": só os itens que estão numa etapa */
interface FragmentoFila {
  pedido: PedidoFila;
  itens: ItemFila[];
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

//  Helpers 
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
    mesaNumero: p.mesa?.numero,
    modalidade: p.modalidade,
    itens: p.itens.map((i) => ({
      id: i.id,
      nome: i.produto?.nome ?? 'Item',
      quantidade: i.quantidade,
      detalhes: [
        ...(i.observacoes?.trim() ? [i.observacoes.trim()] : []),
        ...((i.itens_adicionais ?? []).map((a) => a.nome_adicional).filter((n): n is string => !!n).map((n) => `+ ${n}`)),
      ],
      preco: i.preco_total,
      // Pedido antigo (sem etapa por item): o item segue a etapa do pedido
      status: (i.status && DA_API[i.status]) || status,
    })),
    criadoEm: p.criado_em,
    status,
    aguardandoPagamento: status === 'entregue' && aguardando.has(p.id),
  };
};

const textoItem = (i: Pick<ItemFila, 'nome' | 'quantidade'>) => `${i.quantidade}x ${i.nome}`;

/** Pedido de delivery que já está pronto: quem entrega ou recebe o cliente é o Caixa, não a cozinha */
const saiPeloCaixa = (pedido: Pick<PedidoFila, 'modalidade'>, status: StatusFila): boolean =>
  status === 'pronto' && pedido.modalidade !== 'MESA';

const avisoSaiPeloCaixa = (pedido: Pick<PedidoFila, 'modalidade'>): string =>
  pedido.modalidade === 'RETIRADA' ? 'Aguardando retirada no Caixa' : 'Aguardando entregador (Caixa)';

// ── Componente principal ───────────────────────────────────────────────────────
const Fila: React.FC = () => {
  const [params, setParams] = useSearchParams();
  // Vindo do Caixa ("Ver na fila"): mostra só os pedidos daquela mesa
  const mesaFiltro = params.get('mesa');

  const [pedidos, setPedidos] = useState<PedidoFila[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erroLista, setErroLista] = useState<string | null>(null);
  const [atualizadoEm, setAtualizadoEm] = useState<Date | null>(null);

  const [colunaAtiva, setColunaAtiva] = useState<StatusFila>('recebido');
  /** Itens marcados na coluna aberta (só eles avançam) */
  const [itensMarcados, setItensMarcados] = useState<Set<string>>(new Set());
  const [modalAberto, setModalAberto] = useState(false);
  const [colunaDoModal, setColunaDoModal] = useState<ConfiguracaoColuna | null>(null);
  const [resumoModal, setResumoModal] = useState<string[]>([]);
  const [salvando, setSalvando] = useState(false);
  const [erroAcao, setErroAcao] = useState<string | null>(null);

  // Comanda da cozinha (mostrar + imprimir) — a mesma do Caixa
  const comanda = useComandaMesa();

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

  const comandaAberta = comanda.mesa !== null;

  // Atualização automática (sem WebSocket): a cada 20s, e quando a aba volta a ficar visível.
  // Pausa com um modal aberto para não mexer na tela debaixo do usuário.
  useEffect(() => {
    const timer = window.setInterval(() => {
      if (!document.hidden && !modalAberto && !comandaAberta) void carregar(true);
    }, INTERVALO_ATUALIZACAO_MS);
    const aoVoltar = () => { if (!document.hidden) void carregar(true); };
    document.addEventListener('visibilitychange', aoVoltar);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener('visibilitychange', aoVoltar);
    };
  }, [carregar, modalAberto, comandaAberta]);

  // ── Derivados ──
  const visiveis = useMemo(
    () => (mesaFiltro ? pedidos.filter((p) => p.mesaId === mesaFiltro) : pedidos),
    [pedidos, mesaFiltro]
  );
  const nomeDaMesaFiltrada = useMemo(
    () => pedidos.find((p) => p.mesaId === mesaFiltro)?.local ?? 'Mesa selecionada',
    [pedidos, mesaFiltro]
  );

  /** Pedidos fatiados: de cada pedido, só os itens que estão nesta etapa */
  const fragmentosDe = useCallback(
    (status: StatusFila): FragmentoFila[] =>
      visiveis
        .map((pedido) => ({ pedido, itens: pedido.itens.filter((i) => i.status === status) }))
        .filter((f) => f.itens.length > 0),
    [visiveis]
  );

  const colunaAtual = COLUNAS.find((c) => c.status === colunaAtiva) ?? COLUNAS[0];
  const fragmentosAtivos = useMemo(() => fragmentosDe(colunaAtiva), [fragmentosDe, colunaAtiva]);
  const quantidadeNaColuna = (status: StatusFila) =>
    fragmentosDe(status).reduce((soma, f) => soma + f.itens.length, 0);

  /** Itens marcados que ainda estão nesta etapa (se alguém avançou um deles, ele sai da seleção) */
  const marcados = useMemo(
    () =>
      fragmentosAtivos.flatMap((f) =>
        f.itens.filter((i) => itensMarcados.has(i.id)).map((item) => ({ pedido: f.pedido, item }))
      ),
    [fragmentosAtivos, itensMarcados]
  );

  const totalAtivos = visiveis.filter((p) => p.status !== 'entregue').length;

  // ── Ações ──
  const carregarColuna = (status: StatusFila) => {
    setColunaAtiva(status);
    setItensMarcados(new Set());
  };

  const alternarItem = (itemId: string) =>
    setItensMarcados((prev) => {
      const novo = new Set(prev);
      if (novo.has(itemId)) novo.delete(itemId);
      else novo.add(itemId);
      return novo;
    });

  const alternarTodosDoPedido = (fragmento: FragmentoFila) =>
    setItensMarcados((prev) => {
      const novo = new Set(prev);
      const todos = fragmento.itens.every((i) => novo.has(i.id));
      fragmento.itens.forEach((i) => (todos ? novo.delete(i.id) : novo.add(i.id)));
      return novo;
    });

  /** Marca (ou desmarca) de uma vez todos os itens da mesa que estão nesta etapa, de todos os pedidos dela */
  const alternarTodosDaMesa = (mesaId: string) =>
    setItensMarcados((prev) => {
      const novo = new Set(prev);
      const itens = fragmentosAtivos.filter((f) => f.pedido.mesaId === mesaId).flatMap((f) => f.itens);
      const todos = itens.every((i) => novo.has(i.id));
      itens.forEach((i) => (todos ? novo.delete(i.id) : novo.add(i.id)));
      return novo;
    });

  const abrirModal = (coluna: ConfiguracaoColuna) => {
    if (marcados.length === 0) return;
    setErroAcao(null);
    setColunaDoModal(coluna);
    setResumoModal(marcados.map(({ pedido, item }) => `${pedido.numero} · ${pedido.local} — ${textoItem(item)}`));
    setModalAberto(true);
  };

  const fecharModal = useCallback(() => {
    if (salvando) return;
    setModalAberto(false);
    setColunaDoModal(null);
    setErroAcao(null);
  }, [salvando]);

  const confirmarAvanco = async () => {
    if (!colunaDoModal?.proximoStatus || salvando) return;
    if (marcados.length === 0) {
      fecharModal();
      return;
    }
    const novoStatus = colunaDoModal.proximoStatus;

    // Um pedido por chamada: só os itens marcados dele avançam
    const porPedido = new Map<string, string[]>();
    marcados.forEach(({ pedido, item }) => porPedido.set(pedido.id, [...(porPedido.get(pedido.id) ?? []), item.id]));

    setSalvando(true);
    setErroAcao(null);
    try {
      for (const [pedidoId, itemIds] of porPedido) {
        await PedidoService.atualizarStatusItens(pedidoId, itemIds, PARA_API[novoStatus]);
      }
      setModalAberto(false);
      setColunaDoModal(null);
      setItensMarcados(new Set());
      setColunaAtiva(novoStatus);
      await carregar(true);
    } catch (err: any) {
      setErroAcao(mensagemDeErro(err, 'Não foi possível atualizar os itens.'));
      void carregar(true); // se parte já avançou, a tela passa a mostrar o que realmente mudou
    } finally {
      setSalvando(false);
    }
  };

  const limparFiltroMesa = () => setParams({});

  // ── Render: linha da tabela (um pedido fatiado) ──
  const renderLinhaPedido = (fragmento: FragmentoFila) => {
    const { pedido, itens } = fragmento;
    // Delivery pronto não avança pela Fila (o backend também recusa): o Caixa finaliza
    const entregaPeloCaixa = saiPeloCaixa(pedido, colunaAtiva);
    const podeMarcar = colunaAtual.proximoStatus !== null && !entregaPeloCaixa;
    const algumMarcado = itens.some((i) => itensMarcados.has(i.id));
    const todosMarcados = itens.every((i) => itensMarcados.has(i.id));
    // Itens entregues de um pedido que ainda não foi pago continuam na conta da mesa
    const aguardandoPagamento =
      colunaAtiva === 'entregue' && !!pedido.mesaId && (pedido.status !== 'entregue' || pedido.aguardandoPagamento);

    // Mesa com itens em mais de um pedido nesta etapa: libera "marcar a mesa toda"
    const fragmentosDaMesa = pedido.mesaId ? fragmentosAtivos.filter((f) => f.pedido.mesaId === pedido.mesaId) : [];
    const itensDaMesa = fragmentosDaMesa.flatMap((f) => f.itens);
    const mesaTodaMarcada = itensDaMesa.length > 0 && itensDaMesa.every((i) => itensMarcados.has(i.id));
    const mostrarMesaToda = podeMarcar && fragmentosDaMesa.length > 1;

    return (
      <tr
        key={pedido.id}
        className={`fila__linha-pedido ${algumMarcado ? 'fila__linha-pedido--selecionado' : ''}`}
      >
        <td className="fila__td fila__td--numero">
          {pedido.numero}
          {algumMarcado && <HiCheck className="fila__icone-check" />}
        </td>
        <td className="fila__td fila__td--cliente">{pedido.cliente}</td>
        <td className="fila__td fila__td--local">
          <span className="fila__mesa">
            <MdTableRestaurant /> {pedido.local}
          </span>
          {mostrarMesaToda && (
            <button
              type="button"
              className="fila__link-todos fila__link-mesa"
              onClick={() => alternarTodosDaMesa(pedido.mesaId!)}
            >
              {mesaTodaMarcada ? 'Desmarcar a mesa' : `Marcar a mesa toda (${itensDaMesa.length} itens)`}
            </button>
          )}
        </td>
        <td className="fila__td fila__td--itens">
          <ul className="fila__itens-lista">
            {itens.map((item) => (
              <li key={item.id}>
                {podeMarcar ? (
                  <label className="fila__item">
                    <input
                      type="checkbox"
                      checked={itensMarcados.has(item.id)}
                      onChange={() => alternarItem(item.id)}
                      aria-label={`Marcar ${textoItem(item)} do pedido ${pedido.numero}`}
                    />
                    <span>
                      {textoItem(item)}
                      {item.detalhes.length > 0 && <small> ({item.detalhes.join('; ')})</small>}
                    </span>
                  </label>
                ) : (
                  <span className="fila__item">
                    <span>
                      {textoItem(item)}
                      {item.detalhes.length > 0 && <small> ({item.detalhes.join('; ')})</small>}
                    </span>
                  </span>
                )}
              </li>
            ))}
          </ul>
          {podeMarcar && itens.length > 1 && (
            <button type="button" className="fila__link-todos" onClick={() => alternarTodosDoPedido(fragmento)}>
              {todosMarcados ? 'Desmarcar todos' : 'Marcar todos'}
            </button>
          )}
        </td>
        <td className="fila__td fila__td--preco">{formatarPreco(itens.reduce((soma, i) => soma + i.preco, 0))}</td>
        <td className="fila__td fila__td--tempo">
          <HiClock className="fila__icone-tempo" /> {tempoRelativo(pedido.criadoEm)}
        </td>
        <td className="fila__td fila__td--comanda">
          {aguardandoPagamento && <span className="fila__badge-pagamento">Aguardando pagamento</span>}
          {entregaPeloCaixa && <span className="fila__badge-pagamento">{avisoSaiPeloCaixa(pedido)}</span>}
          {pedido.mesaId && pedido.mesaNumero !== undefined && (
            <button
              className="fila__btn-avancar fila__btn-avancar--ativo fila__btn-avancar--compacto"
              onClick={() => comanda.abrir({ id: pedido.mesaId!, numero: pedido.mesaNumero! })}
            >
              <HiOutlineClipboardList /> Comanda da cozinha
            </button>
          )}
        </td>
      </tr>
    );
  };

  // ── Render: coluna ──
  const renderColuna = (coluna: ConfiguracaoColuna) => {
    const quantidade = quantidadeNaColuna(coluna.status);
    const carregada = colunaAtiva === coluna.status;
    const podeAvancar = carregada && marcados.length > 0 && coluna.proximoStatus !== null;
    // Coluna "Pronto" só com delivery: não há o que marcar aqui
    const soDeliveryPeloCaixa =
      quantidade > 0 && fragmentosDe(coluna.status).every((f) => saiPeloCaixa(f.pedido, coluna.status));

    return (
      <div key={coluna.status} className={`fila__coluna ${coluna.corClasse}`}>
        <div className="fila__coluna-header">
          <span className="fila__coluna-rotulo">{coluna.rotulo}</span>
          <span className="fila__coluna-contador">{quantidade}</span>
        </div>

        <div className="fila__card-pedido">
          {!carregada ? (
            <button className="fila__btn-buscar" onClick={() => carregarColuna(coluna.status)}>
              <HiSearch /> Ver pedidos
            </button>
          ) : marcados.length > 0 ? (
            <div className="fila__card-info">
              <p className="fila__card-numero">
                {marcados.length} {marcados.length === 1 ? 'item marcado' : 'itens marcados'}
              </p>
              <ul className="fila__card-itens">
                {marcados.slice(0, 4).map(({ pedido, item }) => (
                  <li key={item.id}>
                    {textoItem(item)} <small>({pedido.numero})</small>
                  </li>
                ))}
                {marcados.length > 4 && <li>+ {marcados.length - 4} …</li>}
              </ul>
            </div>
          ) : (
            <p className="fila__card-instrucao">
              {quantidade === 0
                ? 'Nenhum item nesta etapa'
                : coluna.proximoStatus === null
                  ? 'Itens já entregues'
                  : soDeliveryPeloCaixa
                    ? 'Delivery é finalizado pelo Caixa'
                    : 'Marque os itens abaixo'}
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

  const proximaColuna = COLUNAS.find((c) => c.status === colunaDoModal?.proximoStatus);

  // Celular: barra fixa com o "Avançar" enquanto houver itens marcados (o CSS só a mostra em ≤600px)
  const mostrarBarra = marcados.length > 0 && colunaAtual.proximoStatus !== null;

  return (
    <RestaurantLayout>
      <div className={`fila${mostrarBarra ? ' fila--com-selecao' : ''}`}>

        {/* ── Cabeçalho ── */}
        <div className="fila__header">
          <div>
            <h2 className="fila__titulo">Fila de Pedidos</h2>
            <p className="fila__subtitulo">
              Cada comida do pedido avança sozinha, assim que sai da cozinha
              {atualizadoEm && ` · atualizado às ${atualizadoEm.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`}
            </p>
          </div>
          <div className="fila__resumo">
            <span className="fila__resumo-item">
              Pedidos ativos: <strong>{totalAtivos}</strong>
            </span>
            {COLUNAS.filter((c) => c.status !== 'entregue').map((coluna) => (
              <span key={coluna.status} className={`fila__resumo-badge fila__resumo-badge--${coluna.status}`}>
                {coluna.rotulo} · {quantidadeNaColuna(coluna.status)}
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
            {/* ── Abas das etapas (só no celular; no desktop vale o kanban) ── */}
            <div className="fila__abas" role="tablist" aria-label="Etapas do pedido">
              {COLUNAS.map((coluna) => (
                <button
                  key={coluna.status}
                  type="button"
                  role="tab"
                  aria-selected={colunaAtiva === coluna.status}
                  className={`fila__aba fila__aba--${coluna.status}${colunaAtiva === coluna.status ? ' fila__aba--ativa' : ''}`}
                  onClick={() => carregarColuna(coluna.status)}
                >
                  {coluna.rotulo}
                  <span className="fila__aba-contador">{quantidadeNaColuna(coluna.status)}</span>
                </button>
              ))}
            </div>

            {/* ── Kanban (conta itens, não pedidos) ── */}
            <div className="fila__kanban">{COLUNAS.map(renderColuna)}</div>

            {/* ── Tabela: pedidos fatiados da coluna ativa ── */}
            <div className="fila__tabela-container">
              <div className="fila__tabela-header">
                <span className="fila__tabela-titulo">
                  <HiRefresh /> {colunaAtual.rotulo}
                </span>
                <span className="fila__tabela-dica">
                  {colunaAtual.proximoStatus === null
                    ? 'Itens que já saíram da cozinha e foram entregues'
                    : 'Marque os itens que ficaram prontos e clique em Avançar: só eles seguem para a próxima etapa'}
                </span>
              </div>

              {fragmentosAtivos.length === 0 ? (
                <p className="fila__tabela-vazia">Nenhum item nesta etapa.</p>
              ) : (
                <div className="fila__tabela-scroll">
                  <table className="fila__tabela">
                    <thead>
                      <tr>
                        <th className="fila__th">Pedido</th>
                        <th className="fila__th">Cliente</th>
                        <th className="fila__th">Local</th>
                        <th className="fila__th">Itens</th>
                        <th className="fila__th">Valor</th>
                        <th className="fila__th">Tempo</th>
                        <th className="fila__th">Comanda</th>
                      </tr>
                    </thead>
                    <tbody>{fragmentosAtivos.map(renderLinhaPedido)}</tbody>
                  </table>
                </div>
              )}
            </div>
          </>
        )}

        {/* ── Barra de ação do celular (o CSS a esconde acima de 600px) ── */}
        {mostrarBarra && (
          <div className="fila__barra-acao">
            <span className="fila__barra-acao-texto">
              <strong>{marcados.length}</strong> {marcados.length === 1 ? 'item marcado' : 'itens marcados'}
            </span>
            <button type="button" className="fila__barra-acao-limpar" onClick={() => setItensMarcados(new Set())}>
              Limpar
            </button>
            <button
              type="button"
              className="fila__btn-avancar fila__btn-avancar--ativo"
              onClick={() => abrirModal(colunaAtual)}
            >
              Avançar <FiChevronRight />
            </button>
          </div>
        )}
      </div>

      {/* ── Modal de confirmação (padrão do sistema) ── */}
      <ModalAlerta
        aberto={modalAberto && !!colunaDoModal}
        variante="info"
        titulo={resumoModal.length === 1 ? 'Avançar este item?' : `Avançar ${resumoModal.length} itens?`}
        mensagem={
          <>
            <p className="fila__modal-texto">
              Será movido de <strong>{colunaDoModal?.rotulo}</strong> para <strong>{proximaColuna?.rotulo}</strong>:
            </p>
            <ul className="fila__modal-lista">
              {resumoModal.map((linha) => <li key={linha}>{linha}</li>)}
            </ul>
            {colunaDoModal?.proximoStatus === 'entregue' && (
              <p className="fila__modal-nota">
                Itens de mesa continuam na conta até o pagamento no Caixa.
              </p>
            )}
            {erroAcao && <p className="fila__erro fila__erro--modal" role="alert">{erroAcao}</p>}
          </>
        }
        textoConfirmar={salvando ? 'Salvando…' : 'Avançar'}
        textoCancelar="Cancelar"
        carregando={salvando}
        onConfirmar={() => void confirmarAvanco()}
        onFechar={fecharModal}
      />

      {/* ── Comanda da cozinha: mostrar e imprimir (a mesma do Caixa) ── */}
      <ComandaCozinha
        aberta={comandaAberta}
        pedido={comanda.pedido}
        mesaNumero={comanda.mesa?.numero}
        carregando={comanda.carregando}
        erro={comanda.erro}
        onTentarNovamente={comanda.tentarNovamente}
        onFechar={comanda.fechar}
      />
    </RestaurantLayout>
  );
};

export default Fila;