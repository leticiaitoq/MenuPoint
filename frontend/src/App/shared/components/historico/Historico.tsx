import React from 'react';
import { HiClipboardList } from 'react-icons/hi';
import './Historico.css';

// ── Tipos ──────────────────────────────────────────────
export interface PedidoHistorico {
  id: string;
  nome: string;
  preco: number;
  quantidade: number;
  imagem: string;
}

interface HistoricoProps {
  aberto: boolean;
  onFechar: () => void;
  itens: PedidoHistorico[];
}

const Historico: React.FC<HistoricoProps> = ({ aberto, onFechar, itens }) => {
  const total = itens.reduce((acc, i) => acc + i.preco * i.quantidade, 0);

  if (!aberto) return null;

  return (
    <>
      {/* Overlay escuro — clicando fecha */}
      <div className="historico__overlay" onClick={onFechar} />

      {/* Modal centralizado */}
      <div className="historico__modal" style={{
        backgroundImage: 'url(./images/Fundo-historico.png)',
        backgroundRepeat: 'no-repeat',
        backgroundPosition: 'center',
        backgroundSize: 'cover' 
        }}>

        {/* Cabeçalho */}
        <div className="historico__header">
          <h2 className="historico__titulo">Meu Histórico</h2>
          <HiClipboardList className="historico__header-icon" />
        </div>

        {/* Lista de itens */}
        <div className="historico__lista">
          {itens.length === 0 ? (
            <p className="historico__vazio">Nenhum pedido realizado ainda.</p>
          ) : (
            itens.map((item) => (
              <div key={item.id} className="historico__item">
                <img src={item.imagem} alt={item.nome} className="historico__item-img" />
                <div className="historico__item-info">
                  <span className="historico__item-nome">{item.nome}</span>
                  <span className="historico__item-qtd">{item.quantidade}x</span>
                </div>
                <span className="historico__item-preco">
                  R${(item.preco * item.quantidade).toFixed(2).replace('.', ',')}
                </span>
              </div>
            ))
          )}
        </div>

        {/* Rodapé */}
        <div className="historico__rodape">
          <div className="historico__total">
            <span>Total:</span>
            <span>R${total.toFixed(2).replace('.', ',')}</span>
          </div>
          <button className="historico__btn-sair" onClick={onFechar}>
            Sair
          </button>
        </div>

      </div>
    </>
  );
};

export default Historico;