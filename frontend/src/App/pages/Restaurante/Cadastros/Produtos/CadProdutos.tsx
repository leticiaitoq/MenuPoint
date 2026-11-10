import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { HiUpload, HiExclamationCircle, HiX, HiCheckCircle } from 'react-icons/hi';
import RestaurantLayout from '../../../../shared/components/layout/Restaurantelayout';
import CategoriaService, { Categoria } from '../../../../services/categoria.service';
import ProdutoService from '../../../../services/produto.service';
import ContadorCaracteres, { DicaLimite } from '../../../../shared/components/ContadorCaracteres/ContadorCaracteres';
import RecortadorImagem from '../../../../shared/components/RecortadorImagem/RecortadorImagem';
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
  const erroRef = useRef<HTMLDivElement>(null);

  const [form, setForm] = useState<FormProduto>(FORM_INICIAL);
  const [fotoParaAjustar, setFotoParaAjustar] = useState<File | null>(null);

  const [categorias, setCategorias]         = useState<Categoria[]>([]);

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
  // Rola até o aviso quando aparece um erro
  useEffect(() => {
    if (erro) erroRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }, [erro]);

  const atualizarForm = (campo: Partial<FormProduto>) => {
    setForm((prev) => ({ ...prev, ...campo }));
  };

  // ── Lida com o upload da foto (só guarda o arquivo; o envio ao storage
  // acontece no momento de salvar, junto com a criação do produto)
  const handleFoto = (e: React.ChangeEvent<HTMLInputElement>) => {
    const arquivo = e.target.files?.[0];
    e.target.value = ''; // permite escolher o mesmo arquivo de novo
    if (!arquivo) return;

    if (!['image/png', 'image/jpeg', 'image/jpg'].includes(arquivo.type)) {
      setErro('A imagem deve ser JPG ou PNG.');
      return;
    }
    if (arquivo.size > 20 * 1024 * 1024) { // original; é reduzida antes do envio
      setErro('A imagem deve ter no máximo 20MB.');
      return;
    }

    // Abre o editor para o usuário enquadrar a foto; o preview só muda ao confirmar
    setErro('');
    setFotoParaAjustar(arquivo);
  };

  const confirmarFotoAjustada = (recortada: File) => {
    setFotoParaAjustar(null);
    atualizarForm({
      imagem: recortada,
      imagemPreview: URL.createObjectURL(recortada),
    });
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

        {erro && (
          <div className="cadprod__erro" role="alert" ref={erroRef}>
            <HiExclamationCircle className="cadprod__erro-icon" />
            <span>{erro}</span>
            <button
              type="button"
              className="cadprod__erro-fechar"
              onClick={() => setErro('')}
              aria-label="Fechar mensagem"
            >
              <HiX />
            </button>
          </div>
        )}

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
              <RecortadorImagem
                arquivo={fotoParaAjustar}
                titulo="Ajustar foto do produto"
                formato="retangulo"
                proporcao={4 / 3}
                onConfirmar={confirmarFotoAjustada}
                onCancelar={() => setFotoParaAjustar(null)}
              />
              <button className="cadprod__btn-foto" onClick={() => inputFotoRef.current?.click()}>
                <HiUpload /> Alterar foto
              </button>
            </div>

          </div>
        </div>
      </div>
        {sucesso && (
        <div className="cadprod__popup-overlay" onClick={() => setSucesso(false)}>
        <div className="cadprod__popup" onClick={(e) => e.stopPropagation()}>
        <HiCheckCircle className="cadprod__popup-icon" />
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
