import React from "react";
import { useNavigate } from "react-router-dom";
import { FaMapMarkerAlt, FaClock, FaStore, FaClipboardList, FaCalendarAlt, FaArrowRight } from "react-icons/fa";
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
    horarios: [
      { dias: "Seg - Sex", horario: "18:00 - 23:00" },
      { dias: "Sáb - Dom", horario: "18:00 - 00:00" },
    ],
    tipoCozinha: "Italiana / Pizzas",
    boasVindas: "Bem-vindo(a)!",
    descricao:
      "Aqui você encontra o verdadeiro sabor da Itália, no conforto da sua casa!",
  };

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

          <h2 className="wc__boasvindas">{restaurante.boasVindas}</h2>
          <p className="wc__descricao">{restaurante.descricao}</p>
        </div>

        {/* Direita */}
        <div className="wc__right">
          <h1 className="wc__nome">{restaurante.nome}</h1>
          <p className="wc__status">{restaurante.status}</p>

          <div className="wc__info-card">
            <div className="wc__info-item">
              <span className="wc__info-icon">
                <FaMapMarkerAlt size={20} />
              </span>
              <span className="wc__info-label">Endereço</span>
              <span className="wc__info-valor">{restaurante.endereco}</span>
            </div>

            <div className="wc__info-item">
              <span className="wc__info-icon">
                <FaClock size={20} />
              </span>
              <span className="wc__info-label">Horário de funcionamento</span>
              {restaurante.horarios.map((h, i) => (
                <span key={i} className="wc__info-valor">
                  {h.dias} {h.horario}
                </span>
              ))}
            </div>

            <div className="wc__info-item">
              <span className="wc__info-icon">
                <FaStore size={20} />
              </span>
              <span className="wc__info-label">Tipo de cozinha</span>
              <span className="wc__info-valor">{restaurante.tipoCozinha}</span>
            </div>
          </div>

          <div className="wc__acoes">
            <button
              className="wc__btn wc__btn--pedido"
              onClick={() => navigate("/reserva")}
            >
              <FaCalendarAlt size={20} />
              <span>FAZER RESERVA</span>
              <FaArrowRight size={18} className="wc__btn-arrow" />
            </button>

            <button
              className="wc__btn wc__btn--cardapio"
              onClick={() => navigate("/menu")}
            >
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