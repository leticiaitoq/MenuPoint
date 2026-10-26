import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Navigate, useNavigate, useParams } from 'react-router-dom';
import {
  HiArrowLeft,
  HiPrinter,
  HiDotsVertical,
  HiUserGroup,
  HiPlus,
  HiX,
  HiCreditCard,
  HiCash,
  HiDotsHorizontal,
  HiOutlineSwitchHorizontal,
  HiOutlineDocumentDuplicate,
  HiOutlineTrash,
  HiOutlinePencil,
} from 'react-icons/hi';
import { MdCreditCard, MdPix } from 'react-icons/md';
import RestaurantLayout from '../../../../shared/components/layout/Restaurantelayout';
import { ROTAS_CAIXA } from '../../../../routes/caixaRotas';
import MesaService, { Mesa as MesaApi } from '../../../../services/mesa.service';
import PedidoService, { Pedido as PedidoApi } from '../../../../services/pedido.service';
import { mensagemDeErro } from '../../../../services/cliente.service';
import TransferirMesaModal from '../../../../shared/components/TransferirMesa/TransferirMesaModal';
import JuntarPedidosModal from '../../../../shared/components/JuntarPedidos/JuntarPedidosModal';
import ConfirmarAcaoPedido, { TipoAcaoPedido } from '../../../../shared/components/ConfirmarAcaoPedido/ConfirmarAcaoPedido';
import './PagarMesa.css';

// ── Tipos ──────────────────────────────────────────────────────────────────────
type StatusPedido = 'aberta' | 'fechada';
type FormaPagamento = 'pix' | 'debito' | 'credito' | 'dinheiro' | 'outras';
type AbaDesconto = 'cupom' | 'manual';

interface ItemPedido {
  id: string;
  nome: string;
  quantidade: number;
  precoUnitario: number;
}

interface PedidoDetalhe {
  mesaNumero: number;
  pessoas: number;
  status: StatusPedido;
  itens: ItemPedido[];
  descontoValor: number;
  pagamentosRealizados: number;

  // ── Só preenchidos quando a mesa vem da API (mesa real) ──
  /** Texto do cabeçalho no lugar de "N pessoas" (ex.: "1 cliente") */
  pessoasLabel?: string;
  capacidade?: number;
  observacao?: string;
  /** Nomes dos clientes cadastrados na mesa (sem repetir) */
  clientes?: string[];
  /** Pedidos em andamento da mesa. Se existir, a mesa é real (não é o mock). */
  pedidos?: PedidoApi[];
}

interface CupomDesconto {
  codigo: string;
  percentual: number;
}

// ── Mock (substituir por chamada à API futuramente — pedido.service.ts / pagameto.service.ts) ──
const PEDIDOS_DETALHE_MOCK: Record<string, PedidoDetalhe> = {
  m1: {
    mesaNumero: 1, pessoas: 2, status: 'aberta',
    itens: [
      { id: 'p1', nome: 'X-Burguer',    quantidade: 2, precoUnitario: 25.0 },
      { id: 'p2', nome: 'Batata Frita', quantidade: 1, precoUnitario: 15.0 },
    ],
    descontoValor: 0,
    pagamentosRealizados: 0,
  },
  m2: {
    mesaNumero: 2, pessoas: 4, status: 'aberta',
    itens: [
      { id: 'p3', nome: 'Picanha na Chapa',    quantidade: 1, precoUnitario: 89.9 },
      { id: 'p4', nome: 'Refrigerante Lata',   quantidade: 2, precoUnitario: 11.0 },
      { id: 'p5', nome: 'Batata Frita',        quantidade: 1, precoUnitario: 19.9 },
      { id: 'p6', nome: 'Água com Gás',        quantidade: 1, precoUnitario: 8.0  },
      { id: 'p7', nome: 'Brownie com Sorvete', quantidade: 1, precoUnitario: 21.9 },
    ],
    descontoValor: 15.0,
    pagamentosRealizados: 50.0,
  },
  m3: {
    mesaNumero: 3, pessoas: 2, status: 'aberta',
    itens: [
      { id: 'p8', nome: 'Suco Natural',      quantidade: 2, precoUnitario: 9.0 },
      { id: 'p9', nome: 'Refrigerante Lata', quantidade: 1, precoUnitario: 6.0 },
    ],
    descontoValor: 0,
    pagamentosRealizados: 0,
  },
  m4: {
    mesaNumero: 4, pessoas: 6, status: 'aberta',
    itens: [
      { id: 'p10', nome: 'Macarrão ao Molho', quantidade: 4, precoUnitario: 24.99 },
      { id: 'p11', nome: 'X-Burguer',         quantidade: 2, precoUnitario: 25.0  },
      { id: 'p12', nome: 'Refrigerante Lata', quantidade: 3, precoUnitario: 6.0   },
    ],
    descontoValor: 0,
    pagamentosRealizados: 0,
  },
  m5: {
    mesaNumero: 5, pessoas: 2, status: 'aberta',
    itens: [
      { id: 'p13', nome: 'Batata Frita', quantidade: 1, precoUnitario: 15.0 },
    ],
    descontoValor: 0,
    pagamentosRealizados: 0,
  },
  m6: {
    mesaNumero: 6, pessoas: 3, status: 'aberta',
    itens: [
      { id: 'p14', nome: 'X-Burguer',    quantidade: 3, precoUnitario: 25.0 },
      { id: 'p15', nome: 'Suco Natural', quantidade: 2, precoUnitario: 9.0  },
    ],
    descontoValor: 0,
    pagamentosRealizados: 0,
  },
};

