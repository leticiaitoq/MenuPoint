import React, { useCallback, useEffect, useRef, useState } from 'react';
import { FaReceipt } from 'react-icons/fa';
import { HiCheckCircle, HiExclamationCircle } from 'react-icons/hi';
import type { FormaPagamentoConta } from '../../../services/mesaPublica.service';
import './FecharConta.css';

/**
 * Confirmação do "Fechar a conta" (cliente na mesa pede a conta ao garçom).
 *
 * Quem controla se está aberto é a página (prop `aberto`). O botão que abre fica no
 * Carrinho. Só depois de confirmar é que chama `onPedir`, que deve rejeitar (throw)
 * se não der certo. A forma de pagamento é opcional: serve só de aviso para o caixa.
 */

type Etapa = 'confirmar' | 'enviando' | 'sucesso' | 'erro';

interface FecharContaProps {
  aberto: boolean;
  /** Número da mesa para mostrar no texto (ex.: "05"). Opcional. */
  mesa?: string;
  /** Quantos itens ainda estão no carrinho sem ter sido enviados para a cozinha. */
  itensNoCarrinho?: number;
  /** Faz o pedido de verdade. Deve rejeitar (throw) se não der certo. */
  onPedir: (forma?: FormaPagamentoConta) => Promise<void>;
  /** Chamado depois que o pedido deu certo (a página usa para bloquear o botão por um tempo). */
  onConcluido?: () => void;
  onFechar: () => void;
}

const FORMAS: { valor?: FormaPagamentoConta; rotulo: string }[] = [
  { valor: undefined, rotulo: 'Tanto faz' },
  { valor: 'PIX_PRESENCIAL', rotulo: 'Pix' },
  { valor: 'CARTAO', rotulo: 'Cartão' },
  { valor: 'DINHEIRO', rotulo: 'Dinheiro' },
];

