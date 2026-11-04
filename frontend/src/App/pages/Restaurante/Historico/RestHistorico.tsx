import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { FiSearch, FiDownload, FiX, FiChevronRight, FiCreditCard, FiUsers, FiCalendar } from 'react-icons/fi';
import { HiOutlineTable, HiOutlineCash } from 'react-icons/hi';
import { MdPix } from 'react-icons/md';
import RestaurantLayout from '../../../shared/components/layout/Restaurantelayout';
import PedidoService, { Pedido as PedidoApi, StatusPedido } from '../../../services/pedido.service';
import { mensagemDeErro } from '../../../services/cliente.service';
import './RestHistorico.css';

// ── Tipos ──────────────────────────────────────────────
type Aba = 'pedidos' | 'mesas';
type Situacao = 'concluido' | 'cancelado' | 'andamento';
type Forma = 'Pix' | 'Cartão' | 'Dinheiro' | 'Sem pagamento';

/** Uma "passagem" por uma mesa: pedidos da mesma mesa no mesmo dia */
interface SessaoMesa {
  chave: string;
  mesa: string;
  dia: string; // yyyy-MM-dd (data local)
  dataHora: string; // ISO do primeiro pedido
  ultimaHora: number; // timestamp do último pedido (ordenação)
  pedidos: PedidoApi[];
  itens: number;
  clientes: string[];
  total: number; // soma dos pedidos que não foram cancelados
  situacao: Situacao;
}

const ITENS_POR_PAGINA = 10;

// ── Helpers ────────────────────────────────────────────
const formatarMoeda = (valor: number) =>
  valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

const formatarDataHora = (iso: string) =>
  new Date(iso)
    .toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
    .replace(',', '');

const formatarHora = (iso: string) =>
  new Date(iso).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

const pad = (n: number) => String(n).padStart(2, '0');
const diaLocal = (iso: string) => {
  const d = new Date(iso);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};
const formatarDia = (dia: string) => dia.split('-').reverse().join('/');

const situacaoDoPedido = (status: StatusPedido): Situacao =>
  status === 'ENTREGUE' ? 'concluido' : status === 'CANCELADO' ? 'cancelado' : 'andamento';

const ROTULO_SITUACAO: Record<Situacao, string> = {
  concluido: 'Concluído',
  cancelado: 'Cancelado',
  andamento: 'Em andamento',
};
const CLASSE_SITUACAO: Record<Situacao, string> = {
  concluido: 'hist__badge--verde',
  cancelado: 'hist__badge--vermelho',
  andamento: 'hist__badge--amarelo',
};

const formaDoPedido = (p: PedidoApi): Forma => {
  const metodo = p.pagamento?.metodo ?? p.forma_pagamento;
  if (metodo === 'PIX_ONLINE' || metodo === 'PIX_PRESENCIAL') return 'Pix';
  if (metodo === 'CARTAO') return 'Cartão';
  if (metodo === 'DINHEIRO') return 'Dinheiro';
  return 'Sem pagamento';
};

const ICONE_PAGAMENTO: Record<Forma, React.ReactNode> = {
  Pix: <MdPix />,
  Cartão: <FiCreditCard />,
  Dinheiro: <HiOutlineCash />,
  'Sem pagamento': null,
};

const STATUS_PAGAMENTO: Record<string, string> = {
  PENDENTE: 'Pendente',
  CONFIRMADO: 'Confirmado',
  ESTORNADO: 'Estornado',
  FALHOU: 'Falhou',
};

const rotuloLocal = (p: PedidoApi) =>
  p.mesa ? `Mesa ${pad(p.mesa.numero)}` : p.modalidade === 'ENTREGA' ? 'Entrega' : 'Retirada';

const rotuloModalidade = (p: PedidoApi) =>
  p.modalidade === 'MESA' ? 'Salão' : p.modalidade === 'ENTREGA' ? 'Delivery' : 'Retirada';

const totalItens = (p: PedidoApi) => p.itens.reduce((soma, i) => soma + i.quantidade, 0);

const unicos = (nomes: string[]) => {
  const vistos = new Map<string, string>();
  nomes.forEach((n) => {
    const limpo = n.trim().replace(/\s+/g, ' ');
    if (limpo && !vistos.has(limpo.toLowerCase())) vistos.set(limpo.toLowerCase(), limpo);
  });
  return Array.from(vistos.values());
};

