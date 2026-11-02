// Dados e layout do comprovante/comanda. O MESMO conjunto de linhas serve para a
// pré-visualização/impressão (HTML) e para a imagem PNG (canvas), então os dois saem iguais.

export type ModoComprovante = 'comanda' | 'comprovante';

export interface PedidoDoComprovante {
  numero: number;
  hora: string;
  cliente: string;
  itens: { nome: string; quantidade: number; valor: number; detalhes?: string[] }[];
  total: number;
}

export interface DadosComprovante {
  modo: ModoComprovante;
  restaurante: string;
  mesa: string;
  emitidoEm: Date;
  clientes: string[];
  pedidos: PedidoDoComprovante[];
  subtotal: number;
  taxaPercentual: number;
  taxaServico: number;
  desconto: number;
  /** Já pago em parciais/abatimentos */
  jaPago: number;
  /** Total da conta (comanda) ou valor pago agora (comprovante) */
  total: number;
  /** Só no comprovante: como foi pago */
  pagamentos?: { rotulo: string; valor: number }[];
  troco?: number;
}

export type Linha =
  | { tipo: 'texto'; texto: string; alinhar?: 'centro' | 'esquerda'; negrito?: boolean; grande?: boolean; pequeno?: boolean }
  | { tipo: 'par'; esquerda: string; direita: string; negrito?: boolean; recuo?: boolean }
  | { tipo: 'divisor' }
  | { tipo: 'espaco' };

export const moeda = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

const dataHora = (d: Date) =>
  d.toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }).replace(',', ' às');

export const montarLinhas = (d: DadosComprovante): Linha[] => {
  const comprovante = d.modo === 'comprovante';
  const l: Linha[] = [
    { tipo: 'texto', texto: d.restaurante, alinhar: 'centro', negrito: true, grande: true },
    { tipo: 'texto', texto: comprovante ? 'COMPROVANTE DE PAGAMENTO' : 'COMANDA DA MESA', alinhar: 'centro', negrito: true },
    { tipo: 'texto', texto: `${d.mesa} · ${dataHora(d.emitidoEm)}`, alinhar: 'centro', pequeno: true },
  ];
  if (d.clientes.length > 0) {
    l.push({ tipo: 'texto', texto: `Cliente(s): ${d.clientes.join(', ')}`, alinhar: 'centro', pequeno: true });
  }
  l.push({ tipo: 'divisor' });

  d.pedidos.forEach((p, i) => {
    if (i > 0) l.push({ tipo: 'espaco' });
    l.push({ tipo: 'par', esquerda: `Pedido #${p.numero}${p.cliente ? ` · ${p.cliente}` : ''}`, direita: p.hora, negrito: true });
    p.itens.forEach((item) => {
      l.push({ tipo: 'par', esquerda: `${item.quantidade}x ${item.nome}`, direita: moeda(item.valor) });
      (item.detalhes ?? []).forEach((det) => l.push({ tipo: 'par', esquerda: det, direita: '', recuo: true }));
    });
  });

  l.push({ tipo: 'divisor' });
  l.push({ tipo: 'par', esquerda: 'Subtotal', direita: moeda(d.subtotal) });
  l.push({ tipo: 'par', esquerda: `Taxa de serviço (${d.taxaPercentual}%)`, direita: moeda(d.taxaServico) });
  if (d.desconto > 0) l.push({ tipo: 'par', esquerda: 'Desconto', direita: `- ${moeda(d.desconto)}` });
  if (d.jaPago > 0 && !comprovante) l.push({ tipo: 'par', esquerda: 'Já pago (parcial)', direita: `- ${moeda(d.jaPago)}` });
  l.push({
    tipo: 'par',
    esquerda: comprovante ? 'TOTAL DA CONTA' : d.jaPago > 0 ? 'FALTA PAGAR' : 'TOTAL',
    direita: moeda(comprovante ? Math.max(d.subtotal + d.taxaServico - d.desconto, 0) : d.total),
    negrito: true,
  });

  if (comprovante) {
    l.push({ tipo: 'divisor' });
    l.push({ tipo: 'texto', texto: 'PAGAMENTOS', negrito: true });
    (d.pagamentos ?? []).forEach((p) => l.push({ tipo: 'par', esquerda: p.rotulo, direita: moeda(p.valor) }));
    if ((d.troco ?? 0) > 0) l.push({ tipo: 'par', esquerda: 'Troco', direita: moeda(d.troco ?? 0) });
    l.push({ tipo: 'espaco' });
    l.push({ tipo: 'texto', texto: 'Obrigado pela preferência!', alinhar: 'centro', negrito: true });
  }

  l.push({ tipo: 'espaco' });
  l.push({ tipo: 'texto', texto: 'Documento sem valor fiscal', alinhar: 'centro', pequeno: true });
  return l;
};

