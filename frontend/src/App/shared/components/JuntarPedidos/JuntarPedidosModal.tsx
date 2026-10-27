import React, { useEffect, useMemo, useState } from 'react';
import { HiOutlineDocumentDuplicate, HiOutlineExclamation, HiX } from 'react-icons/hi';
import PedidoService, { Pedido as PedidoApi } from '../../../services/pedido.service';
import { mensagemDeErro } from '../../../services/cliente.service';
import '../TransferirMesa/TransferirMesaModal.css';

interface Props {
  mesa: { id: string; numero: number };
  /** Pedidos em andamento da mesa */
  pedidos: PedidoApi[];
  onFechar: () => void;
  onConcluido: () => void;
}

const moeda = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const rotuloMesa = (n: number) => `Mesa ${String(n).padStart(2, '0')}`;
const hora = (iso: string) => new Date(iso).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
const ROTULO_STATUS: Record<string, string> = { RECEBIDO: 'Recebido', PREPARO: 'Em preparo', PRONTO: 'Pronto' };
const ORDEM_STATUS = ['RECEBIDO', 'PREPARO', 'PRONTO'];

const qtdItens = (p: PedidoApi) => p.itens.reduce((s, i) => s + i.quantidade, 0);

const nomesUnicos = (pedidos: PedidoApi[]) => {
  const vistos = new Map<string, string>();
  pedidos.forEach((p) => {
    const nome = p.cliente_nome.trim().replace(/\s+/g, ' ');
    if (nome && !vistos.has(nome.toLowerCase())) vistos.set(nome.toLowerCase(), nome);
  });
  return Array.from(vistos.values());
};

/**
 * Juntar pedidos: une VÁRIOS pedidos DA MESMA MESA em um só.
 * O pedido mais antigo recebe os itens dos outros; os outros ficam cancelados como
 * "Unido ao pedido #N". Nada muda de mesa — para levar pedidos a outra mesa use "Transferir pedidos".
 */
