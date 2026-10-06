import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { HiUpload, HiPlus } from 'react-icons/hi';
import RestaurantLayout from '../../../../shared/components/layout/Restaurantelayout';
import CategoriaService, { Categoria } from '../../../../services/categoria.service';
import ProdutoService from '../../../../services/produto.service';
import SeletorCategoria from '../../../../shared/components/SeletorCategoria/SeletorCategoria';
import ContadorCaracteres, { DicaLimite } from '../../../../shared/components/ContadorCaracteres/ContadorCaracteres';
import {
  SELECAO_VAZIA, SelecaoCategoria, resolverSelecao, validarSelecao,
} from '../../../../shared/constants/categoriasPadrao';
import './CadProdutos.css';

// ── Tipos
interface FormProduto {
  nome: string;
  descricao: string;
  categoria_id: string;
  preco: string;
  disponivel: boolean;
  destaque: boolean;
  imagem: File | null;
  imagemPreview: string;
}

const FORM_INICIAL: FormProduto = {
  nome:          '',
  descricao:     '',
  categoria_id:  '',
  preco:         '',
  disponivel:    true,
  destaque:      false,
  imagem:        null,
  imagemPreview: '',
};

// Converte "R$ 49,90" -> 49.9
const precoParaNumero = (preco: string): number =>
  Number(preco.replace(/[^\d,]/g, '').replace(',', '.'));

