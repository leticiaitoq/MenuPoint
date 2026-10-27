import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  HiOutlineDocumentText,
  HiOutlineTag,
  HiOutlineOfficeBuilding,
  HiOutlineCalendar,
  HiOutlineCreditCard,
  HiOutlineUser,
  HiCurrencyDollar,
  HiOutlineChatAlt2,
  HiOutlinePencilAlt,
  HiArrowLeft,
  HiArrowRight,
  HiCheck,
  HiInformationCircle,
  HiDocumentReport,
  HiOutlineShoppingCart,
  HiOutlineHome,
  HiPlus,
  HiOutlineCheckCircle,
} from 'react-icons/hi';
import { BsPercent, BsMegaphone } from 'react-icons/bs';
import RestaurantLayout from '../../../../../shared/components/layout/Restaurantelayout';
import './CadDespesa.css';

// ── Tipos ──────────────────────────────────────────────────────────────
interface CategoriaDespesa {
  nome: string;
  icone: React.ReactNode;
  cor: string;
}

interface FormDespesa {
  descricao: string;
  categoria: string;
  estabelecimento: string;
  dataISO: string;
  pagamento: string;
  fornecedor: string;
  valorFormatado: string;
  valorNumerico: number;
  observacoes: string;
}

// ── Constantes ────────────────────────────────────────────────────────
const FORMAS_PAGAMENTO = ['Pix', 'Boleto', 'Cartão', 'Dinheiro'];
const LIMITE_OBSERVACOES = 500;

const CATEGORIAS_PADRAO: CategoriaDespesa[] = [
  { nome: 'Custos dos Produtos', icone: <HiOutlineShoppingCart />, cor: '#16a34a' },
  { nome: 'Taxas e Comissões',   icone: <BsPercent />,             cor: '#d97706' },
  { nome: 'Marketing',           icone: <BsMegaphone />,           cor: '#7c3aed' },
  { nome: 'Aluguel',             icone: <HiOutlineHome />,         cor: '#2563eb' },
];

const CATEGORIA_PADRAO_NOVA: CategoriaDespesa['icone'] = <HiOutlineTag />;

const FORMULARIO_VAZIO: FormDespesa = {
  descricao: '',
  categoria: '',
  estabelecimento: '',
  dataISO: '',
  pagamento: '',
  fornecedor: '',
  valorFormatado: '',
  valorNumerico: 0,
  observacoes: '',
};

// ── Helpers ────────────────────────────────────────────────────────────
const formatarPreco = (valor: number): string =>
  valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

const formatarDataExibicao = (iso: string): string => {
  if (!iso) return '';
  const [ano, mes, dia] = iso.split('-');
  return `${dia}/${mes}/${ano}`;
};

const removerCaracteresEspeciais = (valor: string): string => {
  return valor.replace(/[^a-zA-ZÀ-ÿ0-9\s]/g, '');
};

