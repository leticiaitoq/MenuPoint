import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Navigate, useNavigate, useParams } from 'react-router-dom';
import { HiArrowLeft, HiPlus, HiOutlineTrash } from 'react-icons/hi';
import RestaurantLayout from '../../../../shared/components/layout/Restaurantelayout';
import { ROTAS_CAIXA } from '../../../../routes/caixaRotas';
import PagamentoService, { FormaPagamentoApi, ItemDaConta, ResumoConta } from '../../../../services/pagameto.service';
import { mensagemDeErro } from '../../../../services/cliente.service';
import './PagarParcial.css';

// ── Tipos ──────────────────────────────────────────────────────────────────────
type MeioRotulo = 'Débito' | 'Crédito' | 'Pix' | 'Dinheiro';
const MEIOS_PAGAMENTO: { rotulo: MeioRotulo; api: FormaPagamentoApi }[] = [
  { rotulo: 'Débito', api: 'DEBITO' },
  { rotulo: 'Crédito', api: 'CREDITO' },
  { rotulo: 'Pix', api: 'PIX' },
  { rotulo: 'Dinheiro', api: 'DINHEIRO' },
];

interface FormaPagamento {
  id: string;
  meio: MeioRotulo;
  valor: number;
  /** Só Dinheiro: quanto o cliente entregou (para o troco) */
  recebido: number;
}

const r2 = (v: number) => Math.round(v * 100) / 100;
const formatarMoeda = (valor: number) =>
  valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

// Mesmo cálculo do servidor: valor da linha com taxa de serviço, proporcional às unidades
const valorDasUnidades = (item: ItemDaConta, unidades: number, pct: number) =>
  r2((item.valor_linha * (1 + pct / 100) * unidades) / item.quantidade);

const gerarIdForma = () => `f${Date.now()}${Math.floor(Math.random() * 1000)}`;
const novaForma = (valor = 0): FormaPagamento => ({ id: gerarIdForma(), meio: 'Pix', valor, recebido: 0 });

