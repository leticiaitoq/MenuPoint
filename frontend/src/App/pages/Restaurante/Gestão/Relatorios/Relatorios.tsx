import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from 'recharts';
import {
  HiCalendar,
  HiClipboardList,
  HiCurrencyDollar,
  HiRefresh,
  HiTrendingUp,
} from 'react-icons/hi';
import { BsCashCoin, BsTrophy } from 'react-icons/bs';
import RestaurantLayout from '../../../../shared/components/layout/Restaurantelayout';
import DespesaService, { mensagemErroDespesa, ResumoDespesas } from '../../../../services/despesa.service';
import RelatorioService, { mensagemErroRelatorio, ResumoRelatorio } from '../../../../services/relatorio.service';
import './Relatorios.css';

// ── Constantes ──────────────────────────────────────────────────────────
type PeriodoPredefinido = 'hoje' | '7dias' | '30dias' | 'mes' | 'mes_anterior';

const PERIODOS: { valor: PeriodoPredefinido; rotulo: string }[] = [
  { valor: 'hoje',         rotulo: 'Hoje' },
  { valor: '7dias',        rotulo: 'Últimos 7 dias' },
  { valor: '30dias',       rotulo: 'Últimos 30 dias' },
  { valor: 'mes',          rotulo: 'Mês atual' },
  { valor: 'mes_anterior', rotulo: 'Mês anterior' },
];

// Cores só para o gráfico (a API manda nomes e números)
const CORES_RANKING   = ['#e07b39', '#d97706', '#16a34a', '#2563eb'];
const CORES_CATEGORIA = ['#8B1A1A', '#d97706', '#16a34a', '#2563eb', '#0891b2', '#6b7280'];

// ── Helpers ─────────────────────────────────────────────────────────────
const formatarPreco = (valor: number): string =>
  `R$ ${valor.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`;

const dois = (n: number) => String(n).padStart(2, '0');

/** Date local -> AAAA-MM-DD (sem passar por UTC, que muda o dia no fuso do Brasil) */
const paraISO = (d: Date) => `${d.getFullYear()}-${dois(d.getMonth() + 1)}-${dois(d.getDate())}`;

/** AAAA-MM-DD -> Date local */
const deISO = (iso: string) => {
  const [a, m, d] = iso.split('-').map(Number);
  return new Date(a, m - 1, d);
};

const dataCurta = (iso: string) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}`;
const dataCompleta = (iso: string) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(0, 4)}`;

const calcularPeriodo = (tipo: PeriodoPredefinido) => {
  const hoje = new Date();
  const dia = (deslocamento: number) =>
    new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate() + deslocamento);

  switch (tipo) {
    case 'hoje':   return { data_inicio: paraISO(hoje), data_fim: paraISO(hoje) };
    case '7dias':  return { data_inicio: paraISO(dia(-6)), data_fim: paraISO(hoje) };
    case '30dias': return { data_inicio: paraISO(dia(-29)), data_fim: paraISO(hoje) };
    case 'mes':    return { data_inicio: paraISO(new Date(hoje.getFullYear(), hoje.getMonth(), 1)), data_fim: paraISO(hoje) };
    case 'mes_anterior':
      return {
        data_inicio: paraISO(new Date(hoje.getFullYear(), hoje.getMonth() - 1, 1)),
        data_fim: paraISO(new Date(hoje.getFullYear(), hoje.getMonth(), 0)),
      };
  }
};

/** "Sábado (26/04)" */
const diaDaSemana = (iso: string) => {
  const nome = deISO(iso).toLocaleDateString('pt-BR', { weekday: 'long' });
  return `${nome.charAt(0).toUpperCase()}${nome.slice(1)} (${dataCurta(iso)})`;
};

const formatarAtualizacao = (d: Date) =>
  `${dois(d.getDate())}/${dois(d.getMonth() + 1)}/${d.getFullYear()} ${dois(d.getHours())}:${dois(d.getMinutes())}`;

// ── Tooltip customizado — barras ─────────────────────────────────────────
const TooltipBarras = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="relatorios__tooltip">
      <p className="relatorios__tooltip-label">{label}</p>
      <p className="relatorios__tooltip-valor">{formatarPreco(payload[0].value ?? 0)}</p>
    </div>
  );
};

// ── Tooltip customizado — pizza ──────────────────────────────────────────
const TooltipPizza = ({ active, payload }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="relatorios__tooltip">
      <p className="relatorios__tooltip-label">{payload[0].name}</p>
      <p className="relatorios__tooltip-valor">{payload[0].value}%</p>
    </div>
  );
};

