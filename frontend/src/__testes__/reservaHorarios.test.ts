import {
  horariosLivres,
  horarioLivreNaMesa,
  agruparHorarios,
  detectarConflitos,
  escolherMesas,
  agruparReservas,
  horarioDentroDoFuncionamento,
  Reserva,
} from '../App/services/reserva.service';

jest.mock('../App/services/api', () => ({ __esModule: true, default: {} }));
jest.mock('../App/services/apiCliente', () => ({ __esModule: true, default: {} }));

const func = { aberto: true, abertura: '11:00', fechamento: '23:00' };
// Reserva existente 19:00–21:00 → bloqueio já alargado pelo intervalo de 30 min: 18:30–21:30
const mesa = { bloqueios: [{ inicio: '18:30', fim: '21:30' }] };
const DIA = '2026-12-01';
const ANTES = new Date(2026, 10, 7, 8, 0).getTime(); // outro dia: nada passou

test('mesa com reserva às 19–21 só oferece horários que respeitam o intervalo', () => {
  const livres = horariosLivres(mesa, func, DIA, ANTES);
  expect(livres).toContain('11:00');
  expect(livres).toContain('16:30'); // 16:30–18:30 encosta no bloqueio, mas não entra nele
  expect(livres).not.toContain('17:00'); // terminaria 19:00, em cima da reserva
  expect(livres).not.toContain('19:00');
  expect(livres).not.toContain('21:00'); // só 0 min depois do fim
  expect(livres).toContain('21:30');
});

test('restaurante fechado no dia não tem horários', () => {
  expect(horariosLivres({ bloqueios: [] }, { aberto: false, abertura: null, fechamento: null }, DIA, ANTES)).toEqual([]);
});

test('hoje não oferece horários que já passaram', () => {
  const hoje = '2026-11-07';
  const agora = new Date(2026, 10, 7, 12, 10).getTime();
  const livres = horariosLivres({ bloqueios: [] }, func, hoje, agora);
  // 12:10 + 2h de antecedência = 14:10 → o primeiro horário é 14:30
  expect(livres[0]).toBe('14:30');
  expect(livres).not.toContain('14:00');
});

test('mesmo dia exige 2h de antecedência; outro dia não', () => {
  const agora = new Date(2026, 10, 7, 12, 0).getTime();
  expect(horariosLivres({ bloqueios: [] }, func, '2026-11-07', agora)[0]).toBe('14:00'); // exatamente 2h: pode
  expect(horariosLivres({ bloqueios: [] }, func, '2026-11-08', agora)[0]).toBe('11:00');
});

test('"não sei ainda" (3h) segura a mesa por mais tempo que 2h', () => {
  // bloqueio 19:00–21:30; começar 16:30 por 2h termina 18:30 (livre), por 3h termina 19:30 (bate)
  expect(horarioLivreNaMesa({ bloqueios: [{ inicio: '19:00', fim: '21:30' }] }, '16:30', 120)).toBe(true);
  expect(horarioLivreNaMesa({ bloqueios: [{ inicio: '19:00', fim: '21:30' }] }, '16:30', 180)).toBe(false);
});

test('horário digitado à mão também respeita o bloqueio', () => {
  expect(horarioLivreNaMesa(mesa, '21:10')).toBe(false);
  expect(horarioLivreNaMesa(mesa, '21:30')).toBe(true);
});

const res = (id: string, ini: string, fim: string, extra: Partial<Reserva> = {}): Reserva => ({
  id, mesa_id: 'm1', cliente_nome: id, cliente_telefone: '1', cliente_email: null,
  data_reserva: `${DIA}T00:00:00.000Z`, hora_inicio: `1970-01-01T${ini}:00.000Z`, hora_fim: `1970-01-01T${fim}:00.000Z`,
  num_pessoas: 2, observacoes: null, status: 'PENDENTE', mesa: { id: 'm1', numero: 1 }, ...extra,
});

