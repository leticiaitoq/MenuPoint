import React from 'react';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import Fila from '../App/pages/Restaurante/Gestão/Fila/Fila';
import PedidoService from '../App/services/pedido.service';
import ProdutoService from '../App/services/produto.service';

jest.mock('../App/shared/components/layout/Restaurantelayout', () => ({ __esModule: true, default: ({ children }: any) => <div>{children}</div> }));
jest.mock('../App/shared/contexts/Authcontext', () => ({ useAuth: () => ({ usuario: { perfil: 'CAIXA', nome: 'Maria' } }) }));
jest.mock('../App/services/pedido.service');
jest.mock('../App/services/produto.service');

const agora = new Date().toISOString();
const item = (id: string, nome: string, status: string, quantidade = 1) => ({
  id, produto_id: `prod-${id}`, quantidade, produto: { id: `prod-${id}`, nome }, status,
  preco_unitario: 10, preco_total: 10 * quantidade, observacoes: null, itens_adicionais: [],
});
const ped = (id: string, numero: number, status: string, mesaNum: number | null, itens: any[]) => ({
  id, numero_pedido: numero, cliente_nome: `Cliente ${numero}`, status,
  modalidade: mesaNum ? 'MESA' : 'ENTREGA', mesa: mesaNum ? { id: `mesa-${mesaNum}`, numero: mesaNum } : null,
  total: 20, criado_em: agora, pagamento: null, atendido_por: null, observacoes: null, itens,
});

// #1  mesa 5: tudo recebido
// #2  entrega: em preparo
// #3  mesa 5: PEDIDO FATIADO — o hambúrguer já ficou pronto, a batata ainda está no preparo
// #4  mesa 7: entregue, aguardando pagamento
const PEDIDOS_ATIVOS = [
  ped('1', 1, 'RECEBIDO', 5, [item('a', 'Pizza', 'RECEBIDO')]),
  ped('2', 2, 'PREPARO', null, [item('b', 'Esfiha', 'PREPARO')]),
  ped('3', 3, 'PREPARO', 5, [item('c', 'X-Burguer', 'PRONTO'), item('d', 'Batata', 'PREPARO')]),
];
const PEDIDO_ENTREGUE = ped('4', 4, 'ENTREGUE', 7, [item('e', 'Suco', 'ENTREGUE')]);

const mock = PedidoService as jest.Mocked<typeof PedidoService>;

const renderFila = (url = '/restaurante/fila') =>
  render(
    <MemoryRouter initialEntries={[url]}>
      <Routes>
        <Route path="/restaurante/fila" element={<Fila />} />
      </Routes>
    </MemoryRouter>
  );

const coluna = (rotulo: string) =>
  Array.from(document.querySelectorAll('.fila__coluna')).find((c) => c.textContent?.includes(rotulo)) as HTMLElement;
const abrirColuna = async (rotulo: string) =>
  userEvent.click(within(coluna(rotulo)).getByRole('button', { name: /ver pedidos/i }));
const contadores = () => Array.from(document.querySelectorAll('.fila__coluna-contador')).map((e) => e.textContent);

beforeEach(() => {
  jest.resetAllMocks();
  mock.listar.mockImplementation(async (f: any) => {
    if (f?.mesa_id) return PEDIDOS_ATIVOS.filter((p) => p.mesa?.id === f.mesa_id) as any; // comanda da cozinha
    if (f?.conta_aberta) return [PEDIDO_ENTREGUE] as any;
    if (f?.status?.includes('RECEBIDO')) return PEDIDOS_ATIVOS as any;
    return [] as any; // entregues de hoje
  });
  mock.atualizarStatusItens.mockResolvedValue(undefined);
  (ProdutoService.listar as jest.Mock).mockResolvedValue([
    { id: 'prod-a', categoria: { nome: 'Pizzas' } },
    { id: 'prod-c', categoria: { nome: 'Lanches' } },
    { id: 'prod-d', categoria: { nome: 'Porções' } },
  ]);
});

