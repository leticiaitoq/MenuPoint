import React, { useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { HiUpload, HiPencil, HiOfficeBuilding, HiX } from 'react-icons/hi';
import { MdAccessTime } from 'react-icons/md';
import RestaurantLayout from '../../../shared/components/layout/Restaurantelayout';
import './Config.css';

// ── Tipos 
interface HorarioFuncionamento {
  diaSemana: string;
  abertura: string;
  fechamento: string;
}

interface HorarioPeriodo {
  label: string;
  abertura: string;
  fechamento: string;
}

interface ConfiguracaoRestaurante {
  nome: string;
  endereco: string;
  bairro: string;
  cep: string;
  cidade: string;
  estado: string;
  horario: HorarioFuncionamento;
}

// ── Dados estáticos (substituir por API) 
const DIAS_SEMANA = [
  'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado', 'Domingo',
];

const HORARIOS = Array.from({ length: 24 }, (_, i) => {
  const hora = String(i).padStart(2, '0');
  return `${hora}:00`;
});

// Mock de horários gerais por período (substituir por API)
const HORARIOS_GERAIS: HorarioPeriodo[] = [
  { label: 'Segunda a Sexta', abertura: '11:00', fechamento: '23:00' },
  { label: 'Sábado',          abertura: '12:00', fechamento: '00:00' },
  { label: 'Domingo',         abertura: '12:00', fechamento: '22:00' },
];

const CONFIG_INICIAL: ConfiguracaoRestaurante = {
  nome:     'Bistrô Sabor & Cia',
  endereco: 'Rua das Flores, 123',
  bairro:   'Centro',
  cep:      '01234-567',
  cidade:   'São Paulo',
  estado:   'SP',
  horario:  { diaSemana: 'Segunda', abertura: '18:00', fechamento: '23:00' },
};

// ── Componente 
const Config: React.FC = () => {
  const navigate                              = useNavigate();
  const [config, setConfig]                   = useState<ConfiguracaoRestaurante>(CONFIG_INICIAL);
  const [previewFoto, setPreviewFoto]         = useState<string | null>(null);
  const [salvando, setSalvando]               = useState(false);
  const [salvoComSucesso, setSalvoComSucesso] = useState(false);
  const [modalHorario, setModalHorario]       = useState(false);
  const inputFotoRef                          = useRef<HTMLInputElement>(null);

  // ── Handlers genéricos
  const handleCampo = (campo: keyof ConfiguracaoRestaurante, valor: string) => {
    setConfig((prev) => ({ ...prev, [campo]: valor }));
  };

  const handleHorario = (campo: keyof HorarioFuncionamento, valor: string) => {
    setConfig((prev) => ({
      ...prev,
      horario: { ...prev.horario, [campo]: valor },
    }));
  };

  // ── UF: só letras, máx 2 caracteres, maiúsculo
  const handleEstado = (e: React.ChangeEvent<HTMLInputElement>) => {
    const valor = e.target.value.replace(/[^a-zA-Z]/g, '').toUpperCase().slice(0, 2);
    handleCampo('estado', valor);
  };

  // ── Upload de foto
  const handleFotoSelecionada = (e: React.ChangeEvent<HTMLInputElement>) => {
    const arquivo = e.target.files?.[0];
    if (!arquivo) return;
    setPreviewFoto(URL.createObjectURL(arquivo));
  };

  // ── Salvar (simula chamada à API)
  const handleSalvar = async () => {
    setSalvando(true);
    await new Promise((resolve) => setTimeout(resolve, 1000));
    setSalvando(false);
    setSalvoComSucesso(true);
  };

  // ── Render
  return (
    <RestaurantLayout>
      <div className="config">

        <h2 className="config__titulo">Configurações</h2>

        {/* ── Informações do Restaurante ── */}
        <div className="config__card">
          <h3 className="config__card-titulo">Informações do Restaurante</h3>

          <div className="config__info-row">

            <img
              className="config__avatar"
              src={previewFoto ?? '/icons/restaurant-avatar.png'}
              alt="Foto do restaurante"
            />

            <div className="config__campo config__campo--flex">
              <label className="config__label" htmlFor="nomeRestaurante">
                Nome do Restaurante:
              </label>
              <div className="config__input-icone-wrap">
                <input
                  id="nomeRestaurante"
                  className="config__input"
                  type="text"
                  value={config.nome}
                  onChange={(e) => handleCampo('nome', e.target.value)}
                />
                <HiPencil className="config__input-icon" />
              </div>
              <p className="config__hint">Este nome será exibido para os seus clientes.</p>

              <button
                className="config__btn-filial"
                type="button"
                onClick={() => navigate('/')}
              >
                <HiOfficeBuilding /> Cadastrar Filial
              </button>
            </div>

            <div className="config__foto-col">
              <label className="config__label">Foto do Restaurante:</label>
              <button
                className="config__btn-foto"
                type="button"
                onClick={() => inputFotoRef.current?.click()}
              >
                <HiUpload /> Alterar Foto
              </button>
              <p className="config__hint">
                Formato recomendado:<br />JPG ou PNG (máx. 5MB)
              </p>
              <input
                ref={inputFotoRef}
                type="file"
                accept="image/jpeg,image/png"
                style={{ display: 'none' }}
                onChange={handleFotoSelecionada}
              />
            </div>

          </div>
        </div>

        {/* ── Endereço do Restaurante ── */}
        <div className="config__card">
          <h3 className="config__card-titulo">Endereço do Restaurante</h3>

          <div className="config__endereco-grid">

            <div className="config__campo config__campo--endereco">
              <label className="config__label" htmlFor="endereco">Endereço:</label>
              <input
                id="endereco"
                className="config__input"
                type="text"
                value={config.endereco}
                onChange={(e) => handleCampo('endereco', e.target.value)}
              />
            </div>

            <div className="config__campo config__campo--bairro">
              <label className="config__label" htmlFor="bairro">Bairro:</label>
              <input
                id="bairro"
                className="config__input"
                type="text"
                value={config.bairro}
                onChange={(e) => handleCampo('bairro', e.target.value)}
              />
            </div>

            <div className="config__campo config__campo--cep">
              <label className="config__label" htmlFor="cep">CEP:</label>
              <input
                id="cep"
                className="config__input"
                type="text"
                value={config.cep}
                maxLength={9}
                onChange={(e) => handleCampo('cep', e.target.value)}
              />
            </div>

            <div className="config__campo config__campo--cidade">
              <label className="config__label" htmlFor="cidade">Cidade:</label>
              <input
                id="cidade"
                className="config__input"
                type="text"
                value={config.cidade}
                onChange={(e) => handleCampo('cidade', e.target.value)}
              />
            </div>

            <div className="config__campo config__campo--estado">
              <label className="config__label" htmlFor="estado">Estado:</label>
              <input
                id="estado"
                className="config__input config__input--uf"
                type="text"
                value={config.estado}
                onChange={handleEstado}
                placeholder="UF"
                maxLength={2}
              />
            </div>

          </div>
        </div>

        {/* ── Horários de Funcionamento ── */}
        <div className="config__card">
          <h3 className="config__card-titulo">Horários de Funcionamento</h3>

          <div className="config__horario-row">

            <select
              className="config__select config__select--dia"
              value={config.horario.diaSemana}
              onChange={(e) => handleHorario('diaSemana', e.target.value)}
              aria-label="Dia da semana"
            >
              {DIAS_SEMANA.map((dia) => (
                <option key={dia} value={dia}>{dia}</option>
              ))}
            </select>

            <select
              className="config__select config__select--hora"
              value={config.horario.abertura}
              onChange={(e) => handleHorario('abertura', e.target.value)}
              aria-label="Horário de abertura"
            >
              {HORARIOS.map((h) => (
                <option key={h} value={h}>{h}</option>
              ))}
            </select>

            <span className="config__horario-ate">até</span>

            <select
              className="config__select config__select--hora"
              value={config.horario.fechamento}
              onChange={(e) => handleHorario('fechamento', e.target.value)}
              aria-label="Horário de fechamento"
            >
              {HORARIOS.map((h) => (
                <option key={h} value={h}>{h}</option>
              ))}
            </select>

            <button
              className="config__btn-checar"
              type="button"
              onClick={() => setModalHorario(true)}
            >
              <MdAccessTime /> Checar horario geral
            </button>

          </div>
        </div>

        {/* ── Botão salvar ── */}
        <button
          className="config__btn-salvar"
          type="button"
          onClick={handleSalvar}
          disabled={salvando}
        >
          {salvando ? '⏳ Salvando...' : '💾 Salvar Configurações'}
        </button>

      </div>

      {/* ── Modal: Horário Geral ── */}
      {modalHorario && (
        <div className="config__overlay" onClick={() => setModalHorario(false)}>
          <div className="config__modal" onClick={(e) => e.stopPropagation()}>

            <div className="config__modal-header">
              <div className="config__modal-header-esq">
                <MdAccessTime className="config__modal-header-icon" />
                <h3>Horário Geral de Funcionamento</h3>
              </div>
              <button
                className="config__modal-fechar"
                onClick={() => setModalHorario(false)}
                aria-label="Fechar modal"
              >
                <HiX />
              </button>
            </div>

            <div className="config__modal-corpo">
              {HORARIOS_GERAIS.map((periodo) => (
                <div key={periodo.label} className="config__horario-item">
                  <span className="config__horario-item-label">{periodo.label}</span>
                  <span className="config__horario-item-horas">
                    {periodo.abertura} – {periodo.fechamento}
                  </span>
                </div>
              ))}
            </div>

            <div className="config__modal-acoes">
              <button
                className="config__modal-btn-fechar"
                onClick={() => setModalHorario(false)}
              >
                Fechar
              </button>
            </div>

          </div>
        </div>
      )}

      {/* ── Popup de sucesso ── */}
      {salvoComSucesso && (
        <div className="config__overlay" onClick={() => setSalvoComSucesso(false)}>
          <div className="config__popup" onClick={(e) => e.stopPropagation()}>
            <span className="config__popup-icon">✅</span>
            <h3>Configurações salvas!</h3>
            <p>As informações do restaurante foram atualizadas com sucesso.</p>
            <button
              className="config__btn-salvar"
              onClick={() => setSalvoComSucesso(false)}
            >
              OK
            </button>
          </div>
        </div>
      )}

    </RestaurantLayout>
  );
};

export default Config;