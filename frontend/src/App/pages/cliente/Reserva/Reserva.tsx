import React, { useCallback, useEffect, useRef, useState } from 'react';
import { MdTableRestaurant } from 'react-icons/md';
import CustomerLayout from '../../../shared/components/layout/Customerlayout';
import { useClienteAuth } from '../../../shared/contexts/ClienteAuthContext';
import { useRestauranteCliente } from '../../../shared/contexts/RestauranteClienteContext';
import ReservaClienteService, {
  MesaDisponivel,
  Reserva as ReservaApi,
  dataDaReserva,
  horaDaIso,
  horaParaMinutos,
  hojeLocal,
} from '../../../services/reserva.service';
import { mensagemDeErro } from '../../../services/cliente.service';
import './Reserva.css';

// ── Constantes ─────────────────────────────────────────────────────
// A mesa fica segura por este tempo a partir do horário escolhido. É esse intervalo que o
// restaurante enxerga no Caixa e que bloqueia outras reservas da mesma mesa.
const DURACAO_RESERVA_MIN = 120;
const ULTIMO_MINUTO_DO_DIA = 23 * 60 + 59;
const MAX_PESSOAS = 20;

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

const doisDigitos = (n: number) => String(n).padStart(2, '0');

const minutosParaHora = (min: number): string =>
  `${doisDigitos(Math.floor(min / 60))}:${doisDigitos(min % 60)}`;

/** Horário final da reserva: início + duração, no máximo 23:59 (a reserva não atravessa a meia-noite). */
const horaFimDaReserva = (inicio: string): string =>
  minutosParaHora(Math.min(horaParaMinutos(inicio) + DURACAO_RESERVA_MIN, ULTIMO_MINUTO_DO_DIA));

