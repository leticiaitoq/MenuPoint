import React from 'react';
import { FaShoppingCart } from 'react-icons/fa';
import { HiChevronRight } from 'react-icons/hi';
import './Carrinho.css';

// ── Tipos 
export interface ItemCarrinho {
  id: string;
  nome: string;
  preco: number;
  quantidade: number;
  imagem: string;
}

interface CarrinhoProps {
  aberto: boolean;
  onFechar: () => void;
  itens: ItemCarrinho[];
  onFinalizar: () => void;
  onRemover: (id: string) => void;
}


const Carrinho: React.FC<CarrinhoProps> = ({ aberto, onFechar, itens, onFinalizar, onRemover }) => {
  const total = itens.reduce((acc, i) => acc + i.preco * i.quantidade, 0);
  
  return (
    <>
      {/* Overlay escuro que fecha o carrinho ao clicar */}
      {aberto && (
        <div className="carrinho__overlay" onClick={onFechar} />
      )}

      {/* Painel lateral */}
      <aside className={`carrinho__painel${aberto ? ' carrinho__painel--aberto' : ''}`}
      style={{
        backgroundImage: 'url(./images/Fundo-historico.png)',
        backgroundRepeat: 'no-repeat',
        backgroundPosition: 'center',
        backgroundSize: 'cover' 
        }}>

        {/* Cabeçalho */}
        <div className="carrinho__header">
          <h2 className="carrinho__titulo">Meu Carrinho</h2>
          <div className="carrinho__header-acoes">
            <div className="carrinho__icone-wrap">
              <FaShoppingCart className="carrinho__icone" />
              {itens.length > 0 && (
                <span className="carrinho__badge">{itens.reduce((a, i) => a + i.quantidade, 0)}</span>
              )}
            </div>
            <button className="carrinho__fechar" onClick={onFechar} aria-label="Fechar carrinho">
              <HiChevronRight />
            </button>
          </div>
        </div>

        {/* Lista de itens */}
        <div className="carrinho__lista">
          {itens.length === 0 ? (
            <p className="carrinho__vazio">Seu carrinho está vazio.</p>
          ) : (
            itens.map((item) => (
              <div key={item.id} className="carrinho__item">
                <img src={item.imagem} alt={item.nome} className="carrinho__item-img" />
                <div className="carrinho__item-info">
                  <span className="carrinho__item-nome">{item.nome}</span>
                  <span className="carrinho__item-qtd">{item.quantidade}x</span>
                </div>
                <span className="carrinho__item-preco">
                  R${(item.preco * item.quantidade).toFixed(2).replace('.', ',')}
                </span>
                <button className="carrinho__item-del" onClick={() => onRemover(item.id)}
                     aria-label={`Remover ${item.nome}`}>
                       🗑️
                 </button>
              </div>
            ))
          )}
        </div>

        {/* Rodapé: total + botão */}
        <div className="carrinho__rodape">
          <div className="carrinho__total">
            <span>Total:</span>
            <span>R${total.toFixed(2).replace('.', ',')}</span>
          </div>
          <button
            className="carrinho__btn-finalizar"
            onClick={onFinalizar}
            disabled={itens.length === 0}
          >
            Finalizar pedido
          </button>
        </div>

      </aside>
    </>
  );
};

export default Carrinho;