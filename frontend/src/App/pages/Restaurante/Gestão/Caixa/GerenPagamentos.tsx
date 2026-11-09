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
  HiOutlineCalendar,
} from 'react-icons/hi';
import { MdQrCode2 } from 'react-icons/md';
import RestaurantLayout from '../../../../shared/components/layout/Restaurantelayout';
import ComandaCozinha from '../../../../shared/components/ComandaCozinha/ComandaCozinha';
import CancelarPedido from '../../../../shared/components/cancelarPedido/CancelarPedido';
import QrCodeMesa from '../../../../shared/components/QrCodeMesas/QrCodeMesa';
import MesaService, { Mesa as MesaApi } from '../../../../services/mesa.service';
import PedidoService, { Pedido as PedidoApi } from '../../../../services/pedido.service';
import { mensagemDeErro } from '../../../../services/cliente.service';
import {
  ReservaRestauranteService,
  Reserva as ReservaApi,
  ReservaAgrupada,
  agruparReservas,
  STATUS_RESERVA_ATIVA,
  horaDaIso,
  horaParaMinutos,
  hojeLocal,
  somarDias,
  rotuloDia,
  dataDaReserva,
  detectarConflitos,
  MARGEM_ENTRE_RESERVAS_MIN,
} from '../../../../services/reserva.service';
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
  /** Reserva (pendente/confirmada) que está segurando a mesa agora — vem da tela de reservas do cliente */
  reservaAtual?: ReservaApi;
  /** Próxima reserva do dia ainda não encerrada (mesa livre agora, mas com horário marcado) */
  proximaReserva?: ReservaApi;
  /** true quando a mesa foi marcada como "Reservada" à mão (botão Reservar mesa) */
  reservadaManual?: boolean;
  /** Andamento dos pedidos na cozinha (vem da Fila): quantos pedidos em cada etapa */
  cozinha?: { recebido: number; preparo: number; pronto: number; entregue: number };
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
// A conta aberta da mesa também inclui o que já foi entregue e ainda não foi pago
const STATUS_NA_CONTA: PedidoApi['status'][] = [...STATUS_EM_ANDAMENTO, 'ENTREGUE'];

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
  const contar = (s: PedidoApi['status']) => pedidos.filter((p) => p.status === s).length;
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
      cozinha: {
        recebido: contar('RECEBIDO'),
        preparo: contar('PREPARO'),
        pronto: contar('PRONTO'),
        entregue: contar('ENTREGUE'),
      },
      itens: pedidos.reduce((acc, p) => acc + p.itens.reduce((q, i) => q + i.quantidade, 0), 0),
      total: pedidos.reduce((acc, p) => acc + p.total, 0),
      // Pagamento já confirmado: impede o cancelamento (precisaria de estorno)
      pagamentosRealizados: pedidos.reduce(
        (acc, p) => acc + (p.pagamento?.status === 'CONFIRMADO' ? p.pagamento.valor ?? p.total : 0),
        0
      ),
      tempoMinutos: Math.max(0, Math.floor((Date.now() - (maisAntigo as number)) / 60000)),
    }),
  };
};

// A mesa aparece como "Reservada" no Caixa desde este tempo ANTES do horário da reserva até o fim dela.
// Antes disso ela ainda pode atender quem chegar sem reserva (só mostra o chip "Reserva às HH:MM").
const ANTECEDENCIA_RESERVA_MIN = 30;

const minutosAgora = (agora: number): number => {
  const d = new Date(agora);
  return d.getHours() * 60 + d.getMinutes();
};

/**
 * Cruza as mesas com as reservas de HOJE (pendentes/confirmadas) feitas pelos clientes.
 * É o que liga a tela "Reserva de mesas" do cliente ao Caixa: a mesa reservada sai da conta de
 * "disponíveis" e o restaurante vê quem vem, que horas e quantas pessoas.
 * Mesa já aberta (com pedido) continua "aberta", mesmo que tenha reserva.
 */
const aplicarReservas = (mesa: MesaCaixa, reservas: ReservaApi[], agora: number): MesaCaixa => {
  const min = minutosAgora(agora);
  const hoje = hojeLocal(agora);
  const daMesa = reservas
    .filter((r) => dataDaReserva(r) === hoje)
    .filter((r) => r.mesa_id === mesa.id && STATUS_RESERVA_ATIVA.includes(r.status))
    .filter((r) => horaParaMinutos(horaDaIso(r.hora_fim)) > min)
    .sort((a, b) => horaDaIso(a.hora_inicio).localeCompare(horaDaIso(b.hora_inicio)));

  const reservaAtual = daMesa.find(
    (r) => horaParaMinutos(horaDaIso(r.hora_inicio)) - ANTECEDENCIA_RESERVA_MIN <= min
  );
  const proximaReserva = reservaAtual ? undefined : daMesa[0];

  return {
    ...mesa,
    reservadaManual: mesa.status === 'reservada',
    ...(reservaAtual && { reservaAtual }),
    ...(proximaReserva && { proximaReserva }),
    status: mesa.status === 'livre' && reservaAtual ? 'reservada' : mesa.status,
  };
};

