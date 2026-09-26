import React, { useEffect, useState } from 'react';
import { HiPencil, HiTrash, HiPlus, HiX } from 'react-icons/hi';
import { MdDragIndicator } from 'react-icons/md';
import RestaurantLayout from '../../../../shared/components/layout/Restaurantelayout';
import {
  DndContext, closestCenter, PointerSensor,
  useSensor, useSensors, DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext, verticalListSortingStrategy,
  useSortable, arrayMove,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import CategoriaService, { Categoria } from '../../../../services/categoria.service';
import ProdutoService from '../../../../services/produto.service';
import './GestaoCate.css';

// ── Tipos
interface CategoriaComContagem extends Categoria {
  produtos: number;
}

interface FormCategoria {
  nome: string;
  descricao: string;
  ordem: number;
  ativo: boolean;
}

const FORM_VAZIO: FormCategoria = { nome: '', descricao: '', ordem: 1, ativo: true };

const extrairErro = (err: any, padrao: string): string =>
  err?.response?.data?.message ?? padrao;

interface LinhaProps {
  categoria: CategoriaComContagem;
  onEditar: (categoria: CategoriaComContagem) => void;
  onDeletar: (categoria: CategoriaComContagem) => void;
}

const LinhaCategoria: React.FC<LinhaProps> = ({ categoria, onEditar, onDeletar }) => {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: categoria.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    background: isDragging ? '#fdf0f0' : 'white',
  };

  return (
    <tr ref={setNodeRef} style={style}>
      <td className="cate__td-ordem">
        <MdDragIndicator className="cate__drag-icon" {...attributes} {...listeners} />
        {categoria.ordem}
      </td>
      <td className="cate__td-nome">{categoria.nome}</td>
      <td>{categoria.produtos}</td>
      <td>
        <span className={`cate__badge ${categoria.ativo ? 'cate__badge--ativo' : 'cate__badge--inativo'}`}>
          {categoria.ativo ? 'Ativa' : 'Oculta'}
        </span>
      </td>
      <td className="cate__td-acoes">
        <button className="cate__btn-acao" onClick={() => onEditar(categoria)} aria-label="Editar">
          <HiPencil />
        </button>
        <button className="cate__btn-acao cate__btn-acao--deletar" onClick={() => onDeletar(categoria)} aria-label="Deletar">
          <HiTrash />
        </button>
      </td>
    </tr>
  );
};