test('os contadores das etapas contam ITENS: um pedido pode estar em duas etapas ao mesmo tempo', async () => {
  renderFila();
  await waitFor(() => expect(document.querySelectorAll('.fila__coluna')).toHaveLength(4));
  // recebido: Pizza | preparando: Esfiha + Batata | pronto: X-Burguer | entregue: Suco
  expect(contadores()).toEqual(['1', '2', '1', '1']);
  expect(screen.getByText('Pedidos ativos:', { exact: false }).textContent).toContain('3');
});

test('o pedido aparece fatiado: cada etapa mostra só as comidas que estão nela', async () => {
  renderFila();
  await screen.findByText('#1');

  await abrirColuna('Pronto');
  const linha = (await screen.findByText('#3')).closest('tr') as HTMLElement;
  expect(within(linha).getByText(/X-Burguer/)).toBeTruthy();
  expect(within(linha).queryByText(/Batata/)).toBeNull();

  await abrirColuna('Preparando');
  const linhaPreparo = (await screen.findByText('#3')).closest('tr') as HTMLElement;
  expect(within(linhaPreparo).getByText(/Batata/)).toBeTruthy();
  expect(within(linhaPreparo).queryByText(/X-Burguer/)).toBeNull();
});

test('entrega só a comida pronta: avança apenas o item marcado e deixa o resto do pedido', async () => {
  renderFila();
  await screen.findByText('#1');
  await abrirColuna('Pronto');

  await userEvent.click(await screen.findByRole('checkbox', { name: /X-Burguer/ }));
  await userEvent.click(within(coluna('Pronto')).getByRole('button', { name: /avançar/i }));

  // modal no formato padrão do projeto (ModalAlerta)
  const modal = await screen.findByRole('dialog');
  expect(within(modal).getByText('Avançar este item?')).toBeTruthy();
  expect(within(modal).getByText(/#3 · Mesa 05 — 1x X-Burguer/)).toBeTruthy();
  expect(modal.className).toContain('alerta__modal');
  await userEvent.click(within(modal).getByRole('button', { name: 'Avançar' }));

  await waitFor(() => expect(mock.atualizarStatusItens).toHaveBeenCalledWith('3', ['c'], 'ENTREGUE'));
  expect(mock.atualizarStatusItens).toHaveBeenCalledTimes(1);
  expect(mock.atualizarStatus).not.toHaveBeenCalled(); // não mexe no pedido inteiro
  await waitFor(() => expect(mock.listar.mock.calls.length).toBeGreaterThan(3)); // recarregou
});

test('vários itens marcados de pedidos diferentes avançam juntos, um pedido por chamada', async () => {
  renderFila();
  await screen.findByText('#1');
  await abrirColuna('Preparando');

  await userEvent.click(await screen.findByRole('checkbox', { name: /Esfiha/ }));
  await userEvent.click(await screen.findByRole('checkbox', { name: /Batata/ }));
  await userEvent.click(within(coluna('Preparando')).getByRole('button', { name: /avançar/i }));
  expect(await screen.findByText('Avançar 2 itens?')).toBeTruthy();
  await userEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Avançar' }));

  await waitFor(() => expect(mock.atualizarStatusItens).toHaveBeenCalledTimes(2));
  expect(mock.atualizarStatusItens).toHaveBeenCalledWith('2', ['b'], 'PRONTO');
  expect(mock.atualizarStatusItens).toHaveBeenCalledWith('3', ['d'], 'PRONTO');
});

test('cancelar o modal não chama a API', async () => {
  renderFila();
  await screen.findByText('#1');
  await userEvent.click(await screen.findByRole('checkbox', { name: /Pizza/ }));
  await userEvent.click(within(coluna('Recebido')).getByRole('button', { name: /avançar/i }));
  await userEvent.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Cancelar' }));
  expect(screen.queryByRole('dialog')).toBeNull();
  expect(mock.atualizarStatusItens).not.toHaveBeenCalled();
});

test('não existe mais botão que abre o Caixa; o botão da comanda tem o mesmo visual do Avançar', async () => {
  renderFila();
  await screen.findByText('#1');
  expect(screen.queryByRole('button', { name: /^caixa/i })).toBeNull();
  expect(screen.queryByText(/abrir conta no caixa/i)).toBeNull();

  const botao = (await screen.findAllByRole('button', { name: /comanda da cozinha/i }))[0];
  expect(botao.className).toContain('fila__btn-avancar');
  expect(botao.className).toContain('fila__btn-avancar--ativo');
});

test('o botão mostra a comanda da cozinha da mesa e permite imprimir', async () => {
  const imprimir = jest.spyOn(window, 'print').mockImplementation(() => undefined);
  renderFila();
  await screen.findByText('#1');

  const linha = screen.getByText('#1').closest('tr') as HTMLElement; // mesa 5
  await userEvent.click(within(linha).getByRole('button', { name: /comanda da cozinha/i }));

  expect(await screen.findByText('Comanda da cozinha · Mesa 05')).toBeTruthy();
  // mesma comanda do Caixa: todos os pedidos em andamento da mesa, itens agrupados por categoria
  expect(await screen.findByText('NÃO DESTACAR - COMANDA PARA COZINHA')).toBeTruthy();
  expect(screen.getByText('PIZZAS')).toBeTruthy();
  expect(screen.getByText('X-Burguer')).toBeTruthy();
  expect(mock.listar).toHaveBeenCalledWith(expect.objectContaining({ mesa_id: 'mesa-5' }));

  await userEvent.click(screen.getByRole('button', { name: /imprimir/i }));
  expect(imprimir).toHaveBeenCalledTimes(1);

  await userEvent.click(screen.getAllByRole('button', { name: /fechar/i }).pop() as HTMLElement);
  await waitFor(() => expect(screen.queryByText('Comanda da cozinha · Mesa 05')).toBeNull());
  imprimir.mockRestore();
});

test('pedido de entrega/retirada (sem mesa) não tem comanda da cozinha', async () => {
  renderFila();
  await screen.findByText('#1');
  await abrirColuna('Preparando');
  const linha = (await screen.findByText('#2')).closest('tr') as HTMLElement;
  expect(within(linha).queryByRole('button', { name: /comanda da cozinha/i })).toBeNull();
});

test('entregue de mesa continua mostrando "aguardando pagamento"', async () => {
  renderFila();
  await screen.findByText('#1');
  await abrirColuna('Entregue');
  expect(await screen.findByText('Aguardando pagamento')).toBeTruthy();
  expect(screen.queryByRole('checkbox')).toBeNull(); // entregue não avança mais
});

test('filtro vindo do Caixa (?mesa=) mostra só aquela mesa', async () => {
  renderFila('/restaurante/fila?mesa=mesa-5');
  await screen.findByText('Mostrando só:', { exact: false });
  await waitFor(() => expect(document.querySelectorAll('.fila__coluna')).toHaveLength(4));
  // mesa 5: Pizza (recebido), Batata (preparando), X-Burguer (pronto)
  expect(contadores()).toEqual(['1', '1', '1', '0']);
  expect(screen.queryByText('#2')).toBeNull();
});

test('erro ao avançar aparece no modal, que continua aberto, e não troca a etapa', async () => {
  mock.atualizarStatusItens.mockRejectedValue({ response: { data: { message: 'Algum item já foi atualizado por outra pessoa.' } } });
  renderFila();
  await screen.findByText('#1');
  await userEvent.click(await screen.findByRole('checkbox', { name: /Pizza/ }));
  await userEvent.click(within(coluna('Recebido')).getByRole('button', { name: /avançar/i }));
  await userEvent.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Avançar' }));
  expect(await screen.findByRole('alert')).toBeTruthy();
  expect(screen.getByText('Avançar este item?')).toBeTruthy(); // modal continua aberto
});