// Cliente que marcou "não sei ainda": mostra só o início (o fim gravado é o tempo que a mesa fica segura)
const faixaReserva = (r: ReservaApi) =>
  r.duracao_indefinida
    ? `${horaDaIso(r.hora_inicio)} (duração a definir)`
    : `${horaDaIso(r.hora_inicio)}–${horaDaIso(r.hora_fim)}`;

// Dias à frente que o Caixa mostra na lista de reservas
const DIAS_RESERVAS_A_FRENTE = 7;

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

  // Reservas dos próximos dias (feitas pelos clientes no app) e "agora" para decidir quais mesas estão seguras
  const [reservas, setReservas]     = useState<ReservaApi[]>([]);
  const [erroReservas, setErroReservas]     = useState<string | null>(null);
  const [agora, setAgora]                   = useState(() => Date.now());
  const [reservaAgindoId, setReservaAgindoId] = useState<string | null>(null);
  // Janela de decisão: aceitar/recusar (com recado opcional) ou só mandar mensagem ao cliente
  const [decisao, setDecisao] = useState<{
    grupo: ReservaAgrupada;
    acao: 'CONFIRMADA' | 'CANCELADA' | 'MENSAGEM';
  } | null>(null);
  const [textoDecisao, setTextoDecisao] = useState('');
  // Modal "Reservar mesa" do Caixa: dia, horário e descrição (opcional)
  const [reservandoMesa, setReservandoMesa] = useState<MesaCaixa | null>(null);
  const [resDia, setResDia] = useState('');
  const [resHora, setResHora] = useState('');
  const [resDescricao, setResDescricao] = useState('');
  const [resErro, setResErro] = useState('');
  const [resEnviando, setResEnviando] = useState(false);
  // Cancelamentos feitos pelo cliente que o Caixa já viu (guardado só neste navegador)
  const [cancelamentosVistos, setCancelamentosVistos] = useState<string[]>(() => {
    try {
      return JSON.parse(localStorage.getItem('@menupoint:caixa_cancelamentos_vistos') ?? '[]');
    } catch {
      return [];
    }
  });
  // Última atualização das mesas/reservas (automática ou pelo botão Atualizar)
  const [atualizadoEm, setAtualizadoEm]     = useState<number | null>(null);
  const [atualizando, setAtualizando]       = useState(false);

  const [filtro, setFiltro]             = useState<FiltroMesas>('todas');
  const [visualizacao, setVisualizacao] = useState<ModoVisualizacao>('grade');

  // O modo lista só existe no desktop (> 768px). No celular/tablet sempre mostra a grade,
  // mesmo que a lista tenha sido escolhida antes de reduzir a janela.
  const [ehDesktop, setEhDesktop] = useState(() => window.matchMedia('(min-width: 769px)').matches);
  useEffect(() => {
    const mq = window.matchMedia('(min-width: 769px)');
    const atualizar = () => setEhDesktop(mq.matches);
    mq.addEventListener('change', atualizar);
    return () => mq.removeEventListener('change', atualizar);
  }, []);
  const modoExibido: ModoVisualizacao = ehDesktop ? visualizacao : 'grade';

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
  const [cancelando, setCancelando] = useState(false);
  const [cancelarErro, setCancelarErro] = useState<string | null>(null);

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

  // Mesas já cruzadas com as reservas de hoje (é isto que a tela mostra e conta)
  const mesasView = useMemo(
    () => mesas.map((m) => aplicarReservas(m, reservas, agora)),
    [mesas, reservas, agora]
  );

  // Reservas que ainda seguram mesa (hoje ainda não encerradas + próximos dias), por data e horário
  const reservasAtivasHoje = useMemo(() => {
    const hoje = hojeLocal(agora);
    return reservas
      .filter((r) => STATUS_RESERVA_ATIVA.includes(r.status))
      .filter((r) => {
        const dia = dataDaReserva(r);
        return dia > hoje || (dia === hoje && horaParaMinutos(horaDaIso(r.hora_fim)) > minutosAgora(agora));
      })
      .sort((a, b) =>
        (dataDaReserva(a) + horaDaIso(a.hora_inicio)).localeCompare(dataDaReserva(b) + horaDaIso(b.hora_inicio))
      );
  }, [reservas, agora]);

  // Reservas da mesma mesa que se sobrepõem ou ficam a menos de 30 min uma da outra (alerta do Caixa)
  const conflitos = useMemo(() => detectarConflitos(reservasAtivasHoje), [reservasAtivasHoje]);
  const idsEmConflito = useMemo(
    () => new Set(conflitos.flatMap((c) => [c.a.id, c.b.id])),
    [conflitos]
  );

  // Reservas "lógicas": as linhas das mesas de um mesmo pedido (grupo grande) viram uma só
  const gruposAtivos = useMemo(() => agruparReservas(reservasAtivasHoje), [reservasAtivasHoje]);

  // Pedidos em que faltam assentos: o restaurante decide se aceita (cadeiras extras) ou recusa
  const gruposSemAssentos = useMemo(
    () => gruposAtivos.filter((g) => g.falta > 0 && g.base.status === 'PENDENTE'),
    [gruposAtivos]
  );

  // Cliente cancelou pelo app (últimas 24h): o Caixa é avisado até apertar OK
  const cancelamentosDoCliente = useMemo(
    () =>
      agruparReservas(
        reservas.filter(
          (r) =>
            r.status === 'CANCELADA' &&
            r.cancelada_por === 'CLIENTE' &&
            r.cliente_id &&
            Date.now() - new Date(r.atualizado_em ?? 0).getTime() < 24 * 60 * 60 * 1000
        )
      ).filter((g) => !cancelamentosVistos.includes(`${g.base.grupo_id ?? g.base.id}:${g.base.atualizado_em}`)),
    [reservas, cancelamentosVistos]
  );

  const dispensarCancelamento = (g: ReservaAgrupada) => {
    const novos = [...cancelamentosVistos, `${g.base.grupo_id ?? g.base.id}:${g.base.atualizado_em}`].slice(-200);
    setCancelamentosVistos(novos);
    try {
      localStorage.setItem('@menupoint:caixa_cancelamentos_vistos', JSON.stringify(novos));
    } catch {
      /* sem armazenamento: o aviso só volta ao recarregar */
    }
  };

  const totalReservasHoje = useMemo(
    () => gruposAtivos.filter((g) => dataDaReserva(g.base) === hojeLocal(agora)).length,
    [gruposAtivos, agora]
  );

  // ── Contagens usadas nos filtros, no resumo de disponibilidade e no chip "Pedidos em aberto" ──
  const totalAbertas  = useMemo(() => mesasView.filter((m) => m.status === 'aberta').length, [mesasView]);
  const totalLivres     = useMemo(() => mesasView.filter((m) => m.status === 'livre').length, [mesasView]);
  const totalReservadas = useMemo(() => mesasView.filter((m) => m.status === 'reservada').length, [mesasView]);

  // ── Aplica o filtro selecionado ──────────────────────────────────────────────
  const mesasFiltradas = useMemo(() => {
    if (filtro === 'abertas')  return mesasView.filter((m) => m.status === 'aberta');
    if (filtro === 'livres')     return mesasView.filter((m) => m.status === 'livre');
    if (filtro === 'reservadas') return mesasView.filter((m) => m.status === 'reservada');
    return mesasView;
  }, [filtro, mesasView]);

  // ── Lista as mesas cadastradas ───────────────────────────────────────────────
  // `silencioso`: atualização automática em segundo plano (sem piscar a tela nem trocar a lista por erro)
  const carregarMesas = useCallback(async (silencioso = false) => {
    if (!silencioso) {
      setCarregando(true);
      setErroLista(null);
    }
    try {
      const [lista, pedidosAbertos, reservas] = await Promise.all([
        MesaService.listar(),
        PedidoService.listar({ status: STATUS_NA_CONTA, modalidade: 'MESA', conta_aberta: true }),
        // Reservas não derrubam o Caixa: se falharem, as mesas continuam funcionando e avisamos na tela
        ReservaRestauranteService.listarPeriodo(hojeLocal(), somarDias(hojeLocal(), DIAS_RESERVAS_A_FRENTE)).then(
          (r) => ({ ok: true as const, r }),
          (err) => ({ ok: false as const, err })
        ),
      ]);

      if (reservas.ok) {
        setReservas(reservas.r);
        setErroReservas(null);
      } else {
        setErroReservas(mensagemDeErro(reservas.err, 'Não foi possível carregar as reservas de hoje.'));
      }
      setAgora(Date.now());
      setAtualizadoEm(Date.now());

      // Agrupa os pedidos em andamento por mesa
      const porMesa = new Map<string, PedidoApi[]>();
      pedidosAbertos.forEach((p) => {
        if (!p.mesa) return;
        porMesa.set(p.mesa.id, [...(porMesa.get(p.mesa.id) ?? []), p]);
      });

      setMesas(ordenar(lista.map((m) => daApi(m, porMesa.get(m.id) ?? []))));
    } catch (err: any) {
      if (!silencioso) setErroLista(mensagemDeErro(err, 'Não foi possível carregar as mesas.'));
    } finally {
      if (!silencioso) setCarregando(false);
    }
  }, []);

  useEffect(() => {
    void carregarMesas();
  }, [carregarMesas]);

  // A Fila da cozinha muda o status dos pedidos e os clientes fazem/cancelam reservas pelo app:
  // o Caixa se atualiza sozinho (a cada 15s e ao voltar para a aba), exceto com algum modal aberto
  // (para não atrapalhar quem está operando)
  useEffect(() => {
    const atualizar = () => {
      if (document.hidden || modalAberto || comandaMesa || qrMesa || cancelarMesa || decisao || reservandoMesa) return;
      void carregarMesas(true);
    };
    const timer = window.setInterval(atualizar, 15000);
    document.addEventListener('visibilitychange', atualizar);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener('visibilitychange', atualizar);
    };
  }, [carregarMesas, modalAberto, comandaMesa, qrMesa, cancelarMesa, decisao, reservandoMesa]);

  // Botão Atualizar: recarrega mesas, pedidos e reservas na hora
  const atualizarAgora = async () => {
    if (atualizando) return;
    setAtualizando(true);
    try {
      await carregarMesas(true);
    } finally {
      setAtualizando(false);
    }
  };

  // Atualiza o "agora" a cada 30s: a mesa passa a "Reservada" (ou volta a "Livre") sem recarregar a tela
  useEffect(() => {
    const timer = window.setInterval(() => setAgora(Date.now()), 30000);
    return () => window.clearInterval(timer);
  }, []);

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

  // "Reservar mesa": abre o modal para escolher dia, horário e descrição
  const abrirReservarMesa = (mesa: MesaCaixa, e: React.MouseEvent) => {
    e.stopPropagation();
    const d = new Date(agora);
    d.setMinutes(0, 0, 0);
    d.setHours(d.getHours() + 1);
    setResDia(hojeLocal(d.getTime()));
    setResHora(`${String(d.getHours()).padStart(2, '0')}:00`);
    setResDescricao('');
    setResErro('');
    setReservandoMesa(mesa);
  };

  const enviarReservaMesa = async () => {
    if (!reservandoMesa || resEnviando) return;
    if (!resDia || !resHora) {
      setResErro('Informe o dia e o horário da reserva.');
      return;
    }
    setResEnviando(true);
    setResErro('');
    try {
      await ReservaRestauranteService.criarPeloCaixa({
        mesa_id: reservandoMesa.id,
        data_reserva: resDia,
        hora_inicio: resHora,
        ...(resDescricao.trim() && { descricao: resDescricao.trim() }),
      });
      setReservandoMesa(null);
      await carregarMesas(true);
    } catch (err: any) {
      setResErro(mensagemDeErro(err, 'Não foi possível reservar a mesa.'));
    } finally {
      setResEnviando(false);
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

  // ── Reservas feitas pelos clientes ───────────────────────────────────────────
  // Troca nas listas as linhas devolvidas pelo servidor (reserva em várias mesas = várias linhas)
  const aplicarAtualizacao = (atualizada: ReservaApi) => {
    const porId = new Map((atualizada.mesas_do_grupo ?? [atualizada]).map((l) => [l.id, l]));
    setReservas((prev) => prev.map((r) => (porId.has(r.id) ? { ...r, ...porId.get(r.id)! } : r)));
  };

  const atualizarReserva = async (
    reserva: ReservaApi,
    status: 'CONFIRMADA' | 'CONCLUIDA' | 'CANCELADA',
    mensagem?: string
  ): Promise<boolean> => {
    if (reservaAgindoId) return false; // evita duplo clique
    setReservaAgindoId(reserva.id);
    setErroAcao(null);
    try {
      const atualizada = await ReservaRestauranteService.atualizarStatus(reserva.id, status, mensagem);
      aplicarAtualizacao(atualizada);
      return true;
    } catch (err: any) {
      setErroAcao(mensagemDeErro(err, 'Não foi possível atualizar a reserva.'));
      return false;
    } finally {
      setReservaAgindoId(null);
    }
  };

  // Abre a janela de aceitar/recusar/mensagem (o recado vai por e-mail e aparece no app do cliente)
  const abrirDecisao = (grupo: ReservaAgrupada, acao: 'CONFIRMADA' | 'CANCELADA' | 'MENSAGEM') => {
    setTextoDecisao(acao === 'MENSAGEM' ? grupo.base.mensagem_restaurante ?? '' : '');
    setDecisao({ grupo, acao });
  };

  const enviarDecisao = async () => {
    if (!decisao || reservaAgindoId) return;
    const { grupo, acao } = decisao;
    const texto = textoDecisao.trim();

    if (acao === 'MENSAGEM') {
      if (!texto) return;
      setReservaAgindoId(grupo.base.id);
      setErroAcao(null);
      try {
        aplicarAtualizacao(await ReservaRestauranteService.enviarMensagem(grupo.base.id, texto));
        setDecisao(null);
      } catch (err: any) {
        setErroAcao(mensagemDeErro(err, 'Não foi possível enviar a mensagem.'));
      } finally {
        setReservaAgindoId(null);
      }
      return;
    }

    const ok = await atualizarReserva(grupo.base, acao, texto || undefined);
    if (ok) setDecisao(null);
  };

  // Cliente chegou: encerra a reserva (a mesa deixa de contar como reservada) e abre a mesa para pedido
  const clienteChegou = async (reserva: ReservaApi) => {
    const ok = await atualizarReserva(reserva, 'CONCLUIDA');
    if (ok && reserva.mesa_id) navigate(`/restaurante/pedido?mesa=${reserva.mesa_id}`);
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
    setCancelarErro(null);
    setCancelarMesa(mesa);
  };

  const fecharCancelamento = () => {
    if (cancelando) return;
    setCancelarMesa(null);
    setCancelarErro(null);
  };

  // Cancela TODOS os pedidos em andamento da mesa (POST /pedidos/mesa/:id/cancelar):
  // o backend marca os pedidos como CANCELADO com o motivo e libera a mesa, tudo numa transação.
  const confirmarCancelamento = async (motivo: string) => {
    if (!cancelarMesa || cancelando) return;
    setCancelando(true);
    setCancelarErro(null);
    try {
      await PedidoService.cancelarMesa(cancelarMesa.id, motivo);
      setCancelarMesa(null);
      await carregarMesas(); // recarrega do banco: a mesa volta como livre
    } catch (err: any) {
      setCancelarErro(mensagemDeErro(err, 'Não foi possível cancelar o pedido da mesa.'));
    } finally {
      setCancelando(false);
    }
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

            <button
              className="caixa__btn-historico caixa__btn-atualizar"
              onClick={() => void atualizarAgora()}
              disabled={atualizando || carregando}
              aria-label="Atualizar mesas e reservas"
              title={atualizadoEm ? `Atualizado às ${new Date(atualizadoEm).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}` : undefined}
            >
              ↻ {atualizando ? 'Atualizando...' : 'Atualizar'}
              {atualizadoEm && !atualizando && (
                <small className="caixa__atualizado">
                  {new Date(atualizadoEm).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                </small>
              )}
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

        {/* ── Aviso: o cliente cancelou a reserva pelo app ── */}
        {cancelamentosDoCliente.length > 0 && (
          <div className="caixa__aviso-cancelamento" role="alert">
            {cancelamentosDoCliente.map((g) => (
              <div key={g.base.grupo_id ?? g.base.id} className="caixa__aviso-cancelamento-linha">
                <span>
                  ❌ <strong>{g.base.cliente_nome}</strong> cancelou a reserva de{' '}
                  {rotuloDia(dataDaReserva(g.base), hojeLocal(agora))} às {horaDaIso(g.base.hora_inicio)} ·{' '}
                  {g.mesas.length > 1 ? 'Mesas' : 'Mesa'} {g.mesas.map((m) => String(m.numero).padStart(2, '0')).join(', ')}{' '}
                  · {g.pessoas} {g.pessoas === 1 ? 'pessoa' : 'pessoas'}. A mesa já está livre nesse horário.
                </span>
                <button className="caixa__reserva-btn" onClick={() => dispensarCancelamento(g)}>OK</button>
              </div>
            ))}
          </div>
        )}

        {/* ── ALERTA: reserva sem assentos suficientes (o restaurante decide: aceitar ou recusar) ── */}
        {gruposSemAssentos.length > 0 && (
          <div className="caixa__alerta-assentos" role="alert">
            <strong>
              🪑 {gruposSemAssentos.length === 1 ? 'Reserva' : `${gruposSemAssentos.length} reservas`} sem assentos
              suficientes — responda ao cliente
            </strong>
            <ul>
              {gruposSemAssentos.map((g) => (
                <li key={g.base.grupo_id ?? g.base.id}>
                  <span>
                    {g.base.cliente_nome} · {g.pessoas} pessoas ·{' '}
                    {rotuloDia(dataDaReserva(g.base), hojeLocal(agora))} {horaDaIso(g.base.hora_inicio)} ·{' '}
                    <b>faltam {g.falta} lugares</b> (todas as mesas livres já foram reservadas: {g.mesas.length}{' '}
                    {g.mesas.length === 1 ? 'mesa' : 'mesas'})
                  </span>
                  <span className="caixa__alerta-assentos-acoes">
                    <button
                      className="caixa__reserva-btn caixa__reserva-btn--ok"
                      onClick={() => abrirDecisao(g, 'CONFIRMADA')}
                      disabled={reservaAgindoId === g.base.id}
                    >
                      Aceitar (cadeiras extras)
                    </button>
                    <button
                      className="caixa__reserva-btn caixa__reserva-btn--perigo"
                      onClick={() => abrirDecisao(g, 'CANCELADA')}
                      disabled={reservaAgindoId === g.base.id}
                    >
                      Recusar
                    </button>
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* ── Alerta: reservas da mesma mesa batendo ou muito próximas ── */}
        {conflitos.length > 0 && (
          <div className="caixa__alerta-conflito" role="alert">
            <strong>
              ⚠ {conflitos.length} {conflitos.length === 1 ? 'conflito' : 'conflitos'} entre reservas
            </strong>
            <ul>
              {conflitos.map((c) => (
                <li key={`${c.a.id}-${c.b.id}`}>
                  Mesa {String(c.a.mesa?.numero ?? '').padStart(2, '0')} ·{' '}
                  {rotuloDia(dataDaReserva(c.a), hojeLocal(agora))}: {c.a.cliente_nome} ({faixaReserva(c.a)}) e{' '}
                  {c.b.cliente_nome} ({faixaReserva(c.b)}) —{' '}
                  {c.tipo === 'sobreposicao'
                    ? 'os horários se sobrepõem'
                    : `só ${c.intervaloMin} min entre uma e outra (mínimo ${MARGEM_ENTRE_RESERVAS_MIN} min)`}
                  . Cancele uma delas ou troque a mesa.
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* ── Disponibilidade de mesas (inclui as reservas feitas pelos clientes) ── */}
        {!carregando && !erroLista && mesasView.length > 0 && (
          <div className="caixa__resumo" role="status" aria-label="Resumo de disponibilidade das mesas">
            <div className="caixa__resumo-item caixa__resumo-item--destaque">
              <span className="caixa__resumo-numero">{totalLivres}</span>
              <span className="caixa__resumo-rotulo">
                de {mesasView.length} mesas disponíveis
              </span>
            </div>
            <div className="caixa__resumo-item">
              <span className="caixa__resumo-numero">{totalAbertas}</span>
              <span className="caixa__resumo-rotulo">ocupadas</span>
            </div>
            <div className="caixa__resumo-item">
              <span className="caixa__resumo-numero">{totalReservadas}</span>
              <span className="caixa__resumo-rotulo">reservadas</span>
            </div>
            <div className="caixa__resumo-item">
              <span className="caixa__resumo-numero">{totalReservasHoje}</span>
              <span className="caixa__resumo-rotulo">reservas hoje</span>
            </div>
          </div>
        )}

        {erroReservas && (
          <div className="caixa__vazio" role="alert">{erroReservas}</div>
        )}

        {/* ── Reservas (hoje e próximos dias) feitas pelos clientes no app ── */}
        {reservasAtivasHoje.length > 0 && (
          <div className="caixa__painel caixa__reservas">
            <h3 className="caixa__reservas-titulo">
              <HiOutlineCalendar /> Reservas
            </h3>

            <div className="caixa__reservas-lista">
              {gruposAtivos.map((g) => {
                const r = g.base;
                const emConflito = g.linhas.some((l) => idsEmConflito.has(l.id));
                // Perto do horário (30 min antes) ou já na janela da reserva: destaque na lista
                const faltam =
                  dataDaReserva(r) === hojeLocal(agora) ? horaParaMinutos(horaDaIso(r.hora_inicio)) - minutosAgora(agora) : null;
                const iminente = faltam !== null && faltam <= ANTECEDENCIA_RESERVA_MIN;
                return (
                <div key={r.grupo_id ?? r.id} className={`caixa__reserva${g.falta > 0 ? ' caixa__reserva--sem-assentos' : ''}${iminente ? ' caixa__reserva--iminente' : ''}`}>
                  <div className="caixa__reserva-info">
                    <strong className="caixa__reserva-hora">
                      {rotuloDia(dataDaReserva(r), hojeLocal(agora))} · {faixaReserva(r)}
                    </strong>
                    {iminente && faltam !== null && (
                      <span className="caixa__reserva-agora">
                        ⏰ {faltam > 0 ? `Começa em ${faltam} min` : 'Reserva em andamento'}
                      </span>
                    )}
                    <span className="caixa__reserva-nome">{r.cliente_nome}</span>
                    <span className="caixa__reserva-detalhe">
                      {g.mesas.length
                        ? `${g.mesas.length > 1 ? 'Mesas' : 'Mesa'} ${g.mesas
                            .map((m) => String(m.numero).padStart(2, '0'))
                            .join(', ')}`
                        : 'Sem mesa'}{' '}
                      · {g.pessoas} {g.pessoas === 1 ? 'pessoa' : 'pessoas'} · {r.cliente_telefone}
                    </span>
                    {g.falta > 0 && (
                      <span className="caixa__reserva-falta">🪑 Faltam {g.falta} lugares</span>
                    )}
                    {r.observacoes && <span className="caixa__reserva-obs" title={r.observacoes}>{r.observacoes}</span>}
                    {r.mensagem_restaurante && (
                      <span className="caixa__reserva-obs" title={r.mensagem_restaurante}>
                        Seu recado: {r.mensagem_restaurante}
                      </span>
                    )}
                  </div>

                  {emConflito && (
                    <span className="caixa__reserva-status caixa__reserva-status--conflito">⚠ Conflito</span>
                  )}

                  <span className={`caixa__reserva-status caixa__reserva-status--${r.status.toLowerCase()}`}>
                    {r.status === 'PENDENTE' ? 'Aguardando confirmação' : 'Confirmada'}
                  </span>

                  <div className="caixa__reserva-acoes">
                    {r.status === 'PENDENTE' && (
                      <button
                        className="caixa__reserva-btn caixa__reserva-btn--ok"
                        onClick={() =>
                          g.falta > 0 || r.cliente_id ? abrirDecisao(g, 'CONFIRMADA') : void atualizarReserva(r, 'CONFIRMADA')
                        }
                        disabled={reservaAgindoId === r.id}
                      >
                        {g.falta > 0 ? 'Aceitar' : 'Confirmar'}
                      </button>
                    )}
                    {r.cliente_id && (
                      <button
                        className="caixa__reserva-btn"
                        onClick={() => abrirDecisao(g, 'MENSAGEM')}
                        disabled={reservaAgindoId === r.id}
                      >
                        Mensagem
                      </button>
                    )}
                    <button
                      className="caixa__reserva-btn"
                      onClick={() => void clienteChegou(r)}
                      disabled={reservaAgindoId === r.id}
                    >
                      Cliente chegou
                    </button>
                    <button
                      className="caixa__reserva-btn caixa__reserva-btn--perigo"
                      onClick={() =>
                        r.status === 'PENDENTE' && r.cliente_id ? abrirDecisao(g, 'CANCELADA') : void atualizarReserva(r, 'CANCELADA')
                      }
                      disabled={reservaAgindoId === r.id}
                    >
                      {r.status === 'PENDENTE' ? 'Recusar' : 'Cancelar'}
                    </button>
                  </div>
                </div>
                );
              })}
            </div>
          </div>
        )}

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
            <div className={`caixa__grid caixa__grid--${modoExibido}`}>
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
                              {clicavel && (
                                <button
                                  className="caixa__card-menu-item"
                                  onClick={(e) => { e.stopPropagation(); setMenuAberto(null); navigate(`/restaurante/fila?mesa=${mesa.id}`); }}
                                >
                                  <HiOutlineClipboardList /> Ver na fila
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

                        {/* Reserva do cliente: quem vem, que horas e quantas pessoas */}
                        {mesa.reservaAtual && (
                          <span className="caixa__card-reserva" title={mesa.reservaAtual.cliente_nome}>
                            Reservada hoje às {horaDaIso(mesa.reservaAtual.hora_inicio)} ({faixaReserva(mesa.reservaAtual)}) · {mesa.reservaAtual.cliente_nome} ({mesa.reservaAtual.pessoas_total ?? mesa.reservaAtual.num_pessoas})
                          </span>
                        )}
                        {!mesa.reservaAtual && mesa.proximaReserva && (
                          <span className="caixa__card-reserva caixa__card-reserva--proxima" title={mesa.proximaReserva.cliente_nome}>
                            Reserva hoje às {horaDaIso(mesa.proximaReserva.hora_inicio)} · {mesa.proximaReserva.cliente_nome}
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

                        {/* Alterna entre Livre (liberada) e Reservada à mão.
                            Mesa reservada por cliente é liberada cancelando a reserva (painel acima). */}
                        {(!mesa.reservaAtual || mesa.reservadaManual) && (
                          <button
                            className="caixa__card-btn-alternar"
                            onClick={(e) => (mesa.reservadaManual ? void alternarReserva(mesa, e) : abrirReservarMesa(mesa, e))}
                            disabled={alternandoId === mesa.id}
                          >
                            {alternandoId === mesa.id
                              ? 'Alterando...'
                              : mesa.reservadaManual
                                ? 'Liberar mesa'
                                : 'Reservar mesa'}
                          </button>
                        )}
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

                        {/* Andamento na cozinha (mesmo status da Fila de Pedidos) */}
                        {mesa.cozinha && (
                          <div className="caixa__card-cozinha">
                            {mesa.cozinha.recebido + mesa.cozinha.preparo > 0 && (
                              <span className="caixa__card-chip caixa__card-chip--cozinha">
                                {mesa.cozinha.recebido + mesa.cozinha.preparo} na cozinha
                              </span>
                            )}
                            {mesa.cozinha.pronto > 0 && (
                              <span className="caixa__card-chip caixa__card-chip--pronto">
                                {mesa.cozinha.pronto} pronto p/ servir
                              </span>
                            )}
                            {mesa.cozinha.entregue > 0 && (
                              <span className="caixa__card-chip caixa__card-chip--entregue">
                                {mesa.cozinha.entregue} entregue{mesa.cozinha.entregue > 1 ? 's' : ''}
                              </span>
                            )}
                          </div>
                        )}

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

        {/* ── Modal: reservar a mesa (dia, horário e descrição opcional) ── */}
        {reservandoMesa && (
          <div className="caixa__overlay" onClick={() => !resEnviando && setReservandoMesa(null)}>
            <div
              className="caixa__modal"
              role="dialog"
              aria-modal="true"
              aria-labelledby="caixa-reservar-titulo"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="caixa__modal-header">
                <div>
                  <h3 id="caixa-reservar-titulo" className="caixa__modal-titulo">
                    Reservar Mesa {String(reservandoMesa.numero).padStart(2, '0')}
                  </h3>
                  <p className="caixa__modal-subtitulo">Informe o dia e o horário. A mesa fica segura por 2h.</p>
                </div>
                <button className="caixa__modal-fechar" onClick={() => setReservandoMesa(null)} aria-label="Fechar">
                  <HiX />
                </button>
              </div>

              <div className="caixa__modal-corpo">
                <div className="caixa__campo-linha">
                  <div className="caixa__campo">
                    <label htmlFor="caixa-reservar-dia">Dia</label>
                    <input
                      id="caixa-reservar-dia"
                      type="date"
                      min={hojeLocal(agora)}
                      value={resDia}
                      onChange={(e) => setResDia(e.target.value)}
                    />
                  </div>
                  <div className="caixa__campo">
                    <label htmlFor="caixa-reservar-hora">Horário</label>
                    <input
                      id="caixa-reservar-hora"
                      type="time"
                      value={resHora}
                      onChange={(e) => setResHora(e.target.value)}
                    />
                  </div>
                </div>

                <div className="caixa__campo">
                  <label htmlFor="caixa-reservar-descricao">Descrição (opcional)</label>
                  <textarea
                    id="caixa-reservar-descricao"
                    rows={3}
                    maxLength={500}
                    value={resDescricao}
                    onChange={(e) => setResDescricao(e.target.value)}
                    placeholder="Ex.: Aniversário da Maria, 6 pessoas"
                  />
                </div>

                {resErro && <p className="caixa__alerta-inline" role="alert">{resErro}</p>}
              </div>

              <div className="caixa__modal-acoes">
                <button className="caixa__btn-cancelar" onClick={() => setReservandoMesa(null)} disabled={resEnviando}>
                  Voltar
                </button>
                <button className="caixa__btn-salvar" onClick={() => void enviarReservaMesa()} disabled={resEnviando}>
                  {resEnviando ? 'Reservando...' : 'Reservar mesa'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ── Modal: aceitar / recusar reserva ou mandar mensagem ao cliente ── */}
        {decisao && (
          <div className="caixa__overlay" onClick={() => !reservaAgindoId && setDecisao(null)}>
            <div
              className="caixa__modal"
              role="dialog"
              aria-modal="true"
              aria-labelledby="caixa-decisao-titulo"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="caixa__modal-header">
                <div>
                  <h3 id="caixa-decisao-titulo" className="caixa__modal-titulo">
                    {decisao.acao === 'CONFIRMADA'
                      ? decisao.grupo.falta > 0 ? 'Aceitar reserva sem assentos suficientes' : 'Confirmar reserva'
                      : decisao.acao === 'CANCELADA'
                        ? 'Recusar reserva'
                        : 'Mensagem para o cliente'}
                  </h3>
                  <p className="caixa__modal-subtitulo">
                    {decisao.grupo.base.cliente_nome} · {decisao.grupo.pessoas} pessoas ·{' '}
                    {rotuloDia(dataDaReserva(decisao.grupo.base), hojeLocal(agora))} {horaDaIso(decisao.grupo.base.hora_inicio)}
                    {decisao.grupo.falta > 0 ? ` · faltam ${decisao.grupo.falta} lugares` : ''}
                  </p>
                </div>
                <button className="caixa__modal-fechar" onClick={() => setDecisao(null)} aria-label="Fechar">
                  <HiX />
                </button>
              </div>

              <div className="caixa__modal-corpo">
                <div className="caixa__campo">
                  <label htmlFor="caixa-decisao-texto">
                    {decisao.acao === 'MENSAGEM' ? 'Mensagem' : 'Mensagem para o cliente (opcional)'}
                  </label>
                  <textarea
                    id="caixa-decisao-texto"
                    rows={4}
                    maxLength={500}
                    value={textoDecisao}
                    onChange={(e) => setTextoDecisao(e.target.value)}
                    placeholder={
                      decisao.acao === 'CANCELADA'
                        ? 'Ex.: Não temos lugares para todos nesse horário. Podemos tentar outro dia?'
                        : 'Ex.: Vamos juntar as mesas 3 e 4 e colocar 6 cadeiras extras. Pode chegar 10 min antes.'
                    }
                  />
                  <small>O cliente recebe por e-mail e vê no topo da tela de reservas.</small>
                </div>
              </div>

              <div className="caixa__modal-acoes">
                <button className="caixa__btn-cancelar" onClick={() => setDecisao(null)} disabled={Boolean(reservaAgindoId)}>
                  Voltar
                </button>
                <button
                  className="caixa__btn-salvar"
                  onClick={() => void enviarDecisao()}
                  disabled={Boolean(reservaAgindoId) || (decisao.acao === 'MENSAGEM' && !textoDecisao.trim())}
                >
                  {reservaAgindoId
                    ? 'Enviando...'
                    : decisao.acao === 'CONFIRMADA'
                      ? 'Aceitar reserva'
                      : decisao.acao === 'CANCELADA'
                        ? 'Recusar reserva'
                        : 'Enviar mensagem'}
                </button>
              </div>
            </div>
          </div>
        )}

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
                    maxLength={OBSERVACAO_MAX}
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
          salvando={cancelando}
          erro={cancelarErro}
          onFechar={fecharCancelamento}
          onConfirmar={(motivo) => void confirmarCancelamento(motivo)}
        />

      </div>
    </RestaurantLayout>
  );
};

export default GerenPagamentos;