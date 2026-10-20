import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
  HiOutlinePencil,
} from 'react-icons/hi';
import { MdQrCode2 } from 'react-icons/md';
import RestaurantLayout from '../../../../shared/components/layout/Restaurantelayout';
import ComandaCozinha from '../../../../shared/components/ComandaCozinha/ComandaCozinha';
import CancelarPedido from '../../../../shared/components/cancelarPedido/CancelarPedido';
import QrCodeMesa from '../../../../shared/components/QrCodeMesas/QrCodeMesa';
import MesaService, { Mesa as MesaApi } from '../../../../services/mesa.service';
import PedidoService, { Pedido as PedidoApi } from '../../../../services/pedido.service';
import { mensagemDeErro } from '../../../../services/cliente.service';
import { ROTAS_CAIXA } from '../../../../routes/caixaRotas';
import { useAuth } from '../../../../shared/contexts/Authcontext';
import { pedidosParaComanda } from '../../../../shared/components/ComandaCozinha/comanda.adapter';
import type { PedidoParaComanda } from '../../../../shared/components/ComandaCozinha/comanda';
import ProdutoService from '../../../../services/produto.service';
import './GerenPagamentos.css';

// ── Tipos ──────────────────────────────────────────────────────────────────────
type StatusMesaCaixa = 'aberta' | 'fechada' | 'livre' | 'reservada';
type StatusInicialMesa = 'livre' | 'reservada';
type FiltroMesas = 'todas' | 'abertas' | 'livres' | 'reservadas';
type ModoVisualizacao = 'grade' | 'lista';

interface MesaCaixa {
  id: string;
  numero: number;
  // Preenchidos quando a mesa é cadastrada pelo modal
  capacidade?: number;
  observacao?: string;
  /** qr_code_token da mesa: é o que o QR Code/link usa para abrir a WelcomePage dela */
  qrToken?: string;
  // Preenchidos quando há pedido em andamento
  pessoas?: number;
  itens?: number;
  total?: number;
  /** Quanto já foi pago da conta (pagamento parcial). Se > 0, não dá para cancelar. */
  pagamentosRealizados?: number;
  tempoMinutos?: number;
  /** Pedidos em andamento (RECEBIDO, PREPARO, PRONTO) desta mesa, vindos da API */
  pedidos?: PedidoApi[];
  /** Nomes dos clientes cadastrados na mesa (sem repetir) */
  clientes?: string[];
  status: StatusMesaCaixa;
}

type ErrosCadastro = Partial<Record<'numero' | 'capacidade' | 'observacao', string>>;

// ── Constantes ─────────────────────────────────────────────────────────────────
// Os limites finais são conferidos de novo no backend (Mesa.schema.ts).
const NUMERO_MAX = 9999;
const CAPACIDADE_MIN = 1;
const CAPACIDADE_MAX = 20;
const OBSERVACAO_MAX = 80; // vai para a coluna `localizacao` (máx. 100 no banco)

// Converte a mesa da API (+ seus pedidos em andamento) para o formato da tela do Caixa.
// Mesa com pedido em andamento aparece como "aberta", com itens, total e tempo reais.
const STATUS_EM_ANDAMENTO: PedidoApi['status'][] = ['RECEBIDO', 'PREPARO', 'PRONTO'];

// Clientes da mesa = nomes diferentes nos pedidos em andamento (ignora maiúsculas e espaços a mais)
const clientesDaMesa = (pedidos: PedidoApi[]): string[] => {
  const vistos = new Map<string, string>();
  pedidos.forEach((p) => {
    const nome = p.cliente_nome.trim().replace(/\s+/g, ' ');
    const chave = nome.toLowerCase();
    if (nome && !vistos.has(chave)) vistos.set(chave, nome);
  });
  return Array.from(vistos.values());
};

const rotuloClientes = (n: number) => `${n} ${n === 1 ? 'cliente' : 'clientes'}`;

const daApi = (m: MesaApi, pedidos: PedidoApi[] = []): MesaCaixa => {
  const clientes = clientesDaMesa(pedidos);
  const aberta = pedidos.length > 0 || m.status === 'OCUPADA';
  const maisAntigo = pedidos.length
    ? Math.min(...pedidos.map((p) => new Date(p.criado_em).getTime()))
    : undefined;

  return {
    id: m.id,
    numero: m.numero,
    capacidade: m.capacidade,
    observacao: m.localizacao ?? undefined,
    qrToken: m.qr_code_token,
    pedidos,
    clientes,
    pessoas: clientes.length > 0 ? clientes.length : undefined,
    status: aberta ? 'aberta' : m.status === 'RESERVADA' ? 'reservada' : 'livre',
    ...(pedidos.length > 0 && {
      itens: pedidos.reduce((acc, p) => acc + p.itens.reduce((q, i) => q + i.quantidade, 0), 0),
      total: pedidos.reduce((acc, p) => acc + p.total, 0),
      tempoMinutos: Math.max(0, Math.floor((Date.now() - (maisAntigo as number)) / 60000)),
    }),
  };
};

