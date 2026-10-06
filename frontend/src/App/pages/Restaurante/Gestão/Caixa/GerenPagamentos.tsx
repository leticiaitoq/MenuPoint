import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  HiDotsVertical,
  HiUserGroup,
  HiClock,
  HiViewGrid,
  HiViewList,
  HiClipboardList,
  HiPlus,
  HiX,
  HiOutlineDocumentText,
  HiOutlineXCircle,
  HiOutlineClipboardList,
} from 'react-icons/hi';
import { MdQrCode2 } from 'react-icons/md';
import RestaurantLayout from '../../../../shared/components/layout/Restaurantelayout';
import ComandaCozinha from '../../../../shared/components/ComandaCozinha/ComandaCozinha';
import CancelarPedido from '../../../../shared/components/cancelarPedido/CancelarPedido';
import QrCodeMesa from '../../../../shared/components/QrCodeMesas/QrCodeMesa';
import { ROTAS_CAIXA } from '../../../../routes/caixaRotas';
import { obterPedidoDaMesa } from '../../../../shared/components/ComandaCozinha/comanda.mock';
import './GerenPagamentos.css';

// ── Tipos ──────────────────────────────────────────────────────────────────────
type StatusMesaCaixa = 'aberta' | 'fechada' | 'livre' | 'reservada';
type StatusInicialMesa = 'livre' | 'reservada';
type FiltroMesas = 'todas' | 'abertas' | 'fechadas';
type ModoVisualizacao = 'grade' | 'lista';

interface MesaCaixa {
  id: string;
  numero: number;
  // Preenchidos quando a mesa é cadastrada pelo modal
  capacidade?: number;
  observacao?: string;
  // Preenchidos quando há pedido em andamento
  pessoas?: number;
  itens?: number;
  total?: number;
  /** Quanto já foi pago da conta (pagamento parcial). Se > 0, não dá para cancelar. */
  pagamentosRealizados?: number;
  tempoMinutos?: number;
  status: StatusMesaCaixa;
}

type ErrosCadastro = Partial<Record<'numero' | 'capacidade' | 'observacao', string>>;

// ── Constantes ─────────────────────────────────────────────────────────────────
const CAPACIDADE_MIN = 1;
const CAPACIDADE_MAX = 20;
const OBSERVACAO_MAX = 80;

// ── Mock (substituir por chamada à API futuramente — ver mesa.service.ts) ──────
const MESAS_CAIXA_MOCK: MesaCaixa[] = [
  { id: 'm1', numero: 1, pessoas: 2, itens: 5, total: 85.5,  tempoMinutos: 15, status: 'aberta' },
  { id: 'm2', numero: 2, pessoas: 4, itens: 5, total: 162.4, pagamentosRealizados: 50, tempoMinutos: 8,  status: 'aberta' },
  { id: 'm3', numero: 3, pessoas: 2, itens: 2, total: 48.9,  tempoMinutos: 10, status: 'aberta' },
  { id: 'm4', numero: 4, pessoas: 6, itens: 7, total: 245.7, tempoMinutos: 35, status: 'aberta' },
  { id: 'm5', numero: 5, pessoas: 2, itens: 1, total: 27.9,  tempoMinutos: 5,  status: 'aberta' },
  { id: 'm6', numero: 6, pessoas: 3, itens: 4, total: 112.0, tempoMinutos: 20, status: 'aberta' },
  { id: 'm7', numero: 7, status: 'livre' },
  { id: 'm8', numero: 8, status: 'livre' },
];

const formatarMoeda = (valor: number) =>
  valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

