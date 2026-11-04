import React from 'react';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import Fila from '../App/pages/Restaurante/Gestão/Fila/Fila';
import PedidoService from '../App/services/pedido.service';

jest.mock('../App/shared/components/layout/Restaurantelayout', () => ({ __esModule: true, default: ({ children }: any) => <div>{children}</div> }));
jest.mock('../App/services/pedido.service');

const agora = new Date().toISOString();
const ped = (id: string, numero: number, status: string, mesaNum: number | null, extra: any = {}) => ({
  id, numero_pedido: numero, cliente_nome: `Cliente ${numero}`, status,
  modalidade: mesaNum ? 'MESA' : 'ENTREGA', mesa: mesaNum ? { id: `mesa-${mesaNum}`, numero: mesaNum } : null,
  total: 20, criado_em: agora,
  itens: [{ id: `i${id}`, quantidade: 2, produto: { nome: 'X-Burguer' }, preco_total: 20, itens_adicionais: [] }],
  ...extra,
});

const mock = PedidoService as jest.Mocked<typeof PedidoService>;

const Local = () => { const l = useLocation(); return <div data-testid="rota">{l.pathname}{l.search}</div>; };
const renderFila = (url = '/restaurante/fila') =>
  render(
    <MemoryRouter initialEntries={[url]}>
      <Routes>
        <Route path="/restaurante/fila" element={<Fila />} />
        <Route path="*" element={<Local />} />
      </Routes>
    </MemoryRouter>
  );

beforeEach(() => {
  jest.resetAllMocks();
  mock.listar.mockImplementation(async (f: any) => {
    if (f?.conta_aberta) return [ped('4', 4, 'ENTREGUE', 7)] as any;          // entregue na mesa 7, aguardando pagamento
    if (f?.status?.includes('RECEBIDO')) return [ped('1', 1, 'RECEBIDO', 5), ped('2', 2, 'PREPARO', null), ped('3', 3, 'PRONTO', 5)] as any;
    return [] as any;                                                          // entregues de hoje
  });
  mock.atualizarStatus.mockResolvedValue(undefined);
});

test('mostra os pedidos reais por etapa, com contadores', async () => {
  renderFila();
  await waitFor(() => expect(document.querySelectorAll('.fila__coluna')).toHaveLength(4));
  const contadores = Array.from(document.querySelectorAll('.fila__coluna-contador')).map((e) => e.textContent);
  expect(contadores).toEqual(['1', '1', '1', '1']); // recebido, preparando, pronto, entregue
  expect(screen.getByText('Pedidos ativos:', { exact: false }).textContent).toContain('3');
});

test('avançar chama a API com o status certo e recarrega', async () => {
  renderFila();
  await screen.findByText('#1');
  await userEvent.click(screen.getByText('#1'));                   // seleciona o pedido #1 (Recebido)
  const botao = document.querySelector('.fila__btn-avancar--ativo') as HTMLElement;
  await userEvent.click(botao);
  await userEvent.click(screen.getByRole('button', { name: /confirmar/i }));
  await waitFor(() => expect(mock.atualizarStatus).toHaveBeenCalledWith('1', 'PREPARO'));
  await waitFor(() => expect(mock.listar.mock.calls.length).toBeGreaterThan(3)); // recarregou
});

test('entregue de mesa aparece "aguardando pagamento" e leva ao Caixa', async () => {
  renderFila();
  await screen.findByText('#1');
  const coluna = Array.from(document.querySelectorAll('.fila__coluna')).find((c) => c.textContent?.includes('Entregue')) as HTMLElement;
  await userEvent.click(within(coluna).getByRole('button', { name: /ver pedidos/i }));
  expect(await screen.findByText('Aguardando pagamento')).toBeTruthy();
  await userEvent.click(screen.getByRole('button', { name: /^caixa/i }));
  expect(screen.getByTestId('rota').textContent).toBe('/restaurante/caixa/pagar/mesa-7');
});

test('filtro vindo do Caixa (?mesa=) mostra só aquela mesa', async () => {
  renderFila('/restaurante/fila?mesa=mesa-5');
  await screen.findByText('Mostrando só:', { exact: false });
  await waitFor(() => expect(document.querySelectorAll('.fila__coluna')).toHaveLength(4));
  const contadores = Array.from(document.querySelectorAll('.fila__coluna-contador')).map((e) => e.textContent);
  expect(contadores).toEqual(['1', '0', '1', '0']); // mesa 5: #1 recebido e #3 pronto
  expect(screen.queryByText('#2')).toBeNull();
});

test('erro ao avançar aparece no modal e não troca o status', async () => {
  mock.atualizarStatus.mockRejectedValue({ response: { data: { message: 'Transição de status inválida' } } });
  renderFila();
  await screen.findByText('#1');
  await userEvent.click(screen.getByText('#1'));
  await userEvent.click(document.querySelector('.fila__btn-avancar--ativo') as HTMLElement);
  await userEvent.click(screen.getByRole('button', { name: /confirmar/i }));
  expect(await screen.findByRole('alert')).toBeTruthy();
  expect(screen.getByText('Avançar pedido?')).toBeTruthy(); // modal continua aberto
});
