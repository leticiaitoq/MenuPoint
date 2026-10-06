import React from "react";
import { useNavigate } from "react-router-dom";
import { FaMapMarkerAlt, FaClock, FaStore, FaClipboardList, FaCalendarAlt, FaArrowRight, FaMotorcycle } from "react-icons/fa";
import CustomerLayout from "../../../shared/components/layout/Customerlayout";
import { useClienteAuth } from "../../../shared/contexts/ClienteAuthContext";
import { useRestauranteCliente } from "../../../shared/contexts/RestauranteClienteContext";
import type { DiaSemana, HorarioFuncionamento } from "../../../services/estabelecimento.service";
import "./DWelcomePage.css";

const DIAS: [DiaSemana, string][] = [
  ["segunda", "Seg"], ["terca", "Ter"], ["quarta", "Qua"], ["quinta", "Qui"],
  ["sexta", "Sex"], ["sabado", "Sáb"], ["domingo", "Dom"],
];

const textoDoDia = (h: HorarioFuncionamento, dia: DiaSemana) => {
  const d = h[dia];
  return d?.aberto && d.abertura && d.fechamento ? `${d.abertura} - ${d.fechamento}` : "Fechado";
};

/** Agrupa dias seguidos com o mesmo horário: "Seg - Sex 18:00 - 23:00" */
const resumirHorarios = (h: HorarioFuncionamento | null) => {
  if (!h) return [];
  const grupos: { inicio: string; fim: string; horario: string }[] = [];
  DIAS.forEach(([chave, rotulo]) => {
    const horario = textoDoDia(h, chave);
    const ultimo = grupos[grupos.length - 1];
    if (ultimo && ultimo.horario === horario) ultimo.fim = rotulo;
    else grupos.push({ inicio: rotulo, fim: rotulo, horario });
  });
  return grupos.map((g) => ({
    dias: g.inicio === g.fim ? g.inicio : `${g.inicio} - ${g.fim}`,
    horario: g.horario,
  }));
};

const estaAberto = (h: HorarioFuncionamento | null): boolean => {
  if (!h) return false;
  const agora = new Date();
  const hoje = h[DIAS[(agora.getDay() + 6) % 7][0]];
  if (!hoje?.aberto || !hoje.abertura || !hoje.fechamento) return false;
  const hhmm = agora.toTimeString().slice(0, 5);
  // fechamento <= abertura = atravessa a meia-noite (ex.: 18:00 - 00:00)
  return hoje.fechamento > hoje.abertura
    ? hhmm >= hoje.abertura && hhmm < hoje.fechamento
    : hhmm >= hoje.abertura || hhmm < hoje.fechamento;
};

const dinheiro = (v: string | number) => `R$ ${Number(v).toFixed(2).replace(".", ",")}`;

const DWelcomePage: React.FC = () => {
  const navigate = useNavigate();
  const { cliente } = useClienteAuth();
  const { restaurante, carregando, erro, slug } = useRestauranteCliente();

  if (!slug || carregando || erro || !restaurante) {
    return (
      <CustomerLayout mode="logged">
        <div className="wc" style={{ justifyContent: "center", textAlign: "center" }}>
          <p>
            {carregando
              ? "Carregando restaurante..."
              : erro ?? "Nenhum restaurante selecionado. Abra o link que o restaurante divulgou."}
          </p>
        </div>
      </CustomerLayout>
    );
  }

  const e = restaurante.endereco;
  const endereco = e
    ? [e.rua && `${e.rua}${e.numero ? `, ${e.numero}` : ""}`, e.bairro, e.cidade].filter(Boolean).join(" - ")
    : "Endereço não informado";
  const horarios = resumirHorarios(restaurante.horario_funcionamento);
  const primeiroNome = cliente?.nome?.split(" ")[0];

  return (
    <CustomerLayout mode="logged">
      <div className="wc">
        {/* Esquerda */}
        <div className="wc__left">
          <div className="wc__logo-wrap">
            <img
              src={restaurante.logo_url ?? "/icons/restaurant-logo.png"}
              alt="Logo do restaurante"
              className="wc__logo"
            />
          </div>

          <h2 className="wc__boasvindas">
            {primeiroNome ? `Bem-vindo(a), ${primeiroNome}!` : "Bem-vindo(a)!"}
          </h2>
          <p className="wc__descricao">
            Entrega em {restaurante.tempo_entrega_min}–{restaurante.tempo_entrega_max} min · Taxa{" "}
            {dinheiro(restaurante.taxa_entrega)}
          </p>
        </div>

        {/* Direita */}
        <div className="wc__right">
          <h1 className="wc__nome">{restaurante.nome}</h1>
          <p className="wc__status">{estaAberto(restaurante.horario_funcionamento) ? "Aberto" : "Fechado"}</p>

          <div className="wc__info-card">
            <div className="wc__info-item">
              <span className="wc__info-icon"><FaMapMarkerAlt size={20} /></span>
              <span className="wc__info-label">Endereço</span>
              <span className="wc__info-valor">{endereco}</span>
            </div>

            <div className="wc__info-item">
              <span className="wc__info-icon"><FaClock size={20} /></span>
              <span className="wc__info-label">Horário de funcionamento</span>
              {horarios.length === 0 ? (
                <span className="wc__info-valor">Não informado</span>
              ) : (
                horarios.map((h, i) => (
                  <span key={i} className="wc__info-valor">{h.dias} {h.horario}</span>
                ))
              )}
            </div>

            {restaurante.tipo_cozinha && (
              <div className="wc__info-item">
                <span className="wc__info-icon"><FaStore size={20} /></span>
                <span className="wc__info-label">Tipo de cozinha</span>
                <span className="wc__info-valor">{restaurante.tipo_cozinha}</span>
              </div>
            )}

            <div className="wc__info-item">
              <span className="wc__info-icon"><FaMotorcycle size={20} /></span>
              <span className="wc__info-label">Pedido mínimo</span>
              <span className="wc__info-valor">{dinheiro(restaurante.pedido_minimo)}</span>
            </div>
          </div>

          <div className="wc__acoes">
            <button className="wc__btn wc__btn--pedido" onClick={() => navigate("/reserva")}>
              <FaCalendarAlt size={20} />
              <span>FAZER RESERVA</span>
              <FaArrowRight size={18} className="wc__btn-arrow" />
            </button>

            <button className="wc__btn wc__btn--cardapio" onClick={() => navigate("/menu")}>
              <FaClipboardList size={20} />
              <span>VER CARDÁPIO</span>
              <FaArrowRight size={18} className="wc__btn-arrow" />
            </button>
          </div>
        </div>
      </div>
    </CustomerLayout>
  );
};

export default DWelcomePage;
