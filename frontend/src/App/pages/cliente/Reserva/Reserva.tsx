import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { MdTableRestaurant } from 'react-icons/md';
import CustomerLayout from '../../../shared/components/layout/Customerlayout';
import { useClienteAuth } from '../../../shared/contexts/ClienteAuthContext';
import { useRestauranteCliente } from '../../../shared/contexts/RestauranteClienteContext';
import ReservaClienteService, {
  Disponibilidade,
  DisponibilidadeMesa,
  Reserva as ReservaApi,
  ReservaAgrupada,
  ANTECEDENCIA_MINIMA_HOJE_MIN,
  FOLGA_ANTES_DE_FECHAR_MIN,
  OPCOES_DURACAO,
  minutosDaDuracao,
  agruparReservas,
  escolherMesas,
  dataDaReserva,
  horaDaIso,
  horaFimDaReserva,
  horaParaMinutos,
  agruparHorarios,
  horariosLivres,
  hojeLocal,
  rotuloDia,
} from '../../../services/reserva.service';
import { mensagemDeErro } from '../../../services/cliente.service';
import './Reserva.css';

// ── Constantes ─────────────────────────────────────────────────────
const MAX_PESSOAS = 50;

// Poucas mesas ficam numa coluna só; com mais que isto a lista passa para 2 colunas
const LIMITE_UMA_COLUNA = 4;

// Mesmo limite do servidor: reservas em aberto por cliente (avisamos antes, sem nem chamar a API)
const MAX_RESERVAS_ABERTAS = 3;

// Telas até esta largura (mobile) começam com a lista de mesas minimizada
const LARGURA_MOBILE = 768;


// Atualização automática: o cliente enxerga os horários que outras pessoas acabaram de pegar
const INTERVALO_ATUALIZACAO_MS = 30000;

// Avisos de cancelamento já vistos (por cliente), guardados só neste navegador
const chaveAvisosVistos = (clienteId?: string) => `@menupoint:reservas_avisos_vistos:${clienteId ?? ''}`;

// ── Helpers ────────────────────────────────────────────

/**
 * Formata um objeto Date para exibição no padrão brasileiro.
 * Ex.: "SEG, 25 DE MAIO 2026"
 */
const formatarData = (date: Date): string => {
  const diasSemana = ['DOM', 'SEG', 'TER', 'QUA', 'QUI', 'SEX', 'SÁB'];
  const meses = [
    'JANEIRO', 'FEVEREIRO', 'MARÇO', 'ABRIL', 'MAIO', 'JUNHO',
    'JULHO', 'AGOSTO', 'SETEMBRO', 'OUTUBRO', 'NOVEMBRO', 'DEZEMBRO',
  ];

  const diaSemana = diasSemana[date.getDay()];
  const dia       = date.getDate();
  const mes       = meses[date.getMonth()];
  const ano       = date.getFullYear();

  return `${diaSemana}, ${dia} DE ${mes} ${ano}`;
};

/**
 * Converte string "YYYY-MM-DD" para Date sem deslocamento de fuso.
 * new Date('2026-05-25') interpreta como UTC meia-noite,
 * o que pode retornar o dia anterior no fuso -3.
 */
const parseDateLocal = (value: string): Date => {
  const [year, month, day] = value.split('-').map(Number);
  return new Date(year, month - 1, day);
};

/** A data não pode ser anterior a hoje (os horários válidos do dia vêm da API, já filtrados). */
const validarData = (data: string): string | null =>
  data && data < hojeLocal() ? 'Escolha uma data a partir de hoje.' : null;

/** Último horário em que dá para começar uma reserva (fechamento menos a folga) */
const ultimoHorarioReserva = (fechamento: string): string => {
  const m = (horaParaMinutos(fechamento) - FOLGA_ANTES_DE_FECHAR_MIN + 24 * 60) % (24 * 60);
  return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
};

/** Chave que identifica "o que o cliente já viu" de uma reserva (muda quando o status ou o recado muda) */
const chaveAviso = (r: ReservaAgrupada): string =>
  `${r.base.grupo_id ?? r.base.id}:${r.base.status}:${r.base.cancelada_por ?? ''}:${r.base.mensagem_em ?? ''}`;

const textoMesas = (mesas: { numero: number }[]): string =>
  mesas.length === 0
    ? ''
    : `${mesas.length > 1 ? 'Mesas' : 'Mesa'} ${mesas.map((m) => m.numero).join(', ')}`;

const ROTULO_STATUS: Record<string, string> = {
  PENDENTE: 'Aguardando confirmação',
  CONFIRMADA: 'Confirmada',
  CONCLUIDA: 'Concluída',
  CANCELADA: 'Cancelada',
};

// ── Componente ─────────────────────────────────────────

