import React, { useEffect, useRef } from 'react';
import { HiClock, HiLockClosed, HiX } from 'react-icons/hi';
import { formatarPreco, IngredienteProduto } from '../../utils/ingredientes';
import './ProdutoDetalhe.css';

/**
 * Modal com todas as informações de um produto do cardápio (foto, descrição, preço, tempo de preparo,
 * o que já vem e os adicionais). Usado no cardápio do delivery e no da mesa.
 * Fecha com o X, clicando fora ou com Esc. O botão principal leva para a personalização do pedido.
 */

export interface ProdutoDetalheDados {
  nome: string;
  descricao: string;
  /** Preço cobrado hoje (já é o promocional, quando há) */
  preco: number;
  /** Preço "de": só quando existe promoção */
  precoOriginal?: number | null;
  imagem: string;
  destaque?: boolean;
  categoriaNome?: string;
  tempoPreparoMin?: number | null;
  ingredientes: IngredienteProduto[];
}

interface ProdutoDetalheProps {
  produto: ProdutoDetalheDados | null;
  onFechar: () => void;
  onPedir: () => void;
}

const ProdutoDetalhe: React.FC<ProdutoDetalheProps> = ({ produto, onFechar, onPedir }) => {
  const fecharRef = useRef<HTMLButtonElement>(null);
  const aberto = produto !== null;

  // Esc fecha, a página de trás não rola e o foco começa no botão de fechar
  useEffect(() => {
    if (!aberto) return;
    const aoTeclar = (e: KeyboardEvent) => { if (e.key === 'Escape') onFechar(); };
    const overflowAnterior = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', aoTeclar);
    fecharRef.current?.focus();
    return () => {
      window.removeEventListener('keydown', aoTeclar);
      document.body.style.overflow = overflowAnterior;
    };
  }, [aberto, onFechar]);

  if (!produto) return null;

  const inclusos = produto.ingredientes.filter((i) => i.quantidadeInclusa > 0);
  const adicionais = produto.ingredientes.filter((i) => i.quantidadeInclusa === 0);
  const emPromocao = produto.precoOriginal != null && produto.precoOriginal > produto.preco;
  const desconto = emPromocao
    ? Math.round((1 - produto.preco / (produto.precoOriginal as number)) * 100)
    : 0;

  return (
    <div className="pdet__overlay" onClick={onFechar}>
      <div
        className="pdet"
        role="dialog"
        aria-modal="true"
        aria-labelledby="pdet-titulo"
        onClick={(e) => e.stopPropagation()}
      >
        <button ref={fecharRef} type="button" className="pdet__fechar" onClick={onFechar} aria-label="Fechar detalhes do produto">
          <HiX aria-hidden="true" />
        </button>

        <div className="pdet__rolagem">
          <div className="pdet__foto-wrap">
            <img src={produto.imagem} alt={produto.nome} className="pdet__foto" />
            {produto.destaque && <span className="pdet__selo">⭐ Destaque</span>}
          </div>

          <div className="pdet__corpo">
            {produto.categoriaNome && <span className="pdet__categoria">{produto.categoriaNome}</span>}
            <h2 id="pdet-titulo" className="pdet__nome">{produto.nome}</h2>

            <div className="pdet__linha-preco">
              <div className="pdet__precos">
                {emPromocao && <span className="pdet__preco-de">{formatarPreco(produto.precoOriginal as number)}</span>}
                <span className="pdet__preco">{formatarPreco(produto.preco)}</span>
                {emPromocao && <span className="pdet__desconto">-{desconto}%</span>}
              </div>
              {produto.tempoPreparoMin ? (
                <span className="pdet__tempo" title="Tempo médio de preparo">
                  <HiClock aria-hidden="true" /> ~{produto.tempoPreparoMin} min
                </span>
              ) : null}
            </div>

            <p className={`pdet__descricao${produto.descricao ? '' : ' pdet__descricao--vazia'}`}>
              {produto.descricao || 'Este produto não tem descrição.'}
            </p>

            {inclusos.length > 0 && (
              <section className="pdet__secao">
                <h3 className="pdet__secao-titulo">O que já vem</h3>
                <ul className="pdet__lista">
                  {inclusos.map((i) => {
                    const temExtra = i.quantidadeMaxima > i.quantidadeInclusa;
                    return (
                      <li key={i.id} className="pdet__item">
                        <div className="pdet__item-info">
                          <strong>{i.quantidadeInclusa > 1 ? `${i.quantidadeInclusa}× ` : ''}{i.nome}</strong>
                          {temExtra && (
                            <span className="pdet__item-nota">
                              Extra {i.precoExtra > 0 ? `+${formatarPreco(i.precoExtra)}` : 'grátis'} · até {i.quantidadeMaxima} no total
                            </span>
                          )}
                        </div>
                        {i.fixo ? (
                          <span className="pdet__tag pdet__tag--fixo" title="Faz parte do produto e não pode ser retirado">
                            <HiLockClosed aria-hidden="true" /> Fixo
                          </span>
                        ) : (
                          <span className="pdet__tag">Pode retirar</span>
                        )}
                      </li>
                    );
                  })}
                </ul>
              </section>
            )}

            {adicionais.length > 0 && (
              <section className="pdet__secao">
                <h3 className="pdet__secao-titulo">Adicionais</h3>
                <ul className="pdet__lista">
                  {adicionais.map((i) => (
                    <li key={i.id} className="pdet__item">
                      <div className="pdet__item-info">
                        <strong>{i.nome}</strong>
                        <span className="pdet__item-nota">até {i.quantidadeMaxima}</span>
                      </div>
                      <span className="pdet__item-preco">
                        {i.precoExtra > 0 ? `+${formatarPreco(i.precoExtra)}` : 'Grátis'}
                      </span>
                    </li>
                  ))}
                </ul>
              </section>
            )}
          </div>
        </div>

        <div className="pdet__rodape">
          <button type="button" className="pdet__pedir" onClick={onPedir}>
            Personalizar e pedir
          </button>
        </div>
      </div>
    </div>
  );
};

export default ProdutoDetalhe;
