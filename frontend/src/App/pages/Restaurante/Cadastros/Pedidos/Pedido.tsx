import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { HiUser, HiClipboardList, HiTrash, HiPlus, HiMinus, HiX, HiSearch } from 'react-icons/hi';
import { MdTableRestaurant } from 'react-icons/md';
import RestaurantLayout from '../../../../shared/components/layout/Restaurantelayout';
import MesaService, { Mesa } from '../../../../services/mesa.service';
import ProdutoService, { Produto } from '../../../../services/produto.service';
import PedidoService, { Pedido as PedidoApi } from '../../../../services/pedido.service';
import { mensagemDeErro } from '../../../../services/cliente.service';
import { useAuth } from '../../../../shared/contexts/Authcontext';
import { ROTAS_CAIXA } from '../../../../routes/caixaRotas';
import ModalAlerta from '../../../../shared/components/ModalAlerta/ModalAlerta';
import './Pedido.css';

// ── Tipos ──────────────────────────────────────────────────────────────────────
interface ItemPedido {
  id: string; // id do produto
  nome: string;
  quantidade: number;
  preco: number;
}

// Limites (o backend confere de novo: quantidade até 999, observações até 1000)
const QTD_MAX = 99;
const NOME_MAX = 100;
const OBS_MAX = 500;

const MARCA_URGENTE = '[URGENTE] ';

// Resumo do formulário em texto, para comparar "antes" e "depois" e saber se algo mudou
const assinatura = (cliente: string, itens: ItemPedido[], obs: string, urgente: boolean) =>
  JSON.stringify([
    cliente.trim(),
    [...itens].sort((a, b) => a.id.localeCompare(b.id)).map((i) => [i.id, i.quantidade]),
    obs.trim(),
    urgente,
  ]);

const moeda = (v: number) => `R$ ${v.toFixed(2).replace('.', ',')}`;

// Preço que vale hoje para o produto (promoção, se houver). O backend usa a mesma regra.
const precoDoProduto = (p: Produto) => p.preco_promocional ?? p.preco;

