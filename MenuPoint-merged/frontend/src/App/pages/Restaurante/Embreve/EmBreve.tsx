// src/pages/EmBreve.tsx
import { useNavigate } from "react-router-dom";
import RestaurantLayout from '../../../shared/components/layout/Restaurantelayout';
import "./EmBreve.css";

export function EmBreve() {
  const navigate = useNavigate();

  return (
    < RestaurantLayout>
    <div className="em-breve">
      <div className="em-breve__content">
        <img
          src="/images/embreve.png"
          alt="Mascote MenuPoint"
          className="em-breve__mascote"
        />

        <div className="em-breve__texto">
          <h1 className="em-breve__titulo">
            <span className="destaque">Estamos</span><br />
            <span className="laranja">trabalhando nisso!</span>
          </h1>
          <div className="em-breve__divisor" />
          <p className="em-breve__descricao">
            Esta funcionalidade está em desenvolvimento e estará disponível em breve.
          </p>
          <p className="em-breve__agradecimento">Agradecemos a sua compreensão!</p>

          <button className="em-breve__botao" onClick={() => navigate("/restaurante/home")}>
            Voltar para o inicio
          </button>
        </div>

        <img
          src="/images/embreve2.png"
          alt="Em construção"
          className="em-breve__placa"
        />
      </div>
    </div>
    </RestaurantLayout>
  );
}