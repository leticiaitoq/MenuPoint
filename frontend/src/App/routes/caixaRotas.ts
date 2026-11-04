export const ROTAS_CAIXA = {
  lista: '/restaurante/caixa',

  pagarMesaPadrao: '/restaurante/caixa/pagar/:id',
  pagarMesa: (mesaId: string) => `/restaurante/caixa/pagar/${mesaId}`,

  pagarParcialPadrao: '/restaurante/caixa/pagarParcial/:id',
  pagarParcial: (mesaId: string) => `/restaurante/caixa/pagarParcial/${mesaId}`,
};
