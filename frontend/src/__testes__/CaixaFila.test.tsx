import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import GerenPagamentos from '../App/pages/Restaurante/Gestão/Caixa/GerenPagamentos';
import PedidoService from '../App/services/pedido.service';
import MesaService from '../App/services/mesa.service';

jest.mock('../App/shared/components/layout/Restaurantelayout', () => ({ __esModule: true, default: ({ children }: any) => <div>{children}</div> }));
jest.mock('../App/shared/contexts/Authcontext', () => ({ useAuth: () => ({ usuario: { perfil: 'ADMIN', nome: 'Admin' } }) }));
jest.mock('../App/services/pedido.service');
jest.mock('../App/services/mesa.service');

const agora = new Date().toISOString();
const ped = (id: string, numero: number, status: string) => ({
  id, numero_pedido: numero, cliente_nome: `Cliente ${numero}`, status, modalidade: 'MESA',
  mesa: { id: 'm5', numero: 5 }, total: 30, criado_em: agora, pagamento: null,
  itens: [{ id: `i${id}`, quantidade: 1, produto: { nome: 'Pizza' }, preco_total: 30, itens_adicionais: [] }],
});

const Local = () => { const l = useLocation(); return <div data-testid="rota">{l.pathname}{l.search}</div>; };

test('card da mesa mostra o andamento da cozinha e leva à fila filtrada', async () => {
  (MesaService.listar as jest.Mock).mockResolvedValue([
    { id: 'm5', numero: 5, capacidade: 4, status: 'OCUPADA', ativo: true, qr_code_token: 'tk', localizacao: null },
    { id: 'm6', numero: 6, capacidade: 2, status: 'LIVRE', ativo: true, qr_code_token: 'tk2', localizacao: null },
  ]);
  (PedidoService.listar as jest.Mock).mockResolvedValue([ped('1', 1, 'PREPARO'), ped('2', 2, 'PRONTO'), ped('3', 3, 'ENTREGUE')]);

  render(
    <MemoryRouter initialEntries={['/restaurante/caixa']}>
      <Routes>
        <Route path="/restaurante/caixa" element={<GerenPagamentos />} />
        <Route path="*" element={<Local />} />
      </Routes>
    </MemoryRouter>
  );

  expect(await screen.findByText('1 na cozinha')).toBeTruthy();
  expect(screen.getByText('1 pronto p/ servir')).toBeTruthy();
  expect(screen.getByText('1 entregue')).toBeTruthy();

  // pede só a conta aberta (inclui entregues não pagos) — é o que liga o Caixa à Fila
  const chamada = (PedidoService.listar as jest.Mock).mock.calls[0][0];
  expect(chamada.conta_aberta).toBe(true);
  expect(chamada.status).toContain('ENTREGUE');

  await userEvent.click(screen.getByRole('button', { name: /Mais ações para a Mesa 5/i }));
  await userEvent.click(await screen.findByText('Ver na fila'));
  await waitFor(() => expect(screen.getByTestId('rota').textContent).toBe('/restaurante/fila?mesa=m5'));
});
