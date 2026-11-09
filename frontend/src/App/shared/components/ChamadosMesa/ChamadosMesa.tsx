import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { FaConciergeBell, FaReceipt } from 'react-icons/fa';
import { HiBell, HiVolumeOff, HiVolumeUp } from 'react-icons/hi';
import ChamadoMesaService, { ChamadoMesa } from '../../../services/chamadoMesa.service';
import './ChamadosMesa.css';

/**
 * Aviso fixo dos chamados feitos pelo cliente na mesa ("Chamar garçom" e "Fechar a conta").
 * Fica no layout do restaurante, então aparece em QUALQUER tela, logo abaixo da barra de cima:
 *  - faixa colorida com contador e sino pulsando;
 *  - bipe quando chega um chamado novo (dá para silenciar);
 *  - título da aba do navegador piscando "(2) Chamados", mesmo com a aba em segundo plano.
 * Atualiza a cada 10 s e some quando não há chamados. Falhas de rede não aparecem (tenta de novo).
 */

const INTERVALO_MS = 10_000;
const CHAVE_SOM = 'mp_chamados_som';

const FORMA: Record<string, string> = {
  PIX_ONLINE: 'Pix',
  PIX_PRESENCIAL: 'Pix',
  DINHEIRO: 'Dinheiro',
  CARTAO: 'Cartão',
};

const haQuantoTempo = (iso: string, agora: number): string => {
  const min = Math.max(0, Math.floor((agora - new Date(iso).getTime()) / 60_000));
  if (min < 1) return 'agora mesmo';
  if (min < 60) return `há ${min} min`;
  return `há ${Math.floor(min / 60)} h`;
};

const lerSomLigado = (): boolean => {
  try { return localStorage.getItem(CHAVE_SOM) !== 'off'; } catch { return true; }
};

/** Dois toques curtos. O navegador pode bloquear áudio antes de o usuário interagir com a página: tudo é opcional. */
const tocarBipe = (ctx: AudioContext | null) => {
  if (!ctx) return;
  try {
    if (ctx.state === 'suspended') void ctx.resume();
    [0, 0.22].forEach((atraso, i) => {
      const osc = ctx.createOscillator();
      const ganho = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.value = i === 0 ? 880 : 1175;
      ganho.gain.setValueAtTime(0.0001, ctx.currentTime + atraso);
      ganho.gain.exponentialRampToValueAtTime(0.25, ctx.currentTime + atraso + 0.02);
      ganho.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + atraso + 0.18);
      osc.connect(ganho).connect(ctx.destination);
      osc.start(ctx.currentTime + atraso);
      osc.stop(ctx.currentTime + atraso + 0.2);
    });
  } catch { /* sem áudio: segue só com o aviso visual */ }
};

