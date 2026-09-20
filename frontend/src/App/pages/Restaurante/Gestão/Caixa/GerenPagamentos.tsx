import React, { useMemo, useRef, useState } from 'react';
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
  HiDownload,
  HiPrinter,
  HiOutlineDocumentText,
  HiOutlinePrinter,
  HiOutlineXCircle,
} from 'react-icons/hi';
import { MdQrCode2 } from 'react-icons/md';
import { QRCodeSVG, QRCodeCanvas } from 'qrcode.react';
import RestaurantLayout from '../../../../shared/components/layout/Restaurantelayout';
import './GerenPagamentos.css';

// ── Tipos ──────────────────────────────────────────────────────────────────────
type StatusMesaCaixa = 'aberta' | 'fechada' | 'livre';
type FiltroMesas = 'todas' | 'abertas' | 'fechadas';
type ModoVisualizacao = 'grade' | 'lista';

interface MesaCaixa {
  id: string;
  numero: number;
  capacidade: number; // NOVO — vindo da tela de Mesas
  pessoas?: number;
  itens?: number;
  total?: number;
  tempoMinutos?: number;
  status: StatusMesaCaixa;
}

// ── URL base do cardápio que o cliente acessa ao escanear o QR ─────────────────
const BASE_URL = process.env.REACT_APP_API_URL ?? 'http://localhost:3333';

// ── Mock (substituir por API futuramente) ──────────────────────────────────────
const MESAS_CAIXA_MOCK: MesaCaixa[] = [
  { id: 'm1', numero: 1, capacidade: 4,  pessoas: 2, itens: 5, total: 85.5,  tempoMinutos: 15, status: 'aberta' },
  { id: 'm2', numero: 2, capacidade: 6,  pessoas: 4, itens: 5, total: 162.4, tempoMinutos: 8,  status: 'aberta' },
  { id: 'm3', numero: 3, capacidade: 4,  pessoas: 2, itens: 2, total: 48.9,  tempoMinutos: 10, status: 'aberta' },
  { id: 'm4', numero: 4, capacidade: 8,  pessoas: 6, itens: 7, total: 245.7, tempoMinutos: 35, status: 'aberta' },
  { id: 'm5', numero: 5, capacidade: 2,  pessoas: 2, itens: 1, total: 27.9,  tempoMinutos: 5,  status: 'aberta' },
  { id: 'm6', numero: 6, capacidade: 4,  pessoas: 3, itens: 4, total: 112.0, tempoMinutos: 20, status: 'aberta' },
  { id: 'm7', numero: 7, capacidade: 4,  status: 'livre' },
  { id: 'm8', numero: 8, capacidade: 6,  status: 'livre' },
];

