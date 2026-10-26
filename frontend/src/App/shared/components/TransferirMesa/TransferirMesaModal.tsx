import React, { useEffect, useMemo, useState } from 'react';
import { HiOutlineExclamation, HiOutlineSwitchHorizontal, HiX } from 'react-icons/hi';
import MesaService, { Mesa as MesaApi } from '../../../services/mesa.service';
import PedidoService, { Pedido as PedidoApi } from '../../../services/pedido.service';
import { mensagemDeErro } from '../../../services/cliente.service';
import './TransferirMesaModal.css';

type Situacao = 'livre' | 'ocupada' | 'reservada';

interface MesaOpcao {
  mesa: MesaApi;
  situacao: Situacao;
  pedidos: PedidoApi[];
  clientes: string[];
  total: number;
}

interface Props {
  mesa: { id: string; numero: number };
  /** Pedidos em andamento da mesa atual */
  pedidos: PedidoApi[];
  onFechar: () => void;
  onConcluido: (resultado: { origemLiberada: boolean; destinoNumero: number }) => void;
}

const STATUS_EM_ANDAMENTO: PedidoApi['status'][] = ['RECEBIDO', 'PREPARO', 'PRONTO'];

const moeda = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const rotuloMesa = (n: number) => `Mesa ${String(n).padStart(2, '0')}`;
const ROTULO_SITUACAO: Record<Situacao, string> = { livre: 'Livre', ocupada: 'Ocupada', reservada: 'Reservada' };

const nomesUnicos = (pedidos: PedidoApi[]) => {
  const vistos = new Map<string, string>();
  pedidos.forEach((p) => {
    const nome = p.cliente_nome.trim().replace(/\s+/g, ' ');
    if (nome && !vistos.has(nome.toLowerCase())) vistos.set(nome.toLowerCase(), nome);
  });
  return Array.from(vistos.values());
};

/**
 * Transferir pedidos: leva pedidos desta mesa para OUTRA mesa.
 * Escolhe os pedidos (todos por padrão) e a mesa de destino; se o destino já está ocupado por
 * outro cliente (ou reservado), pede uma segunda confirmação antes de mover.
 */
