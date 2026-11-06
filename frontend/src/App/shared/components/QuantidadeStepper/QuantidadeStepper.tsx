import React from 'react';
import { HiMinus, HiPlus } from 'react-icons/hi';
import './QuantidadeStepper.css';

/**
 * Seletor de quantidade (− valor +), usado nos cadastros do restaurante e na personalização do cliente.
 * Os botões desabilitam sozinhos ao chegar no mínimo/máximo.
 */
interface QuantidadeStepperProps {
  valor: number;
  min?: number;
  max?: number;
  onChange: (novo: number) => void;
  disabled?: boolean;
  /** Nome do que está sendo contado, para leitores de tela (ex.: "Pão") */
  rotulo?: string;
  /** 'sm' deixa o seletor mais compacto (tabelas e formulários) */
  tamanho?: 'sm' | 'md';
}

const QuantidadeStepper: React.FC<QuantidadeStepperProps> = ({
  valor, min = 0, max = 20, onChange, disabled, rotulo, tamanho = 'md',
}) => (
  <div className={`qstepper qstepper--${tamanho}`} role="group" aria-label={rotulo ? `Quantidade de ${rotulo}` : 'Quantidade'}>
    <button
      type="button"
      className="qstepper__btn"
      onClick={() => onChange(Math.max(min, valor - 1))}
      disabled={disabled || valor <= min}
      aria-label={rotulo ? `Diminuir ${rotulo}` : 'Diminuir'}
    >
      <HiMinus aria-hidden="true" />
    </button>
    <span className="qstepper__valor" aria-live="polite">{valor}</span>
    <button
      type="button"
      className="qstepper__btn"
      onClick={() => onChange(Math.min(max, valor + 1))}
      disabled={disabled || valor >= max}
      aria-label={rotulo ? `Aumentar ${rotulo}` : 'Aumentar'}
    >
      <HiPlus aria-hidden="true" />
    </button>
  </div>
);

export default QuantidadeStepper;