// ── Imagem PNG (canvas) ─────────────────────────────────────────────────────────
const LARGURA = 380;
const MARGEM = 20;
const ESCALA = 2; // mais nítido ao compartilhar

export const gerarImagemComprovante = (linhas: Linha[]): Promise<Blob> => {
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  if (!ctx) return Promise.reject(new Error('Canvas indisponível'));

  const fonte = (negrito?: boolean, tamanho = 14) =>
    `${negrito ? 'bold ' : ''}${tamanho}px "Courier New", monospace`;
  const util = LARGURA - MARGEM * 2;

  // Quebra o texto em linhas que cabem na largura
  const quebrar = (texto: string, largura: number): string[] => {
    const palavras = texto.split(' ');
    const saida: string[] = [];
    let atual = '';
    palavras.forEach((pal) => {
      const teste = atual ? `${atual} ${pal}` : pal;
      if (ctx.measureText(teste).width <= largura || !atual) atual = teste;
      else { saida.push(atual); atual = pal; }
    });
    if (atual) saida.push(atual);
    return saida.length ? saida : [''];
  };

  // 1ª passada: calcula a altura
  type Desenho = { y: number; fn: () => void };
  const desenhos: Desenho[] = [];
  let y = MARGEM;

  linhas.forEach((ln) => {
    if (ln.tipo === 'espaco') { y += 10; return; }
    if (ln.tipo === 'divisor') {
      const yy = y + 6;
      desenhos.push({ y: yy, fn: () => {
        ctx.save(); ctx.setLineDash([4, 3]); ctx.strokeStyle = '#555'; ctx.beginPath();
        ctx.moveTo(MARGEM, yy); ctx.lineTo(LARGURA - MARGEM, yy); ctx.stroke(); ctx.restore();
      } });
      y += 14; return;
    }
    if (ln.tipo === 'texto') {
      const tam = ln.grande ? 20 : ln.pequeno ? 12 : 14;
      ctx.font = fonte(ln.negrito, tam);
      quebrar(ln.texto, util).forEach((parte) => {
        const yy = y + tam; y += tam + 6;
        desenhos.push({ y: yy, fn: () => {
          ctx.font = fonte(ln.negrito, tam); ctx.fillStyle = '#111';
          ctx.textAlign = ln.alinhar === 'centro' ? 'center' : 'left';
          ctx.fillText(parte, ln.alinhar === 'centro' ? LARGURA / 2 : MARGEM, yy);
        } });
      });
      return;
    }
    // par
    const recuo = ln.recuo ? 14 : 0;
    ctx.font = fonte(ln.negrito, ln.recuo ? 12 : 14);
    const larguraDireita = ln.direita ? ctx.measureText(ln.direita).width + 10 : 0;
    quebrar(ln.esquerda, util - larguraDireita - recuo).forEach((parte, i) => {
      const yy = y + 14; y += 20;
      desenhos.push({ y: yy, fn: () => {
        ctx.font = fonte(ln.negrito, ln.recuo ? 12 : 14); ctx.fillStyle = ln.recuo ? '#555' : '#111';
        ctx.textAlign = 'left'; ctx.fillText(parte, MARGEM + recuo, yy);
        if (i === 0 && ln.direita) { ctx.textAlign = 'right'; ctx.fillText(ln.direita, LARGURA - MARGEM, yy); }
      } });
    });
  });

  const altura = y + MARGEM;
  canvas.width = LARGURA * ESCALA;
  canvas.height = altura * ESCALA;
  ctx.scale(ESCALA, ESCALA);
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, LARGURA, altura);
  desenhos.forEach((d) => d.fn());

  return new Promise((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('Falha ao gerar a imagem'))), 'image/png')
  );
};