const ordenar = (lista: MesaCaixa[]) => [...lista].sort((a, b) => a.numero - b.numero);

const formatarMoeda = (valor: number) =>
  valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

// ── Componente ─────────────────────────────────────────────────────────────────
const GerenPagamentos: React.FC = () => {
  const navigate = useNavigate();

  const { usuario } = useAuth();
  // Só o administrador pode cadastrar mesa (regra do backend: POST /mesas)
  const podeCadastrar = usuario?.perfil === 'ADMIN';

  // Mesas reais, vindas do banco
  const [mesas, setMesas]           = useState<MesaCaixa[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erroLista, setErroLista]   = useState<string | null>(null);

  const [filtro, setFiltro]             = useState<FiltroMesas>('todas');
  const [visualizacao, setVisualizacao] = useState<ModoVisualizacao>('grade');

  // id da mesa com o menu de ações (⋮) aberto — null = nenhum menu aberto
  const [menuAberto, setMenuAberto] = useState<string | null>(null);

  // mesa cuja comanda da cozinha está aberta — null = modal fechado
  const [comandaMesa, setComandaMesa] = useState<MesaCaixa | null>(null);
  const [comandaPedido, setComandaPedido] = useState<PedidoParaComanda | null>(null);
  const [comandaCarregando, setComandaCarregando] = useState(false);
  const [comandaErro, setComandaErro] = useState<string | null>(null);
  // Identifica a busca mais recente: ignora respostas antigas se o usuário fechar/trocar de mesa
  const comandaReq = useRef(0);

  // mesa que está sendo cancelada — null = modal fechado
  const [cancelarMesa, setCancelarMesa] = useState<MesaCaixa | null>(null);

  // mesa cujo QR Code está aberto — null = modal fechado
  const [qrMesa, setQrMesa] = useState<MesaCaixa | null>(null);

  // id da mesa cujo status (livre ↔ reservada) está sendo alterado — evita duplo clique
  const [alternandoId, setAlternandoId] = useState<string | null>(null);
  const [erroAcao, setErroAcao] = useState<string | null>(null);

  // ── Modal: Cadastrar mesa ────────────────────────────────────────────────────
  const [modalAberto, setModalAberto]   = useState(false);
  const [numero, setNumero]             = useState('');
  const [capacidade, setCapacidade]     = useState('4');
  const [statusInicial, setStatusInicial] = useState<StatusInicialMesa>('livre');
  const [observacao, setObservacao]     = useState('');
  const [erros, setErros]               = useState<ErrosCadastro>({});
  const [salvando, setSalvando]         = useState(false);
  const [erroApi, setErroApi]           = useState<string | null>(null);

  // Sugestão de número para a próxima mesa (maior número existente + 1)
  const proximoNumero = useMemo(
    () => (mesas.length > 0 ? Math.max(...mesas.map((m) => m.numero)) + 1 : 1),
    [mesas]
  );

  // ── Contagens usadas nos filtros e no chip "Pedidos em aberto" ──────────────
  const totalAbertas  = useMemo(() => mesas.filter((m) => m.status === 'aberta').length, [mesas]);
  const totalLivres     = useMemo(() => mesas.filter((m) => m.status === 'livre').length, [mesas]);
  const totalReservadas = useMemo(() => mesas.filter((m) => m.status === 'reservada').length, [mesas]);

  // ── Aplica o filtro selecionado ──────────────────────────────────────────────
  const mesasFiltradas = useMemo(() => {
    if (filtro === 'abertas')  return mesas.filter((m) => m.status === 'aberta');
    if (filtro === 'livres')     return mesas.filter((m) => m.status === 'livre');
    if (filtro === 'reservadas') return mesas.filter((m) => m.status === 'reservada');
    return mesas;
  }, [filtro, mesas]);

  // ── Lista as mesas cadastradas ───────────────────────────────────────────────
  const carregarMesas = useCallback(async () => {
    setCarregando(true);
    setErroLista(null);
    try {
      const [lista, pedidosAbertos] = await Promise.all([
        MesaService.listar(),
        PedidoService.listar({ status: STATUS_EM_ANDAMENTO, modalidade: 'MESA' }),
      ]);

      // Agrupa os pedidos em andamento por mesa
      const porMesa = new Map<string, PedidoApi[]>();
      pedidosAbertos.forEach((p) => {
        if (!p.mesa) return;
        porMesa.set(p.mesa.id, [...(porMesa.get(p.mesa.id) ?? []), p]);
      });

      setMesas(ordenar(lista.map((m) => daApi(m, porMesa.get(m.id) ?? []))));
    } catch (err: any) {
      setErroLista(mensagemDeErro(err, 'Não foi possível carregar as mesas.'));
    } finally {
      setCarregando(false);
    }
  }, []);

  useEffect(() => {
    void carregarMesas();
  }, [carregarMesas]);

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
    setErroApi(null);
    setMenuAberto(null);
    setModalAberto(true);
  };

  const fecharModal = () => {
    if (salvando) return;
    setModalAberto(false);
  };

  const validarCadastro = (): ErrosCadastro => {
    const novos: ErrosCadastro = {};

    const n = Number(numero);
    if (!numero.trim() || !Number.isInteger(n) || n < 1 || n > NUMERO_MAX) {
      novos.numero = `Informe um número inteiro de 1 a ${NUMERO_MAX}.`;
    } else if (mesas.some((m) => m.numero === n)) {
      novos.numero = `A Mesa ${n} já está cadastrada.`;
    }

    const c = Number(capacidade);
    if (!capacidade.trim() || !Number.isInteger(c) || c < CAPACIDADE_MIN || c > CAPACIDADE_MAX) {
      novos.capacidade = `A capacidade deve ser de ${CAPACIDADE_MIN} a ${CAPACIDADE_MAX} pessoas.`;
    }

    if (observacao.trim().length > OBSERVACAO_MAX) {
      novos.observacao = `Use no máximo ${OBSERVACAO_MAX} caracteres.`;
    }

    return novos;
  };

  const handleCadastrarMesa = async () => {
    if (salvando) return; // evita duplo clique criar duas vezes

    const novos = validarCadastro();
    setErros(novos);
    setErroApi(null);
    if (Object.keys(novos).length > 0) return;

    setSalvando(true);
    try {
      const criada = await MesaService.criar({
        numero: Number(numero),
        capacidade: Number(capacidade),
        localizacao: observacao.trim() || undefined,
        status: statusInicial === 'reservada' ? 'RESERVADA' : 'LIVRE',
      });

      // Mantém a lista ordenada pelo número da mesa
      setMesas((prev) => ordenar([...prev, daApi(criada)]));
      setModalAberto(false);
    } catch (err: any) {
      const mensagem = mensagemDeErro(err, 'Não foi possível cadastrar a mesa.');
      if (err?.response?.status === 409) {
        // Número já existe (inclusive mesa inativa): mostra no próprio campo
        setErros({ numero: mensagem });
      } else {
        setErroApi(mensagem);
      }
    } finally {
      setSalvando(false);
    }
  };

  // ── Navegação ────────────────────────────────────────────────────────────────
  // Mesa com pedido em andamento (aberta/fechada) abre a tela da mesa ao clicar no card.
  const temPedido = (mesa: MesaCaixa) => mesa.status === 'aberta' || mesa.status === 'fechada';

  // Abre a tela da mesa (/restaurante/caixa/pagar/:id) — pedidos, itens, desconto e pagamento.
  const abrirDetalheMesa = (mesa: MesaCaixa) => {
    setMenuAberto(null);
    navigate(ROTAS_CAIXA.pagarMesa(mesa.id));
  };

  // Abre a tela de pedido já com a mesa escolhida (mesa livre, reservada ou já aberta)
  const novoPedido = (mesa: MesaCaixa) => {
    setMenuAberto(null);
    navigate(`/restaurante/pedido?mesa=${mesa.id}`);
  };

  const abrirMesaLivre = (mesa: MesaCaixa, e: React.MouseEvent) => {
    e.stopPropagation();
    novoPedido(mesa);
  };

  // Abre a tela de pedido com os dados do pedido já preenchidos
  const editarPedido = (pedidoId: string) => {
    setMenuAberto(null);
    navigate(`/restaurante/pedido?editar=${pedidoId}`);
  };

  // Menu ⋮ → "Editar pedido": com um pedido só vai direto para a edição;
  // com vários, abre a tela da mesa, onde cada pedido tem o seu botão "Editar".
  const handleEditarDoMenu = (mesa: MesaCaixa, e: React.MouseEvent) => {
    e.stopPropagation();
    const pedidos = mesa.pedidos ?? [];
    if (pedidos.length === 1) {
      editarPedido(pedidos[0].id);
    } else {
      abrirDetalheMesa(mesa);
    }
  };

  // Alterna a mesa entre Livre (liberada) e Reservada
  const alternarReserva = async (mesa: MesaCaixa, e: React.MouseEvent) => {
    e.stopPropagation();
    if (alternandoId) return; // evita duplo clique

    const novoStatus = mesa.status === 'reservada' ? 'LIVRE' : 'RESERVADA';
    setAlternandoId(mesa.id);
    setErroAcao(null);
    try {
      const atualizada = await MesaService.atualizarStatus(mesa.id, novoStatus);
      setMesas((prev) => prev.map((m) => (m.id === mesa.id ? daApi(atualizada, m.pedidos ?? []) : m)));
    } catch (err: any) {
      setErroAcao(mensagemDeErro(err, 'Não foi possível alterar o status da mesa.'));
    } finally {
      setAlternandoId(null);
    }
  };

  const toggleMenu = (mesaId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setMenuAberto((atual) => (atual === mesaId ? null : mesaId));
  };

  const handleAcaoMenu = (mesa: MesaCaixa, e: React.MouseEvent) => {
    e.stopPropagation();
    abrirDetalheMesa(mesa);
  };

  // Busca os pedidos da mesa direto na API (dados frescos, com atendente) e as categorias
  // dos produtos, e monta a comanda. Não guarda nada: é recalculada a cada abertura.
  const carregarComanda = useCallback(async (mesa: MesaCaixa) => {
    const req = ++comandaReq.current;
    setComandaPedido(null);
    setComandaErro(null);

    const ids = (mesa.pedidos ?? []).map((p) => p.id);
    if (ids.length === 0) {
      setComandaErro('Esta mesa não tem pedidos em andamento.');
      return;
    }

    setComandaCarregando(true);
    try {
      const [pedidos, produtos] = await Promise.all([
        Promise.all(ids.map((id) => PedidoService.buscarPorId(id))),
        ProdutoService.listar(),
      ]);
      if (req !== comandaReq.current) return;

      const categoriaPorProduto: Record<string, string> = {};
      produtos.forEach((p) => {
        if (p.categoria?.nome) categoriaPorProduto[p.id] = p.categoria.nome;
      });

      // Outro usuário pode ter finalizado/cancelado um pedido desde que a lista foi carregada
      const emAndamento = pedidos.filter((p) => STATUS_EM_ANDAMENTO.includes(p.status));
      const comanda = pedidosParaComanda({
        mesaNumero: mesa.numero,
        pedidos: emAndamento,
        categoriaPorProduto,
      });

      if (comanda) setComandaPedido(comanda);
      else setComandaErro('Esta mesa não tem mais pedidos em andamento. Atualize a tela do Caixa.');
    } catch (err: any) {
      if (req !== comandaReq.current) return;
      setComandaErro(mensagemDeErro(err, 'Não foi possível carregar a comanda da cozinha.'));
    } finally {
      if (req === comandaReq.current) setComandaCarregando(false);
    }
  }, []);

  const abrirComanda = (mesa: MesaCaixa, e: React.MouseEvent) => {
    e.stopPropagation();
    setMenuAberto(null);
    setComandaMesa(mesa);
    void carregarComanda(mesa);
  };

  const fecharComanda = useCallback(() => {
    comandaReq.current++; // descarta qualquer busca em andamento
    setComandaMesa(null);
    setComandaPedido(null);
    setComandaErro(null);
    setComandaCarregando(false);
  }, []);

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
          ? { id: m.id, numero: m.numero, capacidade: m.capacidade, observacao: m.observacao, qrToken: m.qrToken, status: 'livre' }
          : m
      )
    );
    setCancelarMesa(null);
  };

  const mensagemVazio =
    filtro === 'abertas'    ? 'Nenhuma mesa aberta no momento.'     :
    filtro === 'livres'     ? 'Nenhuma mesa livre no momento.'      :
    filtro === 'reservadas' ? 'Nenhuma mesa reservada no momento.'  :
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

            {/* Abre o modal de cadastro de mesa (só administrador) */}
            {podeCadastrar && (
              <button
                className="caixa__btn-cadastrar"
                onClick={(e) => { e.stopPropagation(); abrirModal(); }}
                aria-label="Cadastrar nova mesa"
                disabled={carregando}
              >
                <HiPlus /> Cadastrar mesa
              </button>
            )}
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
                Abertas / Ocupadas ({totalAbertas})
              </button>
              <button
                role="tab"
                aria-selected={filtro === 'livres'}
                className={`caixa__aba${filtro === 'livres' ? ' caixa__aba--ativa' : ''}`}
                onClick={() => setFiltro('livres')}
              >
                Livres ({totalLivres})
              </button>
              <button
                role="tab"
                aria-selected={filtro === 'reservadas'}
                className={`caixa__aba${filtro === 'reservadas' ? ' caixa__aba--ativa' : ''}`}
                onClick={() => setFiltro('reservadas')}
              >
                Reservadas ({totalReservadas})
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

          {erroAcao && (
            <div className="caixa__vazio" role="alert">{erroAcao}</div>
          )}

          {/* ── Grid de cards ── */}
          {carregando ? (
            <div className="caixa__vazio">Carregando mesas...</div>
          ) : erroLista ? (
            <div className="caixa__vazio" role="alert">
              {erroLista}{' '}
              <button className="caixa__btn-cancelar" onClick={() => void carregarMesas()}>
                Tentar de novo
              </button>
            </div>
          ) : mesasFiltradas.length === 0 ? (
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
                        ? `Ver detalhes da Mesa ${mesa.numero}`
                        : `Mesa ${mesa.numero} ${mesa.status}`
                    }
                  >
                    <div className="caixa__card-topo">
                      <span className="caixa__card-nome">Mesa {String(mesa.numero).padStart(2, '0')}</span>

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
                              <button
                                className="caixa__card-menu-item"
                                onClick={(e) => { e.stopPropagation(); novoPedido(mesa); }}
                              >
                                <HiPlus /> {clicavel ? 'Adicionar pedido' : 'Abrir mesa'}
                              </button>
                              {clicavel && (
                                <button className="caixa__card-menu-item" onClick={(e) => handleEditarDoMenu(mesa, e)}>
                                  <HiOutlinePencil /> Editar pedido
                                </button>
                              )}
                              {clicavel && (
                                <button className="caixa__card-menu-item" onClick={(e) => abrirComanda(mesa, e)}>
                                  <HiOutlineClipboardList /> Comanda da cozinha
                                </button>
                              )}
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

                        {/* Alterna entre Livre (liberada) e Reservada */}
                        <button
                          className="caixa__card-btn-alternar"
                          onClick={(e) => void alternarReserva(mesa, e)}
                          disabled={alternandoId === mesa.id}
                        >
                          {alternandoId === mesa.id
                            ? 'Alterando...'
                            : mesa.status === 'reservada'
                              ? 'Liberar mesa'
                              : 'Reservar mesa'}
                        </button>
                      </>
                    ) : (
                      /* Mesa com pedido: aberta ou fechada */
                      <>
                        <span className="caixa__card-pessoas">
                          <HiUserGroup />{' '}
                          {mesa.pessoas !== undefined
                            ? rotuloClientes(mesa.pessoas)
                            : `${mesa.capacidade ?? '—'} lugares`}
                        </span>

                        <div className="caixa__card-linha">
                          <span className="caixa__card-itens">{mesa.itens ?? 0} itens</span>
                          <span className="caixa__card-total">{formatarMoeda(mesa.total ?? 0)}</span>
                        </div>

                        <div className="caixa__card-linha">
                          <span className={`caixa__badge caixa__badge--${mesa.status}`}>
                            {mesa.status === 'aberta' ? 'Aberta' : 'Fechada'}
                          </span>
                          {mesa.status === 'aberta' && (
                            <span className="caixa__card-tempo">
                              <HiClock /> {mesa.tempoMinutos ?? '—'} min
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
                      max={NUMERO_MAX}
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

              {erroApi && (
                <span className="caixa__erro" role="alert" style={{ padding: '0 24px' }}>{erroApi}</span>
              )}

              <div className="caixa__modal-acoes">
                <button className="caixa__btn-cancelar" onClick={fecharModal} disabled={salvando}>
                  Cancelar
                </button>
                <button className="caixa__btn-salvar" onClick={handleCadastrarMesa} disabled={salvando}>
                  <HiPlus /> {salvando ? 'Cadastrando...' : 'Cadastrar mesa'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ── Modal: Comanda da cozinha (gerada a partir do pedido da mesa) ── */}
        <ComandaCozinha
          aberta={comandaMesa !== null}
          pedido={comandaPedido}
          mesaNumero={comandaMesa?.numero}
          carregando={comandaCarregando}
          erro={comandaErro}
          onTentarNovamente={comandaMesa ? () => void carregarComanda(comandaMesa) : undefined}
          onFechar={fecharComanda}
        />

        {/* ── Modal: QR Code da mesa ── */}
        <QrCodeMesa
          mesa={qrMesa ? { numero: qrMesa.numero, capacidade: qrMesa.capacidade, token: qrMesa.qrToken } : null}
          onFechar={() => setQrMesa(null)}
        />

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