// ── Label percentual dentro de cada fatia ────────────────────────────────
const LabelPizza = ({ cx, cy, midAngle, innerRadius, outerRadius, value }: any) => {
  const RADIAN = Math.PI / 180;
  const radius = innerRadius + (outerRadius - innerRadius) * 0.55;
  const x      = cx + radius * Math.cos(-midAngle * RADIAN);
  const y      = cy + radius * Math.sin(-midAngle * RADIAN);
  if (value < 8) return null;
  return (
    <text x={x} y={y} fill="#fff" textAnchor="middle"
      dominantBaseline="central" fontSize={11} fontWeight={700}>
      {value}%
    </text>
  );
};

// ── Componente principal ─────────────────────────────────────────────────
const Relatorios: React.FC = () => {
  const navigate = useNavigate();

  const [periodoTipo, setPeriodoTipo] = useState<PeriodoPredefinido>('mes');
  const periodo = calcularPeriodo(periodoTipo);

  const [resumo, setResumo] = useState<ResumoRelatorio | null>(null);
  const [resumoDespesas, setResumoDespesas] = useState<ResumoDespesas | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState('');
  const [erroDespesas, setErroDespesas] = useState('');
  const [atualizadoEm, setAtualizadoEm] = useState<Date | null>(null);

  // Vendas e despesas do mesmo período, buscadas juntas (o lucro depende dos dois)
  const carregar = useCallback(async () => {
    const { data_inicio, data_fim } = calcularPeriodo(periodoTipo);
    setCarregando(true);
    setErro('');
    setErroDespesas('');

    const [vendas, despesas] = await Promise.allSettled([
      RelatorioService.resumo({ data_inicio, data_fim }),
      DespesaService.resumo({ data_inicio, data_fim }),
    ]);

    if (vendas.status === 'fulfilled') {
      setResumo(vendas.value);
      setAtualizadoEm(new Date());
    } else {
      setErro(mensagemErroRelatorio(vendas.reason, 'Não foi possível carregar os relatórios.'));
    }

    if (despesas.status === 'fulfilled') {
      setResumoDespesas(despesas.value);
    } else {
      setErroDespesas(mensagemErroDespesa(despesas.reason, 'Não foi possível carregar as despesas.'));
    }

    setCarregando(false);
  }, [periodoTipo]);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  // Valores exibidos (zerados enquanto não chega nada ou se a consulta falhar)
  const faturamento       = resumo?.faturamento ?? 0;
  const pedidosFinalizados = resumo?.pedidos_finalizados ?? 0;
  const ticketMedio       = resumo?.ticket_medio ?? 0;
  const pedidosTotal      = resumo?.pedidos_total ?? 0;
  const faturamentoDiario = (resumo?.faturamento_diario ?? []).map((d) => ({ dia: dataCurta(d.data), valor: d.valor }));
  const ranking           = (resumo?.produtos_mais_vendidos ?? []).map((p, i) => ({ ...p, cor: CORES_RANKING[i % CORES_RANKING.length] }));
  const fatias            = (resumo?.pedidos_por_categoria ?? []).map((c, i) => ({
    name: c.categoria,
    value: c.percentual,
    cor: CORES_CATEGORIA[i % CORES_CATEGORIA.length],
  }));
  const maxProduto  = ranking[0]?.quantidade ?? 1;
  const melhorValor = resumo?.melhor_dia?.valor ?? 0;

  const totalDespesas = resumoDespesas?.total ?? 0;
  const lucroLiquido  = faturamento - totalDespesas;
  const rotuloPeriodo = PERIODOS.find((p) => p.valor === periodoTipo)?.rotulo ?? '';

  return (
    <RestaurantLayout>
      <div className="relatorios">

        {/* ── Título ── */}
        <h2 className="relatorios__titulo">Relatórios</h2>

        {/* ── Período ── */}
        <div className="relatorios__filtros">
          <div className="relatorios__periodo">
            <span className="relatorios__periodo-icone"><HiCalendar /></span>
            <div>
              <p className="relatorios__periodo-label">Período</p>
              <p className="relatorios__periodo-valor">
                {dataCompleta(periodo.data_inicio)}
                {periodo.data_inicio !== periodo.data_fim && ` - ${dataCompleta(periodo.data_fim)}`}
              </p>
            </div>
          </div>

          <div className="relatorios__filtros-direita">
            <label className="relatorios__select-wrap">
              <HiCalendar className="relatorios__select-icone" />
              <select
                className="relatorios__select"
                value={periodoTipo}
                onChange={(e) => setPeriodoTipo(e.target.value as PeriodoPredefinido)}
                aria-label="Período do relatório"
              >
                {PERIODOS.map((p) => (
                  <option key={p.valor} value={p.valor}>{p.rotulo}</option>
                ))}
              </select>
            </label>
          </div>
        </div>

        {erro && (
          <p className="relatorios__aviso relatorios__aviso--erro" role="alert">
            {erro}{' '}
            <button type="button" className="relatorios__aviso-botao" onClick={() => void carregar()}>
              Tentar novamente
            </button>
          </p>
        )}
        {carregando && !erro && <p className="relatorios__aviso">Carregando relatórios...</p>}

        {/* ── Cards de resumo ── */}
        <div className="relatorios__cards">

          <div className="relatorios__card relatorios__card--vermelho relatorios__card--largo">
            <div className="relatorios__card-topo">
              <HiTrendingUp className="relatorios__card-icone" />
              <span>Faturamento</span>
            </div>
            <p className="relatorios__card-valor">{formatarPreco(faturamento)}</p>
          </div>

          <div className="relatorios__card relatorios__card--verde">
            <div className="relatorios__card-topo">
              <HiClipboardList className="relatorios__card-icone" />
              <span>Pedidos Finalizados</span>
            </div>
            <p className="relatorios__card-valor relatorios__card-valor--grande">{pedidosFinalizados}</p>
            <p className="relatorios__card-sub">Pedidos</p>
          </div>

          <div className="relatorios__card relatorios__card--azul">
            <div className="relatorios__card-topo">
              <BsCashCoin className="relatorios__card-icone" />
              <span>Ticket Médio</span>
            </div>
            <p className="relatorios__card-valor">{formatarPreco(ticketMedio)}</p>
          </div>

          <div className="relatorios__card relatorios__card--amarelo relatorios__card--largo">
            <div className="relatorios__card-topo">
              <BsTrophy className="relatorios__card-icone" />
              <span>Produtos Mais Vendidos</span>
            </div>
            {ranking.length === 0 && <p className="relatorios__vazio">Sem vendas no período.</p>}
            <ul className="relatorios__ranking">
              {ranking.map((p) => (
                <li key={p.produto_id} className="relatorios__ranking-item">
                  <span className="relatorios__ranking-bolinha" style={{ background: p.cor }} />
                  <span className="relatorios__ranking-nome">{p.nome}</span>
                  <span className="relatorios__ranking-qtd">{p.quantidade}</span>
                  <div className="relatorios__ranking-barra-fundo">
                    <div
                      className="relatorios__ranking-barra"
                      style={{
                        width: `${(p.quantidade / maxProduto) * 100}%`,
                        background: p.cor,
                      }}
                    />
                  </div>
                </li>
              ))}
            </ul>
          </div>

        </div>

        {/* ── Gráficos + Despesas ── */}
        <div className="relatorios__graficos">

          {/* Faturamento diário */}
          <div className="relatorios__painel relatorios__painel--barras">
            <h3 className="relatorios__painel-titulo">Faturamento Durante o Período</h3>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={faturamentoDiario} barCategoryGap="30%">
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
                <XAxis
                  dataKey="dia"
                  tick={{ fontSize: 11, fill: '#9ca3af' }}
                  axisLine={false}
                  tickLine={false}
                  interval="preserveStartEnd"
                  minTickGap={14}
                />
                <YAxis
                  tick={{ fontSize: 11, fill: '#9ca3af' }}
                  axisLine={false}
                  tickLine={false}
                  width={40}
                />
                <Tooltip content={<TooltipBarras />} cursor={{ fill: '#f5f5f5' }} />
                <Bar dataKey="valor" radius={[6, 6, 0, 0]} maxBarSize={48}>
                  {faturamentoDiario.map((entry, index) => (
                    <Cell
                      key={`bar-${index}`}
                      fill={melhorValor > 0 && entry.valor === melhorValor ? '#8B1A1A' : '#d97706'}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Pedidos por categoria */}
          <div className="relatorios__painel relatorios__painel--pizza">
            <h3 className="relatorios__painel-titulo">Pedidos por Categoria</h3>
            {fatias.length === 0 && <p className="relatorios__vazio">Sem vendas no período.</p>}
            <ResponsiveContainer width="100%" height={200}>
              <PieChart>
                <Pie
                  data={fatias}
                  dataKey="value"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  outerRadius={80}
                  labelLine={false}
                  label={LabelPizza}
                  animationBegin={0}
                  animationDuration={800}
                >
                  {fatias.map((fatia, index) => (
                    <Cell
                      key={`cell-${index}`}
                      fill={fatia.cor}
                      stroke="#fff"
                      strokeWidth={2}
                    />
                  ))}
                </Pie>
                <Tooltip content={<TooltipPizza />} />
              </PieChart>
            </ResponsiveContainer>
            {/* Legenda manual — fora do ResponsiveContainer para não sobrepor */}
            <ul className="relatorios__legenda-pizza">
              {fatias.map((fatia) => (
                <li key={fatia.name} className="relatorios__legenda-pizza-item">
                  <span className="relatorios__legenda-pizza-cor" style={{ background: fatia.cor }} />
                  <span className="relatorios__legenda-pizza-nome">{fatia.name}</span>
                  <span className="relatorios__legenda-pizza-pct">{fatia.value}%</span>
                </li>
              ))}
            </ul>
          </div>

          {/* Despesas */}
         <div className="relatorios__painel relatorios__painel--despesas"
            >
            <div className="relatorios__despesas-titulo">
              <HiCurrencyDollar className="relatorios__despesas-icone" />
              <h3>Despesas do Estabelecimento</h3>
            </div>

            <p className="relatorios__despesas-periodo">{rotuloPeriodo}</p>

            {carregando && !resumoDespesas ? (
              <p className="relatorios__despesas-aviso">Carregando despesas...</p>
            ) : erroDespesas ? (
              <p className="relatorios__despesas-aviso relatorios__despesas-aviso--erro" role="alert">{erroDespesas}</p>
            ) : (resumoDespesas?.por_categoria.length ?? 0) === 0 ? (
              <p className="relatorios__despesas-aviso">Nenhuma despesa cadastrada neste período.</p>
            ) : (
              <ul className="relatorios__despesas-lista">
                {resumoDespesas?.por_categoria.map((d) => (
                  <li key={d.categoria} className="relatorios__despesa-item">
                    <span className="relatorios__despesa-bolinha" />
                    <span className="relatorios__despesa-nome">{d.categoria}</span>
                    <span className="relatorios__despesa-valor">{formatarPreco(d.total)}</span>
                  </li>
                ))}
              </ul>
            )}

            <div className="relatorios__despesas-totais">
              <div className="relatorios__total-linha">
                <span>Total de Despesas</span>
                <strong>{erroDespesas ? '—' : formatarPreco(totalDespesas)}</strong>
              </div>
              <div className="relatorios__total-linha relatorios__total-linha--lucro">
                <span>Lucro Líquido</span>
                <strong>{erroDespesas || erro ? '—' : formatarPreco(lucroLiquido)}</strong>
              </div>
            </div>

                  <button
                className="relatorios__despesas-ver-mais"
               onClick={() => navigate('/restaurante/despesas')}
                            >
                  Ver mais
               </button>
          </div>

        </div>

        {/* ── Rodapé ── */}
        <div className="relatorios__rodape">

          <div className="relatorios__rodape-total">
            <div className="relatorios__rodape-icone-wrap">
              <HiClipboardList className="relatorios__rodape-icone" />
            </div>
            <div>
              <p className="relatorios__rodape-label">Total de Pedidos</p>
              <p className="relatorios__rodape-numero">{pedidosTotal}</p>
              <p className="relatorios__rodape-sub">Pedidos</p>
            </div>
          </div>

          <div className="relatorios__rodape-destaque">
            <p className="relatorios__destaque-titulo">Destaque do Período</p>
            <div className="relatorios__destaque-corpo">
              <div className="relatorios__destaque-icone-wrap">
                <HiTrendingUp className="relatorios__destaque-icone" />
              </div>
              <div>
                {resumo?.melhor_dia ? (
                  <>
                    <p className="relatorios__destaque-texto">
                      <strong>{diaDaSemana(resumo.melhor_dia.data)}</strong> foi o dia com maior faturamento.
                    </p>
                    <p className="relatorios__destaque-valor">{formatarPreco(resumo.melhor_dia.valor)}</p>
                  </>
                ) : (
                  <p className="relatorios__destaque-texto">Ainda não há vendas neste período.</p>
                )}
              </div>
            </div>
          </div>

        </div>

        {/* ── Atualização ── */}
        <p className="relatorios__atualizacao">
          <HiRefresh />
          {atualizadoEm ? ` Relatórios atualizados em ${formatarAtualizacao(atualizadoEm)}` : ' Relatórios ainda não carregados'}
          <button type="button" className="relatorios__aviso-botao" onClick={() => void carregar()} disabled={carregando}>
            Atualizar
          </button>
        </p>

      </div>
    </RestaurantLayout>
  );
};

export default Relatorios;