/** Data (YYYY-MM-DD) e horário válidos para consultar/reservar, ou o motivo de não serem. */
const validarDataHora = (data: string, horario: string): string | null => {
  if (!data || !horario) return null;
  const hoje = hojeLocal();
  if (data < hoje) return 'Escolha uma data a partir de hoje.';
  if (horaParaMinutos(horario) >= ULTIMO_MINUTO_DO_DIA) return 'Escolha um horário até 23:58.';
  if (data === hoje) {
    const agora = new Date();
    if (horaParaMinutos(horario) <= agora.getHours() * 60 + agora.getMinutes()) {
      return 'Esse horário de hoje já passou. Escolha um horário mais tarde.';
    }
  }
  return null;
};

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
  const [observacao, setObservacao]           = useState('');
  const [mesaSelecionada, setMesaSelecionada] = useState<string | null>(null);
  const [showModal, setShowModal]             = useState(false);
  const [erro, setErro]                       = useState('');

  // Mesas livres (vindas da API) para a data/horário/pessoas escolhidos
  const [mesas, setMesas]                     = useState<MesaDisponivel[]>([]);
  const [carregandoMesas, setCarregandoMesas] = useState(false);
  const [erroMesas, setErroMesas]             = useState('');

  const [enviando, setEnviando]               = useState(false);
  const [erroEnvio, setErroEnvio]             = useState('');
  const [reservaCriada, setReservaCriada]     = useState<ReservaApi | null>(null);

  const [minhas, setMinhas]                   = useState<ReservaApi[]>([]);
  const [cancelandoId, setCancelandoId]       = useState<string | null>(null);
  const [erroMinhas, setErroMinhas]           = useState('');

  // Só a resposta da busca mais recente vale (o cliente muda data/hora/pessoas rapidamente)
  const buscaMesasReq = useRef(0);

  const erroDataHora = validarDataHora(dataSelecionada, horario);

  // ── Handlers de pessoas (mín 1, máx 20)
  const incrementarPessoas = () =>
    setPessoas((prev) => Math.min(prev + 1, MAX_PESSOAS));

  const decrementarPessoas = () =>
    setPessoas((prev) => Math.max(prev - 1, 1));

  // ── Busca as mesas livres no restaurante (tempo real: reflete o que o Caixa enxerga)
  const buscarMesas = useCallback(async () => {
    const req = ++buscaMesasReq.current;

    if (!slug || !dataSelecionada || !horario || erroDataHora) {
      setMesas([]);
      setErroMesas('');
      setCarregandoMesas(false);
      return;
    }

    setCarregandoMesas(true);
    setErroMesas('');
    try {
      const lista = await ReservaClienteService.mesasDisponiveis(slug, {
        data_reserva: dataSelecionada,
        hora_inicio: horario,
        hora_fim: horaFimDaReserva(horario),
        pessoas,
      });
      if (req !== buscaMesasReq.current) return;
      setMesas(lista);
      // A mesa escolhida pode ter sido reservada por outra pessoa nesse meio tempo
      setMesaSelecionada((atual) => (atual && lista.some((m) => m.id === atual) ? atual : null));
    } catch (err: any) {
      if (req !== buscaMesasReq.current) return;
      setMesas([]);
      setMesaSelecionada(null);
      setErroMesas(mensagemDeErro(err, 'Não foi possível carregar as mesas disponíveis.'));
    } finally {
      if (req === buscaMesasReq.current) setCarregandoMesas(false);
    }
  }, [slug, dataSelecionada, horario, pessoas, erroDataHora]);

  useEffect(() => {
    void buscarMesas();
  }, [buscarMesas]);

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

  // ── Validação e envio
  const handleReservar = () => {
    if (!dataSelecionada) {
      setErro('Selecione uma data para a reserva.');
      return;
    }
    if (!horario) {
      setErro('Informe o horário da reserva.');
      return;
    }
    if (erroDataHora) {
      setErro(erroDataHora);
      return;
    }
    if (!mesaSelecionada) {
      setErro('Selecione uma mesa disponível.');
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
    setObservacao('');
    setMesaSelecionada(null);
    setMesas([]);
  };

  const handleConfirmarReserva = async () => {
    if (enviando || !slug || !mesaSelecionada) return;

    setEnviando(true);
    setErroEnvio('');
    try {
      const criada = await ReservaClienteService.criar(slug, {
        mesa_id: mesaSelecionada,
        data_reserva: dataSelecionada,
        hora_inicio: horario,
        hora_fim: horaFimDaReserva(horario),
        num_pessoas: pessoas,
        ...(observacao.trim() && { observacoes: observacao.trim() }),
      });
      setReservaCriada(criada);
      limparFormulario();
      void carregarMinhas();
    } catch (err: any) {
      setErroEnvio(mensagemDeErro(err, 'Não foi possível fazer a reserva. Tente novamente.'));
      // 409 = outra pessoa pegou a mesa agora há pouco: atualiza a lista de livres
      if (err?.response?.status === 409) void buscarMesas();
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
      void buscarMesas(); // a mesa volta a aparecer como livre
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

  // ── Mesa selecionada (para o modal)
  const mesaConfirmada = mesas.find((m) => m.id === mesaSelecionada);
  const reservasAtivas = minhas.filter((r) => r.status === 'PENDENTE' || r.status === 'CONFIRMADA');

  // ── Render
  return (
    <CustomerLayout mode="logged">
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
                      if (erro) setErro('');
                    }}
                  />
                  {dataSelecionada && (
                    <span className="reserva__date-overlay">{labelData}</span>
                  )}
                </div>
              </div>

          {/* Horário */}
          <div className="reserva__campo">
            <label className="reserva__label">HORÁRIO</label>
            <input
              type="time"
              className="reserva__input reserva__input--time"
              value={horario}
              onChange={(e) => {
                setHorario(e.target.value);
                if (erro) setErro('');
              }}
            />
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
          {(erroDataHora || erro) && (
            <p className="reserva__erro" role="alert">{erroDataHora || erro}</p>
          )}
        </div>

        {/* ── Lista de mesas ── */}
        <div className="reserva__painel">
          <p className="reserva__painel-titulo">
            Mesas disponíveis
            {dataSelecionada && horario && !erroDataHora && !carregandoMesas && !erroMesas
              ? ` (${mesas.length})`
              : ''}
          </p>

          <div className="reserva__mesas">
            {!dataSelecionada || !horario ? (
              <p className="reserva__aviso">Escolha a data e o horário para ver as mesas livres.</p>
            ) : erroDataHora ? null : carregandoMesas ? (
              <p className="reserva__aviso">Buscando mesas livres...</p>
            ) : erroMesas ? (
              <p className="reserva__aviso reserva__aviso--erro" role="alert">
                {erroMesas}{' '}
                <button className="reserva__link" onClick={() => void buscarMesas()}>Tentar de novo</button>
              </p>
            ) : mesas.length === 0 ? (
              <p className="reserva__aviso">
                Nenhuma mesa livre para {pessoas} pessoa{pessoas > 1 ? 's' : ''} nesse horário.
                Tente outro horário ou outra data.
              </p>
            ) : (
              mesas.map((mesa) => (
                <button
                  key={mesa.id}
                  className={`reserva__mesa ${mesaSelecionada === mesa.id ? 'reserva__mesa--ativa' : ''}`}
                  onClick={() => {
                    setMesaSelecionada(mesa.id);
                    if (erro) setErro('');
                  }}
                >
                  <MdTableRestaurant className="reserva__mesa-icon" />
                  <span className="reserva__mesa-label">
                    MESA {mesa.numero}- {mesa.capacidade} lugares
                    {mesa.localizacao ? <small className="reserva__mesa-local">{mesa.localizacao}</small> : null}
                  </span>
                </button>
              ))
            )}
          </div>

          <button className="reserva__btn-reservar" onClick={handleReservar}>
            RESERVAR
          </button>

          {/* ── Minhas reservas ── */}
          {(reservasAtivas.length > 0 || erroMinhas) && (
            <div className="reserva__minhas">
              <p className="reserva__painel-titulo">Minhas reservas</p>
              {erroMinhas && <p className="reserva__aviso reserva__aviso--erro" role="alert">{erroMinhas}</p>}
              {reservasAtivas.map((r) => (
                <div key={r.id} className="reserva__minha">
                  <div className="reserva__minha-info">
                    <strong>
                      {formatarData(parseDateLocal(dataDaReserva(r)))} · {horaDaIso(r.hora_inicio)}
                    </strong>
                    <span>
                      {r.mesa ? `Mesa ${r.mesa.numero} · ` : ''}{r.num_pessoas} pessoa{r.num_pessoas > 1 ? 's' : ''}
                    </span>
                    <span className={`reserva__status reserva__status--${r.status.toLowerCase()}`}>
                      {ROTULO_STATUS[r.status] ?? r.status}
                    </span>
                  </div>
                  <button
                    className="reserva__link reserva__link--perigo"
                    onClick={() => void handleCancelarReserva(r.id)}
                    disabled={cancelandoId === r.id}
                  >
                    {cancelandoId === r.id ? 'Cancelando...' : 'Cancelar'}
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

      </div>

      {/* ── Modal de confirmação ── */}
      {showModal && (
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
                      {formatarData(parseDateLocal(dataDaReserva(reservaCriada)))} às {horaDaIso(reservaCriada.hora_inicio)}
                    </span>
                    <span className="reserva__modal-pill">
                      Mesa {reservaCriada.mesa?.numero} · {reservaCriada.num_pessoas} pessoa{reservaCriada.num_pessoas > 1 ? 's' : ''}
                    </span>
                  </div>

                  <p className="reserva__modal-texto">
                    O restaurante vai confirmar a sua reserva. Você acompanha o status em “Minhas reservas”.
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
                      {labelData} às {horario}
                    </span>
                    <span className="reserva__modal-pill">
                      Mesa {mesaConfirmada?.numero} · {pessoas} pessoa{pessoas > 1 ? 's' : ''}
                    </span>
                    {observacao && (
                      <span className="reserva__modal-obs">{observacao}</span>
                    )}
                  </div>

                  <p className="reserva__modal-texto">
                    A mesa fica reservada por {DURACAO_RESERVA_MIN / 60}h a partir do horário escolhido.
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