// ── Componente ─────────────────────────────────────────────────────────────────
const GerenPagamentos: React.FC = () => {
  const navigate = useNavigate();

  // Lista de mesas em estado, para que uma mesa recém-cadastrada apareça na tela.
  const [mesas, setMesas] = useState<MesaCaixa[]>(MESAS_CAIXA_MOCK);

  const [filtro, setFiltro]             = useState<FiltroMesas>('todas');
  const [visualizacao, setVisualizacao] = useState<ModoVisualizacao>('grade');

  // id da mesa com o menu de ações (⋮) aberto — null = nenhum menu aberto
  const [menuAberto, setMenuAberto] = useState<string | null>(null);

  // mesa cuja comanda da cozinha está aberta — null = modal fechado
  const [comandaMesa, setComandaMesa] = useState<MesaCaixa | null>(null);

  // mesa que está sendo cancelada — null = modal fechado
  const [cancelarMesa, setCancelarMesa] = useState<MesaCaixa | null>(null);

  // mesa cujo QR Code está aberto — null = modal fechado
  const [qrMesa, setQrMesa] = useState<MesaCaixa | null>(null);

  // ── Modal: Cadastrar mesa ────────────────────────────────────────────────────
  const [modalAberto, setModalAberto]   = useState(false);
  const [numero, setNumero]             = useState('');
  const [capacidade, setCapacidade]     = useState('4');
  const [statusInicial, setStatusInicial] = useState<StatusInicialMesa>('livre');
  const [observacao, setObservacao]     = useState('');
  const [erros, setErros]               = useState<ErrosCadastro>({});

  // Sugestão de número para a próxima mesa (maior número existente + 1)
  const proximoNumero = useMemo(
    () => (mesas.length > 0 ? Math.max(...mesas.map((m) => m.numero)) + 1 : 1),
    [mesas]
  );

  // ── Contagens usadas nos filtros e no chip "Pedidos em aberto" ──────────────
  const totalAbertas  = useMemo(() => mesas.filter((m) => m.status === 'aberta').length, [mesas]);
  const totalFechadas = useMemo(() => mesas.filter((m) => m.status === 'fechada').length, [mesas]);

  // ── Aplica o filtro selecionado ──────────────────────────────────────────────
  const mesasFiltradas = useMemo(() => {
    if (filtro === 'abertas')  return mesas.filter((m) => m.status === 'aberta');
    if (filtro === 'fechadas') return mesas.filter((m) => m.status === 'fechada');
    return mesas;
  }, [filtro, mesas]);

  // Fecha o modal com a tecla Esc
  useEffect(() => {
    if (!modalAberto) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setModalAberto(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [modalAberto]);

  // ── Cadastro de mesa ─────────────────────────────────────────────────────────
  const abrirModal = () => {
    setNumero(String(proximoNumero));
    setCapacidade('4');
    setStatusInicial('livre');
    setObservacao('');
    setErros({});
    setMenuAberto(null);
    setModalAberto(true);
  };

  const fecharModal = () => setModalAberto(false);

  const validarCadastro = (): ErrosCadastro => {
    const novos: ErrosCadastro = {};

    const n = Number(numero);
    if (!numero || !Number.isInteger(n) || n < 1) {
      novos.numero = 'Informe um número de mesa válido.';
    } else if (mesas.some((m) => m.numero === n)) {
      novos.numero = `A Mesa ${n} já está cadastrada.`;
    }

    const c = Number(capacidade);
    if (!capacidade || !Number.isInteger(c) || c < CAPACIDADE_MIN || c > CAPACIDADE_MAX) {
      novos.capacidade = `A capacidade deve ser de ${CAPACIDADE_MIN} a ${CAPACIDADE_MAX} pessoas.`;
    }

    if (observacao.length > OBSERVACAO_MAX) {
      novos.observacao = `Use no máximo ${OBSERVACAO_MAX} caracteres.`;
    }

    return novos;
  };

  const handleCadastrarMesa = () => {
    const novos = validarCadastro();
    setErros(novos);
    if (Object.keys(novos).length > 0) return;

    const obs = observacao.trim();

    const novaMesa: MesaCaixa = {
      id:         `m${Date.now()}`,
      numero:     Number(numero),
      capacidade: Number(capacidade),
      observacao: obs || undefined,
      status:     statusInicial,
    };

    // Mantém a lista ordenada pelo número da mesa
    setMesas((prev) => [...prev, novaMesa].sort((a, b) => a.numero - b.numero));
    setModalAberto(false);
  };

  // ── Navegação ────────────────────────────────────────────────────────────────
  // Cards de mesas com pedido (aberta/fechada) levam para a tela do pedido/pagamento
  // daquela mesa (o id vai na URL: /restaurante/caixa/pagar/:id).
  const temPedido = (mesa: MesaCaixa) => mesa.status === 'aberta' || mesa.status === 'fechada';

  const abrirDetalheMesa = (mesa: MesaCaixa) => {
    if (!temPedido(mesa)) return;
    setMenuAberto(null);
    navigate(ROTAS_CAIXA.pagarMesa(mesa.id));
  };

  // Mesa sem pedido (livre/reservada) → manda pro fluxo de novo pedido
  const abrirMesaLivre = (_mesa: MesaCaixa, e: React.MouseEvent) => {
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
    navigate(ROTAS_CAIXA.pagarMesa(mesa.id));
  };

  const abrirComanda = (mesa: MesaCaixa, e: React.MouseEvent) => {
    e.stopPropagation();
    setMenuAberto(null);
    setComandaMesa(mesa);
  };

  const abrirQr = (mesa: MesaCaixa, e: React.MouseEvent) => {
    e.stopPropagation();
    setMenuAberto(null);
    setQrMesa(mesa);
  };

  const abrirCancelamento = (mesa: MesaCaixa, e: React.MouseEvent) => {
    e.stopPropagation();
    setMenuAberto(null);
    setCancelarMesa(mesa);
  };

  // TODO: chamar a API — pedido.service.ts: cancelar(pedidoId, motivo)
  //       (Pedido.status = CANCELADO, Pedido.cancelamento_motivo = motivo, Mesa.status = LIVRE)
  const confirmarCancelamento = (_motivo: string) => {
    if (!cancelarMesa) return;
    // Mesa volta a ficar livre: mantém só os dados de cadastro, limpa o pedido
    setMesas((prev) =>
      prev.map((m) =>
        m.id === cancelarMesa.id
          ? { id: m.id, numero: m.numero, capacidade: m.capacidade, observacao: m.observacao, status: 'livre' }
          : m
      )
    );
    setCancelarMesa(null);
  };

  const mensagemVazio =
    filtro === 'abertas'  ? 'Nenhuma mesa aberta no momento.'  :
    filtro === 'fechadas' ? 'Nenhuma mesa fechada no momento.' :
                            'Nenhuma mesa cadastrada.';

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
            {/* "Pedidos em aberto" é só informação (contador), não uma ação. */}
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

            {/* "Histórico" é uma ação real — <button> */}
            <button
              className="caixa__btn-historico"
              onClick={() => navigate('/restaurante/historico')}
              aria-label="Ver histórico de pedidos"
            >
              Histórico
            </button>

            {/* Abre o modal de cadastro de mesa */}
            <button
              className="caixa__btn-cadastrar"
              onClick={(e) => { e.stopPropagation(); abrirModal(); }}
              aria-label="Cadastrar nova mesa"
            >
              <HiPlus /> Cadastrar mesa
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
            <div className="caixa__vazio">{mensagemVazio}</div>
          ) : (
            <div className={`caixa__grid caixa__grid--${visualizacao}`}>
              {mesasFiltradas.map((mesa) => {
                const clicavel = temPedido(mesa);

                return (
                  <div
                    key={mesa.id}
                    className={`caixa__card caixa__card--${mesa.status}${clicavel ? ' caixa__card--clicavel' : ''}`}
                    onClick={clicavel ? () => abrirDetalheMesa(mesa) : undefined}
                    role={clicavel ? 'button' : undefined}
                    tabIndex={clicavel ? 0 : undefined}
                    onKeyDown={
                      clicavel
                        ? (e) => {
                            // Só reage se o foco estiver no próprio card,
                            // não em botões internos (ex.: menu ⋮).
                            if (e.target === e.currentTarget && e.key === 'Enter') {
                              abrirDetalheMesa(mesa);
                            }
                          }
                        : undefined
                    }
                    aria-label={
                      clicavel
                        ? `Abrir pedido da Mesa ${mesa.numero}`
                        : `Mesa ${mesa.numero} ${mesa.status}`
                    }
                  >
                    <div className="caixa__card-topo">
                      <span className="caixa__card-nome">Mesa {String(mesa.numero).padStart(2, '0')}</span>

                      {clicavel && (
                        <div className="caixa__card-menu-wrap">
                          <button
                            className="caixa__card-menu-btn"
                            onClick={(e) => toggleMenu(mesa.id, e)}
                            aria-label={`Mais ações para a Mesa ${mesa.numero}`}
                            aria-expanded={menuAberto === mesa.id}
                          >
                            <HiDotsVertical />
                          </button>

                          {menuAberto === mesa.id && (
                            <div className="caixa__card-menu" onClick={(e) => e.stopPropagation()}>
                              <button className="caixa__card-menu-item" onClick={(e) => handleAcaoMenu(mesa, e)}>
                                <HiOutlineDocumentText /> Ver detalhes
                              </button>
                              <button className="caixa__card-menu-item" onClick={(e) => abrirComanda(mesa, e)}>
                                <HiOutlineClipboardList /> Comanda da cozinha
                              </button>
                              <button className="caixa__card-menu-item" onClick={(e) => abrirQr(mesa, e)}>
                                <MdQrCode2 /> QR Code da mesa
                              </button>
                              {mesa.status === 'aberta' && (
                                <button className="caixa__card-menu-item caixa__card-menu-item--perigo" onClick={(e) => abrirCancelamento(mesa, e)}>
                                  <HiOutlineXCircle /> Cancelar pedido
                                </button>
                              )}
                            </div>
                          )}
                        </div>
                      )}
                    </div>

                    {!clicavel ? (
                      /* Mesa sem pedido: livre ou reservada */
                      <>
                        <span className="caixa__card-livre-label">
                          {mesa.status === 'reservada' ? 'Reservada' : 'Livre'}
                        </span>

                        {mesa.capacidade !== undefined && (
                          <span className="caixa__card-pessoas">
                            <HiUserGroup /> {mesa.capacidade} lugares
                          </span>
                        )}

                        {mesa.observacao && (
                          <span className="caixa__card-obs" title={mesa.observacao}>
                            {mesa.observacao}
                          </span>
                        )}

                        <button className="caixa__card-btn-abrir" onClick={(e) => abrirMesaLivre(mesa, e)}>
                          <HiPlus /> Abrir mesa
                        </button>
                      </>
                    ) : (
                      /* Mesa com pedido: aberta ou fechada */
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

        {/* ── Modal: Cadastrar mesa ── */}
        {modalAberto && (
          <div className="caixa__overlay" onClick={fecharModal}>
            <div
              className="caixa__modal"
              role="dialog"
              aria-modal="true"
              aria-labelledby="caixa-modal-titulo"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="caixa__modal-header">
                <div>
                  <h3 id="caixa-modal-titulo" className="caixa__modal-titulo">Cadastrar mesa</h3>
                  <p className="caixa__modal-subtitulo">Preencha os dados da nova mesa.</p>
                </div>
                <button className="caixa__modal-fechar" onClick={fecharModal} aria-label="Fechar">
                  <HiX />
                </button>
              </div>

              <div className="caixa__modal-corpo">

                <div className="caixa__campo-linha">
                  <div className="caixa__campo">
                    <label className="caixa__label" htmlFor="mesa-numero">Número da mesa</label>
                    <input
                      id="mesa-numero"
                      className={`caixa__input${erros.numero ? ' caixa__input--erro' : ''}`}
                      type="number"
                      min="1"
                      step="1"
                      value={numero}
                      onChange={(e) => setNumero(e.target.value)}
                      autoFocus
                    />
                    {erros.numero && <span className="caixa__erro" role="alert">{erros.numero}</span>}
                  </div>

                  <div className="caixa__campo">
                    <label className="caixa__label" htmlFor="mesa-capacidade">Capacidade (pessoas)</label>
                    <input
                      id="mesa-capacidade"
                      className={`caixa__input${erros.capacidade ? ' caixa__input--erro' : ''}`}
                      type="number"
                      min={CAPACIDADE_MIN}
                      max={CAPACIDADE_MAX}
                      step="1"
                      value={capacidade}
                      onChange={(e) => setCapacidade(e.target.value)}
                    />
                    {erros.capacidade && <span className="caixa__erro" role="alert">{erros.capacidade}</span>}
                  </div>
                </div>

                <fieldset className="caixa__campo caixa__fieldset">
                  <legend className="caixa__label">Status inicial</legend>
                  <div className="caixa__opcoes">
                    <label className={`caixa__opcao caixa__opcao--livre${statusInicial === 'livre' ? ' caixa__opcao--ativa' : ''}`}>
                      <input
                        type="radio"
                        name="mesa-status"
                        value="livre"
                        checked={statusInicial === 'livre'}
                        onChange={() => setStatusInicial('livre')}
                      />
                      Livre
                    </label>
                    <label className={`caixa__opcao caixa__opcao--reservada${statusInicial === 'reservada' ? ' caixa__opcao--ativa' : ''}`}>
                      <input
                        type="radio"
                        name="mesa-status"
                        value="reservada"
                        checked={statusInicial === 'reservada'}
                        onChange={() => setStatusInicial('reservada')}
                      />
                      Reservada
                    </label>
                  </div>
                </fieldset>

                <div className="caixa__campo">
                  <label className="caixa__label" htmlFor="mesa-observacao">
                    Observação <span className="caixa__opcional">(opcional)</span>
                  </label>
                  <textarea
                    id="mesa-observacao"
                    className={`caixa__input caixa__textarea${erros.observacao ? ' caixa__input--erro' : ''}`}
                    rows={3}
                    placeholder="Ex.: perto da janela, acessível para cadeirantes"
                    value={observacao}
                    onChange={(e) => setObservacao(e.target.value)}
                  />
                  <div className="caixa__campo-rodape">
                    {erros.observacao
                      ? <span className="caixa__erro" role="alert">{erros.observacao}</span>
                      : <span />}
                    <span className={`caixa__contador${observacao.length > OBSERVACAO_MAX ? ' caixa__contador--excedido' : ''}`}>
                      {observacao.length}/{OBSERVACAO_MAX}
                    </span>
                  </div>
                </div>

              </div>

              <div className="caixa__modal-acoes">
                <button className="caixa__btn-cancelar" onClick={fecharModal}>
                  Cancelar
                </button>
                <button className="caixa__btn-salvar" onClick={handleCadastrarMesa}>
                  <HiPlus /> Cadastrar mesa
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ── Modal: Comanda da cozinha (gerada a partir do pedido da mesa) ── */}
        <ComandaCozinha
          aberta={comandaMesa !== null}
          pedido={comandaMesa ? obterPedidoDaMesa(comandaMesa.id) : null}
          onFechar={() => setComandaMesa(null)}
        />

        {/* ── Modal: QR Code da mesa ── */}
        <QrCodeMesa mesa={qrMesa} onFechar={() => setQrMesa(null)} />

        {/* ── Modal: Cancelar pedido ── */}
        <CancelarPedido
          aberto={cancelarMesa !== null}
          mesaNumero={cancelarMesa?.numero ?? 0}
          itens={cancelarMesa?.itens}
          total={cancelarMesa?.total}
          pagamentosRealizados={cancelarMesa?.pagamentosRealizados}
          onFechar={() => setCancelarMesa(null)}
          onConfirmar={confirmarCancelamento}
        />

      </div>
    </RestaurantLayout>
  );
};

export default GerenPagamentos;