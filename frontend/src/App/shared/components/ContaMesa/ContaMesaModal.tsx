import React, { useCallback, useEffect, useRef, useState } from 'react';
import { HiX } from 'react-icons/hi';
import MesaPublicaService, { ContaMesaPublica } from '../../../services/mesaPublica.service';
import './ContaMesaModal.css';

/**
 * "Ver conta" do cliente na mesa: tudo o que a mesa consumiu (por pedido) e quanto será cobrado.
 * Os valores vêm do servidor, com as mesmas regras do Caixa (taxa de serviço e pagamentos parciais).
 */

interface ContaMesaModalProps {
  aberto: boolean;
  /** qr_code_token da mesa */
  token?: string;
  onFechar: () => void;
}

const STATUS_ROTULO: Record<ContaMesaPublica['pedidos'][number]['status'], string> = {
  RECEBIDO: 'Recebido',
  PREPARO: 'Em preparo',
  PRONTO: 'Pronto',
  ENTREGUE: 'Entregue',
};

const moeda = (v: number) => `R$ ${v.toFixed(2).replace('.', ',')}`;
const hora = (iso: string) =>
  new Date(iso).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

const ContaMesaModal: React.FC<ContaMesaModalProps> = ({ aberto, token, onFechar }) => {
  const [conta, setConta] = useState<ContaMesaPublica | null>(null);
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState('');
  const fecharRef = useRef<HTMLButtonElement>(null);

  const carregar = useCallback(async () => {
    if (!token) {
      setErro('Não foi possível identificar a sua mesa. Escaneie o QR Code novamente.');
      return;
    }
    setCarregando(true);
    setErro('');
    try {
      setConta(await MesaPublicaService.verConta(token));
    } catch (err: any) {
      setErro(err?.message ?? 'Não foi possível carregar a conta.');
    } finally {
      setCarregando(false);
    }
  }, [token]);

  // Sempre busca de novo ao abrir (a conta muda a cada pedido)
  useEffect(() => {
    if (aberto) void carregar();
  }, [aberto, carregar]);

  useEffect(() => {
    if (!aberto) return;
    fecharRef.current?.focus();
    const aoTeclar = (e: KeyboardEvent) => { if (e.key === 'Escape') onFechar(); };
    document.addEventListener('keydown', aoTeclar);
    return () => document.removeEventListener('keydown', aoTeclar);
  }, [aberto, onFechar]);

  if (!aberto) return null;

  return (
    <div className="contamesa__overlay" onClick={onFechar}>
      <div
        className="contamesa__dialogo"
        role="dialog"
        aria-modal="true"
        aria-labelledby="contamesa-titulo"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="contamesa__topo">
          <h3 id="contamesa-titulo" className="contamesa__titulo">
            Conta{conta ? ` da mesa ${String(conta.mesa.numero).padStart(2, '0')}` : ''}
          </h3>
          <button ref={fecharRef} type="button" className="contamesa__fechar" onClick={onFechar} aria-label="Fechar">
            <HiX />
          </button>
        </div>

        {carregando && !conta && <p className="contamesa__aviso">Carregando a conta...</p>}

        {erro && (
          <p className="contamesa__aviso contamesa__aviso--erro" role="alert">
            {erro}{' '}
            <button type="button" className="contamesa__link" onClick={() => void carregar()}>
              Tentar de novo
            </button>
          </p>
        )}

        {conta && conta.pedidos.length === 0 && !erro && (
          <p className="contamesa__aviso">A sua mesa não tem pedidos em aberto no momento.</p>
        )}

        {conta && conta.pedidos.length > 0 && (
          <>
            <div className="contamesa__pedidos">
              {conta.pedidos.map((p) => (
                <section key={p.id} className="contamesa__pedido">
                  <header className="contamesa__pedido-topo">
                    <strong>Pedido #{p.numero_pedido} · {hora(p.criado_em)}</strong>
                    <span className={`contamesa__status contamesa__status--${p.status.toLowerCase()}`}>
                      {STATUS_ROTULO[p.status]}
                    </span>
                  </header>
                  <ul className="contamesa__itens">
                    {p.itens.map((i) => (
                      <li key={i.id} className="contamesa__item">
                        <span>
                          {i.quantidade}x {i.nome}
                          {!i.entregue && <em className="contamesa__pendente"> · ainda não entregue</em>}
                        </span>
                        <span>{moeda(i.preco_total)}</span>
                      </li>
                    ))}
                  </ul>
                </section>
              ))}
            </div>

            <dl className="contamesa__totais">
              <div><dt>Subtotal</dt><dd>{moeda(conta.subtotal)}</dd></div>
              <div><dt>Taxa de serviço ({conta.taxa_servico_percentual}%)</dt><dd>{moeda(conta.taxa_servico)}</dd></div>
              {conta.ja_pago > 0 && (
                <div><dt>Já pago</dt><dd>- {moeda(conta.ja_pago)}</dd></div>
              )}
              <div className="contamesa__total"><dt>Total a pagar</dt><dd>{moeda(conta.restante)}</dd></div>
            </dl>

            {conta.itens_sem_entrega > 0 && (
              <p className="contamesa__nota" role="note">
                Alguns itens ainda não chegaram à mesa. Assim que todos forem entregues, você poderá pedir a conta.
              </p>
            )}
          </>
        )}

        <button type="button" className="contamesa__ok" onClick={onFechar}>Fechar</button>
      </div>
    </div>
  );
};

export default ContaMesaModal;
