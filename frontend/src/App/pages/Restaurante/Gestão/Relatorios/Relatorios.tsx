import React, { useState } from 'react';
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
  HiCurrencyDollar,
  HiClipboardList,
  HiRefresh,
  HiTrendingUp,
} from 'react-icons/hi';
import { BsCashCoin, BsTrophy } from 'react-icons/bs';
import { MdOutlineStorefront } from 'react-icons/md';
import RestaurantLayout from '../../../../shared/components/layout/Restaurantelayout';
import './Relatorios.css';

// ── Tipos ──────────────────────────────────────────────────────────────
interface DadoDiario {
  dia: string;
  valor: number;
}

interface ProdutoVendido {
  nome: string;
  quantidade: number;
  cor: string;
}

interface Despesa {
  nome: string;
  valor: number;
}

interface FatiaCategoria {
  name: string;  // recharts usa "name" por padrão
  value: number; // recharts usa "value" por padrão
  cor: string;
}

// ── Dados mockados ──────────────────────────────────────────────────────
const FATURAMENTO_DIARIO: DadoDiario[] = [
  { dia: '20/04', valor: 520  },
  { dia: '21/04', valor: 680  },
  { dia: '22/04', valor: 750  },
  { dia: '23/04', valor: 900  },
  { dia: '24/04', valor: 1100 },
  { dia: '25/04', valor: 980  },
  { dia: '26/04', valor: 1860 },
  { dia: '27/04', valor: 750  },
];

const PRODUTOS_MAIS_VENDIDOS: ProdutoVendido[] = [
  { nome: 'X-Burger',         quantidade: 45, cor: '#e07b39' },
  { nome: 'Pizza Calabresa',  quantidade: 37, cor: '#d97706' },
  { nome: 'Caipirinha',       quantidade: 29, cor: '#16a34a' },
  { nome: 'Picanha na Chapa', quantidade: 25, cor: '#2563eb' },
];

const CATEGORIAS: FatiaCategoria[] = [
  { name: 'Pratos Principais', value: 27, cor: '#8B1A1A' },
  { name: 'Bebidas',           value: 18, cor: '#d97706' },
  { name: 'Combos',            value: 14, cor: '#16a34a' },
  { name: 'Sobremesas',        value:  9, cor: '#2563eb' },
  { name: 'Picanha na Chapa',  value: 12, cor: '#0891b2' },
];

const DESPESAS: Despesa[] = [
  { nome: 'Custo dos Produtos', valor: 2350 },
  { nome: 'Taxas e Comissões',  valor:  450 },
  { nome: 'Marketing',          valor:  300 },
  { nome: 'Aluguel',            valor: 1200 },
  { nome: 'Outros',             valor:  250 },
];

const TOTAL_DESPESAS    = DESPESAS.reduce((acc, d) => acc + d.valor, 0);
const FATURAMENTO_TOTAL = 7540;
const LUCRO_LIQUIDO     = FATURAMENTO_TOTAL - TOTAL_DESPESAS;

const ESTABELECIMENTOS = [
  'Todos os estabelecimentos',
  'Unidade Centro',
  'Unidade Sul',
];

