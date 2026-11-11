import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { CarrinhoProvider, useCarrinho } from '../App/shared/contexts/CarrinhoContext';

let mockSistema: 'delivery' | 'local' | null = 'delivery';
let mockSlug: string | null = 'pizzaria';
jest.mock('../App/shared/contexts/SistemaClienteContext', () => ({ useSistemaCliente: () => ({ sistema: mockSistema }) }));
jest.mock('../App/shared/contexts/RestauranteClienteContext', () => ({ useRestauranteCliente: () => ({ slug: mockSlug }) }));

const Tela = () => {
  const { itens, adicionarItem } = useCarrinho();
  return (
    <>
      <p data-testid="qtd">{itens.length}</p>
      <button onClick={() => adicionarItem({ id: 'i1', produtoId: 'p1', nome: 'Pizza', preco: 30, quantidade: 1, imagem: '' })}>add</button>
    </>
  );
};
const montar = () => render(<CarrinhoProvider><Tela /></CarrinhoProvider>);

beforeEach(() => { sessionStorage.clear(); mockSistema = 'delivery'; mockSlug = 'pizzaria'; });

test('delivery: o carrinho sobrevive à troca de tela / recarga (sessionStorage)', () => {
  const a = montar();
  userEvent.click(screen.getByText('add'));
  expect(screen.getByTestId('qtd').textContent).toBe('1');
  a.unmount();
  montar();
  expect(screen.getByTestId('qtd').textContent).toBe('1');
});

test('delivery: carrinho de outro restaurante não é reaproveitado', () => {
  const a = montar();
  userEvent.click(screen.getByText('add'));
  a.unmount();
  mockSlug = 'hamburgueria';
  montar();
  expect(screen.getByTestId('qtd').textContent).toBe('0');
});

test('mesa (local): carrinho não é guardado', () => {
  mockSistema = 'local';
  const a = montar();
  userEvent.click(screen.getByText('add'));
  a.unmount();
  montar();
  expect(screen.getByTestId('qtd').textContent).toBe('0');
});