// Itens disponíveis para o "+ Adicionar item" (mesmo padrão mockado do Pedido.tsx —
// futuramente puxar do produto.service.ts)
const PRODUTOS_DISPONIVEIS = [
  { id: 'ap1', nome: 'X-Burguer',         preco: 25.0 },
  { id: 'ap2', nome: 'Refrigerante Lata', preco: 6.0  },
  { id: 'ap3', nome: 'Batata Frita',      preco: 15.0 },
  { id: 'ap4', nome: 'Suco Natural',      preco: 9.0  },
  { id: 'ap5', nome: 'Água com Gás',      preco: 8.0  },
];

// Cupons válidos (substituir futuramente por chamada ao desconto.service.ts)
const CUPONS_DISPONIVEIS: CupomDesconto[] = [
  { codigo: 'BEMVINDO10',   percentual: 10 },
  { codigo: 'FIDELIDADE5',  percentual: 5  },
];

const TAXA_SERVICO_PERCENT = 0.10;

const FORMAS_PAGAMENTO: { id: FormaPagamento; nome: string; info: string; icone: React.ReactNode }[] = [
  { id: 'pix',      nome: 'Pix',                 info: 'Aprovação imediata',            icone: < MdPix/> },
  { id: 'debito',   nome: 'Cartão de Débito',     info: 'Aprovação imediata',            icone: <HiCreditCard />    },
  { id: 'credito',  nome: 'Cartão de Crédito',    info: 'Até 12x',                       icone: <MdCreditCard />    },
  { id: 'dinheiro', nome: 'Dinheiro',             info: 'Informe o valor recebido',      icone: <HiCash />          },
];

const gerarIdItem = () => `it${Date.now()}${Math.floor(Math.random() * 1000)}`;

// ── Dados reais (API) ──────────────────────────────────────────────────────────
const STATUS_EM_ANDAMENTO: PedidoApi['status'][] = ['RECEBIDO', 'PREPARO', 'PRONTO'];

const ROTULO_STATUS_PEDIDO: Record<string, string> = {
  RECEBIDO: 'Recebido',
  PREPARO: 'Em preparo',
  PRONTO: 'Pronto',
};

const horaDoPedido = (iso: string) =>
  new Date(iso).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

// Clientes da mesa = nomes diferentes nos pedidos (ignora maiúsculas e espaços a mais)
const clientesDaMesa = (pedidos: PedidoApi[]): string[] => {
  const vistos = new Map<string, string>();
  pedidos.forEach((p) => {
    const nome = p.cliente_nome.trim().replace(/\s+/g, ' ');
    const chave = nome.toLowerCase();
    if (nome && !vistos.has(chave)) vistos.set(chave, nome);
  });
  return Array.from(vistos.values());
};

// Junta os pedidos em andamento da mesa numa única comanda: itens iguais somam a quantidade.
const montarPedidoDaApi = (mesa: MesaApi, pedidos: PedidoApi[]): PedidoDetalhe => {
  const agrupados = new Map<string, ItemPedido>();
  pedidos.forEach((p) =>
    p.itens.forEach((i) => {
      const unitario = i.quantidade > 0 ? i.preco_total / i.quantidade : i.preco_unitario;
      const chave = `${i.produto_id}|${unitario.toFixed(2)}`;
      const atual = agrupados.get(chave);
      if (atual) {
        atual.quantidade += i.quantidade;
      } else {
        agrupados.set(chave, {
          id: chave,
          nome: i.produto?.nome ?? 'Produto',
          quantidade: i.quantidade,
          precoUnitario: unitario,
        });
      }
    })
  );

  const clientes = clientesDaMesa(pedidos);

  return {
    mesaNumero: mesa.numero,
    pessoas: clientes.length,
    pessoasLabel:
      clientes.length > 0
        ? `${clientes.length} ${clientes.length === 1 ? 'cliente' : 'clientes'}`
        : `${mesa.capacidade} lugares`,
    status: 'aberta',
    itens: Array.from(agrupados.values()),
    descontoValor: 0,
    pagamentosRealizados: 0, // TODO: vir da API de pagamentos quando existir
    capacidade: mesa.capacidade,
    observacao: mesa.localizacao ?? undefined,
    clientes,
    pedidos,
  };
};

