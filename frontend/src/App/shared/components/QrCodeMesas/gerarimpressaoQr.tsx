import { renderToStaticMarkup } from 'react-dom/server';
import { QRCodeSVG } from 'qrcode.react';

export interface MesaParaImpressao {
  numero: number;
  capacidade?: number;
  token: string;
}

/** Quantos QR Codes por folha A4 (colunas x linhas) */
export const LAYOUTS_QR = {
  1: { colunas: 1, linhas: 1, rotulo: '1 por folha (grande)' },
  4: { colunas: 2, linhas: 2, rotulo: '4 por folha' },
  6: { colunas: 2, linhas: 3, rotulo: '6 por folha' },
  12: { colunas: 3, linhas: 4, rotulo: '12 por folha (pequeno)' },
} as const;
export type PorFolha = keyof typeof LAYOUTS_QR;

const esc = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/** Monta o HTML completo (A4, uma página por grupo) com os QR Codes em SVG. */
export function gerarHtmlImpressaoQr(
  mesas: MesaParaImpressao[],
  porFolha: PorFolha,
  urlDaMesa: (token: string) => string,
  nomeRestaurante?: string,
): string {
  const { colunas, linhas } = LAYOUTS_QR[porFolha];
  const grande = porFolha <= 4;

  const cartao = (m: MesaParaImpressao) => {
    const svg = renderToStaticMarkup(
      <QRCodeSVG value={urlDaMesa(m.token)} size={256} level="H" bgColor="#ffffff" fgColor="#000000" />,
    );
    return `
      <div class="cartao">
        ${nomeRestaurante ? `<div class="rest">${esc(nomeRestaurante)}</div>` : ''}
        <div class="mesa">Mesa ${m.numero}</div>
        <div class="qr">${svg}</div>
        <div class="dica">Escaneie para ver o cardápio e pedir</div>
      </div>`;
  };

  const porPagina = colunas * linhas;
  const paginas: string[] = [];
  for (let i = 0; i < mesas.length; i += porPagina) {
    paginas.push(`<section class="pagina">${mesas.slice(i, i + porPagina).map(cartao).join('')}</section>`);
  }

  return `<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8">
<title>QR Codes das mesas</title>
<style>
  @page { size: A4 portrait; margin: 8mm; }
  * { box-sizing: border-box; }
  html, body { margin: 0; padding: 0; font-family: Arial, Helvetica, sans-serif; color: #111; }
  .pagina {
    display: grid;
    grid-template-columns: repeat(${colunas}, 1fr);
    grid-template-rows: repeat(${linhas}, 1fr);
    width: 194mm; height: 281mm;          /* A4 (210x297) menos as margens de 8mm */
    break-after: page; page-break-after: always;
  }
  .pagina:last-child { break-after: auto; page-break-after: auto; }
  .cartao {
    display: flex; flex-direction: column; align-items: center; justify-content: center;
    gap: ${grande ? 3 : 1.5}mm; padding: ${grande ? 6 : 3}mm;
    border: 0.3mm dashed #999;           /* guia de corte */
    break-inside: avoid; overflow: hidden;
  }
  .rest { font-size: ${grande ? 14 : 9}pt; color: #555; }
  .mesa { font-size: ${porFolha === 1 ? 48 : grande ? 28 : 16}pt; font-weight: 700; }
  .qr { width: 100%; flex: 1 1 0; min-height: 0; display: flex; align-items: center; justify-content: center; }
  .qr svg { height: 100%; width: auto; max-width: 100%; aspect-ratio: 1 / 1; }
  .dica { font-size: ${grande ? 11 : 8}pt; color: #444; text-align: center; }
</style>
</head>
<body>${paginas.join('')}</body>
</html>`;
}

/** Imprime sem abrir pop-up: usa um iframe invisível (não é bloqueado pelo navegador). */
export function imprimirHtml(html: string): void {
  const iframe = document.createElement('iframe');
  iframe.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0;';
  document.body.appendChild(iframe);
  const doc = iframe.contentDocument;
  const win = iframe.contentWindow;
  if (!doc || !win) { document.body.removeChild(iframe); return; }
  doc.open();
  doc.write(html);
  doc.close();
  // espera o layout/SVGs e imprime; remove o iframe depois
  window.setTimeout(() => {
    win.focus();
    win.print();
    window.setTimeout(() => document.body.removeChild(iframe), 1000);
  }, 300);
}
