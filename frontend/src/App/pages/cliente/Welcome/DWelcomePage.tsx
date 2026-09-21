import React from "react";
import { useNavigate } from "react-router-dom";
import CustomerLayout from "../../../shared/components/layout/Customerlayout";
import "./DWelcomePage.css";

const DWelcomePage: React.FC = () => {
  const navigate = useNavigate();

  // ── Dados mockados. Substituir por API futuramente ──
  const restaurante = {
    nome: "PIZZARIA",
    logo: "/images/Menu/pizza.jpg",
    endereco: "Rua XV de Novembro, 1000",
    status: "Aberto",
    movimento: "Tranquilo",
    horarios: [
      { dias: "Seg - Sex", horario: "18:00 - 23:00" },
      { dias: "Sáb - Dom", horario: "18:00 - 00:00" },
    ],
  };

  const movimentoCor: Record<string, string> = {
    Tranquilo: "#7ab648",
    Médio: "#e6a817",
    Lotado: "#c0392b",
  };

  const cor = movimentoCor[restaurante.movimento] ?? "#888";

  return (
    <CustomerLayout mode="logged">
      <div className="wc">
        {/* Esquerda */}
        <div className="wc__left">
          <div className="wc__logo-wrap">
            <img
              src={restaurante.logo}
              alt="Logo do restaurante"
              className="wc__logo"
            />
          </div>

          <p className="wc__endereco">{restaurante.endereco}</p>

          <div className="wc__horarios">
            <span className="wc__horarios-title">Horário</span>
            {restaurante.horarios.map((h, i) => (
              <div key={i} className="wc__horario-item">
                <span>{h.dias}</span>
                <span>{h.horario}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Direita */}
        <div className="wc__right">
          <h1 className="wc__nome">{restaurante.nome}</h1>

          <div className="wc__info-card">
            <span
              className="wc__status"
              style={{
                color: restaurante.status === "Aberto" ? "#7ab648" : "#c0392b",
              }}
            >
              {restaurante.status}
            </span>

            <p className="wc__movimento-title">check de movimento</p>

            {/* Níveis */}
            <div className="wc__movimento-legenda">
              <div className="wc__nivel">
                <span className="wc__nivel-label" style={{ color: "#7ab648" }}>
                  TRANQUILO
                </span>
                <span className="wc__nivel-tempo">tempo médio: 10 min</span>
              </div>
              <div className="wc__nivel">
                <span className="wc__nivel-label" style={{ color: "#e6a817" }}>
                  MÉDIO
                </span>
                <span className="wc__nivel-tempo">tempo médio: 20 min</span>
              </div>
              <div className="wc__nivel">
                <span className="wc__nivel-label" style={{ color: "#c0392b" }}>
                  LOTADO
                </span>
                <span className="wc__nivel-tempo">tempo médio: 1h</span>
              </div>
            </div>

            {/* Movimento */}
            <div className="wc__movimento-atual">
              <span className="wc__movimento-texto">Movimento agora:</span>
              <span
                className="wc__movimento-bolinha"
                style={{ backgroundColor: cor }}
              />
              <span className="wc__movimento-valor" style={{ color: cor }}>
                {restaurante.movimento}
              </span>
            </div>
            <div className="wc__acoes">
              <div className="wc__acao-grupo">
                <p className="wc__acao-label">Faça sua reserva!</p>
                <button
                  className="wc__btn wc__btn--reserva"
                  onClick={() => navigate("/reserva")}
                >
                  FAZER RESERVA
                </button>
              </div>

              <span className="wc__ou">ou</span>

              <div className="wc__acao-grupo">
                <p className="wc__acao-label">Acesse nosso cardápio</p>
                <button
                  className="wc__btn wc__btn--cardapio"
                  onClick={() => navigate("/menu")}
                >
                  CARDÁPIO
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </CustomerLayout>
  );
};

export default DWelcomePage;