const FecharConta: React.FC<FecharContaProps> = ({
  aberto,
  mesa,
  itensNoCarrinho = 0,
  onPedir,
  onConcluido,
  onFechar,
}) => {
  const [etapa, setEtapa] = useState<Etapa>('confirmar');
  const [forma, setForma] = useState<FormaPagamentoConta | undefined>(undefined);
  const [erroMsg, setErroMsg] = useState('');
  // 409 = regra do restaurante (ex.: ainda há itens sem entregar): tentar de novo agora não adianta
  const [erroRegra, setErroRegra] = useState(false);
  const cancelarRef = useRef<HTMLButtonElement>(null);

  const textoMesa = mesa ? ` da mesa ${mesa}` : '';

  const fechar = useCallback(() => {
    if (etapa !== 'enviando') onFechar();
  }, [etapa, onFechar]);

  // Cada vez que abre, volta ao começo
  useEffect(() => {
    if (aberto) {
      setEtapa('confirmar');
      setForma(undefined);
      setErroMsg('');
      setErroRegra(false);
    }
  }, [aberto]);

  // Esc fecha (menos enquanto está enviando)
  useEffect(() => {
    if (!aberto) return;
    const aoTeclar = (e: KeyboardEvent) => {
      if (e.key === 'Escape') fechar();
    };
    document.addEventListener('keydown', aoTeclar);
    return () => document.removeEventListener('keydown', aoTeclar);
  }, [aberto, fechar]);

  // Foco começa no "Cancelar": o caminho seguro, para não confirmar sem querer
  useEffect(() => {
    if (aberto && (etapa === 'confirmar' || etapa === 'erro')) cancelarRef.current?.focus();
  }, [aberto, etapa]);

  const confirmar = async () => {
    setEtapa('enviando');
    try {
      await onPedir(forma);
      setEtapa('sucesso');
      onConcluido?.();
    } catch (err: any) {
      setErroMsg(typeof err?.message === 'string' ? err.message : '');
      setErroRegra(err?.status === 409);
      setEtapa('erro');
    }
  };

  if (!aberto) return null;

  return (
    <div className="fechar-conta__overlay" onClick={fechar}>
      <div
        className="fechar-conta__dialogo"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="fechar-conta-titulo"
        aria-describedby="fechar-conta-texto"
        onClick={(e) => e.stopPropagation()}
      >
        {(etapa === 'confirmar' || etapa === 'enviando') && (
          <>
            <div className="fechar-conta__icone">
              <FaReceipt aria-hidden="true" />
            </div>
            <h3 id="fechar-conta-titulo" className="fechar-conta__titulo">
              Fechar a conta?
            </h3>
            <p id="fechar-conta-texto" className="fechar-conta__texto">
              Vamos avisar o garçom que você quer pagar a conta{textoMesa}.
            </p>

            {itensNoCarrinho > 0 && (
              <p className="fechar-conta__aviso" role="note">
                Você ainda tem {itensNoCarrinho} {itensNoCarrinho === 1 ? 'item' : 'itens'} no carrinho
                que não {itensNoCarrinho === 1 ? 'foi enviado' : 'foram enviados'} para a cozinha.
                {itensNoCarrinho === 1 ? ' Ele não entra' : ' Eles não entram'} na conta.
              </p>
            )}

            <div className="fechar-conta__forma" role="radiogroup" aria-label="Como você vai pagar">
              <span className="fechar-conta__forma-titulo">Como você vai pagar?</span>
              <div className="fechar-conta__forma-opcoes">
                {FORMAS.map((f) => (
                  <button
                    key={f.rotulo}
                    type="button"
                    role="radio"
                    aria-checked={forma === f.valor}
                    className={`fechar-conta__chip${forma === f.valor ? ' fechar-conta__chip--ativo' : ''}`}
                    onClick={() => setForma(f.valor)}
                    disabled={etapa === 'enviando'}
                  >
                    {f.rotulo}
                  </button>
                ))}
              </div>
            </div>

            <div className="fechar-conta__acoes">
              <button
                ref={cancelarRef}
                type="button"
                className="fechar-conta__acao"
                onClick={fechar}
                disabled={etapa === 'enviando'}
              >
                Cancelar
              </button>
              <button
                type="button"
                className="fechar-conta__acao fechar-conta__acao--primaria"
                onClick={() => void confirmar()}
                disabled={etapa === 'enviando'}
              >
                {etapa === 'enviando' ? 'Pedindo…' : 'Sim, pedir a conta'}
              </button>
            </div>
          </>
        )}

        {etapa === 'sucesso' && (
          <>
            <HiCheckCircle className="fechar-conta__status fechar-conta__status--ok" aria-hidden="true" />
            <h3 id="fechar-conta-titulo" className="fechar-conta__titulo">Conta solicitada!</h3>
            <p id="fechar-conta-texto" className="fechar-conta__texto">
              O garçom já vai levar a conta até você{textoMesa ? ` (mesa ${mesa})` : ''}.
            </p>
            <div className="fechar-conta__acoes">
              <button type="button" className="fechar-conta__acao fechar-conta__acao--primaria" onClick={onFechar}>
                Ok
              </button>
            </div>
          </>
        )}

        {etapa === 'erro' && (
          <>
            <HiExclamationCircle className="fechar-conta__status fechar-conta__status--erro" aria-hidden="true" />
            <h3 id="fechar-conta-titulo" className="fechar-conta__titulo">
              {erroRegra ? 'Ainda não dá para fechar a conta' : 'Não foi possível pedir a conta'}
            </h3>
            <p id="fechar-conta-texto" className="fechar-conta__texto">
              {erroMsg || 'Tente de novo ou faça sinal para um atendente.'}
            </p>
            <div className="fechar-conta__acoes">
              {erroRegra ? (
                <button
                  ref={cancelarRef}
                  type="button"
                  className="fechar-conta__acao fechar-conta__acao--primaria"
                  onClick={onFechar}
                >
                  Entendi
                </button>
              ) : (
                <>
                  <button ref={cancelarRef} type="button" className="fechar-conta__acao" onClick={onFechar}>
                    Fechar
                  </button>
                  <button
                    type="button"
                    className="fechar-conta__acao fechar-conta__acao--primaria"
                    onClick={() => void confirmar()}
                  >
                    Tentar de novo
                  </button>
                </>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default FecharConta;
