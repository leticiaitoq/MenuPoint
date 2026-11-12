import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { MdReceiptLong } from 'react-icons/md';
import { HiBell, HiChevronDown, HiVolumeOff, HiVolumeUp } from 'react-icons/hi';
import PedidoService, { Pedido } from '../../../services/pedido.service';
import './NovosPedidosDelivery.css';

/**
 * Aviso de mudanças na fila: pedidos novos do delivery (entrega e retirada, feitos pelo link do restaurante)
 * e do local (mesa, feitos pelo QR Code ou lançados no salão). Pedido de mesa que ganha item novo
 * também avisa de novo, porque volta a aguardar aceite.
 * Fica no layout do restaurante, então existe em QUALQUER tela.
 *  - Por padrão fica FECHADO: só um sino com o contador, no canto de baixo à direita.
 *    Só abre quando a pessoa clica nele (e fecha na setinha). Trocar de tela não reabre.
 *  - Som próprio (três notas subindo), diferente do bipe dos chamados de mesa, quando chega pedido novo.
 *  - Texto neutro ("Há mudanças na fila"); o detalhe de cada pedido está na Fila.
 *
 * Sobre o som: o navegador só deixa tocar áudio depois que a pessoa interagiu com a página uma vez
 * (clique ou tecla). Antes disso o som fica pendente e toca no primeiro clique; o sino mostra um
 * alto-falante cortado enquanto estiver bloqueado. Para liberar de vez no Chrome/Edge:
 * cadeado da barra de endereço > Configurações do site > Som > Permitir.
 *
 * O layout é remontado a cada troca de tela, por isso o que precisa sobreviver (áudio, pedidos já vistos
 * e se o card está aberto) mora fora do componente.
 */

const INTERVALO_MS = 10_000;
const CHAVE_SOM = 'mp_pedidos_delivery_som';
const CHAVE_VISTOS = 'mp_pedidos_delivery_vistos';

// ---- estado que sobrevive à troca de tela ----
let contextoAudio: AudioContext | null = null;
let cartaoAberto = false;
const pedidosVistos: Set<string> = (() => {
  try {
    const salvo = sessionStorage.getItem(CHAVE_VISTOS);
    return new Set<string>(salvo ? (JSON.parse(salvo) as string[]) : []);
  } catch {
    return new Set<string>();
  }
})();

const salvarVistos = () => {
  try {
    sessionStorage.setItem(CHAVE_VISTOS, JSON.stringify([...pedidosVistos].slice(-500)));
  } catch { /* ignora */ }
};

const obterContexto = (): AudioContext | null => {
  if (!contextoAudio) {
    try {
      const Ctor = window.AudioContext ?? (window as any).webkitAudioContext;
      if (Ctor) contextoAudio = new Ctor();
    } catch { /* sem áudio */ }
  }
  return contextoAudio;
};

const lerSomLigado = (): boolean => {
  try { return localStorage.getItem(CHAVE_SOM) !== 'off'; } catch { return true; }
};

const haQuantoTempo = (iso: string, agora: number): string => {
  const min = Math.max(0, Math.floor((agora - new Date(iso).getTime()) / 60_000));
  if (min < 1) return 'agora mesmo';
  if (min < 60) return `há ${min} min`;
  return `há ${Math.floor(min / 60)} h`;
};

const chaveDoPedido = (p: Pedido): string => `${p.id}:${p.itens?.length ?? 0}`;

// Delivery mostra só o nome do cliente; pedido de mesa mostra "Mesa N" antes do nome
const quemPediu = (p: Pedido): string =>
  p.modalidade === 'MESA' && p.mesa ? `Mesa ${p.mesa.numero} · ${p.cliente_nome}` : p.cliente_nome;

const moeda = (v: number): string =>
  Number(v).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

/**
 * Três notas subindo (dó-mi-sol), timbre "triangle".
 * Devolve false se o navegador ainda está bloqueando o áudio (nada é agendado, para não tocar atrasado).
 */
const tocarSomPedido = (): boolean => {
  const ctx = obterContexto();
  if (!ctx) return false;
  if (ctx.state !== 'running') {
    void ctx.resume().catch(() => undefined);
    return false;
  }
  try {
    [523.25, 659.25, 783.99].forEach((freq, i) => {
      const inicio = ctx.currentTime + i * 0.16;
      const osc = ctx.createOscillator();
      const ganho = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.value = freq;
      ganho.gain.setValueAtTime(0.0001, inicio);
      ganho.gain.exponentialRampToValueAtTime(0.3, inicio + 0.03);
      ganho.gain.exponentialRampToValueAtTime(0.0001, inicio + (i === 2 ? 0.5 : 0.22));
      osc.connect(ganho).connect(ctx.destination);
      osc.start(inicio);
      osc.stop(inicio + (i === 2 ? 0.52 : 0.24));
    });
    return true;
  } catch {
    return false;
  }
};

