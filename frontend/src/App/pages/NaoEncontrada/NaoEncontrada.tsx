import React, { useEffect } from "react";
import { ThemeToggleFlutuante } from "../../shared/components/ThemeToggleFlutuante/ThemeToggleFlutuante";
import "./NaoEncontrada.css";

// Página 404, usada na rota path="*" no fim do <Routes>.
// O botão usa window.location em vez de navigate porque a landing é um HTML estático, fora do React.
const NaoEncontrada: React.FC = () => {
  useEffect(() => {
    const tituloAnterior = document.title;
    document.title = "Página não encontrada | MenuPoint";
    return () => {
      document.title = tituloAnterior;
    };
  }, []);

  return (
    <main className="nao-encontrada">
      <ThemeToggleFlutuante />
      <div className="nao-encontrada__content">
        <img
          src="/images/embreve.webp"
          alt="Mascote MenuPoint"
          className="nao-encontrada__mascote"
        />

        <div className="nao-encontrada__texto">
          <p className="nao-encontrada__codigo">404</p>
          <h1 className="nao-encontrada__titulo">
            <span className="destaque">Página</span>
            <br />
            <span className="laranja">não encontrada!</span>
          </h1>
          <div className="nao-encontrada__divisor" />
          <p className="nao-encontrada__descricao">
            O endereço que você digitou não existe ou foi removido. Confira o link ou volte para a tela
            inicial.
          </p>

          <button
            type="button"
            className="nao-encontrada__botao"
            onClick={() => window.location.assign("/site/index.html")}
          >
            Ir para a tela inicial
          </button>
        </div>
      </div>
    </main>
  );
};

export default NaoEncontrada;
