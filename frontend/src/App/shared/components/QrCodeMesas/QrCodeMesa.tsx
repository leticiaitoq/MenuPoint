import React, { useEffect, useRef } from 'react';
import { HiX, HiPrinter, HiDownload } from 'react-icons/hi';
import { QRCodeSVG, QRCodeCanvas } from 'qrcode.react';
import './QrCodeMesa.css';

// ── URL codificada no QR ───────────────────────────────────────────────────────
// Mesma regra usada na tela de Gestão de Mesas: quando o cliente escaneia, o
// celular abre essa URL. Fica num lugar só para, se o endereço mudar, mudar aqui.
const BASE_URL = process.env.REACT_APP_API_URL ?? 'http://localhost:3333';
export const urlDaMesa = (numero: number) => `${BASE_URL}/mesa/${numero}`;

interface QrCodeMesaProps {
  /** Mesa cujo QR será mostrado. null = modal fechado. */
  mesa: { numero: number; capacidade?: number } | null;
  onFechar: () => void;
}

/**
 * Modal com o QR Code de uma mesa: mostrar, imprimir e baixar em PNG.
 * Reutilizável em qualquer tela que tenha uma mesa (Gestão de Mesas, Caixa...).
 */
const QrCodeMesa: React.FC<QrCodeMesaProps> = ({ mesa, onFechar }) => {
  // Aponta para o div que contém o <svg> (tela/impressão) e o <canvas> (download)
  const qrWrapRef = useRef<HTMLDivElement>(null);

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

  const url = urlDaMesa(mesa.numero);
  const detalheCapacidade =
    mesa.capacidade !== undefined ? `${mesa.capacidade} pessoas` : '';

  // ── Download como PNG ────────────────────────────────────────────────────────
  // O QRCodeCanvas renderiza um <canvas> real, então dá para extrair a imagem
  // com toDataURL e disparar o download por um link temporário.
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
            Escaneie para acessar o cardápio da <strong>Mesa {mesa.numero}</strong>
            {detalheCapacidade && <> ({detalheCapacidade})</>}.
          </p>

          {/*
            Renderizamos os dois QRs ao mesmo tempo:
            - QRCodeSVG    → visível na tela e usado na impressão
            - QRCodeCanvas → escondido, usado só para gerar o PNG do download
          */}
          <div className="qrmesa__qr" ref={qrWrapRef}>
            <QRCodeSVG value={url} size={200} bgColor="#ffffff" fgColor="#1a1a1a" level="H" />
            <div style={{ display: 'none' }}>
              <QRCodeCanvas value={url} size={400} bgColor="#ffffff" fgColor="#1a1a1a" level="H" />
            </div>
          </div>

          <p className="qrmesa__url">{url}</p>
        </div>

        <div className="qrmesa__acoes">
          <button className="qrmesa__btn qrmesa__btn--sec" onClick={onFechar}>
            Fechar
          </button>
          <button className="qrmesa__btn qrmesa__btn--borda" onClick={handleImprimir}>
            <HiPrinter /> Imprimir
          </button>
          <button className="qrmesa__btn qrmesa__btn--prim" onClick={handleDownload}>
            <HiDownload /> Baixar PNG
          </button>
        </div>
      </div>
    </div>
  );
};

export default QrCodeMesa;
