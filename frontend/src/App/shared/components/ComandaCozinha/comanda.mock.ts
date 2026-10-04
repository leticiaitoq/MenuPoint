import type { PedidoParaComanda } from './comanda';

/**
 * Mock dos pedidos por mesa (a chave é o id da mesa na tela de Caixa).
 * Substituir por chamada à API (pedido.service.ts) — a função
 * obterPedidoDaMesa é o único ponto que precisa mudar.
 */
const PEDIDOS_COMANDA_MOCK: Record<string, PedidoParaComanda> = {
  m1: {
    numeroPedido: 1256, mesaNumero: 1, pessoas: 2, modalidade: 'MESA', atendente: 'Garçom - João',
    itens: [
      { id: 'i1', nome: 'X-Burguer',          quantidade: 2, precoUnitario: 25.0, categoria: 'Lanches',   detalhes: ['Sem cebola'] },
      { id: 'i2', nome: 'Batata Frita',       quantidade: 1, precoUnitario: 15.0, categoria: 'Entradas' },
      { id: 'i3', nome: 'Refrigerante Lata',  quantidade: 1, precoUnitario: 6.0,  categoria: 'Bebidas',   detalhes: ['Guaraná'] },
      { id: 'i4', nome: 'Brownie com Sorvete', quantidade: 1, precoUnitario: 21.9, categoria: 'Sobremesas' },
    ],
  },
  m2: {
    numeroPedido: 1257, mesaNumero: 2, pessoas: 4, modalidade: 'MESA', atendente: 'Garçom - João',
    observacoesMesa: 'Sem cebola no refri / Molho à parte',
    itens: [
      { id: 'i5', nome: 'Porção de Batata Frita', quantidade: 1, precoUnitario: 19.9, categoria: 'Entradas', detalhes: ['Sem cheddar'] },
      { id: 'i6', nome: 'Picanha na Chapa', quantidade: 1, precoUnitario: 89.9, categoria: 'Pratos Principais', detalhes: ['Ao ponto', 'Acompanhamento: Arroz, Farofa e Vinagrete'] },
      { id: 'i7', nome: 'Frango Grelhado', quantidade: 1, precoUnitario: 34.9, categoria: 'Pratos Principais', detalhes: ['Acompanhamento: Arroz, Salada'] },
      { id: 'i8', nome: 'Refrigerante Lata', quantidade: 1, precoUnitario: 11.0, categoria: 'Bebidas', detalhes: ['Coca-Cola Zero'] },
      { id: 'i9', nome: 'Água com Gás', quantidade: 1, precoUnitario: 8.0, categoria: 'Bebidas' },
      { id: 'i10', nome: 'Brownie com Sorvete', quantidade: 1, precoUnitario: 21.9, categoria: 'Sobremesas', detalhes: ['Chocolate'] },
    ],
  },
  m3: {
    numeroPedido: 1258, mesaNumero: 3, pessoas: 2, modalidade: 'MESA', atendente: 'Garçom - Ana',
    itens: [
      { id: 'i11', nome: 'Hamburguer Celestino', quantidade: 1, precoUnitario: 39.9, categoria: 'Lanches', detalhes: ['Sem bacon'] },
      { id: 'i12', nome: 'Suco Natural', quantidade: 1, precoUnitario: 9.0, categoria: 'Bebidas', detalhes: ['Laranja'] },
    ],
  },
  m4: {
    numeroPedido: 1259, mesaNumero: 4, pessoas: 6, modalidade: 'MESA', atendente: 'Garçom - Ana',
    observacoesMesa: 'Aniversário na mesa — trazer a sobremesa com vela',
    itens: [
      { id: 'i13', nome: 'Pizza Portuguesa', quantidade: 2, precoUnitario: 50.0, categoria: 'Pizzas', detalhes: ['Metade sem ervilha'] },
      { id: 'i14', nome: 'Porção Batatas Brisola', quantidade: 1, precoUnitario: 50.0, categoria: 'Porções' },
      { id: 'i15', nome: 'Porção de Frango', quantidade: 1, precoUnitario: 38.0, categoria: 'Porções' },
      { id: 'i16', nome: 'Caipirinha', quantidade: 2, precoUnitario: 18.0, categoria: 'Bebidas', detalhes: ['Limão'] },
      { id: 'i17', nome: 'Sorvete Cremoso', quantidade: 1, precoUnitario: 22.0, categoria: 'Sobremesas' },
    ],
  },
  m5: {
    numeroPedido: 1260, mesaNumero: 5, pessoas: 2, modalidade: 'MESA', atendente: 'Garçom - João',
    itens: [
      { id: 'i18', nome: 'Macarrão ao molho ito', quantidade: 1, precoUnitario: 24.99, categoria: 'Massas' },
    ],
  },
  m6: {
    numeroPedido: 1261, mesaNumero: 6, pessoas: 3, modalidade: 'MESA', atendente: 'Garçom - Ana',
    itens: [
      { id: 'i19', nome: 'Salada Caesar', quantidade: 1, precoUnitario: 22.0, categoria: 'Saladas', detalhes: ['Molho à parte'] },
      { id: 'i20', nome: 'Hamburguer Celestino', quantidade: 2, precoUnitario: 39.9, categoria: 'Lanches' },
      { id: 'i21', nome: 'Coca-Cola', quantidade: 1, precoUnitario: 6.0, categoria: 'Bebidas' },
    ],
  },
};

/** Devolve o pedido em andamento da mesa, ou null se não houver. */
export function obterPedidoDaMesa(mesaId: string): PedidoParaComanda | null {
  return PEDIDOS_COMANDA_MOCK[mesaId] ?? null;
}