const ChamadosMesa: React.FC = () => {
  const navigate = useNavigate();
  const [chamados, setChamados] = useState<ChamadoMesa[]>([]);
  const [agora, setAgora] = useState(() => Date.now());
  const [atendendoId, setAtendendoId] = useState<string | null>(null);
  const [erro, setErro] = useState('');
  const [somLigado, setSomLigado] = useState(lerSomLigado);

  const vistos = useRef<Set<string>>(new Set());
  const primeiraCarga = useRef(true);
  const audioCtx = useRef<AudioContext | null>(null);
  const somRef = useRef(somLigado);
  somRef.current = somLigado;

  // O áudio só pode começar depois de um gesto do usuário: cria o contexto no primeiro clique/tecla
  useEffect(() => {
    const preparar = () => {
      if (!audioCtx.current) {
        try {
          const Ctor = window.AudioContext ?? (window as any).webkitAudioContext;
          if (Ctor) audioCtx.current = new Ctor();
        } catch { /* sem áudio */ }
      }
    };
    window.addEventListener('pointerdown', preparar, { once: true });
    window.addEventListener('keydown', preparar, { once: true });
    return () => {
      window.removeEventListener('pointerdown', preparar);
      window.removeEventListener('keydown', preparar);
    };
  }, []);

  const carregar = useCallback(async () => {
    try {
      const lista = await ChamadoMesaService.listarAbertos();
      const novos = lista.filter((c) => !vistos.current.has(c.id));
      lista.forEach((c) => vistos.current.add(c.id));
      if (novos.length > 0 && somRef.current) tocarBipe(audioCtx.current);
      primeiraCarga.current = false;
      setChamados(lista);
    } catch {
      /* falha de rede ou perfil sem acesso: não incomoda a tela, tenta de novo no próximo ciclo */
    }
  }, []);

  useEffect(() => {
    void carregar();
    // Continua rodando com a aba em segundo plano: o bipe e o título avisam mesmo assim
    const timer = window.setInterval(() => {
      setAgora(Date.now());
      void carregar();
    }, INTERVALO_MS);
    return () => window.clearInterval(timer);
  }, [carregar]);

  // Título da aba piscando enquanto houver chamados
  useEffect(() => {
    if (chamados.length === 0) return;
    const original = document.title;
    const aviso = `🔔 (${chamados.length}) Chamados`;
    let alternado = false;
    document.title = aviso;
    const timer = window.setInterval(() => {
      alternado = !alternado;
      document.title = alternado ? original : aviso;
    }, 1500);
    return () => {
      window.clearInterval(timer);
      document.title = original;
    };
  }, [chamados.length]);

  const alternarSom = () => {
    const novo = !somLigado;
    setSomLigado(novo);
    try { localStorage.setItem(CHAVE_SOM, novo ? 'on' : 'off'); } catch { /* ignora */ }
    if (novo) tocarBipe(audioCtx.current); // toca um exemplo ao ligar
  };

  const atender = async (chamado: ChamadoMesa) => {
    setAtendendoId(chamado.id);
    try {
      await ChamadoMesaService.atender(chamado.id);
      setChamados((atual) => atual.filter((c) => c.id !== chamado.id));
      setErro('');
    } catch {
      setErro('Não foi possível dar baixa no chamado. Tente de novo.');
    } finally {
      setAtendendoId(null);
    }
  };

  if (chamados.length === 0) return null;

  const temConta = chamados.some((c) => c.tipo === 'CONTA');

  return (
    <div className="chamados-alerta" role="alert" aria-live="assertive">
      <div className="chamados-alerta__topo">
        <span className="chamados-alerta__sino" aria-hidden="true"><HiBell /></span>
        <strong className="chamados-alerta__titulo">
          {chamados.length === 1 ? '1 mesa chamando' : `${chamados.length} mesas chamando`}
        </strong>
        <button
          type="button"
          className="chamados-alerta__som"
          onClick={alternarSom}
          aria-label={somLigado ? 'Desligar o som do aviso' : 'Ligar o som do aviso'}
          title={somLigado ? 'Som ligado' : 'Som desligado'}
        >
          {somLigado ? <HiVolumeUp /> : <HiVolumeOff />}
        </button>
      </div>

      {erro && <p className="chamados-alerta__erro">{erro}</p>}

      <ul className="chamados-alerta__lista">
        {chamados.map((c) => (
          <li key={c.id} className={`chamados-alerta__item chamados-alerta__item--${c.tipo.toLowerCase()}`}>
            <span className="chamados-alerta__icone" aria-hidden="true">
              {c.tipo === 'GARCOM' ? <FaConciergeBell /> : <FaReceipt />}
            </span>
            <div className="chamados-alerta__info">
              <strong>Mesa {String(c.mesa.numero).padStart(2, '0')}</strong>
              <span>
                {c.tipo === 'GARCOM' ? 'Chamando o garçom' : 'Pediu a conta'}
                {c.tipo === 'CONTA' && c.forma_pagamento && ` · pagará com ${FORMA[c.forma_pagamento] ?? ''}`}
                {' · '}
                {haQuantoTempo(c.criado_em, agora)}
              </span>
            </div>
            <button
              type="button"
              className="chamados-alerta__btn"
              onClick={() => void atender(c)}
              disabled={atendendoId === c.id}
            >
              {atendendoId === c.id ? 'Salvando...' : 'Atender'}
            </button>
          </li>
        ))}
      </ul>

      {temConta && (
        <button type="button" className="chamados-alerta__caixa" onClick={() => navigate('/restaurante/caixa')}>
          Ir para o Caixa
        </button>
      )}
    </div>
  );
};

export default ChamadosMesa;
