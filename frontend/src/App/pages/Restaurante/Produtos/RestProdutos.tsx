import React, { useEffect, useState } from 'react';
import { HiSearch, HiPencil, HiPause, HiPlay, HiPlus } from 'react-icons/hi';
import { MdDragIndicator } from 'react-icons/md';
import RestaurantLayout from '../../../shared/components/layout/Restaurantelayout';
import { useNavigate } from 'react-router-dom';
import './RestProdutos.css';
import { DndContext, closestCenter, PointerSensor, useSensor, useSensors, DragEndEvent } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy, useSortable, arrayMove } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import ProdutoService, { Produto } from '../../../services/produto.service';
import CategoriaService, { Categoria } from '../../../services/categoria.service';

const STATUS = ['Todos os status', 'Ativo', 'Inativo'];

interface LinhaProps {
  produto: Produto;
  onEditar: (produto: Produto) => void;
  onAlternar: (id: string) => void;
  formatarMoeda: (valor: number) => string;
}

const LinhaProduto: React.FC<LinhaProps> = ({ produto, onEditar, onAlternar, formatarMoeda }) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: produto.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    background: isDragging ? '#fdf0f0' : 'white',
  };

  return (
    <tr ref={setNodeRef} style={style}>
      <td className="prod__td-ordem">
        {/* só o ícone recebe os listeners de drag */}
        <MdDragIndicator
          className="prod__drag-icon"
          {...attributes}
          {...listeners}
        />
        {produto.ordem}
      </td>
      <td className="prod__td-produto">
        <img
          src={produto.imagem_url || '/images/placeholder.png'}
          alt={produto.nome}
          className="prod__imagem"
        />
        {produto.nome}
      </td>
      <td>{formatarMoeda(produto.preco)}</td>
      <td>{produto.categoria?.nome ?? '—'}</td>
      <td>
        <span className={`prod__badge ${produto.disponivel ? 'prod__badge--ativo' : 'prod__badge--inativo'}`}>
          {produto.disponivel ? 'Ativa' : 'Inativa'}
        </span>
      </td>
      <td className="prod__td-acoes">
        <button className="prod__btn-acao" onClick={() => onEditar(produto)} aria-label="Editar produto">
          <HiPencil />
        </button>
        <button className="prod__btn-acao prod__btn-acao--pausar" onClick={() => onAlternar(produto.id)} aria-label="Pausar/Ativar">
          {produto.disponivel ? <HiPause /> : <HiPlay />}
        </button>
      </td>
    </tr>
  );
};

