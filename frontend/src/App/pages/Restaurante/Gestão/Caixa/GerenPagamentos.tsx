import React, { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  HiDotsVertical,
  HiUserGroup,
  HiClock,
  HiViewGrid,
  HiViewList,
  HiClipboardList,
  HiPlus,
  HiOutlineDocumentText,
  HiOutlinePrinter,
  HiOutlineXCircle,
} from 'react-icons/hi';
import RestaurantLayout from '../../../../shared/components/layout/Restaurantelayout';
import './GerenPagamentos.css';

// ── Tipos ──────────────────────────────────────────────────────────────────────
type StatusMesaCaixa = 'aberta' | 'fechada' | 'livre';
type FiltroMesas = 'todas' | 'abertas' | 'fechadas';
type ModoVisualizacao = 'grade' | 'lista';

interface MesaCaixa {
  id: string;
  numero: number;
  pessoas?: number;
  itens?: number;
  total?: number;
  tempoMinutos?: number;
  status: StatusMesaCaixa;
}

// ── Mock (substituir por chamada à API futuramente — ver mesa.service.ts) ──────
const MESAS_CAIXA_MOCK: MesaCaixa[] = [
  { id: 'm1', numero: 1, pessoas: 2, itens: 5, total: 85.5,  tempoMinutos: 15, status: 'aberta' },
  { id: 'm2', numero: 2, pessoas: 4, itens: 5, total: 162.4, tempoMinutos: 8,  status: 'aberta' },
  { id: 'm3', numero: 3, pessoas: 2, itens: 2, total: 48.9,  tempoMinutos: 10, status: 'aberta' },
  { id: 'm4', numero: 4, pessoas: 6, itens: 7, total: 245.7, tempoMinutos: 35, status: 'aberta' },
  { id: 'm5', numero: 5, pessoas: 2, itens: 1, total: 27.9,  tempoMinutos: 5,  status: 'aberta' },
  { id: 'm6', numero: 6, pessoas: 3, itens: 4, total: 112.0, tempoMinutos: 20, status: 'aberta' },
  { id: 'm7', numero: 7, status: 'livre' },
  { id: 'm8', numero: 8, status: 'livre' },
];

