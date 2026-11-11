import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { FiArrowLeft, FiCalendar } from 'react-icons/fi';
import RestaurantLayout from '../../../shared/components/layout/Restaurantelayout';
import { mensagemDeErro } from '../../../services/cliente.service';
import {
  ReservaRestauranteService,
  Reserva as ReservaApi,
  ReservaAgrupada,
  agruparReservas,
  dataDaReserva,
  horaDaIso,
  hojeLocal,
  somarDias,
} from '../../../services/reserva.service';
import './HistoricoReservas.css';

/**
 * Histórico de reservas do restaurante, com os números do período:
 * quantas foram feitas, quantas o cliente compareceu, quantas foram canceladas (e por quem),
 * quantas ficaram sem comparecimento, e a distribuição por dia.
 * Uma reserva em várias mesas conta UMA vez (as linhas do mesmo grupo são juntadas).
 */

type Periodo = 'hoje' | 'semana' | 'semana_passada' | 'mes' | 'personalizado';
type Contar = 'data_reserva' | 'feita_em';
type Classe = 'compareceu' | 'aberta' | 'cancelada' | 'sem_comparecimento';
type FiltroClasse = 'todas' | Classe;

const JANELA_FUTURO_DIAS = 120; // ao contar por "feita em": reservas feitas no período podem ser para datas à frente
const PASSO_LISTA = 20;

const ROTULO_CLASSE: Record<Classe, string> = {
  compareceu: 'Cliente compareceu',
  aberta: 'Em aberto',
  cancelada: 'Cancelada',
  sem_comparecimento: 'Sem comparecimento',
};

const pad = (n: number) => String(n).padStart(2, '0');

const diaDaSemana = (dia: string): number => {
  const [a, m, d] = dia.split('-').map(Number);
  return new Date(a, m - 1, d).getDay(); // 0 = domingo
};
const inicioDaSemana = (dia: string): string => somarDias(dia, -((diaDaSemana(dia) + 6) % 7)); // segunda-feira
const formatarDia = (dia: string): string => `${dia.slice(8, 10)}/${dia.slice(5, 7)}`;
const formatarDiaCompleto = (dia: string): string => `${dia.slice(8, 10)}/${dia.slice(5, 7)}/${dia.slice(0, 4)}`;
const diasEntre = (inicio: string, fim: string): number => {
  const [a1, m1, d1] = inicio.split('-').map(Number);
  const [a2, m2, d2] = fim.split('-').map(Number);
  return Math.round((new Date(a2, m2 - 1, d2).getTime() - new Date(a1, m1 - 1, d1).getTime()) / 86_400_000);
};

const intervaloDoPeriodo = (p: Exclude<Periodo, 'personalizado'>, hoje: string): [string, string] => {
  if (p === 'hoje') return [hoje, hoje];
  if (p === 'semana') {
    const ini = inicioDaSemana(hoje);
    return [ini, somarDias(ini, 6)];
  }
  if (p === 'semana_passada') {
    const ini = somarDias(inicioDaSemana(hoje), -7);
    return [ini, somarDias(ini, 6)];
  }
  const [a, m] = hoje.split('-').map(Number);
  const ultimo = new Date(a, m, 0).getDate();
  return [`${a}-${pad(m)}-01`, `${a}-${pad(m)}-${pad(ultimo)}`];
};

const ROTULO_PERIODO: Record<Periodo, string> = {
  hoje: 'Hoje',
  semana: 'Esta semana',
  semana_passada: 'Semana passada',
  mes: 'Este mês',
  personalizado: 'Personalizado',
};

/** Compareceu / em aberto / cancelada / confirmada que já passou sem baixa (sem comparecimento) */
const classificar = (g: ReservaAgrupada, hoje: string): Classe => {
  const r = g.base;
  if (r.status === 'CANCELADA') return 'cancelada';
  if (r.status === 'CONCLUIDA') return 'compareceu';
  return dataDaReserva(r) < hoje ? 'sem_comparecimento' : 'aberta';
};