// ── Conteúdo ───────────────────────────────────────────────────────────────────
const PagarParcialConteudo: React.FC<{ id: string; resumo: ResumoConta }> = ({ id, resumo }) => {
  const navigate = useNavigate();
  const pct = resumo.taxa_servico_percentual;

  const itensPendentes = useMemo(
    () => resumo.itens.filter((i) => i.quantidade - i.quantidade_paga > 0),
    [resumo.itens]
  );

  // item_pedido_id → quantas unidades o cliente quer pagar agora
  const [selecionados, setSelecionados] = useState<Record<string, number>>({});
  const [formas, setFormas] = useState<FormaPagamento[]>([novaForma()]);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const valorSelecionado = useMemo(() => {
    const soma = itensPendentes.reduce(
      (acc, item) => acc + (selecionados[item.item_pedido_id] ? valorDasUnidades(item, selecionados[item.item_pedido_id], pct) : 0),
      0
    );
    return Math.min(r2(soma), resumo.restante);
  }, [itensPendentes, selecionados, pct, resumo.restante]);

  const qtdItensSelecionados = Object.keys(selecionados).length;

  // Uma só forma de pagamento: acompanha o valor selecionado automaticamente
  useEffect(() => {
    setFormas((atuais) =>
      atuais.length === 1 ? [{ ...atuais[0], valor: valorSelecionado }] : atuais
    );
  }, [valorSelecionado]);

  const alternarItem = (item: ItemDaConta) =>
    setSelecionados((atual) => {
      const novo = { ...atual };
      if (novo[item.item_pedido_id]) delete novo[item.item_pedido_id];
      else novo[item.item_pedido_id] = item.quantidade - item.quantidade_paga;
      return novo;
    });

  const mudarQuantidade = (item: ItemDaConta, delta: number) =>
    setSelecionados((atual) => {
      const maximo = item.quantidade - item.quantidade_paga;
      const nova = Math.min(maximo, Math.max(1, (atual[item.item_pedido_id] ?? 1) + delta));
      return { ...atual, [item.item_pedido_id]: nova };
    });

  const atualizarForma = (formaId: string, campo: 'meio' | 'valor' | 'recebido', valor: string) =>
    setFormas((atuais) =>
      atuais.map((f) => {
        if (f.id !== formaId) return f;
        if (campo === 'meio') return { ...f, meio: valor as MeioRotulo };
        const numero = Math.max(0, parseFloat(valor) || 0);
        return { ...f, [campo]: numero };
      })
    );

  const adicionarForma = () => setFormas((atuais) => [...atuais, novaForma()]);
  const removerForma = (formaId: string) =>
    setFormas((atuais) => (atuais.length > 1 ? atuais.filter((f) => f.id !== formaId) : atuais));

  const totalPago = r2(formas.reduce((acc, f) => acc + f.valor, 0));
  const diferenca = r2(valorSelecionado - totalPago);
  const percentual = (valor: number) => (valorSelecionado > 0 ? Math.round((valor / valorSelecionado) * 100) : 0);

  const dinheiroInsuficiente = formas.some(
    (f) => f.meio === 'Dinheiro' && f.recebido > 0 && f.recebido < f.valor
  );
  const pagamentoValido =
    qtdItensSelecionados > 0 &&
    diferenca === 0 &&
    formas.every((f) => f.valor > 0) &&
    !dinheiroInsuficiente &&
    !salvando;

  const concluirPagamento = async () => {
    if (!pagamentoValido) return;
    setSalvando(true);
    setErro(null);
    try {
      await PagamentoService.registrarParcial(id, {
        itens: Object.entries(selecionados).map(([item_pedido_id, quantidade]) => ({ item_pedido_id, quantidade })),
        formas: formas.map((f) => ({
          forma: MEIOS_PAGAMENTO.find((m) => m.rotulo === f.meio)!.api,
          valor: f.valor,
          valor_recebido: f.meio === 'Dinheiro' && f.recebido > 0 ? f.recebido : undefined,
        })),
        taxa_servico_percentual: pct,
      });
      navigate(ROTAS_CAIXA.pagarMesa(id));
    } catch (err: any) {
      setErro(mensagemDeErro(err, 'Não foi possível registrar o pagamento parcial.'));
      setSalvando(false);
    }
  };

  return (
    <RestaurantLayout>
      <div className="pagar-parcial">

        {/* ── Cabeçalho ── */}
        <div className="pagar-parcial__header">
          <button
            className="pagar-parcial__voltar"
            onClick={() => navigate(ROTAS_CAIXA.pagarMesa(id))}
            aria-label="Voltar para a comanda"
          >
            <HiArrowLeft />
          </button>
          <div>
            <h2 className="pagar-parcial__titulo-pagina">Pagamento parcial · Mesa {String(resumo.mesa.numero).padStart(2, '0')}</h2>
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

            {itensPendentes.length === 0 ? (
              <p className="pagar-parcial__estado">Todos os itens desta mesa já foram pagos.</p>
            ) : (
              <ul className="pagar-parcial__lista-itens">
                {itensPendentes.map((item) => {
                  const restante = item.quantidade - item.quantidade_paga;
                  const qtd = selecionados[item.item_pedido_id];
                  const marcado = !!qtd;
                  return (
                    <li key={item.item_pedido_id} className="pagar-parcial__item">
                      <label className="pagar-parcial__item-label">
                        <input
                          type="checkbox"
                          className="pagar-parcial__checkbox"
                          checked={marcado}
                          onChange={() => alternarItem(item)}
                        />
                        <span className="pagar-parcial__item-nome">
                          {item.produto_nome}
                          {item.adicionais.length > 0 && <small> (+ {item.adicionais.join(', ')})</small>}
                          <small className="pagar-parcial__item-sub">
                            Pedido #{item.numero_pedido}{item.cliente_nome ? ` · ${item.cliente_nome}` : ''}
                            {item.quantidade_paga > 0 ? ` · ${item.quantidade_paga} já pago(s)` : ''}
                          </small>
                        </span>
                      </label>

                      {marcado && restante > 1 ? (
                        <span className="pagar-parcial__stepper">
                          <button type="button" onClick={() => mudarQuantidade(item, -1)} aria-label="Menos uma unidade">−</button>
                          <strong>{qtd}/{restante}</strong>
                          <button type="button" onClick={() => mudarQuantidade(item, 1)} aria-label="Mais uma unidade">+</button>
                        </span>
                      ) : (
                        <span className="pagar-parcial__item-qtd">{restante}x</span>
                      )}

                      <span className="pagar-parcial__item-preco">
                        {formatarMoeda(valorDasUnidades(item, marcado ? qtd : restante, pct))}
                      </span>
                    </li>
                  );
                })}
              </ul>
            )}

            <div className="pagar-parcial__resumo-itens">
              <span>{qtdItensSelecionados} {qtdItensSelecionados === 1 ? 'item selecionado' : 'itens selecionados'} · com taxa de serviço ({pct}%)</span>
              <strong>{formatarMoeda(valorSelecionado)}</strong>
            </div>
          </section>

          {/* Coluna direita — divisão do valor selecionado */}
          <section className="pagar-parcial__card pagar-parcial__card--pagamento">
            <h3 className="pagar-parcial__titulo">Dividir pagamento</h3>

            <div className="pagar-parcial__conta">
              <div><span>Total da conta</span><span>{formatarMoeda(resumo.total_conta)}</span></div>
              {resumo.pago > 0 && <div><span>Já pago</span><span>- {formatarMoeda(resumo.pago)}</span></div>}
              <div><strong>Falta pagar</strong><strong>{formatarMoeda(resumo.restante)}</strong></div>
            </div>

            <div className="pagar-parcial__linha pagar-parcial__linha--destaque">
              <span>Valor a pagar</span>
              <strong>{formatarMoeda(valorSelecionado)}</strong>
            </div>

            <div className="pagar-parcial__formas">
              <p className="pagar-parcial__subtitulo">Formas de pagamento</p>

              {formas.map((forma) => {
                const troco = forma.meio === 'Dinheiro' && forma.recebido > forma.valor ? r2(forma.recebido - forma.valor) : 0;
                return (
                  <div key={forma.id} className="pagar-parcial__forma">
                    <label className="pagar-parcial__campo">
                      <span>Meio</span>
                      <select value={forma.meio} onChange={(e) => atualizarForma(forma.id, 'meio', e.target.value)}>
                        {MEIOS_PAGAMENTO.map((meio) => (
                          <option key={meio.rotulo} value={meio.rotulo}>{meio.rotulo}</option>
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
                          placeholder="0,00"
                          value={forma.valor === 0 ? '' : forma.valor}
                          onFocus={(e) => e.target.select()}
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
                      disabled={formas.length === 1}
                    >
                      <HiOutlineTrash />
                    </button>

                    {forma.meio === 'Dinheiro' && (
                      <label className="pagar-parcial__campo pagar-parcial__campo--recebido">
                        <span>Recebido (opcional, para o troco)</span>
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          placeholder="0,00"
                          value={forma.recebido === 0 ? '' : forma.recebido}
                          onFocus={(e) => e.target.select()}
                          onChange={(e) => atualizarForma(forma.id, 'recebido', e.target.value)}
                        />
                        {troco > 0 && <em className="pagar-parcial__troco">Troco: {formatarMoeda(troco)}</em>}
                      </label>
                    )}
                  </div>
                );
              })}

              <button type="button" className="pagar-parcial__adicionar" onClick={adicionarForma}>
                <HiPlus /> Adicionar forma de pagamento
              </button>
            </div>

            <div className="pagar-parcial__linha pagar-parcial__linha--total">
              <span>Total</span>
              <div className="pagar-parcial__total-valor">
                <strong>{formatarMoeda(totalPago)}</strong>
                <em>{percentual(totalPago)}%</em>
              </div>
            </div>

            {qtdItensSelecionados > 0 && diferenca !== 0 && (
              <p className="pagar-parcial__aviso">
                {diferenca > 0
                  ? `Faltam ${formatarMoeda(diferenca)} para completar o pagamento`
                  : `As formas de pagamento excedem o valor em ${formatarMoeda(Math.abs(diferenca))}`}
              </p>
            )}
            {dinheiroInsuficiente && (
              <p className="pagar-parcial__aviso">O valor recebido em dinheiro é menor que o valor a pagar.</p>
            )}
            {erro && <p className="pagar-parcial__aviso pagar-parcial__aviso--erro" role="alert">{erro}</p>}

            <button
              type="button"
              className="pagar-parcial__concluir"
              disabled={!pagamentoValido}
              onClick={() => void concluirPagamento()}
            >
              {salvando ? 'Registrando…' : 'Concluir pagamento'}
            </button>
          </section>

        </div>
      </div>
    </RestaurantLayout>
  );
};

// ── Rota: carrega a conta da mesa pelo :id da URL ──────────────────────────────
const PagarParcial: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [resumo, setResumo] = useState<ResumoConta | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [tentativa, setTentativa] = useState(0);

  const carregar = useCallback(async () => {
    if (!id) return;
    setErro(null);
    try {
      setResumo(await PagamentoService.resumoMesa(id));
    } catch (err: any) {
      setErro(mensagemDeErro(err, 'Não foi possível carregar a conta da mesa.'));
    }
  }, [id]);

  useEffect(() => {
    void carregar();
  }, [carregar, tentativa]);

  if (!id) return <Navigate to={ROTAS_CAIXA.lista} replace />;

  if (erro) {
    return (
      <RestaurantLayout>
        <div className="pagar-parcial">
          <p className="pagar-parcial__estado pagar-parcial__estado--erro" role="alert">{erro}</p>
          <div className="pagar-parcial__estado-acoes">
            <button className="pagar-parcial__concluir" onClick={() => setTentativa((n) => n + 1)}>Tentar novamente</button>
            <button className="pagar-parcial__adicionar" onClick={() => navigate(ROTAS_CAIXA.lista)}>Voltar ao caixa</button>
          </div>
        </div>
      </RestaurantLayout>
    );
  }

  if (!resumo) {
    return (
      <RestaurantLayout>
        <div className="pagar-parcial"><p className="pagar-parcial__estado">Carregando a conta da mesa…</p></div>
      </RestaurantLayout>
    );
  }

  return <PagarParcialConteudo key={id} id={id} resumo={resumo} />;
};

export default PagarParcial;
