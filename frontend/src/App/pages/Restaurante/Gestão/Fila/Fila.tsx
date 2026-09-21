import React, { useState } from 'react';
import {HiCheck,HiSearch,HiX,HiClock,HiRefresh,} from 'react-icons/hi';
import { MdTableRestaurant, MdDeliveryDining } from 'react-icons/md';
import { FiChevronRight } from 'react-icons/fi';
import RestaurantLayout from '../../../../shared/components/layout/Restaurantelayout';
import './Fila.css';

// ── Tipos 
type StatusPedido = 'recebido' | 'preparando' | 'pronto' | 'entregue';

interface ItemPedido {
  nome: string;
  preco: number;
}

interface Pedido {
  id: string;
  numero: string;
  cliente: string;
  mesa: string;
  itens: ItemPedido[];
  total: number;
  tempoCriado: string; // ex: "5 min atrás"
  status: StatusPedido;
}

interface ConfiguracaoColuna {
  status: StatusPedido;
  rotulo: string;
  proximoStatus: StatusPedido | null;
  corClasse: string;
}

// ── Dados mockados
const PEDIDOS_MOCK: Pedido[] = [
  {
    id: '1', numero: '#010', cliente: 'Leticia P.', mesa: 'Mesa 12',
    itens: [{ nome: 'X-Burguer', preco: 25.00 }],
    total: 25.00, tempoCriado: '5 min atrás', status: 'recebido',
  },
  {
    id: '2', numero: '#009', cliente: 'Marcos A.', mesa: 'Mesa 5',
    itens: [{ nome: 'Batata Frita', preco: 15.00 }, { nome: 'Suco Natural', preco: 9.00 }],
    total: 24.00, tempoCriado: '8 min atrás', status: 'recebido',
  },
  {
    id: '3', numero: '#011', cliente: 'Carla M.', mesa: 'Mesa 9',
    itens: [{ nome: 'Macarrão ao Molho', preco: 24.99 }],
    total: 24.99, tempoCriado: '12 min atrás', status: 'recebido',
  },
  {
    id: '4', numero: '#007', cliente: 'Âna C.', mesa: 'Mesa 3',
    itens: [{ nome: 'Refrigerante Lata', preco: 6.00 }, { nome: 'Pizza Margherita', preco: 44.00 }],
    total: 50.00, tempoCriado: '15 min atrás', status: 'preparando',
  },
  {
    id: '5', numero: '#006', cliente: 'Jorge T.', mesa: 'Mesa 8',
    itens: [{ nome: 'X-Burguer', preco: 25.00 }, { nome: 'Batata Frita', preco: 15.00 }],
    total: 40.00, tempoCriado: '20 min atrás', status: 'preparando',
  },
  {
    id: '6', numero: '#005', cliente: 'Bruna S.', mesa: 'Mesa 1',
    itens: [{ nome: 'Suco Natural', preco: 9.00 }],
    total: 9.00, tempoCriado: '22 min atrás', status: 'preparando',
  },
  {
    id: '7', numero: '#008', cliente: 'Paulo R.', mesa: 'Mesa 4',
    itens: [{ nome: 'Macarrão ao Molho', preco: 24.99 }, { nome: 'Refrigerante Lata', preco: 6.00 }],
    total: 30.99, tempoCriado: '25 min atrás', status: 'preparando',
  },
  {
    id: '8', numero: '#003', cliente: 'Rafael S.', mesa: 'Mesa 7',
    itens: [{ nome: 'X-Burguer', preco: 50.00 }],
    total: 50.00, tempoCriado: '30 min atrás', status: 'pronto',
  },
  {
    id: '9', numero: '#002', cliente: 'Fernanda R.', mesa: 'Mesa 6',
    itens: [{ nome: 'X-Burguer', preco: 25.00 }, { nome: 'Coca Cola Lata', preco: 6.00 }],
    total: 31.00, tempoCriado: '40 min atrás', status: 'entregue',
  },
];

