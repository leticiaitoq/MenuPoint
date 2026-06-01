import React, { useState } from 'react';
import { HiSearch } from 'react-icons/hi';
import RestaurantLayout from '../../../shared/components/layout/Restaurantelayout';
import './RestHistorico.css';

// ── Tipos
interface Pedido {
  id: number;
  data: string;
  cliente: string;
  mesa: string;
  total: number;
  status: 'Concluído' | 'Cancelado' | 'Em andamento';
}

// ── Mock (substituir por chamada à API futuramente)
const PEDIDOS_MOCK: Pedido[] = [
  { id: 2150, data: '09/04/2024', cliente: 'Sara Mariano',    mesa: 'Mesa 5',   total: 120, status: 'Concluído'    },
  { id: 2148, data: '08/04/2024', cliente: 'Julia Rita',   mesa: 'Mesa 3',   total: 85,  status: 'Concluído'    },
  { id: 2145, data: '07/04/2024', cliente: 'Atalia Bianca', mesa: 'Delivery', total: 65,  status: 'Cancelado'    },
  { id: 2142, data: '06/04/2024', cliente: 'Mirela Hevelen',   mesa: 'Mesa 8',   total: 150, status: 'Concluído'    },
  { id: 2140, data: '05/04/2024', cliente: 'Heloisa Santos',   mesa: 'Mesa 2',   total: 90,  status: 'Concluído'    },
  { id: 2138, data: '04/04/2024', cliente: 'Fernanda Aguiar', mesa: 'Mesa 4',   total: 200, status: 'Concluído'    },
  { id: 2150, data: '03/04/2024', cliente: 'João Silva',    mesa: 'Mesa 5',   total: 120, status: 'Concluído'    },
  { id: 2148, data: '02/04/2024', cliente: 'Ana Pereira',   mesa: 'Mesa 3',   total: 85,  status: 'Concluído'    },
  { id: 2145, data: '01/04/2024', cliente: 'Carlos Mendes', mesa: 'Delivery', total: 65,  status: 'Cancelado'    },
  { id: 2142, data: '31/03/2024', cliente: 'Laura Costa',   mesa: 'Mesa 8',   total: 150, status: 'Concluído'    },
  { id: 2140, data: '29/03/2024', cliente: 'Pedro Souza',   mesa: 'Mesa 2',   total: 90,  status: 'Concluído'    },
  { id: 2138, data: '28/03/2024', cliente: 'Rosa Lima', mesa: 'Mesa 4',   total: 200, status: 'Concluído'    },
];

const ITENS_POR_PAGINA = 6;

