import React, { useEffect, useRef, useState } from 'react';
import { HiX, HiPrinter, HiDownload, HiClipboardCopy, HiCheck } from 'react-icons/hi';
import { QRCodeSVG, QRCodeCanvas } from 'qrcode.react';
import './QrCodeMesa.css';

// ── URL codificada no QR ───────────────────────────────────────────────────────
// Quando o cliente escaneia, o celular abre /mesa/:token no SITE (front-end), que
// descobre a mesa e o restaurante pelo token e leva para a /welcomepage.
// Usa o endereço em que o sistema está aberto; em desenvolvimento, defina
// REACT_APP_FRONTEND_URL (ex.: http://192.168.0.10:3000) para o celular alcançar o PC.
const BASE_URL = (process.env.REACT_APP_FRONTEND_URL || window.location.origin).replace(/\/$/, '');
export const urlDaMesa = (token: string) => `${BASE_URL}/mesa/${encodeURIComponent(token)}`;

interface QrCodeMesaProps {
  /** Mesa cujo QR será mostrado. null = modal fechado. */
  mesa: { numero: number; capacidade?: number; /** qr_code_token da mesa (API) */ token?: string } | null;
  onFechar: () => void;
}

/**
 * Modal com o QR Code de uma mesa: mostrar, imprimir e baixar em PNG.
 * Reutilizável em qualquer tela que tenha uma mesa (Gestão de Mesas, Caixa...).
 */
const QrCodeMesa: React.FC<QrCodeMesaProps> = ({ mesa, onFechar }) => {
  // Aponta para o div que contém o <svg> (tela/impressão) e o <canvas> (download)
  const qrWrapRef = useRef<HTMLDivElement>(null);
  const [copiado, setCopiado] = useState(false);

  // Esc fecha
  useEffect(() => {
    if (!mesa) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onFechar();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [mesa, onFechar]);

  if (!mesa) return null;

  // Sem token (mesa antiga/sem QR gerado) não há link válido para mostrar
  const url = mesa.token ? urlDaMesa(mesa.token) : null;
  const detalheCapacidade =
    mesa.capacidade !== undefined ? `${mesa.capacidade} pessoas` : '';

  // ── Download como PNG ────────────────────────────────────────────────────────
  // O QRCodeCanvas renderiza um <canvas> real, então dá para extrair a imagem
  // com toDataURL e disparar o download por um link temporário.
  const handleCopiar = async () => {
    if (!url) return;
    try {
      await navigator.clipboard.writeText(url);
    } catch {
      // Sem permissão/HTTP: seleciona via campo temporário
      const campo = document.createElement('textarea');
      campo.value = url;
      document.body.appendChild(campo);
      campo.select();
      document.execCommand('copy');
      document.body.removeChild(campo);
    }
    setCopiado(true);
    window.setTimeout(() => setCopiado(false), 2000);
  };

  const handleDownload = () => {
    const canvas = qrWrapRef.current?.querySelector('canvas');
    if (!canvas) return;

    const link = document.createElement('a');
    link.href = canvas.toDataURL('image/png');
    link.download = `qrcode-mesa-${mesa.numero}.png`;
    link.click();
  };

  // ── Impressão ────────────────────────────────────────────────────────────────
  // Abre uma janela só com o QR e o título da mesa e chama window.print().
  // Usa o SVG (não o canvas) porque escala sem perder qualidade na impressora.
  const handleImprimir = () => {
    if (!url) return;
    const svgEl = qrWrapRef.current?.querySelector('svg');
    if (!svgEl) return;

    const svgStr = new XMLSerializer().serializeToString(svgEl);
    const janela = window.open('', '_blank', 'width=400,height=500');
    if (!janela) return; // pop-up bloqueado pelo navegador

    janela.document.write(`
      <html>
        <head>
          <title>QR Code - Mesa ${mesa.numero}</title>
          <style>
            body { display: flex; flex-direction: column; align-items: center;
                   justify-content: center; height: 100vh; font-family: sans-serif;
                   gap: 16px; }
            h2   { margin: 0; font-size: 20px; color: #333; }
            p    { margin: 0; font-size: 14px; color: #888; }
          </style>
        </head>
        <body>
          <h2>Mesa ${mesa.numero}</h2>
          ${detalheCapacidade ? `<p>${detalheCapacidade}</p>` : ''}
          ${svgStr}
          <p>${url}</p>
          <script>window.onload = () => { window.print(); window.close(); }</script>
        </body>
      </html>
    `);
    janela.document.close();
  };

  return (
    <div className="qrmesa__overlay" onClick={onFechar}>
      <div
        className="qrmesa__modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="qrmesa-titulo"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="qrmesa__header">
          <h3 id="qrmesa-titulo">QR Code — Mesa {mesa.numero}</h3>
          <button className="qrmesa__fechar" onClick={onFechar} aria-label="Fechar">
            <HiX />
          </button>
        </div>

        <div className="qrmesa__corpo">
          <p className="qrmesa__info">
            Escaneie para entrar na <strong>Mesa {mesa.numero}</strong>
            {detalheCapacidade && <> ({detalheCapacidade})</>}.
          </p>

          {/*
            Renderizamos os dois QRs ao mesmo tempo:
            - QRCodeSVG    → visível na tela e usado na impressão
            - QRCodeCanvas → escondido, usado só para gerar o PNG do download
          */}
          {url ? (
            <>
              <div className="qrmesa__qr" ref={qrWrapRef}>
                <QRCodeSVG value={url} size={200} bgColor="#ffffff" fgColor="#1a1a1a" level="H" />
                <div style={{ display: 'none' }}>
                  <QRCodeCanvas value={url} size={400} bgColor="#ffffff" fgColor="#1a1a1a" level="H" />
                </div>
              </div>

              <p className="qrmesa__url">
                <a href={url} target="_blank" rel="noreferrer">{url}</a>
              </p>
            </>
          ) : (
            <p className="qrmesa__url" role="alert">
              Esta mesa ainda não tem QR Code. Atualize a tela do Caixa e tente de novo.
            </p>
          )}
        </div>

        <div className="qrmesa__acoes">
          <button className="qrmesa__btn qrmesa__btn--sec" onClick={onFechar}>
            Fechar
          </button>
          <button className="qrmesa__btn qrmesa__btn--borda" onClick={() => void handleCopiar()} disabled={!url}>
            {copiado ? <HiCheck /> : <HiClipboardCopy />} {copiado ? 'Copiado!' : 'Copiar link'}
          </button>
          <button className="qrmesa__btn qrmesa__btn--borda" onClick={handleImprimir} disabled={!url}>
            <HiPrinter /> Imprimir
          </button>
          <button className="qrmesa__btn qrmesa__btn--prim" onClick={handleDownload} disabled={!url}>
            <HiDownload /> Baixar PNG
          </button>
        </div>
      </div>
    </div>
  );
};

export default QrCodeMesa;
