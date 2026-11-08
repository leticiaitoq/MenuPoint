import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import CustomerLayout from '../../../shared/components/layout/Customerlayout';
import Carrinho from '../../../shared/components/Carrinho/Carrinho';
import ChamarGarcom from '../../../shared/components/ChamarGarcom/Chamargarcom';
import FecharConta from '../../../shared/components/FecharConta/FecharConta';
import { useCarrinho } from '../../../shared/contexts/CarrinhoContext';
import { useConvidado } from '../../../shared/contexts/Convidadocontext';
import { extrairIngredientes, IngredienteProduto } from '../../../shared/utils/ingredientes';
import RestaurantePublicoService from '../../../services/restaurantePublico.service';
import MesaPublicaService from '../../../services/mesaPublica.service';
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
  destaque: boolean;
  ordem: number;
  ingredientes: IngredienteProduto[];
}

// "Todos" usa o PNG; as demais categorias vêm da API (ícone = emoji ou imagem)
const CATEGORIA_TODOS: Categoria = {
  id: 'todos',
  label: 'Todos',
  icon: '/icons/icons-categorias/icons-categorias/todos.png',
};

const ehImagem = (icon: string) => icon.startsWith('/') || icon.startsWith('http');

// Mesma ordem do painel do restaurante: destaques, depois a ordem definida por ele
const compararProdutos = (idsCategorias: string[]) => (a: Produto, b: Produto) =>
  Number(b.destaque) - Number(a.destaque)
  || a.ordem - b.ordem
  || idsCategorias.indexOf(a.categoriaId) - idsCategorias.indexOf(b.categoriaId);

// ── Componente
const MenuLocal: React.FC = () => {
  // ── Estados
  const navigate = useNavigate();
  const { itens: itensCarrinho, removerItem, limparCarrinho } = useCarrinho();
  const { mesa, nome: nomeConvidado, mesaToken, estabelecimentoId } = useConvidado();
  const [busca, setBusca]                     = useState('');
  const [categoriaAtiva, setCategoriaAtiva]   = useState('todos');
  const [carrinhoAberto, setCarrinhoAberto]   = useState(false);
  const [contaAberta, setContaAberta]         = useState(false);
  const [contaPedida, setContaPedida]         = useState(false);
  const timerConta = useRef<number | undefined>(undefined);

  // Limpa o temporizador ao sair da tela
  useEffect(() => () => window.clearTimeout(timerConta.current), []);

  const [categorias, setCategorias] = useState<Categoria[]>([CATEGORIA_TODOS]);
  const [produtos, setProdutos]     = useState<Produto[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erroMenu, setErroMenu]     = useState('');
  const [enviando, setEnviando]     = useState(false);
  const [erroEnvio, setErroEnvio]   = useState('');

  // Cardápio real do restaurante da mesa (o id vem do QR Code escaneado).
  // Recarrega sozinho a cada 15s e ao voltar para a aba, sem piscar a tela.
  useEffect(() => {
    if (!estabelecimentoId) { setCarregando(false); return; }
    let cancelado = false;
    let ultimaAssinatura = '';

    const carregar = (silencioso: boolean) => {
      if (!silencioso) { setCarregando(true); setErroMenu(''); }

      return RestaurantePublicoService.cardapio(estabelecimentoId)
        .then((lista) => {
          if (cancelado) return;
          const assinatura = JSON.stringify(lista);
          if (silencioso && assinatura === ultimaAssinatura) return; // nada mudou
          ultimaAssinatura = assinatura;

          const ativas = lista.filter((c) => c.ativo !== false);
          const novasCategorias: Categoria[] = [
            CATEGORIA_TODOS,
            ...ativas.map((c) => ({ id: c.id, label: c.nome, icon: c.icone ?? '🍽️' })),
          ];
          setCategorias(novasCategorias);
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
  }, [estabelecimentoId]);

  // ── Filtro
  const produtosFiltrados = produtos.filter((p) => {
    const naCategoria = categoriaAtiva === 'todos' || p.categoriaId === categoriaAtiva;
    const naBusca = p.nome.toLowerCase().includes(busca.toLowerCase());
    return naCategoria && naBusca;
  });

  const totalCarrinho = itensCarrinho.reduce((acc, i) => acc + i.quantidade, 0);

  // ── Handlers
  const abrirPersonalizacao = (produto: Produto) => {
    navigate('/personaliza', { state: { produto, modoCliente: 'guest' } });
  };

  // Depois de pedir a conta, o botão fica bloqueado por 2 minutos (evita pedidos repetidos)
  const aoPedirConta = () => {
    setContaPedida(true);
    window.clearTimeout(timerConta.current);
    timerConta.current = window.setTimeout(() => setContaPedida(false), 120_000);
  };

  // Envia o carrinho para a cozinha. O preço é recalculado pelo servidor.
  const finalizarPedido = async () => {
    if (enviando || itensCarrinho.length === 0) return;

    if (!mesaToken) {
      setCarrinhoAberto(false);
      setErroEnvio('Escaneie o QR Code da sua mesa para fazer o pedido.');
      return;
    }

    // Itens sem id de produto (carrinho antigo, de antes da integração) não dá para enviar
    if (itensCarrinho.some((i) => !i.produtoId)) {
      limparCarrinho();
      setCarrinhoAberto(false);
      setErroEnvio('Seu carrinho estava desatualizado. Adicione os itens novamente.');
      return;
    }

    setEnviando(true);
    setErroEnvio('');
    try {
      await MesaPublicaService.criarPedido(mesaToken, {
        cliente_nome: nomeConvidado?.trim() || 'Cliente da mesa',
        itens: itensCarrinho.map((i) => ({
          produto_id: i.produtoId as string,
          quantidade: i.quantidade,
          ...(i.observacao ? { observacoes: i.observacao } : {}),
          ...(i.ingredientes?.length ? { ingredientes: i.ingredientes } : {}),
          ...(i.paraLevar ? { para_levar: true } : {}),
        })),
      });
      limparCarrinho();
      setCarrinhoAberto(false);
      navigate('/historicolocal'); // o cliente já vê o pedido recém-enviado
    } catch (err: any) {
      setCarrinhoAberto(false);
      setErroEnvio(err?.response?.data?.message ?? 'Não foi possível enviar o pedido. Tente novamente.');
    } finally {
      setEnviando(false);
    }
  };

  // ── Render
  return (
    <CustomerLayout
      mode="guest"
      cartCount={totalCarrinho}
      onCartClick={() => setCarrinhoAberto(true)}
    >
      <div
  className="menu bg-arte bg-arte--opaco"
  style={{ '--bg-arte': 'url(/images/Fundo-menu.png)' } as React.CSSProperties}
>

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

        {erroEnvio && (
          <p className="menu__erro-envio" role="alert" onClick={() => setErroEnvio('')}>
            {erroEnvio}
          </p>
        )}

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
                : erroMenu || (estabelecimentoId ? 'Nenhum produto encontrado.' : 'Escaneie o QR Code da sua mesa para ver o cardápio.')}
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

      <Carrinho
        aberto={carrinhoAberto}
        onFechar={() => setCarrinhoAberto(false)}
        itens={itensCarrinho}
        onRemover={removerItem}
        onFinalizar={finalizarPedido}
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
    </CustomerLayout>
  );
};

export default MenuLocal;