const GestaoCate: React.FC = () => {

  const [categorias, setCategorias]           = useState<CategoriaComContagem[]>([]);
  const [carregando, setCarregando]           = useState(true);
  const [modalNovo, setModalNovo]             = useState(false);
  const [modalEditar, setModalEditar]         = useState<CategoriaComContagem | null>(null);
  const [form, setForm]                       = useState<FormCategoria>(FORM_VAZIO);
  const [erro, setErro]                       = useState('');
  const [erroModal, setErroModal]             = useState('');
  const [salvando, setSalvando]               = useState(false);

  const atualizarForm = (campo: Partial<FormCategoria>) =>
    setForm((prev) => ({ ...prev, ...campo }));

  // ── Carrega categorias reais + conta produtos de cada uma
  const carregar = async () => {
    setCarregando(true);
    setErro('');
    try {
      const [listaCategorias, listaProdutos] = await Promise.all([
        CategoriaService.listar(),
        ProdutoService.listar(),
      ]);

      const comContagem: CategoriaComContagem[] = listaCategorias
        .slice()
        .sort((a, b) => a.ordem - b.ordem)
        .map((c) => ({
          ...c,
          produtos: listaProdutos.filter((p) => p.categoria_id === c.id).length,
        }));

      setCategorias(comContagem);
    } catch (err: any) {
      setErro(extrairErro(err, 'Não foi possível carregar as categorias.'));
    } finally {
      setCarregando(false);
    }
  };

  useEffect(() => { carregar(); }, []);

  // ── Abre modal novo
  const abrirModalNovo = () => {
    setForm({ ...FORM_VAZIO, ordem: categorias.length + 1 });
    setErroModal('');
    setModalNovo(true);
  };

  // ── Abre modal editar preenchido
  const abrirModalEditar = (categoria: CategoriaComContagem) => {
    setForm({
      nome:      categoria.nome,
      descricao: categoria.descricao ?? '',
      ordem:     categoria.ordem,
      ativo:     categoria.ativo,
    });
    setErroModal('');
    setModalEditar(categoria);
  };

  // ── Salva nova categoria
  const salvarNova = async () => {
    if (!form.nome.trim()) { setErroModal('Informe o nome da categoria.'); return; }

    setErroModal('');
    setSalvando(true);
    try {
      await CategoriaService.criar({
        nome: form.nome.trim(),
        descricao: form.descricao.trim() || undefined,
        ordem: form.ordem,
        ativo: form.ativo,
      });
      setModalNovo(false);
      await carregar();
    } catch (err: any) {
      setErroModal(extrairErro(err, 'Não foi possível criar a categoria.'));
    } finally {
      setSalvando(false);
    }
  };

  // ── Salva edição
  const salvarEdicao = async () => {
    if (!modalEditar) return;
    if (!form.nome.trim()) { setErroModal('Informe o nome da categoria.'); return; }

    setErroModal('');
    setSalvando(true);
    try {
      await CategoriaService.atualizar(modalEditar.id, {
        nome: form.nome.trim(),
        descricao: form.descricao.trim() || undefined,
        ordem: form.ordem,
        ativo: form.ativo,
      });
      setModalEditar(null);
      await carregar();
    } catch (err: any) {
      setErroModal(extrairErro(err, 'Não foi possível salvar as alterações.'));
    } finally {
      setSalvando(false);
    }
  };

  // ── Desativa/reativa categoria imediatamente (botão no modal editar)
  const alternarAtivaModal = async () => {
    if (!modalEditar) return;
    setErroModal('');
    setSalvando(true);
    try {
      await CategoriaService.atualizar(modalEditar.id, { ativo: !form.ativo });
      setModalEditar(null);
      await carregar();
    } catch (err: any) {
      setErroModal(extrairErro(err, 'Não foi possível alterar o status da categoria.'));
    } finally {
      setSalvando(false);
    }
  };

  // ── Deleta (desativa) categoria a partir da linha da tabela
  const deletarCategoria = async (categoria: CategoriaComContagem) => {
    if (!window.confirm(`Ocultar a categoria "${categoria.nome}"? Os produtos dela deixarão de aparecer no cardápio.`)) {
      return;
    }
    setErro('');
    try {
      await CategoriaService.deletar(categoria.id);
      await carregar();
    } catch (err: any) {
      setErro(extrairErro(err, 'Não foi possível ocultar a categoria.'));
    }
  };

  // ── Drag and drop — grava a nova ordem no backend
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex   = categorias.findIndex((c) => c.id === active.id);
    const newIndex   = categorias.findIndex((c) => c.id === over.id);
    const reordenado = arrayMove(categorias, oldIndex, newIndex).map((c, i) => ({ ...c, ordem: i + 1 }));

    setCategorias(reordenado);

    try {
      await CategoriaService.reordenar(reordenado.map((c) => ({ id: c.id, ordem: c.ordem })));
    } catch {
      setErro('Não foi possível salvar a nova ordem.');
      carregar();
    }
  };

  return (
    <RestaurantLayout>
      <div className="cate">

        {/* ── Cabeçalho ── */}
        <div className="cate__header">
          <h2 className="cate__titulo">Gestão de Categorias</h2>
          <button className="cate__btn-novo" onClick={abrirModalNovo}>
            <HiPlus /> Nova Categoria
          </button>
        </div>

        {/* ── Card ── */}
        <div className="cate__card">
          <div className="cate__card-header">
            <div>
              <h3 className="cate__card-titulo">Gestão de Categorias</h3>
              <p className="cate__subtitulo">Organize as seções do seu cardápio</p>
            </div>
          </div>

          {erro && <p className="cate__erro">{erro}</p>}

          {/* Tabela */}
          {carregando ? (
            <p className="cate__dica">Carregando categorias...</p>
          ) : categorias.length === 0 ? (
            <p className="cate__dica">Nenhuma categoria cadastrada ainda.</p>
          ) : (
            <>
              <div className="cate__tabela-scroll">
              <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                <SortableContext items={categorias.map((c) => c.id)} strategy={verticalListSortingStrategy}>
                  <table className="cate__tabela">
                    <thead>
                      <tr>
                        <th>Ordem</th>
                        <th>Nome da Categoria</th>
                        <th>Produtos</th>
                        <th>Status</th>
                        <th>Ações</th>
                      </tr>
                    </thead>
                    <tbody>
                      {categorias.map((categoria) => (
                        <LinhaCategoria
                          key={categoria.id}
                          categoria={categoria}
                          onEditar={abrirModalEditar}
                          onDeletar={deletarCategoria}
                        />
                      ))}
                    </tbody>
                  </table>
                </SortableContext>
              </DndContext>
              </div>

              <p className="cate__dica">↺ Arraste para mudar a ordem das categorias</p>
            </>
          )}
        </div>

        {/* ── Modal Nova Categoria ── */}
        {modalNovo && (
          <div className="cate__overlay" onClick={() => !salvando && setModalNovo(false)}>
            <div className="cate__modal" onClick={(e) => e.stopPropagation()}>
              <div className="cate__modal-header">
                <h3>Nova Categoria</h3>
                <button className="cate__modal-fechar" onClick={() => setModalNovo(false)} disabled={salvando}>
                  <HiX />
                </button>
              </div>

              <div className="cate__modal-corpo">
                <div className="cate__campo">
                  <label className="cate__label">Nome da categoria</label>
                  <input className="cate__input" value={form.nome} onChange={(e) => atualizarForm({ nome: e.target.value })} />
                </div>

                <div className="cate__campo">
                  <label className="cate__label">Descrição <span className="cate__opcional">(opcional)</span></label>
                  <input className="cate__input" value={form.descricao} onChange={(e) => atualizarForm({ descricao: e.target.value })} />
                </div>

                <div className="cate__campo">
                  <label className="cate__label">Ordem de exibição</label>
                  <input className="cate__input cate__input--pequeno" type="number" value={form.ordem} onChange={(e) => atualizarForm({ ordem: Number(e.target.value) })} />
                </div>

                <div className="cate__campo">
                  <label className="cate__label">Status</label>
                  <div className="cate__radio-grupo">
                    <label className="cate__radio-label">
                      <input type="radio" name="status-novo" checked={form.ativo} onChange={() => atualizarForm({ ativo: true })} />
                      <span className={`cate__radio-check ${form.ativo ? 'cate__radio-check--ativo' : ''}`} />
                      Ativa
                    </label>
                    <label className="cate__radio-label">
                      <input type="radio" name="status-novo" checked={!form.ativo} onChange={() => atualizarForm({ ativo: false })} />
                      <span className={`cate__radio-check ${!form.ativo ? 'cate__radio-check--ativo' : ''}`} />
                      Oculta
                    </label>
                  </div>
                </div>

                {erroModal && <p className="cate__erro">{erroModal}</p>}
              </div>

              <div className="cate__modal-acoes cate__modal-acoes--direita">
                <button className="cate__btn-cancelar" onClick={() => setModalNovo(false)} disabled={salvando}>Cancelar</button>
                <button className="cate__btn-salvar" onClick={salvarNova} disabled={salvando}>
                  {salvando ? 'Salvando...' : 'Salvar'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ── Modal Editar Categoria ── */}
        {modalEditar && (
          <div className="cate__overlay" onClick={() => !salvando && setModalEditar(null)}>
            <div className="cate__modal" onClick={(e) => e.stopPropagation()}>
              <div className="cate__modal-header">
                <h3>Editar Categoria</h3>
                <button className="cate__modal-fechar" onClick={() => setModalEditar(null)} disabled={salvando}>
                  <HiX />
                </button>
              </div>

              <div className="cate__modal-corpo">
                <div className="cate__campo">
                  <label className="cate__label">Nome da categoria</label>
                  <input className="cate__input" value={form.nome} onChange={(e) => atualizarForm({ nome: e.target.value })} />
                </div>

                <div className="cate__campo">
                  <label className="cate__label">Descrição</label>
                  <input className="cate__input" value={form.descricao} onChange={(e) => atualizarForm({ descricao: e.target.value })} />
                </div>

                <div className="cate__campo">
                  <label className="cate__label">Ordem de exibição</label>
                  <input className="cate__input cate__input--pequeno" type="number" value={form.ordem} onChange={(e) => atualizarForm({ ordem: Number(e.target.value) })} />
                </div>

                <div className="cate__campo">
                  <label className="cate__label">Status</label>
                  <div className="cate__radio-grupo">
                    <label className="cate__radio-label">
                      <input type="radio" name="status-edit" checked={form.ativo} onChange={() => atualizarForm({ ativo: true })} />
                      <span className={`cate__radio-check ${form.ativo ? 'cate__radio-check--ativo' : ''}`} />
                      Ativa
                    </label>
                    <label className="cate__radio-label">
                      <input type="radio" name="status-edit" checked={!form.ativo} onChange={() => atualizarForm({ ativo: false })} />
                      <span className={`cate__radio-check ${!form.ativo ? 'cate__radio-check--ativo' : ''}`} />
                      Oculta
                    </label>
                  </div>
                </div>

                {erroModal && <p className="cate__erro">{erroModal}</p>}
              </div>

              <div className="cate__modal-acoes cate__modal-acoes--tres">
                <button className="cate__btn-desativar" onClick={alternarAtivaModal} disabled={salvando}>
                  {form.ativo ? 'Desativar' : 'Reativar'}
                </button>
                <button className="cate__btn-cancelar" onClick={() => setModalEditar(null)} disabled={salvando}>Cancelar</button>
                <button className="cate__btn-salvar" onClick={salvarEdicao} disabled={salvando}>
                  <HiPlus /> {salvando ? 'Salvando...' : 'Salvar'}
                </button>
              </div>
            </div>
          </div>
        )}

      </div>
    </RestaurantLayout>
  );
};

export default GestaoCate;
