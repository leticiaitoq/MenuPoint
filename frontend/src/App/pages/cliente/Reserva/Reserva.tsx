import React, { useState } from 'react';
import { MdTableRestaurant } from 'react-icons/md';
import CustomerLayout from '../../../shared/components/layout/Customerlayout';
import './Reserva.css';

// ── Tipos ──────────────────────────────────────────────

interface Mesa {
  id: string;
  numero: number;
  lugares: number;
}

// ── Dados mockados ─────────────────────────────────────
// Futuramente virão da API via useEffect

const MESAS_DISPONIVEIS: Mesa[] = [
  { id: 'mesa-1', numero: 1, lugares: 4 },
  { id: 'mesa-2', numero: 2, lugares: 4 },
  { id: 'mesa-3', numero: 3, lugares: 4 },
  { id: 'mesa-4', numero: 4, lugares: 4 },
  { id: 'mesa-5', numero: 5, lugares: 4 },
  { id: 'mesa-6', numero: 6, lugares: 4 },
];

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

// ── Componente ─────────────────────────────────────────

const Reserva: React.FC = () => {
  // ── Estados
  const [dataSelecionada, setDataSelecionada] = useState('');
  const [horario, setHorario]                 = useState('');
  const [pessoas, setPessoas]                 = useState(2);
  const [observacao, setObservacao]           = useState('');
  const [mesaSelecionada, setMesaSelecionada] = useState<string | null>(null);
  const [showModal, setShowModal]             = useState(false);
  const [erro, setErro]                       = useState('');

  // ── Handlers de pessoas (mín 1, máx 20)
  const incrementarPessoas = () =>
    setPessoas((prev) => Math.min(prev + 1, 20));

  const decrementarPessoas = () =>
    setPessoas((prev) => Math.max(prev - 1, 1));

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
    if (!mesaSelecionada) {
      setErro('Selecione uma mesa disponível.');
      return;
    }
    setErro('');
    setShowModal(true);
  };

  const handleConfirmarReserva = () => {
    /**
     * Chamar API aqui depoois
     * const payload = { dataSelecionada, horario, pessoas, observacao, mesaSelecionada };
     */
    setShowModal(false);
    // Limpar formulário após confirmar
    setDataSelecionada('');
    setHorario('');
    setPessoas(2);
    setObservacao('');
    setMesaSelecionada(null);
  };

  const handleFecharModal = () => setShowModal(false);

  // ── Label da data exibida no campo
  const labelData = dataSelecionada
    ? formatarData(parseDateLocal(dataSelecionada))
    : 'Selecione uma data';

  // ── Mesa selecionada (para o modal)
  const mesaConfirmada = MESAS_DISPONIVEIS.find((m) => m.id === mesaSelecionada);

  // ── Render
  return (
    <CustomerLayout mode="logged">
      <div className="reserva">

        {/* ── Formulário ── */}
        <div className="reserva__card">

          {/* Imagem no canto superior direito — position absolute no CSS */}
          <img
            src="/images/mesa.png"
            alt="Ilustração de mesa de restaurante"
            className="reserva__ilustracao"
          />

          <h1 className="reserva__titulo">RESERVA DE MESAS</h1>

          {/* Data */}
          <div className="reserva__campo">
                <label className="reserva__label">DATA</label>
                <div className="reserva__input-wrapper">
                  <input
                    type="date"
                    className="reserva__date-input"
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

          {/* Erro */}
          {erro && <p className="reserva__erro">{erro}</p>}
        </div>

        {/* ── Lista de mesas ── */}
        <div className="reserva__painel">
          <p className="reserva__painel-titulo">Mesas disponíveis</p>

          <div className="reserva__mesas">
            {MESAS_DISPONIVEIS.map((mesa) => (
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
                  MESA {mesa.numero}- {mesa.lugares} lugares
                </span>
              </button>
            ))}
          </div>

          <button className="reserva__btn-reservar" onClick={handleReservar}>
            RESERVAR
          </button>
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
                Confirme os dados antes de finalizar a reserva.
              </p>

              <button
                className="reserva__modal-btn"
                onClick={handleConfirmarReserva}
              >
                CONFIRMAR
              </button>
            </div>
          </div>
        </div>
      )}

    </CustomerLayout>
  );
};

export default Reserva;