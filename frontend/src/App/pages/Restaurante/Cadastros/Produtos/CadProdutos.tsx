import React, { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { HiUpload, HiPlus } from 'react-icons/hi';
import RestaurantLayout from '../../../../shared/components/layout/Restaurantelayout';
import './CadProdutos.css';

// ── Tipos
interface FormProduto {
  nome: string;
  descricao: string;
  categoria: string;
  preco: string;
  disponivel: boolean;
  destaque: boolean;
  imagem: File | null;
  imagemPreview: string;
}

// ── Categorias iniciais (mock)
const CATEGORIAS_INICIAIS = ['Lanches', 'Bebidas', 'Sobremesas'];

const CadProdutos: React.FC = () => {
  const navigate = useNavigate();
  const inputFotoRef = useRef<HTMLInputElement>(null);

  const [form, setForm] = useState<FormProduto>({
    nome:          '',
    descricao:     '',
    categoria:     '',
    preco:         '',
    disponivel:    true,
    destaque:      false,
    imagem:        null,
    imagemPreview: '',
  });

  const [categorias, setCategorias]         = useState<string[]>(CATEGORIAS_INICIAIS);
  const [novaCategoria, setNovaCategoria]   = useState('');
  const [adicionandoCat, setAdicionandoCat] = useState(false);
  const [sucesso, setSucesso] = useState(false);
  const [erro, setErro]                     = useState('');

  // ── Atualiza qualquer campo do form de uma vez
  const atualizarForm = (campo: Partial<FormProduto>) => {
    setForm((prev) => ({ ...prev, ...campo }));
  };

  // ── Lida com o upload da foto
  const handleFoto = (e: React.ChangeEvent<HTMLInputElement>) => {
    const arquivo = e.target.files?.[0];
    if (!arquivo) return;
    atualizarForm({
      imagem: arquivo,
      imagemPreview: URL.createObjectURL(arquivo),
    });
  };

  // ── Adiciona nova categoria
  const handleNovaCategoria = () => {
    const nome = novaCategoria.trim();
    if (!nome || categorias.includes(nome)) return;
    setCategorias((prev) => [...prev, nome]);
    setNovaCategoria('');
    setAdicionandoCat(false);
  };

  // ── Validação e envio
  const handleSalvar = () => {
    if (!form.nome.trim()) { setErro('Informe o nome do produto.'); return; }
    if (!form.categoria)   { setErro('Selecione uma categoria.'); return; }
    if (!form.preco)       { setErro('Informe o preço.'); return; }

  setErro('');
  console.log(form); // substituir por chamada à API
  setSucesso(true);  // abre o popup
};

  const handlePreco = (e: React.ChangeEvent<HTMLInputElement>) => {
  const digits = e.target.value.replace(/\D/g, '');
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
            <button className="cadprod__btn-cancelar" onClick={() => navigate('/restaurante/produtos')}>
              Cancelar
            </button>
            <button className="cadprod__btn-salvar" onClick={handleSalvar}>
              Salvar Produto
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
                value={form.nome}
                onChange={(e) => atualizarForm({ nome: e.target.value })}
              />
            </div>

            {/* Descrição */}
            <div className="cadprod__campo">
              <label className="cadprod__label">Descrição</label>
              <textarea
                className="cadprod__textarea"
                placeholder="Adicione a descrição do seu produto."
                value={form.descricao}
                onChange={(e) => atualizarForm({ descricao: e.target.value })}
              />
            </div>

            {/* Categoria + Preço */}
            <div className="cadprod__linha">
              <div className="cadprod__campo">
                <label className="cadprod__label">Categoria Principal</label>
                <select
                  className="cadprod__select"
                  value={form.categoria}
                  onChange={(e) => atualizarForm({ categoria: e.target.value })}
                >
                  <option value="">Selecione</option>
                  {categorias.map((c) => <option key={c}>{c}</option>)}
                </select>
              </div>

              <div className="cadprod__campo">
                <label className="cadprod__label">Preço</label>
                <input
                  className="cadprod__input"
                  type="text"
                  placeholder="R$ 0,00"
                  value={form.preco}
                  onChange= {handlePreco}
                />
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
                accept="image/*"
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
                  <span key={c} className="cadprod__chip">{c}</span>
                ))}

                {adicionandoCat ? (
                  <div className="cadprod__nova-cat">
                    <input
                      className="cadprod__input cadprod__input--mini"
                      placeholder="Nome"
                      value={novaCategoria}
                      onChange={(e) => setNovaCategoria(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && handleNovaCategoria()}
                      autoFocus
                    />
                    <button className="cadprod__chip-confirmar" onClick={handleNovaCategoria}>✔</button>
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