// ── Componente ─────────────────────────────────────────────────────────────────
const GerenPagamentos: React.FC = () => {
  const navigate = useNavigate();

  const [mesas, setMesas]               = useState<MesaCaixa[]>(MESAS_CAIXA_MOCK);
  const [filtro, setFiltro]             = useState<FiltroMesas>('todas');
  const [visualizacao, setVisualizacao] = useState<ModoVisualizacao>('grade');
  const [menuAberto, setMenuAberto]     = useState<string | null>(null);

  // ── Estado do modal "Adicionar Mesa" (migrado de GestaoMesas) ────────────────
  const [modalAdicionarAberto, setModalAdicionarAberto] = useState(false);
  const [capacidade, setCapacidade] = useState('4');
  const [erroCapacidade, setErroCapacidade] = useState('');

  // ── Estado do modal de QR Code (migrado de GestaoMesas) ──────────────────────
  const [mesaSelecionadaQr, setMesaSelecionadaQr] = useState<MesaCaixa | null>(null);
  const qrCanvasRef = useRef<HTMLDivElement>(null);

  const totalAbertas  = useMemo(() => mesas.filter((m) => m.status === 'aberta').length, [mesas]);
  const totalFechadas = useMemo(() => mesas.filter((m) => m.status === 'fechada').length, [mesas]);

  const mesasFiltradas = useMemo(() => {
    if (filtro === 'abertas')  return mesas.filter((m) => m.status === 'aberta');
    if (filtro === 'fechadas') return mesas.filter((m) => m.status === 'fechada');
    return mesas;
  }, [filtro, mesas]);

  const formatarMoeda = (valor: number) =>
    valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

  const urlDaMesa = (numero: number) => `${BASE_URL}/mesa/${numero}`;

  // ── Navegação ────────────────────────────────────────────────────────────────
  const abrirDetalheMesa = (mesa: MesaCaixa) => {
    if (mesa.status === 'livre') return;
    setMenuAberto(null);
    navigate('/restaurante/caixa/pagar');
  };

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

  const abrirQrCode = (mesa: MesaCaixa, e: React.MouseEvent) => {
    e.stopPropagation();
    setMenuAberto(null);
    setMesaSelecionadaQr(mesa);
  };

  // ── Adicionar mesa (migrado de GestaoMesas) ──────────────────────────────────
  const abrirModalAdicionar = () => {
    setCapacidade('4');
    setErroCapacidade('');
    setModalAdicionarAberto(true);
  };

  const handleAdicionarMesa = () => {
    if (!capacidade || Number(capacidade) < 1) {
      setErroCapacidade('Informe uma capacidade válida.');
      return;
    }

    const proximoNumero = mesas.length > 0
      ? Math.max(...mesas.map((m) => m.numero)) + 1
      : 1;

    const novaMesa: MesaCaixa = {
      id:         `m${Date.now()}`,
      numero:     proximoNumero,
      capacidade: Number(capacidade),
      status:     'livre',
    };

    setMesas((prev) => [...prev, novaMesa]);
    setCapacidade('4');
    setErroCapacidade('');
    setModalAdicionarAberto(false);
  };

  // ── QR Code: download PNG (migrado de GestaoMesas) ───────────────────────────
  const handleDownload = () => {
    if (!mesaSelecionadaQr || !qrCanvasRef.current) return;

    const canvas = qrCanvasRef.current.querySelector('canvas');
    if (!canvas) return;

    const url     = canvas.toDataURL('image/png');
    const link    = document.createElement('a');
    link.href     = url;
    link.download = `qrcode-mesa-${mesaSelecionadaQr.numero}.png`;
    link.click();
  };

  // ── QR Code: impressão (migrado de GestaoMesas) ──────────────────────────────
  const handleImprimir = () => {
    if (!mesaSelecionadaQr) return;

    const svgEl = qrCanvasRef.current?.querySelector('svg');
    if (!svgEl) return;

    const svgStr = new XMLSerializer().serializeToString(svgEl);
    const janela = window.open('', '_blank', 'width=400,height=500');
    if (!janela) return;

    janela.document.write(`
      <html>
        <head>
          <title>QR Code - Mesa ${mesaSelecionadaQr.numero}</title>
          <style>
            body { display: flex; flex-direction: column; align-items: center;
                   justify-content: center; height: 100vh; font-family: sans-serif;
                   gap: 16px; }
            h2   { margin: 0; font-size: 20px; color: #333; }
            p    { margin: 0; font-size: 14px; color: #888; }
          </style>
        </head>
        <body>
          <h2>Mesa ${mesaSelecionadaQr.numero}</h2>
          <p>${mesaSelecionadaQr.capacidade} pessoas</p>
          ${svgStr}
          <p>${urlDaMesa(mesaSelecionadaQr.numero)}</p>
          <script>window.onload = () => { window.print(); window.close(); }</script>
        </body>
      </html>
    `);
    janela.document.close();
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

            {/* NOVO: Adicionar Mesa */}
            <button
              className="caixa__btn-adicionar"
              onClick={abrirModalAdicionar}
              aria-label="Adicionar nova mesa"
            >
              <HiPlus /> Adicionar Mesa
            </button>

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

                      {/* Menu de 3 pontinhos — agora aparece em TODAS as mesas */}
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
                            {clicavel && (
                              <>
                                <button className="caixa__card-menu-item" onClick={(e) => handleAcaoMenu(mesa, e)}>
                                  <HiOutlineDocumentText /> Ver detalhes
                                </button>
                                <button className="caixa__card-menu-item" onClick={(e) => e.stopPropagation()}>
                                  <HiOutlinePrinter /> Imprimir conta
                                </button>
                              </>
                            )}

                            {/* NOVO: QR Code — disponível pra qualquer mesa */}
                            <button className="caixa__card-menu-item" onClick={(e) => abrirQrCode(mesa, e)}>
                              <MdQrCode2 /> Ver QR Code
                            </button>

                            {clicavel && (
                              <button className="caixa__card-menu-item caixa__card-menu-item--perigo" onClick={(e) => e.stopPropagation()}>
                                <HiOutlineXCircle /> Cancelar pedido
                              </button>
                            )}
                          </div>
                        )}
                      </div>
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

        {/* ── Modal: Adicionar Mesa (migrado de GestaoMesas) ── */}
        {modalAdicionarAberto && (
          <div className="mesas__overlay" onClick={() => setModalAdicionarAberto(false)}>
            <div className="mesas__modal" onClick={(e) => e.stopPropagation()}>
              <div className="mesas__modal-header">
                <h3>Adicionar Mesa</h3>
                <button className="mesas__modal-fechar" onClick={() => setModalAdicionarAberto(false)}>
                  <HiX />
                </button>
              </div>

              <div className="mesas__modal-corpo">
                <p className="mesas__modal-info">
                  A nova mesa será cadastrada como <strong>Mesa {mesas.length + 1}</strong>.
                </p>

                <div className="mesas__campo">
                  <label className="mesas__label">Capacidade (pessoas)</label>
                  <input
                    className="mesas__input"
                    type="number"
                    min="1"
                    value={capacidade}
                    onChange={(e) => setCapacidade(e.target.value)}
                  />
                </div>

                {erroCapacidade && <p className="mesas__erro">{erroCapacidade}</p>}
              </div>

              <div className="mesas__modal-acoes">
                <button className="mesas__btn-cancelar" onClick={() => setModalAdicionarAberto(false)}>
                  Cancelar
                </button>
                <button className="mesas__btn-salvar" onClick={handleAdicionarMesa}>
                  <HiPlus /> Adicionar
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ── Modal: QR Code da Mesa (migrado de GestaoMesas) ── */}
        {mesaSelecionadaQr && (
          <div className="mesas__overlay" onClick={() => setMesaSelecionadaQr(null)}>
            <div className="mesas__modal mesas__modal--qr" onClick={(e) => e.stopPropagation()}>
              <div className="mesas__modal-header">
                <h3>QR Code — Mesa {mesaSelecionadaQr.numero}</h3>
                <button className="mesas__modal-fechar" onClick={() => setMesaSelecionadaQr(null)}>
                  <HiX />
                </button>
              </div>

              <div className="mesas__modal-corpo mesas__modal-corpo--qr">
                <p className="mesas__modal-info">
                  Escaneie para acessar o cardápio da{' '}
                  <strong>Mesa {mesaSelecionadaQr.numero}</strong>{' '}
                  ({mesaSelecionadaQr.capacidade} pessoas).
                </p>

                <div className="mesas__qr-wrap" ref={qrCanvasRef}>
                  <QRCodeSVG
                    value={urlDaMesa(mesaSelecionadaQr.numero)}
                    size={200}
                    bgColor="#ffffff"
                    fgColor="#1a1a1a"
                    level="H"
                  />

                  <div style={{ display: 'none' }}>
                    <QRCodeCanvas
                      value={urlDaMesa(mesaSelecionadaQr.numero)}
                      size={400}
                      bgColor="#ffffff"
                      fgColor="#1a1a1a"
                      level="H"
                    />
                  </div>
                </div>

                <p className="mesas__qr-url">{urlDaMesa(mesaSelecionadaQr.numero)}</p>
              </div>

              <div className="mesas__modal-acoes">
                <button className="mesas__btn-cancelar" onClick={() => setMesaSelecionadaQr(null)}>
                  Fechar
                </button>
                <button className="mesas__btn-imprimir" onClick={handleImprimir}>
                  <HiPrinter /> Imprimir
                </button>
                <button className="mesas__btn-salvar" onClick={handleDownload}>
                  <HiDownload /> Baixar PNG
                </button>
              </div>
            </div>
          </div>
        )}

      </div>
    </RestaurantLayout>
  );
};

export default GerenPagamentos;