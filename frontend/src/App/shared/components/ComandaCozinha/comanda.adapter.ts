import type { Pedido as PedidoApi } from '../../../services/pedido.service';
import type { ItemParaComanda, PedidoParaComanda } from './comanda';

/** Categoria usada quando o produto do item não é encontrado (ex.: produto removido do cardápio) */
export const CATEGORIA_SEM_CADASTRO = 'Outros';

const unicos = (lista: string[]) => {
  const vistos = new Set<string>();
  return lista.filter((v) => {
    const chave = v.trim().replace(/\s+/g, ' ').toLowerCase();
    if (!chave || vistos.has(chave)) return false;
    vistos.add(chave);
    return true;
  });
};

interface Opcoes {
  mesaNumero: number;
  /** Pedidos em andamento da mesa (idealmente vindos de GET /pedidos/:id, que traz o atendente) */
  pedidos: PedidoApi[];
  /** produto_id → nome da categoria (vem de GET /produtos) */
  categoriaPorProduto: Record<string, string>;
}

/**
 * Converte os pedidos reais de uma mesa (API) para o formato da comanda da cozinha.
 * Vários pedidos da mesma mesa viram UMA comanda: itens agrupados por categoria.
 * Devolve null se não houver nenhum pedido.
 */
export function pedidosParaComanda({
  mesaNumero,
  pedidos,
  categoriaPorProduto,
}: Opcoes): PedidoParaComanda | null {
  if (pedidos.length === 0) return null;

  // Mais antigo primeiro: a cozinha vê os itens na ordem em que foram pedidos
  const ordenados = [...pedidos].sort(
    (a, b) => new Date(a.criado_em).getTime() - new Date(b.criado_em).getTime()
  );

  const itens: ItemParaComanda[] = ordenados.flatMap((pedido) =>
    pedido.itens.map((item) => {
      const adicionais = (item.itens_adicionais ?? [])
        .map((a) => a.nome_adicional?.trim())
        .filter((n): n is string => !!n);

      return {
        id: item.id,
        nome: item.produto?.nome ?? 'Item',
        quantidade: item.quantidade,
        precoUnitario: item.preco_unitario,
        categoria: categoriaPorProduto[item.produto_id] ?? CATEGORIA_SEM_CADASTRO,
        detalhes: [
          ...(item.observacoes?.trim() ? [item.observacoes.trim()] : []),
          ...(adicionais.length > 0 ? [`Adicionais: ${adicionais.join(', ')}`] : []),
        ],
      };
    })
  );

  const numeros = ordenados.map((p) => p.numero_pedido);
  const clientes = unicos(ordenados.map((p) => p.cliente_nome));
  const atendentes = unicos(ordenados.map((p) => p.atendido_por?.nome ?? ''));
  const observacoes = unicos(ordenados.map((p) => p.observacoes ?? ''));

  return {
    numeroPedido: numeros[numeros.length - 1],
    numerosPedidos: numeros,
    mesaNumero,
    pessoas: Math.max(1, clientes.length),
    modalidade: 'MESA',
    atendente: atendentes.length > 0 ? atendentes.join(', ') : undefined,
    observacoesMesa: observacoes.length > 0 ? observacoes.join(' / ') : undefined,
    itens,
  };
}
