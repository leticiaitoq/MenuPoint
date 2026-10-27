/**
 * Caminhos das telas do Caixa num lugar só.
 *
 * Toda navegação que envolve uma mesa passa o id dela na URL
 * (/restaurante/caixa/pagar/m2). É isso que permite as telas saberem
 * QUAL mesa estão mostrando — e que ações como transferir mesa ou juntar
 * comandas naveguem para a mesa certa depois.
 *
 * Os padrões (com ":id") são usados em routes/Index.tsx; as funções são
 * usadas nas telas para navegar.
 */
export const ROTAS_CAIXA = {
  lista: '/restaurante/caixa',

  pagarMesaPadrao: '/restaurante/caixa/pagar/:id',
  pagarMesa: (mesaId: string) => `/restaurante/caixa/pagar/${mesaId}`,

  pagarParcialPadrao: '/restaurante/caixa/pagarParcial/:id',
  pagarParcial: (mesaId: string) => `/restaurante/caixa/pagarParcial/${mesaId}`,
};
