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
  destaque: boolean;
  ordem: number;
}

const CATEGORIA_TODOS: Categoria = { id: 'todos', label: 'Todos', icon: '🍽️' };

// Mesma hierarquia do painel do restaurante: destaques primeiro; depois a ordem
// definida por ele; empate (ex.: produtos novos, todos com ordem 0) cai na ordem das categorias.
// Array.sort é estável, então o que empatar continua na ordem em que o backend enviou.
const compararProdutos = (idsCategorias: string[]) => (a: Produto, b: Produto) =>
  Number(b.destaque) - Number(a.destaque)
  || a.ordem - b.ordem
  || idsCategorias.indexOf(a.categoriaId) - idsCategorias.indexOf(b.categoriaId);

// ── Componente ─────────────────────────────────────────────────────────────────
const MenuCliente: React.FC = () => {
  const navigate = useNavigate();
  const { restaurante } = useRestauranteCliente();

  const [categorias, setCategorias] = useState<Categoria[]>([CATEGORIA_TODOS]);
  const [produtos, setProdutos]     = useState<Produto[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erroMenu, setErroMenu]     = useState('');
  const [categoriaAtiva, setCategoriaAtiva]   = useState('todos');

  // Cardápio real do restaurante escolhido pelo link /r/:slug.
  // Recarrega sozinho (sem piscar a tela) quando o restaurante muda algo em
  // categorias ou produtos: a cada 15s, ao voltar para a aba e ao recuperar a conexão.
  useEffect(() => {
    if (!restaurante) { setCarregando(false); return; }
    let cancelado = false;
    let ultimaAssinatura = '';

    const carregar = (silencioso: boolean) => {
      if (!silencioso) { setCarregando(true); setErroMenu(''); }

      return RestaurantePublicoService.cardapio(restaurante.id)
        .then((lista) => {
          if (cancelado) return;
          // Nada mudou desde a última leitura: não re-renderiza
          const assinatura = JSON.stringify(lista);
          if (silencioso && assinatura === ultimaAssinatura) return;
          ultimaAssinatura = assinatura;

          const ativas = lista.filter((c) => c.ativo !== false);
          const novasCategorias: Categoria[] = [
            CATEGORIA_TODOS,
            ...ativas.map((c) => ({ id: c.id, label: c.nome, icon: c.icone ?? '🍽️' })),
          ];
          setCategorias(novasCategorias);
          // Se a categoria selecionada foi desativada/removida, volta para "Todos"
          setCategoriaAtiva((atual) =>
            novasCategorias.some((c) => c.id === atual) ? atual : 'todos'
          );
          setProdutos(
            ativas.flatMap((c) =>
              (c.produtos ?? [])
                .filter((p) => p.disponivel)
                .map((p) => ({
                  destaque: !!p.destaque,
                  ordem: p.ordem ?? 0,
                  id: p.id,
                  categoriaId: c.id,
                  nome: p.nome,
                  descricao: p.descricao ?? '',
                  preco: Number(p.preco_promocional ?? p.preco),
                  imagem: p.imagem_url ?? '/icons/restaurant-logo.png',
                }))
            ).sort(compararProdutos(ativas.map((c) => c.id)))
          );
          setErroMenu('');
        })
        .catch(() => {
          // Em recarga silenciosa mantém o cardápio atual; só avisa no carregamento inicial
          if (!cancelado && !silencioso) setErroMenu('Não foi possível carregar o cardápio.');
        })
        .finally(() => { if (!cancelado && !silencioso) setCarregando(false); });
    };

    carregar(false);

    const recarregar = () => { if (document.visibilityState === 'visible') carregar(true); };
    const intervalo = window.setInterval(recarregar, 15000);
    document.addEventListener('visibilitychange', recarregar);
    window.addEventListener('focus', recarregar);
    window.addEventListener('online', recarregar);

    return () => {
      cancelado = true;
      window.clearInterval(intervalo);
      document.removeEventListener('visibilitychange', recarregar);
      window.removeEventListener('focus', recarregar);
      window.removeEventListener('online', recarregar);
    };
  }, [restaurante]);

  const [busca, setBusca]                     = useState('');
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
              <div key={p.id} className={`menu__card${p.destaque ? ' menu__card--destaque' : ''}`}>
                {p.destaque && <span className="menu__card-selo">⭐ Destaque</span>}
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