// ── Helpers ─────────────────────────────────────────────────────────────
const formatarPreco = (valor: number): string =>
  `R$ ${valor.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`;

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
  const [estabelecimento, setEstabelecimento] = useState(ESTABELECIMENTOS[0]);
  const maxProduto                            = PRODUTOS_MAIS_VENDIDOS[0].quantidade;

  return (
    <RestaurantLayout>
      <div className="relatorios">

        {/* ── Título ── */}
        <h2 className="relatorios__titulo">Relatórios</h2>

        {/* ── Filtros ── */}
        <div className="relatorios__filtros">
          <div className="relatorios__periodo">
            <span className="relatorios__periodo-icone">
              <HiCurrencyDollar />
            </span>
            <div>
              <p className="relatorios__periodo-label">Período</p>
              <p className="relatorios__periodo-valor">20/04/2024 até 27/04/2024</p>
            </div>
          </div>

          <div className="relatorios__filtros-direita">
            <div className="relatorios__select-wrap">
              <MdOutlineStorefront className="relatorios__select-icone" />
              <select
                className="relatorios__select"
                value={estabelecimento}
                onChange={(e) => setEstabelecimento(e.target.value)}
              >
                {ESTABELECIMENTOS.map((e) => (
                  <option key={e} value={e}>{e}</option>
                ))}
              </select>
            </div>
            <button className="relatorios__btn-aplicar">
              <HiRefresh /> Aplicar
            </button>
          </div>
        </div>

        {/* ── Cards de resumo ── */}
        <div className="relatorios__cards">

          <div className="relatorios__card relatorios__card--vermelho">
            <div className="relatorios__card-topo">
              <HiTrendingUp className="relatorios__card-icone" />
              <span>Faturamento</span>
            </div>
            <p className="relatorios__card-valor">R$ 7.540,00</p>
          </div>

          <div className="relatorios__card relatorios__card--verde">
            <div className="relatorios__card-topo">
              <HiClipboardList className="relatorios__card-icone" />
              <span>Pedidos Finalizados</span>
            </div>
            <p className="relatorios__card-valor relatorios__card-valor--grande">126</p>
            <p className="relatorios__card-sub">Pedidos</p>
          </div>

          <div className="relatorios__card relatorios__card--azul">
            <div className="relatorios__card-topo">
              <BsCashCoin className="relatorios__card-icone" />
              <span>Ticket Médio</span>
            </div>
            <p className="relatorios__card-valor">R$ 59,84</p>
          </div>

          <div className="relatorios__card relatorios__card--amarelo">
            <div className="relatorios__card-topo">
              <BsTrophy className="relatorios__card-icone" />
              <span>Produtos Mais Vendidos</span>
            </div>
            <ul className="relatorios__ranking">
              {PRODUTOS_MAIS_VENDIDOS.map((p) => (
                <li key={p.nome} className="relatorios__ranking-item">
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
              <BarChart data={FATURAMENTO_DIARIO} barCategoryGap="30%">
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
                <XAxis
                  dataKey="dia"
                  tick={{ fontSize: 11, fill: '#9ca3af' }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  tick={{ fontSize: 11, fill: '#9ca3af' }}
                  axisLine={false}
                  tickLine={false}
                  width={40}
                />
                <Tooltip content={<TooltipBarras />} cursor={{ fill: '#f5f5f5' }} />
                <Bar dataKey="valor" radius={[6, 6, 0, 0]} maxBarSize={48}>
                  {FATURAMENTO_DIARIO.map((entry, index) => (
                    <Cell
                      key={`bar-${index}`}
                      fill={entry.valor === 1860 ? '#8B1A1A' : '#d97706'}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Pedidos por categoria */}
          <div className="relatorios__painel relatorios__painel--pizza">
            <h3 className="relatorios__painel-titulo">Pedidos por Categoria</h3>
            <ResponsiveContainer width="100%" height={200}>
              <PieChart>
                <Pie
                  data={CATEGORIAS}
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
                  {CATEGORIAS.map((fatia, index) => (
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
              {CATEGORIAS.map((fatia) => (
                <li key={fatia.name} className="relatorios__legenda-pizza-item">
                  <span className="relatorios__legenda-pizza-cor" style={{ background: fatia.cor }} />
                  <span className="relatorios__legenda-pizza-nome">{fatia.name}</span>
                  <span className="relatorios__legenda-pizza-pct">{fatia.value}%</span>
                </li>
              ))}
            </ul>
          </div>

          {/* Despesas */}
          <div className="relatorios__painel relatorios__painel--despesas">
            <div className="relatorios__despesas-titulo">
              <HiCurrencyDollar className="relatorios__despesas-icone" />
              <h3>Despesas do Estabelecimento</h3>
            </div>

            <ul className="relatorios__despesas-lista">
              {DESPESAS.map((d) => (
                <li key={d.nome} className="relatorios__despesa-item">
                  <span className="relatorios__despesa-bolinha" />
                  <span className="relatorios__despesa-nome">{d.nome}</span>
                  <span className="relatorios__despesa-valor">{formatarPreco(d.valor)}</span>
                </li>
              ))}
            </ul>

            <div className="relatorios__despesas-totais">
              <div className="relatorios__total-linha">
                <span>Total de Despesas</span>
                <strong>{formatarPreco(TOTAL_DESPESAS)}</strong>
              </div>
              <div className="relatorios__total-linha relatorios__total-linha--lucro">
                <span>Lucro Líquido</span>
                <strong>{formatarPreco(LUCRO_LIQUIDO)}</strong>
              </div>
            </div>
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
              <p className="relatorios__rodape-numero">126</p>
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
                <p className="relatorios__destaque-texto">
                  <strong>Sábado (26/04)</strong> foi o dia com maior faturamento.
                </p>
                <p className="relatorios__destaque-valor">R$ 1.860,00</p>
              </div>
            </div>
          </div>

        </div>

        {/* ── Atualização ── */}
        <p className="relatorios__atualizacao">
          <HiRefresh /> Relatórios atualizados em 27/04/2024 10:30
        </p>

      </div>
    </RestaurantLayout>
  );
};

export default Relatorios;