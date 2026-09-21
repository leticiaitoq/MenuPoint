import React, { useEffect, useMemo, useState } from 'react';
import { FiSearch, FiDownload, FiX, FiChevronRight, FiCreditCard, FiUsers, FiCalendar } from 'react-icons/fi';
import { HiOutlineTable, HiOutlineCash } from 'react-icons/hi';
import { MdPix } from 'react-icons/md';
import RestaurantLayout from '../../../shared/components/layout/Restaurantelayout';
import './RestHistorico.css';

// ── Tipos ──────────────────────────────────────────────
interface ItemPedido {
  nome: string;
  quantidade: number;
  precoUnitario: number;
}

type FormaPagamento = 'Pix' | 'Débito' | 'Crédito' | 'Dinheiro';
type StatusPagamento = 'Pago' | 'Estornado' | 'Pendente';

interface Pedido {
  id: number;
  dataHora: string; // dd/MM/yyyy HH:mm
  mesa: string;
  pessoas: number;
  itens: ItemPedido[];
  cliente: string | null;
  garcom: string;
  taxaServicoPercentual: number;
  desconto?: { codigo: string; valor: number };
  formaPagamento: FormaPagamento;
  status: StatusPagamento;
  observacoes?: string;
}

// ── Mock (substituir por chamada à API futuramente) ──────
const PEDIDOS_MOCK: Pedido[] = [
  {
    id: 1257, dataHora: '21/06/2025 15:43', mesa: 'Mesa 02', pessoas: 4,
    itens: [
      { nome: 'Picanha na Chapa', quantidade: 1, precoUnitario: 89.9 },
      { nome: 'Refrigerante Lata', quantidade: 2, precoUnitario: 11.0 },
      { nome: 'Batata Frita', quantidade: 1, precoUnitario: 19.9 },
      { nome: 'Água com Gás', quantidade: 1, precoUnitario: 8.0 },
      { nome: 'Brownie com Sorvete', quantidade: 1, precoUnitario: 21.9 },
      { nome: 'Suco de Laranja', quantidade: 1, precoUnitario: 12.0 },
      { nome: 'Café Expresso', quantidade: 1, precoUnitario: 4.9 },
    ],
    cliente: null, garcom: 'João', taxaServicoPercentual: 10,
    desconto: { codigo: 'CUPOM10', valor: 15.0 },
    formaPagamento: 'Pix', status: 'Pago',
    observacoes: 'Sem cebola na picanha. Uma das refrigerantes sem gelo.',
  },
  {
    id: 1256, dataHora: '21/06/2025 15:20', mesa: 'Mesa 01', pessoas: 2,
    itens: [
      { nome: 'Filé à Parmegiana', quantidade: 1, precoUnitario: 52.9 },
      { nome: 'Refrigerante Lata', quantidade: 1, precoUnitario: 11.0 },
      { nome: 'Pudim', quantidade: 1, precoUnitario: 14.9 },
    ],
    cliente: null, garcom: 'João', taxaServicoPercentual: 10,
    formaPagamento: 'Débito', status: 'Pago',
  },
  {
    id: 1255, dataHora: '21/06/2025 14:58', mesa: 'Mesa 03', pessoas: 3,
    itens: [
      { nome: 'Frango à Parmegiana', quantidade: 1, precoUnitario: 48.9 },
      { nome: 'Risoto de Camarão', quantidade: 1, precoUnitario: 62.9 },
      { nome: 'Suco de Laranja', quantidade: 2, precoUnitario: 12.0 },
    ],
    cliente: null, garcom: 'Maria', taxaServicoPercentual: 10,
    formaPagamento: 'Crédito', status: 'Pago',
  },
  {
    id: 1254, dataHora: '21/06/2025 14:35', mesa: 'Mesa 05', pessoas: 2,
    itens: [
      { nome: 'Porção de Pastel', quantidade: 1, precoUnitario: 25.9 },
    ],
    cliente: null, garcom: 'João', taxaServicoPercentual: 0,
    formaPagamento: 'Pix', status: 'Pago',
  },
  {
    id: 1253, dataHora: '21/06/2025 14:10', mesa: 'Mesa 02', pessoas: 4,
    itens: [
      { nome: 'Hambúrguer Artesanal', quantidade: 2, precoUnitario: 28.9 },
      { nome: 'Refrigerante Lata', quantidade: 2, precoUnitario: 6.0 },
    ],
    cliente: null, garcom: 'João', taxaServicoPercentual: 0,
    formaPagamento: 'Dinheiro', status: 'Estornado',
    observacoes: 'Cliente devolveu um dos hambúrgueres por engano no pedido.',
  },
  {
    id: 1252, dataHora: '21/06/2025 13:45', mesa: 'Mesa 07', pessoas: 2,
    itens: [
      { nome: 'Salada Caesar', quantidade: 1, precoUnitario: 32.9 },
      { nome: 'Água com Gás', quantidade: 1, precoUnitario: 8.0 },
    ],
    cliente: null, garcom: 'Pedro', taxaServicoPercentual: 10,
    formaPagamento: 'Crédito', status: 'Pago',
  },
  {
    id: 1251, dataHora: '21/06/2025 13:20', mesa: 'Mesa 04', pessoas: 6,
    itens: [
      { nome: 'Picanha na Chapa', quantidade: 2, precoUnitario: 89.9 },
      { nome: 'Batata Frita', quantidade: 2, precoUnitario: 19.9 },
      { nome: 'Refrigerante 1L', quantidade: 1, precoUnitario: 16.0 },
    ],
    cliente: null, garcom: 'Maria', taxaServicoPercentual: 10,
    formaPagamento: 'Débito', status: 'Pago',
  },
  {
    id: 1250, dataHora: '21/06/2025 12:55', mesa: 'Mesa 01', pessoas: 2,
    itens: [
      { nome: 'Prato Executivo', quantidade: 2, precoUnitario: 32.9 },
      { nome: 'Suco de Laranja', quantidade: 2, precoUnitario: 12.0 },
    ],
    cliente: null, garcom: 'Pedro', taxaServicoPercentual: 0,
    formaPagamento: 'Pix', status: 'Pago',
  },
  {
    id: 1249, dataHora: '20/06/2025 22:15', mesa: 'Mesa 03', pessoas: 3,
    itens: [
      { nome: 'Pizza Grande', quantidade: 1, precoUnitario: 68.0 },
      { nome: 'Refrigerante 2L', quantidade: 1, precoUnitario: 18.0 },
      { nome: 'Sorvete', quantidade: 2, precoUnitario: 12.9 },
    ],
    cliente: null, garcom: 'João', taxaServicoPercentual: 10,
    formaPagamento: 'Crédito', status: 'Pago',
  },
  {
    id: 1248, dataHora: '20/06/2025 21:47', mesa: 'Mesa 06', pessoas: 2,
    itens: [
      { nome: 'Moqueca de Peixe', quantidade: 1, precoUnitario: 54.9 },
    ],
    cliente: null, garcom: 'Maria', taxaServicoPercentual: 0,
    formaPagamento: 'Dinheiro', status: 'Pago',
  },
  {
    id: 1247, dataHora: '20/06/2025 20:30', mesa: 'Delivery', pessoas: 1,
    itens: [
      { nome: 'Marmita Fitness', quantidade: 1, precoUnitario: 29.9 },
      { nome: 'Suco Natural', quantidade: 1, precoUnitario: 9.9 },
    ],
    cliente: 'Carla Menezes', garcom: 'Pedro', taxaServicoPercentual: 0,
    formaPagamento: 'Pix', status: 'Pendente',
  },
  {
    id: 1246, dataHora: '20/06/2025 19:10', mesa: 'Delivery', pessoas: 1,
    itens: [
      { nome: 'Combo Burger Duplo', quantidade: 1, precoUnitario: 42.9 },
    ],
    cliente: 'Rafael Torres', garcom: 'João', taxaServicoPercentual: 0,
    formaPagamento: 'Crédito', status: 'Pago',
  },
];

