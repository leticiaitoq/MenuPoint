import React, { useCallback, useEffect, useRef, useState } from 'react';
import { FaConciergeBell } from 'react-icons/fa';
import { HiCheckCircle, HiExclamationCircle } from 'react-icons/hi';
import './Chamargarcom.css';

/**
 * Botão "Chamar garçom" do cardápio.
 *
 * Posição (só CSS, sem JS):
 *  - desktop: fica na linha da busca, ao lado do campo "Procurar" (use a classe .menu__topo)
 *  - celular: vira botão flutuante, ao lado do botão flutuante do carrinho
 *
 * Ao tocar, abre uma confirmação ("Chamar o garçom na mesa X?"). Só depois de confirmar
 * é que chama `onChamar`. Depois de um chamado o botão fica bloqueado por `intervaloMs`
 * para o cliente não chamar várias vezes seguidas.
 */

type Etapa = 'fechado' | 'confirmar' | 'enviando' | 'sucesso' | 'erro';

interface ChamarGarcomProps {
  /** Número da mesa para mostrar na confirmação (ex.: "05"). Opcional. */
  mesa?: string;
  /** Faz o chamado de verdade. Deve rejeitar (throw) se não der certo. */
  onChamar: () => Promise<void>;
  /** Tempo, em ms, que o botão fica bloqueado depois de um chamado. Padrão: 60 s. */
  intervaloMs?: number;
}

const ChamarGarcom: React.FC<ChamarGarcomProps> = ({ mesa, onChamar, intervaloMs = 60_000 }) => {
  const [etapa, setEtapa] = useState<Etapa>('fechado');
  const [bloqueado, setBloqueado] = useState(false);
  const [erroMsg, setErroMsg] = useState('');

  const botaoRef = useRef<HTMLButtonElement>(null);
  const cancelarRef = useRef<HTMLButtonElement>(null);
  const timerBloqueio = useRef<number | undefined>(undefined);
  const timerFechar = useRef<number | undefined>(undefined);

  const textoMesa = mesa ? ` na mesa ${mesa}` : '';

  const fechar = useCallback(() => {
    window.clearTimeout(timerFechar.current);
    setEtapa('fechado');
    botaoRef.current?.focus();
  }, []);

  // Limpa os temporizadores ao sair da tela
  useEffect(
    () => () => {
      window.clearTimeout(timerBloqueio.current);
      window.clearTimeout(timerFechar.current);
    },
    []
  );

  // Esc fecha (menos enquanto está enviando)
  useEffect(() => {
    if (etapa === 'fechado' || etapa === 'enviando') return;
    const aoTeclar = (e: KeyboardEvent) => {
      if (e.key === 'Escape') fechar();
    };
    document.addEventListener('keydown', aoTeclar);
    return () => document.removeEventListener('keydown', aoTeclar);
  }, [etapa, fechar]);

  // Foco começa no "Cancelar": o caminho seguro, para não confirmar sem querer
  useEffect(() => {
    if (etapa === 'confirmar' || etapa === 'erro') cancelarRef.current?.focus();
  }, [etapa]);

  const confirmar = async () => {
    setEtapa('enviando');
    try {
      await onChamar();
      setEtapa('sucesso');
      setBloqueado(true);
      timerBloqueio.current = window.setTimeout(() => setBloqueado(false), intervaloMs);
      timerFechar.current = window.setTimeout(fechar, 5000);
    } catch (err: any) {
      setErroMsg(typeof err?.message === 'string' ? err.message : '');
      setEtapa('erro');
    }
  };

  return (
    <>
      <button
        ref={botaoRef}
        type="button"
        className="chamar-garcom__btn"
        onClick={() => setEtapa('confirmar')}
        disabled={bloqueado}
        aria-label="Chamar garçom"
        title={bloqueado ? 'Você acabou de chamar o garçom' : 'Chamar garçom'}
      >
        <FaConciergeBell aria-hidden="true" />
      </button>

      {etapa !== 'fechado' && (
        <div
          className="chamar-garcom__overlay"
          onClick={() => etapa !== 'enviando' && fechar()}
        >
          <div
            className="chamar-garcom__dialogo"
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="chamar-garcom-titulo"
            aria-describedby="chamar-garcom-texto"
            onClick={(e) => e.stopPropagation()}
          >
            {(etapa === 'confirmar' || etapa === 'enviando') && (
              <>
                <div className="chamar-garcom__icone">
                  <FaConciergeBell aria-hidden="true" />
                </div>
                <h3 id="chamar-garcom-titulo" className="chamar-garcom__titulo">
                  Chamar o garçom?
                </h3>
                <p id="chamar-garcom-texto" className="chamar-garcom__texto">
                  Vamos avisar a equipe que você precisa de atendimento{textoMesa}.
                </p>
                <div className="chamar-garcom__acoes">
                  <button
                    ref={cancelarRef}
                    type="button"
                    className="chamar-garcom__acao"
                    onClick={fechar}
                    disabled={etapa === 'enviando'}
                  >
                    Cancelar
                  </button>
                  <button
                    type="button"
                    className="chamar-garcom__acao chamar-garcom__acao--primaria"
                    onClick={() => void confirmar()}
                    disabled={etapa === 'enviando'}
                  >
                    {etapa === 'enviando' ? 'Chamando…' : 'Sim, chamar'}
                  </button>
                </div>
              </>
            )}

            {etapa === 'sucesso' && (
              <>
                <HiCheckCircle className="chamar-garcom__status chamar-garcom__status--ok" aria-hidden="true" />
                <h3 id="chamar-garcom-titulo" className="chamar-garcom__titulo">Garçom chamado!</h3>
                <p id="chamar-garcom-texto" className="chamar-garcom__texto">
                  A equipe foi avisada e já vai até você{textoMesa}.
                </p>
                <div className="chamar-garcom__acoes">
                  <button type="button" className="chamar-garcom__acao chamar-garcom__acao--primaria" onClick={fechar}>
                    Ok
                  </button>
                </div>
              </>
            )}

            {etapa === 'erro' && (
              <>
                <HiExclamationCircle className="chamar-garcom__status chamar-garcom__status--erro" aria-hidden="true" />
                <h3 id="chamar-garcom-titulo" className="chamar-garcom__titulo">Não foi possível chamar</h3>
                <p id="chamar-garcom-texto" className="chamar-garcom__texto">
                  {erroMsg || 'Tente de novo ou faça sinal para um atendente.'}
                </p>
                <div className="chamar-garcom__acoes">
                  <button ref={cancelarRef} type="button" className="chamar-garcom__acao" onClick={fechar}>
                    Fechar
                  </button>
                  <button
                    type="button"
                    className="chamar-garcom__acao chamar-garcom__acao--primaria"
                    onClick={() => void confirmar()}
                  >
                    Tentar de novo
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
};

export default ChamarGarcom;
