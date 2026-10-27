import React, { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  HiPlus,
  HiPencil,
  HiTrash,
  HiCalendar,
  HiTag,
  HiCreditCard,
  HiSwitchVertical,
  HiCurrencyDollar,
  HiDocumentText,
  HiX,
} from 'react-icons/hi';
import { TbArrowsLeftRight } from 'react-icons/tb';
import { MdOutlineReceiptLong } from 'react-icons/md';
import { BsCashStack } from 'react-icons/bs';
import RestaurantLayout from '../../../../../shared/components/layout/Restaurantelayout';
import './Despesas.css';

// ── Tipos ──────────────────────────────────────────────────────────────
type Categoria =
  | 'Custos dos Produtos'
  | 'Contas'
  | 'Marketing'
  | 'Aluguel'
  | 'Taxas e Comissões'
  | 'Outros';

type FormaPagamento = 'Pix' | 'Boleto' | 'Cartão' | 'Dinheiro';

interface Despesa {
  id: number;
  dataISO: string; // yyyy-mm-dd, facilita ordenação e filtro
  descricao: string;
  categoria: Categoria;
  fornecedor: string;
  pagamento: FormaPagamento;
  valor: number;
}

interface FormularioDespesa {
  dataISO: string;
  descricao: string;
  categoria: Categoria;
  fornecedor: string;
  pagamento: FormaPagamento;
  valor: string;
}

type ChaveOrdenacao = 'dataISO' | 'descricao' | 'categoria' | 'fornecedor' | 'valor';

// ── Constantes ────────────────────────────────────────────────────────
const CATEGORIAS: Categoria[] = [
  'Custos dos Produtos',
  'Contas',
  'Marketing',
  'Aluguel',
  'Taxas e Comissões',
  'Outros',
];

const FORMAS_PAGAMENTO: FormaPagamento[] = ['Pix', 'Boleto', 'Cartão', 'Dinheiro'];

const ITENS_POR_PAGINA = 7;

const FORMULARIO_VAZIO: FormularioDespesa = {
  dataISO: '',
  descricao: '',
  categoria: 'Outros',
  fornecedor: '',
  pagamento: 'Pix',
  valor: '',
};