const ITENS_POR_PAGINA = 10;

// ── Helpers ────────────────────────────────────────────
const formatarMoeda = (valor: number) =>
  valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

const parseDataBR = (dataHora: string): Date => {
  const [dataParte, horaParte] = dataHora.split(' ');
  const [dia, mes, ano] = dataParte.split('/').map(Number);
  const [hora, minuto] = (horaParte ?? '00:00').split(':').map(Number);
  return new Date(ano, mes - 1, dia, hora, minuto);
};

const totalItens = (pedido: Pedido) =>
  pedido.itens.reduce((soma, item) => soma + item.quantidade, 0);

const subtotalPedido = (pedido: Pedido) =>
  pedido.itens.reduce((soma, item) => soma + item.quantidade * item.precoUnitario, 0);

const taxaServicoPedido = (pedido: Pedido) =>
  subtotalPedido(pedido) * (pedido.taxaServicoPercentual / 100);

const totalPedido = (pedido: Pedido) =>
  subtotalPedido(pedido) + taxaServicoPedido(pedido) - (pedido.desconto?.valor ?? 0);

const ICONE_PAGAMENTO: Record<FormaPagamento, React.ReactNode> = {
  Pix: <MdPix />,
  Débito: <FiCreditCard />,
  Crédito: <FiCreditCard />,
  Dinheiro: <HiOutlineCash />,
};