const TransferirMesaModal: React.FC<Props> = ({ mesa, pedidos, onFechar, onConcluido }) => {

  const [carregando, setCarregando] = useState(true);
  const [erroCarga, setErroCarga] = useState<string | null>(null);
  const [opcoes, setOpcoes] = useState<MesaOpcao[]>([]);
  const [tentativa, setTentativa] = useState(0);

  const [escolhidaId, setEscolhidaId] = useState<string | null>(null);
  const [selecionados, setSelecionados] = useState<Set<string>>(() => new Set(pedidos.map((p) => p.id)));
  const [etapa, setEtapa] = useState<'escolher' | 'confirmar'>('escolher');

  const [salvando, setSalvando] = useState(false);
  const [erroAcao, setErroAcao] = useState<string | null>(null);

  // Mesas e quem está nelas agora (dados frescos da API, não o que a tela guardou)
  useEffect(() => {
    let cancelado = false;
    setCarregando(true);
    setErroCarga(null);

    (async () => {
      try {
        const [mesas, abertos] = await Promise.all([
          MesaService.listar(),
          PedidoService.listar({ status: STATUS_EM_ANDAMENTO, modalidade: 'MESA' }),
        ]);
        if (cancelado) return;

        const porMesa = new Map<string, PedidoApi[]>();
        abertos.forEach((p) => {
          if (p.mesa) porMesa.set(p.mesa.id, [...(porMesa.get(p.mesa.id) ?? []), p]);
        });

        const lista = mesas
          .filter((m) => m.id !== mesa.id && m.ativo && m.status !== 'INATIVA')
          .map((m): MesaOpcao => {
            const doMesa = porMesa.get(m.id) ?? [];
            const situacao: Situacao =
              doMesa.length > 0 || m.status === 'OCUPADA' ? 'ocupada' : m.status === 'RESERVADA' ? 'reservada' : 'livre';
            return {
              mesa: m,
              situacao,
              pedidos: doMesa,
              clientes: nomesUnicos(doMesa),
              total: doMesa.reduce((s, p) => s + p.total, 0),
            };
          })
          .sort((a, b) => a.mesa.numero - b.mesa.numero);

        setOpcoes(lista);
      } catch (err: any) {
        if (!cancelado) setErroCarga(mensagemDeErro(err, 'Não foi possível carregar as mesas.'));
      } finally {
        if (!cancelado) setCarregando(false);
      }
    })();

    return () => { cancelado = true; };
  }, [mesa.id, tentativa]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && !salvando && onFechar();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [salvando, onFechar]);

  const escolhida = useMemo(() => opcoes.find((o) => o.mesa.id === escolhidaId) ?? null, [opcoes, escolhidaId]);

  const alternarPedido = (id: string) =>
    setSelecionados((atual) => {
      const novo = new Set(atual);
      if (novo.has(id)) novo.delete(id); else novo.add(id);
      return novo;
    });

  const todosSelecionados = selecionados.size === pedidos.length;
  // Destino com gente (ou reservado) exige a segunda confirmação
  const exigeConfirmacao = !!escolhida && escolhida.situacao !== 'livre';
  const podeAvancar = !!escolhida && selecionados.size > 0 && !salvando;

  const executar = async () => {
    if (!escolhida) return;
    setSalvando(true);
    setErroAcao(null);
    try {
      const resultado = await PedidoService.transferir({
        origem_mesa_id: mesa.id,
        destino_mesa_id: escolhida.mesa.id,
        pedido_ids: todosSelecionados ? undefined : Array.from(selecionados),
        confirmar_mesa_ocupada: escolhida.situacao !== 'livre',
      });
      onConcluido({ origemLiberada: resultado.origem_liberada, destinoNumero: resultado.destino_numero });
    } catch (err: any) {
      setErroAcao(mensagemDeErro(err, 'Não foi possível transferir os pedidos.'));
      setSalvando(false);
    }
  };

  const avancar = () => {
    if (!podeAvancar) return;
    if (exigeConfirmacao && etapa === 'escolher') {
      setErroAcao(null);
      setEtapa('confirmar');
      return;
    }
    void executar();
  };

  return (
    <div className="transf__overlay" onClick={() => !salvando && onFechar()}>
      <div className="transf__modal" role="dialog" aria-modal="true" aria-labelledby="transf-titulo" onClick={(e) => e.stopPropagation()}>
        <div className="transf__header">
          <span className="transf__icone"><HiOutlineSwitchHorizontal /></span>
          <div className="transf__header-texto">
            <h3 id="transf-titulo" className="transf__titulo">Transferir pedidos</h3>
            <p className="transf__subtitulo">Origem: {rotuloMesa(mesa.numero)}</p>
          </div>
          <button className="transf__fechar" onClick={onFechar} disabled={salvando} aria-label="Fechar"><HiX /></button>
        </div>

        <div className="transf__corpo">
          {etapa === 'escolher' && (
            <>
              {/* Transferir: escolha dos pedidos (só aparece se houver mais de um) */}
              {pedidos.length > 1 && (
                <div className="transf__secao">
                  <div className="transf__secao-topo">
                    <strong>Pedidos a transferir</strong>
                    <button
                      className="transf__link"
                      onClick={() => setSelecionados(todosSelecionados ? new Set() : new Set(pedidos.map((p) => p.id)))}
                    >
                      {todosSelecionados ? 'Desmarcar todos' : 'Selecionar todos'}
                    </button>
                  </div>
                  {pedidos.map((p) => (
                    <label key={p.id} className="transf__pedido">
                      <input type="checkbox" checked={selecionados.has(p.id)} onChange={() => alternarPedido(p.id)} />
                      <span>#{p.numero_pedido} · {p.cliente_nome}</span>
                      <span className="transf__pedido-valor">{moeda(p.total)}</span>
                    </label>
                  ))}
                  {!todosSelecionados && selecionados.size > 0 && (
                    <p className="transf__dica">A {rotuloMesa(mesa.numero)} continua aberta com os pedidos que ficarem.</p>
                  )}
                </div>
              )}

              <div className="transf__secao">
                <strong>Mesa de destino</strong>

                {carregando && <p className="transf__estado">Carregando mesas…</p>}
                {!carregando && erroCarga && (
                  <p className="transf__estado transf__estado--erro" role="alert">
                    {erroCarga} <button className="transf__link" onClick={() => setTentativa((n) => n + 1)}>Tentar novamente</button>
                  </p>
                )}
                {!carregando && !erroCarga && opcoes.length === 0 && (
                  <p className="transf__estado">Nenhuma outra mesa disponível.</p>
                )}

                <div className="transf__grade">
                  {opcoes.map((o) => (
                    <button
                      key={o.mesa.id}
                      className={`transf__mesa transf__mesa--${o.situacao}${escolhidaId === o.mesa.id ? ' transf__mesa--ativa' : ''}`}
                      onClick={() => setEscolhidaId(o.mesa.id)}
                      aria-pressed={escolhidaId === o.mesa.id}
                    >
                      <span className="transf__mesa-numero">{rotuloMesa(o.mesa.numero)}</span>
                      <span className="transf__mesa-status">{ROTULO_SITUACAO[o.situacao]}</span>
                      {o.clientes.length > 0 && <span className="transf__mesa-sub">{o.clientes.join(', ')}</span>}
                    </button>
                  ))}
                </div>
              </div>
            </>
          )}

          {/* Segunda confirmação: destino ocupado ou reservado */}
          {etapa === 'confirmar' && escolhida && (
            <div className="transf__confirmar">
              <div className="transf__aviso">
                <HiOutlineExclamation />
                <div>
                  {escolhida.pedidos.length > 0 ? (
                    <>
                      <strong>A {rotuloMesa(escolhida.mesa.numero)} já está ocupada por outro cliente.</strong>
                      <p>
                        {escolhida.clientes.join(', ')} · {escolhida.pedidos.length}{' '}
                        {escolhida.pedidos.length === 1 ? 'pedido' : 'pedidos'} · {moeda(escolhida.total)}
                      </p>
                      <p>Deseja realmente transferir? Os pedidos ficarão juntos na comanda da {rotuloMesa(escolhida.mesa.numero)}.</p>
                    </>
                  ) : (
                    <>
                      <strong>A {rotuloMesa(escolhida.mesa.numero)} está {ROTULO_SITUACAO[escolhida.situacao].toLowerCase()}.</strong>
                      <p>Deseja realmente transferir os pedidos para esta mesa? A reserva será desfeita ao ocupá-la.</p>
                    </>
                  )}
                </div>
              </div>
            </div>
          )}

          {erroAcao && <div className="transf__erro" role="alert">{erroAcao}</div>}
        </div>

        <div className="transf__acoes">
          <button
            className="transf__btn transf__btn--sec"
            onClick={() => (etapa === 'confirmar' ? setEtapa('escolher') : onFechar())}
            disabled={salvando}
          >
            {etapa === 'confirmar' ? 'Voltar' : 'Cancelar'}
          </button>
          <button className="transf__btn transf__btn--prim" onClick={avancar} disabled={!podeAvancar}>
            {salvando
              ? 'Transferindo…'
              : etapa === 'confirmar'
                ? 'Sim, transferir'
                : exigeConfirmacao
                  ? 'Continuar'
                  : `Transferir${escolhida ? ` para ${rotuloMesa(escolhida.mesa.numero)}` : ''}`}
          </button>
        </div>
      </div>
    </div>
  );
};

export default TransferirMesaModal;
