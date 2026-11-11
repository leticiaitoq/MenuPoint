import React from 'react'
import type { FormaPagamentoDelivery } from '../../../services/pedidoCliente.service'
import type { ItemCarrinho } from '../Carrinho/Carrinho'
import type { CriarPedidoDeliveryDTO } from '../../../services/pedidoCliente.service'
import './PagamentoDelivery.css'

export const FORMAS_DELIVERY: { valor: FormaPagamentoDelivery; rotulo: string }[] = [
  { valor: 'PIX_PRESENCIAL', rotulo: 'Pix' },
  { valor: 'DINHEIRO', rotulo: 'Dinheiro' },
  { valor: 'CARTAO', rotulo: 'Cartão' },
]

export const dinheiroBR = (v: number) => `R$ ${v.toFixed(2).replace('.', ',')}`

/** Itens do carrinho no formato do POST. Só ids e quantidades: o preço é sempre o do servidor. */
export const itensParaPedido = (itens: ItemCarrinho[]): CriarPedidoDeliveryDTO['itens'] =>
  itens.map((i) => ({
    produto_id: i.produtoId as string,
    quantidade: i.quantidade,
    ...(i.observacao ? { observacoes: i.observacao } : {}),
    ...(i.ingredientes?.length ? { ingredientes: i.ingredientes } : {}),
    ...(i.paraLevar ? { para_levar: true } : {}),
  }))

interface Props {
  forma: FormaPagamentoDelivery
  onChange: (f: FormaPagamentoDelivery) => void
  /** "na entrega" ou "na retirada" */
  momento: string
  subtotal: number
  taxa?: number
}

/** Forma de pagamento (feito na hora) + resumo do valor, para as telas de confirmação do delivery */
const PagamentoDelivery: React.FC<Props> = ({ forma, onChange, momento, subtotal, taxa = 0 }) => (
  <div className="pag-deliv">
    <p className="pag-deliv__titulo">Pagamento {momento}</p>
    <div className="pag-deliv__formas">
      {FORMAS_DELIVERY.map((f) => (
        <button
          key={f.valor}
          type="button"
          className={`pag-deliv__forma${forma === f.valor ? ' pag-deliv__forma--ativa' : ''}`}
          onClick={() => onChange(f.valor)}
        >
          {f.rotulo}
        </button>
      ))}
    </div>
    <div className="pag-deliv__resumo">
      <span>Itens</span>
      <span>{dinheiroBR(subtotal)}</span>
    </div>
    {taxa > 0 && (
      <div className="pag-deliv__resumo">
        <span>Taxa de entrega</span>
        <span>{dinheiroBR(taxa)}</span>
      </div>
    )}
    <div className="pag-deliv__resumo pag-deliv__resumo--total">
      <span>Total</span>
      <span>{dinheiroBR(subtotal + taxa)}</span>
    </div>
  </div>
)

export default PagamentoDelivery