const NovosPedidosDelivery: React.FC = () => {
  const navigate = useNavigate();
  const [pedidos, setPedidos] = useState<Pedido[]>([]);
  const [agora, setAgora] = useState(() => Date.now());
  const [aberto, setAbertoState] = useState(cartaoAberto);
  const [somLigado, setSomLigado] = useState(lerSomLigado);
  const [somBloqueado, setSomBloqueado] = useState(false);

  const somRef = useRef(somLigado);
  somRef.current = somLigado;
  const somPendente = useRef(false);

  const definirAberto = (valor: boolean) => {
    cartaoAberto = valor;
    setAbertoState(valor);
  };

  // Tenta tocar; se o navegador bloqueou, deixa pendente e avisa no sino
  const avisarComSom = useCallback(() => {
    const tocou = tocarSomPedido();
    somPendente.current = !tocou;
    setSomBloqueado(!tocou);
  }, []);

  // Cria o áudio já ao montar e libera no primeiro gesto (a liberação fica valendo para o app todo)
  useEffect(() => {
    obterContexto();
    const destravar = () => {
      const ctx = obterContexto();
      if (!ctx) return;
      void ctx.resume().then(() => {
        if (ctx.state !== 'running') return;
        setSomBloqueado(false);
        if (somPendente.current && somRef.current) {
          somPendente.current = false;
          tocarSomPedido();
        }
      }).catch(() => undefined);
    };
    const eventos: Array<keyof WindowEventMap> = ['pointerdown', 'keydown', 'touchstart'];
    eventos.forEach((e) => window.addEventListener(e, destravar, { passive: true }));
    return () => eventos.forEach((e) => window.removeEventListener(e, destravar));
  }, []);

  const carregar = useCallback(async () => {
    try {
      // Só pedidos ainda não aceitos (RECEBIDO), de qualquer origem: delivery (entrega/retirada) e local (mesa).
      // Chamados de garçom e pedidos de conta têm outro aviso (ChamadosMesa).
      const lista = (await PedidoService.listar({ status: ['RECEBIDO'] }))
        .sort((a, b) => new Date(a.criado_em).getTime() - new Date(b.criado_em).getTime());
      // A chave inclui a quantidade de itens: item novo em pedido de mesa já visto conta como mudança
      const novos = lista.filter((p) => !pedidosVistos.has(chaveDoPedido(p)));
      if (novos.length > 0) {
        novos.forEach((p) => pedidosVistos.add(chaveDoPedido(p)));
        salvarVistos();
        if (somRef.current) avisarComSom();
      }
      setPedidos(lista);
    } catch {
      /* falha de rede ou perfil sem acesso: não incomoda a tela, tenta de novo no próximo ciclo */
    }
  }, [avisarComSom]);

  useEffect(() => {
    void carregar();
    // Continua rodando com a aba em segundo plano: o som avisa mesmo assim
    const timer = window.setInterval(() => {
      setAgora(Date.now());
      void carregar();
    }, INTERVALO_MS);
    return () => window.clearInterval(timer);
  }, [carregar]);

  const alternarSom = () => {
    const novo = !somLigado;
    setSomLigado(novo);
    try { localStorage.setItem(CHAVE_SOM, novo ? 'on' : 'off'); } catch { /* ignora */ }
    if (novo) {
      const tocou = tocarSomPedido(); // toca um exemplo ao ligar
      setSomBloqueado(!tocou);
    }
  };

  if (pedidos.length === 0) return null;

  if (!aberto) {
    return (
      <button
        type="button"
        className="pedidos-delivery-fab"
        onClick={() => definirAberto(true)}
        aria-label={`Há mudanças na fila: ${pedidos.length} pedido(s) aguardando. Abrir aviso`}
        title={somBloqueado && somLigado ? 'Há mudanças na fila (clique em qualquer lugar para liberar o som)' : 'Há mudanças na fila'}
      >
        <HiBell aria-hidden="true" />
        <span className="pedidos-delivery-fab__contador">{pedidos.length > 99 ? '99+' : pedidos.length}</span>
        {somBloqueado && somLigado && (
          <span className="pedidos-delivery-fab__mudo" aria-hidden="true"><HiVolumeOff /></span>
        )}
      </button>
    );
  }

  return (
    <div className="pedidos-delivery-alerta" role="status" aria-live="polite">
      <div className="pedidos-delivery-alerta__topo">
        <span className="pedidos-delivery-alerta__sino" aria-hidden="true"><HiBell /></span>
        <strong className="pedidos-delivery-alerta__titulo">Há mudanças na fila</strong>
        <button
          type="button"
          className="pedidos-delivery-alerta__som"
          onClick={alternarSom}
          aria-label={somLigado ? 'Desligar o som do aviso' : 'Ligar o som do aviso'}
          title={somLigado ? 'Som ligado' : 'Som desligado'}
        >
          {somLigado ? <HiVolumeUp /> : <HiVolumeOff />}
        </button>
        <button
          type="button"
          className="pedidos-delivery-alerta__som"
          onClick={() => definirAberto(false)}
          aria-label="Minimizar o aviso"
          title="Minimizar"
        >
          <HiChevronDown />
        </button>
      </div>

      <p className="pedidos-delivery-alerta__resumo">
        {pedidos.length === 1 ? '1 pedido aguardando' : `${pedidos.length} pedidos aguardando`}
      </p>

      <ul className="pedidos-delivery-alerta__lista">
        {pedidos.slice(0, 4).map((p) => (
          <li key={p.id} className="pedidos-delivery-alerta__item">
            <span className="pedidos-delivery-alerta__icone" aria-hidden="true"><MdReceiptLong /></span>
            <div className="pedidos-delivery-alerta__info">
              <strong>Pedido #{p.numero_pedido}</strong>
              <span>
                {quemPediu(p)} · {moeda(p.total)} · {haQuantoTempo(p.criado_em, agora)}
              </span>
            </div>
          </li>
        ))}
      </ul>
      {pedidos.length > 4 && (
        <p className="pedidos-delivery-alerta__mais">+ {pedidos.length - 4} pedido(s) aguardando</p>
      )}

      <button
        type="button"
        className="pedidos-delivery-alerta__btn"
        onClick={() => {
          definirAberto(false);
          navigate('/restaurante/fila');
        }}
      >
        Ver na Fila
      </button>
    </div>
  );
};

export default NovosPedidosDelivery;