const situacaoDetalhada = (g: ReservaAgrupada, classe: Classe): string => {
  const r = g.base;
  if (classe === 'cancelada') {
    if (r.cancelada_por === 'CLIENTE') return 'Cancelada pelo cliente';
    if (r.cancelada_por === 'RECUSADA') return 'Recusada pelo restaurante';
    return 'Cancelada pelo restaurante';
  }
  if (classe === 'aberta') return r.status === 'PENDENTE' ? 'Aguardando confirmação' : 'Confirmada';
  return ROTULO_CLASSE[classe];
};

const origemDaReserva = (r: ReservaApi) => (r.cliente_id ? 'App do cliente' : 'Caixa');
const mesasDaReserva = (g: ReservaAgrupada) =>
  g.mesas.length ? g.mesas.map((m) => pad(m.numero)).join(', ') : '-';
const diaEmQueFoiFeita = (r: ReservaApi): string => (r.criado_em ? hojeLocal(new Date(r.criado_em).getTime()) : dataDaReserva(r));

const percentual = (parte: number, total: number): string =>
  total === 0 ? '0%' : `${Math.round((parte / total) * 100)}%`;

interface Balde {
  chave: string;
  rotulo: string;
  titulo: string;
  contagem: Record<Classe, number>;
  total: number;
}