const RestProdutos: React.FC = () => {

  const [produtos, setProdutos]               = useState<Produto[]>([]);
  const [categorias, setCategorias]           = useState<Categoria[]>([]);
  const [carregando, setCarregando]           = useState(true);
  const [erro, setErro]                       = useState('');
  const [busca, setBusca]                     = useState('');
  const [categoriaFiltro, setCategoriaFiltro] = useState('Todas as categorias');
  const [statusFiltro, setStatusFiltro]       = useState('Todos os status');

  const navigate = useNavigate();

  const carregar = async () => {
    setCarregando(true);
    setErro('');
    try {
      const [listaProdutos, listaCategorias] = await Promise.all([
        ProdutoService.listar(),
        CategoriaService.listar(),
      ]);
      setProdutos(listaProdutos);
      setCategorias(listaCategorias);
    } catch (err: any) {
      setErro(err?.response?.data?.message ?? 'Não foi possível carregar os produtos.');
    } finally {
      setCarregando(false);
    }
  };

  useEffect(() => { carregar(); }, []);

  // ── Filtragem em tempo real
  const produtosFiltrados = produtos.filter((p) => {
    const dentroNome      = p.nome.toLowerCase().includes(busca.toLowerCase());
    const dentroCategoria = categoriaFiltro === 'Todas as categorias' || p.categoria?.nome === categoriaFiltro;
    const dentroStatus    = statusFiltro === 'Todos os status'
      || (statusFiltro === 'Ativo' && p.disponivel)
      || (statusFiltro === 'Inativo' && !p.disponivel);
    return dentroNome && dentroCategoria && dentroStatus;
  });

  // ── Alterna disponibilidade (pausar/ativar) — otimista, com rollback em erro
  const alternarDisponibilidade = async (id: string) => {
    setProdutos((prev) =>
      prev.map((p) => p.id === id ? { ...p, disponivel: !p.disponivel } : p)
    );
    try {
      await ProdutoService.alternarDisponibilidade(id);
    } catch {
      setErro('Não foi possível alterar a disponibilidade do produto.');
      setProdutos((prev) =>
        prev.map((p) => p.id === id ? { ...p, disponivel: !p.disponivel } : p)
      );
    }
  };

  // ── Formata preço
  const formatarMoeda = (valor: number) =>
    valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

  // Sensor — define que precisa arrastar 5px antes de ativar (evita clique acidental)
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 5 },
    })
  );

  // Handler chamado ao soltar o item — grava a nova ordem no backend
  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = produtos.findIndex((p) => p.id === active.id);
    const newIndex = produtos.findIndex((p) => p.id === over.id);
    const reordenado = arrayMove(produtos, oldIndex, newIndex).map((p, i) => ({ ...p, ordem: i + 1 }));

    setProdutos(reordenado);

    try {
      await ProdutoService.reordenar(reordenado.map((p) => ({ id: p.id, ordem: p.ordem })));
    } catch {
      setErro('Não foi possível salvar a nova ordem.');
      carregar();
    }
  };

  return (
    <RestaurantLayout>
      <div className="prod">

        {/* ── Cabeçalho ── */}
        <div className="prod__header">
          <div>
            <h2 className="prod__titulo">Produtos</h2>
            <p className="prod__subtitulo">Visualize e gerencie os itens do cardápio</p>
          </div>
            <button className="prod__btn-novo" onClick={() => navigate('/restaurante/cadprodutos')}>
            <HiPlus /> Novo Produto
            </button>
             </div>

        {/* ── Filtros ── */}
        <div className="prod__filtros">
          <div className="prod__busca-wrap">
            <HiSearch className="prod__busca-icon" />
            <input
              type="text"
              placeholder="Buscar produto..."
              className="prod__busca"
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
            />
          </div>

          <select className="prod__select" value={categoriaFiltro} onChange={(e) => setCategoriaFiltro(e.target.value)}>
            <option>Todas as categorias</option>
            {categorias.map((c) => <option key={c.id}>{c.nome}</option>)}
          </select>

          <select className="prod__select" value={statusFiltro} onChange={(e) => setStatusFiltro(e.target.value)}>
            {STATUS.map((s) => <option key={s}>{s}</option>)}
          </select>
        </div>

        {erro && <p className="prod__erro">{erro}</p>}

        {/* ── Tabela ── */}
        <div className="prod__container">
          {carregando ? (
            <p className="prod__dica">Carregando produtos...</p>
          ) : produtosFiltrados.length === 0 ? (
            <p className="prod__dica">Nenhum produto encontrado.</p>
          ) : (
            <>
              <p className="prod__dica">↕ Arraste para mudar a ordem dos produtos</p>

              <div className="prod__tabela-scroll">
                <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                  <SortableContext items={produtosFiltrados.map((p) => p.id)} strategy={verticalListSortingStrategy}>
                    <table className="prod__tabela">
                      <thead>
                        <tr>
                          <th>Ordem</th>
                          <th>Produto</th>
                          <th>Preço</th>
                          <th>Categoria</th>
                          <th>Status</th>
                          <th>Ações</th>
                        </tr>
                      </thead>
                      <tbody>
                        {produtosFiltrados.map((produto) => (
                          <LinhaProduto
                            key={produto.id}
                            produto={produto}
                            onEditar={(p) => navigate(`/restaurante/editprodutos/${p.id}`)}
                            onAlternar={alternarDisponibilidade}
                            formatarMoeda={formatarMoeda}
                          />
                        ))}
                      </tbody>
                    </table>
                  </SortableContext>
                </DndContext>
              </div>

              <p className="prod__dica">↕ Arraste para mudar a ordem dos produtos</p>
            </>
          )}
        </div>
      </div>
    </RestaurantLayout>
  );
};

export default RestProdutos;