// ── Componente ─────────────────────────────────────────────────────────────────
const PagarMesaConteudo: React.FC<{
  id: string;
  pedidoBase: PedidoDetalhe;
  /** Recarrega a mesa na API (depois de editar/excluir/transferir/juntar) */
  onAtualizar: () => Promise<void>;
}> = ({ id, pedidoBase, onAtualizar }) => {
  const navigate = useNavigate();

  const [itens, setItens]           = useState<ItemPedido[]>(pedidoBase.itens);
  const [menuAberto, setMenuAberto] = useState(false);

  // Transferir mesa/pedidos e Juntar comandas (modal)
  const [modalMesa, setModalMesa] = useState<'transferir' | 'juntar' | null>(null);

  // Editar / excluir UM pedido da comanda (pede confirmação antes)
  const [acaoPedido, setAcaoPedido]   = useState<{ tipo: TipoAcaoPedido; pedido: PedidoApi } | null>(null);
  const [acaoSalvando, setAcaoSalvando] = useState(false);
  const [acaoErro, setAcaoErro]       = useState<string | null>(null);

  // Desconto agora vive no state (antes vinha fixo do mock) pra poder ser
  // atualizado pelo modal de Descontos.
  const [descontoValor, setDescontoValor] = useState(pedidoBase.descontoValor);

  // ── Modal "Forma de pagamento" ──────────────────────────────────────────────
  const [modalPagamentoAberto, setModalPagamentoAberto] = useState(false);
  const [formaSelecionada, setFormaSelecionada]         = useState<FormaPagamento | null>(null);

  // Valor recebido em dinheiro é guardado em CENTAVOS (número inteiro).
  // É o que permite a máscara "R$ 0,00": cada dígito digitado entra pela
  // direita, igual campo de valor de banco/maquininha.
  const [valorRecebidoCentavos, setValorRecebidoCentavos] = useState(0);
  const valorRecebidoNumero = valorRecebidoCentavos / 100;

  // ── Modal "Descontos" ────────────────────────────────────────────────────────
  const [modalDescontoAberto, setModalDescontoAberto] = useState(false);
  const [abaDesconto, setAbaDesconto]                 = useState<AbaDesconto>('cupom');
  const [codigoCupom, setCodigoCupom]                 = useState('');
  const [cupomAplicado, setCupomAplicado]             = useState<CupomDesconto | null>(null);
  const [erroCupom, setErroCupom]                     = useState('');

  // Mesmo padrão de máscara em centavos usado no valor recebido em dinheiro
  const [descontoManualCentavos, setDescontoManualCentavos] = useState(0);

  const formatarMoeda = (valor: number) =>
    valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

  // ── Máscara do campo "Valor recebido" ────────────────────────────────────
  const handleValorRecebidoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const somenteDigitos = e.target.value.replace(/\D/g, '');
    setValorRecebidoCentavos(somenteDigitos ? Number(somenteDigitos) : 0);
  };

  const subtotal    = useMemo(() => itens.reduce((acc, i) => acc + i.precoUnitario * i.quantidade, 0), [itens]);
  const taxaServico = subtotal * TAXA_SERVICO_PERCENT;
  const total        = subtotal + taxaServico - descontoValor;

  // ── "+ Adicionar item" — adiciona um item mockado direto na comanda ─────────
  const adicionarItem = () => {
    // Mesa real: lança um novo pedido na tela de pedidos, já com esta mesa escolhida
    if (pedidoBase.pedidos) {
      navigate(`/restaurante/pedido?mesa=${id}`);
      return;
    }

    const produto = PRODUTOS_DISPONIVEIS[Math.floor(Math.random() * PRODUTOS_DISPONIVEIS.length)];
    setItens((prev) => {
      const existente = prev.find((i) => i.nome === produto.nome);
      if (existente) {
        return prev.map((i) => (i.nome === produto.nome ? { ...i, quantidade: i.quantidade + 1 } : i));
      }
      return [...prev, { id: gerarIdItem(), nome: produto.nome, quantidade: 1, precoUnitario: produto.preco }];
    });
  };

  // ── Transferir pedidos / juntar pedidos ──────────────────────────────────────────────────────
  const aoConcluirTransferencia = ({ origemLiberada }: { origemLiberada: boolean; destinoNumero: number }) => {
    setModalMesa(null);
    // Transferiu tudo: esta mesa ficou livre, então não há mais o que cobrar aqui
    if (origemLiberada) {
      navigate(ROTAS_CAIXA.lista);
      return;
    }
    void onAtualizar().catch(() => undefined);
  };

  // Juntou pedidos da própria mesa: só recarrega a comanda com o pedido unido
  const aoConcluirJuncao = () => {
    setModalMesa(null);
    void onAtualizar().catch(() => undefined);
  };

  // ── Editar / excluir um pedido ───────────────────────────────────────────────
  const abrirAcaoPedido = (tipo: TipoAcaoPedido, pedido: PedidoApi) => {
    setAcaoErro(null);
    setAcaoPedido({ tipo, pedido });
  };

  const fecharAcaoPedido = () => {
    if (acaoSalvando) return;
    setAcaoPedido(null);
    setAcaoErro(null);
  };

  const confirmarAcaoPedido = async (motivo?: string) => {
    if (!acaoPedido || acaoSalvando) return;
    const { tipo, pedido } = acaoPedido;

    if (tipo === 'editar') {
      navigate(`/restaurante/pedido?editar=${pedido.id}`);
      return;
    }

    setAcaoSalvando(true);
    setAcaoErro(null);
    try {
      await PedidoService.cancelarPedido(pedido.id, motivo ?? 'Removido pelo caixa');
      setAcaoPedido(null);
      // Era o último pedido: a mesa foi liberada, volta para o caixa
      if ((pedidoBase.pedidos?.length ?? 0) <= 1) navigate(ROTAS_CAIXA.lista);
      else await onAtualizar();
    } catch (err: any) {
      setAcaoErro(mensagemDeErro(err, 'Não foi possível excluir o pedido.'));
    } finally {
      setAcaoSalvando(false);
    }
  };

  // ── Pagamento ────────────────────────────────────────────────────────────────
  const abrirModalPagamento = () => {
    setFormaSelecionada(null);
    setValorRecebidoCentavos(0);
    setModalPagamentoAberto(true);
  };

  const troco = useMemo(() => {
    if (valorRecebidoNumero < total) return null;
    return valorRecebidoNumero - total;
  }, [valorRecebidoNumero, total]);

  const podeConcluir =
    formaSelecionada !== null &&
    (formaSelecionada !== 'dinheiro' || valorRecebidoNumero >= total);

  const handleConcluirPagamento = () => {
    if (!podeConcluir) return;
    // TODO: chamar pagameto.service.ts — { mesaId: id, forma: formaSelecionada, total }
    setModalPagamentoAberto(false);
    navigate('/restaurante/caixa');
  };

  // ── Desconto ─────────────────────────────────────────────────────────────────
  const abrirModalDesconto = () => {
    setAbaDesconto('cupom');
    setCodigoCupom('');
    setErroCupom('');
    setDescontoManualCentavos(0);
    setModalDescontoAberto(true);
  };

  const aplicarCupom = () => {
    const encontrado = CUPONS_DISPONIVEIS.find(
      (c) => c.codigo.toUpperCase() === codigoCupom.trim().toUpperCase()
    );
    if (!encontrado) {
      setErroCupom('Cupom inválido');
      setCupomAplicado(null);
      return;
    }
    setErroCupom('');
    setCupomAplicado(encontrado);
  };

  const removerCupom = () => {
    setCupomAplicado(null);
    setCodigoCupom('');
    setErroCupom('');
  };

  const handleDescontoManualChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const somenteDigitos = e.target.value.replace(/\D/g, '');
    setDescontoManualCentavos(somenteDigitos ? Number(somenteDigitos) : 0);
  };

  // Valor do desconto que seria aplicado, calculado sobre o subtotal
  const descontoPreview = useMemo(() => {
    if (abaDesconto === 'cupom' && cupomAplicado) {
      return subtotal * (cupomAplicado.percentual / 100);
    }
    if (abaDesconto === 'manual') {
      return descontoManualCentavos / 100;
    }
    return 0;
  }, [abaDesconto, cupomAplicado, descontoManualCentavos, subtotal]);

  const podeAplicarDesconto =
    (abaDesconto === 'cupom' && cupomAplicado !== null) ||
    (abaDesconto === 'manual' && descontoManualCentavos > 0);

  const handleAplicarDesconto = () => {
    if (!podeAplicarDesconto) return;
    // TODO: chamar desconto.service.ts — { mesaId: id, tipo: abaDesconto, valor: descontoPreview }
    setDescontoValor(descontoPreview);
    setModalDescontoAberto(false);
  };

  return (
    <RestaurantLayout>
      <div className="pagar" onClick={() => setMenuAberto(false)}>

        {/* ── Cabeçalho ── */}
        <div className="pagar__header">
          <div className="pagar__header-info">
            <button className="pagar__voltar" onClick={() => navigate('/restaurante/caixa')} aria-label="Voltar para o caixa">
              <HiArrowLeft />
            </button>

            <div>
              <div className="pagar__titulo-linha">
                <h2 className="pagar__titulo">Mesa {String(pedidoBase.mesaNumero).padStart(2, '0')}</h2>
                <span className={`pagar__badge pagar__badge--${pedidoBase.status}`}>
                  {pedidoBase.status === 'aberta' ? 'Aberta' : 'Fechada'}
                </span>
              </div>
              <span className="pagar__pessoas">
                <HiUserGroup /> {pedidoBase.pessoasLabel ?? `${pedidoBase.pessoas} pessoas`}
              </span>
            </div>
          </div>

          <div className="pagar__header-acoes">
            <button className="pagar__btn-imprimir" onClick={() => window.print()}>
              <HiPrinter /> Imprimir
            </button>

            <div className="pagar__menu-wrap">
              <button
                className="pagar__btn-mais"
                onClick={(e) => { e.stopPropagation(); setMenuAberto((v) => !v); }}
              >
                <HiDotsVertical /> Mais opções
              </button>

              {menuAberto && (
                <div className="pagar__menu" onClick={(e) => e.stopPropagation()}>
                  <button
                    className="pagar__menu-item"
                    disabled={!pedidoBase.pedidos?.length}
                    onClick={() => { setMenuAberto(false); setModalMesa('transferir'); }}
                  >
                    <HiOutlineSwitchHorizontal /> Transferir pedidos
                  </button>
                  <button
                    className="pagar__menu-item"
                    disabled={(pedidoBase.pedidos?.length ?? 0) < 2}
                    title={(pedidoBase.pedidos?.length ?? 0) < 2 ? 'A mesa precisa ter pelo menos 2 pedidos' : undefined}
                    onClick={() => { setMenuAberto(false); setModalMesa('juntar'); }}
                  >
                    <HiOutlineDocumentDuplicate /> Juntar pedidos
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* ── Corpo ── */}
        <div className="pagar__corpo">

          {/* ── Itens do pedido ── */}
          <div className="pagar__coluna-itens">
            {/* Mesa real: os itens aparecem por pedido em "Pedidos da mesa" (abaixo).
                Esta lista consolidada só existe nas mesas de demonstração. */}
            {!pedidoBase.pedidos && (
            <div className="pagar__caixa">
              <h3 className="pagar__subtitulo">Itens do pedido</h3>

              <div className="pagar__lista">
                {itens.map((item) => (
                  <div key={item.id} className="pagar__item">
                    <span className="pagar__item-qtd-nome">
                      <span className="pagar__item-qtd">{item.quantidade}×</span> {item.nome}
                    </span>
                    {item.quantidade > 1 && (
                      <span className="pagar__item-unitario">{formatarMoeda(item.precoUnitario)}</span>
                    )}
                    <span className="pagar__item-total">{formatarMoeda(item.precoUnitario * item.quantidade)}</span>
                  </div>
                ))}
              </div>
            </div>
            )}

            <button className="pagar__btn-adicionar" onClick={adicionarItem}>
              <HiPlus /> Adicionar item
            </button>

            {/* ── Pedidos da mesa (conteúdo que antes ficava no modal de detalhes) ── */}
            {pedidoBase.pedidos && (
              <div className="pagar__caixa pagar__pedidos">
                <h3 className="pagar__subtitulo">Pedidos da mesa</h3>

                {(pedidoBase.capacidade !== undefined || pedidoBase.observacao) && (
                  <div className="pagar__det-mesa">
                    {pedidoBase.capacidade !== undefined && (
                      <span className="pagar__det-lugares">
                        <HiUserGroup /> {pedidoBase.capacidade} lugares
                      </span>
                    )}
                    {pedidoBase.observacao && (
                      <span className="pagar__det-obs">{pedidoBase.observacao}</span>
                    )}
                  </div>
                )}

                {pedidoBase.clientes && pedidoBase.clientes.length > 0 && (
                  <div className="pagar__det-clientes">
                    <strong>
                      {pedidoBase.clientes.length}{' '}
                      {pedidoBase.clientes.length === 1 ? 'cliente' : 'clientes'} na mesa
                    </strong>
                    <div className="pagar__det-clientes-lista">
                      {pedidoBase.clientes.map((nome) => (
                        <span key={nome} className="pagar__det-cliente">{nome}</span>
                      ))}
                    </div>
                  </div>
                )}

                {pedidoBase.pedidos.length === 0 ? (
                  <p className="pagar__det-vazio">Nenhum pedido em andamento nesta mesa.</p>
                ) : (
                  pedidoBase.pedidos.map((p) => (
                    <div key={p.id} className="pagar__det-pedido">
                      <div className="pagar__det-pedido-linha">
                        <strong>Pedido #{p.numero_pedido}</strong>
                        <div className="pagar__det-acoes">
                          <button
                            className="pagar__det-editar"
                            onClick={() => abrirAcaoPedido('editar', p)}
                            aria-label={`Editar pedido ${p.numero_pedido}`}
                            title="Editar pedido"
                          >
                            <HiOutlinePencil />
                          </button>
                          <button
                            className="pagar__det-editar pagar__det-lixeira"
                            onClick={() => abrirAcaoPedido('excluir', p)}
                            aria-label={`Excluir pedido ${p.numero_pedido}`}
                            title="Excluir pedido"
                          >
                            <HiOutlineTrash />
                          </button>
                        </div>
                      </div>
                      <span className="pagar__det-pedido-meta">
                        {p.cliente_nome} · {horaDoPedido(p.criado_em)} · {ROTULO_STATUS_PEDIDO[p.status] ?? p.status}
                      </span>

                      <ul className="pagar__det-itens">
                        {p.itens.map((i) => (
                          <li key={i.id}>
                            <span>{i.quantidade}x {i.produto?.nome ?? 'Produto'}</span>
                            <span>{formatarMoeda(i.preco_total)}</span>
                          </li>
                        ))}
                      </ul>

                      {p.observacoes && <p className="pagar__det-obs">Obs.: {p.observacoes}</p>}
                      <div className="pagar__det-subtotal">
                        <span>Total do pedido</span>
                        <strong>{formatarMoeda(p.total)}</strong>
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}
          </div>

          {/* ── Resumo / pagamento ── */}
          <div className="pagar__coluna-resumo">
            <div className="pagar__caixa pagar__resumo">

              <div className="pagar__resumo-linha">
                <span>Subtotal</span>
                <span>{formatarMoeda(subtotal)}</span>
              </div>

              <div className="pagar__resumo-linha">
                <span>Taxa de serviço (10%)</span>
                <span>{formatarMoeda(taxaServico)}</span>
              </div>

              {descontoValor > 0 && (
                <div className="pagar__resumo-linha pagar__resumo-linha--desconto">
                  <span>Desconto</span>
                  <span>- {formatarMoeda(descontoValor)}</span>
                </div>
              )}

              {/* Abre o modal "Descontos" (cupom ou manual) */}
              <button className="pagar__link" onClick={abrirModalDesconto}>
                registrar desconto
              </button>

              <div className="pagar__resumo-total">
                <span>Total</span>
                <span>{formatarMoeda(total)}</span>
              </div>

              {/*
                "Pagamento parcial" é outra tela (ainda não existe no projeto).
                TODO: criar a tela e registrar a rota /restaurante/caixa/mesa/:id/pagamento-parcial.
              */}
              <button
                className="pagar__btn-parcial"
                onClick={() => navigate(ROTAS_CAIXA.pagarParcial(id))}
                disabled={itens.length === 0}
              >
                Pagamento parcial
              </button>

              {/* Este é o botão que abre o modal "Forma de pagamento" */}
              <button className="pagar__btn-finalizar" onClick={abrirModalPagamento} disabled={itens.length === 0}>
                Finalizar pagamento
              </button>

              {pedidoBase.pagamentosRealizados > 0 && (
                <div className="pagar__pagamentos-realizados">
                  <div className="pagar__resumo-linha">
                    <span>Pagamentos realizados</span>
                    <span>{formatarMoeda(pedidoBase.pagamentosRealizados)}</span>
                  </div>
                  {/* TODO: criar a tela e registrar a rota /restaurante/caixa/mesa/:id/pagamentos */}
                  <button
                    className="pagar__link"
                    onClick={() => navigate(`/restaurante/caixa/mesa/${id}/pagamentos`)}
                  >
                    Ver pagamentos
                  </button>
                </div>
              )}

            </div>
          </div>
        </div>

        {/* ── Modal: Forma de pagamento (aberto pelo botão "Finalizar pagamento") ── */}
        {modalPagamentoAberto && (
          <div className="pagar__overlay" onClick={() => setModalPagamentoAberto(false)}>
            <div className="pagar__modal" onClick={(e) => e.stopPropagation()}>

              <button className="pagar__modal-fechar" onClick={() => setModalPagamentoAberto(false)} aria-label="Fechar">
                <HiX />
              </button>

              <h3 className="pagar__modal-titulo">Forma de pagamento</h3>
              <p className="pagar__modal-subtitulo">Escolha a forma de pagamento</p>

              <div className="pagar__formas-grid">
                {FORMAS_PAGAMENTO.map((forma) => (
                  <button
                    key={forma.id}
                    className={`pagar__forma${formaSelecionada === forma.id ? ' pagar__forma--ativa' : ''}`}
                    onClick={() => setFormaSelecionada(forma.id)}
                    aria-pressed={formaSelecionada === forma.id}
                  >
                    <span className="pagar__forma-icone">{forma.icone}</span>
                    <span className="pagar__forma-nome">{forma.nome}</span>
                    <span className="pagar__forma-info">{forma.info}</span>
                  </button>
                ))}

                <button
                  className={`pagar__forma pagar__forma--larga${formaSelecionada === 'outras' ? ' pagar__forma--ativa' : ''}`}
                  onClick={() => setFormaSelecionada('outras')}
                  aria-pressed={formaSelecionada === 'outras'}
                >
                  <span className="pagar__forma-icone"><HiDotsHorizontal /></span>
                  <span className="pagar__forma-textos">
                    <span className="pagar__forma-nome">Outras formas</span>
                    <span className="pagar__forma-info">Vale-refeição, Vale-alimentação, etc.</span>
                  </span>
                </button>
              </div>

              {formaSelecionada === 'dinheiro' && (
                <div className="pagar__dinheiro-campo">
                  <label className="pagar__dinheiro-label">Valor recebido</label>
                  <input
                    type="text"
                    inputMode="numeric"
                    className="pagar__dinheiro-input"
                    placeholder="R$ 0,00"
                    value={valorRecebidoCentavos > 0 ? formatarMoeda(valorRecebidoNumero) : ''}
                    onChange={handleValorRecebidoChange}
                  />
                  {valorRecebidoCentavos > 0 && valorRecebidoNumero < total && (
                    <span className="pagar__dinheiro-faltando">
                      Faltam {formatarMoeda(total - valorRecebidoNumero)}
                    </span>
                  )}
                  {troco !== null && (
                    <span className="pagar__dinheiro-troco">Troco: {formatarMoeda(troco)}</span>
                  )}
                </div>
              )}

              <button
                className="pagar__btn-concluir"
                onClick={handleConcluirPagamento}
                disabled={!podeConcluir}
              >
                concluir
              </button>

            </div>
          </div>
        )}

        {/* ── Modal: Descontos (aberto pelo botão "registrar desconto") ── */}
        {modalDescontoAberto && (
          <div className="pagar__overlay" onClick={() => setModalDescontoAberto(false)}>
            <div className="desconto__modal" onClick={(e) => e.stopPropagation()}>

              <button
                className="desconto__voltar"
                onClick={() => setModalDescontoAberto(false)}
                aria-label="Fechar"
              >
                <HiArrowLeft /> Descontos
              </button>

              <div className="desconto__abas">
                <button
                  className={`desconto__aba${abaDesconto === 'cupom' ? ' desconto__aba--ativa' : ''}`}
                  onClick={() => setAbaDesconto('cupom')}
                >
                  Cupom de desconto
                </button>
                <button
                  className={`desconto__aba${abaDesconto === 'manual' ? ' desconto__aba--ativa' : ''}`}
                  onClick={() => setAbaDesconto('manual')}
                >
                  Desconto manual
                </button>
              </div>

              {abaDesconto === 'cupom' && (
                <div className="desconto__cupom">
                  <label className="desconto__label">Código do cupom</label>
                  <div className="desconto__cupom-linha">
                    <input
                      type="text"
                      className="desconto__cupom-input"
                      placeholder="Digite o código"
                      value={codigoCupom}
                      onChange={(e) => setCodigoCupom(e.target.value)}
                      disabled={cupomAplicado !== null}
                    />
                    {cupomAplicado === null ? (
                      <button className="desconto__btn-aplicar-cupom" onClick={aplicarCupom}>
                        Aplicar
                      </button>
                    ) : (
                      <button className="desconto__btn-aplicar-cupom" onClick={removerCupom}>
                        Remover
                      </button>
                    )}
                  </div>

                  {erroCupom && <span className="desconto__erro">{erroCupom}</span>}

                  {cupomAplicado && (
                    <div className="desconto__sucesso">
                      <span>
                        Cupom aplicado com sucesso!<br />
                        <strong>{cupomAplicado.codigo}</strong> — {cupomAplicado.percentual}% de desconto
                      </span>
                      <button className="desconto__sucesso-remover" onClick={removerCupom} aria-label="Remover cupom">
                        <HiX />
                      </button>
                    </div>
                  )}
                </div>
              )}

              {abaDesconto === 'manual' && (
                <div className="desconto__manual">
                  <label className="desconto__label">Valor do desconto</label>
                  <input
                    type="text"
                    inputMode="numeric"
                    className="desconto__manual-input"
                    placeholder="R$ 0,00"
                    value={
                      descontoManualCentavos > 0
                        ? formatarMoeda(descontoManualCentavos / 100)
                        : ''
                    }
                    onChange={handleDescontoManualChange}
                  />
                </div>
              )}

              <div className="desconto__resumo">
                <div className="pagar__resumo-linha">
                  <span>Subtotal</span>
                  <span>{formatarMoeda(subtotal)}</span>
                </div>
                <div className="pagar__resumo-linha pagar__resumo-linha--desconto">
                  <span>Desconto</span>
                  <span>- {formatarMoeda(descontoPreview)}</span>
                </div>
                <div className="pagar__resumo-total">
                  <span>Total com desconto</span>
                  <span>{formatarMoeda(subtotal + taxaServico - descontoPreview)}</span>
                </div>
              </div>

              <button
                className="pagar__btn-finalizar"
                onClick={handleAplicarDesconto}
                disabled={!podeAplicarDesconto}
              >
                Aplicar desconto
              </button>

            </div>
          </div>
        )}

      </div>

      {modalMesa === 'transferir' && pedidoBase.pedidos && (
        <TransferirMesaModal
          mesa={{ id, numero: pedidoBase.mesaNumero }}
          pedidos={pedidoBase.pedidos}
          onFechar={() => setModalMesa(null)}
          onConcluido={aoConcluirTransferencia}
        />
      )}

      {modalMesa === 'juntar' && pedidoBase.pedidos && (
        <JuntarPedidosModal
          mesa={{ id, numero: pedidoBase.mesaNumero }}
          pedidos={pedidoBase.pedidos}
          onFechar={() => setModalMesa(null)}
          onConcluido={aoConcluirJuncao}
        />
      )}

      <ConfirmarAcaoPedido
        aberto={acaoPedido !== null}
        tipo={acaoPedido?.tipo ?? 'editar'}
        pedido={acaoPedido?.pedido ?? null}
        salvando={acaoSalvando}
        erro={acaoErro}
        onConfirmar={(motivo) => void confirmarAcaoPedido(motivo)}
        onFechar={fecharAcaoPedido}
      />
    </RestaurantLayout>
  );
};

// ── Rota: descobre a mesa pelo :id da URL ─────────────────────────────────────
// • id do mock (m1…m6)  → usa os dados de demonstração acima
// • qualquer outro id   → é o id de uma mesa real: busca a mesa e os pedidos em
//                         andamento dela na API (é o id que o card do Caixa envia)
// Mesa inexistente → volta para o caixa. O key={id} faz o state interno
// (itens, desconto...) recomeçar do zero se o id da URL mudar.
type EstadoCarga =
  | { tipo: 'carregando' }
  | { tipo: 'erro'; mensagem: string }
  | { tipo: 'naoEncontrada' }
  | { tipo: 'ok'; pedido: PedidoDetalhe };

// Busca a mesa e os pedidos em andamento dela na API
const buscarMesa = async (mesaId: string): Promise<EstadoCarga> => {
  try {
    const [mesas, pedidos] = await Promise.all([
      MesaService.listar(),
      PedidoService.listar({ status: STATUS_EM_ANDAMENTO, modalidade: 'MESA', mesa_id: mesaId }),
    ]);

    const mesa = mesas.find((m) => m.id === mesaId);
    if (!mesa) return { tipo: 'naoEncontrada' };

    // Garante que só entram pedidos desta mesa, mesmo se a API ignorar o filtro
    const daMesa = pedidos.filter((p) => p.mesa?.id === mesaId);
    return { tipo: 'ok', pedido: montarPedidoDaApi(mesa, daMesa) };
  } catch (err: any) {
    return { tipo: 'erro', mensagem: mensagemDeErro(err, 'Não foi possível carregar a mesa.') };
  }
};

const PagarMesa: React.FC = () => {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const pedidoMock = id ? PEDIDOS_DETALHE_MOCK[id] : undefined;

  const [estado, setEstado]       = useState<EstadoCarga>({ tipo: 'carregando' });
  const [tentativa, setTentativa] = useState(0);
  // Muda a cada recarga: faz o conteúdo recomeçar com os dados novos da API
  const [versao, setVersao]       = useState(0);

  useEffect(() => {
    if (!id || pedidoMock) return;

    let cancelado = false;
    setEstado({ tipo: 'carregando' });

    buscarMesa(id).then((novo) => {
      if (!cancelado) setEstado(novo);
    });

    return () => { cancelado = true; };
  }, [id, pedidoMock, tentativa]);

  // Recarrega sem piscar a tela de "Carregando": usado depois de editar/excluir/transferir/juntar
  const recarregar = useCallback(async () => {
    if (!id) return;
    const novo = await buscarMesa(id);
    if (novo.tipo === 'ok') {
      setEstado(novo);
      setVersao((v) => v + 1);
    } else if (novo.tipo === 'naoEncontrada') {
      navigate(ROTAS_CAIXA.lista);
    } else if (novo.tipo === 'erro') {
      throw new Error(novo.mensagem);
    }
  }, [id, navigate]);

  if (!id) return <Navigate to={ROTAS_CAIXA.lista} replace />;

  if (pedidoMock) return <PagarMesaConteudo key={id} id={id} pedidoBase={pedidoMock} onAtualizar={async () => undefined} />;

  if (estado.tipo === 'naoEncontrada') return <Navigate to={ROTAS_CAIXA.lista} replace />;

  if (estado.tipo === 'ok') return <PagarMesaConteudo key={`${id}-${versao}`} id={id} pedidoBase={estado.pedido} onAtualizar={recarregar} />;

  return (
    <RestaurantLayout>
      <div className="pagar">
        <div className="pagar__caixa pagar__estado" role={estado.tipo === 'erro' ? 'alert' : 'status'}>
          {estado.tipo === 'erro' ? (
            <>
              <span>{estado.mensagem}</span>
              <div className="pagar__estado-acoes">
                <button className="pagar__btn-parcial" onClick={() => setTentativa((t) => t + 1)}>
                  Tentar de novo
                </button>
                <button className="pagar__btn-parcial" onClick={() => navigate(ROTAS_CAIXA.lista)}>
                  Voltar ao caixa
                </button>
              </div>
            </>
          ) : (
            <span>Carregando mesa...</span>
          )}
        </div>
      </div>
    </RestaurantLayout>
  );
};

export default PagarMesa;
