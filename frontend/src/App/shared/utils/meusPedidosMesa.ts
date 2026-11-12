/**
 * Pedidos que ESTE aparelho fez na mesa (cliente local, sem login).
 * Guardados no sessionStorage, como o nome do convidado: quem senta depois não herda.
 */
const chave = (mesaToken: string) => `@menupoint:meus-pedidos:${mesaToken}`;

export const lerPedidosProprios = (mesaToken: string): Set<string> => {
  try {
    const bruto = sessionStorage.getItem(chave(mesaToken));
    const lista = bruto ? JSON.parse(bruto) : [];
    return new Set(Array.isArray(lista) ? lista.filter((id): id is string => typeof id === 'string') : []);
  } catch {
    return new Set();
  }
};

export const registrarPedidoProprio = (mesaToken: string, pedidoId: string): void => {
  try {
    const ids = lerPedidosProprios(mesaToken).add(pedidoId);
    sessionStorage.setItem(chave(mesaToken), JSON.stringify(Array.from(ids).slice(-100)));
  } catch {
    /* sem storage (modo privado): o destaque cai para a comparação pelo nome */
  }
};
