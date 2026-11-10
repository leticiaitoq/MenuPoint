import React from 'react';
import { ItemCarrinho } from '../Carrinho/Carrinho';
import { FormaPagamentoOnline } from '../../../services/pedidoCliente.service';
import './PagamentoPedido.css';

// Resumo do pedido + escolha da forma de pagamento (acertado na entrega/retirada).

export const FORMAS_PAGAMENTO: { valor: FormaPagamentoOnline; titulo: string; descricao: string }[] = [
  { valor: 'PIX_PRESENCIAL', titulo: 'Pix', descricao: 'Pague por Pix na hora' },
  { valor: 'DINHEIRO',       titulo: 'Dinheiro', descricao: 'Pague em dinheiro' },
  { valor: 'CARTAO',         titulo: 'Cartão', descricao: 'Débito ou crédito na maquininha' },
];

export const NOME_FORMA_PAGAMENTO: Record<string, string> = {
  PIX_PRESENCIAL: 'Pix na hora',
  PIX_ONLINE: 'Pix',
  DINHEIRO: 'Dinheiro',
  CARTAO: 'Cartão',
};

export const formatarPreco = (valor: number): string =>
  `R$ ${valor.toFixed(2).replace('.', ',')}`;

interface Props {
  itens: ItemCarrinho[];
  /** 0 na retirada */
  taxaEntrega: number;
  /** Texto do momento do pagamento: "na entrega" ou "na retirada" */
  momento: 'na entrega' | 'na retirada';
  forma: FormaPagamentoOnline | null;
  onForma: (forma: FormaPagamentoOnline) => void;
  /** Texto digitado em "troco para quanto?" (vazio = sem troco) */
  troco: string;
  onTroco: (valor: string) => void;
}

const PagamentoPedido: React.FC<Props> = ({ itens, taxaEntrega, momento, forma, onForma, troco, onTroco }) => {
  const subtotal = itens.reduce((acc, i) => acc + i.preco * i.quantidade, 0);
  const total = subtotal + taxaEntrega;

  return (
    <section className="pgp">
      <h2 className="pgp__titulo">Resumo do pedido</h2>

      <ul className="pgp__itens">
        {itens.map((i) => (
          <li key={i.id} className="pgp__item">
            <span>{i.quantidade}x {i.nome}</span>
            <span>{formatarPreco(i.preco * i.quantidade)}</span>
          </li>
        ))}
      </ul>

      <div className="pgp__linha"><span>Subtotal</span><span>{formatarPreco(subtotal)}</span></div>
      {taxaEntrega > 0 && (
        <div className="pgp__linha"><span>Taxa de entrega</span><span>{formatarPreco(taxaEntrega)}</span></div>
      )}
      <div className="pgp__linha pgp__linha--total"><span>Total</span><span>{formatarPreco(total)}</span></div>

      <h2 className="pgp__titulo">Como você vai pagar {momento}?</h2>
      <div className="pgp__formas" role="radiogroup" aria-label="Forma de pagamento">
        {FORMAS_PAGAMENTO.map((f) => (
          <button
            key={f.valor}
            type="button"
            role="radio"
            aria-checked={forma === f.valor}
            className={`pgp__forma ${forma === f.valor ? 'pgp__forma--ativa' : ''}`}
            onClick={() => onForma(f.valor)}
          >
            <span className="pgp__forma-info">
              <strong>{f.titulo}</strong>
              <small>{f.descricao}</small>
            </span>
            <span className="pgp__radio">{forma === f.valor && <span className="pgp__radio-dot" />}</span>
          </button>
        ))}
      </div>

      {forma === 'DINHEIRO' && (
        <label className="pgp__troco">
          <span>Precisa de troco? Para quanto? (opcional)</span>
          <span className="pgp__troco-campo">
            <span className="pgp__troco-prefixo" aria-hidden="true">R$</span>
            <input
              className="pgp__troco-input"
              inputMode="numeric"
              placeholder="0,00"
              value={troco}
              onChange={(e) => onTroco(mascaraDinheiro(e.target.value))}
            />
          </span>
        </label>
      )}
    </section>
  );
};

export default PagamentoPedido;

/**
 * Máscara de dinheiro: cada dígito digitado entra pelos centavos.
 */
export const mascaraDinheiro = (texto: string): string => {
  const digitos = texto.replace(/\D/g, '').slice(0, 9).replace(/^0+/, '');
  if (!digitos) return '';
  const centavos = digitos.padStart(3, '0');
  const reais = centavos.slice(0, -2).replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  return `${reais},${centavos.slice(-2)}`;
};

export const trocoParaNumero = (texto: string): number | undefined => {
  const n = Number(texto.replace(/\./g, '').replace(',', '.'));
  return Number.isFinite(n) && n > 0 ? n : undefined;
};