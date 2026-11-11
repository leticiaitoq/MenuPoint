import React, { useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import CustomerLayout from '../../../shared/components/layout/Customerlayout';
import Carrinho, { ItemCarrinho } from '../../../shared/components/Carrinho/Carrinho';
import ChamarGarcom from '../../../shared/components/ChamarGarcom/Chamargarcom';
import FecharConta from '../../../shared/components/FecharConta/FecharConta';
import { useCarrinho } from '../../../shared/contexts/CarrinhoContext';
import { useClienteAuth } from '../../../shared/contexts/ClienteAuthContext';
import { useConvidado } from '../../../shared/contexts/Convidadocontext';
import { useLoginObrigatorio } from '../../../shared/contexts/LoginObrigatorioContext';
import { useRestauranteCliente } from '../../../shared/contexts/RestauranteClienteContext';
import { extrairIngredientes, IngredienteProduto } from '../../../shared/utils/ingredientes';
import { consumirRetomada } from '../../../shared/utils/pendenciaLogin';
import RestaurantePublicoService from '../../../services/restaurantePublico.service';
import MesaPublicaService from '../../../services/mesaPublica.service';
import './MenuCliente.css';

// Tipos
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
  ingredientes: IngredienteProduto[];
  ordem: number;
}

// "Todos" usa o PNG novo; as demais categorias vêm da API
const CATEGORIA_TODOS: Categoria = {
  id: 'todos',
  label: 'Todos',
  icon: '/icons/icons-categorias/icons-categorias/todos.png',
};

// Ícone pode ser imagem (caminho/URL) ou emoji
const ehImagem = (icon: string) => icon.startsWith('/') || icon.startsWith('http');

const compararProdutos = (idsCategorias: string[]) => (a: Produto, b: Produto) =>
  Number(b.destaque) - Number(a.destaque)
  || a.ordem - b.ordem
  || idsCategorias.indexOf(a.categoriaId) - idsCategorias.indexOf(b.categoriaId);

//  Componente
const MenuCliente: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { restaurante } = useRestauranteCliente();
  const { mesa, mesaToken } = useConvidado();
  const { isAuthenticated } = useClienteAuth();
  const { exigirLogin } = useLoginObrigatorio();

  const [categorias, setCategorias] = useState<Categoria[]>([CATEGORIA_TODOS]);
  const [produtos, setProdutos]     = useState<Produto[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erroMenu, setErroMenu]     = useState('');
  const [categoriaAtiva, setCategoriaAtiva]   = useState('todos');

  // Cardápio real do restaurante escolhido pelo link /r/:slug.
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
                  ingredientes: extrairIngredientes(p.grupos_adicionais),
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
  const { itens: itensCarrinho, removerItem, alterarQuantidade } = useCarrinho();
  // Voltando da edição de um item, o carrinho já abre
  const [carrinhoAberto, setCarrinhoAberto]   = useState(
    () => Boolean((location.state as { abrirCarrinho?: boolean } | null)?.abrirCarrinho)
  );
  const [modalTipoAberto, setModalTipoAberto] = useState(false);
  const [contaAberta, setContaAberta]         = useState(false);
  const [contaPedida, setContaPedida]         = useState(false);
  const timerConta = useRef<number | undefined>(undefined);

  // Limpa o temporizador ao sair da tela
  useEffect(() => () => window.clearTimeout(timerConta.current), []);

  // Voltou do login depois de tentar enviar o pedido: continua de onde parou (escolha entrega × retirada)
  useEffect(() => {
    if (isAuthenticated && itensCarrinho.length > 0 && consumirRetomada('tipo-pedido')) {
      setModalTipoAberto(true);
    }
  }, [isAuthenticated, itensCarrinho.length]);

  // Consome o aviso "abrir o carrinho": sem isso o carrinho reabriria toda vez que o cliente voltasse a esta tela
  useEffect(() => {
    if ((location.state as { abrirCarrinho?: boolean } | null)?.abrirCarrinho) {
      navigate(location.pathname, { replace: true, state: null });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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

  // Depois de pedir a conta, o botão fica bloqueado por 2 minutos (evita pedidos repetidos)
  const aoPedirConta = () => {
    setContaPedida(true);
    window.clearTimeout(timerConta.current);
    timerConta.current = window.setTimeout(() => setContaPedida(false), 120_000);
  };

  // Volta para a tela do pedido com o item já preenchido
  const editarItem = (item: ItemCarrinho) => {
    if (!item.produtoOrigem) return;
    setCarrinhoAberto(false);
    navigate('/personaliza', {
      state: { produto: item.produtoOrigem, modoCliente: 'logged', editarItemId: item.id },
    });
  };

  const escolherTipo = (rota: string) => {
    navigate(rota);
  };

  // Render
  return (
    <CustomerLayout
      mode="logged"
      cartCount={totalCarrinho}
      onCartClick={() => setCarrinhoAberto(true)}
    >
      <div
  className="menu bg-arte bg-arte--opaco"
  style={{ '--bg-arte': 'url(/images/Fundo-menu.png)' } as React.CSSProperties}
>

        {/* Busca + botão Chamar garçom (o botão só aparece quando entrou pelo QR da mesa) */}
        <div className="menu__topo">
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
          {mesaToken && (
            <ChamarGarcom mesa={mesa} onChamar={() => MesaPublicaService.chamarGarcom(mesaToken)} />
          )}
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
              {ehImagem(cat.icon) ? (
                <img src={cat.icon} alt="" className="menu__cat-icon" />
              ) : (
                <span className="menu__cat-icon" aria-hidden="true">{cat.icon}</span>
              )}
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
        <img src="/icons/carrinho.png" alt="" className="menu__carrinho-fab-icon" />
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
        onAlterarQuantidade={alterarQuantidade}
        onEditar={editarItem}
        onFinalizar={() => {
          // Sem conta não envia: abre o aviso de login e o carrinho continua como está
          if (!exigirLogin({ motivo: 'pedido', retorno: '/menu', retomar: 'tipo-pedido' })) return;
          setCarrinhoAberto(false);
          setModalTipoAberto(true);
        }}
        onFecharConta={mesaToken ? () => setContaAberta(true) : undefined}
        contaPedida={contaPedida}
      />

      {mesaToken && (
        <FecharConta
          aberto={contaAberta}
          mesa={mesa}
          itensNoCarrinho={totalCarrinho}
          onPedir={(forma) => MesaPublicaService.pedirConta(mesaToken, forma)}
          onConcluido={aoPedirConta}
          onFechar={() => setContaAberta(false)}
        />
      )}

      {/* Modal de tipo de pedido — entrega ou retirada */}
      {modalTipoAberto && (
        <>
          <div className="mtp__overlay" onClick={() => setModalTipoAberto(false)} />
          <div className="mtp__modal">
            {/* Só oferece o que o restaurante aceita (cadastro do restaurante) */}
            {restaurante?.aceita_entrega !== false && (
              <button className="mtp__card" onClick={() => escolherTipo('/endereço')}>
                <span className="mtp__card-label">Para entrega</span>
                <img src="/images/Delivery.png" alt="Para entrega" className="mtp__card-img" />
              </button>
            )}
            {restaurante?.aceita_retirada !== false && (
              <button className="mtp__card" onClick={() => escolherTipo('/retirada')}>
                <span className="mtp__card-label">Para Retirada</span>
                <img src="/images/Retirada.png" alt="Para retirada" className="mtp__card-img" />
              </button>
            )}
          </div>
        </>
      )}

    </CustomerLayout>
  );
};

export default MenuCliente;