const HistoricoReservas: React.FC = () => {
  const navigate = useNavigate();
  const hoje = hojeLocal();
  const [periodo, setPeriodo] = useState<Periodo>('semana');
  const [personalizado, setPersonalizado] = useState<[string, string]>([somarDias(hoje, -7), hoje]);
  const [contar, setContar] = useState<Contar>('data_reserva');
  const [filtro, setFiltro] = useState<FiltroClasse>('todas');
  const [reservas, setReservas] = useState<ReservaApi[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [visiveis, setVisiveis] = useState(PASSO_LISTA);

  const [inicio, fim] = useMemo<[string, string]>(() => {
    if (periodo === 'personalizado') {
      const [a, b] = personalizado;
      return a && b && a <= b ? [a, b] : [a || hoje, a && b && a > b ? a : b || hoje];
    }
    return intervaloDoPeriodo(periodo, hoje);
  }, [periodo, personalizado, hoje]);

  const carregar = useCallback(async () => {
    setCarregando(true);
    setErro(null);
    try {
      // Por "feita em" a reserva pode ser para uma data depois do período, então a busca vai mais à frente
      const limite = contar === 'feita_em' ? somarDias(fim, JANELA_FUTURO_DIAS) : fim;
      setReservas(await ReservaRestauranteService.listarPeriodo(inicio, limite));
    } catch (e: any) {
      setErro(mensagemDeErro(e, 'Não foi possível carregar as reservas.'));
    } finally {
      setCarregando(false);
    }
  }, [inicio, fim, contar]);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  useEffect(() => {
    setVisiveis(PASSO_LISTA);
  }, [periodo, personalizado, contar, filtro]);

  // Reservas do período (uma por grupo), já com a classe de cada uma
  const itens = useMemo(() => {
    return agruparReservas(reservas)
      .filter((g) => {
        const dia = contar === 'data_reserva' ? dataDaReserva(g.base) : diaEmQueFoiFeita(g.base);
        return dia >= inicio && dia <= fim;
      })
      .map((g) => ({ g, classe: classificar(g, hoje) }));
  }, [reservas, contar, inicio, fim, hoje]);

  const resumo = useMemo(() => {
    const c: Record<Classe, number> = { compareceu: 0, aberta: 0, cancelada: 0, sem_comparecimento: 0 };
    let porCliente = 0;
    let porRestaurante = 0;
    let recusadas = 0;
    let doApp = 0;
    let pessoasEsperadas = 0;
    itens.forEach(({ g, classe }) => {
      c[classe] += 1;
      if (classe === 'cancelada') {
        if (g.base.cancelada_por === 'CLIENTE') porCliente += 1;
        else if (g.base.cancelada_por === 'RECUSADA') recusadas += 1;
        else porRestaurante += 1;
      } else {
        pessoasEsperadas += g.pessoas;
      }
      if (g.base.cliente_id) doApp += 1;
    });
    const total = itens.length;
    return { c, total, porCliente, porRestaurante, recusadas, doApp, doCaixa: total - doApp, pessoasEsperadas };
  }, [itens]);

  // Distribuição: um balde por dia (período de até 31 dias) ou por semana (períodos maiores)
  const baldes = useMemo<Balde[]>(() => {
    const porSemana = diasEntre(inicio, fim) > 30;
    const mapa = new Map<string, Balde>();
    const criar = (chave: string): Balde => ({
      chave,
      rotulo: formatarDia(chave),
      titulo: porSemana ? `Semana de ${formatarDiaCompleto(chave)}` : formatarDiaCompleto(chave),
      contagem: { compareceu: 0, aberta: 0, cancelada: 0, sem_comparecimento: 0 },
      total: 0,
    });
    // Garante os dias vazios no gráfico
    if (!porSemana) {
      for (let d = inicio; d <= fim; d = somarDias(d, 1)) mapa.set(d, criar(d));
    }
    itens.forEach(({ g, classe }) => {
      const dia = contar === 'data_reserva' ? dataDaReserva(g.base) : diaEmQueFoiFeita(g.base);
      const chave = porSemana ? inicioDaSemana(dia) : dia;
      if (!mapa.has(chave)) mapa.set(chave, criar(chave));
      const b = mapa.get(chave)!;
      b.contagem[classe] += 1;
      b.total += 1;
    });
    return Array.from(mapa.values()).sort((a, b) => a.chave.localeCompare(b.chave));
  }, [itens, inicio, fim, contar]);

  const maiorBalde = Math.max(1, ...baldes.map((b) => b.total));

  const listaFiltrada = useMemo(
    () =>
      itens
        .filter(({ classe }) => filtro === 'todas' || classe === filtro)
        .sort((a, b) =>
          (dataDaReserva(b.g.base) + horaDaIso(b.g.base.hora_inicio)).localeCompare(
            dataDaReserva(a.g.base) + horaDaIso(a.g.base.hora_inicio)
          )
        ),
    [itens, filtro]
  );

  const rotuloIntervalo = inicio === fim ? formatarDiaCompleto(inicio) : `${formatarDiaCompleto(inicio)} a ${formatarDiaCompleto(fim)}`;
  const reservasDoCliente = contar === 'data_reserva' ? 'marcadas para o período' : 'feitas no período';

  return (
    <RestaurantLayout>
      <div className="hres">
        <div className="hres__cabecalho">
          <div>
            <button
              type="button"
              className="hres__voltar"
              onClick={() => navigate('/restaurante/caixa', { state: { aba: 'reservas' } })}
            >
              <FiArrowLeft aria-hidden="true" /> Voltar
            </button>
            <h2 className="hres__titulo">Histórico de reservas</h2>
            <p className="hres__subtitulo">
              Acompanhe quantas reservas foram {reservasDoCliente}, quantas deram certo e quantas foram canceladas.
            </p>
          </div>
        </div>

        {/* ── Período e forma de contar ── */}
        <div className="hres__controles">
          <div className="hres__chips" role="tablist" aria-label="Período">
            {(Object.keys(ROTULO_PERIODO) as Periodo[]).map((p) => (
              <button
                key={p}
                type="button"
                role="tab"
                aria-selected={periodo === p}
                className={`hres__chip${periodo === p ? ' hres__chip--ativo' : ''}`}
                onClick={() => setPeriodo(p)}
              >
                {p === 'personalizado' && <FiCalendar />} {ROTULO_PERIODO[p]}
              </button>
            ))}
          </div>

          <div className="hres__chips" role="tablist" aria-label="Contar reservas por">
            <button
              type="button"
              role="tab"
              aria-selected={contar === 'data_reserva'}
              className={`hres__chip${contar === 'data_reserva' ? ' hres__chip--ativo' : ''}`}
              onClick={() => setContar('data_reserva')}
              title="Conta pelo dia em que a mesa foi reservada"
            >
              Por data da reserva
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={contar === 'feita_em'}
              className={`hres__chip${contar === 'feita_em' ? ' hres__chip--ativo' : ''}`}
              onClick={() => setContar('feita_em')}
              title="Conta pelo dia em que o cliente (ou o Caixa) fez a reserva"
            >
              Por data em que foi feita
            </button>
          </div>
        </div>

        {periodo === 'personalizado' && (
          <div className="hres__datas">
            <label>
              De
              <input
                type="date"
                value={personalizado[0]}
                onChange={(e) => setPersonalizado([e.target.value, personalizado[1]])}
              />
            </label>
            <label>
              Até
              <input
                type="date"
                value={personalizado[1]}
                onChange={(e) => setPersonalizado([personalizado[0], e.target.value])}
              />
            </label>
          </div>
        )}

        <p className="hres__intervalo">{rotuloIntervalo}</p>

        {erro && (
          <p className="hres__erro" role="alert">
            {erro} <button type="button" onClick={() => void carregar()}>Tentar novamente</button>
          </p>
        )}

        {/* ── Números do período ── */}
        <div className="hres__kpis">
          <div className="hres__kpi">
            <span className="hres__kpi-rotulo">Total de reservas</span>
            <strong className="hres__kpi-valor">{carregando ? '…' : resumo.total}</strong>
            <span className="hres__kpi-nota">{resumo.pessoasEsperadas} pessoas (sem as canceladas)</span>
          </div>
          <div className="hres__kpi hres__kpi--compareceu">
            <span className="hres__kpi-rotulo">Cliente compareceu</span>
            <strong className="hres__kpi-valor">{carregando ? '…' : resumo.c.compareceu}</strong>
            <span className="hres__kpi-nota">{percentual(resumo.c.compareceu, resumo.total)} do total</span>
          </div>
          <div className="hres__kpi hres__kpi--cancelada">
            <span className="hres__kpi-rotulo">Canceladas</span>
            <strong className="hres__kpi-valor">{carregando ? '…' : resumo.c.cancelada}</strong>
            <span className="hres__kpi-nota">{percentual(resumo.c.cancelada, resumo.total)} do total</span>
          </div>
          <div className="hres__kpi hres__kpi--aberta">
            <span className="hres__kpi-rotulo">Em aberto</span>
            <strong className="hres__kpi-valor">{carregando ? '…' : resumo.c.aberta}</strong>
            <span className="hres__kpi-nota">pendentes ou confirmadas, ainda por vir</span>
          </div>
          <div className="hres__kpi hres__kpi--sem">
            <span className="hres__kpi-rotulo">Sem comparecimento</span>
            <strong className="hres__kpi-valor">{carregando ? '…' : resumo.c.sem_comparecimento}</strong>
            <span className="hres__kpi-nota">data passou e não houve baixa de chegada</span>
          </div>
        </div>

        {/* ── Detalhes: cancelamentos e origem ── */}
        <div className="hres__duplo">
          <section className="hres__cartao">
            <h3 className="hres__cartao-titulo">Quem cancelou</h3>
            <ul className="hres__lista-simples">
              <li><span>Pelo cliente</span><strong>{resumo.porCliente}</strong></li>
              <li><span>Pelo restaurante</span><strong>{resumo.porRestaurante}</strong></li>
              <li><span>Recusadas pelo restaurante</span><strong>{resumo.recusadas}</strong></li>
            </ul>
          </section>
          <section className="hres__cartao">
            <h3 className="hres__cartao-titulo">Onde foi feita</h3>
            <ul className="hres__lista-simples">
              <li><span>App do cliente</span><strong>{resumo.doApp}</strong></li>
              <li><span>Caixa (restaurante)</span><strong>{resumo.doCaixa}</strong></li>
            </ul>
          </section>
        </div>

        {/* ── Distribuição por dia/semana ── */}
        <section className="hres__cartao">
          <h3 className="hres__cartao-titulo">
            {diasEntre(inicio, fim) > 30 ? 'Reservas por semana' : 'Reservas por dia'}
          </h3>
          <div className="hres__legenda">
            {(Object.keys(ROTULO_CLASSE) as Classe[]).map((c) => (
              <span key={c} className="hres__legenda-item">
                <i className={`hres__cor hres__cor--${c}`} /> {ROTULO_CLASSE[c]}
              </span>
            ))}
          </div>
          <div className="hres__grafico" role="img" aria-label="Gráfico de reservas por dia">
            {baldes.map((b) => (
              <div key={b.chave} className="hres__coluna" title={`${b.titulo}: ${b.total} reserva(s)`}>
                <span className="hres__coluna-total">{b.total > 0 ? b.total : ''}</span>
                <div className="hres__area">
                <div className="hres__barra" style={{ height: `${(b.total / maiorBalde) * 100}%` }}>
                  {(['compareceu', 'aberta', 'sem_comparecimento', 'cancelada'] as Classe[]).map((c) =>
                    b.contagem[c] > 0 ? (
                      <div
                        key={c}
                        className={`hres__segmento hres__cor--${c}`}
                        style={{ flexGrow: b.contagem[c] }}
                      />
                    ) : null
                  )}
                </div>
                </div>
                <span className="hres__coluna-rotulo">{b.rotulo}</span>
              </div>
            ))}
          </div>
        </section>

        {/* ── Lista ── */}
        <section className="hres__cartao">
          <div className="hres__lista-topo">
            <h3 className="hres__cartao-titulo">Reservas do período</h3>
            <div className="hres__chips" role="tablist" aria-label="Filtrar por situação">
              {(['todas', 'compareceu', 'aberta', 'sem_comparecimento', 'cancelada'] as FiltroClasse[]).map((f) => (
                <button
                  key={f}
                  type="button"
                  role="tab"
                  aria-selected={filtro === f}
                  className={`hres__chip hres__chip--pequeno${filtro === f ? ' hres__chip--ativo' : ''}`}
                  onClick={() => setFiltro(f)}
                >
                  {f === 'todas' ? 'Todas' : ROTULO_CLASSE[f]}
                  <span className="hres__chip-num">{f === 'todas' ? resumo.total : resumo.c[f]}</span>
                </button>
              ))}
            </div>
          </div>

          <div className="hres__tabela-wrapper">
            <table className="hres__tabela">
              <thead>
                <tr>
                  <th>Data</th>
                  <th>Hora</th>
                  <th>Cliente</th>
                  <th>Mesa(s)</th>
                  <th>Pessoas</th>
                  <th>Feita em</th>
                  <th>Origem</th>
                  <th>Situação</th>
                </tr>
              </thead>
              <tbody>
                {carregando && (
                  <tr><td colSpan={8} className="hres__vazio">Carregando reservas...</td></tr>
                )}
                {!carregando && listaFiltrada.length === 0 && (
                  <tr><td colSpan={8} className="hres__vazio">Nenhuma reserva encontrada neste período.</td></tr>
                )}
                {!carregando &&
                  listaFiltrada.slice(0, visiveis).map(({ g, classe }) => (
                    <tr key={g.base.grupo_id ?? g.base.id}>
                      <td>{formatarDia(dataDaReserva(g.base))}</td>
                      <td>{horaDaIso(g.base.hora_inicio)}</td>
                      <td>{g.base.cliente_nome}</td>
                      <td>{mesasDaReserva(g)}</td>
                      <td>{g.pessoas}</td>
                      <td>{g.base.criado_em ? formatarDia(diaEmQueFoiFeita(g.base)) : '-'}</td>
                      <td>{origemDaReserva(g.base)}</td>
                      <td>
                        <span className={`hres__badge hres__badge--${classe}`}>{situacaoDetalhada(g, classe)}</span>
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>

          {listaFiltrada.length > visiveis && (
            <button type="button" className="hres__mais" onClick={() => setVisiveis((v) => v + PASSO_LISTA)}>
              Mostrar mais ({listaFiltrada.length - visiveis} restantes)
            </button>
          )}
        </section>
      </div>
    </RestaurantLayout>
  );
};

export default HistoricoReservas;