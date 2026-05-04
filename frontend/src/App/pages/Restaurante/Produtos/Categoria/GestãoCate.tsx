import React, { useState } from 'react';
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
import './GestãoCate.css';

// ── Tipos
interface Categoria {
  id: string;
  ordem: number;
  nome: string;
  descricao: string;
  produtos: number;
  ativa: boolean;
}

interface FormCategoria {
  nome: string;
  descricao: string;
  ordem: number;
  ativa: boolean;
}

// ── Mock (substituir por API futuramente)
const CATEGORIAS_MOCK: Categoria[] = [
  { id: 'c1', ordem: 1, nome: 'Entradas',         descricao: 'Aperitivos e porções', produtos: 6,  ativa: true },
  { id: 'c2', ordem: 2, nome: 'Pratos Principais', descricao: 'Pratos completos',    produtos: 12, ativa: true },
  { id: 'c3', ordem: 3, nome: 'Bebidas',           descricao: 'Bebidas em geral',    produtos: 8,  ativa: true },
  { id: 'c4', ordem: 4, nome: 'Sobremesas',        descricao: 'Doces e sobremesas',  produtos: 4,  ativa: true },
];

const FORM_VAZIO: FormCategoria = { nome: '', descricao: '', ordem: 1, ativa: true };

interface LinhaProps {
  categoria: Categoria;
  onEditar: (categoria: Categoria) => void;
  onDeletar: (id: string) => void;
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
        <span className={`cate__badge ${categoria.ativa ? 'cate__badge--ativo' : 'cate__badge--inativo'}`}>
          {categoria.ativa ? 'Ativa' : 'Oculta'}
        </span>
      </td>
      <td className="cate__td-acoes">
        <button className="cate__btn-acao" onClick={() => onEditar(categoria)} aria-label="Editar">
          <HiPencil />
        </button>
        <button className="cate__btn-acao cate__btn-acao--deletar" onClick={() => onDeletar(categoria.id)} aria-label="Deletar">
          <HiTrash />
        </button>
      </td>
    </tr>
  );
};

