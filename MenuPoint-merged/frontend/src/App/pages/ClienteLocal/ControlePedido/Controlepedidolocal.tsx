import React, { useState } from 'react';
import { HiCheckCircle, HiClipboardList } from 'react-icons/hi';
import { FiCheck } from 'react-icons/fi';
import CustomerLayout from '../../../shared/components/layout/Customerlayout';
import './Controlepedidolocal.css';

// ── Tipos ──────────────────────────────────────────────

type StatusPedidoLocal = 'pendente' | 'pronto' | 'finalizado';

type FiltroAtivoLocal = 'todos' | 'pendentes' | 'prontos' | 'finalizados';

interface ItemPedidoLocal {
  id: string;
  nome: string;
  quantidade: number;
  preco: number;
  imagem: string;
}

interface PedidoLocal {
  id: string;
  numero: number;
  status: StatusPedidoLocal;
  horario: string;
  mesa: number;
  itens: ItemPedidoLocal[];
}

// ── Dados mockados
// Futuramente virão da API via useEffect com o id da mesa / sessão local

const PEDIDOS_LOCAL_MOCK: PedidoLocal[] = [
  {
    id: 'pl-1025',
    numero: 1025,
    status: 'pendente',
    horario: '12:30',
    mesa: 2,
    itens: [
      { id: 'li-8', nome: 'Pizza Calabresa', quantidade: 1, preco: 42.00, imagem: '/images/Menu/pp.jpg' },
      { id: 'li-9', nome: 'Suco de Laranja', quantidade: 2, preco: 8.00,  imagem: '/images/Menu/coca.jpg' },
    ],
  },
  {
    id: 'pl-1024',
    numero: 1024,
    status: 'pronto',
    horario: '12:10',
    mesa: 7,
    itens: [
      { id: 'li-1', nome: 'Pizza Portuguesa', quantidade: 1, preco: 45.00, imagem: '/images/Menu/pp.jpg' },
      { id: 'li-2', nome: 'Coca-Cola Lata',   quantidade: 1, preco: 6.00,  imagem: '/images/Menu/coca.jpg' },
    ],
  },
  {
    id: 'pl-1023',
    numero: 1023,
    status: 'finalizado',
    horario: '11:50',
    mesa: 3,
    itens: [
      { id: 'li-3', nome: 'Salada Cesar',   quantidade: 2, preco: 38.00, imagem: '/images/Menu/ceaser.jpg' },
      { id: 'li-4', nome: 'Coca-Cola Lata', quantidade: 2, preco: 6.00,  imagem: '/images/Menu/coca.jpg' },
    ],
  },
  {
    id: 'pl-1022',
    numero: 1022,
    status: 'finalizado',
    horario: '11:30',
    mesa: 5,
    itens: [
      { id: 'li-5', nome: 'Hamburguer Celestino', quantidade: 1, preco: 25.00, imagem: '/images/Menu/lanche.jpg' },
      { id: 'li-6', nome: 'Caipirinha',           quantidade: 1, preco: 6.00,  imagem: '/images/Menu/caipira.jpg' },
      { id: 'li-7', nome: 'Sorvete',              quantidade: 1, preco: 18.00, imagem: '/images/Menu/sor.jpg' },
    ],
  },
];

// ── Helpers

/**
 * Calcula o total de um pedido somando preco * quantidade de cada item.
 */
const calcularTotalLocal = (itens: ItemPedidoLocal[]): number =>
  itens.reduce((acc, item) => acc + item.preco * item.quantidade, 0);

/**
 * Formata número como moeda brasileira.
 * Ex.: 51 → "R$ 51,00"
 */
const formatarPrecoLocal = (valor: number): string =>
  `R$ ${valor.toFixed(2).replace('.', ',')}`;

// ── Componente