const Pedido: React.FC = () => {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const { usuario } = useAuth();

  // Como a tela foi aberta:
  //  • ?editar=<pedidoId> → edita um pedido existente (campos vêm preenchidos)
  //  • ?mesa=<mesaId>     → novo pedido já com a mesa escolhida
  //  • sem parâmetros     → novo pedido, tela limpa
  const mesaParam = params.get('mesa') ?? '';
  const editarId = params.get('editar');
  const editando = Boolean(editarId);

  // "Foto" do formulário quando o pedido é carregado: serve para saber se houve alteração
  const [snapshot, setSnapshot] = useState('');

  // Pedido que está sendo editado (null = novo pedido)
  const [pedidoEditando, setPedidoEditando] = useState<PedidoApi | null>(null);
  const [carregandoPedido, setCarregandoPedido] = useState(false);

  // Dados reais
  const [mesas, setMesas]           = useState<Mesa[]>([]);
  const [produtos, setProdutos]     = useState<Produto[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erroCarga, setErroCarga]   = useState<string | null>(null);

  // Formulário
  const [cliente, setCliente]         = useState('');
  const [mesaId, setMesaId]           = useState(mesaParam);
  const [itens, setItens]             = useState<ItemPedido[]>([]);
  const [observacoes, setObservacoes] = useState('');
  const [urgente, setUrgente]         = useState(false);
  const [erro, setErro]               = useState('');
  const [enviando, setEnviando]       = useState(false);
  const [sucesso, setSucesso]         = useState(false);

  // Confirmação de saída (modal padrão do sistema)
  const [confirmarSaida, setConfirmarSaida] = useState(false);

  // Seletor de produtos
  const [seletorAberto, setSeletorAberto] = useState(false);
  const [busca, setBusca]                 = useState('');

  // ── Carrega mesas e produtos do banco ────────────────────────────────────────
  const carregar = useCallback(async () => {
    setCarregando(true);
    setErroCarga(null);
    try {
      const [listaMesas, listaProdutos] = await Promise.all([
        MesaService.listar(),
        ProdutoService.listar({ disponivel: true }),
      ]);
      setMesas(listaMesas.filter((m) => m.status !== 'INATIVA'));
      setProdutos(listaProdutos);
    } catch (err: any) {
      setErroCarga(mensagemDeErro(err, 'Não foi possível carregar mesas e produtos.'));
    } finally {
      setCarregando(false);
    }
  }, []);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  // Sempre que a tela é aberta de outro jeito (ex.: do menu lateral depois de editar um pedido),
  // o formulário volta ao estado inicial — a página não reaproveita dados da vez anterior.
  useEffect(() => {
    setCliente('');
    setMesaId(mesaParam);
    setItens([]);
    setObservacoes('');
    setUrgente(false);
    setErro('');
    setSucesso(false);
    setPedidoEditando(null);
    setSeletorAberto(false);
    setConfirmarSaida(false);
    setSnapshot('');
  }, [mesaParam, editarId]);

  // Modo edição: busca o pedido e preenche o formulário com os dados dele
  useEffect(() => {
    if (!editarId) return;
    let cancelado = false;

    const carregarPedido = async () => {
      setCarregandoPedido(true);
      try {
        const pedido = await PedidoService.buscarPorId(editarId);
        if (cancelado) return;

        const emAndamento = ['RECEBIDO', 'PREPARO', 'PRONTO'].includes(pedido.status);
        const temAdicionais = pedido.itens.some((i) => (i.itens_adicionais?.length ?? 0) > 0);

        if (!emAndamento) {
          setErro('Este pedido já foi finalizado ou cancelado e não pode ser editado.');
        } else if (temAdicionais) {
          setErro('Este pedido tem adicionais e ainda não pode ser editado por aqui.');
        }

        const obs = pedido.observacoes ?? '';
        const eraUrgente = obs.startsWith(MARCA_URGENTE);

        const itensCarregados = pedido.itens.map((i) => ({
          id: i.produto_id,
          nome: i.produto?.nome ?? 'Produto',
          preco: i.preco_unitario,
          quantidade: i.quantidade,
        }));
        const obsCarregada = eraUrgente ? obs.slice(MARCA_URGENTE.length) : obs;

        setPedidoEditando(pedido);
        setCliente(pedido.cliente_nome);
        setMesaId(pedido.mesa?.id ?? '');
        setObservacoes(obsCarregada);
        setUrgente(eraUrgente);
        setItens(itensCarregados);
        setSnapshot(assinatura(pedido.cliente_nome, itensCarregados, obsCarregada, eraUrgente));
      } catch (err: any) {
        if (!cancelado) setErro(mensagemDeErro(err, 'Não foi possível carregar o pedido.'));
      } finally {
        if (!cancelado) setCarregandoPedido(false);
      }
    };

    void carregarPedido();
    return () => { cancelado = true; };
  }, [editarId]);

  // Se a mesa da URL não existe mais / está inativa, limpa a seleção
  useEffect(() => {
    if (carregando || !mesaId) return;
    if (!mesas.some((m) => m.id === mesaId)) setMesaId('');
  }, [carregando, mesas, mesaId]);

  // Fecha o seletor com Esc
  useEffect(() => {
    if (!seletorAberto) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setSeletorAberto(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [seletorAberto]);

  // ── Produtos agrupados por categoria (com busca) ─────────────────────────────
  const grupos = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    const filtrados = termo
      ? produtos.filter((p) => p.nome.toLowerCase().includes(termo))
      : produtos;

    const mapa = new Map<string, Produto[]>();
    filtrados.forEach((p) => {
      const nome = p.categoria?.nome ?? 'Sem categoria';
      mapa.set(nome, [...(mapa.get(nome) ?? []), p]);
    });
    return Array.from(mapa.entries());
  }, [produtos, busca]);

  const quantidadeNoPedido = (produtoId: string) =>
    itens.find((i) => i.id === produtoId)?.quantidade ?? 0;

  // ── Itens ────────────────────────────────────────────────────────────────────
  const adicionarProduto = (p: Produto) => {
    setErro('');
    setItens((prev) => {
      const existente = prev.find((i) => i.id === p.id);
      if (existente) {
        if (existente.quantidade >= QTD_MAX) return prev;
        return prev.map((i) => (i.id === p.id ? { ...i, quantidade: i.quantidade + 1 } : i));
      }
      return [...prev, { id: p.id, nome: p.nome, preco: precoDoProduto(p), quantidade: 1 }];
    });
  };

  const alterarQuantidade = (id: string, delta: number) => {
    setItens((prev) =>
      prev
        .map((i) => (i.id === id ? { ...i, quantidade: Math.min(QTD_MAX, i.quantidade + delta) } : i))
        .filter((i) => i.quantidade > 0)
    );
  };

  const removerItem = (id: string) => setItens((prev) => prev.filter((i) => i.id !== id));

  const total = itens.reduce((acc, i) => acc + i.preco * i.quantidade, 0);

  // Edição bloqueada (pedido finalizado ou com adicionais): só dá para sair
  const edicaoBloqueada =
    editando &&
    (carregandoPedido ||
      !pedidoEditando ||
      !['RECEBIDO', 'PREPARO', 'PRONTO'].includes(pedidoEditando.status) ||
      pedidoEditando.itens.some((i) => (i.itens_adicionais?.length ?? 0) > 0));

  // ── Sair (volta para a lista do Caixa) ───────────────────────────────────────
  // Só pergunta se houver algo a perder: dados digitados (novo pedido) ou alterações (edição).
  const houveAlteracao = editando
    ? snapshot !== '' && snapshot !== assinatura(cliente, itens, observacoes, urgente)
    : cliente.trim() !== '' || itens.length > 0 || observacoes.trim() !== '' || urgente;

  const sair = () => {
    if (enviando) return;
    if (houveAlteracao) {
      setConfirmarSaida(true);
      return;
    }
    navigate(ROTAS_CAIXA.lista);
  };

  // ── Salvar ───────────────────────────────────────────────────────────────────
  const salvarPedido = async () => {
    if (enviando) return; // evita duplo clique lançar o pedido duas vezes

    const nome = cliente.trim();
    if (!nome) return setErro('Informe o nome do cliente.');
    if (nome.length > NOME_MAX) return setErro(`O nome deve ter no máximo ${NOME_MAX} caracteres.`);
    if (!editando && !mesaId) return setErro('Selecione uma mesa.');
    if (itens.length === 0) return setErro('Adicione pelo menos um item ao pedido.');
    if (observacoes.length > OBS_MAX) return setErro(`As observações devem ter no máximo ${OBS_MAX} caracteres.`);

    setErro('');
    setEnviando(true);
    try {
      const obs = observacoes.trim();
      // O banco não tem campo "urgente": vai como marca no começo das observações da cozinha
      const observacoesFinal = urgente ? `${MARCA_URGENTE}${obs}`.trim() : obs || undefined;
      const itensEnvio = itens.map((i) => ({ produto_id: i.id, quantidade: i.quantidade }));

      if (pedidoEditando) {
        await PedidoService.atualizar(pedidoEditando.id, {
          cliente_nome: nome,
          observacoes: observacoesFinal,
          itens: itensEnvio,
        });
      } else {
        await PedidoService.criarDeMesa({
          mesa_id: mesaId,
          cliente_nome: nome,
          observacoes: observacoesFinal,
          itens: itensEnvio,
        });
      }
      setSucesso(true);
    } catch (err: any) {
      setErro(mensagemDeErro(err, 'Não foi possível registrar o pedido.'));
    } finally {
      setEnviando(false);
    }
  };

  // Depois de registrar, volta para a lista de mesas
  const concluir = () => navigate(ROTAS_CAIXA.lista);

  const rotuloMesa = (m: Mesa) =>
    `Mesa ${String(m.numero).padStart(2, '0')}` +
    (m.status === 'OCUPADA' ? ' (ocupada)' : m.status === 'RESERVADA' ? ' (reservada)' : '');

  return (
    <RestaurantLayout>
      <div className="pedido">

        {/* Cabeçalho */}
        <div className="pedido__header">
          <h2 className="pedido__titulo">
            {editando
              ? `Editar Pedido${pedidoEditando ? ` #${pedidoEditando.numero_pedido}` : ''}`
              : 'Cadastrar Pedidos'}
          </h2>
          <p className="pedido__breadcrumb">
            Pedidos &gt; <strong>{editando ? 'Editar Pedido' : 'Novo Pedido'}</strong>
          </p>
        </div>

        {/* Card do formulário */}
        <div className="pedido__card">

          {erroCarga && (
            <p className="pedido__erro" role="alert">
              {erroCarga}{' '}
              <button className="pedido__btn-cancelar" onClick={() => void carregar()}>
                Tentar de novo
              </button>
            </p>
          )}

          {/* Cliente */}
          <div className="pedido__secao">
            <label className="pedido__label" htmlFor="pedido-cliente">
              <HiUser className="pedido__label-icon" /> Cliente
            </label>
            <div className="pedido__input-wrap">
              <HiUser className="pedido__input-icon" />
              <input
                id="pedido-cliente"
                className="pedido__input"
                type="text"
                placeholder="Nome do cliente"
                maxLength={NOME_MAX}
                value={cliente}
                onChange={(e) => setCliente(e.target.value)}
              />
            </div>
          </div>

          {/* Mesa + Atendente */}
          <div className="pedido__linha">
            <div className="pedido__campo">
              <label className="pedido__label" htmlFor="pedido-mesa">Mesa</label>
              <div className="pedido__select-wrap">
                <MdTableRestaurant className="pedido__select-icon" />
                <select
                  id="pedido-mesa"
                  className="pedido__select"
                  value={mesaId}
                  onChange={(e) => setMesaId(e.target.value)}
                  disabled={carregando || editando} // na edição a mesa do pedido não muda
                >
                  <option value="">{carregando ? 'Carregando...' : 'Selecione a mesa'}</option>
                  {mesas.map((m) => (
                    <option key={m.id} value={m.id}>{rotuloMesa(m)}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* O atendente é quem está logado e lançando o pedido */}
            <div className="pedido__campo">
              <label className="pedido__label">Atendente</label>
              <div className="pedido__select-wrap">
                <span className="pedido__select">{usuario?.nome ?? '—'}</span>
              </div>
            </div>
          </div>

          {/* Botão adicionar item */}
          <button
            className="pedido__btn-add"
            onClick={() => { setBusca(''); setSeletorAberto(true); }}
            disabled={carregando || produtos.length === 0 || edicaoBloqueada}
          >
            <HiPlus /> Adicionar item
          </button>
          {!carregando && !erroCarga && produtos.length === 0 && (
            <p className="pedido__vazio">Nenhum produto disponível. Cadastre produtos em Produtos.</p>
          )}

          {/* Tabela de itens */}
          <div className="pedido__tabela-wrap">
            <table className="pedido__tabela">
              <thead>
                <tr>
                  <th className="pedido__th pedido__th--item">Item</th>
                  <th className="pedido__th">Qtd</th>
                  <th className="pedido__th">Preço</th>
                  <th className="pedido__th">Subtotal</th>
                  <th className="pedido__th"></th>
                </tr>
              </thead>
              <tbody>
                {itens.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="pedido__vazio">
                      Nenhum item adicionado ainda.
                    </td>
                  </tr>
                ) : (
                  itens.map((item) => (
                    <tr key={item.id} className="pedido__tr">
                      <td className="pedido__td" data-label="Item">{item.nome}</td>
                      <td className="pedido__td pedido__td--center" data-label="Qtd">
                        <div className="pedido__qtd">
                          <button
                            className="pedido__qtd-btn"
                            onClick={() => alterarQuantidade(item.id, -1)}
                            aria-label={`Diminuir ${item.nome}`}
                          >
                            <HiMinus />
                          </button>
                          <span className="pedido__qtd-valor">{item.quantidade}</span>
                          <button
                            className="pedido__qtd-btn"
                            onClick={() => alterarQuantidade(item.id, 1)}
                            disabled={item.quantidade >= QTD_MAX}
                            aria-label={`Aumentar ${item.nome}`}
                          >
                            <HiPlus />
                          </button>
                        </div>
                      </td>
                      <td className="pedido__td" data-label="Preço">{moeda(item.preco)}</td>
                      <td className="pedido__td pedido__td--subtotal" data-label="Subtotal">
                        {moeda(item.preco * item.quantidade)}
                      </td>
                      <td className="pedido__td pedido__td--center">
                        <button
                          className="pedido__btn-del"
                          onClick={() => removerItem(item.id)}
                          aria-label={`Remover ${item.nome}`}
                        >
                          <HiTrash />
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Observações + Total */}
          <div className="pedido__rodape">
            <div className="pedido__obs-wrap">
              <label className="pedido__label" htmlFor="pedido-obs">
                <HiClipboardList className="pedido__label-icon" /> Observações
              </label>
              <input
                id="pedido-obs"
                className="pedido__input pedido__input--obs"
                type="text"
                placeholder="Ex: Ponto do X-Burguer: bem passado"
                maxLength={OBS_MAX}
                value={observacoes}
                onChange={(e) => setObservacoes(e.target.value)}
              />
            </div>

            <div className="pedido__total-wrap">
              <div className="pedido__urgente">
                <label className="pedido__toggle-label">
                  <input
                    type="checkbox"
                    className="pedido__toggle-input"
                    checked={urgente}
                    onChange={(e) => setUrgente(e.target.checked)}
                  />
                  <span className="pedido__toggle-slider" />
                  Pedido Urgente
                </label>
              </div>
              <p className="pedido__total">
                Total <span>{moeda(total)}</span>
              </p>
            </div>
          </div>

          {/* Mensagem de erro */}
          {erro && <p className="pedido__erro" role="alert">{erro}</p>}

          {/* Ações */}
          <div className="pedido__acoes">
            <button className="pedido__btn-cancelar" onClick={sair} disabled={enviando}>
              Sair
            </button>
            <button className="pedido__btn-salvar" onClick={() => void salvarPedido()} disabled={enviando || carregando || edicaoBloqueada}>
              {enviando ? 'Salvando...' : editando ? 'Salvar Alterações' : 'Salvar Pedido'}
            </button>
          </div>

        </div>
      </div>

      {/* Seletor de produtos reais */}
      {seletorAberto && (
        <div className="pedido__popup-overlay" onClick={() => setSeletorAberto(false)}>
          <div
            className="pedido__seletor"
            role="dialog"
            aria-modal="true"
            aria-label="Adicionar item"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="pedido__seletor-topo">
              <h3 className="pedido__seletor-titulo">Adicionar item</h3>
              <button className="pedido__btn-del" onClick={() => setSeletorAberto(false)} aria-label="Fechar">
                <HiX />
              </button>
            </div>

            <div className="pedido__input-wrap" style={{ maxWidth: 'none' }}>
              <HiSearch className="pedido__input-icon" />
              <input
                className="pedido__input"
                type="text"
                placeholder="Buscar produto"
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
                autoFocus
              />
            </div>

            <div className="pedido__seletor-lista">
              {grupos.length === 0 ? (
                <p className="pedido__vazio">Nenhum produto encontrado.</p>
              ) : (
                grupos.map(([categoria, lista]) => (
                  <div key={categoria}>
                    <p className="pedido__seletor-categoria">{categoria}</p>
                    {lista.map((p) => {
                      const qtd = quantidadeNoPedido(p.id);
                      return (
                        <div key={p.id} className="pedido__seletor-item">
                          <span className="pedido__seletor-nome">{p.nome}</span>
                          <span className="pedido__seletor-preco">{moeda(precoDoProduto(p))}</span>
                          <div className="pedido__qtd">
                            <button
                              className="pedido__qtd-btn"
                              onClick={() => alterarQuantidade(p.id, -1)}
                              disabled={qtd === 0}
                              aria-label={`Remover um ${p.nome}`}
                            >
                              <HiMinus />
                            </button>
                            <span className="pedido__qtd-valor">{qtd}</span>
                            <button
                              className="pedido__qtd-btn"
                              onClick={() => adicionarProduto(p)}
                              disabled={qtd >= QTD_MAX}
                              aria-label={`Adicionar um ${p.nome}`}
                            >
                              <HiPlus />
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ))
              )}
            </div>

            <button className="pedido__btn-salvar" onClick={() => setSeletorAberto(false)}>
              Concluir{itens.length > 0 ? ` (${itens.reduce((a, i) => a + i.quantidade, 0)})` : ''}
            </button>
          </div>
        </div>
      )}

      {/* Confirmação de saída (modal padrão do sistema) */}
      <ModalAlerta
        aberto={confirmarSaida}
        variante="aviso"
        titulo={editando ? 'Sair sem salvar?' : 'Descartar este pedido e sair?'}
        mensagem={
          editando
            ? 'As alterações feitas neste pedido serão perdidas.'
            : 'Os dados e itens lançados nesta tela serão perdidos.'
        }
        textoConfirmar={editando ? 'Sair sem salvar' : 'Descartar e sair'}
        textoCancelar={editando ? 'Continuar editando' : 'Continuar pedido'}
        onConfirmar={() => { setConfirmarSaida(false); navigate(ROTAS_CAIXA.lista); }}
        onFechar={() => setConfirmarSaida(false)}
      />

      {/* Popup de sucesso — depois do OK volta para a lista de mesas */}
      {sucesso && (
        <div className="pedido__popup-overlay" onClick={concluir}>
          <div className="pedido__popup" onClick={(e) => e.stopPropagation()}>
            <span className="pedido__popup-icon">✅</span>
            <h3>{editando ? 'Pedido atualizado com sucesso!' : 'Pedido efetuado com sucesso!'}</h3>
            <p>
              {editando
                ? 'As alterações foram salvas.'
                : 'O pedido foi registrado e enviado para a cozinha.'}
            </p>
            <button className="pedido__btn-salvar" onClick={concluir}>
              OK
            </button>
          </div>
        </div>
      )}

    </RestaurantLayout>
  );
};

export default Pedido;