const CadProdutos: React.FC = () => {
  const navigate = useNavigate();
  const inputFotoRef = useRef<HTMLInputElement>(null);

  const [form, setForm] = useState<FormProduto>(FORM_INICIAL);

  const [categorias, setCategorias]         = useState<Categoria[]>([]);
  const [novaCategoria, setNovaCategoria]   = useState<SelecaoCategoria>(SELECAO_VAZIA);
  const [adicionandoCat, setAdicionandoCat] = useState(false);
  const [criandoCategoria, setCriandoCategoria] = useState(false);

  const [sucesso, setSucesso] = useState(false);
  const [erro, setErro]       = useState('');
  const [salvando, setSalvando] = useState(false);
  const [carregandoCategorias, setCarregandoCategorias] = useState(true);

  // ── Carrega as categorias reais do estabelecimento logado
  useEffect(() => {
    (async () => {
      try {
        const lista = await CategoriaService.listar();
        setCategorias(lista);
      } catch {
        setErro('Não foi possível carregar as categorias.');
      } finally {
        setCarregandoCategorias(false);
      }
    })();
  }, []);

  // ── Atualiza qualquer campo do form de uma vez
  const atualizarForm = (campo: Partial<FormProduto>) => {
    setForm((prev) => ({ ...prev, ...campo }));
  };

  // ── Lida com o upload da foto (só guarda o arquivo; o envio ao storage
  // acontece no momento de salvar, junto com a criação do produto)
  const handleFoto = (e: React.ChangeEvent<HTMLInputElement>) => {
    const arquivo = e.target.files?.[0];
    if (!arquivo) return;

    if (!['image/png', 'image/jpeg', 'image/jpg'].includes(arquivo.type)) {
      setErro('A imagem deve ser JPG ou PNG.');
      return;
    }
    if (arquivo.size > 5 * 1024 * 1024) {
      setErro('A imagem deve ter no máximo 5MB.');
      return;
    }

    setErro('');
    atualizarForm({
      imagem: arquivo,
      imagemPreview: URL.createObjectURL(arquivo),
    });
  };

  // ── Cria uma nova categoria de verdade no backend
  const handleNovaCategoria = async () => {
    const erroNome = validarSelecao(novaCategoria, categorias.map((c) => c.nome));
    if (erroNome) { setErro(erroNome); return; }
    const { nome, icone } = resolverSelecao(novaCategoria);

    setCriandoCategoria(true);
    setErro('');
    try {
      const categoria = await CategoriaService.criar({ nome, ...(icone ? { icone } : {}) });
      setCategorias((prev) => [...prev, categoria]);
      atualizarForm({ categoria_id: categoria.id });
      setNovaCategoria(SELECAO_VAZIA);
      setAdicionandoCat(false);
    } catch (err: any) {
      setErro(err?.response?.data?.message ?? 'Não foi possível criar a categoria.');
    } finally {
      setCriandoCategoria(false);
    }
  };

  // ── Validação e envio
  const handleSalvar = async () => {
    if (!form.nome.trim())        { setErro('Informe o nome do produto.'); return; }
    if (!form.categoria_id)       { setErro('Selecione uma categoria.'); return; }

    const preco = precoParaNumero(form.preco);
    if (!form.preco || !(preco > 0)) { setErro('Informe um preço válido.'); return; }

    setErro('');
    setSalvando(true);

    try {
      let imagem_url: string | undefined;

      if (form.imagem) {
        imagem_url = await ProdutoService.uploadImagem(form.imagem);
      }

      await ProdutoService.criar({
        nome: form.nome.trim(),
        descricao: form.descricao.trim() || undefined,
        categoria_id: form.categoria_id,
        preco,
        disponivel: form.disponivel,
        destaque: form.destaque,
        ...(imagem_url && { imagem_url }),
      });

      setSucesso(true);
    } catch (err: any) {
      setErro(err?.response?.data?.message ?? 'Não foi possível salvar o produto.');
    } finally {
      setSalvando(false);
    }
  };

  const handlePreco = (e: React.ChangeEvent<HTMLInputElement>) => {
    // Máx. 8 dígitos (até R$ 999.999,99)
    const digits = e.target.value.replace(/\D/g, '').slice(0, 8);
    const valor = (Number(digits) / 100).toFixed(2);
    const formatado = `R$ ${valor.replace('.', ',')}`;
    atualizarForm({ preco: formatado });
  };

  return (
    <RestaurantLayout>
      <div className="cadprod">

        {/* ── Cabeçalho ── */}
        <div className="cadprod__header">
          <div>
            <h2 className="cadprod__titulo">Cadastrar Produtos</h2>
            <p className="cadprod__breadcrumb">
              Produtos &gt; <strong>Novo Produto</strong>
            </p>
          </div>
          <div className="cadprod__header-acoes">
            <button className="cadprod__btn-cancelar" onClick={() => navigate('/restaurante/produtos')} disabled={salvando}>
              Cancelar
            </button>
            <button className="cadprod__btn-salvar" onClick={handleSalvar} disabled={salvando}>
              {salvando ? 'Salvando...' : 'Salvar Produto'}
            </button>
          </div>
        </div>

        {/* ── Card principal ── */}
        <div className="cadprod__card">

          {/* Coluna esquerda */}
          <div className="cadprod__col-esquerda">

            {/* Nome */}
            <div className="cadprod__campo">
              <label className="cadprod__label">Nome do produto</label>
              <input
                className="cadprod__input"
                type="text"
                placeholder="Nome"
                maxLength={150}
                value={form.nome}
                onChange={(e) => atualizarForm({ nome: e.target.value })}
              />
              <ContadorCaracteres valor={form.nome} max={150} />
            </div>

            {/* Descrição */}
            <div className="cadprod__campo">
              <label className="cadprod__label">Descrição</label>
              <textarea
                className="cadprod__textarea"
                placeholder="Adicione a descrição do seu produto."
                maxLength={500}
                value={form.descricao}
                onChange={(e) => atualizarForm({ descricao: e.target.value })}
              />
              <ContadorCaracteres valor={form.descricao} max={500} />
            </div>

            {/* Categoria + Preço */}
            <div className="cadprod__linha">
              <div className="cadprod__campo">
                <label className="cadprod__label">Categoria Principal</label>
                <select
                  className="cadprod__select"
                  value={form.categoria_id}
                  onChange={(e) => atualizarForm({ categoria_id: e.target.value })}
                  disabled={carregandoCategorias}
                >
                  <option value="">
                    {carregandoCategorias ? 'Carregando...' : 'Selecione'}
                  </option>
                  {categorias.map((c) => (
                    <option key={c.id} value={c.id}>{c.nome}</option>
                  ))}
                </select>
              </div>

              <div className="cadprod__campo">
                <label className="cadprod__label">Preço</label>
                <input
                  className="cadprod__input"
                  type="text"
                  placeholder="R$ 0,00"
                  value={form.preco}
                  onChange={handlePreco}
                />
                <DicaLimite>Máx. R$ 999.999,99</DicaLimite>
              </div>
            </div>

            {/* Toggle Disponível */}
            <div className="cadprod__campo">
              <label className="cadprod__label">Disponível</label>
              <label className="cadprod__toggle-label">
                <input
                  type="checkbox"
                  className="cadprod__toggle-input"
                  checked={form.disponivel}
                  onChange={(e) => atualizarForm({ disponivel: e.target.checked })}
                />
                <span className="cadprod__toggle-slider" />
                Produto disponível para venda
              </label>
            </div>

            {/* Checkbox Destaque */}
            <div className="cadprod__campo">
              <label className="cadprod__label">Destaque</label>
              <label className="cadprod__checkbox-label">
                <input
                  type="checkbox"
                  checked={form.destaque}
                  onChange={(e) => atualizarForm({ destaque: e.target.checked })}
                />
                Marcar como destaque no cardápio
              </label>
            </div>

            {/* Erro */}
            {erro && <p className="cadprod__erro">{erro}</p>}

          </div>

          {/* Coluna direita */}
          <div className="cadprod__col-direita">

            {/* Foto */}
            <div className="cadprod__campo">
              <label className="cadprod__label">Foto do produto</label>
              <div className="cadprod__foto-wrap">
                {form.imagemPreview
                  ? <img src={form.imagemPreview} alt="Preview" className="cadprod__foto-preview" />
                  : <div className="cadprod__foto-placeholder">Nenhuma foto selecionada</div>
                }
              </div>
              <input
                ref={inputFotoRef}
                type="file"
                accept="image/png, image/jpeg"
                style={{ display: 'none' }}
                onChange={handleFoto}
              />
              <button className="cadprod__btn-foto" onClick={() => inputFotoRef.current?.click()}>
                <HiUpload /> Alterar foto
              </button>
            </div>

            {/* Chips de categorias */}
            <div className="cadprod__campo">
              <label className="cadprod__label">Categorias</label>
              <div className="cadprod__chips">
                {categorias.map((c) => (
                  <span
                    key={c.id}
                    className={`cadprod__chip${form.categoria_id === c.id ? ' cadprod__chip--ativo' : ''}`}
                    onClick={() => atualizarForm({ categoria_id: c.id })}
                  >
                    {c.nome}
                  </span>
                ))}

                {adicionandoCat ? (
                  <div className="cadprod__nova-cat">
                    <SeletorCategoria
                      id="cadprod-nova-cat"
                      valor={novaCategoria}
                      onChange={setNovaCategoria}
                      jaUsadas={categorias.map((c) => c.nome)}
                      desabilitado={criandoCategoria}
                      selectClassName="cadprod__select cadprod__select--mini"
                      inputClassName="cadprod__input cadprod__input--mini cadprod__input--larga"
                      onEnter={handleNovaCategoria}
                      autoFocus
                    />
                    <button className="cadprod__chip-confirmar" onClick={handleNovaCategoria} disabled={criandoCategoria}>✔</button>
                    <button
                      className="cadprod__chip-cancelar"
                      onClick={() => { setAdicionandoCat(false); setNovaCategoria(SELECAO_VAZIA); }}
                      disabled={criandoCategoria}
                      aria-label="Cancelar"
                    >✕</button>
                  </div>
                ) : (
                  <button className="cadprod__chip-novo" onClick={() => setAdicionandoCat(true)}>
                    <HiPlus /> Nova categoria
                  </button>
                )}
              </div>
            </div>

          </div>
        </div>
      </div>
        {sucesso && (
        <div className="cadprod__popup-overlay" onClick={() => setSucesso(false)}>
        <div className="cadprod__popup" onClick={(e) => e.stopPropagation()}>
        <span className="cadprod__popup-icon">✅</span>
        <h3>Produto salvo com sucesso!</h3>
        <p>O produto foi adicionado ao cardápio.</p>
        <button
        className="cadprod__btn-salvar"
        onClick={() => navigate('/restaurante/produtos')} >
        OK
        </button>
       </div>
       </div>
        )}
  </RestaurantLayout>
  );
};

export default CadProdutos;