const COLUNAS: ConfiguracaoColuna[] = [
  { status: 'recebido',   rotulo: 'Recebido',   proximoStatus: 'preparando', corClasse: 'fila__coluna--recebido' },
  { status: 'preparando', rotulo: 'Preparando', proximoStatus: 'pronto',     corClasse: 'fila__coluna--preparando' },
  { status: 'pronto',     rotulo: 'Pronto',     proximoStatus: 'entregue',   corClasse: 'fila__coluna--pronto' },
  { status: 'entregue',   rotulo: 'Entregue',   proximoStatus: null,         corClasse: 'fila__coluna--entregue' },
];

// ── Componente principal
const Fila: React.FC = () => {
  const [pedidos, setPedidos]                   = useState<Pedido[]>(PEDIDOS_MOCK);
  const [colunaAtiva, setColunaAtiva]             = useState<StatusPedido | null>(null);
  const [pedidoSelecionado, setPedidoSelecionado] = useState<Pedido | null>(null);
  const [modalAberto, setModalAberto]             = useState(false);
  const [colunaDoModal, setColunaDoModal]         = useState<ConfiguracaoColuna | null>(null);

  // ── Helpers 
  const pedidosPorStatus = (status: StatusPedido): Pedido[] =>
    pedidos.filter((p) => p.status === status);

  const colunaEstaCarregada = (status: StatusPedido): boolean =>
    colunaAtiva === status;

  const formatarPreco = (valor: number): string =>
    `R$ ${valor.toFixed(2).replace('.', ',')}`;

  // ── Ações 
  const carregarColuna = (status: StatusPedido) => {
    setColunaAtiva(status);
    setPedidoSelecionado(null);
  };

  const selecionarPedido = (pedido: Pedido) => {
    setPedidoSelecionado((prev) => prev?.id === pedido.id ? null : pedido);
  };

  const abrirModal = (coluna: ConfiguracaoColuna) => {
    if (!pedidoSelecionado) return;
    setColunaDoModal(coluna);
    setModalAberto(true);
  };

  const fecharModal = () => {
    setModalAberto(false);
    setColunaDoModal(null);
  };

  const confirmarAvanco = () => {
    if (!pedidoSelecionado || !colunaDoModal?.proximoStatus) return;

    const novoStatus = colunaDoModal.proximoStatus;

    setPedidos((prev) =>
      prev.map((p) =>
        p.id === pedidoSelecionado.id ? { ...p, status: novoStatus } : p
      )
    );

    // Move a coluna ativa para o próximo status
    setColunaAtiva(novoStatus);
    setPedidoSelecionado(null);
    fecharModal();
  };

  // ── Render do card de pedido na lista inferior
  const renderLinhaPedido = (pedido: Pedido) => {
    const estaSelecionado = pedidoSelecionado?.id === pedido.id;

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
            <MdTableRestaurant /> {pedido.mesa}
          </span>
        </td>
        <td className="fila__td">
          {pedido.itens.map((item) => item.nome).join(', ')}
        </td>
        <td className="fila__td fila__td--preco">{formatarPreco(pedido.total)}</td>
        <td className="fila__td fila__td--tempo">
          <HiClock className="fila__icone-tempo" /> {pedido.tempoCriado}
        </td>
      </tr>
    );
  };

  // ── Render de coluna
  const renderColuna = (coluna: ConfiguracaoColuna) => {
    const listaDePedidos = pedidosPorStatus(coluna.status);
    const carregada      = colunaEstaCarregada(coluna.status);
    const pedidoNoCard   = carregada && pedidoSelecionado?.status === coluna.status
      ? pedidoSelecionado
      : null;
    const podeAvancar    = carregada && !!pedidoNoCard && coluna.proximoStatus !== null;

    return (
      <div key={coluna.status} className={`fila__coluna ${coluna.corClasse}`}>
        {/* Cabeçalho da coluna */}
        <div className="fila__coluna-header">
          <span className="fila__coluna-rotulo">{coluna.rotulo}</span>
          <span className="fila__coluna-contador">{listaDePedidos.length}</span>
        </div>

        {/* Área do card de pedido selecionado */}
        <div className="fila__card-pedido">
          {!carregada ? (
            // Estado inicial: botão buscar
            <button
              className="fila__btn-buscar"
              onClick={() => carregarColuna(coluna.status)}
            >
              <HiSearch /> Buscar pedidos
            </button>
          ) : pedidoNoCard ? (
            // Pedido selecionado em destaque
            <div className="fila__card-info">
              <p className="fila__card-numero">{pedidoNoCard.numero}</p>
              <p className="fila__card-cliente">
                <MdTableRestaurant /> {pedidoNoCard.mesa}
              </p>
              <p className="fila__card-cliente">👤 {pedidoNoCard.cliente}</p>
              <ul className="fila__card-itens">
                {pedidoNoCard.itens.map((item, i) => (
                  <li key={i}>{item.nome}</li>
                ))}
              </ul>
              <p className="fila__card-total">{formatarPreco(pedidoNoCard.total)}</p>
            </div>
          ) : (
            // Carregado mas sem pedido selecionado
            <p className="fila__card-instrucao">
              Selecione um pedido abaixo
            </p>
          )}

          {/* Botão de ação */}
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

  // ── Pedidos visíveis na tabela inferior (somente da coluna ativa) 
  const pedidosVisiveis = colunaAtiva ? pedidosPorStatus(colunaAtiva) : [];
  const totalAtivos     = pedidos.filter((p) => p.status !== 'entregue').length;

  return (
    <RestaurantLayout>
      <div className="fila">

        {/* ── Cabeçalho ── */}
        <div className="fila__header">
          <div>
            <h2 className="fila__titulo">Fila de Pedidos</h2>
            <p className="fila__subtitulo">Monitoramento em tempo real dos pedidos ativos</p>
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
          </div>
        </div>

        {/* ── Kanban ── */}
        <div className="fila__kanban">
          {COLUNAS.map(renderColuna)}
        </div>

        {/* ── Tabela de pedidos ── */}
        {colunaAtiva !== null && (
          <div className="fila__tabela-container">
            <div className="fila__tabela-header">
              <span className="fila__tabela-titulo">
                <HiRefresh /> Pedidos em andamento
              </span>
              <span className="fila__tabela-dica">
                Clique em um pedido para selecioná-lo e avançar o status
              </span>
            </div>

            {pedidosVisiveis.length === 0 ? (
              <p className="fila__tabela-vazia">Nenhum pedido encontrado nas filas carregadas.</p>
            ) : (
              <div className="fila__tabela-scroll">
                <table className="fila__tabela">
                  <thead>
                    <tr>
                      <th className="fila__th">Pedido</th>
                      <th className="fila__th">Cliente</th>
                      <th className="fila__th">Mesa</th>
                      <th className="fila__th">Itens</th>
                      <th className="fila__th">Total</th>
                      <th className="fila__th">Tempo</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pedidosVisiveis.map(renderLinhaPedido)}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* ── Instrução inicial ── */}
        {colunaAtiva === null && (
          <div className="fila__estado-inicial">
            <MdDeliveryDining className="fila__estado-icone" />
            <p>Clique em <strong>"Buscar pedidos"</strong> em qualquer coluna para carregar a fila.</p>
          </div>
        )}

      </div>

      {/* ── Modal de confirmação ── */}
      {modalAberto && pedidoSelecionado && colunaDoModal && (
        <div className="fila__modal-overlay" onClick={fecharModal}>
          <div className="fila__modal" onClick={(e) => e.stopPropagation()}>
            <button className="fila__modal-fechar" onClick={fecharModal}>
              <HiX />
            </button>

            <div className="fila__modal-icone">
              <FiChevronRight />
            </div>

            <h3 className="fila__modal-titulo">Avançar pedido?</h3>
            <p className="fila__modal-descricao">
              O pedido <strong>{pedidoSelecionado.numero}</strong> de{' '}
              <strong>{pedidoSelecionado.cliente}</strong> será movido de{' '}
              <strong>{colunaDoModal.rotulo}</strong> para{' '}
              <strong>
                {COLUNAS.find((c) => c.status === colunaDoModal.proximoStatus)?.rotulo}
              </strong>.
            </p>

            <div className="fila__modal-acoes">
              <button className="fila__modal-btn-cancelar" onClick={fecharModal}>
                Cancelar
              </button>
              <button className="fila__modal-btn-confirmar" onClick={confirmarAvanco}>
                <HiCheck /> Confirmar
              </button>
            </div>
          </div>
        </div>
      )}

    </RestaurantLayout>
  );
};

export default Fila;