// ── Componente principal ────────────────────────────────────────────────
const CadDespesa: React.FC = () => {
  const navigate = useNavigate();

  const [passoAtual, setPassoAtual] = useState<1 | 2>(1);
  const [formulario, setFormulario] = useState<FormDespesa>(FORMULARIO_VAZIO);
  const [categorias, setCategorias] = useState<CategoriaDespesa[]>(CATEGORIAS_PADRAO);
  const [adicionandoCategoria, setAdicionandoCategoria] = useState(false);
  const [novaCategoriaNome, setNovaCategoriaNome] = useState('');
  const [erro, setErro] = useState('');
  const [sucesso, setSucesso] = useState(false);

  // ── Atualiza qualquer campo do formulário ──────────────────────────
  const atualizarForm = (campo: Partial<FormDespesa>) => {
    setFormulario((prev) => ({ ...prev, ...campo }));
  };

  // ── Máscara de moeda (mesma lógica usada em CadProdutos) ───────────
  const handleValor = (e: React.ChangeEvent<HTMLInputElement>) => {
    const digitos = e.target.value.replace(/\D/g, '');
    const numero = Number(digitos) / 100;
    atualizarForm({
      valorNumerico: numero,
      valorFormatado: `R$ ${numero.toFixed(2).replace('.', ',')}`,
    });
  };

  // ── Nova categoria (inline, igual ao padrão de CadProdutos) ────────
  const handleNovaCategoria = () => {
    const nome = novaCategoriaNome.trim();
    if (!nome || categorias.some((c) => c.nome === nome)) return;
    setCategorias((prev) => [...prev, { nome, icone: CATEGORIA_PADRAO_NOVA, cor: '#6b7280' }]);
    setNovaCategoriaNome('');
    setAdicionandoCategoria(false);
  };

  // ── Validação e navegação entre os passos ──────────────────────────
  const irParaRevisao = () => {
    if (!formulario.descricao.trim())      { setErro('Informe a descrição da despesa.'); return; }
    if (!formulario.categoria)             { setErro('Selecione uma categoria.'); return; }
    if (!formulario.estabelecimento)       { setErro('Selecione o estabelecimento.'); return; }
    if (!formulario.dataISO)               { setErro('Informe a data da despesa.'); return; }
    if (!formulario.pagamento)             { setErro('Selecione a forma de pagamento.'); return; }
    if (!formulario.valorNumerico)         { setErro('Informe o valor da despesa.'); return; }

    setErro('');
    setPassoAtual(2);
  };

  const voltarParaDados = () => setPassoAtual(1);

  const confirmarESalvar = () => {
    console.log(formulario); // substituir por chamada à API
    setSucesso(true);
  };

  const cancelar = () => navigate('/restaurante/relatorios');

  return (
    <RestaurantLayout>
      <div className="cadd">

        {/* ── Cabeçalho ── */}
        <div className="cadd__cabecalho">
          <h2 className="cadd__titulo">Nova Despesa</h2>
          <p className="cadd__subtitulo">Cadastre uma nova despesa do seu estabelecimento.</p>
        </div>

        {/* ── Stepper ── */}
        <div className="cadd__stepper">
          <div className={`cadd__step ${passoAtual === 1 ? 'cadd__step--ativo' : 'cadd__step--concluido'}`}>
            <span className="cadd__step-numero">1</span>
            <span className="cadd__step-label">Informações Gerais</span>
          </div>
          <div className="cadd__step-linha">
            <span
              className="cadd__step-linha-preenchida"
              style={{ width: passoAtual === 1 ? '4%' : '100%' }}
            />
          </div>
          <div className={`cadd__step ${passoAtual === 2 ? 'cadd__step--ativo' : ''}`}>
            <span className="cadd__step-numero">2</span>
            <span className="cadd__step-label">Resumo e Confirmação</span>
          </div>
        </div>

        {/* ── PASSO 1 — Informações Gerais ── */}
        {passoAtual === 1 && (
          <div className="cadd__grade">

            <div className="cadd__card cadd__card--principal">
              <div className="cadd__card-titulo">
                <span className="cadd__card-icone">
                  <HiOutlinePencilAlt />
                </span>
                <h3>Informações da Despesa</h3>
              </div>

              <div className="cadd__form">

                <div className="cadd__form-linha">
                  <label className="cadd__campo">
                    <span className="cadd__campo-label">Descrição <span className="cadd__obrigatorio">*</span></span>
                    <span className="cadd__campo-input-wrap">
                      <HiOutlineDocumentText className="cadd__campo-icone" />
                      <input
                        type="text"
                        placeholder="Ex.: Compra de carnes"
                        value={formulario.descricao}
                       onChange={(e) => atualizarForm({descricao: removerCaracteresEspeciais(e.target.value),})}
                        maxLength={30}
                      />
                    </span>
                  </label>

                  <label className="cadd__campo">
                    <span className="cadd__campo-label">Categoria <span className="cadd__obrigatorio">*</span></span>
                    <span className="cadd__campo-input-wrap">
                      <HiOutlineTag className="cadd__campo-icone" />
                      <select
                        value={formulario.categoria}
                        onChange={(e) => atualizarForm({ categoria: e.target.value })}
                      >
                        <option value="">Selecione a categoria</option>
                        {categorias.map((c) => (
                          <option key={c.nome} value={c.nome}>{c.nome}</option>
                        ))}
                      </select>
                    </span>
                  </label>
                </div>

                <div className="cadd__form-linha">
                  <label className="cadd__campo">
                    <span className="cadd__campo-label">Data da Despesa <span className="cadd__obrigatorio">*</span></span>
                    <span className="cadd__campo-input-wrap">
                      <HiOutlineCalendar className="cadd__campo-icone" />
                      <input
                        type="date"
                        value={formulario.dataISO}
                        onChange={(e) => atualizarForm({ dataISO: e.target.value })}
                      />
                    </span>
                  </label>
                   <label className="cadd__campo">
                    <span className="cadd__campo-label">Fornecedor</span>
                    <span className="cadd__campo-input-wrap">
                      <HiOutlineUser className="cadd__campo-icone" />
                      <input
                        type="text"
                        placeholder="Ex.: Frigorífico Bom Corte"
                        value={formulario.fornecedor}
                        onChange={(e) => atualizarForm({ fornecedor: e.target.value })}
                        maxLength={30}
                      />
                    </span>
                  </label>
                </div>

                <div className="cadd__form-linha">
                  <label className="cadd__campo">
                    <span className="cadd__campo-label">Forma de Pagamento <span className="cadd__obrigatorio">*</span></span>
                    <span className="cadd__campo-input-wrap">
                      <HiOutlineCreditCard className="cadd__campo-icone" />
                      <select
                        value={formulario.pagamento}
                        onChange={(e) => atualizarForm({ pagamento: e.target.value })}
                      >
                        <option value="">Selecione a forma de pagamento</option>
                        {FORMAS_PAGAMENTO.map((f) => (
                          <option key={f}>{f}</option>
                        ))}
                      </select>
                    </span>
                  </label>
                     <label className="cadd__campo cadd__campo--valor">
                  <span className="cadd__campo-label">Valor da Despesa <span className="cadd__obrigatorio">*</span></span>
                  <span className="cadd__campo-input-wrap">
                    <HiCurrencyDollar className="cadd__campo-icone" />
                    <input
                      type="text"
                      inputMode="numeric"
                      placeholder="R$ 0,00"
                      value={formulario.valorFormatado}
                      onChange={handleValor}
                    />
                  </span>
                </label>
                </div>

                <label className="cadd__campo">
                  <span className="cadd__campo-label">Observações</span>
                  <span className="cadd__campo-input-wrap cadd__campo-input-wrap--textarea">
                    <HiOutlineChatAlt2 className="cadd__campo-icone cadd__campo-icone--topo" />
                    <textarea
                      placeholder="Informações adicionais (opcional)"
                      maxLength={LIMITE_OBSERVACOES}
                      value={formulario.observacoes}
                      onChange={(e) => atualizarForm({ observacoes: e.target.value })}
                    />
                  </span>
                  <span className="cadd__contador">{formulario.observacoes.length}/{LIMITE_OBSERVACOES}</span>
                </label>

                {erro && <p className="cadd__erro">{erro}</p>}

              </div>
            </div>

            {/* Coluna lateral */}
            <div className="cadd__lateral">

              <div className="cadd__card cadd__card--resumo">
                <div className="cadd__card-titulo">
                  <span className="cadd__card-icone">
                    <HiDocumentReport />
                  </span>
                  <h3>Resumo da Despesa</h3>
                </div>
                <ul className="cadd__resumo-lista">
                  <li><span>Descrição</span><strong>{formulario.descricao || '-'}</strong></li>
                  <li><span>Categoria</span><strong>{formulario.categoria || '-'}</strong></li>
                  <li><span>Fornecedor</span><strong>{formulario.fornecedor || '-'}</strong></li>
                  <li><span>Data da Despesa</span><strong>{formatarDataExibicao(formulario.dataISO) || '-'}</strong></li>
                  <li><span>Forma de Pagamento</span><strong>{formulario.pagamento || '-'}</strong></li>
                  <li><span>Valor</span><strong>{formulario.valorNumerico ? formatarPreco(formulario.valorNumerico) : '-'}</strong></li>
                </ul>
                <div className="cadd__aviso">
                  <HiInformationCircle />
                  <p>Após salvar, a despesa será adicionada automaticamente no relatório financeiro do estabelecimento.</p>
                </div>
              </div>

              <div className="cadd__card cadd__card--categorias">
                <div className="cadd__card-titulo">
                  <span className="cadd__card-icone">
                    <HiOutlineTag />
                  </span>
                  <h3>Categorias Disponíveis</h3>
                </div>
                <ul className="cadd__categorias-lista">
                  {categorias.map((c) => (
                    <li key={c.nome}>
                      <span className="cadd__categoria-icone" style={{ color: c.cor, background: `${c.cor}1a` }}>
                        {c.icone}
                      </span>
                      {c.nome}
                    </li>
                  ))}
                </ul>

                {adicionandoCategoria ? (
                  <div className="cadd__nova-categoria">
                    <input
                      type="text"
                      placeholder="Nome da categoria"
                      value={novaCategoriaNome}
                      onChange={(e) => setNovaCategoriaNome(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && handleNovaCategoria()}
                      autoFocus
                    />
                    <button type="button" onClick={handleNovaCategoria} aria-label="Confirmar nova categoria">
                      <HiCheck />
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    className="cadd__btn-nova-categoria"
                    onClick={() => setAdicionandoCategoria(true)}
                  >
                    <HiPlus /> nova categoria
                  </button>
                )}
              </div>

            </div>
          </div>
        )}

        {/* ── PASSO 2 — Resumo e Confirmação ── */}
        {passoAtual === 2 && (
          <div className="cadd__grade">

            <div className="cadd__card cadd__card--principal">
              <div className="cadd__card-titulo">
                <span className="cadd__card-icone">
                  <HiDocumentReport />
                </span>
                <h3>Resumo da Despesa</h3>
              </div>

              <div className="cadd__revisao">
                <div className="cadd__revisao-item">
                  <span className="cadd__revisao-icone"><HiOutlineDocumentText /></span>
                  <span>
                    <span className="cadd__revisao-label">Descrição</span>
                    <span className="cadd__revisao-valor">{formulario.descricao}</span>
                  </span>
                </div>
                <div className="cadd__revisao-item">
                  <span className="cadd__revisao-icone"><HiOutlineCalendar /></span>
                  <span>
                    <span className="cadd__revisao-label">Data da Despesa</span>
                    <span className="cadd__revisao-valor">{formatarDataExibicao(formulario.dataISO)}</span>
                  </span>
                </div>
                <div className="cadd__revisao-item">
                  <span className="cadd__revisao-icone"><HiOutlineTag /></span>
                  <span>
                    <span className="cadd__revisao-label">Categoria</span>
                    <span className="cadd__revisao-valor">{formulario.categoria}</span>
                  </span>
                </div>
                <div className="cadd__revisao-item">
                  <span className="cadd__revisao-icone"><HiOutlineCreditCard /></span>
                  <span>
                    <span className="cadd__revisao-label">Forma de Pagamento</span>
                    <span className="cadd__revisao-valor">{formulario.pagamento}</span>
                  </span>
                </div>
                <div className="cadd__revisao-item">
                  <span className="cadd__revisao-icone"><HiOutlineUser /></span>
                  <span>
                    <span className="cadd__revisao-label">Fornecedor</span>
                    <span className="cadd__revisao-valor">{formulario.fornecedor || '—'}</span>
                  </span>
                </div>
                <div className="cadd__revisao-item">
                  <span className="cadd__revisao-icone"><HiCurrencyDollar /></span>
                  <span>
                    <span className="cadd__revisao-label">Valor</span>
                    <span className="cadd__revisao-valor">{formatarPreco(formulario.valorNumerico)}</span>
                  </span>
                </div>
                <div className="cadd__revisao-item">
                  <span className="cadd__revisao-icone"><HiOutlineOfficeBuilding /></span>
                  <span>
                    <span className="cadd__revisao-label">Estabelecimento</span>
                    <span className="cadd__revisao-valor">{formulario.estabelecimento}</span>
                  </span>
                </div>
                <div className="cadd__revisao-item">
                  <span className="cadd__revisao-icone"><HiOutlineChatAlt2 /></span>
                  <span>
                    <span className="cadd__revisao-label">Observações</span>
                    <span className="cadd__revisao-valor">{formulario.observacoes || '—'}</span>
                  </span>
                </div>
              </div>

              <div className="cadd__aviso cadd__aviso--bloco">
                <HiInformationCircle />
                <p>Após a confirmação, a despesa será registrada no sistema e ficará disponível no histórico e nos relatórios financeiros do estabelecimento.</p>
              </div>
            </div>

            {/* Coluna lateral */}
            <div className="cadd__lateral">

              <div className="cadd__card cadd__card--total">
                <div className="cadd__card-titulo">
                  <span className="cadd__card-icone">
                    <HiCurrencyDollar />
                  </span>
                  <h3>Valor Total</h3>
                </div>
                <p className="cadd__total-valor">{formatarPreco(formulario.valorNumerico)}</p>
                <p className="cadd__total-label">Valor da despesa</p>
              </div>

              <div className="cadd__card cadd__card--categoria-resumo">
                <div className="cadd__card-titulo">
                  <span className="cadd__card-icone">
                    <HiInformationCircle />
                  </span>
                  <h3>Resumo por Categoria</h3>
                </div>
                <div className="cadd__categoria-resumo-item">
                  <span className="cadd__categoria-resumo-anel" />
                  <span>
                    <span className="cadd__categoria-resumo-nome">{formulario.categoria}</span>
                    <span className="cadd__categoria-resumo-qtd">1 despesa</span>
                    <span className="cadd__categoria-resumo-valor">{formatarPreco(formulario.valorNumerico)}</span>
                  </span>
                </div>
              </div>

              <div className="cadd__card cadd__card--pronto">
                <HiOutlineCheckCircle className="cadd__pronto-icone" />
                <div>
                  <p className="cadd__pronto-titulo">Pronto!</p>
                  <p className="cadd__pronto-texto">Tudo certo para finalizar o cadastro da despesa.</p>
                </div>
              </div>

            </div>
          </div>
        )}

        {/* ── Ações do rodapé ── */}
        <div className="cadd__acoes">
          {passoAtual === 1 ? (
            <>
              <button type="button" className="cadd__btn-secundario" onClick={cancelar}>
                Cancelar
              </button>
              <button type="button" className="cadd__btn-primario" onClick={irParaRevisao}>
                Próximo <HiArrowRight />
              </button>
            </>
          ) : (
            <>
              <button type="button" className="cadd__btn-secundario" onClick={voltarParaDados}>
                <HiArrowLeft /> Voltar
              </button>
              <button type="button" className="cadd__btn-primario" onClick={confirmarESalvar}>
                <HiCheck /> Confirmar e Salvar
              </button>
            </>
          )}
        </div>

        {/* ── Popup de sucesso ── */}
        {sucesso && (
          <div className="cadd__popup-overlay" onClick={() => navigate('/restaurante/relatorios')}>
            <div className="cadd__popup" onClick={(e) => e.stopPropagation()}>
              <HiOutlineCheckCircle className="cadd__popup-icone" />
              <h3>Despesa cadastrada com sucesso!</h3>
              <p>A despesa foi registrada e já está disponível nos relatórios financeiros.</p>
              <button className="cadd__btn-primario" onClick={() => navigate('/restaurante/relatorios')}>
                OK
              </button>
            </div>
          </div>
        )}

      </div>
    </RestaurantLayout>
  );
};

export default CadDespesa;