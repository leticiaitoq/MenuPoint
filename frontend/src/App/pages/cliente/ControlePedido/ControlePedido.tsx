import React, { useState } from 'react';
import { HiCheckCircle, HiClipboardList } from 'react-icons/hi';
import { FiCheck } from 'react-icons/fi';
import CustomerLayout from '../../../shared/components/layout/Customerlayout';
import './ControlePedido.css';

// ── Tipos ──────────────────────────────────────────────

type StatusPedido = 'pronto' | 'finalizado';

type FiltroAtivo = 'todos' | 'prontos' | 'finalizados';

interface ItemPedido {
  id: string;
  nome: string;
  quantidade: number;
  preco: number;
  imagem: string;
}

interface Pedido {
  id: string;
  numero: number;
  status: StatusPedido;
  horario: string;
  mesa: number;
  itens: ItemPedido[];
}

// ── Dados mockados 
// Futuramente virão da API via useEffect com o id do cliente

const PEDIDOS_MOCK: Pedido[] = [
  {
    id: 'p-1024',
    numero: 1024,
    status: 'pronto',
    horario: '12:10',
    mesa: 7,
    itens: [
      { id: 'i-1', nome: 'Pizza Portuguesa', quantidade: 1, preco: 45.00, imagem: '/images/Menu/pp.jpg' },
      { id: 'i-2', nome: 'Coca-Cola Lata',   quantidade: 1, preco: 6.00,  imagem: '/images/Menu/coca.jpg' },
    ],
  },
  {
    id: 'p-1023',
    numero: 1023,
    status: 'finalizado',
    horario: '11:50',
    mesa: 3,
    itens: [
      { id: 'i-3', nome: 'Salada Cesar', quantidade: 2, preco: 38.00, imagem: '/images/Menu/ceaser.jpg' },
      { id: 'i-4', nome: 'Coca-Cola Lata',      quantidade: 2, preco: 6.00,  imagem: '/images/Menu/coca.jpg' },
    ],
  },
  {
    id: 'p-1022',
    numero: 1022,
    status: 'finalizado',
    horario: '11:30',
    mesa: 5,
    itens: [
      { id: 'i-5', nome: 'Hamburguer Celestino',          quantidade: 1, preco: 25.00, imagem: '/images/Menu/lanche.jpg' },
      { id: 'i-6', nome: 'Caipirinha',      quantidade: 1, preco: 6.00,  imagem: '/images/Menu/caipira.jpg' },
      { id: 'i-7', nome: 'Sorvete', quantidade: 1, preco: 18.00, imagem: '/images/Menu/sor.jpg' },
    ],
  },
];

// ── Helpers 

/**
 * Calcula o total de um pedido somando preco * quantidade de cada item.
 */
const calcularTotal = (itens: ItemPedido[]): number =>
  itens.reduce((acc, item) => acc + item.preco * item.quantidade, 0);

/**
 * Formata número como moeda brasileira.
 * Ex.: 51 → "R$ 51,00" (Interessante)
 */
const formatarPreco = (valor: number): string =>
  `R$ ${valor.toFixed(2).replace('.', ',')}`;

// ── Componente 

const ControlePedido: React.FC = () => {
  const [filtro, setFiltro]   = useState<FiltroAtivo>('todos');
  const [pedidos, setPedidos] = useState<Pedido[]>(PEDIDOS_MOCK);

  // ── Contagens para os badges dos filtros
  const contagens = {
    todos:      pedidos.length,
    prontos:    pedidos.filter((p) => p.status === 'pronto').length,
    finalizados: pedidos.filter((p) => p.status === 'finalizado').length,
  };

  // ── Pedidos filtrados conforme aba ativa
  const pedidosFiltrados = pedidos.filter((p) => {
    if (filtro === 'prontos')    return p.status === 'pronto';
    if (filtro === 'finalizados') return p.status === 'finalizado';
    return true;
  });

  /**
   * Marca um pedido como finalizado.
   * Futuramente: chamar API PATCH /pedidos/:id com { status: 'finalizado' }.
   */
  const handleFinalizar = (id: string) => {
    setPedidos((prev) =>
      prev.map((p) => p.id === id ? { ...p, status: 'finalizado' } : p)
    );
  };

  // ── Render
  return (
    <CustomerLayout mode="logged">
      <div className="pedidos">

        {/* ── Cabeçalho ── */}
        <h1 className="pedidos__titulo">Histórico de Pedidos</h1>

        {/* ── Filtros ── */}
        <div className="pedidos__filtros">
          {(['todos', 'prontos', 'finalizados'] as FiltroAtivo[]).map((f) => (
            <button
              key={f}
              className={`pedidos__filtro-btn ${filtro === f ? 'pedidos__filtro-btn--ativo' : ''}`}
              onClick={() => setFiltro(f)}
            >
              {f.charAt(0).toUpperCase() + f.slice(1)}
              <span className="pedidos__filtro-badge">{contagens[f]}</span>
            </button>
          ))}
        </div>

        {/* ── Lista de pedidos ── */}
        <div className="pedidos__lista">
          {pedidosFiltrados.length === 0 ? (
            <p className="pedidos__vazio">Nenhum pedido encontrado.</p>
          ) : (
            pedidosFiltrados.map((pedido) => {
              const total = calcularTotal(pedido.itens);

              return (
                <div key={pedido.id} className="pedidos__card">

                  {/* ── Cabeçalho do card ── */}
                  <div className="pedidos__card-header">
                    <div className="pedidos__card-info">
                      <h2 className="pedidos__card-numero">Pedido #{pedido.numero}</h2>
                      <span className={`pedidos__status pedidos__status--${pedido.status}`}>
                        {pedido.status === 'pronto' ? (
                          <>🟡 Pronto</>
                        ) : (
                          <><HiCheckCircle className="pedidos__status-icon" /> Finalizado</>
                        )}
                      </span>
                    </div>

                    <p className="pedidos__card-meta">
                      {pedido.horario}&nbsp;&nbsp;|&nbsp;&nbsp;Mesa {pedido.mesa}
                    </p>
                  </div>

                  {/* ── Corpo: itens + totais + ação ── */}
                  <div className="pedidos__card-body">

                    {/* Itens */}
                    <div className="pedidos__itens">
                      {pedido.itens.map((item) => (
                        <div key={item.id} className="pedidos__item">
                          <img
                            src={item.imagem}
                            alt={item.nome}
                            className="pedidos__item-img"
                          />
                          <div className="pedidos__item-info">
                            <span className="pedidos__item-nome">
                              {item.quantidade}x {item.nome}
                            </span>
                            <span className="pedidos__item-preco">
                              {formatarPreco(item.preco * item.quantidade)}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>

                    {/* Totais + botão de ação */}
                    <div className="pedidos__card-rodape">
                      <div className="pedidos__totais">
                        <span className="pedidos__total-label">
                          Total: {formatarPreco(total)}
                        </span>
                        <span className="pedidos__total-destaque">
                          Total: {formatarPreco(total)}
                        </span>
                      </div>

                      {pedido.status === 'pronto' ? (
                        <button
                          className="pedidos__btn pedidos__btn--finalizar"
                          onClick={() => handleFinalizar(pedido.id)}
                        >
                          <FiCheck className="pedidos__btn-icon" />
                          Finalizar
                        </button>
                      ) : (
                        <button className="pedidos__btn pedidos__btn--conta">
                          <HiClipboardList className="pedidos__btn-icon" />
                          Ver Conta
                        </button>
                      )}
                    </div>

                  </div>
                </div>
              );
            })
          )}
        </div>

      </div>
    </CustomerLayout>
  );
};

export default ControlePedido;