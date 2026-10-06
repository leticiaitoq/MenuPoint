import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import CustomerLayout from '../../../shared/components/layout/Customerlayout';
import Carrinho from '../../../shared/components/Carrinho/Carrinho';
import { useCarrinho } from '../../../shared/contexts/CarrinhoContext';
import './MenuLocal.css';

// ── Tipos 
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

// ── Dados mockados
const CATEGORIAS: Categoria[] = [
  { id: 'todos',      label: 'Todos',      icon: '/icons/icons-categorias/icons-categorias/todos.png' },
  { id: 'lanches',    label: 'Lanches',    icon: '/icons/icons-categorias/icons-categorias/lanches.png' },
  { id: 'bebidas',    label: 'Bebidas',    icon: '/icons/icons-categorias/icons-categorias/bebidas.png' },
  { id: 'massas',     label: 'Massas',     icon: '/icons/icons-categorias/icons-categorias/massas.png' },
  { id: 'sobremesas', label: 'Sobremesas', icon: '/icons/icons-categorias/icons-categorias/sobremesas.png' },
  { id: 'pizzas',     label: 'Pizzas',     icon: '/icons/icons-categorias/icons-categorias/pizzas.png' },
  { id: 'porcoes',    label: 'Porções',    icon: '/icons/icons-categorias/icons-categorias/porcoes.png' },
  { id: 'saladas',    label: 'Saladas',    icon: '/icons/icons-categorias/icons-categorias/saladas.png' },
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

// ── Componente
const MenuLocal: React.FC = () => {
  // ── Estados
  const navigate = useNavigate();
  const { itens: itensCarrinho, removerItem, limparCarrinho } = useCarrinho();
  const [busca, setBusca]                     = useState('');
  const [categoriaAtiva, setCategoriaAtiva]   = useState('todos');
  const [carrinhoAberto, setCarrinhoAberto]   = useState(false);

  // ── Filtro
  const produtosFiltrados = PRODUTOS.filter((p) => {
    const naCategoria = categoriaAtiva === 'todos' || p.categoriaId === categoriaAtiva;
    const naBusca = p.nome.toLowerCase().includes(busca.toLowerCase());
    return naCategoria && naBusca;
  });

  const totalCarrinho = itensCarrinho.reduce((acc, i) => acc + i.quantidade, 0);

  // ── Handlers
  const abrirPersonalizacao = (produto: Produto) => {
    navigate('/personaliza', { state: { produto, modoCliente: 'guest' } });
  };

  const finalizarPedido = () => {
    limparCarrinho();
    setCarrinhoAberto(false);
  };

  // ── Render
  return (
    <CustomerLayout
      mode="guest"
      cartCount={totalCarrinho}
      onCartClick={() => setCarrinhoAberto(true)}
    >
      <div className="menu" style={{ backgroundImage: 'url(/images/Fundo-menu.png)' }}>

        {/* Botão flutuante do carrinho — igual ao MenuCliente */}
       <button
        className="menu__carrinho-fab"
        onClick={() => setCarrinhoAberto(true)}
        aria-label="Abrir carrinho"
      >
        <img src="/icons/carrinho.png" alt="" className="menu__carrinho-fab-icon" />
        {totalCarrinho > 0 && (
          <span className="menu__carrinho-fab-badge">{totalCarrinho}</span>
        )}
      </button>

        {/* Busca */}
        <div className="menu__busca-wrap">
           <img src="/icons/lupa.png" alt="" className="menu__busca-icon" />
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
              <img src={cat.icon} alt="" className="menu__cat-icon" />
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

      <Carrinho
        aberto={carrinhoAberto}
        onFechar={() => setCarrinhoAberto(false)}
        itens={itensCarrinho}
        onRemover={removerItem}
        onFinalizar={finalizarPedido}
      />
    </CustomerLayout>
  );
};

export default MenuLocal;