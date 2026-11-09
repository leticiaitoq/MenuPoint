import React from 'react';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import GerenPagamentos from '../App/pages/Restaurante/Gestão/Caixa/GerenPagamentos';
import PedidoService from '../App/services/pedido.service';
import MesaService from '../App/services/mesa.service';
import { ReservaRestauranteService } from '../App/services/reserva.service';

jest.mock('../App/shared/components/layout/Restaurantelayout', () => ({ __esModule: true, default: ({ children }: any) => <div>{children}</div> }));
jest.mock('../App/shared/contexts/Authcontext', () => ({ useAuth: () => ({ usuario: { perfil: 'ADMIN', nome: 'Admin' } }) }));
jest.mock('../App/services/pedido.service');
jest.mock('../App/services/mesa.service');
jest.mock('../App/services/reserva.service', () => ({
  ...jest.requireActual('../App/services/reserva.service'),
  ReservaRestauranteService: { listarPeriodo: jest.fn(), atualizarStatus: jest.fn() },
}));

// A API devolve as horas como TIME em UTC: "1970-01-01T12:30:00.000Z"
const hora = (hhmm: string) => `1970-01-01T${hhmm}:00.000Z`;
const reserva = (id: string, mesaId: string, numero: number, ini: string, fim: string, extra: object = {}) => ({
  id, mesa_id: mesaId, cliente_nome: id === 'r1' ? 'Maria' : 'Ana', cliente_telefone: '(11) 90000-0000', cliente_email: null,
  data_reserva: '2026-11-07T00:00:00.000Z', hora_inicio: hora(ini), hora_fim: hora(fim),
  num_pessoas: 4, observacoes: null, status: 'PENDENTE', mesa: { id: mesaId, numero },
  ...extra,
});

const Local = () => { const l = useLocation(); return <div data-testid="rota">{l.pathname}{l.search}</div>; };

const montar = () =>
  render(
    <MemoryRouter initialEntries={['/restaurante/caixa']}>
      <Routes>
        <Route path="/restaurante/caixa" element={<GerenPagamentos />} />
        <Route path="*" element={<Local />} />
      </Routes>
    </MemoryRouter>
  );

beforeEach(() => {
  // "agora" fixo: 12:00 no horário local do navegador
  jest.spyOn(Date, 'now').mockReturnValue(new Date(2026, 10, 7, 12, 0, 0).getTime());
  (MesaService.listar as jest.Mock).mockResolvedValue([
    { id: 'm1', numero: 1, capacidade: 4, status: 'LIVRE', ativo: true, qr_code_token: 't1', localizacao: null },
    { id: 'm2', numero: 2, capacidade: 4, status: 'LIVRE', ativo: true, qr_code_token: 't2', localizacao: null },
    { id: 'm3', numero: 3, capacidade: 4, status: 'LIVRE', ativo: true, qr_code_token: 't3', localizacao: null },
  ]);
  (PedidoService.listar as jest.Mock).mockResolvedValue([]);
  (ReservaRestauranteService.listarPeriodo as jest.Mock).mockResolvedValue([
    reserva('r1', 'm1', 1, '12:30', '14:30'), // começa em 30 min → a mesa já aparece reservada
    reserva('r2', 'm2', 2, '19:00', '21:00', { status: 'CONFIRMADA' }), // só à noite → mesa ainda livre
  ]);
  (ReservaRestauranteService.atualizarStatus as jest.Mock).mockResolvedValue({});
});

afterEach(() => jest.restoreAllMocks());

test('o resumo desconta as mesas reservadas pelos clientes das disponíveis', async () => {
  montar();

  const resumo = await screen.findByRole('status', { name: /Resumo de disponibilidade/i });
  // 3 mesas: m1 reservada agora, m2 e m3 livres
  expect(within(resumo).getByText('de 3 mesas disponíveis').previousSibling?.textContent).toBe('2');
  expect(within(resumo).getByText('reservadas').previousSibling?.textContent).toBe('1');
  expect(within(resumo).getByText('reservas hoje').previousSibling?.textContent).toBe('2');

  // m2 está livre, mas o caixa avisa do horário marcado
  expect(screen.getByText(/Reserva hoje às 19:00 · Ana/)).toBeTruthy();

  // a lista mostra a data de cada reserva (hoje) junto com o horário
  expect(screen.getAllByText(/Hoje · 12:30–14:30/).length).toBe(1);
  const [inicio, fim] = (ReservaRestauranteService.listarPeriodo as jest.Mock).mock.calls[0];
  expect(inicio).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  expect(fim > inicio).toBe(true);
});

test('confirmar uma reserva pendente chama a API; "cliente chegou" conclui e abre a mesa', async () => {
  montar();
  await screen.findByRole('status', { name: /Resumo de disponibilidade/i });

  await userEvent.click(screen.getByRole('button', { name: 'Confirmar' }));
  await waitFor(() => expect(ReservaRestauranteService.atualizarStatus).toHaveBeenCalledWith('r1', 'CONFIRMADA', undefined));

  const botoes = screen.getAllByRole('button', { name: 'Cliente chegou' });
  await userEvent.click(botoes[0]);
  await waitFor(() => expect(ReservaRestauranteService.atualizarStatus).toHaveBeenCalledWith('r1', 'CONCLUIDA', undefined));
  await waitFor(() => expect(screen.getByTestId('rota').textContent).toBe('/restaurante/pedido?mesa=m1'));
});