// Junta os pedidos de mesa em "passagens": mesma mesa + mesmo dia
const agruparPorMesa = (pedidos: PedidoApi[]): SessaoMesa[] => {
  const mapa = new Map<string, PedidoApi[]>();
  pedidos.forEach((p) => {
    if (!p.mesa) return;
    const chave = `${p.mesa.id}|${diaLocal(p.criado_em)}`;
    mapa.set(chave, [...(mapa.get(chave) ?? []), p]);
  });

  return Array.from(mapa.entries())
    .map(([chave, lista]): SessaoMesa => {
      const ordenados = [...lista].sort((a, b) => new Date(a.criado_em).getTime() - new Date(b.criado_em).getTime());
      const situacoes = ordenados.map((p) => situacaoDoPedido(p.status));
      return {
        chave,
        mesa: rotuloLocal(ordenados[0]),
        dia: diaLocal(ordenados[0].criado_em),
        dataHora: ordenados[0].criado_em,
        ultimaHora: new Date(ordenados[ordenados.length - 1].criado_em).getTime(),
        pedidos: ordenados,
        itens: ordenados.reduce((s, p) => s + totalItens(p), 0),
        clientes: unicos(ordenados.map((p) => p.cliente_nome)),
        total: ordenados.reduce((s, p) => s + (p.status === 'CANCELADO' ? 0 : p.total), 0),
        situacao: situacoes.includes('andamento')
          ? 'andamento'
          : situacoes.every((s) => s === 'cancelado')
            ? 'cancelado'
            : 'concluido',
      };
    })
    .sort((a, b) => b.ultimaHora - a.ultimaHora);
};

