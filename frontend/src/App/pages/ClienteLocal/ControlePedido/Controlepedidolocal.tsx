import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { HiCheckCircle, HiClipboardList, HiUser } from 'react-icons/hi';
import CustomerLayout from '../../../shared/components/layout/Customerlayout';
import { useConvidado } from '../../../shared/contexts/Convidadocontext';
import { useClienteAuth } from '../../../shared/contexts/ClienteAuthContext';
import { lerPedidosProprios } from '../../../shared/utils/meusPedidosMesa';
import MesaPublicaService, { PedidoMesaPublico } from '../../../services/mesaPublica.service';
import ContaMesaModal from '../../../shared/components/ContaMesa/ContaMesaModal';
import HistoricoPedidos, { FiltroOrigem } from '../../../shared/components/HistoricoPedidos/HistoricoPedidos';
import { useHistoricoCliente } from '../../../shared/components/HistoricoPedidos/useHistoricoCliente';
import './Controlepedidolocal.css';


type StatusPedidoLocal = 'pendente' | 'pronto' | 'finalizado';

type FiltroAtivoLocal = 'todos' | 'pendentes' | 'prontos' | 'finalizados';

interface ItemPedidoLocal {
  id: string;
  nome: string;
  quantidade: number;
  preco: number;
  imagem: string;
}

interface PedidoLocal {
  id: string;
  numero: number;
  status: StatusPedidoLocal;
  horario: string;
  mesa: number;
  /** Quem fez o pedido ('' se o servidor ainda não informa) */
  cliente: string;
  itens: ItemPedidoLocal[];
}


const IMAGEM_PADRAO_PRODUTO = '/icons/restaurant-logo.png';
const INTERVALO_ATUALIZACAO_MS = 15000; // atualiza sozinho para o cliente ver o pedido ficar pronto

const STATUS_API_PARA_TELA: Record<PedidoMesaPublico['status'], StatusPedidoLocal> = {
  RECEBIDO: 'pendente',
  PREPARO: 'pendente',
  PRONTO: 'pronto',
  ENTREGUE: 'finalizado',
};

const converterPedido = (p: PedidoMesaPublico, mesa: number): PedidoLocal => ({
  id: p.id,
  numero: p.numero_pedido,
  status: STATUS_API_PARA_TELA[p.status],
  horario: new Date(p.criado_em).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
  mesa,
  cliente: (p.cliente_nome ?? '').trim(),
  itens: p.itens.map((i) => ({
    id: i.id,
    nome: i.produto.nome,
    quantidade: i.quantidade,
    // preço unitário + extras (ingredientes acima do incluso), igual ao total cobrado no pedido
    preco: Number(i.preco_unitario) + (i.itens_adicionais ?? []).reduce((s, a) => s + Number(a.preco_extra), 0),
    imagem: i.produto.imagem_url || IMAGEM_PADRAO_PRODUTO,
  })),
});


const calcularTotalLocal = (itens: ItemPedidoLocal[]): number =>
  itens.reduce((acc, item) => acc + item.preco * item.quantidade, 0);

const formatarPrecoLocal = (valor: number): string =>
  `R$ ${valor.toFixed(2).replace('.', ',')}`;


/**
 * Aba "Meu histórico": histórico FIXO da conta logada (mesa + delivery), o mesmo da tela do delivery.
 * É um componente à parte para só buscar/atualizar na API enquanto a aba está aberta.
 */
const HistoricoDaConta: React.FC<{ slug?: string }> = ({ slug }) => {
  const { pedidos, carregando, erro } = useHistoricoCliente(slug, true);
  const [origem, setOrigem] = useState<FiltroOrigem>('todos');

  return (
    <HistoricoPedidos
      pedidos={pedidos}
      carregando={carregando}
      erro={erro}
      origem={origem}
      onOrigemChange={setOrigem}
      vazioTexto="Você ainda não fez nenhum pedido neste restaurante."
    />
  );
};

type AbaLocal = 'mesa' | 'historico';