// ── Mock (substituir por chamada à API futuramente) ──────────────────
const DESPESAS_MOCK: Despesa[] = [
  { id: 23, dataISO: '2024-04-27', descricao: 'Compra de carnes',           categoria: 'Custos dos Produtos', fornecedor: 'Frigorífico Bom Corte', pagamento: 'Pix',      valor: 850,  },
  { id: 22, dataISO: '2024-04-26', descricao: 'Conta de energia',           categoria: 'Contas',               fornecedor: 'CPFL',                  pagamento: 'Boleto',   valor: 420,  },
  { id: 21, dataISO: '2024-04-25', descricao: 'Anúncio Instagram',          categoria: 'Marketing',            fornecedor: 'Meta',                  pagamento: 'Cartão',   valor: 300,      },
  { id: 20, dataISO: '2024-04-24', descricao: 'Aluguel do imóvel',          categoria: 'Aluguel',              fornecedor: 'Imobiliária Alpha',     pagamento: 'Cartão',   valor: 1200,  },
  { id: 19, dataISO: '2024-04-23', descricao: 'Material de limpeza',        categoria: 'Outros',               fornecedor: 'Casa do Produtor',      pagamento: 'Dinheiro', valor: 180,    },
  { id: 18, dataISO: '2024-04-22', descricao: 'Taxas bancárias',            categoria: 'Taxas e Comissões',    fornecedor: 'Banco do Brasil',       pagamento: 'Cartão',   valor: 90,   },
  { id: 17, dataISO: '2024-04-21', descricao: 'Manutenção de equipamentos', categoria: 'Outros',               fornecedor: 'Técnico Todo Dia',      pagamento: 'Pix',      valor: 410,    },
  { id: 16, dataISO: '2024-04-20', descricao: 'Compra de hortifruti',       categoria: 'Custos dos Produtos',  fornecedor: 'Sacolão da Serra',      pagamento: 'Dinheiro', valor: 260,  },
  { id: 15, dataISO: '2024-04-19', descricao: 'Conta de água',              categoria: 'Contas',               fornecedor: 'Sabesp',                pagamento: 'Boleto',   valor: 150,  },
  { id: 14, dataISO: '2024-04-18', descricao: 'Impulsionamento de posts',   categoria: 'Marketing',            fornecedor: 'Meta',                  pagamento: 'Cartão',   valor: 220, 
    
      },
  { id: 13, dataISO: '2024-04-17', descricao: 'Comissão de aplicativo',     categoria: 'Taxas e Comissões',    fornecedor: 'iFood',                 pagamento: 'Pix',      valor: 340, 
    
      },
  { id: 12, dataISO: '2024-04-16', descricao: 'Compra de bebidas',          categoria: 'Custos dos Produtos',  fornecedor: 'Distribuidora Nova Era',pagamento: 'Boleto',   valor: 610,  },
  { id: 11, dataISO: '2024-04-15', descricao: 'Internet do estabelecimento',categoria: 'Contas',               fornecedor: 'Vivo Fibra',            pagamento: 'Cartão',   valor: 199, 
    
      },
  { id: 10, dataISO: '2024-04-14', descricao: 'Uniformes da equipe',        categoria: 'Outros',               fornecedor: 'Confecções União',      pagamento: 'Dinheiro', valor: 320,  },
  { id: 9,  dataISO: '2024-04-13', descricao: 'Panfletos promocionais',     categoria: 'Marketing',            fornecedor: 'Gráfica Rápida',        pagamento: 'Dinheiro', valor: 130, 
    
      },
  { id: 8,  dataISO: '2024-04-12', descricao: 'Compra de embalagens',       categoria: 'Custos dos Produtos',  fornecedor: 'EmbalaFácil',           pagamento: 'Boleto',   valor: 275,  },
  { id: 7,  dataISO: '2024-04-11', descricao: 'Taxa de máquina de cartão',  categoria: 'Taxas e Comissões',    fornecedor: 'Stone',                 pagamento: 'Pix',      valor: 75,   },
  { id: 6,  dataISO: '2024-04-10', descricao: 'Aluguel do estacionamento',  categoria: 'Aluguel',              fornecedor: 'Imobiliária Alpha',     pagamento: 'Boleto',   valor: 350, 
    
      },
  { id: 5,  dataISO: '2024-04-09', descricao: 'Compra de laticínios',       categoria: 'Custos dos Produtos',  fornecedor: 'Laticínios Bom Sabor',  pagamento: 'Dinheiro', valor: 190,  },
  { id: 4,  dataISO: '2024-04-08', descricao: 'Conta de gás',               categoria: 'Contas',               fornecedor: 'Comgás',                pagamento: 'Boleto',   valor: 240, 
    
      },
  { id: 3,  dataISO: '2024-04-07', descricao: 'Dedetização',                categoria: 'Outros',               fornecedor: 'Higine Total',          pagamento: 'Cartão',   valor: 280,  },
  { id: 2,  dataISO: '2024-04-06', descricao: 'Reposição de gás de cozinha',categoria: 'Custos dos Produtos',  fornecedor: 'Gás Rápido',            pagamento: 'Pix',      valor: 165, 
    
      },
  { id: 1,  dataISO: '2024-04-05', descricao: 'Manutenção do freezer',      categoria: 'Outros',               fornecedor: 'Técnico Todo Dia',      pagamento: 'Cartão',   valor: 310,  },
];

// ── Helpers ────────────────────────────────────────────────────────────
const formatarPreco = (valor: number): string =>
  valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

const formatarDataExibicao = (iso: string): string => {
  if (!iso) return '';
  const [ano, mes, dia] = iso.split('-');
  return `${dia}/${mes}/${ano}`;
};

const CATEGORIA_ESTILO: Record<Categoria, string> = {
  'Custos dos Produtos': 'despesas__badge--rosa',
  Contas: 'despesas__badge--azul',
  Marketing: 'despesas__badge--roxo',
  Aluguel: 'despesas__badge--ambar',
  'Taxas e Comissões': 'despesas__badge--ciano',
  Outros: 'despesas__badge--cinza',
};

const PAGAMENTO_ICONE: Record<FormaPagamento, React.ReactNode> = {
  Pix: <TbArrowsLeftRight />,
  Boleto: <MdOutlineReceiptLong />,
  Cartão: <HiCreditCard />,
  Dinheiro: <BsCashStack />,
};

const PAGAMENTO_ESTILO: Record<FormaPagamento, string> = {
  Pix: 'despesas__pagamento-icone--pix',
  Boleto: 'despesas__pagamento-icone--boleto',
  Cartão: 'despesas__pagamento-icone--cartao',
  Dinheiro: 'despesas__pagamento-icone--dinheiro',
};

