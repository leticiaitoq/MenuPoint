import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { LoginObrigatorioProvider, useLoginObrigatorio } from '../App/shared/contexts/LoginObrigatorioContext';
import { RotaExigeLogin } from '../App/shared/components/RotaExigeLogin';
import { consumirRetomada, consumirRetornoLogin, lerPendenciaLogin } from '../App/shared/utils/pendenciaLogin';

let mockLogado = false;
jest.mock('../App/shared/contexts/ClienteAuthContext', () => ({ useClienteAuth: () => ({ isAuthenticated: mockLogado }) }));

const Local = () => {
  const l = useLocation();
  return <div data-testid="local">{l.pathname}|{JSON.stringify(l.state)}</div>;
};

const BotaoPedido = () => {
  const { exigirLogin } = useLoginObrigatorio();
  return (
    <button onClick={() => exigirLogin({ motivo: 'pedido', retorno: '/menu', retomar: 'tipo-pedido' })}>enviar</button>
  );
};

const montar = (inicial = '/menu') =>
  render(
    <MemoryRouter initialEntries={[inicial]}>
      <LoginObrigatorioProvider>
        <Local />
        <Routes>
          <Route path="/menu" element={<BotaoPedido />} />
          <Route path="/dwelcome" element={<p>início</p>} />
          <Route path="/login/cliente" element={<p>tela de login</p>} />
          <Route element={<RotaExigeLogin motivo="reserva" fallback="/dwelcome" />}>
            <Route path="/reserva" element={<p>tela de reserva</p>} />
          </Route>
        </Routes>
      </LoginObrigatorioProvider>
    </MemoryRouter>
  );

beforeEach(() => { mockLogado = false; sessionStorage.clear(); });

test('sem conta: abre o modal; recusar fecha e nada acontece', async () => {
  montar();
  userEvent.click(screen.getByText('enviar'));
  expect(screen.getByText('Faça login para enviar o pedido')).toBeInTheDocument();
  userEvent.click(screen.getByText('Agora não'));
  expect(screen.queryByText('Faça login para enviar o pedido')).not.toBeInTheDocument();
  expect(screen.getByTestId('local').textContent).toContain('/menu|');
  expect(lerPendenciaLogin()).toBeNull();
});

test('sem conta: aceitar guarda a pendência e vai para o login com a tela de retorno', async () => {
  montar();
  userEvent.click(screen.getByText('enviar'));
  userEvent.click(screen.getByText('Fazer login'));
  expect(screen.getByText('tela de login')).toBeInTheDocument();
  expect(screen.getByTestId('local').textContent).toContain('"from":"/menu"');
  expect(lerPendenciaLogin()?.retomar).toBe('tipo-pedido');
  // depois de entrar: volta para o menu e a retomada vale uma única vez
  expect(consumirRetornoLogin(undefined)).toBe('/menu');
  expect(consumirRetomada('tipo-pedido')).toBe(true);
  expect(consumirRetomada('tipo-pedido')).toBe(false);
});

test('logado: não abre modal', () => {
  mockLogado = true;
  montar();
  userEvent.click(screen.getByText('enviar'));
  expect(screen.queryByText('Faça login para enviar o pedido')).not.toBeInTheDocument();
});

test('link direto para /reserva sem conta: volta ao início e mostra o modal', () => {
  montar('/reserva');
  expect(screen.getByText('início')).toBeInTheDocument();
  expect(screen.getByText('Faça login para reservar')).toBeInTheDocument();
  userEvent.click(screen.getByText('Agora não'));
  expect(screen.getByText('início')).toBeInTheDocument();
});

test('/reserva logado abre a tela', () => {
  mockLogado = true;
  montar('/reserva');
  expect(screen.getByText('tela de reserva')).toBeInTheDocument();
});
