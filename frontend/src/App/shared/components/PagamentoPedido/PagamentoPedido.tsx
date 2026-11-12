import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { HiArrowLeft, HiCheck, HiClipboardCopy, HiPhone } from 'react-icons/hi';
import { FaWhatsapp } from 'react-icons/fa';
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

export interface RestauranteContato {
  nome: string;
  telefone?: string | null;
  whatsapp?: string | null;
  chave_pix?: string | null;
  tipo_chave_pix?: string | null;
}

const soDigitos = (v: string) => v.replace(/\D/g, '');
const semDdi = (v: string) => {
  const d = soDigitos(v);
  return d.length > 11 && d.startsWith('55') ? d.slice(2) : d;
};

const formatarFone = (v: string): string => {
  const d = semDdi(v);
  if (d.length === 11) return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
  if (d.length === 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return v;
};

const ROTULO_CHAVE: Record<string, string> = {
  CPF: 'CPF', CNPJ: 'CNPJ', EMAIL: 'E-mail', TELEFONE: 'Telefone', ALEATORIA: 'Chave aleatória',
};

const formatarChavePix = (tipo: string | null | undefined, chave: string): string => {
  const d = soDigitos(chave);
  if (tipo === 'CPF' && d.length === 11) return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9)}`;
  if (tipo === 'CNPJ' && d.length === 14) return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8, 12)}-${d.slice(12)}`;
  if (tipo === 'TELEFONE') return formatarFone(chave);
  return chave;
};

interface Props {
  itens: ItemCarrinho[];
  restaurante?: RestauranteContato | null;
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

const PagamentoPedido: React.FC<Props> = ({ itens, restaurante, taxaEntrega, momento, forma, onForma, troco, onTroco }) => {
  const [copiado, setCopiado] = useState(false);
  const subtotal = itens.reduce((acc, i) => acc + i.preco * i.quantidade, 0);
  const total = subtotal + taxaEntrega;
  const chavePix = restaurante?.chave_pix?.trim() || '';
  const fone = restaurante?.telefone ? semDdi(restaurante.telefone) : '';
  const zap = semDdi(restaurante?.whatsapp || restaurante?.telefone || '');

  const copiarChave = async () => {
    try {
      await navigator.clipboard.writeText(chavePix);
      setCopiado(true);
      window.setTimeout(() => setCopiado(false), 2000);
    } catch {
      setCopiado(false);
    }
  };

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

      {forma === 'PIX_PRESENCIAL' && chavePix && (
        <div className="pgp__pix">
          <span className="pgp__pix-rotulo">Pagar com Pix · {ROTULO_CHAVE[restaurante?.tipo_chave_pix ?? ''] ?? 'Chave'}</span>
          <div className="pgp__pix-linha">
            <strong className="pgp__pix-chave">{formatarChavePix(restaurante?.tipo_chave_pix, chavePix)}</strong>
            <button type="button" className="pgp__pix-copiar" onClick={copiarChave}>
              {copiado ? <HiCheck aria-hidden="true" /> : <HiClipboardCopy aria-hidden="true" />}
              {copiado ? 'Copiado' : 'Copiar'}
            </button>
          </div>
          <small>Faça o Pix de {formatarPreco(total)} para {restaurante?.nome ?? 'o restaurante'} e mostre o comprovante {momento}.</small>
        </div>
      )}

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

      {(fone || zap) && (
        <div className="pgp__contato">
          <span className="pgp__contato-titulo">Dúvidas? Fale com {restaurante?.nome ?? 'o restaurante'}</span>
          <div className="pgp__contato-links">
            {fone && (
              <a className="pgp__contato-link" href={`tel:+55${fone}`}>
                <HiPhone aria-hidden="true" /> {formatarFone(fone)}
              </a>
            )}
            {zap && (
              <a className="pgp__contato-link" href={`https://wa.me/55${zap}`} target="_blank" rel="noopener noreferrer">
                <FaWhatsapp aria-hidden="true" /> WhatsApp
              </a>
            )}
          </div>
        </div>
      )}
    </section>
  );
};

export default PagamentoPedido;

interface AcoesProps {
  rotulo: string;
  enviando: boolean;
  desabilitado?: boolean;
  onConfirmar: () => void;
}

export const AcoesPedido: React.FC<AcoesProps> = ({ rotulo, enviando, desabilitado = false, onConfirmar }) => {
  const navigate = useNavigate();
  return (
    <div className="pgp__acoes">
      <button
        type="button"
        className="pgp__btn-voltar"
        onClick={() => navigate('/menu', { state: { abrirCarrinho: true } })}
        disabled={enviando}
      >
        <HiArrowLeft aria-hidden="true" /> Voltar ao carrinho
      </button>
      <button type="button" className="pgp__btn-confirmar" onClick={onConfirmar} disabled={enviando || desabilitado}>
        {enviando ? 'Enviando...' : rotulo}
      </button>
    </div>
  );
};

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