const JuntarPedidosModal: React.FC<Props> = ({ mesa, pedidos, onFechar, onConcluido }) => {
  const [selecionados, setSelecionados] = useState<Set<string>>(new Set());
  const [etapa, setEtapa] = useState<'escolher' | 'confirmar'>('escolher');
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && !salvando && onFechar();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [salvando, onFechar]);

  const ordenados = useMemo(
    () => [...pedidos].sort((a, b) => a.numero_pedido - b.numero_pedido),
    [pedidos]
  );
  const escolhidos = useMemo(() => ordenados.filter((p) => selecionados.has(p.id)), [ordenados, selecionados]);

  // Prévia do pedido resultante
  const principal = escolhidos[0];
  const totalUnido = escolhidos.reduce((s, p) => s + p.total, 0);
  const itensUnidos = escolhidos.reduce((s, p) => s + qtdItens(p), 0);
  const clientes = nomesUnicos(escolhidos);
  const statusFinal = escolhidos.length
    ? [...escolhidos].map((p) => p.status as string).sort((a, b) => ORDEM_STATUS.indexOf(a) - ORDEM_STATUS.indexOf(b))[0]
    : null;
  const statusDiferentes = new Set(escolhidos.map((p) => p.status)).size > 1;
  const numeros = escolhidos.map((p) => `#${p.numero_pedido}`).join(', ');

  const podeContinuar = escolhidos.length >= 2 && !salvando;

  const alternar = (id: string) =>
    setSelecionados((atual) => {
      const novo = new Set(atual);
      if (novo.has(id)) novo.delete(id); else novo.add(id);
      return novo;
    });

  const juntar = async () => {
    if (!podeContinuar) return;
    setSalvando(true);
    setErro(null);
    try {
      await PedidoService.juntar({ mesa_id: mesa.id, pedido_ids: escolhidos.map((p) => p.id) });
      onConcluido();
    } catch (err: any) {
      setErro(mensagemDeErro(err, 'Não foi possível juntar os pedidos.'));
      setSalvando(false);
    }
  };

  return (
    <div className="transf__overlay" onClick={() => !salvando && onFechar()}>
      <div className="transf__modal" role="dialog" aria-modal="true" aria-labelledby="juntar-titulo" onClick={(e) => e.stopPropagation()}>
        <div className="transf__header">
          <span className="transf__icone"><HiOutlineDocumentDuplicate /></span>
          <div className="transf__header-texto">
            <h3 id="juntar-titulo" className="transf__titulo">Juntar pedidos</h3>
            <p className="transf__subtitulo">Unir pedidos da {rotuloMesa(mesa.numero)} em um só</p>
          </div>
          <button className="transf__fechar" onClick={onFechar} disabled={salvando} aria-label="Fechar"><HiX /></button>
        </div>

        <div className="transf__corpo">
          {etapa === 'escolher' && (
            <div className="transf__secao">
              <div className="transf__secao-topo">
                <strong>Escolha os pedidos a juntar (mínimo 2)</strong>
                <button
                  className="transf__link"
                  onClick={() => setSelecionados(selecionados.size === pedidos.length ? new Set() : new Set(pedidos.map((p) => p.id)))}
                >
                  {selecionados.size === pedidos.length ? 'Desmarcar todos' : 'Selecionar todos'}
                </button>
              </div>

              {ordenados.map((p) => (
                <label key={p.id} className="transf__pedido">
                  <input type="checkbox" checked={selecionados.has(p.id)} onChange={() => alternar(p.id)} />
                  <span>
                    #{p.numero_pedido} · {p.cliente_nome}
                    <small style={{ display: 'block', color: '#888' }}>
                      {hora(p.criado_em)} · {ROTULO_STATUS[p.status] ?? p.status} · {qtdItens(p)} {qtdItens(p) === 1 ? 'item' : 'itens'}
                    </small>
                  </span>
                  <span className="transf__pedido-valor">{moeda(p.total)}</span>
                </label>
              ))}

              {escolhidos.length >= 2 && principal && (
                <p className="transf__dica">
                  Resultado: pedido #{principal.numero_pedido} com {itensUnidos} {itensUnidos === 1 ? 'item' : 'itens'} · {moeda(totalUnido)}
                </p>
              )}
            </div>
          )}

          {etapa === 'confirmar' && principal && (
            <div className="transf__aviso">
              <HiOutlineExclamation />
              <div>
                <strong>Tem certeza que deseja juntar os pedidos {numeros}?</strong>
                <p>
                  Os itens passam para o pedido <b>#{principal.numero_pedido}</b> ({moeda(totalUnido)}). Os outros
                  serão cancelados com a observação "Unido ao pedido #{principal.numero_pedido}".
                </p>
                {clientes.length > 1 && (
                  <p>Os pedidos são de clientes diferentes ({clientes.join(', ')}): o pedido unido ficará no nome de todos.</p>
                )}
                {statusDiferentes && statusFinal && (
                  <p>Os pedidos estão em etapas diferentes: o pedido unido voltará para "{ROTULO_STATUS[statusFinal]}".</p>
                )}
                <p>O cliente verá essa alteração nos pedidos dele.</p>
              </div>
            </div>
          )}

          {erro && <div className="transf__erro" role="alert">{erro}</div>}
        </div>

        <div className="transf__acoes">
          <button
            className="transf__btn transf__btn--sec"
            onClick={() => (etapa === 'confirmar' ? setEtapa('escolher') : onFechar())}
            disabled={salvando}
          >
            {etapa === 'confirmar' ? 'Voltar' : 'Cancelar'}
          </button>
          <button
            className="transf__btn transf__btn--prim"
            disabled={!podeContinuar}
            onClick={() => (etapa === 'escolher' ? (setErro(null), setEtapa('confirmar')) : void juntar())}
          >
            {salvando ? 'Juntando…' : etapa === 'confirmar' ? 'Sim, juntar pedidos' : 'Continuar'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default JuntarPedidosModal;
