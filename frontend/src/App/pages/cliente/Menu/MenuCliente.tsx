import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import CustomerLayout from '../../../shared/components/layout/Customerlayout';
import Carrinho from '../../../shared/components/Carrinho/Carrinho';
import { useCarrinho } from '../../../shared/contexts/CarrinhoContext';
import { useRestauranteCliente } from '../../../shared/contexts/RestauranteClienteContext';
import RestaurantePublicoService from '../../../services/restaurantePublico.service';
import './MenuCliente.css';

// ── Tipos ──────────────────────────────────────────────────────────────────────
interface Categoria {
  id: string;
  label: string;
  icon: string;
}

interface Produto {
  id: string;
  categoriaId: string;
  nome: string;
  descricao: string;
  preco: number;
  imagem: string;
}

const CATEGORIA_TODOS: Categoria = { id: 'todos', label: 'Todos', icon: '🍽️' };

// ── Componente ─────────────────────────────────────────────────────────────────
const MenuCliente: React.FC = () => {
  const navigate = useNavigate();
  const { restaurante } = useRestauranteCliente();

  const [categorias, setCategorias] = useState<Categoria[]>([CATEGORIA_TODOS]);
  const [produtos, setProdutos]     = useState<Produto[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erroMenu, setErroMenu]     = useState('');

  // Cardápio real do restaurante escolhido pelo link /r/:slug
  useEffect(() => {
    if (!restaurante) { setCarregando(false); return; }
    let cancelado = false;
    setCarregando(true);
    setErroMenu('');

    RestaurantePublicoService.cardapio(restaurante.id)
      .then((lista) => {
        if (cancelado) return;
        const ativas = lista.filter((c) => c.ativo !== false);
        setCategorias([
          CATEGORIA_TODOS,
          ...ativas.map((c) => ({ id: c.id, label: c.nome, icon: c.icone ?? '🍽️' })),
        ]);
        setProdutos(
          ativas.flatMap((c) =>
            (c.produtos ?? [])
              .filter((p) => p.disponivel)
              .map((p) => ({
                id: p.id,
                categoriaId: c.id,
                nome: p.nome,
                descricao: p.descricao ?? '',
                preco: Number(p.preco_promocional ?? p.preco),
                imagem: p.imagem_url ?? '/icons/restaurant-logo.png',
              }))
          )
        );
      })
      .catch(() => { if (!cancelado) setErroMenu('Não foi possível carregar o cardápio.'); })
      .finally(() => { if (!cancelado) setCarregando(false); });

    return () => { cancelado = true; };
  }, [restaurante]);

  const [busca, setBusca]                     = useState('');
  const [categoriaAtiva, setCategoriaAtiva]   = useState('todos');
  const { itens: itensCarrinho, removerItem } = useCarrinho();
  const [carrinhoAberto, setCarrinhoAberto]   = useState(false);
  const [modalTipoAberto, setModalTipoAberto] = useState(false);

  // ── Filtro ──────────────────────────────────────────────────────────────────
  const produtosFiltrados = produtos.filter((p) => {
    const naCategoria = categoriaAtiva === 'todos' || p.categoriaId === categoriaAtiva;
    const naBusca     = p.nome.toLowerCase().includes(busca.toLowerCase());
    return naCategoria && naBusca;
  });

  const totalCarrinho = itensCarrinho.reduce((acc, i) => acc + i.quantidade, 0);

  // ── Handlers 
  const abrirPersonalizacao = (produto: Produto) => {
  navigate('/personaliza', { state: { produto, modoCliente: 'logged' } });
  };

  const escolherTipo = (rota: string) => {
    navigate(rota);
  };

  // ── Render 
  return (
    <CustomerLayout
      mode="logged"
      cartCount={totalCarrinho}
      onCartClick={() => setCarrinhoAberto(true)}
    >
      <div className="menu" style={{ backgroundImage: 'url(/images/Fundo-menu.png)' }}>

        {/* Busca */}
        <div className="menu__busca-wrap">
          <span className="menu__busca-icon">🔍</span>
          <input
            className="menu__busca"
            type="text"
            placeholder="Procurar"
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
          />
        </div>

        {/* Categorias */}
        <div className="menu__categorias">
          {categorias.map((cat) => (
            <button
              key={cat.id}
              className={`menu__cat-btn${categoriaAtiva === cat.id ? ' menu__cat-btn--ativo' : ''}`}
              onClick={() => setCategoriaAtiva(cat.id)}
              aria-label={cat.label}
              title={cat.label}
            >
              <span className="menu__cat-icon">{cat.icon}</span>
            </button>
          ))}
        </div>

        {/* Grid de produtos */}
        <div className="menu__grid">
          {carregando || erroMenu || produtosFiltrados.length === 0 ? (
            <p className="menu__vazio">
              {carregando
                ? 'Carregando cardápio...'
                : erroMenu || (restaurante ? 'Nenhum produto encontrado.' : 'Nenhum restaurante selecionado.')}
            </p>
          ) : (
            produtosFiltrados.map((p) => (
              <div key={p.id} className="menu__card">
                <img src={p.imagem} alt={p.nome} className="menu__card-img" />
                <div className="menu__card-body">
                  <h3 className="menu__card-nome">{p.nome}</h3>
                  <p className="menu__card-desc">{p.descricao}</p>
                  <div className="menu__card-rodape">
                    <span className="menu__card-preco">
                      R${p.preco.toFixed(2).replace('.', ',')}
                    </span>
                    <button
                      className="menu__card-add"
                      onClick={() => abrirPersonalizacao(p)}
                      aria-label={`Personalizar ${p.nome}`}
                    >
                      +
                    </button>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

      </div>

      {/* Botão flutuante do carrinho */}
      <button
        className="menu__carrinho-fab"
        onClick={() => setCarrinhoAberto(true)}
        aria-label="Abrir carrinho"
      >
        🛒
        {totalCarrinho > 0 && (
          <span className="menu__carrinho-fab-badge">{totalCarrinho}</span>
        )}
      </button>

      {/* Painel do carrinho */}
      <Carrinho
        aberto={carrinhoAberto}
        onFechar={() => setCarrinhoAberto(false)}
        itens={itensCarrinho}
        onRemover={removerItem}
        onFinalizar={() => {
          setCarrinhoAberto(false);
          setModalTipoAberto(true);
        }}
      />

      {/* Modal de tipo de pedido — entrega ou retirada */}
      {modalTipoAberto && (
        <>
          <div className="mtp__overlay" onClick={() => setModalTipoAberto(false)} />
          <div className="mtp__modal">
            <button className="mtp__card" onClick={() => escolherTipo('/endereço')}>
              <span className="mtp__card-label">Para entrega</span>
              <img src="/images/delivery.png" alt="Para entrega" className="mtp__card-img" />
            </button>
            <button className="mtp__card" onClick={() => escolherTipo('/retirada')}>
              <span className="mtp__card-label">Para Retirada</span>
              <img src="/images/retirada.png" alt="Para retirada" className="mtp__card-img" />
            </button>
          </div>
        </>
      )}

    </CustomerLayout>
  );
};

export default MenuCliente;