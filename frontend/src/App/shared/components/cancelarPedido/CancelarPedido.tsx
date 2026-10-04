import React, { useEffect, useState } from 'react';
import { HiX, HiOutlineExclamation } from 'react-icons/hi';
import { useAuth } from '../../contexts/Authcontext';
import './CancelarPedido.css';

// ── Regras ─────────────────────────────────────────────────────────────────────
/** Só estes perfis podem cancelar pedido (é a ação mais sensível do caixa) */
const PERFIS_AUTORIZADOS = ['ADMIN', 'CAIXA'];

const MOTIVOS = [
  { id: 'desistiu',  label: 'Cliente desistiu' },
  { id: 'erro',      label: 'Erro de lançamento' },
  { id: 'duplicado', label: 'Pedido duplicado' },
  { id: 'indispo',   label: 'Item indisponível' },
  { id: 'outro',     label: 'Outro motivo' },
];

const OUTRO_MIN = 5;
const OUTRO_MAX = 200;

const formatarMoeda = (valor: number) =>
  valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

// ── Props ──────────────────────────────────────────────────────────────────────
interface CancelarPedidoProps {
  aberto: boolean;
  mesaNumero: number;
  /** Resumo do que será cancelado (opcional) */
  itens?: number;
  total?: number;
  /** Se > 0, o cancelamento é bloqueado (precisaria de estorno) */
  pagamentosRealizados?: number;
  onFechar: () => void;
  /** Recebe o texto do motivo — vai para Pedido.cancelamento_motivo no backend */
  onConfirmar: (motivo: string) => void;
}

/**
 * Modal de confirmação de cancelamento de pedido.
 *
 * - Motivo obrigatório (lista rápida + campo livre em "Outro")
 * - Bloqueia se a mesa já tem pagamento (estorno é outro fluxo)
 * - Bloqueia se o perfil do usuário não é ADMIN/CAIXA
 */
const CancelarPedido: React.FC<CancelarPedidoProps> = ({
  aberto,
  mesaNumero,
  itens,
  total,
  pagamentosRealizados = 0,
  onFechar,
  onConfirmar,
}) => {
  const { usuario } = useAuth();

  const [motivoId, setMotivoId] = useState<string | null>(null);
  const [outroTexto, setOutroTexto] = useState('');

  // Cada vez que abre, começa limpo
  useEffect(() => {
    if (aberto) {
      setMotivoId(null);
      setOutroTexto('');
    }
  }, [aberto]);

  // Esc fecha
  useEffect(() => {
    if (!aberto) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onFechar();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [aberto, onFechar]);

  if (!aberto) return null;

  // ── Bloqueios (a ordem importa: permissão primeiro) ──────────────────────────
  const perfil = usuario?.perfil;
  const semPermissao = !perfil || !PERFIS_AUTORIZADOS.includes(perfil);
  const temPagamento = pagamentosRealizados > 0;

  const bloqueio = semPermissao
    ? 'Seu perfil não tem permissão para cancelar pedidos. Peça a um responsável (caixa ou administrador).'
    : temPagamento
      ? `Esta mesa já tem ${formatarMoeda(pagamentosRealizados)} em pagamentos. Não é possível cancelar o pedido — o valor precisa ser estornado antes.`
      : null;

  // ── Validação do motivo ──────────────────────────────────────────────────────
  const outroValido =
    outroTexto.trim().length >= OUTRO_MIN && outroTexto.length <= OUTRO_MAX;
  const podeConfirmar = motivoId !== null && (motivoId !== 'outro' || outroValido);

  const handleConfirmar = () => {
    if (!podeConfirmar || bloqueio) return;
    const motivo =
      motivoId === 'outro'
        ? outroTexto.trim()
        : MOTIVOS.find((m) => m.id === motivoId)?.label ?? '';
    onConfirmar(motivo);
  };

  return (
    <div className="cancelar__overlay" onClick={onFechar}>
      <div
        className="cancelar__modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="cancelar-titulo"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="cancelar__header">
          <span className="cancelar__icone"><HiOutlineExclamation /></span>
          <div className="cancelar__header-texto">
            <h3 id="cancelar-titulo" className="cancelar__titulo">
              Cancelar pedido · Mesa {String(mesaNumero).padStart(2, '0')}
            </h3>
            <p className="cancelar__subtitulo">Esta ação não pode ser desfeita.</p>
          </div>
          <button className="cancelar__fechar" onClick={onFechar} aria-label="Fechar">
            <HiX />
          </button>
        </div>

        <div className="cancelar__corpo">
          {(itens !== undefined || total !== undefined) && (
            <div className="cancelar__resumo">
              {itens !== undefined && <span>{itens} {itens === 1 ? 'item' : 'itens'}</span>}
              {total !== undefined && <strong>{formatarMoeda(total)}</strong>}
            </div>
          )}

          {bloqueio ? (
            <div className="cancelar__bloqueio" role="alert">{bloqueio}</div>
          ) : (
            <>
              <p className="cancelar__label">Motivo do cancelamento</p>
              <div className="cancelar__motivos" role="radiogroup" aria-label="Motivo do cancelamento">
                {MOTIVOS.map((m) => (
                  <label
                    key={m.id}
                    className={`cancelar__motivo${motivoId === m.id ? ' cancelar__motivo--ativo' : ''}`}
                  >
                    <input
                      type="radio"
                      name="motivo-cancelamento"
                      value={m.id}
                      checked={motivoId === m.id}
                      onChange={() => setMotivoId(m.id)}
                    />
                    {m.label}
                  </label>
                ))}
              </div>

              {motivoId === 'outro' && (
                <div className="cancelar__outro">
                  <textarea
                    className="cancelar__textarea"
                    rows={3}
                    placeholder="Descreva o motivo"
                    maxLength={OUTRO_MAX}
                    value={outroTexto}
                    onChange={(e) => setOutroTexto(e.target.value)}
                    autoFocus
                  />
                  <div className="cancelar__outro-rodape">
                    <span className="cancelar__dica">
                      {outroTexto.trim().length < OUTRO_MIN ? `Mínimo de ${OUTRO_MIN} caracteres.` : ''}
                    </span>
                    <span className="cancelar__contador">{outroTexto.length}/{OUTRO_MAX}</span>
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        <div className="cancelar__acoes">
          {bloqueio ? (
            <button className="cancelar__btn cancelar__btn--sec" onClick={onFechar}>Entendi</button>
          ) : (
            <>
              <button className="cancelar__btn cancelar__btn--sec" onClick={onFechar}>Voltar</button>
              <button
                className="cancelar__btn cancelar__btn--perigo"
                onClick={handleConfirmar}
                disabled={!podeConfirmar}
              >
                Cancelar pedido
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default CancelarPedido;
