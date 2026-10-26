import React, { useEffect, useState } from 'react';
import { HiOutlineExclamation, HiOutlinePencil, HiOutlineTrash, HiX } from 'react-icons/hi';
import './ConfirmarAcaoPedido.css';

export type TipoAcaoPedido = 'editar' | 'excluir';

interface Props {
  aberto: boolean;
  tipo: TipoAcaoPedido;
  pedido: { numero_pedido: number; cliente_nome: string } | null;
  /** Chamada à API em andamento (só na exclusão): trava os botões */
  salvando?: boolean;
  /** Erro devolvido pela API (ex.: pedido já pago) */
  erro?: string | null;
  /** `motivo` só vem na exclusão */
  onConfirmar: (motivo?: string) => void;
  onFechar: () => void;
}

const MOTIVOS = [
  { id: 'engano',     texto: 'Pedido lançado por engano' },
  { id: 'desistiu',   texto: 'Cliente desistiu' },
  { id: 'indisponivel', texto: 'Item indisponível' },
  { id: 'outro',      texto: 'Outro motivo' },
];

/**
 * Pede confirmação antes de editar ou excluir UM pedido da comanda.
 * O aviso deixa claro que o cliente verá a alteração no pedido dele.
 */
const ConfirmarAcaoPedido: React.FC<Props> = ({
  aberto, tipo, pedido, salvando = false, erro = null, onConfirmar, onFechar,
}) => {
  const [motivoId, setMotivoId] = useState<string | null>(null);
  const [outroTexto, setOutroTexto] = useState('');

  // Cada abertura recomeça sem motivo escolhido
  useEffect(() => {
    if (aberto) {
      setMotivoId(null);
      setOutroTexto('');
    }
  }, [aberto, pedido?.numero_pedido, tipo]);

  useEffect(() => {
    if (!aberto) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && !salvando && onFechar();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [aberto, salvando, onFechar]);

  if (!aberto || !pedido) return null;

  const excluir = tipo === 'excluir';
  const outroValido = outroTexto.trim().length >= 3;
  const podeConfirmar = !salvando && (!excluir || (motivoId !== null && (motivoId !== 'outro' || outroValido)));

  const confirmar = () => {
    if (!podeConfirmar) return;
    if (!excluir) return onConfirmar();
    const texto = motivoId === 'outro'
      ? outroTexto.trim()
      : MOTIVOS.find((m) => m.id === motivoId)?.texto ?? 'Removido pelo caixa';
    onConfirmar(texto);
  };

  return (
    <div className="acaoped__overlay" onClick={() => !salvando && onFechar()}>
      <div
        className="acaoped__modal"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="acaoped-titulo"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="acaoped__header">
          <span className={`acaoped__icone${excluir ? ' acaoped__icone--perigo' : ''}`}>
            {excluir ? <HiOutlineTrash /> : <HiOutlinePencil />}
          </span>
          <div className="acaoped__header-texto">
            <h3 id="acaoped-titulo" className="acaoped__titulo">
              {excluir ? 'Excluir' : 'Editar'} pedido #{pedido.numero_pedido}?
            </h3>
            <p className="acaoped__subtitulo">{pedido.cliente_nome}</p>
          </div>
          <button className="acaoped__fechar" onClick={onFechar} disabled={salvando} aria-label="Fechar">
            <HiX />
          </button>
        </div>

        <div className="acaoped__corpo">
          <p className="acaoped__texto">
            {excluir
              ? 'Tem certeza que deseja excluir este pedido? Ele será cancelado e sairá da comanda da mesa. Esta ação não pode ser desfeita.'
              : 'Tem certeza que deseja editar este pedido? Você poderá alterar itens, quantidades e observações.'}
          </p>

          <div className="acaoped__aviso">
            <HiOutlineExclamation />
            <span>
              {excluir
                ? 'O cliente verá que este pedido foi cancelado.'
                : 'O cliente verá as alterações feitas neste pedido.'}
            </span>
          </div>

          {excluir && (
            <>
              <label className="acaoped__label" htmlFor="acaoped-motivo">Motivo da exclusão</label>
              <select
                id="acaoped-motivo"
                className="acaoped__select"
                value={motivoId ?? ''}
                onChange={(e) => setMotivoId(e.target.value || null)}
                disabled={salvando}
              >
                <option value="">Selecione um motivo</option>
                {MOTIVOS.map((m) => <option key={m.id} value={m.id}>{m.texto}</option>)}
              </select>

              {motivoId === 'outro' && (
                <textarea
                  className="acaoped__textarea"
                  placeholder="Descreva o motivo (mínimo 3 caracteres)"
                  maxLength={200}
                  value={outroTexto}
                  onChange={(e) => setOutroTexto(e.target.value)}
                  disabled={salvando}
                />
              )}
            </>
          )}

          {erro && <div className="acaoped__erro" role="alert">{erro}</div>}
        </div>

        <div className="acaoped__acoes">
          <button className="acaoped__btn acaoped__btn--sec" onClick={onFechar} disabled={salvando}>
            Voltar
          </button>
          <button
            className={`acaoped__btn ${excluir ? 'acaoped__btn--perigo' : 'acaoped__btn--prim'}`}
            onClick={confirmar}
            disabled={!podeConfirmar}
          >
            {salvando ? 'Excluindo…' : excluir ? 'Sim, excluir pedido' : 'Sim, editar pedido'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ConfirmarAcaoPedido;
