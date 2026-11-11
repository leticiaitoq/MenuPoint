import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Navigate, useNavigate, useParams } from 'react-router-dom';
import { HiArrowLeft } from 'react-icons/hi';
import RestaurantLayout from '../../../../shared/components/layout/Restaurantelayout';
import { ROTAS_CAIXA } from '../../../../routes/caixaRotas';
import PagamentoService, { FormaPagamentoApi, ItemDaConta, ResultadoParcial, ResumoConta } from '../../../../services/pagameto.service';
import { mensagemDeErro } from '../../../../services/cliente.service';
import './PagarParcial.css';

const r2 = (v: number) => Math.round(v * 100) / 100;
const formatarMoeda = (valor: number) =>
  valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

const FORMAS: { api: FormaPagamentoApi; rotulo: string }[] = [
  { api: 'DINHEIRO', rotulo: 'Dinheiro' },
  { api: 'PIX', rotulo: 'Pix' },
  { api: 'DEBITO', rotulo: 'Débito' },
  { api: 'CREDITO', rotulo: 'Crédito' },
];

// Máscara de moeda: digita só números e os 2 últimos viram centavos (R$ 1.234,56)
const MAX_DIGITOS_MOEDA = 8; // até R$ 999.999,99
const centavosParaMoeda = (centavos: number): string => {
  const c = Math.max(0, Math.round(centavos));
  const reais = String(Math.floor(c / 100)).replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  return `R$ ${reais},${String(c % 100).padStart(2, '0')}`;
};
/** Texto digitado → "R$ 12,50". Campo vazio (ou zero) apaga o texto. */
const mascaraMoeda = (texto: string): string => {
  const centavos = Number(texto.replace(/\D/g, '').slice(0, MAX_DIGITOS_MOEDA));
  return centavos > 0 ? centavosParaMoeda(centavos) : '';
};
/** "R$ 12,50" → 12.5 (campo vazio → 0) */
const moedaParaNumero = (texto: string): number => Number(texto.replace(/\D/g, '') || 0) / 100;

const AbaterValorConteudo: React.FC<{ id: string; resumo: ResumoConta }> = ({ id, resumo }) => {
  const navigate = useNavigate();
  const pct = resumo.taxa_servico_percentual;

  const pendentes = useMemo(
    () => resumo.itens.filter((i) => i.quantidade - i.quantidade_paga > 0),
    [resumo.itens]
  );
  const porId = useMemo(() => new Map(pendentes.map((i) => [i.item_pedido_id, i])), [pendentes]);

  const [valorTexto, setValorTexto] = useState('');
  const [forma, setForma] = useState<FormaPagamentoApi>('DINHEIRO');
  // Itens escolhidos, NA ORDEM em que foram marcados (o dinheiro quita nessa ordem)
  const [ordem, setOrdem] = useState<string[]>([]);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  // Resultado REAL devolvido pelo servidor (não a prévia da tela)
  const [resultado, setResultado] = useState<ResultadoParcial | null>(null);

  const valorDado = r2(moedaParaNumero(valorTexto));
  // Dinheiro a mais que o saldo vira troco; nas outras formas não pode passar do saldo
  const valorAbatido = r2(Math.min(valorDado, resumo.restante));
  const troco = forma === 'DINHEIRO' ? r2(Math.max(valorDado - resumo.restante, 0)) : 0;
  const acimaDoSaldo = forma !== 'DINHEIRO' && valorDado > resumo.restante + 0.005;
  const restanteDepois = r2(resumo.restante - valorAbatido);

  // Prévia de quais itens o valor quita (mesma regra do servidor: unidades inteiras, na ordem escolhida)
  const previa = useMemo(() => {
    const mapa = new Map<string, number>();
    let sobra = valorAbatido;
    ordem.forEach((itemId) => {
      const item: ItemDaConta | undefined = porId.get(itemId);
      if (!item) return;
      const custo = (item.valor_linha * (1 + pct / 100)) / item.quantidade;
      const faltam = item.quantidade - item.quantidade_paga;
      const unidades = custo > 0 ? Math.min(faltam, Math.floor((sobra + 0.005) / custo)) : faltam;
      mapa.set(itemId, unidades);
      sobra = r2(sobra - r2(custo * unidades));
    });
    return mapa;
  }, [ordem, porId, valorAbatido, pct]);

  const alternarItem = (itemId: string) =>
    setOrdem((atual) => (atual.includes(itemId) ? atual.filter((i) => i !== itemId) : [...atual, itemId]));

  const podeAbater = valorDado > 0 && !acimaDoSaldo && resumo.restante > 0 && !salvando;

  const abater = async () => {
    if (!podeAbater) return;
    setSalvando(true);
    setErro(null);
    try {
      const r = await PagamentoService.abater(id, {
        forma,
        valor: valorDado,
        itens: ordem.length > 0
          ? ordem.map((item_pedido_id) => ({
              item_pedido_id,
              quantidade: (porId.get(item_pedido_id)?.quantidade ?? 0) - (porId.get(item_pedido_id)?.quantidade_paga ?? 0),
            }))
          : undefined,
      });
      setResultado(r);
      setSalvando(false);
    } catch (err: any) {
      setErro(mensagemDeErro(err, 'Não foi possível abater o valor.'));
      setSalvando(false);
    }
  };

  // Depois de abater: mostra o que o servidor de fato registrou
  if (resultado) {
    const quitados = resultado.alocacoes.map((a) => ({
      ...a,
      nome: resumo.itens.find((i) => i.item_pedido_id === a.item_pedido_id)?.produto_nome ?? 'Item',
    }));
    const somaQuitada = r2(resultado.alocacoes.reduce((s, a) => s + a.valor, 0));
    const creditoGeral = r2(resultado.valor - somaQuitada);
    return (
      <RestaurantLayout>
        <div className="pagar-parcial">
          <div className="pagar-parcial__header">
            <div>
              <h2 className="pagar-parcial__titulo-pagina">Valor abatido · Mesa {String(resumo.mesa.numero).padStart(2, '0')}</h2>
              <p className="pagar-parcial__subtitulo-pagina">Registrado com sucesso</p>
            </div>
          </div>
          <section className="pagar-parcial__card pagar-parcial__card--pagamento">
            <div className="pagar-parcial__conta">
              <div className="pagar-parcial__conta-destaque"><span>Valor abatido da conta</span><strong>- {formatarMoeda(resultado.valor)}</strong></div>
              {resultado.troco > 0 && <div><span>Troco</span><strong>{formatarMoeda(resultado.troco)}</strong></div>}
              <div><strong>Falta pagar</strong><strong>{formatarMoeda(resultado.restante)}</strong></div>
            </div>

            {quitados.length > 0 && (
              <>
                <p className="pagar-parcial__subtitulo">Itens quitados</p>
                <ul className="pagar-parcial__lista-itens">
                  {quitados.map((q) => (
                    <li key={q.item_pedido_id} className="pagar-parcial__item">
                      <span className="pagar-parcial__item-nome">{q.quantidade}x {q.nome}</span>
                      <span className="pagar-parcial__item-preco">{formatarMoeda(q.valor)}</span>
                    </li>
                  ))}
                </ul>
              </>
            )}
            {creditoGeral > 0.004 && (
              <p className="pagar-parcial__aviso">
                {formatarMoeda(creditoGeral)} {quitados.length > 0 ? 'não completam outra unidade e ficaram' : 'ficaram'} como abatimento geral da conta.
              </p>
            )}

            <button type="button" className="pagar-parcial__concluir" onClick={() => navigate(ROTAS_CAIXA.pagarMesa(id))}>
              Voltar para a comanda
            </button>
          </section>
        </div>
      </RestaurantLayout>
    );
  }

  return (
    <RestaurantLayout>
      <div className="pagar-parcial">

        <div className="pagar-parcial__header">
          <button
            className="pagar-parcial__voltar"
            onClick={() => navigate(ROTAS_CAIXA.pagarMesa(id))}
            aria-label="Voltar para a comanda"
          >
            <HiArrowLeft />
          </button>
          <div>
            <h2 className="pagar-parcial__titulo-pagina">Abater um valor · Mesa {String(resumo.mesa.numero).padStart(2, '0')}</h2>
            <p className="pagar-parcial__subtitulo-pagina">
              Informe quanto o cliente entregou. Se quiser, escolha quais itens esse valor vai quitar.
            </p>
          </div>
        </div>

        <div className="pagar-parcial__corpo">

          {/* Itens (opcional) */}
          <section className="pagar-parcial__card pagar-parcial__card--itens">
            <div className="pagar-parcial__tabs">
              <span className="pagar-parcial__tab pagar-parcial__tab--ativa">Itens a quitar (opcional)</span>
            </div>

            {pendentes.length === 0 ? (
              <p className="pagar-parcial__estado">Todos os itens desta mesa já foram pagos.</p>
            ) : (
              <ul className="pagar-parcial__lista-itens">
                {pendentes.map((item) => {
                  const faltam = item.quantidade - item.quantidade_paga;
                  const marcado = ordem.includes(item.item_pedido_id);
                  const unidades = previa.get(item.item_pedido_id) ?? 0;
                  return (
                    <li key={item.item_pedido_id} className="pagar-parcial__item">
                      <label className="pagar-parcial__item-label">
                        <input
                          type="checkbox"
                          className="pagar-parcial__checkbox"
                          checked={marcado}
                          onChange={() => alternarItem(item.item_pedido_id)}
                        />
                        <span className="pagar-parcial__item-nome">
                          {marcado && <b className="pagar-parcial__ordem">{ordem.indexOf(item.item_pedido_id) + 1}º </b>}
                          {item.produto_nome}
                          {item.adicionais.length > 0 && <small> (+ {item.adicionais.join(', ')})</small>}
                          <small className="pagar-parcial__item-sub">
                            Pedido #{item.numero_pedido}{item.cliente_nome ? ` · ${item.cliente_nome}` : ''}
                          </small>
                        </span>
                      </label>

                      {marcado && valorDado > 0 ? (
                        <span
                          className={`pagar-parcial__badge ${
                            unidades === faltam ? 'pagar-parcial__badge--ok' : unidades > 0 ? 'pagar-parcial__badge--parcial' : 'pagar-parcial__badge--nao'
                          }`}
                        >
                          {unidades === faltam ? 'quitado' : unidades > 0 ? `${unidades} de ${faltam}` : 'não coberto'}
                        </span>
                      ) : (
                        <span className="pagar-parcial__item-qtd">{faltam}x</span>
                      )}

                      <span className="pagar-parcial__item-preco">
                        {formatarMoeda(r2((item.valor_linha * (1 + pct / 100) * faltam) / item.quantidade))}
                      </span>
                    </li>
                  );
                })}
              </ul>
            )}

            <div className="pagar-parcial__resumo-itens">
              <span>
                {ordem.length === 0
                  ? 'Nenhum item escolhido: o valor é descontado do total da conta'
                  : `${ordem.length} ${ordem.length === 1 ? 'item escolhido' : 'itens escolhidos'} (quitados na ordem marcada)`}
              </span>
            </div>
          </section>

          {/* Valor e forma */}
          <section className="pagar-parcial__card pagar-parcial__card--pagamento">
            <h3 className="pagar-parcial__titulo">Valor do cliente</h3>

            <label className="pagar-parcial__campo">
              <span>Valor entregue pelo cliente</span>
              <input
                className="pagar-parcial__input-valor"
                type="text"
                inputMode="numeric"
                placeholder="R$ 0,00"
                value={valorTexto}
                onChange={(e) => setValorTexto(mascaraMoeda(e.target.value))}
                autoFocus
              />
            </label>

            <p className="pagar-parcial__subtitulo">Forma de pagamento</p>
            <div className="pagar-parcial__chips" role="radiogroup" aria-label="Forma de pagamento">
              {FORMAS.map((f) => (
                <button
                  key={f.api}
                  type="button"
                  role="radio"
                  aria-checked={forma === f.api}
                  className={`pagar-parcial__chip${forma === f.api ? ' pagar-parcial__chip--ativo' : ''}`}
                  onClick={() => setForma(f.api)}
                >
                  {f.rotulo}
                </button>
              ))}
            </div>

            <div className="pagar-parcial__conta">
              <div><span>Total da conta</span><span>{formatarMoeda(resumo.total_conta)}</span></div>
              {resumo.pago > 0 && <div><span>Já pago</span><span>- {formatarMoeda(resumo.pago)}</span></div>}
              <div><span>Falta pagar</span><span>{formatarMoeda(resumo.restante)}</span></div>
              <div className="pagar-parcial__conta-destaque"><span>Valor a abater</span><strong>- {formatarMoeda(valorAbatido)}</strong></div>
              {troco > 0 && <div><span>Troco</span><strong>{formatarMoeda(troco)}</strong></div>}
              <div><strong>Falta depois</strong><strong>{formatarMoeda(restanteDepois)}</strong></div>
            </div>

            {acimaDoSaldo && (
              <p className="pagar-parcial__aviso">
                O valor é maior que o que falta pagar ({formatarMoeda(resumo.restante)}). Só em dinheiro o excedente vira troco.
              </p>
            )}
            {erro && <p className="pagar-parcial__aviso pagar-parcial__aviso--erro" role="alert">{erro}</p>}

            <button
              type="button"
              className="pagar-parcial__concluir"
              disabled={!podeAbater}
              onClick={() => void abater()}
            >
              {salvando ? 'Registrando…' : 'Abater valor'}
            </button>
          </section>

        </div>
      </div>
    </RestaurantLayout>
  );
};

//Rota: carrega a conta da mesa pelo :id da URL
const AbaterValor: React.FC = () => {
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

  return <AbaterValorConteudo key={id} id={id} resumo={resumo} />;
};

export default AbaterValor;