// ── Componente principal ────────────────────────────────────────────────
const Despesas: React.FC = () => {
  const navigate = useNavigate();

  // Dados
  const [despesas, setDespesas] = useState<Despesa[]>(DESPESAS_MOCK);

  // Filtros
  const [periodoInicio, setPeriodoInicio] = useState('');
  const [periodoFim, setPeriodoFim] = useState('');
  const [periodoAberto, setPeriodoAberto] = useState(false);
  const [categoriaFiltro, setCategoriaFiltro] = useState('Todas as categorias');
  const [pagamentoFiltro, setPagamentoFiltro] = useState('Todas as formas');


  // Ordenação
  const [ordenarPor, setOrdenarPor] = useState<ChaveOrdenacao>('dataISO');
  const [ordemDecrescente, setOrdemDecrescente] = useState(true);

  // Paginação
  const [paginaAtual, setPaginaAtual] = useState(1);

  // Modal de edição
  const [modalAberto, setModalAberto] = useState(false);
  const [editandoId, setEditandoId] = useState<number | null>(null);
  const [formulario, setFormulario] = useState<FormularioDespesa>(FORMULARIO_VAZIO);

  // Modal de exclusão
  const [despesaParaExcluir, setDespesaParaExcluir] = useState<Despesa | null>(null);

  // ── Filtragem ──────────────────────────────────────────────────────
  const despesasFiltradas = useMemo(() => {
    return despesas.filter((d) => {
      const dentroCategoria = categoriaFiltro === 'Todas as categorias' || d.categoria === categoriaFiltro;
      const dentroPagamento = pagamentoFiltro === 'Todas as formas' || d.pagamento === pagamentoFiltro;
      const dentroInicio = !periodoInicio || d.dataISO >= periodoInicio;
      const dentroFim = !periodoFim || d.dataISO <= periodoFim;
      return dentroCategoria && dentroPagamento && dentroInicio && dentroFim;
    });
  }, [despesas, categoriaFiltro, pagamentoFiltro, periodoInicio, periodoFim]);

  // ── Ordenação ──────────────────────────────────────────────────────
  const despesasOrdenadas = useMemo(() => {
    const copia = [...despesasFiltradas];
    copia.sort((a, b) => {
      const chave = ordenarPor;
      let comparacao = 0;
      if (chave === 'valor') {
        comparacao = a.valor - b.valor;
      } else {
        comparacao = String(a[chave]).localeCompare(String(b[chave]), 'pt-BR');
      }
      return ordemDecrescente ? -comparacao : comparacao;
    });
    return copia;
  }, [despesasFiltradas, ordenarPor, ordemDecrescente]);

  // ── Paginação ──────────────────────────────────────────────────────
  const totalPaginas = Math.max(1, Math.ceil(despesasOrdenadas.length / ITENS_POR_PAGINA));
  const paginaSegura = Math.min(paginaAtual, totalPaginas);
  const indiceInicio = (paginaSegura - 1) * ITENS_POR_PAGINA;
  const despesasDaPagina = despesasOrdenadas.slice(indiceInicio, indiceInicio + ITENS_POR_PAGINA);

  // ── Totais do período filtrado ──────────────────────────────────────
  const totalPeriodo = despesasFiltradas.reduce((acc, d) => acc + d.valor, 0);

  // ── Handlers ───────────────────────────────────────────────────────
  const alternarOrdenacao = (chave: ChaveOrdenacao) => {
    if (ordenarPor === chave) {
      setOrdemDecrescente((atual) => !atual);
    } else {
      setOrdenarPor(chave);
      setOrdemDecrescente(true);
    }
  };

  const limparFiltroPeriodo = () => {
    setPeriodoInicio('');
    setPeriodoFim('');
    setPaginaAtual(1);
  };

  const abrirModalEdicao = (despesa: Despesa) => {
    setEditandoId(despesa.id);
    setFormulario({
      dataISO: despesa.dataISO,
      descricao: despesa.descricao,
      categoria: despesa.categoria,
      fornecedor: despesa.fornecedor,
      pagamento: despesa.pagamento,
      valor: String(despesa.valor),
    });
    setModalAberto(true);
  };

  const fecharModal = () => {
    setModalAberto(false);
    setEditandoId(null);
    setFormulario(FORMULARIO_VAZIO);
  };

  const atualizarCampoFormulario = <K extends keyof FormularioDespesa>(campo: K, valor: FormularioDespesa[K]) => {
    setFormulario((atual) => ({ ...atual, [campo]: valor }));
  };

  const salvarDespesa = (evento: React.FormEvent) => {
    evento.preventDefault();

    const valorNumerico = Number(formulario.valor.replace(',', '.'));
    if (!formulario.dataISO || !formulario.descricao.trim() || !valorNumerico || valorNumerico <= 0) {
      return;
    }

    if (editandoId !== null) {
      setDespesas((atual) =>
        atual.map((d) =>
          d.id === editandoId
            ? {
                ...d,
                dataISO: formulario.dataISO,
                descricao: formulario.descricao.trim(),
                categoria: formulario.categoria,
                fornecedor: formulario.fornecedor.trim(),
                pagamento: formulario.pagamento,
                valor: valorNumerico,
              }
            : d
        )
      );
    } else {
      const novoId = despesas.reduce((max, d) => Math.max(max, d.id), 0) + 1;
      setDespesas((atual) => [
        {
          id: novoId,
          dataISO: formulario.dataISO,
          descricao: formulario.descricao.trim(),
          categoria: formulario.categoria,
          fornecedor: formulario.fornecedor.trim(),
          pagamento: formulario.pagamento,
          valor: valorNumerico,      },
        ...atual,
      ]);
      setPaginaAtual(1);
    }

    fecharModal();
  };

  const confirmarExclusao = () => {
    if (!despesaParaExcluir) return;
    setDespesas((atual) => atual.filter((d) => d.id !== despesaParaExcluir.id));
    setDespesaParaExcluir(null);
  };

  const IconeOrdenacao = ({ coluna }: { coluna: ChaveOrdenacao }) => (
    <HiSwitchVertical
      className={`despesas__icone-ordenar ${ordenarPor === coluna ? 'despesas__icone-ordenar--ativo' : ''}`}
    />
  );

  return (
    <RestaurantLayout>
      <div className="despesas">

        {/* ── Cabeçalho ── */}
        <div className="despesas__cabecalho">
          <div>
            <h2 className="despesas__titulo">Despesas</h2>
            <p className="despesas__subtitulo">Gerencie e acompanhe todas as despesas do seu estabelecimento.</p>
          </div>
          <button className="despesas__btn-nova" onClick={() => navigate('/restaurante/despesas/cadastrodespe')}>
            <HiPlus /> Nova Despesa
          </button>
        </div>

        {/* ── Filtros ── */}
        <div className="despesas__filtros">

          <div className="despesas__filtro-periodo">
            <button
              type="button"
              className="despesas__filtro-caixa"
              onClick={() => setPeriodoAberto((aberto) => !aberto)}
            >
              <span className="despesas__filtro-icone">
                <HiCalendar />
              </span>
              <span>
                <span className="despesas__filtro-label">Período</span>
                <span className="despesas__filtro-valor">
                  {periodoInicio || periodoFim
                    ? `${formatarDataExibicao(periodoInicio) || '...'} até ${formatarDataExibicao(periodoFim) || '...'}`
                    : 'Todo o período'}
                </span>
              </span>
            </button>

            {periodoAberto && (
              <div className="despesas__periodo-painel">
                <label className="despesas__periodo-campo">
                  De
                  <input
                    type="date"
                    value={periodoInicio}
                    onChange={(e) => {
                      setPeriodoInicio(e.target.value);
                      setPaginaAtual(1);
                    }}
                  />
                </label>
                <label className="despesas__periodo-campo">
                  Até
                  <input
                    type="date"
                    value={periodoFim}
                    onChange={(e) => {
                      setPeriodoFim(e.target.value);
                      setPaginaAtual(1);
                    }}
                  />
                </label>
                <div className="despesas__periodo-acoes">
                  <button type="button" className="despesas__periodo-limpar" onClick={limparFiltroPeriodo}>
                    Limpar
                  </button>
                  <button type="button" className="despesas__periodo-aplicar" onClick={() => setPeriodoAberto(false)}>
                    Aplicar
                  </button>
                </div>
              </div>
            )}
          </div>

          <div className="despesas__filtro-caixa">
            <span className="despesas__filtro-icone">
              <HiTag />
            </span>
            <span className="despesas__filtro-corpo">
              <span className="despesas__filtro-label">Categoria</span>
              <select
                className="despesas__filtro-select"
                value={categoriaFiltro}
                onChange={(e) => {
                  setCategoriaFiltro(e.target.value);
                  setPaginaAtual(1);
                }}
              >
                <option>Todas as categorias</option>
                {CATEGORIAS.map((c) => (
                  <option key={c}>{c}</option>
                ))}
              </select>
            </span>
          </div>

          <div className="despesas__filtro-caixa">
            <span className="despesas__filtro-icone">
              <HiCreditCard />
            </span>
            <span className="despesas__filtro-corpo">
              <span className="despesas__filtro-label">Forma de pagamento</span>
              <select
                className="despesas__filtro-select"
                value={pagamentoFiltro}
                onChange={(e) => {
                  setPagamentoFiltro(e.target.value);
                  setPaginaAtual(1);
                }}
              >
                <option>Todas as formas</option>
                {FORMAS_PAGAMENTO.map((f) => (
                  <option key={f}>{f}</option>
                ))}
              </select>
            </span>
          </div>

        </div>

        {/* ── Resumo do período ── */}
        <div className="despesas__resumo">
          <div className="despesas__resumo-item">
            <span className="despesas__resumo-icone despesas__resumo-icone--vermelho">
              <HiCurrencyDollar />
            </span>
            <span>
              <span className="despesas__resumo-label">Despesas do Período</span>
              <span className="despesas__resumo-valor">{formatarPreco(totalPeriodo)}</span>
            </span>
          </div>
          <span className="despesas__resumo-divisor" />
          <div className="despesas__resumo-item">
            <span className="despesas__resumo-icone despesas__resumo-icone--claro">
              <HiDocumentText />
            </span>
            <span>
              <span className="despesas__resumo-numero">{despesasFiltradas.length}</span>
              <span className="despesas__resumo-sub"> despesas cadastradas</span>
            </span>
          </div>
        </div>

        {/* ── Tabela ── */}
        <div className="despesas__tabela-wrapper">
          <div className="despesas__tabela-scroll">
            <table className="despesas__tabela">
              <thead>
                <tr>
                  <th onClick={() => alternarOrdenacao('dataISO')}>Data <IconeOrdenacao coluna="dataISO" /></th>
                  <th onClick={() => alternarOrdenacao('descricao')}>Descrição <IconeOrdenacao coluna="descricao" /></th>
                  <th onClick={() => alternarOrdenacao('categoria')}>Categoria <IconeOrdenacao coluna="categoria" /></th>
                  <th onClick={() => alternarOrdenacao('fornecedor')}>Fornecedor <IconeOrdenacao coluna="fornecedor" /></th>
                  <th>Pagamento</th>
                  <th onClick={() => alternarOrdenacao('valor')}>Valor <IconeOrdenacao coluna="valor" /></th>
                  <th>Ações</th>
                </tr>
              </thead>
              <tbody>
                {despesasDaPagina.map((despesa) => (
                  <tr key={despesa.id}>
                    <td>{formatarDataExibicao(despesa.dataISO)}</td>
                    <td>{despesa.descricao}</td>
                    <td>
                      <span className={`despesas__badge ${CATEGORIA_ESTILO[despesa.categoria]}`}>
                        {despesa.categoria}
                      </span>
                    </td>
                    <td>{despesa.fornecedor}</td>
                    <td>
                      <span className="despesas__pagamento">
                        <span className={`despesas__pagamento-icone ${PAGAMENTO_ESTILO[despesa.pagamento]}`}>
                          {PAGAMENTO_ICONE[despesa.pagamento]}
                        </span>
                        {despesa.pagamento}
                      </span>
                    </td>
                    <td className="despesas__valor">{formatarPreco(despesa.valor)}</td>
                    <td>
                      <div className="despesas__acoes">
                        <button
                          className="despesas__btn-acao despesas__btn-acao--editar"
                          onClick={() => abrirModalEdicao(despesa)}
                          aria-label="Editar despesa"
                        >
                          <HiPencil />
                        </button>
                        <button
                          className="despesas__btn-acao despesas__btn-acao--excluir"
                          onClick={() => setDespesaParaExcluir(despesa)}
                          aria-label="Excluir despesa"
                        >
                          <HiTrash />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}

                {despesasDaPagina.length === 0 && (
                  <tr>
                    <td colSpan={7} className="despesas__vazio">
                      Nenhuma despesa encontrada para os filtros selecionados.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* ── Paginação ── */}
          <div className="despesas__paginacao">
            <span className="despesas__paginacao-info">
              Mostrando {despesasDaPagina.length} de {despesasOrdenadas.length} registros
            </span>
            <div className="despesas__paginacao-botoes">
              <button
                onClick={() => setPaginaAtual((p) => Math.max(1, p - 1))}
                disabled={paginaSegura === 1}
              >
                ‹
              </button>
              {Array.from({ length: totalPaginas }, (_, i) => i + 1).map((num) => (
                <button
                  key={num}
                  className={paginaSegura === num ? 'despesas__pagina--ativa' : ''}
                  onClick={() => setPaginaAtual(num)}
                >
                  {num}
                </button>
              ))}
              <button
                onClick={() => setPaginaAtual((p) => Math.min(totalPaginas, p + 1))}
                disabled={paginaSegura === totalPaginas}
              >
                ›
              </button>
            </div>
          </div>
        </div>

        {/* ── Modal: editar despesa ── */}
        {modalAberto && (
          <div className="despesas__modal-overlay" onClick={fecharModal}>
            <div className="despesas__modal" onClick={(e) => e.stopPropagation()}>
              <div className="despesas__modal-cabecalho">
                <h3>{editandoId !== null ? 'Editar Despesa' : 'Nova Despesa'}</h3>
                <button className="despesas__modal-fechar" onClick={fecharModal} aria-label="Fechar">
                  <HiX />
                </button>
              </div>

              <form className="despesas__form" onSubmit={salvarDespesa}>
                <label className="despesas__form-campo">
                  Data
                  <input
                    type="date"
                    required
                    value={formulario.dataISO}
                    onChange={(e) => atualizarCampoFormulario('dataISO', e.target.value)}
                  />
                </label>

                <label className="despesas__form-campo">
                  Descrição
                  <input
                    type="text"
                    required
                    placeholder="Ex.: Compra de carnes"
                    value={formulario.descricao}
                    onChange={(e) => atualizarCampoFormulario('descricao', e.target.value)}
                  />
                </label>

                <div className="despesas__form-linha">
                  <label className="despesas__form-campo">
                    Categoria
                    <select
                      value={formulario.categoria}
                      onChange={(e) => atualizarCampoFormulario('categoria', e.target.value as Categoria)}
                    >
                      {CATEGORIAS.map((c) => (
                        <option key={c}>{c}</option>
                      ))}
                    </select>
                  </label>

                  <label className="despesas__form-campo">
                    Forma de pagamento
                    <select
                      value={formulario.pagamento}
                      onChange={(e) => atualizarCampoFormulario('pagamento', e.target.value as FormaPagamento)}
                    >
                      {FORMAS_PAGAMENTO.map((f) => (
                        <option key={f}>{f}</option>
                      ))}
                    </select>
                  </label>
                </div>

                <label className="despesas__form-campo">
                  Fornecedor
                  <input
                    type="text"
                    placeholder="Ex.: Frigorífico Bom Corte"
                    value={formulario.fornecedor}
                    onChange={(e) => atualizarCampoFormulario('fornecedor', e.target.value)}
                  />
                </label>

                <div className="despesas__form-linha">
                  <label className="despesas__form-campo">
                    Valor (R$)
                    <input
                      type="number"
                      min="0.01"
                      step="0.01"
                      required
                      placeholder="0,00"
                      value={formulario.valor}
                      onChange={(e) => atualizarCampoFormulario('valor', e.target.value)}
                    />
                  </label>
                </div>

                <div className="despesas__form-acoes">
                  <button type="button" className="despesas__form-cancelar" onClick={fecharModal}>
                    Cancelar
                  </button>
                  <button type="submit" className="despesas__form-salvar">
                    {editandoId !== null ? 'Salvar Alterações' : 'Adicionar Despesa'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* ── Modal: confirmar exclusão ── */}
        {despesaParaExcluir && (
          <div className="despesas__modal-overlay" onClick={() => setDespesaParaExcluir(null)}>
            <div className="despesas__modal despesas__modal--confirmar" onClick={(e) => e.stopPropagation()}>
              <h3>Excluir despesa?</h3>
              <p>
                Tem certeza que deseja excluir <strong>{despesaParaExcluir.descricao}</strong> ({formatarPreco(despesaParaExcluir.valor)})?
                Essa ação não pode ser desfeita.
              </p>
              <div className="despesas__form-acoes">
                <button className="despesas__form-cancelar" onClick={() => setDespesaParaExcluir(null)}>
                  Cancelar
                </button>
                <button className="despesas__form-excluir" onClick={confirmarExclusao}>
                  Excluir
                </button>
              </div>
            </div>
          </div>
        )}

      </div>
    </RestaurantLayout>
  );
};

export default Despesas;