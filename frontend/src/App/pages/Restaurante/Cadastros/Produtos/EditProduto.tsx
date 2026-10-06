import React, { useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { HiUpload } from 'react-icons/hi';
import RestaurantLayout from '../../../../shared/components/layout/Restaurantelayout';
import CategoriaService, { Categoria } from '../../../../services/categoria.service';
import ProdutoService from '../../../../services/produto.service';
import ContadorCaracteres, { DicaLimite } from '../../../../shared/components/ContadorCaracteres/ContadorCaracteres';
import './EditProduto.css';

// ── Tipos
interface FormEdicao {
  nome: string;
  descricao: string;
  categoria_id: string;
  preco: string;
  disponivel: boolean;
  destaque: boolean;
  imagemPreview: string;
  imagem: File | null;
}

const FORM_VAZIO: FormEdicao = {
  nome:          '',
  descricao:     '',
  categoria_id:  '',
  preco:         '',
  disponivel:    true,
  destaque:      false,
  imagemPreview: '',
  imagem:        null,
};

const precoParaNumero = (preco: string): number =>
  Number(preco.replace(/[^\d,]/g, '').replace(',', '.'));

const formatarPreco = (valor: number): string =>
  `R$ ${valor.toFixed(2).replace('.', ',')}`;

const EditProduto: React.FC = () => {
  const navigate  = useNavigate();
  const { id }    = useParams(); // id vindo da rota /editar/:id
  const fotoRef   = useRef<HTMLInputElement>(null);

  const [form, setForm]     = useState<FormEdicao>(FORM_VAZIO);
  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [erro, setErro]       = useState('');
  const [sucesso, setSucesso] = useState(false);
  const [carregando, setCarregando] = useState(true);
  const [falhaCarregar, setFalhaCarregar] = useState(false);
  const [salvando, setSalvando]     = useState(false);

  // ── Carrega o produto real e as categorias do estabelecimento
  useEffect(() => {
    if (!id) {
      setErro('Produto não informado.');
      setFalhaCarregar(true);
      setCarregando(false);
      return;
    }

    (async () => {
      try {
        const [produto, listaCategorias] = await Promise.all([
          ProdutoService.buscarPorId(id),
          CategoriaService.listar(),
        ]);

        setCategorias(listaCategorias);
        setForm({
          nome:          produto.nome,
          descricao:     produto.descricao ?? '',
          categoria_id:  produto.categoria_id,
          preco:         formatarPreco(produto.preco),
          disponivel:    produto.disponivel,
          destaque:      produto.destaque,
          imagemPreview: produto.imagem_url ?? '',
          imagem:        null,
        });
      } catch (err: any) {
        setErro(err?.response?.data?.message ?? 'Não foi possível carregar o produto.');
        setFalhaCarregar(true);
      } finally {
        setCarregando(false);
      }
    })();
  }, [id]);

  const atualizarForm = (campo: Partial<FormEdicao>) =>
    setForm((prev) => ({ ...prev, ...campo }));

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

  const handlePreco = (e: React.ChangeEvent<HTMLInputElement>) => {
    // Máx. 8 dígitos (até R$ 999.999,99)
    const digits   = e.target.value.replace(/\D/g, '').slice(0, 8);
    const valor    = (Number(digits) / 100).toFixed(2);
    const formatado = `R$ ${valor.replace('.', ',')}`;
    atualizarForm({ preco: formatado });
  };

  const handleSalvar = async () => {
    if (!id) return;

    if (!form.nome.trim())  { setErro('Informe o nome do produto.'); return; }
    if (!form.categoria_id) { setErro('Selecione uma categoria.'); return; }

    const preco = precoParaNumero(form.preco);
    if (!form.preco || !(preco > 0)) { setErro('Informe um preço válido.'); return; }

    setErro('');
    setSalvando(true);

    try {
      let imagem_url: string | undefined;

      if (form.imagem) {
        imagem_url = await ProdutoService.uploadImagem(form.imagem);
      }

      await ProdutoService.atualizar(id, {
        nome: form.nome.trim(),
        descricao: form.descricao.trim() || null, // null limpa a descrição no banco
        categoria_id: form.categoria_id,
        preco,
        disponivel: form.disponivel,
        destaque: form.destaque,
        ...(imagem_url && { imagem_url }),
      });

      setSucesso(true);
    } catch (err: any) {
      setErro(err?.response?.data?.message ?? 'Não foi possível salvar as alterações.');
    } finally {
      setSalvando(false);
    }
  };

  if (carregando) {
    return (
      <RestaurantLayout>
        <div className="editprod">
          <p>Carregando produto...</p>
        </div>
      </RestaurantLayout>
    );
  }

  if (falhaCarregar) {
    return (
      <RestaurantLayout>
        <div className="editprod">
          <p className="editprod__erro">{erro}</p>
          <div className="editprod__acoes">
            <button className="editprod__btn-cancelar" onClick={() => navigate('/restaurante/produtos')}>
              Voltar
            </button>
          </div>
        </div>
      </RestaurantLayout>
    );
  }

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
          <div className="editprod__campo">
            <div className="editprod__linha-nome">
              <span className="editprod__label-inline">Nome do Produto</span>
              <input
                className="editprod__input-inline"
                type="text"
                maxLength={150}
                value={form.nome}
                onChange={(e) => atualizarForm({ nome: e.target.value })}
              />
            </div>
            <ContadorCaracteres valor={form.nome} max={150} />
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
                accept="image/png, image/jpeg"
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
                  maxLength={500}
                  value={form.descricao}
                  onChange={(e) => atualizarForm({ descricao: e.target.value })}
                />
                <ContadorCaracteres valor={form.descricao} max={500} />
              </div>

              <div className="editprod__campo">
                <p className="editprod__label">Categoria</p>
                <select
                  className="editprod__select"
                  value={form.categoria_id}
                  onChange={(e) => atualizarForm({ categoria_id: e.target.value })}
                >
                  <option value="">Selecione</option>
                  {categorias.map((c) => (
                    <option key={c.id} value={c.id}>{c.nome}</option>
                  ))}
                </select>
              </div>
            </div>

          </div>

          {/* Preço */}
          <div className="editprod__campo">
            <div className="editprod__linha-nome">
              <span className="editprod__label-inline">Preço</span>
              <input
                className="editprod__input-inline"
                type="text"
                value={form.preco}
                onChange={handlePreco}
              />
            </div>
            <DicaLimite>Máx. R$ 999.999,99</DicaLimite>
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

          {/* Destaque */}
          <div className="editprod__campo">
            <p className="editprod__label">Destaque no cardápio?</p>
            <label className="editprod__toggle-label">
              <input
                type="checkbox"
                className="editprod__toggle-input"
                checked={form.destaque}
                onChange={(e) => atualizarForm({ destaque: e.target.checked })}
              />
              <span className="editprod__toggle-slider" />
            </label>
          </div>

          {/* Erro */}
          {erro && <p className="editprod__erro">{erro}</p>}

          {/* Ações */}
          <div className="editprod__acoes">
            <button className="editprod__btn-cancelar" onClick={() => navigate('/restaurante/produtos')} disabled={salvando}>
              Cancelar
            </button>
            <button className="editprod__btn-salvar" onClick={handleSalvar} disabled={salvando}>
              {salvando ? 'Salvando...' : 'Salvar'}
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
