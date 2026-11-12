import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { HiClipboardList, HiExclamation } from 'react-icons/hi';
import { MdTableRestaurant } from 'react-icons/md';
import { BsCashCoin } from 'react-icons/bs';
import RestaurantLayout from '../../../shared/components/layout/Restaurantelayout';
import MesaService from '../../../services/mesa.service';
import PedidoService from '../../../services/pedido.service';
import RelatorioService from '../../../services/relatorio.service';
import { useAuth } from '../../../shared/contexts/Authcontext';
import { mensagemDeErro } from '../../../services/cliente.service';
import './HomeRestaurante.css';

interface ResumoHome {
  totalPedidos: number;
  pedidosNaFila: number;
  pedidosAguardando: number;
  /** null = não carregou (ou o perfil não tem acesso) */
  faturamento: number | null;
  mesasDisponiveis: number;
}

const RESUMO_VAZIO: ResumoHome = {
  totalPedidos: 0,
  pedidosNaFila: 0,
  pedidosAguardando: 0,
  faturamento: null,
  mesasDisponiveis: 0,
};

const INTERVALO_ATUALIZACAO_MS = 30_000;

const formatarReais = (valor: number): string =>
  valor.toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  });

const dois = (n: number) => String(n).padStart(2, '0');

/** Hoje como AAAA-MM-DD no horário local (mesmo formato que a tela de Relatórios envia) */
const hojeISO = () => {
  const d = new Date();
  return `${d.getFullYear()}-${dois(d.getMonth() + 1)}-${dois(d.getDate())}`;
};

const limitesDeHoje = () => {
  const inicio = new Date();
  inicio.setHours(0, 0, 0, 0);

  const fim = new Date();
  fim.setHours(23, 59, 59, 999);

  return {
    data_inicio: inicio.toISOString(),
    data_fim: fim.toISOString(),
  };
};

const HomeRestaurante: React.FC = () => {
  const navigate = useNavigate();
  const { usuario } = useAuth();
  // Relatórios (e o faturamento) são só do administrador
  const ehAdmin = usuario?.perfil === 'ADMIN';

  const [resumo, setResumo] = useState<ResumoHome>(RESUMO_VAZIO);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState('');

  const carregar = useCallback(async (silencioso = false) => {
    if (!silencioso) setCarregando(true);

    try {
      const hoje = hojeISO();

      const [pedidosHoje, ativos, ocupacao, faturamento] = await Promise.all([
        // pedidos feitos hoje
        PedidoService.listar(limitesDeHoje()),
        // fila: tudo que está em andamento, de qualquer dia (igual à tela da Fila)
        PedidoService.listar({ status: ['RECEBIDO', 'PREPARO', 'PRONTO'] }),
        MesaService.resumoOcupacao(),
        // faturamento: o mesmo número da tela de Relatórios ("Hoje"). Se falhar, só esse card fica em "—"
        ehAdmin
          ? RelatorioService.resumo({ data_inicio: hoje, data_fim: hoje })
              .then((r) => r.faturamento)
              .catch(() => null)
          : Promise.resolve(null),
      ]);

      setResumo({
        totalPedidos: pedidosHoje.filter((p) => p.status !== 'CANCELADO').length,
        pedidosNaFila: ativos.length,
        pedidosAguardando: ativos.filter((p) => p.status === 'RECEBIDO').length,
        faturamento,
        mesasDisponiveis: ocupacao.livre,
      });

      setErro('');
    } catch (err: any) {
      setErro(
        mensagemDeErro(err, 'Não foi possível carregar o resumo de hoje.')
      );
    } finally {
      setCarregando(false);
    }
  }, [ehAdmin]);

  useEffect(() => {
    void carregar();

    const timer = setInterval(
      () => void carregar(true),
      INTERVALO_ATUALIZACAO_MS
    );

    return () => clearInterval(timer);
  }, [carregar]);

  const ou = (texto: string) => (carregando ? '—' : texto);

  const todosOsCards = [
    {
      id: 'pedidos',
      icon: (
        <HiClipboardList className="home-rest__card-icon home-rest__card-icon--red" />
      ),
      value: `${ou(String(resumo.totalPedidos))} Pedidos`,
      route: '/restaurante/pedido',
    },
    {
      id: 'fila',
      icon: (
        <HiExclamation className="home-rest__card-icon home-rest__card-icon--yellow" />
      ),
      value: 'Na fila',
      badge:
        !carregando && resumo.pedidosNaFila > 0
          ? resumo.pedidosNaFila
          : undefined,
      route: '/restaurante/fila',
    },
    {
      id: 'faturamento',
      icon: (
        <BsCashCoin className="home-rest__card-icon home-rest__card-icon--green" />
      ),
      value: 'Faturamento',
      sub: ou(resumo.faturamento === null ? '—' : formatarReais(resumo.faturamento)),
      route: '/restaurante/relatorios',
    },
    {
      id: 'mesas',
      icon: (
        <MdTableRestaurant className="home-rest__card-icon home-rest__card-icon--red" />
      ),
      value: 'Mesas Disponíveis',
      sub: ou(
        `${resumo.mesasDisponiveis} ${
          resumo.mesasDisponiveis === 1 ? 'mesa' : 'mesas'
        }`
      ),
      route: '/restaurante/caixa',
    },
  ];

  // O faturamento é financeiro: só o administrador vê (a API de relatórios também é só dele)
  const cards = todosOsCards.filter((c) => c.id !== 'faturamento' || ehAdmin);

  return (
    <RestaurantLayout>
      <div className="home-rest">
        <h2 className="home-rest__title">Pedidos Hoje</h2>

        {erro && (
          <div className="home-rest__erro" role="alert">
            <span>{erro}</span>
            <button type="button" onClick={() => void carregar()}>
              Tentar novamente
            </button>
          </div>
        )}

        <div className="home-rest__grid">
          {cards.map((card) => (
            <button
              key={card.id}
              className="home-rest__card"
              onClick={() => navigate(card.route)}
              aria-label={`Ir para ${card.value}`}
            >
              {card.icon}

              <span className="home-rest__card-value">
                {card.value}
              </span>

              {card.sub && (
                <span className="home-rest__card-sub">
                  {card.sub}
                </span>
              )}

              {card.badge !== undefined && (
                <span className="home-rest__card-badge">
                  {card.badge}
                </span>
              )}
            </button>
          ))}
        </div>

        {!carregando && resumo.pedidosAguardando > 0 && (
          <div className="home-rest__alert">
            <HiExclamation className="home-rest__alert-icon" />
            <span>
              {resumo.pedidosAguardando}{' '}
              {resumo.pedidosAguardando === 1
                ? 'pedido aguardando'
                : 'pedidos aguardando'}{' '}
              confirmação!
            </span>
          </div>
        )}
      </div>
    </RestaurantLayout>
  );
};

export default HomeRestaurante;