import React, { useCallback, useEffect, useMemo, useState } from 'react';
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
import ContadorCaracteres from '../../../../../shared/components/ContadorCaracteres/ContadorCaracteres';
import DespesaService, {
  CategoriaDespesaApi,
  DespesaApi,
  DespesaPayload,
  FORMAS_PAGAMENTO_DESPESA,
  formaPagamentoDoRotulo,
  mensagemErroDespesa,
  rotuloFormaPagamento,
} from '../../../../../services/despesa.service';
import './Despesas.css';

// Tipos
type Categoria = string;

type FormaPagamento = 'Pix' | 'Boleto' | 'Cartão' | 'Dinheiro';

interface Despesa {
  id: string;
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

//Constantes 
// Mesmas categorias do cadastro (a lista real vem da API)
const CATEGORIAS_INICIAIS = ['Custos dos Produtos', 'Contas', 'Marketing', 'Aluguel', 'Taxas e Comissões', 'Outros'];

const FORMAS_PAGAMENTO: FormaPagamento[] = FORMAS_PAGAMENTO_DESPESA.map((f) => f.rotulo as FormaPagamento);

const ITENS_POR_PAGINA = 7;

const FORMULARIO_VAZIO: FormularioDespesa = {
  dataISO: '',
  descricao: '',
  categoria: 'Outros',
  fornecedor: '',
  pagamento: 'Pix',
  valor: '',
};

// Conversão API <-> tela 
const doServidor = (d: DespesaApi): Despesa => ({
  id: d.id,
  dataISO: d.data_despesa,
  descricao: d.descricao,
  categoria: d.categoria,
  fornecedor: d.fornecedor,
  pagamento: rotuloFormaPagamento(d.forma_pagamento) as FormaPagamento,
  valor: d.valor,
});

//  Helpers 
//  Máscara de moeda
const MAX_DIGITOS_MOEDA = 8; // até R$ 999.999,99
const centavosParaMoeda = (centavos: number): string => {
  const c = Math.max(0, Math.round(centavos));
  const reais = String(Math.floor(c / 100)).replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  return `R$ ${reais},${String(c % 100).padStart(2, '0')}`;
};
/** Texto digitado  "R$ 12,50". Campo vazio (ou zero) apaga o texto. */
const mascaraMoeda = (texto: string): string => {
  const centavos = Number(texto.replace(/\D/g, '').slice(0, MAX_DIGITOS_MOEDA));
  return centavos > 0 ? centavosParaMoeda(centavos) : '';
};
/** "R$ 12,50" = 12.5 (campo vazio = 0) */
const moedaParaNumero = (texto: string): number => Number(texto.replace(/\D/g, '') || 0) / 100;
/** 12.5 = "R$ 12,50" */
const numeroParaMoeda = (valor: number): string => centavosParaMoeda(Math.round(valor * 100));

const formatarPreco = (valor: number): string =>
  valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

const formatarDataExibicao = (iso: string): string => {
  if (!iso) return '';
  const [ano, mes, dia] = iso.split('-');
  return `${dia}/${mes}/${ano}`;
};

const CATEGORIA_ESTILO: Record<string, string> = {
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

//Componente principal 
const Despesas: React.FC = () => {
  const navigate = useNavigate();

  // Dados
  const [despesas, setDespesas] = useState<Despesa[]>([]);
  const [categorias, setCategorias] = useState<string[]>(CATEGORIAS_INICIAIS);
  const [carregando, setCarregando] = useState(true);
  const [erroLista, setErroLista] = useState('');
  const [salvando, setSalvando] = useState(false);
  const [erroModal, setErroModal] = useState('');

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
  const [editandoId, setEditandoId] = useState<string | null>(null);
  const [formulario, setFormulario] = useState<FormularioDespesa>(FORMULARIO_VAZIO);

  // Modal de exclusão
  const [despesaParaExcluir, setDespesaParaExcluir] = useState<Despesa | null>(null);

  // Carregamento (API) 
  // O período vai para o servidor; categoria e forma de pagamento filtram na própria tela.
  const carregar = useCallback(async () => {
    if (periodoInicio && periodoFim && periodoInicio > periodoFim) {
      setDespesas([]);
      setErroLista('A data inicial não pode ser depois da data final.');
      setCarregando(false);
      return;
    }

    setCarregando(true);
    setErroLista('');
    try {
      const lista = await DespesaService.listar({
        ...(periodoInicio && { data_inicio: periodoInicio }),
        ...(periodoFim && { data_fim: periodoFim }),
      });
      setDespesas(lista.map(doServidor));
    } catch (err) {
      setErroLista(mensagemErroDespesa(err, 'Não foi possível carregar as despesas.'));
    } finally {
      setCarregando(false);
    }
  }, [periodoInicio, periodoFim]);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  // Categorias do restaurante (as padrão + as que ele criou no cadastro)
  useEffect(() => {
    DespesaService.categorias()
      .then((lista: CategoriaDespesaApi[]) => setCategorias(lista.map((c) => c.nome)))
      .catch(() => { /* mantém a lista inicial; o erro principal aparece na tabela */ });
  }, []);

  // Filtragem 
  const despesasFiltradas = useMemo(() => {
    return despesas.filter((d) => {
      const dentroCategoria = categoriaFiltro === 'Todas as categorias' || d.categoria === categoriaFiltro;
      const dentroPagamento = pagamentoFiltro === 'Todas as formas' || d.pagamento === pagamentoFiltro;
      const dentroInicio = !periodoInicio || d.dataISO >= periodoInicio;
      const dentroFim = !periodoFim || d.dataISO <= periodoFim;
      return dentroCategoria && dentroPagamento && dentroInicio && dentroFim;
    });
  }, [despesas, categoriaFiltro, pagamentoFiltro, periodoInicio, periodoFim]);

  // Ordenação 
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

  // Paginação
  const totalPaginas = Math.max(1, Math.ceil(despesasOrdenadas.length / ITENS_POR_PAGINA));
  const paginaSegura = Math.min(paginaAtual, totalPaginas);
  const indiceInicio = (paginaSegura - 1) * ITENS_POR_PAGINA;
  const despesasDaPagina = despesasOrdenadas.slice(indiceInicio, indiceInicio + ITENS_POR_PAGINA);

  //  Totais do período filtrado 
  const totalPeriodo = despesasFiltradas.reduce((acc, d) => acc + d.valor, 0);

  // Handlers 
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
    setErroModal('');
    setEditandoId(despesa.id);
    setFormulario({
      dataISO: despesa.dataISO,
      descricao: despesa.descricao,
      categoria: despesa.categoria,
      fornecedor: despesa.fornecedor,
      pagamento: despesa.pagamento,
      valor: numeroParaMoeda(despesa.valor),
    });
    setModalAberto(true);
  };

  const fecharModal = () => {
    setErroModal('');
    setModalAberto(false);
    setEditandoId(null);
    setFormulario(FORMULARIO_VAZIO);
  };

  const atualizarCampoFormulario = <K extends keyof FormularioDespesa>(campo: K, valor: FormularioDespesa[K]) => {
    setFormulario((atual) => ({ ...atual, [campo]: valor }));
  };

  const salvarDespesa = async (evento: React.FormEvent) => {
    evento.preventDefault();

    const valorNumerico = moedaParaNumero(formulario.valor);
    if (!formulario.dataISO || !formulario.descricao.trim() || !valorNumerico || valorNumerico <= 0) {
      setErroModal('Preencha a data, a descrição e um valor maior que zero.');
      return;
    }

    const payload: DespesaPayload = {
      data_despesa: formulario.dataISO,
      descricao: formulario.descricao.trim(),
      categoria: formulario.categoria,
      fornecedor: formulario.fornecedor.trim(),
      forma_pagamento: formaPagamentoDoRotulo(formulario.pagamento),
      valor: valorNumerico,
    };

    setSalvando(true);
    setErroModal('');
    try {
      if (editandoId !== null) {
        const atualizada = doServidor(await DespesaService.atualizar(editandoId, payload));
        setDespesas((atual) => atual.map((d) => (d.id === editandoId ? atualizada : d)));
      } else {
        const criada = doServidor(await DespesaService.criar(payload));
        setDespesas((atual) => [criada, ...atual]);
        setPaginaAtual(1);
      }
      fecharModal();
    } catch (err) {
      setErroModal(mensagemErroDespesa(err, 'Não foi possível salvar a despesa.'));
    } finally {
      setSalvando(false);
    }
  };

  const confirmarExclusao = async () => {
    if (!despesaParaExcluir) return;

    setSalvando(true);
    setErroModal('');
    try {
      await DespesaService.excluir(despesaParaExcluir.id);
      setDespesas((atual) => atual.filter((d) => d.id !== despesaParaExcluir.id));
      setDespesaParaExcluir(null);
    } catch (err) {
      setErroModal(mensagemErroDespesa(err, 'Não foi possível excluir a despesa.'));
    } finally {
      setSalvando(false);
    }
  };

  const IconeOrdenacao = ({ coluna }: { coluna: ChaveOrdenacao }) => (
    <HiSwitchVertical
      className={`despesas__icone-ordenar ${ordenarPor === coluna ? 'despesas__icone-ordenar--ativo' : ''}`}
    />
  );

  return (
    <RestaurantLayout>
      <div className="despesas">

        {/*  Cabeçalho  */}
        <div className="despesas__cabecalho">
          <div>
            <h2 className="despesas__titulo">Despesas</h2>
            <p className="despesas__subtitulo">Gerencie e acompanhe todas as despesas do seu estabelecimento.</p>
          </div>
          <button className="despesas__btn-nova" onClick={() => navigate('/restaurante/despesas/cadastrodespe')}>
            <HiPlus /> Nova Despesa
          </button>
        </div>

        {/*  Filtros  */}
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
                {categorias.map((c) => (
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

        {/*  Resumo do período  */}
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

        {/*  Tabela  */}
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
                      <span className={`despesas__badge ${CATEGORIA_ESTILO[despesa.categoria] ?? 'despesas__badge--cinza'}`}>
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
                          onClick={() => { setErroModal(''); setDespesaParaExcluir(despesa); }}
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
                      {carregando
                        ? 'Carregando despesas...'
                        : erroLista
                          ? (
                            <>
                              {erroLista}{' '}
                              <button type="button" className="despesas__periodo-limpar" onClick={() => void carregar()}>
                                Tentar novamente
                              </button>
                            </>
                          )
                          : 'Nenhuma despesa encontrada para os filtros selecionados.'}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/*  Paginação  */}
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

        {/*  Modal: editar despesa  */}
        {modalAberto && (
          <div className="despesas__modal-overlay" onClick={fecharModal}>
            <div className="despesas__modal" onClick={(e) => e.stopPropagation()}>
              <div className="despesas__modal-cabecalho">
                <h3>{editandoId !== null ? 'Editar Despesa' : 'Nova Despesa'}</h3>
                <button className="despesas__modal-fechar" onClick={fecharModal} aria-label="Fechar">
                  <HiX />
                </button>
              </div>

              <form className="despesas__form" onSubmit={(e) => void salvarDespesa(e)}>
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
                    maxLength={30}
                    value={formulario.descricao}
                    onChange={(e) => atualizarCampoFormulario('descricao', e.target.value)}
                  />
                  <ContadorCaracteres valor={formulario.descricao} max={30} />
                </label>

                <div className="despesas__form-linha">
                  <label className="despesas__form-campo">
                    Categoria
                    <select
                      value={formulario.categoria}
                      onChange={(e) => atualizarCampoFormulario('categoria', e.target.value as Categoria)}
                    >
                      {categorias.map((c) => (
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
                    maxLength={30}
                    value={formulario.fornecedor}
                    onChange={(e) => atualizarCampoFormulario('fornecedor', e.target.value)}
                  />
                  <ContadorCaracteres valor={formulario.fornecedor} max={30} />
                </label>

                <div className="despesas__form-linha">
                  <label className="despesas__form-campo">
                    Valor (R$)
                    <input
                      type="text"
                      inputMode="numeric"
                      required
                      placeholder="R$ 0,00"
                      value={formulario.valor}
                      onChange={(e) => atualizarCampoFormulario('valor', mascaraMoeda(e.target.value))}
                    />
                  </label>
                </div>

                {erroModal && <p className="despesas__erro" role="alert">{erroModal}</p>}

                <div className="despesas__form-acoes">
                  <button type="button" className="despesas__form-cancelar" onClick={fecharModal} disabled={salvando}>
                    Cancelar
                  </button>
                  <button type="submit" className="despesas__form-salvar" disabled={salvando}>
                    {salvando ? 'Salvando...' : editandoId !== null ? 'Salvar Alterações' : 'Adicionar Despesa'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/*  Modal: confirmar exclusão  */}
        {despesaParaExcluir && (
          <div className="despesas__modal-overlay" onClick={() => setDespesaParaExcluir(null)}>
            <div className="despesas__modal despesas__modal--confirmar" onClick={(e) => e.stopPropagation()}>
              <h3>Excluir despesa?</h3>
              <p>
                Tem certeza que deseja excluir <strong>{despesaParaExcluir.descricao}</strong> ({formatarPreco(despesaParaExcluir.valor)})?
                Essa ação não pode ser desfeita.
              </p>
              {erroModal && <p className="despesas__erro" role="alert">{erroModal}</p>}
              <div className="despesas__form-acoes">
                <button className="despesas__form-cancelar" onClick={() => { setErroModal(''); setDespesaParaExcluir(null); }} disabled={salvando}>
                  Cancelar
                </button>
                <button className="despesas__form-excluir" onClick={() => void confirmarExclusao()} disabled={salvando}>
                  {salvando ? 'Excluindo...' : 'Excluir'}
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