test('alerta de conflito: sobreposição, intervalo curto, intervalo ok e outra mesa/cancelada', () => {
  const c = detectarConflitos([
    res('a', '19:00', '21:00'),
    res('b', '20:30', '22:30'),            // sobrepõe a
    res('c', '22:45', '23:45'),            // 15 min depois de b → muito próxima
    res('d', '12:00', '14:00'),            // longe de tudo
    res('e', '19:30', '21:30', { mesa_id: 'm2' }),                // outra mesa
    res('f', '20:00', '21:00', { status: 'CANCELADA' }),          // cancelada não conta
  ]);
  const pares = c.map((x) => `${x.a.id}${x.b.id}:${x.tipo}`).sort();
  expect(pares).toEqual(['ab:sobreposicao', 'bc:proximas']);
});

test('agruparHorarios resume horários seguidos em faixas', () => {
  expect(agruparHorarios(['11:00', '11:30', '12:00', '21:30', '22:30', '23:00'])).toEqual(['11:00–12:00', '21:30', '22:30–23:00']);
  expect(agruparHorarios([])).toEqual([]);
});


test('não oferece horários nos últimos 30 min antes de fechar', () => {
  const livres = horariosLivres({ bloqueios: [] }, func, DIA, ANTES, 60);
  expect(livres).toContain('22:30'); // 30 min antes das 23:00: ainda vale
  expect(livres).not.toContain('23:00');
  expect(horarioDentroDoFuncionamento(func, '22:45')).toBe(false);
  expect(horarioDentroDoFuncionamento(func, '10:30')).toBe(false);
});

test('restaurante que fecha de madrugada', () => {
  const noite = { aberto: true, abertura: '18:00', fechamento: '02:00' };
  expect(horarioDentroDoFuncionamento(noite, '23:30')).toBe(true);
  expect(horarioDentroDoFuncionamento(noite, '01:00')).toBe(true);
  expect(horarioDentroDoFuncionamento(noite, '01:45')).toBe(false);
  expect(horarioDentroDoFuncionamento(noite, '12:00')).toBe(false);
});

const m = (numero: number, capacidade: number) => ({ id: `m${numero}`, numero, capacidade });

test('escolherMesas: uma mesa que comporta, várias mesas ou falta de assentos', () => {
  const livres = [m(1, 4), m(2, 4), m(3, 6), m(4, 4)];
  expect(escolherMesas(livres, 5).mesas.map((x) => x.id)).toEqual(['m3']); // menor mesa que comporta
  const grupo = escolherMesas(livres, 10);
  expect(grupo.falta).toBe(0);
  expect(grupo.mesas.map((x) => x.id)).toEqual(['m3', 'm4']); // 6 + 4, sem mesa sobrando
  const muitos = escolherMesas(livres, 30); // só há 18 lugares
  expect(muitos.mesas).toHaveLength(4);
  expect(muitos.falta).toBe(12);
  expect(escolherMesas([], 3)).toEqual({ mesas: [], falta: 3 });
});

test('agruparReservas junta as mesas do mesmo grupo', () => {
  const base = { cliente_nome: 'Ana', status: 'PENDENTE', data_reserva: '2026-12-01T00:00:00.000Z' } as any;
  const lista = agruparReservas([
    { ...base, id: 'a', grupo_id: 'g1', num_pessoas: 4, pessoas_total: 10, falta_assentos: 2, mesa: { id: 'm1', numero: 1 } },
    { ...base, id: 'b', grupo_id: 'g1', num_pessoas: 4, pessoas_total: 10, falta_assentos: 2, mesa: { id: 'm2', numero: 2 } },
    { ...base, id: 'c', grupo_id: null, num_pessoas: 2, mesa: { id: 'm3', numero: 3 } },
  ] as Reserva[]);
  expect(lista).toHaveLength(2);
  expect(lista[0].mesas.map((x) => x.numero)).toEqual([1, 2]);
  expect(lista[0].pessoas).toBe(10);
  expect(lista[0].falta).toBe(2);
  expect(lista[1].pessoas).toBe(2);
});
