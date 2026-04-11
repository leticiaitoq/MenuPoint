import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import CustomerLayout from '../../../shared/components/layout/Customerlayout';
import Carrinho, { ItemCarrinho } from '../../../shared/components/Carrinho/Carrinho';
import Historico, { PedidoHistorico } from '../../../shared/components/historico/Historico';
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

// ── Dados mockados (substituir por API futuramente) ────────────────────────────
const CATEGORIAS: Categoria[] = [
  { id: 'todos',      label: 'Todos',      icon: '🍽️' },
  { id: 'lanches',    label: 'Lanches',    icon: '🍔' },
  { id: 'bebidas',    label: 'Bebidas',    icon: '🥤' },
  { id: 'massas',     label: 'Massas',     icon: '🍝' },
  { id: 'sobremesas', label: 'Sobremesas', icon: '🧁' },
  { id: 'pizzas',     label: 'Pizzas',     icon: '🍕' },
  { id: 'porcoes',    label: 'Porções',    icon: '🍟' },
  { id: 'saladas',    label: 'Saladas',    icon: '🥗' },
];

const PRODUTOS: Produto[] = [
  { id: '1', categoriaId: 'lanches',    nome: 'Hamburguer Celestino',   descricao: 'Pão, gergilim, hamburguer, bacon, cheddar, alface, cebola, tomate',  preco: 39.90, imagem: '/images/menu/lanche.jpg' },
  { id: '2', categoriaId: 'massas',     nome: 'Macarrão ao molho ito',  descricao: 'Massa, molho vermelho, almondegas e queijo parmesão',                preco: 24.99, imagem: '/images/menu/macarrão.jpg' },
  { id: '3', categoriaId: 'porcoes',    nome: 'Porção Batatas Brisola', descricao: 'Batatas fritas, cheddar e bacon (400g)',                              preco: 50.00, imagem: '/images/menu/batata.jpg' },
  { id: '4', categoriaId: 'porcoes',    nome: 'Porção de Frango',       descricao: 'Frango crocante temperado com molho especial (300g)',                 preco: 38.00, imagem: '/images/menu/pf.jpg' },
  { id: '5', categoriaId: 'bebidas',    nome: 'Caipirinha',             descricao: 'Limão, açúcar e cachaça artesanal',                                   preco: 18.00, imagem: '/images/menu/caipira.jpg' },
  { id: '6', categoriaId: 'saladas',    nome: 'Salada Caesar',          descricao: 'Alface romana, croutons, parmesão e molho caesar',                    preco: 22.00, imagem: '/images/menu/ceaser.jpg' },
  { id: '7', categoriaId: 'sobremesas', nome: 'Sorvete Cremoso',        descricao: 'Sorvete de chocolate com calda de morango',                           preco: 22.00, imagem: '/images/menu/sor.jpg' },
  { id: '8', categoriaId: 'pizzas',     nome: 'Pizza Portuguesa',       descricao: 'Molho, mussarela, presunto, bacon, milho, ervilha, tomate e orégano', preco: 50.00, imagem: '/images/menu/pp.jpg' },
  { id: '9', categoriaId: 'bebidas',    nome: 'Coca-Cola',              descricao: 'Coca-Cola Lata (350ml)',                                              preco: 6.00, imagem: '/images/menu/coca.jpg' },
];  
// ── Componente ─────────────────────────────────────────────────────────────────
const MenuCliente: React.FC = () => {
  const navigate = useNavigate();

  const [busca, setBusca]                     = useState('');
  const [categoriaAtiva, setCategoriaAtiva]   = useState('todos');
  const [itensCarrinho, setItensCarrinho]     = useState<ItemCarrinho[]>([]);
  const [carrinhoAberto, setCarrinhoAberto]   = useState(false);
  const [historicoAberto, setHistoricoAberto] = useState(false);
  const [itensPedidos, setItensPedidos]       = useState<PedidoHistorico[]>([]);
  const [modalTipoAberto, setModalTipoAberto] = useState(false);

  // ── Filtro ──────────────────────────────────────────────────────────────────
  const produtosFiltrados = PRODUTOS.filter((p) => {
    const naCategoria = categoriaAtiva === 'todos' || p.categoriaId === categoriaAtiva;
    const naBusca     = p.nome.toLowerCase().includes(busca.toLowerCase());
    return naCategoria && naBusca;
  });

  const totalCarrinho = itensCarrinho.reduce((acc, i) => acc + i.quantidade, 0);

  // ── Handlers 
  const adicionarAoCarrinho = (produto: Produto) => {
    setItensCarrinho((prev) => {
      const existente = prev.find((i) => i.id === produto.id);
      if (existente) {
        return prev.map((i) =>
          i.id === produto.id ? { ...i, quantidade: i.quantidade + 1 } : i
        );
      }
      return [...prev, { ...produto, quantidade: 1 }];
    });
  };

  const removerDoCarrinho = (id: string) => {
    setItensCarrinho((prev) => prev.filter((i) => i.id !== id));
  };

  const finalizarPedido = () => {
    setItensPedidos((prev) => {
      const novo = [...prev];
      itensCarrinho.forEach((item) => {
        const existente = novo.find((i) => i.id === item.id);
        if (existente) {
          existente.quantidade += item.quantidade;
        } else {
          novo.push({ ...item });
        }
      });
      return novo;
    });
    setItensCarrinho([]);
    setModalTipoAberto(false);
  };

  const escolherTipo = (rota: string) => {
    finalizarPedido();
    navigate(rota);
  };

  // ── Render 
  return (
    <CustomerLayout
      mode="logged"
      cartCount={totalCarrinho}
      onCartClick={() => setCarrinhoAberto(true)}
      onOrdersClick={() => setHistoricoAberto(true)}
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
          {CATEGORIAS.map((cat) => (
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
          {produtosFiltrados.length === 0 ? (
            <p className="menu__vazio">Nenhum produto encontrado.</p>
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
                      onClick={() => adicionarAoCarrinho(p)}
                      aria-label={`Adicionar ${p.nome} ao carrinho`}
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
        onRemover={removerDoCarrinho}
        onFinalizar={() => {
          setCarrinhoAberto(false);
          setModalTipoAberto(true);
        }}
      />

      {/* Painel do histórico */}
      <Historico
        aberto={historicoAberto}
        onFechar={() => setHistoricoAberto(false)}
        itens={itensPedidos}
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
            <button className="mtp__card" onClick={() => escolherTipo('/customer/retirada')}>
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