const RestHistorico: React.FC = () => {
  // Dados reais
  const [pedidos, setPedidos] = useState<PedidoApi[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);

  const [aba, setAba] = useState<Aba>('pedidos');

  // Filtros
  const [dataInicio, setDataInicio] = useState('');
  const [dataFim, setDataFim] = useState('');
  const [mesaFiltro, setMesaFiltro] = useState('todas');
  const [situacaoFiltro, setSituacaoFiltro] = useState<'todos' | Situacao>('todos');
  const [pagamentoFiltro, setPagamentoFiltro] = useState<'todas' | Forma>('todas');
  const [busca, setBusca] = useState('');
  const [periodoAberto, setPeriodoAberto] = useState(false);

  // Paginação
  const [paginaAtual, setPaginaAtual] = useState(1);

  // Painel de detalhes
  const [pedidoSelecionado, setPedidoSelecionado] = useState<PedidoApi | null>(null);
  const [sessaoSelecionada, setSessaoSelecionada] = useState<SessaoMesa | null>(null);
  const [mostrarObservacoes, setMostrarObservacoes] = useState(false);

  // ── Busca no backend (o período é filtrado lá; o resto é filtrado aqui) ──
  const carregar = useCallback(async () => {
    setCarregando(true);
    setErro(null);
    try {
      const lista = await PedidoService.listar({
        data_inicio: dataInicio ? new Date(`${dataInicio}T00:00:00`).toISOString() : undefined,
        data_fim: dataFim ? new Date(`${dataFim}T23:59:59.999`).toISOString() : undefined,
      });
      setPedidos(lista);
    } catch (err: any) {
      setErro(mensagemDeErro(err, 'Não foi possível carregar o histórico.'));
    } finally {
      setCarregando(false);
    }
  }, [dataInicio, dataFim]);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  const locaisDisponiveis = useMemo(
    () => Array.from(new Set(pedidos.map(rotuloLocal))).sort((a, b) => a.localeCompare(b, 'pt-BR', { numeric: true })),
    [pedidos]
  );

  const filtrosAtivos =
    !!dataInicio || !!dataFim || mesaFiltro !== 'todas' ||
    situacaoFiltro !== 'todos' || pagamentoFiltro !== 'todas' || !!busca;

  // ── Aplica os filtros ──
  const pedidosFiltrados = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    return pedidos.filter((p) => {
      if (mesaFiltro !== 'todas' && rotuloLocal(p) !== mesaFiltro) return false;
      if (situacaoFiltro !== 'todos' && situacaoDoPedido(p.status) !== situacaoFiltro) return false;
      if (pagamentoFiltro !== 'todas' && formaDoPedido(p) !== pagamentoFiltro) return false;
      if (termo) {
        const alvo = [
          String(p.numero_pedido),
          p.cliente_nome,
          p.atendido_por?.nome ?? '',
          rotuloLocal(p),
        ].join(' ').toLowerCase();
        if (!alvo.includes(termo)) return false;
      }
      return true;
    });
  }, [pedidos, mesaFiltro, situacaoFiltro, pagamentoFiltro, busca]);

  const sessoesFiltradas = useMemo(() => agruparPorMesa(pedidosFiltrados), [pedidosFiltrados]);

  const totalRegistros = aba === 'pedidos' ? pedidosFiltrados.length : sessoesFiltradas.length;

  // Sempre que filtros/aba mudam, volta para a primeira página
  useEffect(() => {
    setPaginaAtual(1);
  }, [dataInicio, dataFim, mesaFiltro, situacaoFiltro, pagamentoFiltro, busca, aba]);

  const totalPaginas = Math.max(1, Math.ceil(totalRegistros / ITENS_POR_PAGINA));
  const indiceInicio = (paginaAtual - 1) * ITENS_POR_PAGINA;
  const pedidosDaPagina = pedidosFiltrados.slice(indiceInicio, indiceInicio + ITENS_POR_PAGINA);
  const sessoesDaPagina = sessoesFiltradas.slice(indiceInicio, indiceInicio + ITENS_POR_PAGINA);

  const limparFiltros = () => {
    setDataInicio('');
    setDataFim('');
    setMesaFiltro('todas');
    setSituacaoFiltro('todos');
    setPagamentoFiltro('todas');
    setBusca('');
  };

  const fecharDetalhes = () => {
    setPedidoSelecionado(null);
    setSessaoSelecionada(null);
    setMostrarObservacoes(false);
  };
  const abrirPedido = (p: PedidoApi) => {
    setSessaoSelecionada(null);
    setPedidoSelecionado(p);
    setMostrarObservacoes(false);
  };
  const abrirSessao = (s: SessaoMesa) => {
    setPedidoSelecionado(null);
    setSessaoSelecionada(s);
  };
  const trocarAba = (nova: Aba) => {
    fecharDetalhes();
    setAba(nova);
  };

  // ── Exporta a lista da aba atual em CSV ──
  const exportarCsv = () => {
    const cabecalho =
      aba === 'pedidos'
        ? ['Pedido', 'Data/Hora', 'Local', 'Itens', 'Cliente', 'Garçom', 'Total', 'Pagamento', 'Situação', 'Motivo do cancelamento']
        : ['Data', 'Mesa', 'Pedidos', 'Itens', 'Clientes', 'Total', 'Situação'];
    const linhas =
      aba === 'pedidos'
        ? pedidosFiltrados.map((p) => [
            `#${p.numero_pedido}`, formatarDataHora(p.criado_em), rotuloLocal(p), String(totalItens(p)),
            p.cliente_nome || '-', p.atendido_por?.nome ?? '-', formatarMoeda(p.total), formaDoPedido(p),
            ROTULO_SITUACAO[situacaoDoPedido(p.status)], p.cancelamento_motivo ?? '',
          ])
        : sessoesFiltradas.map((s) => [
            formatarDia(s.dia), s.mesa, String(s.pedidos.length), String(s.itens),
            s.clientes.join(', ') || '-', formatarMoeda(s.total), ROTULO_SITUACAO[s.situacao],
          ]);

    const conteudo = [cabecalho, ...linhas]
      .map((linha) => linha.map((campo) => `"${campo.replace(/"/g, '""')}"`).join(';'))
      .join('\n');

    const blob = new Blob(['\uFEFF' + conteudo], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `historico-${aba}_${dataInicio || 'todos'}_${dataFim || 'periodo'}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const rotuloPeriodo = dataInicio && dataFim
    ? `${formatarDia(dataInicio)} - ${formatarDia(dataFim)}`
    : 'Selecionar período';

  const painelAberto = pedidoSelecionado !== null || sessaoSelecionada !== null;
  const colunas = aba === 'pedidos' ? 10 : 8;

  return (
    <RestaurantLayout>
      <div className="hist">

        {/* ── Cabeçalho ── */}
        <div className="hist__header">
          <div>
            <h2 className="hist__titulo">Histórico</h2>
            <p className="hist__subtitulo">Consulte o histórico de pedidos e de mesas do restaurante.</p>
          </div>

          <div className="hist__header-acoes">
            <div className="hist__periodo">
              <button className="hist__periodo-btn" onClick={() => setPeriodoAberto((aberto) => !aberto)}>
                <FiCalendar /> {rotuloPeriodo}
              </button>
              {periodoAberto && (
                <div className="hist__periodo-painel">
                  <label>
                    De
                    <input type="date" value={dataInicio} onChange={(e) => setDataInicio(e.target.value)} />
                  </label>
                  <label>
                    Até
                    <input type="date" value={dataFim} onChange={(e) => setDataFim(e.target.value)} />
                  </label>
                  <button className="hist__periodo-fechar" onClick={() => setPeriodoAberto(false)}>Aplicar</button>
                </div>
              )}
            </div>

            <button className="hist__btn-exportar" onClick={exportarCsv} disabled={totalRegistros === 0}>
              <FiDownload /> Exportar
            </button>
          </div>
        </div>

        {/* ── Abas: pedidos / mesas ── */}
        <div className="hist__abas" role="tablist">
          <button
            role="tab"
            aria-selected={aba === 'pedidos'}
            className={`hist__aba${aba === 'pedidos' ? ' hist__aba--ativa' : ''}`}
            onClick={() => trocarAba('pedidos')}
          >
            Pedidos ({pedidosFiltrados.length})
          </button>
          <button
            role="tab"
            aria-selected={aba === 'mesas'}
            className={`hist__aba${aba === 'mesas' ? ' hist__aba--ativa' : ''}`}
            onClick={() => trocarAba('mesas')}
          >
            Mesas ({sessoesFiltradas.length})
          </button>
        </div>

        {/* ── Painel de filtros ── */}
        <div className="hist__filtros">
          <div className="hist__select">
            <HiOutlineTable className="hist__select-icone" />
            <select value={mesaFiltro} onChange={(e) => setMesaFiltro(e.target.value)}>
              <option value="todas">Todas as mesas</option>
              {locaisDisponiveis.map((local) => (
                <option key={local} value={local}>{local}</option>
              ))}
            </select>
          </div>

          <div className="hist__select">
            <select value={situacaoFiltro} onChange={(e) => setSituacaoFiltro(e.target.value as 'todos' | Situacao)}>
              <option value="todos">Todas as situações</option>
              <option value="concluido">Concluído</option>
              <option value="andamento">Em andamento</option>
              <option value="cancelado">Cancelado</option>
            </select>
          </div>

          <div className="hist__select">
            <FiCreditCard className="hist__select-icone" />
            <select value={pagamentoFiltro} onChange={(e) => setPagamentoFiltro(e.target.value as 'todas' | Forma)}>
              <option value="todas">Forma de pagamento</option>
              <option value="Pix">Pix</option>
              <option value="Cartão">Cartão</option>
              <option value="Dinheiro">Dinheiro</option>
              <option value="Sem pagamento">Sem pagamento</option>
            </select>
          </div>

          <div className="hist__busca">
            <FiSearch />
            <input
              type="text"
              placeholder="Buscar por pedido, cliente, mesa ou garçom..."
              maxLength={100}
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
            />
          </div>

          <button className="hist__btn-limpar" onClick={limparFiltros} disabled={!filtrosAtivos}>
            <FiX /> Limpar filtros
          </button>
        </div>

        {/* ── Conteúdo: tabela + painel de detalhes ── */}
        <div className={`hist__conteudo ${painelAberto ? 'hist__conteudo--com-painel' : ''}`}>

          <div className="hist__tabela-wrapper">
            <h3 className="hist__tabela-titulo">{aba === 'pedidos' ? 'Pedidos' : 'Histórico de mesas'}</h3>

            {erro && (
              <p className="hist__aviso hist__aviso--erro" role="alert">
                {erro} <button className="hist__aviso-btn" onClick={() => void carregar()}>Tentar novamente</button>
              </p>
            )}

            <div className="hist__tabela-scroll">
              {aba === 'pedidos' ? (
                <table className="hist__tabela">
                  <thead>
                    <tr>
                      <th>Data/Hora</th>
                      <th>Pedido</th>
                      <th>Local</th>
                      <th>Itens</th>
                      <th>Cliente</th>
                      <th>Garçom</th>
                      <th>Total</th>
                      <th>Pagamento</th>
                      <th>Situação</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {carregando && (
                      <tr><td colSpan={colunas} className="hist__vazio">Carregando histórico…</td></tr>
                    )}
                    {!carregando && pedidosDaPagina.length === 0 && (
                      <tr>
                        <td colSpan={colunas} className="hist__vazio">
                          {erro ? 'Não foi possível carregar os pedidos.' : 'Nenhum pedido encontrado para os filtros selecionados.'}
                        </td>
                      </tr>
                    )}
                    {!carregando && pedidosDaPagina.map((p) => {
                      const situacao = situacaoDoPedido(p.status);
                      const forma = formaDoPedido(p);
                      return (
                        <tr
                          key={p.id}
                          className={pedidoSelecionado?.id === p.id ? 'hist__linha--ativa' : ''}
                          onClick={() => abrirPedido(p)}
                        >
                          <td>{formatarDataHora(p.criado_em)}</td>
                          <td className="hist__id">#{p.numero_pedido}</td>
                          <td>
                            <div className="hist__mesa">{rotuloLocal(p)}</div>
                            <div className="hist__mesa-sub">{rotuloModalidade(p)}</div>
                          </td>
                          <td>{totalItens(p)} {totalItens(p) === 1 ? 'item' : 'itens'}</td>
                          <td>{p.cliente_nome || '-'}</td>
                          <td>{p.atendido_por?.nome ?? '-'}</td>
                          <td>{formatarMoeda(p.total)}</td>
                          <td>
                            <span className="hist__pagamento">{ICONE_PAGAMENTO[forma]} {forma}</span>
                          </td>
                          <td>
                            <span className={`hist__badge ${CLASSE_SITUACAO[situacao]}`}>{ROTULO_SITUACAO[situacao]}</span>
                          </td>
                          <td>
                            <button
                              className="hist__btn-abrir"
                              onClick={(e) => { e.stopPropagation(); abrirPedido(p); }}
                              aria-label={`Ver detalhes do pedido #${p.numero_pedido}`}
                            >
                              <FiChevronRight />
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              ) : (
                <table className="hist__tabela">
                  <thead>
                    <tr>
                      <th>Data</th>
                      <th>Mesa</th>
                      <th>Pedidos</th>
                      <th>Itens</th>
                      <th>Clientes</th>
                      <th>Total</th>
                      <th>Situação</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {carregando && (
                      <tr><td colSpan={colunas} className="hist__vazio">Carregando histórico…</td></tr>
                    )}
                    {!carregando && sessoesDaPagina.length === 0 && (
                      <tr>
                        <td colSpan={colunas} className="hist__vazio">
                          {erro ? 'Não foi possível carregar as mesas.' : 'Nenhuma mesa encontrada para os filtros selecionados.'}
                        </td>
                      </tr>
                    )}
                    {!carregando && sessoesDaPagina.map((s) => (
                      <tr
                        key={s.chave}
                        className={sessaoSelecionada?.chave === s.chave ? 'hist__linha--ativa' : ''}
                        onClick={() => abrirSessao(s)}
                      >
                        <td>{formatarDia(s.dia)}</td>
                        <td className="hist__id">{s.mesa}</td>
                        <td>{s.pedidos.length} {s.pedidos.length === 1 ? 'pedido' : 'pedidos'}</td>
                        <td>{s.itens} {s.itens === 1 ? 'item' : 'itens'}</td>
                        <td>{s.clientes.join(', ') || '-'}</td>
                        <td>{formatarMoeda(s.total)}</td>
                        <td>
                          <span className={`hist__badge ${CLASSE_SITUACAO[s.situacao]}`}>{ROTULO_SITUACAO[s.situacao]}</span>
                        </td>
                        <td>
                          <button
                            className="hist__btn-abrir"
                            onClick={(e) => { e.stopPropagation(); abrirSessao(s); }}
                            aria-label={`Ver detalhes da ${s.mesa} em ${formatarDia(s.dia)}`}
                          >
                            <FiChevronRight />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}

              {/* ── Paginação ── */}
              <div className="hist__paginacao">
                <span className="hist__paginacao-info">
                  Mostrando {totalRegistros === 0 ? 0 : indiceInicio + 1} a{' '}
                  {Math.min(indiceInicio + ITENS_POR_PAGINA, totalRegistros)} de {totalRegistros}{' '}
                  {aba === 'pedidos' ? 'pedidos' : 'mesas'}
                </span>
                <div className="hist__paginacao-botoes">
                  <button onClick={() => setPaginaAtual((p) => Math.max(1, p - 1))} disabled={paginaAtual === 1}>‹</button>
                  {Array.from({ length: totalPaginas }, (_, i) => i + 1).map((num) => (
                    <button
                      key={num}
                      className={paginaAtual === num ? 'hist__pagina--ativa' : ''}
                      onClick={() => setPaginaAtual(num)}
                    >
                      {num}
                    </button>
                  ))}
                  <button onClick={() => setPaginaAtual((p) => Math.min(totalPaginas, p + 1))} disabled={paginaAtual === totalPaginas}>›</button>
                </div>
              </div>
            </div>
          </div>

          {/* ── Painel lateral: detalhes do pedido ── */}
          {pedidoSelecionado && (
            <>
              <div className="hist__painel-overlay" onClick={fecharDetalhes} />
              <aside className="hist__painel">
                <div className="hist__painel-header">
                  <h3>Detalhes do pedido #{pedidoSelecionado.numero_pedido}</h3>
                  <button className="hist__painel-fechar" onClick={fecharDetalhes} aria-label="Fechar detalhes">
                    <FiX />
                  </button>
                </div>

                <div className="hist__painel-info">
                  <span><FiUsers /> {rotuloLocal(pedidoSelecionado)}{pedidoSelecionado.cliente_nome ? ` · ${pedidoSelecionado.cliente_nome}` : ''}</span>
                  <span><FiCalendar /> {formatarDataHora(pedidoSelecionado.criado_em)}</span>
                </div>

                <div className="hist__painel-secao">
                  <h4>Situação</h4>
                  <span className={`hist__badge ${CLASSE_SITUACAO[situacaoDoPedido(pedidoSelecionado.status)]}`}>
                    {ROTULO_SITUACAO[situacaoDoPedido(pedidoSelecionado.status)]}
                  </span>
                  {pedidoSelecionado.status === 'CANCELADO' && (
                    <p className="hist__painel-observacoes-texto">
                      Motivo do cancelamento: {pedidoSelecionado.cancelamento_motivo || 'não informado'}
                    </p>
                  )}
                </div>

                <div className="hist__painel-secao">
                  <h4>Itens do pedido ({pedidoSelecionado.itens.length})</h4>
                  <ul className="hist__painel-itens">
                    {pedidoSelecionado.itens.map((item) => {
                      const adicionais = (item.itens_adicionais ?? [])
                        .map((a) => a.nome_adicional)
                        .filter((n): n is string => !!n);
                      return (
                        <li key={item.id}>
                          <span>
                            {item.quantidade}x {item.produto?.nome ?? 'Item'}
                            {adicionais.length > 0 && <small> (+ {adicionais.join(', ')})</small>}
                          </span>
                          <span>{formatarMoeda(item.preco_total)}</span>
                        </li>
                      );
                    })}
                  </ul>
                </div>

                {pedidoSelecionado.observacoes && (
                  <button className="hist__painel-observacoes-btn" onClick={() => setMostrarObservacoes((v) => !v)}>
                    {mostrarObservacoes ? 'Ocultar observações' : 'Ver observações'}
                  </button>
                )}
                {mostrarObservacoes && pedidoSelecionado.observacoes && (
                  <p className="hist__painel-observacoes-texto">{pedidoSelecionado.observacoes}</p>
                )}

                <div className="hist__painel-secao">
                  <h4>Resumo</h4>
                  <div className="hist__painel-linha">
                    <span>Subtotal</span>
                    <span>{formatarMoeda(pedidoSelecionado.subtotal)}</span>
                  </div>
                  {(pedidoSelecionado.taxa_entrega ?? 0) > 0 && (
                    <div className="hist__painel-linha">
                      <span>Taxa de entrega</span>
                      <span>{formatarMoeda(pedidoSelecionado.taxa_entrega ?? 0)}</span>
                    </div>
                  )}
                  {(pedidoSelecionado.desconto ?? 0) > 0 && (
                    <div className="hist__painel-linha hist__painel-linha--desconto">
                      <span>Desconto</span>
                      <span>- {formatarMoeda(pedidoSelecionado.desconto ?? 0)}</span>
                    </div>
                  )}
                  <div className="hist__painel-linha hist__painel-linha--total">
                    <span>Total</span>
                    <span>{formatarMoeda(pedidoSelecionado.total)}</span>
                  </div>
                </div>

                <div className="hist__painel-secao">
                  <h4>Pagamento</h4>
                  <div className="hist__painel-linha">
                    <span className="hist__pagamento">
                      {ICONE_PAGAMENTO[formaDoPedido(pedidoSelecionado)]} {formaDoPedido(pedidoSelecionado)}
                    </span>
                    <span>
                      {pedidoSelecionado.pagamento
                        ? STATUS_PAGAMENTO[pedidoSelecionado.pagamento.status] ?? pedidoSelecionado.pagamento.status
                        : 'Não registrado'}
                    </span>
                  </div>
                </div>

                <div className="hist__painel-secao hist__painel-secao--garcom">
                  <h4>Garçom</h4>
                  <span>{pedidoSelecionado.atendido_por?.nome ?? '-'}</span>
                </div>
              </aside>
            </>
          )}

          {/* ── Painel lateral: detalhes da mesa (passagem) ── */}
          {sessaoSelecionada && (
            <>
              <div className="hist__painel-overlay" onClick={fecharDetalhes} />
              <aside className="hist__painel">
                <div className="hist__painel-header">
                  <h3>{sessaoSelecionada.mesa} · {formatarDia(sessaoSelecionada.dia)}</h3>
                  <button className="hist__painel-fechar" onClick={fecharDetalhes} aria-label="Fechar detalhes">
                    <FiX />
                  </button>
                </div>

                <div className="hist__painel-info">
                  <span><FiUsers /> {sessaoSelecionada.clientes.join(', ') || 'Sem cliente informado'}</span>
                  <span><FiCalendar /> Primeiro pedido às {formatarHora(sessaoSelecionada.dataHora)}</span>
                </div>

                {sessaoSelecionada.pedidos.map((p) => {
                  const situacao = situacaoDoPedido(p.status);
                  return (
                    <div className="hist__painel-secao" key={p.id}>
                      <h4>
                        Pedido #{p.numero_pedido} · {formatarHora(p.criado_em)}{' '}
                        <span className={`hist__badge ${CLASSE_SITUACAO[situacao]}`}>{ROTULO_SITUACAO[situacao]}</span>
                      </h4>
                      <ul className="hist__painel-itens">
                        {p.itens.map((item) => (
                          <li key={item.id}>
                            <span>{item.quantidade}x {item.produto?.nome ?? 'Item'}</span>
                            <span>{formatarMoeda(item.preco_total)}</span>
                          </li>
                        ))}
                      </ul>
                      {p.status === 'CANCELADO' && (
                        <p className="hist__painel-observacoes-texto">
                          Motivo do cancelamento: {p.cancelamento_motivo || 'não informado'}
                        </p>
                      )}
                      <div className="hist__painel-linha">
                        <span>Total do pedido</span>
                        <span>{formatarMoeda(p.total)}</span>
                      </div>
                    </div>
                  );
                })}

                <div className="hist__painel-secao">
                  <div className="hist__painel-linha hist__painel-linha--total">
                    <span>Total consumido</span>
                    <span>{formatarMoeda(sessaoSelecionada.total)}</span>
                  </div>
                  <p className="hist__painel-observacoes-texto">Pedidos cancelados não entram no total.</p>
                </div>
              </aside>
            </>
          )}
        </div>
      </div>
    </RestaurantLayout>
  );
};

export default RestHistorico;