import React, { useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { HiArrowLeft, HiPlus, HiOutlineTrash } from 'react-icons/hi';
import RestaurantLayout from '../../../../shared/components/layout/Restaurantelayout';
import './PagarParcial.css';

// ── Tipos ──────────────────────────────────────────────────────────────────────
interface ItemPedido {
  id: string;
  nome: string;
  quantidade: number;
  precoUnitario: number;
}

const MEIOS_PAGAMENTO = ['Débito', 'Crédito', 'Pix', 'Dinheiro'] as const;
type MeioPagamento = (typeof MEIOS_PAGAMENTO)[number];

interface FormaPagamento {
  id: string;
  meio: MeioPagamento;
  valor: number;
}

// ── Mock (substituir por chamada à API futuramente — pedido.service.ts) ────────
// Mesmos ids de mesa usados em PagarMesa.tsx, pra manter a comanda consistente
// entre as duas telas quando o operador vem de lá.
const ITENS_POR_MESA_MOCK: Record<string, ItemPedido[]> = {
  m1: [
    { id: 'p1', nome: 'X-Burguer',    quantidade: 2, precoUnitario: 25.0 },
    { id: 'p2', nome: 'Batata Frita', quantidade: 1, precoUnitario: 15.0 },
  ],
  m2: [
    { id: 'p3', nome: 'Picanha na Chapa',    quantidade: 1, precoUnitario: 89.9 },
    { id: 'p4', nome: 'Refrigerante Lata',   quantidade: 2, precoUnitario: 11.0 },
    { id: 'p5', nome: 'Batata Frita',        quantidade: 1, precoUnitario: 19.9 },
    { id: 'p6', nome: 'Água com Gás',        quantidade: 1, precoUnitario: 8.0  },
    { id: 'p7', nome: 'Brownie com Sorvete', quantidade: 1, precoUnitario: 21.9 },
  ],
  m3: [
    { id: 'p8', nome: 'Suco Natural',      quantidade: 2, precoUnitario: 9.0 },
    { id: 'p9', nome: 'Refrigerante Lata', quantidade: 1, precoUnitario: 6.0 },
  ],
  m4: [
    { id: 'p10', nome: 'Macarrão ao Molho', quantidade: 4, precoUnitario: 24.99 },
    { id: 'p11', nome: 'X-Burguer',         quantidade: 2, precoUnitario: 25.0  },
    { id: 'p12', nome: 'Refrigerante Lata', quantidade: 3, precoUnitario: 6.0   },
  ],
  m5: [
    { id: 'p13', nome: 'Batata Frita', quantidade: 1, precoUnitario: 15.0 },
  ],
  m6: [
    { id: 'p14', nome: 'X-Burguer',    quantidade: 3, precoUnitario: 25.0 },
    { id: 'p15', nome: 'Suco Natural', quantidade: 2, precoUnitario: 9.0  },
  ],
};

// Gera um id único de verdade (o mock anterior usava uma variável de módulo
// que reiniciava a cada render, o que colidia ids entre as formas de pagamento)
const gerarIdForma = () => `f${Date.now()}${Math.floor(Math.random() * 1000)}`;

// ── Componente ─────────────────────────────────────────────────────────────────
const PagarParcial: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  // Fallback pra 'm1' evita tela quebrada se o id não existir no mock —
  // mesmo padrão usado em PagarMesa.tsx
  const itensMesa = (id && ITENS_POR_MESA_MOCK[id]) || ITENS_POR_MESA_MOCK['m1'];

  const formatarMoeda = (valor: number) =>
    valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

  // ── Coluna esquerda: seleção de itens ────────────────────────────────────────
  const [itensSelecionados, setItensSelecionados] = useState<Set<string>>(new Set());

  const alternarItem = (itemId: string) => {
    setItensSelecionados((atual) => {
      const novo = new Set(atual);
      novo.has(itemId) ? novo.delete(itemId) : novo.add(itemId);
      return novo;
    });
  };

  const valorSelecionado = useMemo(
    () =>
      itensMesa
        .filter((item) => itensSelecionados.has(item.id))
        .reduce((soma, item) => soma + item.quantidade * item.precoUnitario, 0),
    [itensMesa, itensSelecionados],
  );

  // ── Coluna direita: divisão do pagamento ─────────────────────────────────────
  const [formasPagamento, setFormasPagamento] = useState<FormaPagamento[]>([
    { id: 'f1', meio: 'Débito', valor: 0 },
    { id: 'f2', meio: 'Pix',    valor: 0 },
  ]);

  const totalPago = useMemo(
    () => formasPagamento.reduce((soma, forma) => soma + forma.valor, 0),
    [formasPagamento],
  );

  const percentual = (valor: number) =>
    valorSelecionado > 0 ? ((valor / valorSelecionado) * 100).toFixed(2) : '0,00';

  const percentualTotal =
    valorSelecionado > 0 ? ((totalPago / valorSelecionado) * 100).toFixed(0) : '0';

  const atualizarForma = (formaId: string, campo: 'meio' | 'valor', valor: string) => {
    setFormasPagamento((formas) =>
      formas.map((forma) =>
        forma.id === formaId
          ? { ...forma, [campo]: campo === 'valor' ? Number(valor) || 0 : (valor as MeioPagamento) }
          : forma,
      ),
    );
  };

  const adicionarForma = () => {
    setFormasPagamento((formas) => [...formas, { id: gerarIdForma(), meio: 'Dinheiro', valor: 0 }]);
  };

  const removerForma = (formaId: string) => {
    setFormasPagamento((formas) => formas.filter((forma) => forma.id !== formaId));
  };

  const diferenca = Number((valorSelecionado - totalPago).toFixed(2));
  const pagamentoValido = itensSelecionados.size > 0 && diferenca === 0;

  const concluirPagamento = () => {
    if (!pagamentoValido) return;
    // TODO: chamar pagameto.service.ts — { mesaId: id, itens: [...itensSelecionados], formasPagamento }
    navigate('/restaurante/caixa');
  };

  return (
    <RestaurantLayout>
      <div className="pagar-parcial">

        {/* ── Cabeçalho ── */}
        <div className="pagar-parcial__header">
          <button
            className="pagar-parcial__voltar"
            onClick={() => navigate(`/restaurante/caixa/pagar`)}
            aria-label="Voltar para a comanda"
          >
            <HiArrowLeft />
          </button>
          <div>
            <h2 className="pagar-parcial__titulo-pagina">Pagamento parcial</h2>
            <p className="pagar-parcial__subtitulo-pagina">
              Selecione os itens e divida o valor entre as formas de pagamento
            </p>
          </div>
        </div>

        <div className="pagar-parcial__corpo">

          {/* Coluna esquerda — seleção dos itens da mesa */}
          <section className="pagar-parcial__card pagar-parcial__card--itens">
            <div className="pagar-parcial__tabs">
              <span className="pagar-parcial__tab pagar-parcial__tab--ativa">Por itens</span>
            </div>

            <ul className="pagar-parcial__lista-itens">
              {itensMesa.map((item) => {
                const marcado = itensSelecionados.has(item.id);
                return (
                  <li key={item.id} className="pagar-parcial__item">
                    <label className="pagar-parcial__item-label">
                      <input
                        type="checkbox"
                        className="pagar-parcial__checkbox"
                        checked={marcado}
                        onChange={() => alternarItem(item.id)}
                      />
                      <span className="pagar-parcial__item-nome">{item.nome}</span>
                    </label>
                    <span className="pagar-parcial__item-qtd">{item.quantidade}x</span>
                    <span className="pagar-parcial__item-preco">
                      {formatarMoeda(item.quantidade * item.precoUnitario)}
                    </span>
                  </li>
                );
              })}
            </ul>

            <div className="pagar-parcial__resumo-itens">
              <span>{itensSelecionados.size} itens selecionados</span>
              <strong>{formatarMoeda(valorSelecionado)}</strong>
            </div>
          </section>

          {/* Coluna direita — divisão do valor selecionado */}
          <section className="pagar-parcial__card pagar-parcial__card--pagamento">
            <h3 className="pagar-parcial__titulo">Dividir pagamento</h3>

            <div className="pagar-parcial__linha pagar-parcial__linha--destaque">
              <span>Valor a pagar</span>
              <strong>{formatarMoeda(valorSelecionado)}</strong>
            </div>

            <div className="pagar-parcial__formas">
              <p className="pagar-parcial__subtitulo">Formas de pagamento</p>

              {formasPagamento.map((forma) => (
                <div key={forma.id} className="pagar-parcial__forma">
                  <label className="pagar-parcial__campo">
                    <span>Meio</span>
                    <select
                      value={forma.meio}
                      onChange={(e) => atualizarForma(forma.id, 'meio', e.target.value)}
                    >
                      {MEIOS_PAGAMENTO.map((meio) => (
                        <option key={meio} value={meio}>{meio}</option>
                      ))}
                    </select>
                  </label>

                  <label className="pagar-parcial__campo">
                    <span>Valor</span>
                    <div className="pagar-parcial__campo-valor">
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        value={forma.valor}
                        onChange={(e) => atualizarForma(forma.id, 'valor', e.target.value)}
                      />
                      <em className="pagar-parcial__percentual">{percentual(forma.valor)}%</em>
                    </div>
                  </label>

                  <button
                    type="button"
                    className="pagar-parcial__remover"
                    onClick={() => removerForma(forma.id)}
                    aria-label={`Remover forma de pagamento ${forma.meio}`}
                  >
                    <HiOutlineTrash />
                  </button>
                </div>
              ))}

              <button type="button" className="pagar-parcial__adicionar" onClick={adicionarForma}>
                <HiPlus /> Adicionar forma de pagamento
              </button>
            </div>

            <div className="pagar-parcial__linha pagar-parcial__linha--total">
              <span>Total</span>
              <div className="pagar-parcial__total-valor">
                <strong>{formatarMoeda(totalPago)}</strong>
                <em>{percentualTotal}%</em>
              </div>
            </div>

            {!pagamentoValido && itensSelecionados.size > 0 && (
              <p className="pagar-parcial__aviso">
                {diferenca > 0
                  ? `Faltam ${formatarMoeda(diferenca)} para completar o pagamento`
                  : `As formas de pagamento excedem o valor em ${formatarMoeda(Math.abs(diferenca))}`}
              </p>
            )}

            <button
              type="button"
              className="pagar-parcial__concluir"
              disabled={!pagamentoValido}
              onClick={concluirPagamento}
            >
              Concluir pagamento
            </button>
          </section>

        </div>
      </div>
    </RestaurantLayout>
  );
};

export default PagarParcial;