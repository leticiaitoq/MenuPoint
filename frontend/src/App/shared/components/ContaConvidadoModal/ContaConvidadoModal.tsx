import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { HiX } from 'react-icons/hi';
import { ROTA_APOS_LOGIN_CLIENTE } from '../../contexts/ClienteAuthContext';
import './ContaConvidadoModal.css';

interface Props {
  aberto: boolean;
  /** Número da mesa do convidado (ex.: "05"), mostrado no texto */
  mesa?: string;
  onFechar: () => void;
}

/**
 * Convidado (QR Code da mesa) não tem perfil: aqui ele escolhe entrar numa conta,
 * criar uma, ou seguir como convidado. A mesa fica guardada no ConvidadoContext, então
 * depois do login/cadastro ele continua vinculado à mesa, já com as telas de cliente
 * cadastrado (dwelcome, cardápio, reservas, histórico, perfil...).
 */
const ContaConvidadoModal: React.FC<Props> = ({ aberto, mesa, onFechar }) => {
  const navigate = useNavigate();

  useEffect(() => {
    if (!aberto) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onFechar();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [aberto, onFechar]);

  if (!aberto) return null;

  const ir = (rota: string) => {
    onFechar();
    navigate(rota, { state: { from: ROTA_APOS_LOGIN_CLIENTE } });
  };

  return (
    <div className="conta-convidado__overlay" onClick={onFechar}>
      <div
        className="conta-convidado__modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="conta-convidado-titulo"
        onClick={(e) => e.stopPropagation()}
      >
        <button className="conta-convidado__fechar" onClick={onFechar} aria-label="Fechar">
          <HiX />
        </button>

        <h2 id="conta-convidado-titulo" className="conta-convidado__titulo">
          Você está como convidado
        </h2>
        <p className="conta-convidado__texto">
          Entre ou crie uma conta para ter perfil, histórico e mais opções
          {mesa ? <>, sem sair da <strong>mesa {mesa}</strong></> : null}.
        </p>

        <button className="conta-convidado__btn conta-convidado__btn--prim" onClick={() => ir('/login/cliente')}>
          Entrar na minha conta
        </button>
        <button className="conta-convidado__btn conta-convidado__btn--sec" onClick={() => ir('/register/cliente')}>
          Criar conta
        </button>
        <button className="conta-convidado__link" onClick={onFechar}>
          Continuar como convidado
        </button>
      </div>
    </div>
  );
};

export default ContaConvidadoModal;