const ControlePedidoLocal: React.FC = () => {
  const [filtroLocal, setFiltroLocal]   = useState<FiltroAtivoLocal>('todos');
  const [pedidosLocal, setPedidosLocal] = useState<PedidoLocal[]>(PEDIDOS_LOCAL_MOCK);

  // ── Contagens para os badges dos filtros
  const contagensLocal = {
    todos:       pedidosLocal.length,
    pendentes:   pedidosLocal.filter((p) => p.status === 'pendente').length,
    prontos:     pedidosLocal.filter((p) => p.status === 'pronto').length,
    finalizados: pedidosLocal.filter((p) => p.status === 'finalizado').length,
  };

  // ── Pedidos filtrados conforme aba ativa
  const pedidosLocalFiltrados = pedidosLocal.filter((p) => {
    if (filtroLocal === 'pendentes')   return p.status === 'pendente';
    if (filtroLocal === 'prontos')     return p.status === 'pronto';
    if (filtroLocal === 'finalizados') return p.status === 'finalizado';
    return true;
  });

  /**
   * Marca um pedido como finalizado.
   * Futuramente: chamar API PATCH /pedidos/:id com { status: 'finalizado' }.
   */
  const handleFinalizarLocal = (id: string) => {
    setPedidosLocal((prev) =>
      prev.map((p) => p.id === id ? { ...p, status: 'finalizado' } : p)
    );
  };

  // ── Render
  return (
    <CustomerLayout mode="guest">
      <div className="pedidos-local">

        {/* ── Cabeçalho ── */}
        <h1 className="pedidos-local__titulo">Meus Pedidos</h1>

        {/* ── Filtros ── */}
        <div className="pedidos-local__filtros">
          {(['todos', 'pendentes', 'prontos', 'finalizados'] as FiltroAtivoLocal[]).map((f) => (
            <button
              key={f}
              className={`pedidos-local__filtro-btn ${filtroLocal === f ? 'pedidos-local__filtro-btn--ativo' : ''}`}
              onClick={() => setFiltroLocal(f)}
            >
              {f.charAt(0).toUpperCase() + f.slice(1)}
              <span className="pedidos-local__filtro-badge">{contagensLocal[f]}</span>
            </button>
          ))}
        </div>

        {/* ── Lista de pedidos ── */}
        <div className="pedidos-local__lista">
          {pedidosLocalFiltrados.length === 0 ? (
            <p className="pedidos-local__vazio">Nenhum pedido encontrado.</p>
          ) : (
            pedidosLocalFiltrados.map((pedido) => {
              const totalLocal = calcularTotalLocal(pedido.itens);

              return (
                <div key={pedido.id} className="pedidos-local__card">

                  {/* ── Cabeçalho do card ── */}
                  <div className="pedidos-local__card-header">
                    <div className="pedidos-local__card-info">
                      <h2 className="pedidos-local__card-numero">Pedido #{pedido.numero}</h2>
                      <span className={`pedidos-local__status pedidos-local__status--${pedido.status}`}>
                        {pedido.status === 'pendente'   && <>🔵 Pendente</>}
                        {pedido.status === 'pronto'     && <>🟡 Pronto</>}
                        {pedido.status === 'finalizado' && (
                          <><HiCheckCircle className="pedidos-local__status-icon" /> Finalizado</>
                        )}
                      </span>
                    </div>

                    <p className="pedidos-local__card-meta">
                      {pedido.horario}&nbsp;&nbsp;|&nbsp;&nbsp;Mesa {pedido.mesa}
                    </p>
                  </div>

                  {/* ── Corpo: itens + totais + ação ── */}
                  <div className="pedidos-local__card-body">

                    {/* Itens */}
                    <div className="pedidos-local__itens">
                      {pedido.itens.map((item) => (
                        <div key={item.id} className="pedidos-local__item">
                          <img
                            src={item.imagem}
                            alt={item.nome}
                            className="pedidos-local__item-img"
                          />
                          <div className="pedidos-local__item-info">
                            <span className="pedidos-local__item-nome">
                              {item.quantidade}x {item.nome}
                            </span>
                            <span className="pedidos-local__item-preco">
                              {formatarPrecoLocal(item.preco * item.quantidade)}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>

                    {/* Totais + botão de ação */}
                    <div className="pedidos-local__card-rodape">
                      <div className="pedidos-local__totais">
                        <span className="pedidos-local__total-label">Total</span>
                        <span className="pedidos-local__total-destaque">
                          {formatarPrecoLocal(totalLocal)}
                        </span>
                      </div>

                      {pedido.status === 'pendente' && (
                        // Pedido aguardando preparo — cliente só pode acompanhar
                        <span className="pedidos-local__btn pedidos-local__btn--aguardando">
                          Aguardando...
                        </span>
                      )}

                      {pedido.status === 'pronto' && (
                        <button
                          className="pedidos-local__btn pedidos-local__btn--finalizar"
                          onClick={() => handleFinalizarLocal(pedido.id)}
                        >
                          <FiCheck className="pedidos-local__btn-icon" />
                          Finalizar
                        </button>
                      )}

                      {pedido.status === 'finalizado' && (
                        <button className="pedidos-local__btn pedidos-local__btn--conta">
                          <HiClipboardList className="pedidos-local__btn-icon" />
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

export default ControlePedidoLocal;