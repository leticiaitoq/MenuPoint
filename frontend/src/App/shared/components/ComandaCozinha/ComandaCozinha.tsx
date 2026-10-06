import React, { useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { HiX, HiPrinter, HiOutlineBell } from 'react-icons/hi';
import { useAuth } from '../../contexts/Authcontext';
import { gerarComanda, formatarMoeda, PedidoParaComanda } from './comanda';
import './ComandaCozinha.css';

interface ComandaCozinhaProps {
  aberta: boolean;
  /** Pedido da mesa. A comanda é gerada a partir dele a cada abertura. */
  pedido: PedidoParaComanda | null;
  onFechar: () => void;
  /** Mostra o preço de cada item na comanda (padrão: sim, como no protótipo) */
  mostrarPrecos?: boolean;
  /** Categorias que não devem sair na comanda (ex.: ['Bebidas']) */
  ignorarCategorias?: string[];
}

const ROTULO_PERFIL: Record<string, string> = {
  CAIXA: 'Caixa',
  ATENDENTE: 'Atendente',
  ADMIN: 'Admin',
};

/**
 * Modal com a comanda da cozinha de uma mesa.
 *
 * Renderiza num portal direto no <body> para o CSS de impressão conseguir
 * esconder o resto do app (#root) e imprimir só a comanda.
 */
const ComandaCozinha: React.FC<ComandaCozinhaProps> = ({
  aberta,
  pedido,
  onFechar,
  mostrarPrecos = true,
  ignorarCategorias,
}) => {
  const { usuario } = useAuth();

  const impressoPor = usuario
    ? `${ROTULO_PERFIL[usuario.perfil] ?? usuario.perfil} - ${usuario.nome}`
    : undefined;

  // Gera a comanda toda vez que o modal abre / o pedido muda
  const comanda = useMemo(
    () => (aberta && pedido ? gerarComanda(pedido, { impressoPor, ignorarCategorias }) : null),
    [aberta, pedido, impressoPor, ignorarCategorias]
  );

  // Esc fecha + marca o <body> para o CSS de impressão
  useEffect(() => {
    if (!aberta) return;
    document.body.classList.add('comanda-aberta');
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onFechar();
    };
    window.addEventListener('keydown', onKey);
    return () => {
      document.body.classList.remove('comanda-aberta');
      window.removeEventListener('keydown', onKey);
    };
  }, [aberta, onFechar]);

  if (!aberta || !comanda) return null;

  return createPortal(
    <div className="comanda__overlay" onClick={onFechar}>
      <div
        className="comanda__modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="comanda-titulo"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Barra do modal — não sai na impressão */}
        <div className="comanda__barra">
          <h3 id="comanda-titulo" className="comanda__barra-titulo">
            Comanda da cozinha · Mesa {comanda.mesa}
          </h3>
          <button className="comanda__barra-fechar" onClick={onFechar} aria-label="Fechar">
            <HiX />
          </button>
        </div>

        <div className="comanda__corpo">
          {/* ── A comanda em si (é isto que vai para o papel) ── */}
          <div className="comanda-folha">
            <p className="comanda-folha__aviso">NÃO DESTACAR - COMANDA PARA COZINHA</p>

            <div className="comanda-folha__cabecalho">
              <div className="comanda-folha__marca">
                <span className="comanda-folha__marca-nome">MenuPoint</span>
                <span className="comanda-folha__marca-slogan">
                  O ponto que transforma fome em vendas
                </span>
              </div>

              <div className="comanda-folha__setor">
                <span className="comanda-folha__setor-pill">COZINHA</span>
                <p>IMPRESSO EM: {comanda.impressoEm}</p>
                {comanda.impressoPor && <p>POR: {comanda.impressoPor}</p>}
              </div>
            </div>

            <div className="comanda-folha__meta">
              <div className="comanda-folha__meta-mesa">
                <strong>MESA: {comanda.mesa}</strong>
                <span>
                  {comanda.pessoas} {comanda.pessoas === 1 ? 'PESSOA' : 'PESSOAS'}
                </span>
              </div>
              <div className="comanda-folha__meta-pedido">
                <strong>PEDIDO: {comanda.numeroPedido}</strong>
                <span>TIPO: {comanda.tipo}</span>
                {comanda.atendente && <span>ATENDIMENTO: {comanda.atendente}</span>}
              </div>
            </div>

            {comanda.observacoesMesa && (
              <div className="comanda-folha__obs">
                <HiOutlineBell className="comanda-folha__obs-icone" />
                <div>
                  <strong>OBSERVAÇÕES DA MESA</strong>
                  <p>{comanda.observacoesMesa}</p>
                </div>
              </div>
            )}

            {comanda.grupos.length === 0 ? (
              <p className="comanda-folha__vazio">Nenhum item neste pedido.</p>
            ) : (
              comanda.grupos.map((grupo) => (
                <section key={grupo.categoria} className="comanda-folha__grupo">
                  <span className="comanda-folha__grupo-pill">{grupo.categoria.toUpperCase()}</span>

                  {grupo.itens.map((item) => (
                    <div key={item.id} className="comanda-folha__item">
                      <span className="comanda-folha__item-qtd">{item.quantidade}x</span>
                      <div className="comanda-folha__item-info">
                        <strong>{item.nome}</strong>
                        {item.detalhes.map((d, i) => (
                          <span key={i} className="comanda-folha__item-detalhe">– {d}</span>
                        ))}
                      </div>
                      {mostrarPrecos && (
                        <span className="comanda-folha__item-preco">{formatarMoeda(item.subtotal)}</span>
                      )}
                    </div>
                  ))}
                </section>
              ))
            )}

            <p className="comanda-folha__rodape">TOTAL DE ITENS: {comanda.totalItens}</p>
          </div>
        </div>

        {/* Ações — não saem na impressão */}
        <div className="comanda__acoes">
          <button className="comanda__btn comanda__btn--sec" onClick={onFechar}>
            Fechar
          </button>
          <button className="comanda__btn comanda__btn--prim" onClick={() => window.print()}>
            <HiPrinter /> Imprimir
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
};

export default ComandaCozinha;