const ControlePedidoLocal: React.FC = () => {
  const [filtroLocal, setFiltroLocal]   = useState<FiltroAtivoLocal>('todos');
  const [aba, setAba]                   = useState<AbaLocal>('mesa');
  const { mesaToken, nome: nomeConvidado, restauranteSlug } = useConvidado();
  // Logado na mesa: o pedido leva o nome da conta (mesma regra do cardápio)
  const { cliente: clienteLogado, isAuthenticated } = useClienteAuth();
  const [pedidosLocal, setPedidosLocal] = useState<PedidoLocal[]>([]);
  const [carregando, setCarregando]     = useState(true);
  const [erro, setErro]                 = useState<string | null>(null);
  const [mesaNumero, setMesaNumero]     = useState<number | null>(null);
  const [contaAberta, setContaAberta]   = useState(false);

  const carregarPedidos = useCallback(async () => {
    if (!mesaToken) {
      setCarregando(false);
      return;
    }
    try {
      const dados = await MesaPublicaService.listarPedidos(mesaToken);
      setMesaNumero(dados.mesa.numero);
      setPedidosLocal(dados.pedidos.map((p) => converterPedido(p, dados.mesa.numero)));
      setErro(null);
    } catch (err: any) {
      // Em atualização automática, mantém o que já está na tela e só avisa
      setErro(err?.response?.data?.message ?? 'Não foi possível carregar os pedidos.');
    } finally {
      setCarregando(false);
    }
  }, [mesaToken]);

  useEffect(() => {
    carregarPedidos();
    const timer = setInterval(carregarPedidos, INTERVALO_ATUALIZACAO_MS);
    return () => clearInterval(timer);
  }, [carregarPedidos]);

  // ── Pedidos "meus": os que ESTE aparelho enviou; para pedidos antigos, vale também o mesmo nome
  const meusIds = useMemo(
    () => (mesaToken ? lerPedidosProprios(mesaToken) : new Set<string>()),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [mesaToken, pedidosLocal]
  );
  const meuNome = (clienteLogado?.nome || nomeConvidado || '').trim().toLowerCase();
  const ehMeu = (p: PedidoLocal) =>
    meusIds.has(p.id) || (meuNome !== '' && p.cliente.toLowerCase() === meuNome);

  // ── Contagens para os badges dos filtros
  const contagensLocal = {
    todos:       pedidosLocal.length,
    pendentes:   pedidosLocal.filter((p) => p.status === 'pendente').length,
    prontos:     pedidosLocal.filter((p) => p.status === 'pronto').length,
    finalizados: pedidosLocal.filter((p) => p.status === 'finalizado').length,
  };

  // ── Pedidos filtrados conforme aba ativa
  const pedidosLocalFiltrados = pedidosLocal.filter((p) => {
    if (filtroLocal === 'pendentes')   return p.status === 'pendente';
    if (filtroLocal === 'prontos')     return p.status === 'pronto';
    if (filtroLocal === 'finalizados') return p.status === 'finalizado';
    return true;
  });


  return (
    <CustomerLayout mode="guest">
      <div className="pedidos-local">

        {/* ── Cabeçalho ── */}
        <h1 className="pedidos-local__titulo">Meus Pedidos</h1>

        {/* ── Abas: só para quem está logado (convidado não tem histórico guardado) ── */}
        {isAuthenticated && (
          <div className="pedidos-local__filtros" role="tablist">
            {([['mesa', 'Desta mesa'], ['historico', 'Meu histórico']] as [AbaLocal, string][]).map(([id, rotulo]) => (
              <button
                key={id}
                type="button"
                role="tab"
                aria-selected={aba === id}
                className={`pedidos-local__filtro-btn ${aba === id ? 'pedidos-local__filtro-btn--ativo' : ''}`}
                onClick={() => setAba(id)}
              >
                {rotulo}
              </button>
            ))}
          </div>
        )}

        {isAuthenticated && aba === 'historico' ? (
          <HistoricoDaConta slug={restauranteSlug} />
        ) : (
        <>
        {/* ── Resumo da mesa: vale também para quem chega numa mesa que já estava aberta ── */}
        {mesaToken && mesaNumero !== null && !carregando && pedidosLocal.length > 0 && (
          <div className="pedidos-local__resumo">
            <div className="pedidos-local__resumo-item">
              <span>Mesa</span>
              <strong>{String(mesaNumero).padStart(2, '0')}</strong>
            </div>
            <div className="pedidos-local__resumo-item">
              <span>Pedidos</span>
              <strong>{pedidosLocal.length}</strong>
            </div>
            <div className="pedidos-local__resumo-item">
              <span>Total da mesa</span>
              <strong>{formatarPrecoLocal(pedidosLocal.reduce((acc, p) => acc + calcularTotalLocal(p.itens), 0))}</strong>
            </div>
          </div>
        )}

        {/* ── Filtros ── */}
        <div className="pedidos-local__filtros">
          {(['todos', 'pendentes', 'prontos', 'finalizados'] as FiltroAtivoLocal[]).map((f) => (
            <button
              key={f}
              className={`pedidos-local__filtro-btn ${filtroLocal === f ? 'pedidos-local__filtro-btn--ativo' : ''}`}
              onClick={() => setFiltroLocal(f)}
            >
              {f.charAt(0).toUpperCase() + f.slice(1)}
              <span className="pedidos-local__filtro-badge">{contagensLocal[f]}</span>
            </button>
          ))}
        </div>

        {/* ── Lista de pedidos ── */}
        <div className="pedidos-local__lista">
          {!mesaToken ? (
            <p className="pedidos-local__vazio">
              Escaneie o QR Code da sua mesa para acompanhar os pedidos.
            </p>
          ) : carregando ? (
            <p className="pedidos-local__vazio">Carregando pedidos...</p>
          ) : erro && pedidosLocal.length === 0 ? (
            <p className="pedidos-local__vazio">{erro}</p>
          ) : pedidosLocalFiltrados.length === 0 ? (
            <p className="pedidos-local__vazio">
              {pedidosLocal.length === 0
                ? `Ainda não há pedidos na mesa${mesaNumero !== null ? ` ${String(mesaNumero).padStart(2, '0')}` : ''}. Faça o primeiro pelo cardápio.`
                : 'Nenhum pedido nesta aba.'}
            </p>
          ) : (
            pedidosLocalFiltrados.map((pedido) => {
              const totalLocal = calcularTotalLocal(pedido.itens);
              const meu = ehMeu(pedido);

              return (
                <div key={pedido.id} className={`pedidos-local__card${meu ? ' pedidos-local__card--meu' : ''}`}>

                  {/* ── Cabeçalho do card ── */}
                  <div className="pedidos-local__card-header">
                    <div className="pedidos-local__card-info">
                      <h2 className="pedidos-local__card-numero">Pedido #{pedido.numero}</h2>
                      <span className={`pedidos-local__status pedidos-local__status--${pedido.status}`}>
                        {pedido.status === 'pendente'   && <>🔵 Pendente</>}
                        {pedido.status === 'pronto'     && <>🟡 Pronto</>}
                        {pedido.status === 'finalizado' && (
                          <><HiCheckCircle className="pedidos-local__status-icon" /> Finalizado</>
                        )}
                      </span>
                    </div>

                    {(pedido.cliente || meu) && (
                      <p className="pedidos-local__cliente">
                        {meu && <span className="pedidos-local__status pedidos-local__selo-meu">Seu pedido</span>}
                        {meu && pedido.cliente && <br />}
                        {pedido.cliente && <><HiUser aria-hidden="true" /> {pedido.cliente}</>}
                      </p>
                    )}

                    <p className="pedidos-local__card-meta">
                      {pedido.horario}&nbsp;&nbsp;|&nbsp;&nbsp;Mesa {pedido.mesa}
                    </p>
                  </div>

                  {/* ── Corpo: itens + totais + ação ── */}
                  <div className="pedidos-local__card-body">

                    {/* Itens */}
                    <div className="pedidos-local__itens">
                      {pedido.itens.map((item) => (
                        <div key={item.id} className="pedidos-local__item">
                          <img
                            src={item.imagem}
                            alt={item.nome}
                            className="pedidos-local__item-img"
                          />
                          <div className="pedidos-local__item-info">
                            <span className="pedidos-local__item-nome">
                              {item.quantidade}x {item.nome}
                            </span>
                            <span className="pedidos-local__item-preco">
                              {formatarPrecoLocal(item.preco * item.quantidade)}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>

                    {/* Totais + botão de ação */}
                    <div className="pedidos-local__card-rodape">
                      <div className="pedidos-local__totais">
                        <span className="pedidos-local__total-label">Total</span>
                        <span className="pedidos-local__total-destaque">
                          {formatarPrecoLocal(totalLocal)}
                        </span>
                      </div>

                      {pedido.status === 'pendente' && (
                        // Pedido aguardando preparo — cliente só pode acompanhar
                        <span className="pedidos-local__btn pedidos-local__btn--aguardando">
                          Aguardando...
                        </span>
                      )}

                      {pedido.status === 'pronto' && (
                        // A baixa (entregue) é feita pelo restaurante; o cliente só acompanha
                        <span className="pedidos-local__btn pedidos-local__btn--aguardando">
                          Pronto! Já vai à mesa
                        </span>
                      )}

                      {pedido.status === 'finalizado' && (
                        <button
                          type="button"
                          className="pedidos-local__btn pedidos-local__btn--conta"
                          onClick={() => setContaAberta(true)}
                        >
                          <HiClipboardList className="pedidos-local__btn-icon" />
                          Ver Conta
                        </button>
                      )}
                    </div>

                  </div>
                </div>
              );
            })
          )}
        </div>
        </>
        )}

      </div>
      <ContaMesaModal aberto={contaAberta} token={mesaToken} onFechar={() => setContaAberta(false)} />
    </CustomerLayout>
  );
};

export default ControlePedidoLocal;