const CLASSE_STATUS: Record<StatusPagamento, string> = {
  Pago: 'hist__badge--verde',
  Estornado: 'hist__badge--vermelho',
  Pendente: 'hist__badge--amarelo',
};

const RestHistorico: React.FC = () => {

  // Filtros
  const [dataInicio, setDataInicio] = useState('');
  const [dataFim, setDataFim] = useState('');
  const [mesaFiltro, setMesaFiltro] = useState('todas');
  const [statusFiltro, setStatusFiltro] = useState('todos');
  const [pagamentoFiltro, setPagamentoFiltro] = useState('todas');
  const [busca, setBusca] = useState('');
  const [periodoAberto, setPeriodoAberto] = useState(false);

  // Paginação
  const [paginaAtual, setPaginaAtual] = useState(1);

  // Painel de detalhes
  const [pedidoSelecionado, setPedidoSelecionado] = useState<Pedido | null>(null);
  const [mostrarObservacoes, setMostrarObservacoes] = useState(false);

  const mesasDisponiveis = useMemo(
    () => Array.from(new Set(PEDIDOS_MOCK.map((p) => p.mesa))).sort(),
    []
  );

  const filtrosAtivos =
    !!dataInicio || !!dataFim || mesaFiltro !== 'todas' ||
    statusFiltro !== 'todos' || pagamentoFiltro !== 'todas' || !!busca;

  // ── Aplica os filtros (client-side, sobre o mock) ──
  const pedidosFiltrados = useMemo(() => {
    return PEDIDOS_MOCK.filter((pedido) => {
      const dataPedido = parseDataBR(pedido.dataHora);

      if (dataInicio && dataPedido < new Date(`${dataInicio}T00:00:00`)) return false;
      if (dataFim && dataPedido > new Date(`${dataFim}T23:59:59`)) return false;
      if (mesaFiltro !== 'todas' && pedido.mesa !== mesaFiltro) return false;
      if (statusFiltro !== 'todos' && pedido.status !== statusFiltro) return false;
      if (pagamentoFiltro !== 'todas' && pedido.formaPagamento !== pagamentoFiltro) return false;

      if (busca) {
        const termo = busca.trim().toLowerCase();
        const noPedido = String(pedido.id).includes(termo);
        const noCliente = (pedido.cliente ?? '').toLowerCase().includes(termo);
        const noGarcom = pedido.garcom.toLowerCase().includes(termo);
        if (!noPedido && !noCliente && !noGarcom) return false;
      }

      return true;
    }).sort((a, b) => parseDataBR(b.dataHora).getTime() - parseDataBR(a.dataHora).getTime());
  }, [dataInicio, dataFim, mesaFiltro, statusFiltro, pagamentoFiltro, busca]);

  // Sempre que os filtros mudam, volta para a primeira página
  useEffect(() => {
    setPaginaAtual(1);
  }, [dataInicio, dataFim, mesaFiltro, statusFiltro, pagamentoFiltro, busca]);

  const totalPaginas = Math.max(1, Math.ceil(pedidosFiltrados.length / ITENS_POR_PAGINA));
  const indiceInicio = (paginaAtual - 1) * ITENS_POR_PAGINA;
  const pedidosDaPagina = pedidosFiltrados.slice(indiceInicio, indiceInicio + ITENS_POR_PAGINA);

  const limparFiltros = () => {
    setDataInicio('');
    setDataFim('');
    setMesaFiltro('todas');
    setStatusFiltro('todos');
    setPagamentoFiltro('todas');
    setBusca('');
  };

  const abrirDetalhes = (pedido: Pedido) => {
    setPedidoSelecionado(pedido);
    setMostrarObservacoes(false);
  };

  const fecharDetalhes = () => {
    setPedidoSelecionado(null);
    setMostrarObservacoes(false);
  };

  // ── Exporta os pedidos filtrados em CSV ──
  const exportarCsv = () => {
    const cabecalho = ['Pedido', 'Data/Hora', 'Mesa', 'Itens', 'Cliente', 'Garçom', 'Total', 'Pagamento', 'Status'];
    const linhas = pedidosFiltrados.map((p) => [
      `#${p.id}`,
      p.dataHora,
      p.mesa,
      String(totalItens(p)),
      p.cliente ?? '-',
      p.garcom,
      formatarMoeda(totalPedido(p)),
      p.formaPagamento,
      p.status,
    ]);

    const conteudo = [cabecalho, ...linhas]
      .map((linha) => linha.map((campo) => `"${campo.replace(/"/g, '""')}"`).join(';'))
      .join('\n');

    const blob = new Blob(['\uFEFF' + conteudo], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `historico-pedidos_${dataInicio || 'todos'}_${dataFim || 'periodo'}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const rotuloPeriodo = dataInicio && dataFim
    ? `${dataInicio.split('-').reverse().join('/')} - ${dataFim.split('-').reverse().join('/')}`
    : 'Selecionar período';

  return (
    <RestaurantLayout>
      <div className="hist">

        {/* ── Cabeçalho ── */}
        <div className="hist__header">
          <div>
            <h2 className="hist__titulo">Histórico de pedidos</h2>
            <p className="hist__subtitulo">Consulte e acompanhe todos os pedidos pagos.</p>
          </div>

          <div className="hist__header-acoes">
            <div className="hist__periodo">
              <button
                className="hist__periodo-btn"
                onClick={() => setPeriodoAberto((aberto) => !aberto)}
              >
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

            <button className="hist__btn-exportar" onClick={exportarCsv}>
              <FiDownload /> Exportar
            </button>
          </div>
        </div>

        {/* ── Painel de filtros ── */}
        <div className="hist__filtros">
          <div className="hist__select">
            <HiOutlineTable className="hist__select-icone" />
            <select value={mesaFiltro} onChange={(e) => setMesaFiltro(e.target.value)}>
              <option value="todas">Todas as mesas</option>
              {mesasDisponiveis.map((mesa) => (
                <option key={mesa} value={mesa}>{mesa}</option>
              ))}
            </select>
          </div>

          <div className="hist__select">
            <select value={statusFiltro} onChange={(e) => setStatusFiltro(e.target.value)}>
              <option value="todos">Todos os status</option>
              <option value="Pago">Pago</option>
              <option value="Pendente">Pendente</option>
              <option value="Estornado">Estornado</option>
            </select>
          </div>

          <div className="hist__select">
            <FiCreditCard className="hist__select-icone" />
            <select value={pagamentoFiltro} onChange={(e) => setPagamentoFiltro(e.target.value)}>
              <option value="todas">Forma de pagamento</option>
              <option value="Pix">Pix</option>
              <option value="Débito">Débito</option>
              <option value="Crédito">Crédito</option>
              <option value="Dinheiro">Dinheiro</option>
            </select>
          </div>

          <div className="hist__busca">
            <FiSearch />
            <input
              type="text"
              placeholder="Buscar por pedido, cliente ou garçom..."
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
            />
          </div>

          <button className="hist__btn-limpar" onClick={limparFiltros} disabled={!filtrosAtivos}>
            <FiX /> Limpar filtros
          </button>
        </div>

        {/* ── Conteúdo: tabela + painel de detalhes ── */}
        <div className={`hist__conteudo ${pedidoSelecionado ? 'hist__conteudo--com-painel' : ''}`}>

          <div className="hist__tabela-wrapper">
            <h3 className="hist__tabela-titulo">Pedidos pagos</h3>

            <div className="hist__tabela-scroll">
              <table className="hist__tabela">
                <thead>
                  <tr>
                    <th>Data/Hora</th>
                    <th>Pedido</th>
                    <th>Mesa</th>
                    <th>Itens</th>
                    <th>Cliente</th>
                    <th>Garçom</th>
                    <th>Total</th>
                    <th>Pagamento</th>
                    <th>Status</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {pedidosDaPagina.length === 0 && (
                    <tr>
                      <td colSpan={10} className="hist__vazio">Nenhum pedido encontrado para os filtros selecionados.</td>
                    </tr>
                  )}
                  {pedidosDaPagina.map((pedido) => (
                    <tr
                      key={pedido.id}
                      className={pedidoSelecionado?.id === pedido.id ? 'hist__linha--ativa' : ''}
                      onClick={() => abrirDetalhes(pedido)}
                    >
                      <td>{pedido.dataHora}</td>
                      <td className="hist__id">#{pedido.id}</td>
                      <td>
                        <div className="hist__mesa">{pedido.mesa}</div>
                        <div className="hist__mesa-sub">{pedido.pessoas} pessoas</div>
                      </td>
                      <td>{totalItens(pedido)} {totalItens(pedido) === 1 ? 'item' : 'itens'}</td>
                      <td>{pedido.cliente ?? '-'}</td>
                      <td>{pedido.garcom}</td>
                      <td>{formatarMoeda(totalPedido(pedido))}</td>
                      <td>
                        <span className="hist__pagamento">
                          {ICONE_PAGAMENTO[pedido.formaPagamento]} {pedido.formaPagamento}
                        </span>
                      </td>
                      <td>
                        <span className={`hist__badge ${CLASSE_STATUS[pedido.status]}`}>
                          {pedido.status}
                        </span>
                      </td>
                      <td>
                        <button
                          className="hist__btn-abrir"
                          onClick={(e) => { e.stopPropagation(); abrirDetalhes(pedido); }}
                          aria-label={`Ver detalhes do pedido #${pedido.id}`}
                        >
                          <FiChevronRight />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {/* ── Paginação ── */}
              <div className="hist__paginacao">
                <span className="hist__paginacao-info">
                  Mostrando {pedidosFiltrados.length === 0 ? 0 : indiceInicio + 1} a{' '}
                  {Math.min(indiceInicio + ITENS_POR_PAGINA, pedidosFiltrados.length)} de {pedidosFiltrados.length} pedidos
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

          {/* ── Painel lateral de detalhes ── */}
          {pedidoSelecionado && (
            <>
              <div className="hist__painel-overlay" onClick={fecharDetalhes} />
              <aside className="hist__painel">
                <div className="hist__painel-header">
                  <h3>Detalhes do pedido #{pedidoSelecionado.id}</h3>
                  <button className="hist__painel-fechar" onClick={fecharDetalhes} aria-label="Fechar detalhes">
                    <FiX />
                  </button>
                </div>

                <div className="hist__painel-info">
                  <span><FiUsers /> {pedidoSelecionado.mesa} · {pedidoSelecionado.pessoas} pessoas</span>
                  <span><FiCalendar /> {pedidoSelecionado.dataHora}</span>
                </div>

                <div className="hist__painel-secao">
                  <h4>Itens do pedido ({pedidoSelecionado.itens.length})</h4>
                  <ul className="hist__painel-itens">
                    {pedidoSelecionado.itens.map((item, index) => (
                      <li key={index}>
                        <span>{item.quantidade}x {item.nome}</span>
                        <span>{formatarMoeda(item.quantidade * item.precoUnitario)}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                {pedidoSelecionado.observacoes && (
                  <button
                    className="hist__painel-observacoes-btn"
                    onClick={() => setMostrarObservacoes((v) => !v)}
                  >
                    {mostrarObservacoes ? 'Ocultar observações' : 'Ver observações'}
                  </button>
                )}
                {mostrarObservacoes && pedidoSelecionado.observacoes && (
                  <p className="hist__painel-observacoes-texto">{pedidoSelecionado.observacoes}</p>
                )}

                <div className="hist__painel-secao">
                  <h4>Resumo do pagamento</h4>
                  <div className="hist__painel-linha">
                    <span>Subtotal</span>
                    <span>{formatarMoeda(subtotalPedido(pedidoSelecionado))}</span>
                  </div>
                  {pedidoSelecionado.taxaServicoPercentual > 0 && (
                    <div className="hist__painel-linha">
                      <span>Taxa de serviço ({pedidoSelecionado.taxaServicoPercentual}%)</span>
                      <span>{formatarMoeda(taxaServicoPedido(pedidoSelecionado))}</span>
                    </div>
                  )}
                  {pedidoSelecionado.desconto && (
                    <div className="hist__painel-linha hist__painel-linha--desconto">
                      <span>Desconto ({pedidoSelecionado.desconto.codigo})</span>
                      <span>- {formatarMoeda(pedidoSelecionado.desconto.valor)}</span>
                    </div>
                  )}
                  <div className="hist__painel-linha hist__painel-linha--total">
                    <span>Total pago</span>
                    <span>{formatarMoeda(totalPedido(pedidoSelecionado))}</span>
                  </div>
                </div>

                <div className="hist__painel-secao">
                  <h4>Forma de pagamento</h4>
                  <div className="hist__painel-linha">
                    <span className="hist__pagamento">
                      {ICONE_PAGAMENTO[pedidoSelecionado.formaPagamento]} {pedidoSelecionado.formaPagamento}
                    </span>
                    <span>{formatarMoeda(totalPedido(pedidoSelecionado))}</span>
                  </div>
                </div>

                <div className="hist__painel-secao hist__painel-secao--garcom">
                  <h4>Garçom</h4>
                  <span>{pedidoSelecionado.garcom}</span>
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