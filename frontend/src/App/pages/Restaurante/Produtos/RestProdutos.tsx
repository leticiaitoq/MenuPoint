import React, { useEffect, useState } from 'react';
import { HiSearch, HiPencil, HiTrash, HiRefresh, HiPlus, HiStar } from 'react-icons/hi';
import { MdDragIndicator } from 'react-icons/md';
import RestaurantLayout from '../../../shared/components/layout/Restaurantelayout';
import { useNavigate } from 'react-router-dom';
import './RestProdutos.css';
import { DndContext, closestCenter, PointerSensor, useSensor, useSensors, DragEndEvent } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy, useSortable, arrayMove } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import ProdutoService, { Produto } from '../../../services/produto.service';
import CategoriaService, { Categoria } from '../../../services/categoria.service';
import ContadorCaracteres from '../../../shared/components/ContadorCaracteres/ContadorCaracteres';
import ModalAlerta from '../../../shared/components/ModalAlerta/ModalAlerta';

const STATUS = ['Todos os status', 'Ativo', 'Inativo'];

// Produtos em destaque ficam sempre no topo; dentro de cada grupo vale a ordem salva
const ordenarProdutos = (lista: Produto[]): Produto[] =>
  [...lista].sort((a, b) =>
    Number(b.destaque) - Number(a.destaque) || a.ordem - b.ordem
  );

interface LinhaProps {
  produto: Produto;
  posicao: number;
  onEditar: (produto: Produto) => void;
  onDesativar: (produto: Produto) => void;
  onReativar: (id: string) => void;
  formatarMoeda: (valor: number) => string;
}

const LinhaProduto: React.FC<LinhaProps> = ({ produto, posicao, onEditar, onDesativar, onReativar, formatarMoeda }) => {
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
  };

  return (
    <tr
      ref={setNodeRef}
      style={style}
      className={`prod__linha ${isDragging ? 'prod__linha--arrastando' : ''}`}
    >
      <td className="prod__td-ordem">
        {/* só o ícone recebe os listeners de drag */}
        <MdDragIndicator
          className="prod__drag-icon"
          {...attributes}
          {...listeners}
        />
        {posicao}
      </td>
      <td className="prod__td-produto">
        <img
          src={produto.imagem_url || '/icons/restaurant-logo.png'}
          alt={produto.nome}
          className="prod__imagem"
        />
        {produto.nome}
        {produto.destaque && (
          <span className="prod__destaque" title="Produto em destaque">
            <HiStar /> Destaque
          </span>
        )}
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
        {produto.disponivel ? (
          <button
            className="prod__btn-acao prod__btn-acao--deletar"
            onClick={() => onDesativar(produto)}
            aria-label={`Desativar ${produto.nome}`}
            title="Desativar produto"
          >
            <HiTrash />
          </button>
        ) : (
          <button
            className="prod__btn-acao prod__btn-acao--reativar"
            onClick={() => onReativar(produto.id)}
            aria-label={`Reativar ${produto.nome}`}
            title="Reativar produto"
          >
            <HiRefresh />
          </button>
        )}
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
  // Confirmação de desativação (mesmo padrão da tela de categorias)
  const [produtoParaDesativar, setProdutoParaDesativar] = useState<Produto | null>(null);
  const [desativando, setDesativando]         = useState(false);

  const navigate = useNavigate();

  const carregar = async () => {
    setCarregando(true);
    setErro('');
    try {
      const [listaProdutos, listaCategorias] = await Promise.all([
        ProdutoService.listar(),
        CategoriaService.listar(),
      ]);
      setProdutos(ordenarProdutos(listaProdutos));
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

  const confirmarDesativacao = async () => {
    if (!produtoParaDesativar) return;
    setDesativando(true);
    await alternarDisponibilidade(produtoParaDesativar.id);
    setDesativando(false);
    setProdutoParaDesativar(null);
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

    // Destaques ficam sempre acima dos demais: só dá para reordenar dentro do mesmo grupo
    if (produtos[oldIndex].destaque !== produtos[newIndex].destaque) {
      setErro('Produtos em destaque ficam sempre no topo. Para mudar isso, edite o produto e altere o destaque.');
      return;
    }
    setErro('');

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
              maxLength={150}
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
            />
            {busca.length > 0 && <ContadorCaracteres valor={busca} max={150} />}
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
                            posicao={produtos.findIndex((p) => p.id === produto.id) + 1}
                            onEditar={(p) => navigate(`/restaurante/editprodutos/${p.id}`)}
                            onDesativar={setProdutoParaDesativar}
                            onReativar={alternarDisponibilidade}
                            formatarMoeda={formatarMoeda}
                          />
                        ))}
                      </tbody>
                    </table>
                  </SortableContext>
                </DndContext>
              </div>

              <p className="prod__dica">↕ Arraste para mudar a ordem dos produtos (a nova ordem é salva automaticamente). Produtos em destaque ficam sempre no topo.</p>
            </>
          )}
        </div>

        <ModalAlerta
          aberto={!!produtoParaDesativar}
          variante="aviso"
          titulo="Desativar produto?"
          mensagem={produtoParaDesativar && <>O produto <strong>"{produtoParaDesativar.nome}"</strong> deixará de aparecer no cardápio. Você pode reativá-lo depois.</>}
          textoConfirmar={desativando ? 'Desativando...' : 'Sim, desativar'}
          onConfirmar={confirmarDesativacao}
          onFechar={() => setProdutoParaDesativar(null)}
          carregando={desativando}
        />
      </div>
    </RestaurantLayout>
  );
};

export default RestProdutos;