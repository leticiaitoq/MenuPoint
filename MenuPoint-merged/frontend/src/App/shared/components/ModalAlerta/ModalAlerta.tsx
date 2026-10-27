import React, { useEffect } from 'react';
import {
  HiX,
  HiOutlineExclamation,
  HiOutlineExclamationCircle,
  HiOutlineInformationCircle,
  HiOutlineCheckCircle,
} from 'react-icons/hi';
import './ModalAlerta.css';

/**
 * Modal padrão do sistema para erros, avisos e confirmações.
 * Use no lugar de window.alert / window.confirm.
 *
 * Só informar (um botão):
 *   <ModalAlerta aberto={!!erro} variante="erro" titulo="Não foi possível salvar"
 *                mensagem={erro} onFechar={() => setErro(null)} />
 *
 * Confirmar uma ação (dois botões — basta passar onConfirmar):
 *   <ModalAlerta aberto={confirmar} variante="aviso" titulo="Sair sem salvar?"
 *                mensagem="As alterações serão perdidas."
 *                textoConfirmar="Sair" textoCancelar="Continuar editando"
 *                onConfirmar={sair} onFechar={() => setConfirmar(false)} />
 */
export type VarianteModalAlerta = 'erro' | 'aviso' | 'info' | 'sucesso';

interface ModalAlertaProps {
  aberto: boolean;
  titulo: string;
  mensagem?: React.ReactNode;
  variante?: VarianteModalAlerta;
  /** Se informado, o modal mostra dois botões (cancelar + confirmar) */
  onConfirmar?: () => void;
  /** Fecha o modal (Esc, clique fora, X e botão secundário) */
  onFechar: () => void;
  textoConfirmar?: string;
  /** Texto do botão secundário (ou do único botão, quando não há onConfirmar) */
  textoCancelar?: string;
  /** Trava os botões enquanto a ação confirmada está em andamento */
  carregando?: boolean;
}

const ICONES: Record<VarianteModalAlerta, React.ReactNode> = {
  erro:    <HiOutlineExclamationCircle />,
  aviso:   <HiOutlineExclamation />,
  info:    <HiOutlineInformationCircle />,
  sucesso: <HiOutlineCheckCircle />,
};

const ModalAlerta: React.FC<ModalAlertaProps> = ({
  aberto,
  titulo,
  mensagem,
  variante = 'erro',
  onConfirmar,
  onFechar,
  textoConfirmar = 'Confirmar',
  textoCancelar,
  carregando = false,
}) => {
  // Esc fecha
  useEffect(() => {
    if (!aberto) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !carregando) onFechar();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [aberto, carregando, onFechar]);

  if (!aberto) return null;

  const fechar = () => {
    if (!carregando) onFechar();
  };

  return (
    <div className="alerta__overlay" onClick={fechar}>
      <div
        className={`alerta__modal alerta__modal--${variante}`}
        role={variante === 'erro' ? 'alertdialog' : 'dialog'}
        aria-modal="true"
        aria-labelledby="alerta-titulo"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="alerta__header">
          <span className="alerta__icone">{ICONES[variante]}</span>
          <div className="alerta__header-texto">
            <h3 id="alerta-titulo" className="alerta__titulo">{titulo}</h3>
            {mensagem && <div className="alerta__mensagem">{mensagem}</div>}
          </div>
          <button className="alerta__fechar" onClick={fechar} aria-label="Fechar">
            <HiX />
          </button>
        </div>

        <div className="alerta__acoes">
          {onConfirmar ? (
            <>
              <button className="alerta__btn alerta__btn--sec" onClick={fechar} disabled={carregando}>
                {textoCancelar ?? 'Cancelar'}
              </button>
              <button
                className="alerta__btn alerta__btn--principal"
                onClick={onConfirmar}
                disabled={carregando}
                autoFocus
              >
                {textoConfirmar}
              </button>
            </>
          ) : (
            <button className="alerta__btn alerta__btn--principal" onClick={fechar} autoFocus>
              {textoCancelar ?? 'Entendi'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default ModalAlerta;
