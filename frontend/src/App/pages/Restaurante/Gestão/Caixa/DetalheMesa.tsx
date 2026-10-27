import React, { useEffect } from 'react';
import { HiX, HiPlus, HiUserGroup, HiOutlinePencil } from 'react-icons/hi';
import { Pedido } from '../../../../services/pedido.service';

interface DetalheMesaProps {
  numero: number;
  statusLabel: string;
  capacidade?: number;
  observacao?: string;
  /** Pedidos em andamento desta mesa (RECEBIDO, PREPARO ou PRONTO) */
  pedidos: Pedido[];
  /** Nomes dos clientes cadastrados na mesa (sem repetir) */
  clientes: string[];
  onFechar: () => void;
  onNovoPedido: () => void;
  /** Abre a tela de pedido com os dados deste pedido preenchidos */
  onEditarPedido: (pedidoId: string) => void;
}

const moeda = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

const hora = (iso: string) =>
  new Date(iso).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

const ROTULO_STATUS: Record<string, string> = {
  RECEBIDO: 'Recebido',
  PREPARO: 'Em preparo',
  PRONTO: 'Pronto',
};

/** Detalhes de uma mesa: dados cadastrais + pedidos em andamento (dados reais). */
const DetalheMesa: React.FC<DetalheMesaProps> = ({
  numero,
  statusLabel,
  capacidade,
  observacao,
  pedidos,
  clientes,
  onFechar,
  onNovoPedido,
  onEditarPedido,
}) => {
  // Fecha com Esc
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onFechar();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onFechar]);

  const totalGeral = pedidos.reduce((acc, p) => acc + p.total, 0);

  return (
    <div className="caixa__overlay" onClick={onFechar}>
      <div
        className="caixa__modal"
        role="dialog"
        aria-modal="true"
        aria-label={`Detalhes da Mesa ${numero}`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="caixa__modal-header">
          <div>
            <h3 className="caixa__modal-titulo">Mesa {String(numero).padStart(2, '0')}</h3>
            <p className="caixa__modal-subtitulo">{statusLabel}</p>
          </div>
          <button className="caixa__modal-fechar" onClick={onFechar} aria-label="Fechar">
            <HiX />
          </button>
        </div>

        <div className="caixa__modal-corpo">
          {capacidade !== undefined && (
            <span className="caixa__card-pessoas">
              <HiUserGroup /> {capacidade} lugares
            </span>
          )}
          {observacao && <span className="caixa__det-obs">{observacao}</span>}

          {clientes.length > 0 && (
            <div className="caixa__det-clientes">
              <strong>
                {clientes.length} {clientes.length === 1 ? 'cliente' : 'clientes'} na mesa
              </strong>
              <div className="caixa__det-clientes-lista">
                {clientes.map((nome) => (
                  <span key={nome} className="caixa__det-cliente">{nome}</span>
                ))}
              </div>
            </div>
          )}

          {pedidos.length === 0 ? (
            <p className="caixa__det-vazio">Nenhum pedido em andamento nesta mesa.</p>
          ) : (
            <>
              {pedidos.map((p) => (
                <div key={p.id} className="caixa__det-pedido">
                  <div className="caixa__det-pedido-topo">
                    <div className="caixa__det-pedido-linha">
                      <strong>Pedido #{p.numero_pedido}</strong>
                      <button
                        className="caixa__det-editar"
                        onClick={() => onEditarPedido(p.id)}
                        aria-label={`Editar pedido ${p.numero_pedido}`}
                      >
                        <HiOutlinePencil /> Editar
                      </button>
                    </div>
                    <span className="caixa__det-pedido-meta">
                      {p.cliente_nome} · {hora(p.criado_em)} · {ROTULO_STATUS[p.status] ?? p.status}
                    </span>
                  </div>

                  <ul className="caixa__det-itens">
                    {p.itens.map((i) => (
                      <li key={i.id}>
                        <span>{i.quantidade}x {i.produto?.nome ?? 'Produto'}</span>
                        <span>{moeda(i.preco_total)}</span>
                      </li>
                    ))}
                  </ul>

                  {p.observacoes && <p className="caixa__det-obs">Obs.: {p.observacoes}</p>}
                  <div className="caixa__det-subtotal">
                    <span>Total do pedido</span>
                    <strong>{moeda(p.total)}</strong>
                  </div>
                </div>
              ))}

              <div className="caixa__det-total">
                <span>Total da mesa</span>
                <strong>{moeda(totalGeral)}</strong>
              </div>
            </>
          )}
        </div>

        <div className="caixa__modal-acoes">
          <button className="caixa__btn-cancelar" onClick={onFechar}>
            Fechar
          </button>
          <button className="caixa__btn-salvar" onClick={onNovoPedido}>
            <HiPlus /> Novo pedido
          </button>
        </div>
      </div>
    </div>
  );
};

export default DetalheMesa;
