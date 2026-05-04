import React, { useState, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { HiUpload } from 'react-icons/hi';
import RestaurantLayout from '../../../../shared/components/layout/Restaurantelayout';
import './EditProduto.css';

// ── Tipos
interface FormEdicao {
  nome: string;
  descricao: string;
  categoria: string;
  preco: string;
  estoqueIlimitado: boolean;
  quantidadeEstoque: string;
  disponivel: boolean;
  imagemPreview: string;
  imagem: File | null;
}

const CATEGORIAS = ['Entradas', 'Pratos Principais', 'Bebidas', 'Sobremesas'];

// ── Mock do produto carregado (substituir por chamada à API usando o id)
const PRODUTO_MOCK: FormEdicao = {
  nome:              'Pizza Calabresa',
  descricao:         'Deliciosa pizza de calabresa com queijo derretido e cebola.',
  categoria:         'Pratos Principais',
  preco:             'R$ 49,90',
  estoqueIlimitado:  false,
  quantidadeEstoque: '20',
  disponivel:        true,
  imagemPreview:     '/images/pizza.png',
  imagem:            null,
};

const EditProduto: React.FC = () => {
  const navigate  = useNavigate();
  const { id }    = useParams(); // id vindo da rota /editar/:id
  const fotoRef   = useRef<HTMLInputElement>(null);

  // Carrega o mock — futuramente buscar da API pelo id
  const [form, setForm]     = useState<FormEdicao>(PRODUTO_MOCK);
  const [erro, setErro]     = useState('');
  const [sucesso, setSucesso] = useState(false);

  const atualizarForm = (campo: Partial<FormEdicao>) =>
    setForm((prev) => ({ ...prev, ...campo }));

const handleFoto = (e: React.ChangeEvent<HTMLInputElement>) => {
    const arquivo = e.target.files?.[0];
    if (!arquivo) return;
    atualizarForm({
      imagem: arquivo,
      imagemPreview: URL.createObjectURL(arquivo),
    });
  };

  const handlePreco = (e: React.ChangeEvent<HTMLInputElement>) => {
    const digits   = e.target.value.replace(/\D/g, '');
    const valor    = (Number(digits) / 100).toFixed(2);
    const formatado = `R$ ${valor.replace('.', ',')}`;
    atualizarForm({ preco: formatado });
  };

  const handleSalvar = () => {
    if (!form.nome.trim())     { setErro('Informe o nome do produto.'); return; }
    if (!form.categoria)       { setErro('Selecione uma categoria.'); return; }
    if (!form.preco)           { setErro('Informe o preço.'); return; }
    if (!form.estoqueIlimitado && !form.quantidadeEstoque) {
      setErro('Informe a quantidade em estoque.');
      return;
    }

    setErro('');
    console.log({ id, ...form }); // substituir por chamada à API
    setSucesso(true);
  };

  return (
    <RestaurantLayout>
      <div className="editprod">

        {/* ── Cabeçalho ── */}
        <div className="editprod__header">
          <h2 className="editprod__titulo">Editar Produtos</h2>
          <p className="editprod__breadcrumb">
            Produtos &gt; <strong>Editar Produto</strong>
          </p>
        </div>

        {/* ── Card principal ── */}
        <div className="editprod__card">

          {/* Nome */}
          <div className="editprod__linha-nome">
            <span className="editprod__label-inline">Nome do Produto</span>
            <input
              className="editprod__input-inline"
              type="text"
              value={form.nome}
              onChange={(e) => atualizarForm({ nome: e.target.value })}
            />
          </div>

          {/* Foto + Descrição + Categoria */}
          <div className="editprod__secao-meio">

            {/* Foto */}
            <div className="editprod__foto-col">
              <p className="editprod__label">Foto do Produto</p>
              <div className="editprod__foto-wrap">
                <img
                  src={form.imagemPreview || '/images/placeholder.png'}
                  alt="Foto do produto"
                  className="editprod__foto"
                />
              </div>
              <input
                ref={fotoRef}
                type="file"
                accept="image/*"
                style={{ display: 'none' }}
                onChange={handleFoto}
              />
              <button className="editprod__btn-foto" onClick={() => fotoRef.current?.click()}>
                <HiUpload /> Alterar Imagem
              </button>
            </div>

            {/* Descrição + Categoria */}
            <div className="editprod__desc-col">
              <div className="editprod__campo">
                <p className="editprod__label">Descrição do Produto</p>
                <input
                  className="editprod__input"
                  type="text"
                  value={form.descricao}
                  onChange={(e) => atualizarForm({ descricao: e.target.value })}
                />
              </div>

              <div className="editprod__campo">
                <p className="editprod__label">Categoria</p>
                <select
                  className="editprod__select"
                  value={form.categoria}
                  onChange={(e) => atualizarForm({ categoria: e.target.value })}
                >
                  <option value="">Selecione</option>
                  {CATEGORIAS.map((c) => <option key={c}>{c}</option>)}
                </select>
              </div>
            </div>

          </div>

          {/* Preço */}
          <div className="editprod__linha-nome">
            <span className="editprod__label-inline">Preço</span>
            <input
              className="editprod__input-inline"
              type="text"
              value={form.preco}
              onChange={handlePreco}
            />
          </div>

          {/* Estoque */}
          <div className="editprod__estoque">
            <span className="editprod__label">Estoque:</span>

            <label className="editprod__radio-label">
              <input
                type="radio"
                name="estoque"
                checked={form.estoqueIlimitado}
                onChange={() => atualizarForm({ estoqueIlimitado: true })}
              />
              Ilimitado
            </label>

            <label className="editprod__toggle-label">
              <input
                type="checkbox"
                className="editprod__toggle-input"
                checked={!form.estoqueIlimitado}
                onChange={(e) => atualizarForm({ estoqueIlimitado: !e.target.checked })}
              />
              <span className="editprod__toggle-slider" />
              Limitado
            </label>

            {!form.estoqueIlimitado && (
              <>
               <span className="editprod__label editprod__label--direita">Estoque de Produtos</span>
                <input
                  className="editprod__input-qtd"
                  type="number"
                  value={form.quantidadeEstoque}
                  onChange={(e) => atualizarForm({ quantidadeEstoque: e.target.value })}
                />
                <span className="editprod__label">Em estoque</span>
              </>
            )}
          </div>

          {/* Disponível */}
          <div className="editprod__campo">
            <p className="editprod__label">Disponível?</p>
            <label className="editprod__toggle-label">
              <input
                type="checkbox"
                className="editprod__toggle-input"
                checked={form.disponivel}
                onChange={(e) => atualizarForm({ disponivel: e.target.checked })}
              />
              <span className="editprod__toggle-slider" />
            </label>
          </div>

          {/* Erro */}
          {erro && <p className="editprod__erro">{erro}</p>}

          {/* Ações */}
          <div className="editprod__acoes">
            <button className="editprod__btn-cancelar" onClick={() => navigate('/restaurante/menu/products')}>
              Cancelar
            </button>
            <button className="editprod__btn-salvar" onClick={handleSalvar}>
              Salvar
            </button>
          </div>

        </div>
      </div>

      {/* ── Popup de sucesso ── */}
      {sucesso && (
        <div className="editprod__popup-overlay" onClick={() => setSucesso(false)}>
          <div className="editprod__popup" onClick={(e) => e.stopPropagation()}>
            <span className="editprod__popup-icon">✅</span>
            <h3>Produto atualizado com sucesso!</h3>
            <p>As alterações foram salvas no cardápio.</p>
            <button
              className="editprod__btn-salvar"
              onClick={() => navigate('/restaurante/produtos')}
            >
              OK
            </button>
          </div>
        </div>
      )}

    </RestaurantLayout>
  );
};

export default EditProduto;