/**
 * Lógica da comanda da cozinha — TypeScript puro, sem React.
 *
 * A comanda NÃO é guardada em lugar nenhum: ela é sempre calculada a partir
 * do pedido da mesa (gerarComanda). Assim ela nunca fica desatualizada em
 * relação ao que foi pedido.
 *
 * Os tipos abaixo espelham o que o backend já tem:
 *   Pedido     → numero_pedido, modalidade, observacoes, atendido_por, mesa
 *   ItemPedido → quantidade, preco_unitario, observacoes, itens_adicionais,
 *                produto → categoria
 * Quando o PedidoService existir, é só converter a resposta da API para
 * PedidoParaComanda e o resto continua igual.
 */

// ── Entrada: o que a comanda precisa saber do pedido ───────────────────────────
export type ModalidadePedido = 'MESA' | 'RETIRADA' | 'ENTREGA';

export interface ItemParaComanda {
  id: string;
  nome: string;
  quantidade: number;
  precoUnitario: number;
  /** Nome da categoria do produto (ex.: "Bebidas") */
  categoria: string;
  /** Uma linha por detalhe: observações do cliente + adicionais/acompanhamentos */
  detalhes?: string[];
}

export interface PedidoParaComanda {
  numeroPedido: number;
  mesaNumero: number;
  pessoas: number;
  modalidade: ModalidadePedido;
  /** Ex.: "Garçom - João" */
  atendente?: string;
  /** Observação geral da mesa/pedido */
  observacoesMesa?: string;
  itens: ItemParaComanda[];
}

// ── Saída: comanda já pronta para exibir/imprimir ──────────────────────────────
export interface ItemComanda {
  id: string;
  nome: string;
  quantidade: number;
  detalhes: string[];
  /** quantidade × preço unitário */
  subtotal: number;
}

export interface GrupoComanda {
  categoria: string;
  itens: ItemComanda[];
}

export interface Comanda {
  mesa: string;          // "02"
  numeroPedido: string;  // "#1257"
  pessoas: number;
  tipo: string;          // "CONSUMO NO LOCAL"
  atendente?: string;
  observacoesMesa?: string;
  impressoEm: string;    // "21/06/2025 15:43"
  impressoPor?: string;  // "Caixa - Maria"
  grupos: GrupoComanda[];
  totalItens: number;
}

export interface OpcoesComanda {
  impressoPor?: string;
  /** Padrão: agora. Parâmetro existe para facilitar testes. */
  impressoEm?: Date;
  /** Categorias que NÃO vão para a cozinha (ex.: ['Bebidas'] se tiver bar separado) */
  ignorarCategorias?: string[];
}

// ── Configurações ──────────────────────────────────────────────────────────────
/**
 * Ordem em que as categorias aparecem na comanda (entrada → sobremesa).
 * Categorias que não estão aqui vão para o fim, na ordem em que apareceram.
 * Futuramente dá para trocar por Categoria.ordem vinda do banco.
 */
export const ORDEM_CATEGORIAS = [
  'Entradas',
  'Porções',
  'Saladas',
  'Pratos Principais',
  'Lanches',
  'Massas',
  'Pizzas',
  'Bebidas',
  'Sobremesas',
];

const ROTULO_TIPO: Record<ModalidadePedido, string> = {
  MESA: 'CONSUMO NO LOCAL',
  RETIRADA: 'RETIRADA',
  ENTREGA: 'ENTREGA',
};

// ── Utilitários ────────────────────────────────────────────────────────────────
/** "Porções" e "porcoes" viram a mesma chave — evita duplicar grupos por acento/caixa */
const normalizar = (texto: string) =>
  texto.normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toLowerCase();

const posicaoNaOrdem = (categoria: string) => {
  const i = ORDEM_CATEGORIAS.findIndex((c) => normalizar(c) === normalizar(categoria));
  return i === -1 ? ORDEM_CATEGORIAS.length : i;
};

export const formatarMoeda = (valor: number) =>
  valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

export const formatarDataHora = (data: Date) =>
  `${data.toLocaleDateString('pt-BR')} ${data.toLocaleTimeString('pt-BR', {
    hour: '2-digit',
    minute: '2-digit',
  })}`;

// ── Gerador ────────────────────────────────────────────────────────────────────
export function gerarComanda(pedido: PedidoParaComanda, opcoes: OpcoesComanda = {}): Comanda {
  const ignoradas = (opcoes.ignorarCategorias ?? []).map(normalizar);

  const grupos: GrupoComanda[] = [];

  pedido.itens.forEach((item) => {
    if (item.quantidade <= 0) return;
    if (ignoradas.includes(normalizar(item.categoria))) return;

    let grupo = grupos.find((g) => normalizar(g.categoria) === normalizar(item.categoria));
    if (!grupo) {
      grupo = { categoria: item.categoria, itens: [] };
      grupos.push(grupo);
    }

    grupo.itens.push({
      id: item.id,
      nome: item.nome,
      quantidade: item.quantidade,
      detalhes: (item.detalhes ?? []).map((d) => d.trim()).filter(Boolean),
      subtotal: item.precoUnitario * item.quantidade,
    });
  });

  // sort estável: categorias fora da lista mantêm a ordem de chegada
  const gruposOrdenados = grupos
    .map((g, i) => ({ g, i }))
    .sort((a, b) => posicaoNaOrdem(a.g.categoria) - posicaoNaOrdem(b.g.categoria) || a.i - b.i)
    .map(({ g }) => g);

  const totalItens = gruposOrdenados.reduce(
    (soma, g) => soma + g.itens.reduce((s, i) => s + i.quantidade, 0),
    0
  );

  return {
    mesa: String(pedido.mesaNumero).padStart(2, '0'),
    numeroPedido: `#${pedido.numeroPedido}`,
    pessoas: pedido.pessoas,
    tipo: ROTULO_TIPO[pedido.modalidade],
    atendente: pedido.atendente,
    observacoesMesa: pedido.observacoesMesa?.trim() || undefined,
    impressoEm: formatarDataHora(opcoes.impressoEm ?? new Date()),
    impressoPor: opcoes.impressoPor,
    grupos: gruposOrdenados,
    totalItens,
  };
}
