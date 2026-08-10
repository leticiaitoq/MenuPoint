export function templateNovoPedido(pedido: {
  numero_pedido: number
  cliente_nome: string
  cliente_telefone: string
  modalidade: string
  total: number
  itens: Array<{ nome: string; quantidade: number }>
}): string {
  const itensTexto = pedido.itens
    .map((i) => `• ${i.quantidade}x ${i.nome}`)
    .join('\n')

  return `🛎️ *NOVO PEDIDO #${pedido.numero_pedido}*

👤 Cliente: ${pedido.cliente_nome}
📱 Telefone: ${pedido.cliente_telefone}
🚚 Modalidade: ${pedido.modalidade}

*Itens:*
${itensTexto}

💰 Total: R$ ${pedido.total.toFixed(2)}

_Menupoint_ ✅`
}

export function templateStatusPedido(
  clienteNome: string,
  numeroPedido: number,
  novoStatus: string
): string {
  const statusEmoji: Record<string, string> = {
    PREPARO: '👨‍🍳 Em preparo',
    PRONTO: '✅ Pronto para retirada/entrega',
    ENTREGUE: '🎉 Entregue',
    CANCELADO: '❌ Cancelado',
  }

  return `Olá, *${clienteNome}*! Seu pedido *#${numeroPedido}* está: ${statusEmoji[novoStatus] ?? novoStatus}.

_Menupoint_ 🍽️`
}