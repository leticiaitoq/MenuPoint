import React from 'react';
import './ContadorCaracteres.css';

interface ContadorCaracteresProps {
  /** Texto atual do campo (usa .length) */
  valor: string;
  /** Mesmo valor do maxLength do campo */
  max: number;
}

/** Mostra "12/150" abaixo do campo; fica amarelo perto do limite e vermelho no limite. */
const ContadorCaracteres: React.FC<ContadorCaracteresProps> = ({ valor, max }) => {
  const atual = valor.length;
  const nivel =
    atual >= max ? ' contador-caracteres--limite'
    : atual >= max * 0.9 ? ' contador-caracteres--aviso'
    : '';

  return (
    <small className={`contador-caracteres${nivel}`} aria-live="polite">
      {atual}/{max}
    </small>
  );
};

/** Dica de limite para campos que não são texto livre (ex.: preço). */
export const DicaLimite: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <small className="contador-caracteres">{children}</small>
);

export default ContadorCaracteres;
