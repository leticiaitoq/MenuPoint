import React, { useEffect, useMemo, useState } from 'react';
import { HiX, HiPrinter, HiCheck } from 'react-icons/hi';
import { MdQrCode2 } from 'react-icons/md';
import { urlDaMesa } from './QrCodeMesa';
import {
  gerarHtmlImpressaoQr,
  imprimirHtml,
  LAYOUTS_QR,
  PorFolha,
} from './gerarimpressaoQr';
import './QrCodeMesa.css';

interface MesaQr {
  id: string;
  numero: number;
  capacidade?: number;
  /** qr_code_token da mesa (API) */
  token?: string;
}

interface Props {
  aberto: boolean;
  mesas: MesaQr[];
  nomeRestaurante?: string;
  onFechar: () => void;
}

const TAMANHOS = Object.keys(LAYOUTS_QR).map(Number) as PorFolha[];

/** Modal para imprimir vários QR Codes de mesa de uma vez. */
const ImprimirQrMesas: React.FC<Props> = ({ aberto, mesas, nomeRestaurante, onFechar }) => {
  // só entra quem tem token (sem token não existe link válido)
  const lista = useMemo(
    () => mesas.filter((m) => !!m.token).sort((a, b) => a.numero - b.numero),
    [mesas],
  );
  const [marcadas, setMarcadas] = useState<Set<string>>(new Set());
  const [porFolha, setPorFolha] = useState<PorFolha>(4);
  const [comNome, setComNome] = useState(true);

  // ao abrir: todas marcadas
  useEffect(() => {
    if (aberto) setMarcadas(new Set(lista.map((m) => m.id)));
  }, [aberto]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!aberto) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onFechar(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [aberto, onFechar]);

  if (!aberto) return null;

  const escolhidas = lista.filter((m) => marcadas.has(m.id));
  const { colunas, linhas } = LAYOUTS_QR[porFolha];
  const folhas = Math.ceil(escolhidas.length / (colunas * linhas));
  const todasMarcadas = escolhidas.length === lista.length && lista.length > 0;

  const alternar = (id: string) =>
    setMarcadas((atual) => {
      const novo = new Set(atual);
      if (novo.has(id)) novo.delete(id); else novo.add(id);
      return novo;
    });

  const imprimir = () => {
    if (escolhidas.length === 0) return;
    const html = gerarHtmlImpressaoQr(
      escolhidas.map((m) => ({ numero: m.numero, capacidade: m.capacidade, token: m.token as string })),
      porFolha,
      urlDaMesa,
      comNome ? nomeRestaurante : undefined,
    );
    imprimirHtml(html);
  };

  return (
    <div className="qrmesa__overlay" onClick={onFechar}>
      <div
        className="qrmesa__modal qrmassa__modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="qrmassa-titulo"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="qrmassa__header">
          <span className="qrmassa__icone" aria-hidden="true"><MdQrCode2 /></span>
          <div className="qrmassa__titulos">
            <h3 id="qrmassa-titulo">Imprimir QR Codes</h3>
            <p>Escolha as mesas e o tamanho. Sai em folhas A4 com guia de corte.</p>
          </div>
          <button className="qrmesa__fechar" onClick={onFechar} aria-label="Fechar"><HiX /></button>
        </div>

        <div className="qrmassa__corpo">
          {lista.length === 0 ? (
            <p role="alert" className="qrmassa__vazio">
              Nenhuma mesa com QR Code. Atualize a tela do Caixa e tente de novo.
            </p>
          ) : (
            <>
              {/*  Mesas  */}
              <section className="qrmassa__secao">
                <div className="qrmassa__secao-topo">
                  <h4>Mesas</h4>
                  <button
                    type="button"
                    className="qrmassa__link"
                    onClick={() => setMarcadas(todasMarcadas ? new Set() : new Set(lista.map((m) => m.id)))}
                  >
                    {todasMarcadas ? 'Limpar seleção' : 'Selecionar todas'}
                  </button>
                </div>
                <div className="qrmassa__chips">
                  {lista.map((m) => {
                    const on = marcadas.has(m.id);
                    return (
                      <button
                        key={m.id}
                        type="button"
                        aria-pressed={on}
                        className={`qrmassa__chip${on ? ' qrmassa__chip--on' : ''}`}
                        onClick={() => alternar(m.id)}
                      >
                        {on && <HiCheck aria-hidden="true" />}
                        Mesa {m.numero}
                      </button>
                    );
                  })}
                </div>
              </section>

              {/*  Tamanho  */}
              <section className="qrmassa__secao">
                <div className="qrmassa__secao-topo"><h4>Tamanho</h4></div>
                <div className="qrmassa__tamanhos" role="radiogroup" aria-label="QR Codes por folha">
                  {TAMANHOS.map((t) => {
                    const l = LAYOUTS_QR[t];
                    const on = t === porFolha;
                    return (
                      <button
                        key={t}
                        type="button"
                        role="radio"
                        aria-checked={on}
                        className={`qrmassa__tam${on ? ' qrmassa__tam--on' : ''}`}
                        onClick={() => setPorFolha(t)}
                      >
                        <span
                          className="qrmassa__folha"
                          style={{ gridTemplateColumns: `repeat(${l.colunas}, 1fr)` }}
                          aria-hidden="true"
                        >
                          {Array.from({ length: l.colunas * l.linhas }, (_, i) => <i key={i} />)}
                        </span>
                        <strong>{t}</strong>
                        <small>por folha</small>
                      </button>
                    );
                  })}
                </div>
              </section>

              {/*  Nome do restaurante  */}
              {nomeRestaurante && (
                <label className="qrmassa__linha">
                  <span>
                    Mostrar o nome do restaurante
                    <small>{nomeRestaurante}</small>
                  </span>
                  <input
                    type="checkbox"
                    role="switch"
                    className="qrmassa__switch"
                    checked={comNome}
                    onChange={(e) => setComNome(e.target.checked)}
                  />
                </label>
              )}
            </>
          )}
        </div>

        <div className="qrmassa__rodape">
          <span className="qrmassa__resumo">
            <strong>{escolhidas.length}</strong> {escolhidas.length === 1 ? 'mesa' : 'mesas'}
            {' · '}
            <strong>{folhas}</strong> {folhas === 1 ? 'folha' : 'folhas'} A4
          </span>
          <div className="qrmassa__botoes">
            <button className="qrmesa__btn qrmesa__btn--borda" onClick={onFechar}>Fechar</button>
            <button className="qrmesa__btn qrmesa__btn--prim" onClick={imprimir} disabled={escolhidas.length === 0}>
              <HiPrinter /> Imprimir
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ImprimirQrMesas;