// ── Componente ─────────────────────────────────────────────────────────────────
const GerenPagamentos: React.FC = () => {
  const navigate = useNavigate();

  const [filtro, setFiltro]         = useState<FiltroMesas>('todas');
  const [visualizacao, setVisualizacao] = useState<ModoVisualizacao>('grade');

  // id da mesa com o menu de ações (⋮) aberto — null = nenhum menu aberto
  const [menuAberto, setMenuAberto] = useState<string | null>(null);

  // ── Contagens usadas nos filtros e no chip "Pedidos em aberto" ──────────────
  // Calculadas a partir dos dados reais (não fixas), pra nunca ficar
  // dessincronizado do que está sendo exibido na tela.
  const totalAbertas  = useMemo(() => MESAS_CAIXA_MOCK.filter((m) => m.status === 'aberta').length, []);
  const totalFechadas = useMemo(() => MESAS_CAIXA_MOCK.filter((m) => m.status === 'fechada').length, []);

  // ── Aplica o filtro selecionado ──────────────────────────────────────────────
  const mesasFiltradas = useMemo(() => {
    if (filtro === 'abertas')  return MESAS_CAIXA_MOCK.filter((m) => m.status === 'aberta');
    if (filtro === 'fechadas') return MESAS_CAIXA_MOCK.filter((m) => m.status === 'fechada');
    return MESAS_CAIXA_MOCK;
  }, [filtro]);

  const formatarMoeda = (valor: number) =>
    valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

  // ── Navegação ────────────────────────────────────────────────────────────────
  // Cards de mesas com pedido (aberta/fechada) levam para a tela de detalhe do
  // pedido/pagamento. TODO: criar a tela de detalhe e ajustar a rota abaixo.
  const abrirDetalheMesa = (mesa: MesaCaixa) => {
    if (mesa.status === 'livre') return;
    setMenuAberto(null);
    navigate('/restaurante/caixa/pagar');
  };

  // Mesa livre → manda pro fluxo de novo pedido, já é uma tela existente
  const abrirMesaLivre = (mesa: MesaCaixa, e: React.MouseEvent) => {
    e.stopPropagation();
    navigate('/restaurante/pedido');
  };

  const toggleMenu = (mesaId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setMenuAberto((atual) => (atual === mesaId ? null : mesaId));
  };

  const handleAcaoMenu = (mesa: MesaCaixa, e: React.MouseEvent) => {
    e.stopPropagation();
    setMenuAberto(null);
    navigate(`/restaurante/caixa/mesa/${mesa.id}`);
  };

  return (
    <RestaurantLayout>
      <div className="caixa" onClick={() => setMenuAberto(null)}>

        {/* ── Cabeçalho ── */}
        <div className="caixa__header">
          <div>
            <h2 className="caixa__titulo">Caixa</h2>
            <p className="caixa__subtitulo">gerencie pedidos e pagamentos</p>
          </div>

          <div className="caixa__header-acoes">
            {/*
              "Pedidos em aberto" é só uma informação (contador), não uma ação —
              por isso é uma <div role="status">, sem cursor de clique e sem
              hover, pra não parecer botão.
            */}
            <div
              className="caixa__chip-info"
              role="status"
              aria-label={`${totalAbertas} pedidos em aberto`}
              title="Total de pedidos em aberto no momento"
            >
              <HiClipboardList className="caixa__chip-info-icone" />
              <span className="caixa__chip-info-texto">Pedidos em aberto</span>
              <span className="caixa__chip-info-numero">{totalAbertas}</span>
            </div>

            {/*
              "Histórico" é uma ação real — <button>, com hover/estado de
              foco e cursor de ponteiro, pra deixar claro que é clicável.
            */}
            <button
              className="caixa__btn-historico"
              onClick={() => navigate('/restaurante/historico')}
              aria-label="Ver histórico de pedidos"
            >
              Histórico
            </button>
          </div>
        </div>

        {/* ── Painel de mesas ── */}
        <div className="caixa__painel">

          {/* ── Filtros + alternância de visualização ── */}
          <div className="caixa__filtros">
            <div className="caixa__abas" role="tablist" aria-label="Filtrar mesas">
              <button
                role="tab"
                aria-selected={filtro === 'todas'}
                className={`caixa__aba${filtro === 'todas' ? ' caixa__aba--ativa' : ''}`}
                onClick={() => setFiltro('todas')}
              >
                Todas as mesas
              </button>
              <button
                role="tab"
                aria-selected={filtro === 'abertas'}
                className={`caixa__aba${filtro === 'abertas' ? ' caixa__aba--ativa' : ''}`}
                onClick={() => setFiltro('abertas')}
              >
                Abertas ({totalAbertas})
              </button>
              <button
                role="tab"
                aria-selected={filtro === 'fechadas'}
                className={`caixa__aba${filtro === 'fechadas' ? ' caixa__aba--ativa' : ''}`}
                onClick={() => setFiltro('fechadas')}
              >
                Fechadas ({totalFechadas})
              </button>
            </div>

            <div className="caixa__visualizacao">
              <button
                className={`caixa__btn-view${visualizacao === 'grade' ? ' caixa__btn-view--ativo' : ''}`}
                onClick={() => setVisualizacao('grade')}
                aria-label="Ver em grade"
                aria-pressed={visualizacao === 'grade'}
              >
                <HiViewGrid />
              </button>
              <button
                className={`caixa__btn-view${visualizacao === 'lista' ? ' caixa__btn-view--ativo' : ''}`}
                onClick={() => setVisualizacao('lista')}
                aria-label="Ver em lista"
                aria-pressed={visualizacao === 'lista'}
              >
                <HiViewList />
              </button>
            </div>
          </div>

          {/* ── Grid de cards ── */}
          {mesasFiltradas.length === 0 ? (
            <div className="caixa__vazio">Nenhuma mesa {filtro === 'abertas' ? 'aberta' : 'fechada'} no momento.</div>
          ) : (
            <div className={`caixa__grid caixa__grid--${visualizacao}`}>
              {mesasFiltradas.map((mesa) => {
                const clicavel = mesa.status !== 'livre';

                return (
                  <div
                    key={mesa.id}
                    className={`caixa__card caixa__card--${mesa.status}${clicavel ? ' caixa__card--clicavel' : ''}`}
                    onClick={clicavel ? () => abrirDetalheMesa(mesa) : undefined}
                    role={clicavel ? 'button' : undefined}
                    tabIndex={clicavel ? 0 : undefined}
                    onKeyDown={
                      clicavel
                        ? (e) => { if (e.key === 'Enter') abrirDetalheMesa(mesa); }
                        : undefined
                    }
                    aria-label={clicavel ? `Abrir pedido da Mesa ${mesa.numero}` : `Mesa ${mesa.numero} livre`}
                  >
                    <div className="caixa__card-topo">
                      <span className="caixa__card-nome">Mesa {String(mesa.numero).padStart(2, '0')}</span>

                      {clicavel && (
                        <div className="caixa__card-menu-wrap">
                          <button
                            className="caixa__card-menu-btn"
                            onClick={(e) => toggleMenu(mesa.id, e)}
                            aria-label={`Mais ações para a Mesa ${mesa.numero}`}
                          >
                            <HiDotsVertical />
                          </button>

                          {menuAberto === mesa.id && (
                            <div className="caixa__card-menu" onClick={(e) => e.stopPropagation()}>
                              <button className="caixa__card-menu-item" onClick={(e) => handleAcaoMenu(mesa, e)}>
                                <HiOutlineDocumentText /> Ver detalhes
                              </button>
                              <button className="caixa__card-menu-item" onClick={(e) => e.stopPropagation()}>
                                <HiOutlinePrinter /> Imprimir conta
                              </button>
                              <button className="caixa__card-menu-item caixa__card-menu-item--perigo" onClick={(e) => e.stopPropagation()}>
                                <HiOutlineXCircle /> Cancelar pedido
                              </button>
                            </div>
                          )}
                        </div>
                      )}
                    </div>

                    {mesa.status === 'livre' ? (
                      <>
                        <span className="caixa__card-livre-label">Livre</span>
                        <button className="caixa__card-btn-abrir" onClick={(e) => abrirMesaLivre(mesa, e)}>
                          <HiPlus /> Abrir mesa
                        </button>
                      </>
                    ) : (
                      <>
                        <span className="caixa__card-pessoas">
                          <HiUserGroup /> {mesa.pessoas} pessoas
                        </span>

                        <div className="caixa__card-linha">
                          <span className="caixa__card-itens">{mesa.itens} itens</span>
                          <span className="caixa__card-total">{formatarMoeda(mesa.total ?? 0)}</span>
                        </div>

                        <div className="caixa__card-linha">
                          <span className={`caixa__badge caixa__badge--${mesa.status}`}>
                            {mesa.status === 'aberta' ? 'Aberta' : 'Fechada'}
                          </span>
                          {mesa.status === 'aberta' && (
                            <span className="caixa__card-tempo">
                              <HiClock /> {mesa.tempoMinutos} min
                            </span>
                          )}
                        </div>
                      </>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

      </div>
    </RestaurantLayout>
  );
};

export default GerenPagamentos;