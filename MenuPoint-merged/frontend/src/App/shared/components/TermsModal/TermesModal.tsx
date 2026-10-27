import React, { useEffect, useRef, useState } from 'react';
import { termsContent } from './termsContent';
import './TermsModal.css';

interface TermsModalProps {
  /** Controla se o modal está visível. */
  isOpen: boolean;
  /** Chamado ao fechar sem aceitar (overlay, X, Esc). */
  onClose: () => void;
  /** Chamado quando o usuário clica em "Li e concordo". */
  onAccept: () => void;
}

/** Distância (em px) até o fim do scroll a partir da qual já consideramos "chegou ao final". */
const SCROLL_END_THRESHOLD_PX = 8;

/**
 * Modal de Termos de Uso e Política de Privacidade.
 *
 * Componente "burro": apenas exibe o conteúdo vindo de `termsContent.ts` e
 * dispara os callbacks recebidos por props. Isso permite reutilizá-lo em
 * qualquer tela de cadastro (restaurante, cliente, etc.) sem duplicar texto
 * ou marcação.
 *
 * O botão "Li e concordo" só fica habilitado depois que o usuário rola o
 * texto até o final — assim a aceitação reflete que o conteúdo foi
 * efetivamente lido até o fim, não só aberto.
 */
const TermsModal: React.FC<TermsModalProps> = ({ isOpen, onClose, onAccept }) => {
  const [chegouAoFim, setChegouAoFim] = useState(false);
  const scrollAreaRef = useRef<HTMLDivElement>(null);

  // Reabre sempre pedindo a leitura de novo, e cobre o caso do texto já
  // caber inteiro na tela (sem barra de rolagem) assim que o modal abre.
  useEffect(() => {
    if (!isOpen) {
      setChegouAoFim(false);
      return;
    }
    const area = scrollAreaRef.current;
    if (area && area.scrollHeight <= area.clientHeight) {
      setChegouAoFim(true);
    }
  }, [isOpen]);

  if (!isOpen) {
    return null;
  }

  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    if (chegouAoFim) {
      return;
    }
    const { scrollTop, scrollHeight, clientHeight } = e.currentTarget;
    const chegouAoFinal = scrollTop + clientHeight >= scrollHeight - SCROLL_END_THRESHOLD_PX;
    if (chegouAoFinal) {
      setChegouAoFim(true);
    }
  };

  return (
    <div
      className="terms-modal__overlay"
      onClick={onClose}
      role="presentation"
    >
      <div
        className="terms-modal__container"
        role="dialog"
        aria-modal="true"
        aria-labelledby="terms-modal-title"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="terms-modal__header">
          <h2 id="terms-modal-title" className="terms-modal__title">
            {termsContent.tituloDocumento}
          </h2>
          <p className="terms-modal__updated-at">
            Última atualização: {termsContent.ultimaAtualizacao}
          </p>
          <button
            type="button"
            className="terms-modal__close-button"
            onClick={onClose}
            aria-label="Fechar"
          >
            ×
          </button>
        </header>

        <div
          className="terms-modal__scroll-area"
          ref={scrollAreaRef}
          onScroll={handleScroll}
        >
          <p className="terms-modal__intro">{termsContent.introducao}</p>

          {termsContent.secoes.map((secao) => (
            <section key={secao.id} className="terms-modal__section">
              <h3 className="terms-modal__section-title">{secao.titulo}</h3>
              {secao.paragrafos.map((paragrafo, index) => (
                <p key={`${secao.id}-${index}`} className="terms-modal__paragraph">
                  {paragrafo}
                </p>
              ))}
            </section>
          ))}

          <p className="terms-modal__footer-text">{termsContent.rodape}</p>
        </div>

        <footer className="terms-modal__footer">
          {!chegouAoFim && (
            <p className="terms-modal__scroll-hint">
              Role o texto até o final para habilitar o botão abaixo.
            </p>
          )}
          <button
            type="button"
            className="terms-modal__accept-button"
            onClick={onAccept}
            disabled={!chegouAoFim}
          >
            LI E CONCORDO
          </button>
        </footer>
      </div>
    </div>
  );
};

export default TermsModal;