const GestãoCate: React.FC = () => {

  const [categorias, setCategorias]           = useState<Categoria[]>(CATEGORIAS_MOCK);
  const [modalNovo, setModalNovo]             = useState(false);
  const [modalEditar, setModalEditar]         = useState<Categoria | null>(null);
  const [form, setForm]                       = useState<FormCategoria>(FORM_VAZIO);
  const [erro, setErro]                       = useState('');

  const atualizarForm = (campo: Partial<FormCategoria>) =>
    setForm((prev) => ({ ...prev, ...campo }));

// ── Abre modal novo
  const abrirModalNovo = () => {
    setForm({ ...FORM_VAZIO, ordem: categorias.length + 1 });
    setErro('');
    setModalNovo(true);
  };

  // ── Abre modal editar preenchido
  const abrirModalEditar = (categoria: Categoria) => {
    setForm({
      nome:     categoria.nome,
      descricao: categoria.descricao,
      ordem:    categoria.ordem,
      ativa:    categoria.ativa,
    });
    setErro('');
    setModalEditar(categoria);
  };

  // ── Salva nova categoria
  const salvarNova = () => {
    if (!form.nome.trim()) { setErro('Informe o nome da categoria.'); return; }
    const nova: Categoria = {
      id:       `c${Date.now()}`,
      ordem:    form.ordem,
      nome:     form.nome,
      descricao: form.descricao,
      produtos:  0,
      ativa:    form.ativa,
    };
    setCategorias((prev) => [...prev, nova]);
    setModalNovo(false);
  };

  // ── Salva edição
  const salvarEdicao = () => {
    if (!form.nome.trim()) { setErro('Informe o nome da categoria.'); return; }
    setCategorias((prev) =>
      prev.map((c) =>
        c.id === modalEditar?.id
          ? { ...c, nome: form.nome, descricao: form.descricao, ordem: form.ordem, ativa: form.ativa }
          : c
      )
    );
    setModalEditar(null);
  };

  // ── Desativa categoria (botão Desativar no modal editar)
  const desativarCategoria = () => {
    setCategorias((prev) =>
      prev.map((c) => c.id === modalEditar?.id ? { ...c, ativa: false } : c)
    );
    setModalEditar(null);
  };

  // ── Deleta categoria
  const deletarCategoria = (id: string) => {
    setCategorias((prev) => prev.filter((c) => c.id !== id));
  };

  // ── Drag and drop
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    setCategorias((prev) => {
      const oldIndex  = prev.findIndex((c) => c.id === active.id);
      const newIndex  = prev.findIndex((c) => c.id === over.id);
      const reordenado = arrayMove(prev, oldIndex, newIndex);
      return reordenado.map((c, i) => ({ ...c, ordem: i + 1 }));
    });
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

          {/* Tabela */}
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

          <p className="cate__dica">↺ Arraste para mudar a ordem das categorias</p>
        </div>

        {/* ── Modal Nova Categoria ── */}
        {modalNovo && (
          <div className="cate__overlay" onClick={() => setModalNovo(false)}>
            <div className="cate__modal" onClick={(e) => e.stopPropagation()}>
              <div className="cate__modal-header">
                <h3>Nova Categoria</h3>
                <button className="cate__modal-fechar" onClick={() => setModalNovo(false)}>
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
                      <input type="radio" name="status-novo" checked={form.ativa} onChange={() => atualizarForm({ ativa: true })} />
                      <span className={`cate__radio-check ${form.ativa ? 'cate__radio-check--ativo' : ''}`} />
                      Ativa
                    </label>
                    <label className="cate__radio-label">
                      <input type="radio" name="status-novo" checked={!form.ativa} onChange={() => atualizarForm({ ativa: false })} />
                      <span className={`cate__radio-check ${!form.ativa ? 'cate__radio-check--ativo' : ''}`} />
                      Oculta
                    </label>
                  </div>
                </div>

                {erro && <p className="cate__erro">{erro}</p>}
              </div>

              <div className="cate__modal-acoes cate__modal-acoes--direita">
                <button className="cate__btn-cancelar" onClick={() => setModalNovo(false)}>Cancelar</button>
                <button className="cate__btn-salvar" onClick={salvarNova}>Salvar</button>
              </div>
            </div>
          </div>
        )}

        {/* ── Modal Editar Categoria ── */}
        {modalEditar && (
          <div className="cate__overlay" onClick={() => setModalEditar(null)}>
            <div className="cate__modal" onClick={(e) => e.stopPropagation()}>
              <div className="cate__modal-header">
                <h3>Editar Categoria</h3>
                <button className="cate__modal-fechar" onClick={() => setModalEditar(null)}>
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
                      <input type="radio" name="status-edit" checked={form.ativa} onChange={() => atualizarForm({ ativa: true })} />
                      <span className={`cate__radio-check ${form.ativa ? 'cate__radio-check--ativo' : ''}`} />
                      Ativa
                    </label>
                    <label className="cate__radio-label">
                      <input type="radio" name="status-edit" checked={!form.ativa} onChange={() => atualizarForm({ ativa: false })} />
                      <span className={`cate__radio-check ${!form.ativa ? 'cate__radio-check--ativo' : ''}`} />
                      Oculta
                    </label>
                  </div>
                </div>

                {erro && <p className="cate__erro">{erro}</p>}
              </div>

              <div className="cate__modal-acoes cate__modal-acoes--tres">
                <button className="cate__btn-desativar" onClick={desativarCategoria}>Desativar</button>
                <button className="cate__btn-cancelar" onClick={() => setModalEditar(null)}>Cancelar</button>
                <button className="cate__btn-salvar" onClick={salvarEdicao}><HiPlus /> Salvar</button>
              </div>
            </div>
          </div>
        )}

      </div>
    </RestaurantLayout>
  );
};

export default GestãoCate;