const Reserva: React.FC = () => {
  const { cliente } = useClienteAuth();
  const { slug, restaurante } = useRestauranteCliente();

  // ── Estados
  const [dataSelecionada, setDataSelecionada] = useState('');
  const [horario, setHorario]                 = useState('');
  const [pessoas, setPessoas]                 = useState(2);
  // Quanto tempo o cliente vai ficar (minutos) ou 'indefinida' = não sei ainda
  const [duracao, setDuracao]                 = useState<number | 'indefinida'>(120);
  const [observacao, setObservacao]           = useState('');
  // Mesas escolhidas à mão pelo cliente (vale só para a combinação data/horário/pessoas/tempo em que foi feita)
  const [manual, setManual]                   = useState<{ chave: string; ids: string[] } | null>(null);
  const [showModal, setShowModal]             = useState(false);
  const [erro, setErro]                       = useState('');

  // Alerta de antecedência: abre junto com a tela e fecha no OK
  const [avisoInicial, setAvisoInicial]       = useState(true);
  // Datas cujo aviso de funcionamento o cliente já fechou (OK)
  const [funcionamentoVisto, setFuncionamentoVisto] = useState<string[]>([]);

  // Horários livres de cada mesa no dia escolhido (vindos da API, já sem o que outros clientes reservaram)
  const [dispo, setDispo]                     = useState<Disponibilidade | null>(null);
  const [carregandoMesas, setCarregandoMesas] = useState(false);
  const [erroMesas, setErroMesas]             = useState('');
  // Quando a lista foi atualizada pela última vez (automático ou pelo botão Atualizar)
  const [atualizadoEm, setAtualizadoEm]       = useState<number | null>(null);
  const [atualizando, setAtualizando]         = useState(false);

  // Lista compacta: cada mesa mostra um resumo das faixas livres e só abre os horários se o cliente pedir
  const [mesasAbertas, setMesasAbertas] = useState<string[]>([]);
  // Aba "Mesas": no mobile começa minimizada; o cliente abre/fecha quando quiser
  const [painelAberto, setPainelAberto] = useState(
    () => typeof window === 'undefined' || window.innerWidth > LARGURA_MOBILE
  );

  const alternarMesaAberta = (id: string) =>
    setMesasAbertas((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));

  // Avisos (confirmação, recusa, recado do restaurante) que o cliente já dispensou
  const [avisosVistos, setAvisosVistos]       = useState<string[]>(() => {
    try {
      return JSON.parse(localStorage.getItem(chaveAvisosVistos(cliente?.id)) ?? '[]');
    } catch {
      return [];
    }
  });
  // Recados do restaurante abertos na faixa do topo
  const [recadosAbertos, setRecadosAbertos]   = useState<string[]>([]);

  const [enviando, setEnviando]               = useState(false);
  const [erroEnvio, setErroEnvio]             = useState('');
  const [reservaCriada, setReservaCriada]     = useState<ReservaAgrupada | null>(null);

  const [minhas, setMinhas]                   = useState<ReservaApi[]>([]);
  const [cancelandoId, setCancelandoId]       = useState<string | null>(null);
  const [erroMinhas, setErroMinhas]           = useState('');

  // Só a resposta da busca mais recente vale (o cliente muda data rapidamente)
  const buscaMesasReq = useRef(0);

  // "Agora" atualizado a cada 30s: horários de hoje que passam somem da lista sozinhos
  const [agoraMs, setAgoraMs] = useState(() => Date.now());

  const erroData = validarData(dataSelecionada);
  const duracaoMin = minutosDaDuracao(duracao);

  // ── Handlers de pessoas (mín 1, máx MAX_PESSOAS)
  const incrementarPessoas = () =>
    setPessoas((prev) => Math.min(prev + 1, MAX_PESSOAS));

  const decrementarPessoas = () =>
    setPessoas((prev) => Math.max(prev - 1, 1));

  // ── Busca os horários livres de cada mesa no dia (tempo real: é o mesmo que o Caixa enxerga)
  // Traz TODAS as mesas: grupos grandes ocupam mais de uma.
  const buscarMesas = useCallback(async (silencioso = false) => {
    const req = ++buscaMesasReq.current;

    if (!slug || !dataSelecionada || dataSelecionada < hojeLocal()) {
      setDispo(null);
      setErroMesas('');
      setCarregandoMesas(false);
      return;
    }

    if (!silencioso) {
      setCarregandoMesas(true);
      setErroMesas('');
    }
    try {
      const resposta = await ReservaClienteService.disponibilidade(slug, dataSelecionada);
      if (req !== buscaMesasReq.current) return;
      setDispo(resposta);
      setErroMesas('');
      setAtualizadoEm(Date.now());
    } catch (err: any) {
      if (req !== buscaMesasReq.current) return;
      if (!silencioso) {
        setDispo(null);
        setErroMesas(mensagemDeErro(err, 'Não foi possível carregar as mesas disponíveis.'));
      }
    } finally {
      if (req === buscaMesasReq.current && !silencioso) setCarregandoMesas(false);
    }
  }, [slug, dataSelecionada]);

  useEffect(() => {
    void buscarMesas();
  }, [buscarMesas]);

  // Horários livres de cada mesa (dentro do funcionamento, com 2h de antecedência e longe do fechamento)
  const mesasInfo = useMemo(() => {
    if (!dispo) return [] as { mesa: DisponibilidadeMesa; livres: string[] }[];
    return dispo.mesas.map((mesa) => ({
      mesa,
      livres: horariosLivres(mesa, dispo.funcionamento, dataSelecionada, agoraMs, duracaoMin),
    }));
  }, [dispo, dataSelecionada, agoraMs, duracaoMin]);

  // O que o cliente pode escolher: só horários em que há mesa livre. `falta` > 0 = não há lugares para todos.
  const opcoesHorario = useMemo(() => {
    const todos = new Set<string>();
    mesasInfo.forEach((m) => m.livres.forEach((h) => todos.add(h)));
    return Array.from(todos)
      .sort()
      .map((hora) => {
        const livresEm = mesasInfo.filter((m) => m.livres.includes(hora)).map((m) => m.mesa);
        return { hora, falta: escolherMesas(livresEm, pessoas).falta };
      });
  }, [mesasInfo, pessoas]);

  const horarioEscolhido = opcoesHorario.some((o) => o.hora === horario) ? horario : '';

  // O horário escolhido deixou de existir (alguém reservou, passou da hora, mudou o tempo/pessoas)
  useEffect(() => {
    if (horario && dispo && !carregandoMesas && !horarioEscolhido) {
      setHorario('');
      setErro(`O horário ${horario} não está mais disponível. Escolha outro.`);
    }
  }, [horario, dispo, carregandoMesas, horarioEscolhido]);

  // Mesas livres no horário escolhido
  const livresNoHorario = useMemo(
    () => (horarioEscolhido ? mesasInfo.filter((m) => m.livres.includes(horarioEscolhido)).map((m) => m.mesa) : []),
    [mesasInfo, horarioEscolhido]
  );

  // Seleção: a melhor mesa (ou as mesas necessárias) já vem marcada; o cliente pode ajustar nos cards
  const chaveEscolha = `${dataSelecionada}|${horarioEscolhido}|${pessoas}|${duracao}`;
  const sugestao = useMemo(
    () => (horarioEscolhido ? escolherMesas(livresNoHorario, pessoas) : { mesas: [] as DisponibilidadeMesa[], falta: 0 }),
    [horarioEscolhido, livresNoHorario, pessoas]
  );
  const idsLivres = new Set(livresNoHorario.map((m) => m.id));
  const manuaisValidos = manual && manual.chave === chaveEscolha ? manual.ids.filter((id) => idsLivres.has(id)) : [];
  const idsSelecionados: string[] = !horarioEscolhido
    ? []
    : manuaisValidos.length
      ? manuaisValidos
      : sugestao.mesas.map((m) => m.id);
  const mesasSelecionadas = livresNoHorario
    .filter((m) => idsSelecionados.includes(m.id))
    .sort((a, b) => a.numero - b.numero);
  const capacidadeSelecionada = mesasSelecionadas.reduce((t, m) => t + m.capacidade, 0);
  const faltaSelecionada = Math.max(0, pessoas - capacidadeSelecionada);
  const menorCapacidade = mesasSelecionadas.length ? Math.min(...mesasSelecionadas.map((m) => m.capacidade)) : 0;
  // Mesa a mais do que o necessário (o servidor também recusa)
  const sobraMesa = mesasSelecionadas.length > 1 && capacidadeSelecionada - menorCapacidade >= pessoas;
  // Faltam lugares, mas ainda existem mesas livres: o cliente precisa marcar todas antes de falar em falta
  const faltamMesasLivres = faltaSelecionada > 0 && livresNoHorario.some((m) => !idsSelecionados.includes(m.id));

  const alternarMesa = (id: string) => {
    if (!horarioEscolhido) return;
    const novos = idsSelecionados.includes(id) ? idsSelecionados.filter((x) => x !== id) : [...idsSelecionados, id];
    setManual({ chave: chaveEscolha, ids: novos });
    if (erro) setErro('');
  };

  // Clicou num horário de uma mesa: usa o horário e deixa essa mesa (mais as que faltarem) selecionada
  const escolherHorarioNaMesa = (mesa: DisponibilidadeMesa, h: string) => {
    const livresEm = mesasInfo.filter((m) => m.livres.includes(h)).map((m) => m.mesa);
    const resto = livresEm
      .filter((m) => m.id !== mesa.id)
      .sort((a, b) => b.capacidade - a.capacidade || a.numero - b.numero);
    let ids = [mesa.id];
    let soma = mesa.capacidade;
    for (const m of resto) {
      if (soma >= pessoas) break;
      ids.push(m.id);
      soma += m.capacidade;
    }
    const menor = Math.min(...ids.map((id) => livresEm.find((m) => m.id === id)?.capacidade ?? 0));
    if (ids.length > 1 && soma - menor >= pessoas) ids = escolherMesas(livresEm, pessoas).mesas.map((m) => m.id);
    setHorario(h);
    setManual({ chave: `${dataSelecionada}|${h}|${pessoas}|${duracao}`, ids });
    if (erro) setErro('');
  };

  // Cards: com horário escolhido, só as mesas livres nele (as selecionadas primeiro)
  const mesasVisiveis = useMemo(
    () =>
      mesasInfo
        .filter((m) => m.livres.length > 0)
        .filter((m) => !horarioEscolhido || idsLivres.has(m.mesa.id))
        .sort((a, b) => {
          const sa = idsSelecionados.includes(a.mesa.id) ? 0 : 1;
          const sb = idsSelecionados.includes(b.mesa.id) ? 0 : 1;
          return sa - sb || a.mesa.capacidade - b.mesa.capacidade || a.mesa.numero - b.mesa.numero;
        }),
    // idsLivres/idsSelecionados derivam das dependências abaixo
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [mesasInfo, horarioEscolhido, livresNoHorario, manual, chaveEscolha, sugestao]
  );

  const mesasSemHorario = dispo ? dispo.mesas.length - mesasVisiveis.length : 0;

  // ── Reservas do próprio cliente (para acompanhar o status e cancelar)
  const carregarMinhas = useCallback(async () => {
    if (!slug) return;
    try {
      setMinhas(await ReservaClienteService.minhas(slug));
      setErroMinhas('');
    } catch (err: any) {
      setErroMinhas(mensagemDeErro(err, 'Não foi possível carregar suas reservas.'));
    }
  }, [slug]);

  useEffect(() => {
    void carregarMinhas();
  }, [carregarMinhas]);

  // Atualiza sozinho: horários que outros clientes pegaram e reservas que o restaurante cancelou/confirmou
  useEffect(() => {
    const timer = window.setInterval(() => {
      if (document.hidden || showModal) return;
      setAgoraMs(Date.now());
      void buscarMesas(true);
      void carregarMinhas();
    }, INTERVALO_ATUALIZACAO_MS);
    // Ao voltar para a aba (ou desbloquear o celular) atualiza na hora, sem esperar o próximo ciclo
    const aoVoltar = () => {
      if (document.hidden || showModal) return;
      setAgoraMs(Date.now());
      void buscarMesas(true);
      void carregarMinhas();
    };
    document.addEventListener('visibilitychange', aoVoltar);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener('visibilitychange', aoVoltar);
    };
  }, [buscarMesas, carregarMinhas, showModal]);

  // Botão Atualizar: recarrega mesas/horários e as reservas do cliente
  const atualizarAgora = async () => {
    if (atualizando) return;
    setAtualizando(true);
    setAgoraMs(Date.now());
    try {
      await Promise.all([buscarMesas(), carregarMinhas()]);
    } finally {
      setAtualizando(false);
    }
  };

  // ── Validação e envio
  const handleReservar = () => {
    if (!dataSelecionada) {
      setErro('Selecione uma data para a reserva.');
      return;
    }
    if (erroData) {
      setErro(erroData);
      return;
    }
    if (reservasAtivas.length >= MAX_RESERVAS_ABERTAS) {
      setErro(`Você já tem ${MAX_RESERVAS_ABERTAS} reservas em aberto neste restaurante. Cancele uma (no topo da tela) para fazer outra.`);
      return;
    }
    if (!horarioEscolhido) {
      setErro('Escolha um dos horários disponíveis.');
      return;
    }
    if (!mesasSelecionadas.length) {
      setErro('Selecione ao menos uma mesa disponível.');
      return;
    }
    if (faltamMesasLivres) {
      setErro(`Faltam ${faltaSelecionada} lugares: selecione também as outras mesas livres.`);
      return;
    }
    if (sobraMesa) {
      setErro('Você selecionou mais mesas do que o necessário. Desmarque alguma.');
      return;
    }
    setErro('');
    setErroEnvio('');
    setShowModal(true);
  };

  const limparFormulario = () => {
    setDataSelecionada('');
    setHorario('');
    setPessoas(2);
    setDuracao(120);
    setObservacao('');
    setManual(null);
  };

  const handleConfirmarReserva = async () => {
    if (enviando || !slug || !mesasSelecionadas.length) return;

    setEnviando(true);
    setErroEnvio('');
    try {
      const criada = await ReservaClienteService.criar(slug, {
        mesas_ids: mesasSelecionadas.map((m) => m.id),
        data_reserva: dataSelecionada,
        hora_inicio: horarioEscolhido,
        hora_fim: horaFimDaReserva(horarioEscolhido, duracaoMin),
        num_pessoas: pessoas,
        ...(duracao === 'indefinida' && { duracao_indefinida: true }),
        ...(observacao.trim() && { observacoes: observacao.trim() }),
      });
      setReservaCriada(agruparReservas(criada.mesas_do_grupo ?? [criada])[0]);
      limparFormulario();
      void carregarMinhas();
      void buscarMesas(true);
    } catch (err: any) {
      setErroEnvio(mensagemDeErro(err, 'Não foi possível fazer a reserva. Tente novamente.'));
      // 409 = outra pessoa pegou a mesa agora há pouco: atualiza a lista de livres
      if (err?.response?.status === 409) void buscarMesas(true);
    } finally {
      setEnviando(false);
    }
  };

  const handleFecharModal = () => {
    if (enviando) return;
    setShowModal(false);
    setReservaCriada(null);
    setErroEnvio('');
  };

  const handleCancelarReserva = async (id: string) => {
    if (!slug || cancelandoId) return;
    setCancelandoId(id);
    setErroMinhas('');
    try {
      await ReservaClienteService.cancelar(slug, id);
      await carregarMinhas();
      void buscarMesas(true); // o horário volta a aparecer como livre
    } catch (err: any) {
      setErroMinhas(mensagemDeErro(err, 'Não foi possível cancelar a reserva.'));
    } finally {
      setCancelandoId(null);
    }
  };

  // ── Label da data exibida no campo
  const labelData = dataSelecionada
    ? formatarData(parseDateLocal(dataSelecionada))
    : 'Selecione uma data';

  // ── Faixa de reservas no topo (1 linha por reserva)
  const minhasAgrupadas = useMemo(() => agruparReservas(minhas), [minhas]);
  const reservasAtivas = minhasAgrupadas.filter(
    (r) => r.base.status === 'PENDENTE' || r.base.status === 'CONFIRMADA'
  );
  // Reserva recusada/cancelada pelo restaurante: avisa até o cliente apertar OK
  const encerradasAvisar = minhasAgrupadas.filter(
    (r) => r.base.status === 'CANCELADA' && r.base.cancelada_por !== 'CLIENTE' && !avisosVistos.includes(chaveAviso(r))
  );

  const dispensarAviso = (chave: string) => {
    const novos = [...avisosVistos, chave];
    setAvisosVistos(novos);
    try {
      localStorage.setItem(chaveAvisosVistos(cliente?.id), JSON.stringify(novos));
    } catch {
      /* sem armazenamento: o aviso só volta se a página for recarregada */
    }
  };

  const alternarRecado = (chave: string) =>
    setRecadosAbertos((prev) => (prev.includes(chave) ? prev.filter((x) => x !== chave) : [...prev, chave]));

  const renderLinhaReserva = (r: ReservaAgrupada) => {
    const chave = chaveAviso(r);
    const status = r.base.status;
    const recusada = status === 'CANCELADA' && r.base.cancelada_por === 'RECUSADA';
    const ativa = status === 'PENDENTE' || status === 'CONFIRMADA';
    // "Novo": decisão do restaurante (confirmou/recusou/cancelou) ou recado que o cliente ainda não viu
    const novo = !avisosVistos.includes(chave) && (status !== 'PENDENTE' || Boolean(r.base.mensagem_restaurante));
    const rotulo = recusada ? 'Recusada' : status === 'CANCELADA' ? 'Cancelada pelo restaurante' : ROTULO_STATUS[status] ?? status;
    const classeStatus = recusada ? 'recusada' : status.toLowerCase();
    const recadoAberto = recadosAbertos.includes(chave);

    return (
      <div key={chave} className={`reserva__faixa reserva__faixa--${classeStatus}`} role={novo ? 'alert' : undefined}>
        <div className="reserva__faixa-linha">
          <span className={`reserva__status reserva__status--${classeStatus}`}>{rotulo}</span>
          <span className="reserva__faixa-texto">
            <strong>{rotuloDia(dataDaReserva(r.base))} às {horaDaIso(r.base.hora_inicio)}</strong>
            {' · '}{textoMesas(r.mesas)}{r.mesas.length ? ' · ' : ''}{r.pessoas} pessoa{r.pessoas > 1 ? 's' : ''}
            {status === 'PENDENTE' && r.falta > 0 ? ` · faltam ${r.falta} lugares (o restaurante vai avaliar)` : ''}
          </span>
          {r.base.mensagem_restaurante && (
            <button type="button" className="reserva__link" onClick={() => alternarRecado(chave)} aria-expanded={recadoAberto}>
              {recadoAberto ? 'Ocultar recado' : 'Ver recado'}
            </button>
          )}
          {novo && (
            <button type="button" className="reserva__link" onClick={() => dispensarAviso(chave)}>
              OK
            </button>
          )}
          {ativa && (
            <button
              type="button"
              className="reserva__link reserva__link--perigo"
              onClick={() => void handleCancelarReserva(r.base.id)}
              disabled={cancelandoId === r.base.id}
            >
              {cancelandoId === r.base.id ? 'Cancelando...' : 'Cancelar'}
            </button>
          )}
        </div>
        {r.base.mensagem_restaurante && recadoAberto && (
          <p className="reserva__faixa-recado">
            <strong>{restaurante?.nome ?? 'Restaurante'}:</strong> {r.base.mensagem_restaurante}
          </p>
        )}
      </div>
    );
  };

  const funcionamento = dispo?.funcionamento ?? null;
  const mostrarFuncionamento =
    Boolean(dataSelecionada) && !erroData && Boolean(funcionamento) && !funcionamentoVisto.includes(dataSelecionada);

  // ── Render
  return (
    <CustomerLayout mode="logged">
      <div className="reserva-pagina">

        {/* ── Reservas do cliente: ficam no topo, uma linha cada ── */}
        {(encerradasAvisar.length > 0 || reservasAtivas.length > 0 || erroMinhas) && (
          <div className="reserva__topo" aria-label="Minhas reservas">
            {erroMinhas && <p className="reserva__aviso reserva__aviso--erro" role="alert">{erroMinhas}</p>}
            {[...encerradasAvisar, ...reservasAtivas].map(renderLinhaReserva)}
          </div>
        )}

      <div className="reserva">

        {/* ── Formulário ── */}
        <div className="reserva__card">

          {/* Cabeçalho: título + imagem lado a lado em desktop, imagem acima em mobile */}
          <div className="reserva__card-header">
            <h1 className="reserva__titulo">RESERVA DE MESAS</h1>
            <img
              src="/images/Mesa.png"
              alt="Ilustração de mesa de restaurante"
              className="reserva__ilustracao"
            />
          </div>

          {/* Data */}
          <div className="reserva__campo">
                <label className="reserva__label">DATA</label>
                <div className="reserva__input-wrapper">
                  <input
                    type="date"
                    className="reserva__date-input"
                    min={hojeLocal()}
                    value={dataSelecionada}
                    data-empty={!dataSelecionada ? 'true' : undefined}
                    onChange={(e) => {
                      setDataSelecionada(e.target.value);
                      setHorario('');
                      if (erro) setErro('');
                    }}
                  />
                  {dataSelecionada && (
                    <span className="reserva__date-overlay">{labelData}</span>
                  )}
                </div>
              </div>

          {/* Aviso de funcionamento (fecha no OK) */}
          {mostrarFuncionamento && funcionamento && (
            <div className="reserva__aviso-horario" role="status">
              <p>
                {!funcionamento.aberto ? (
                  <>O restaurante <strong>não abre</strong> neste dia. Escolha outra data.</>
                ) : funcionamento.abertura && funcionamento.fechamento ? (
                  <>
                    Funcionamento neste dia: <strong>{funcionamento.abertura} às {funcionamento.fechamento}</strong>.
                    {' '}Não é possível reservar nos últimos {FOLGA_ANTES_DE_FECHAR_MIN} min antes de fechar
                    (último horário: {ultimoHorarioReserva(funcionamento.fechamento)}).
                  </>
                ) : (
                  <>O restaurante abre neste dia.</>
                )}
              </p>
              <button
                type="button"
                className="reserva__link"
                onClick={() => setFuncionamentoVisto((v) => [...v, dataSelecionada])}
              >
                OK
              </button>
            </div>
          )}

          {/* Horário: só os horários em que há mesa livre */}
          <div className="reserva__campo">
            <label className="reserva__label" htmlFor="reserva-horario">HORÁRIO</label>
            <select
              id="reserva-horario"
              className="reserva__input reserva__input--duracao"
              value={horarioEscolhido}
              disabled={!dataSelecionada || Boolean(erroData) || carregandoMesas || opcoesHorario.length === 0}
              onChange={(e) => {
                setHorario(e.target.value);
                if (erro) setErro('');
              }}
            >
              <option value="">
                {!dataSelecionada
                  ? 'Escolha a data primeiro'
                  : carregandoMesas
                    ? 'Buscando horários...'
                    : opcoesHorario.length === 0
                      ? 'Sem horários disponíveis'
                      : 'Selecione um horário'}
              </option>
              {opcoesHorario.map((o) => (
                <option key={o.hora} value={o.hora}>
                  {o.hora}{o.falta > 0 ? ` — faltam ${o.falta} lugares` : ''}
                </option>
              ))}
            </select>
            <small className="reserva__dica">
              Só aparecem horários livres, com no mínimo {ANTECEDENCIA_MINIMA_HOJE_MIN / 60}h de antecedência.
            </small>
          </div>

          {/* Pessoas */}
          <div className="reserva__campo">
            <label className="reserva__label">PESSOAS</label>
            <div className="reserva__pessoas">
              <button
                className="reserva__pessoas-btn reserva__pessoas-btn--add"
                onClick={incrementarPessoas}
                aria-label="Adicionar pessoa"
              >
                +
              </button>
              <span className="reserva__pessoas-count">{pessoas}</span>
              <button
                className="reserva__pessoas-btn reserva__pessoas-btn--remove"
                onClick={decrementarPessoas}
                aria-label="Remover pessoa"
              >
                −
              </button>
            </div>
          </div>

          {/* Quanto tempo vai ficar: define por quanto tempo a mesa fica segura */}
          <div className="reserva__campo">
            <label className="reserva__label" htmlFor="reserva-duracao">TEMPO NA MESA</label>
            <select
              id="reserva-duracao"
              className="reserva__input reserva__input--duracao"
              value={String(duracao)}
              onChange={(e) => {
                setDuracao(e.target.value === 'indefinida' ? 'indefinida' : Number(e.target.value));
                if (erro) setErro('');
              }}
            >
              {OPCOES_DURACAO.map((o) => (
                <option key={String(o.valor)} value={String(o.valor)}>{o.rotulo}</option>
              ))}
            </select>
            {duracao === 'indefinida' && (
              <small className="reserva__dica">
                Sem problema: a mesa fica segura por {minutosDaDuracao('indefinida') / 60}h e o restaurante combina com você.
              </small>
            )}
          </div>

          {/* Observação */}
          <div className="reserva__campo">
            <label className="reserva__label">OBSERVAÇÃO</label>
            <textarea
              className="reserva__textarea"
              placeholder="Aniversário/ Cadeira infantil/ Necessidades especiais"
              value={observacao}
              onChange={(e) => setObservacao(e.target.value)}
              rows={2}
            />
          </div>

          {/* Quem está reservando (dados da conta; o servidor usa a conta, não este texto) */}
          {cliente && (
            <p className="reserva__cliente">
              Reservando como <strong>{cliente.nome}</strong>
              {restaurante ? <> em <strong>{restaurante.nome}</strong></> : null}
              {cliente.telefone ? <> · {cliente.telefone}</> : null}
            </p>
          )}

          {/* Erro */}
          {(erroData || erro) && (
            <p className="reserva__erro" role="alert">{erroData || erro}</p>
          )}
        </div>

        {/* ── Lista de mesas ── */}
        <div className="reserva__painel">
          <div className="reserva__painel-cabecalho">
            {/* A aba abre/fecha a lista de mesas */}
            <button
              type="button"
              className="reserva__aba"
              aria-expanded={painelAberto}
              aria-controls="reserva-lista-mesas"
              onClick={() => setPainelAberto((v) => !v)}
            >
              <span className="reserva__painel-titulo">
                Mesas disponíveis
                {dispo && !erroData && !carregandoMesas && !erroMesas ? ` (${mesasVisiveis.length})` : ''}
              </span>
              <span className={`reserva__aba-seta ${painelAberto ? 'reserva__aba-seta--aberta' : ''}`} aria-hidden="true">▾</span>
            </button>

            <div className="reserva__atualizar">
              {atualizadoEm && (
                <span className="reserva__atualizado">
                  Atualizado às {new Date(atualizadoEm).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                </span>
              )}
              <button
                type="button"
                className="reserva__link"
                onClick={() => void atualizarAgora()}
                disabled={atualizando}
              >
                {atualizando ? 'Atualizando...' : '↻ Atualizar'}
              </button>
              {/* Desktop: o botão fica aqui, no topo; no mobile ele é o flutuante lá embaixo */}
              <button type="button" className="reserva__btn-reservar reserva__btn-reservar--topo" onClick={handleReservar}>
                RESERVAR
              </button>
            </div>
          </div>

          {/* Resumo da seleção (sempre visível, inclusive com a lista minimizada) */}
          {mesasSelecionadas.length > 0 && (
            <p className="reserva__selecao">
              <strong>{textoMesas(mesasSelecionadas)}</strong> selecionada{mesasSelecionadas.length > 1 ? 's' : ''}
              {' '}às {horarioEscolhido} · {capacidadeSelecionada} lugares para {pessoas} pessoa{pessoas > 1 ? 's' : ''}
              {faltaSelecionada > 0 && !faltamMesasLivres && (
                <span className="reserva__selecao-falta"> · faltam {faltaSelecionada} lugares: o restaurante vai avaliar a reserva</span>
              )}
            </p>
          )}
          {!painelAberto && mesasSelecionadas.length === 0 && (
            <p className="reserva__aviso reserva__aviso--discreto">
              Mesas minimizadas. Toque em "Mesas disponíveis" para ver.
            </p>
          )}

          <div
            className={`reserva__mesas${mesasVisiveis.length <= LIMITE_UMA_COLUNA ? ' reserva__mesas--uma' : ''}`}
            id="reserva-lista-mesas"
            hidden={!painelAberto}
          >
            {!dataSelecionada ? (
              <p className="reserva__aviso">Escolha a data para ver os horários livres de cada mesa.</p>
            ) : erroData ? null : carregandoMesas ? (
              <p className="reserva__aviso">Buscando horários livres...</p>
            ) : erroMesas ? (
              <p className="reserva__aviso reserva__aviso--erro" role="alert">
                {erroMesas}{' '}
                <button className="reserva__link" onClick={() => void buscarMesas()}>Tentar de novo</button>
              </p>
            ) : dispo && dispo.funcionamento && !dispo.funcionamento.aberto ? (
              <p className="reserva__aviso">O restaurante não abre neste dia. Escolha outra data.</p>
            ) : mesasVisiveis.length === 0 ? (
              <p className="reserva__aviso">
                Nenhuma mesa livre neste dia. Tente outra data.
              </p>
            ) : (
              mesasVisiveis.map(({ mesa, livres }) => {
                const selecionada = idsSelecionados.includes(mesa.id);
                const aberta = mesasAbertas.includes(mesa.id);
                return (
                <div
                  key={mesa.id}
                  className={`reserva__mesa-card ${selecionada ? 'reserva__mesa-card--ativa' : ''}`}
                >
                  <div className="reserva__mesa-topo">
                    <MdTableRestaurant className="reserva__mesa-icon" />
                    <span className="reserva__mesa-label">
                      MESA {mesa.numero}- {mesa.capacidade} lugares
                      {mesa.localizacao ? <small className="reserva__mesa-local">{mesa.localizacao}</small> : null}
                    </span>
                    {selecionada && (
                      <span className="reserva__badge">
                        {mesasSelecionadas.length > 1 ? 'Necessária' : 'Melhor encaixe'}
                      </span>
                    )}
                  </div>

                  {horarioEscolhido && (
                    <button
                      type="button"
                      className="reserva__link reserva__mesa-marcar"
                      aria-pressed={selecionada}
                      onClick={() => alternarMesa(mesa.id)}
                    >
                      {selecionada ? '✓ Selecionada (tocar para desmarcar)' : 'Selecionar esta mesa'}
                    </button>
                  )}

                  <div className="reserva__resumo-horarios">
                      <span>
                        {livres.length} horário{livres.length > 1 ? 's' : ''} livre{livres.length > 1 ? 's' : ''}
                        {': '}
                        {agruparHorarios(livres).join(' · ')}
                      </span>
                      {/* Sempre disponível: o cliente pode ocultar os horários mesmo depois de escolher um */}
                      <button
                        type="button"
                        className="reserva__link"
                        aria-expanded={aberta}
                        onClick={() => alternarMesaAberta(mesa.id)}
                      >
                        {aberta ? 'Ocultar horários' : 'Ver horários'}
                      </button>
                  </div>

                  {aberta && (
                  <div className="reserva__horarios" role="group" aria-label={`Horários livres da mesa ${mesa.numero}`}>
                    {livres.map((h) => (
                      <button
                        key={h}
                        className={`reserva__horario ${selecionada && horarioEscolhido === h ? 'reserva__horario--ativo' : ''}`}
                        onClick={() => escolherHorarioNaMesa(mesa, h)}
                      >
                        {h}
                      </button>
                    ))}
                  </div>
                  )}
                </div>
                );
              })
            )}
            {dispo && !carregandoMesas && !erroMesas && mesasSemHorario > 0 && mesasVisiveis.length > 0 && (
              <p className="reserva__aviso reserva__aviso--discreto">
                {mesasSemHorario} mesa{mesasSemHorario > 1 ? 's' : ''} sem horário livre {horarioEscolhido ? 'nesse horário' : 'neste dia'}.
              </p>
            )}
          </div>

          {/* Mobile: botão flutuante na base da tela */}
          <button type="button" className="reserva__btn-reservar reserva__btn-reservar--flutuante" onClick={handleReservar}>
            RESERVAR
          </button>
        </div>

      </div>
      </div>

      {/* ── Alerta de antecedência: abre com a tela, fecha no OK ── */}
      {avisoInicial && (
        <div className="reserva__overlay" role="dialog" aria-modal="true" aria-labelledby="reserva-aviso-titulo">
          <div className="reserva__modal">
            <div className="reserva__modal-inner">
              <p className="reserva__modal-subtitulo" id="reserva-aviso-titulo">Atenção aos horários</p>
              <p className="reserva__modal-texto">
                Só é possível reservar mesas com <strong>no mínimo {ANTECEDENCIA_MINIMA_HOJE_MIN / 60}h de antecedência</strong>.
                Também não é possível reservar fora do horário de funcionamento nem nos últimos{' '}
                {FOLGA_ANTES_DE_FECHAR_MIN} minutos antes de o restaurante fechar. Mostramos só os horários disponíveis.
              </p>
              <button className="reserva__modal-btn" onClick={() => setAvisoInicial(false)}>
                OK
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal de confirmação ── */}
      {showModal && !avisoInicial && (
        /**
         * Overlay — cobre toda a tela.
         * Clique fora do card fecha o modal.
         */
        <div className="reserva__overlay" onClick={handleFecharModal}>
          <div
            className="reserva__modal"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="reserva__modal-inner">
              {reservaCriada ? (
                <>
                  <p className="reserva__modal-subtitulo">Reserva enviada!</p>

                  <div className="reserva__modal-info">
                    <span className="reserva__modal-pill">
                      {formatarData(parseDateLocal(dataDaReserva(reservaCriada.base)))} às {horaDaIso(reservaCriada.base.hora_inicio)}
                    </span>
                    <span className="reserva__modal-pill">
                      {textoMesas(reservaCriada.mesas)} · {reservaCriada.pessoas} pessoa{reservaCriada.pessoas > 1 ? 's' : ''}
                    </span>
                  </div>

                  <p className="reserva__modal-texto">
                    {reservaCriada.falta > 0
                      ? `O restaurante não tem lugares para todos (faltam ${reservaCriada.falta}). Ele vai avaliar o seu pedido e pode aceitar com cadeiras extras. `
                      : 'O restaurante vai confirmar a sua reserva. '}
                    Você é avisado aqui no topo da tela e por e-mail.
                  </p>

                  <button className="reserva__modal-btn" onClick={handleFecharModal}>
                    OK
                  </button>
                </>
              ) : (
                <>
                  <p className="reserva__modal-subtitulo">Confirmar reserva</p>

                  <div className="reserva__modal-info">
                    <span className="reserva__modal-pill">
                      {labelData} às {horarioEscolhido}
                    </span>
                    <span className="reserva__modal-pill">
                      {textoMesas(mesasSelecionadas)} · {pessoas} pessoa{pessoas > 1 ? 's' : ''}
                    </span>
                    <span className="reserva__modal-pill">
                      Tempo na mesa: {duracao === 'indefinida' ? 'não sei ainda' : `${duracao / 60}h`}
                    </span>
                    {observacao && (
                      <span className="reserva__modal-obs">{observacao}</span>
                    )}
                  </div>

                  {faltaSelecionada > 0 && (
                    <p className="reserva__erro" role="alert">
                      O restaurante não tem lugares para todos (faltam {faltaSelecionada}). Ele vai receber um alerta e
                      decidir se aceita, por exemplo com cadeiras extras.
                    </p>
                  )}

                  <p className="reserva__modal-texto">
                    {mesasSelecionadas.length > 1 ? 'As mesas ficam reservadas' : 'A mesa fica reservada'} por {duracaoMin / 60}h a partir do horário escolhido.
                    Confirme os dados antes de finalizar a reserva.
                  </p>

                  {erroEnvio && <p className="reserva__erro" role="alert">{erroEnvio}</p>}

                  <button
                    className="reserva__modal-btn"
                    onClick={() => void handleConfirmarReserva()}
                    disabled={enviando}
                  >
                    {enviando ? 'ENVIANDO...' : 'CONFIRMAR'}
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      )}

    </CustomerLayout>
  );
};

export default Reserva;