const RestHistorico: React.FC = () => {

  // Filtros
  const [dataInicio, setDataInicio]     = useState('');
  const [dataFim, setDataFim]           = useState('');
  const [cliente, setCliente]           = useState('');
  const [valorMin, setValorMin]         = useState('');
  const [valorMax, setValorMax]         = useState('');

  // Dados
  const [pedidosFiltrados, setPedidosFiltrados] = useState<Pedido[]>(PEDIDOS_MOCK);

  // Paginação
  const [paginaAtual, setPaginaAtual] = useState(1);

  // Modal
  const [pedidoSelecionado, setPedidoSelecionado] = useState<Pedido | null>(null);

  // ── Aplica os filtros sobre o mock
  const handleBuscar = () => {
    const resultado = PEDIDOS_MOCK.filter((pedido) => {
      const dentroDoCliente = cliente
        ? pedido.cliente.toLowerCase().includes(cliente.toLowerCase())
        : true;

      const dentroDoValorMin = valorMin
        ? pedido.total >= Number(valorMin)
        : true;

      const dentroDoValorMax = valorMax
        ? pedido.total <= Number(valorMax)
        : true;

      return dentroDoCliente && dentroDoValorMin && dentroDoValorMax;
    });

    setPedidosFiltrados(resultado);
    setPaginaAtual(1);
  };

  // ── Paginação: fatia os pedidos da página atual
  const totalPaginas = Math.ceil(pedidosFiltrados.length / ITENS_POR_PAGINA);
  const indiceInicio = (paginaAtual - 1) * ITENS_POR_PAGINA;
  const pedidosDaPagina = pedidosFiltrados.slice(indiceInicio, indiceInicio + ITENS_POR_PAGINA);

  // ── Formata o total em reais
  const formatarMoeda = (valor: number) =>
    valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  return (
    <RestaurantLayout>
      <div className="hist">

        <h2 className="hist__titulo">Histórico de Pedidos</h2>

        {/* ── Painel de filtros ── */}
        <div className="hist__filtros">
          <span className="hist__filtros-label">Filtros</span>

          <div className="hist__filtros-linha">

            <div className="hist__filtro-grupo">
              <label className="hist__filtro-texto">Data:</label>
              <input type="date" className="hist__input" value={dataInicio} onChange={(e) => setDataInicio(e.target.value)} />
              <span className="hist__filtro-texto">até</span>
              <input type="date" className="hist__input" value={dataFim} onChange={(e) => setDataFim(e.target.value)} />
            </div>

            <div className="hist__filtro-grupo">
              <label className="hist__filtro-texto">Cliente:</label>
              <input
                type="text"
                placeholder="Nome do Cliente"
                className="hist__input hist__input--cliente"
                value={cliente}
                onChange={(e) => setCliente(e.target.value)}
              />
            </div>

            <div className="hist__filtro-grupo">
              <label className="hist__filtro-texto">Valor:</label>
              <input type="number" placeholder="Mín." className="hist__input hist__input--valor" value={valorMin} onChange={(e) => setValorMin(e.target.value)} />
              <span className="hist__filtro-texto">até</span>
              <input type="number" placeholder="Máx." className="hist__input hist__input--valor" value={valorMax} onChange={(e) => setValorMax(e.target.value)} />
            </div>

            <button className="hist__btn-buscar" onClick={handleBuscar}>
              <HiSearch /> Buscar
            </button>

          </div>
        </div>

        {/* ── Tabela ── */}
        <div className="hist__tabela-wrapper">
        <div className="hist__tabela-scroll">
          <table className="hist__tabela">
            <thead>
              <tr>
                <th>Pedido</th>
                <th>Data</th>
                <th>Cliente</th>
                <th>Mesa</th>
                <th>Total</th>
                <th>Status</th>
                <th>Ações</th>
              </tr>
            </thead>
            <tbody>
              {pedidosDaPagina.map((pedido) => (
                <tr key={pedido.id}>
                  <td className="hist__id">#{pedido.id}</td>
                  <td>{pedido.data}</td>
                  <td>{pedido.cliente}</td>
                  <td>{pedido.mesa}</td>
                  <td>{formatarMoeda(pedido.total)}</td>
                  <td>
                    <span className={`hist__badge hist__badge--${pedido.status === 'Concluído' ? 'verde' : 'vermelho'}`}>
                      {pedido.status}
                    </span>
                  </td>
                  <td>
                    <button
                      className="hist__btn-detalhe"
                      onClick={() => setPedidoSelecionado(pedido)}
                    >
                      <HiSearch /> Ver Detalhes
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
           {/* ── Paginação ── */}
        <div className="hist__paginacao">
          <span className="hist__paginacao-info">
            Mostrando {indiceInicio + 1} a {Math.min(indiceInicio + ITENS_POR_PAGINA, pedidosFiltrados.length)} de {pedidosFiltrados.length} pedidos
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

        {/* ── Modal de detalhes ── */}
        {pedidoSelecionado && (
          <div className="hist__modal-overlay" onClick={() => setPedidoSelecionado(null)}>
            <div className="hist__modal" onClick={(e) => e.stopPropagation()}>
              <h3 className="hist__modal-titulo">Detalhes do Pedido #{pedidoSelecionado.id}</h3>
              <p><strong>Data:</strong> {pedidoSelecionado.data}</p>
              <p><strong>Cliente:</strong> {pedidoSelecionado.cliente}</p>
              <p><strong>Mesa:</strong> {pedidoSelecionado.mesa}</p>
              <p><strong>Total:</strong> {formatarMoeda(pedidoSelecionado.total)}</p>
              <p><strong>Status:</strong> {pedidoSelecionado.status}</p>
              <button className="hist__modal-fechar" onClick={() => setPedidoSelecionado(null)}>Fechar</button>
            </div>
          </div>
        )}

      </div>
    </RestaurantLayout>
  );
};

export default RestHistorico;