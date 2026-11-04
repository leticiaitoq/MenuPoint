import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { HiClipboardList, HiExclamation } from 'react-icons/hi';
import { MdTableRestaurant } from 'react-icons/md';
import { BsCashCoin } from 'react-icons/bs';
import RestaurantLayout from '../../../shared/components/layout/Restaurantelayout';
import MesaService from '../../../services/mesa.service';
import PedidoService from '../../../services/pedido.service';
import { mensagemDeErro } from '../../../services/cliente.service';
import './HomeRestaurante.css';

// ── Resumo que a Home mostra (tudo calculado a partir da API) ──────────────────
interface ResumoHome {
  totalPedidos: number;      // pedidos de hoje (sem os cancelados)
  pedidosNaFila: number;     // RECEBIDO + PREPARO (ainda na cozinha)
  pedidosAguardando: number; // RECEBIDO (ninguém começou a preparar)
  faturamento: number;       // soma dos pagamentos CONFIRMADOS de hoje
  mesasDisponiveis: number;  // mesas LIVRE
}

const RESUMO_VAZIO: ResumoHome = {
  totalPedidos: 0,
  pedidosNaFila: 0,
  pedidosAguardando: 0,
  faturamento: 0,
  mesasDisponiveis: 0,
};

// Atualiza sozinha a cada 30s, para a Home refletir a fila sem F5
const INTERVALO_ATUALIZACAO_MS = 30_000;

const formatarReais = (valor: number): string =>
  valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

// Início e fim do dia no fuso do navegador (o back filtra por criado_em, em ISO/UTC)
const limitesDeHoje = () => {
  const inicio = new Date();
  inicio.setHours(0, 0, 0, 0);
  const fim = new Date();
  fim.setHours(23, 59, 59, 999);
  return { data_inicio: inicio.toISOString(), data_fim: fim.toISOString() };
};

const HomeRestaurante: React.FC = () => {
  const navigate = useNavigate();

  const [resumo, setResumo]       = useState<ResumoHome>(RESUMO_VAZIO);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro]           = useState('');

  // ── Busca pedidos de hoje + ocupação das mesas em paralelo
  // `silencioso` = recarga automática: não pisca "carregando" e não apaga os números
  const carregar = useCallback(async (silencioso = false) => {
    if (!silencioso) setCarregando(true);
    try {
      const [pedidosHoje, ocupacao] = await Promise.all([
        PedidoService.listar(limitesDeHoje()),
        MesaService.resumoOcupacao(),
      ]);

      const validos = pedidosHoje.filter((p) => p.status !== 'CANCELADO');

      setResumo({
        totalPedidos: validos.length,
        pedidosNaFila: validos.filter((p) => p.status === 'RECEBIDO' || p.status === 'PREPARO').length,
        pedidosAguardando: validos.filter((p) => p.status === 'RECEBIDO').length,
        faturamento: validos
          .filter((p) => p.pagamento?.status === 'CONFIRMADO')
          .reduce((soma, p) => soma + (p.pagamento?.valor ?? p.total), 0),
        mesasDisponiveis: ocupacao.livre,
      });
      setErro('');
    } catch (err: any) {
      setErro(mensagemDeErro(err, 'Não foi possível carregar o resumo de hoje.'));
    } finally {
      setCarregando(false);
    }
  }, []);

  useEffect(() => {
    void carregar();
    const timer = setInterval(() => void carregar(true), INTERVALO_ATUALIZACAO_MS);
    return () => clearInterval(timer); // para o timer ao sair da tela
  }, [carregar]);

  // Enquanto carrega pela 1ª vez, mostra "—" em vez de números falsos (0)
  const ou = (texto: string) => (carregando ? '—' : texto);

  // ── Definição dos cards
  const cards = [
    {
      id: 'pedidos (cadastre)',
      icon: <HiClipboardList className="home-rest__card-icon home-rest__card-icon--red" />,
      value: `${ou(String(resumo.totalPedidos))} Pedidos`,
      route: '/restaurante/pedido',
    },
    {
      id: 'fila',
      icon: <HiExclamation className="home-rest__card-icon home-rest__card-icon--yellow" />,
      value: 'Na fila',
      badge: !carregando && resumo.pedidosNaFila > 0 ? resumo.pedidosNaFila : undefined,
      route: '/restaurante/fila',
    },
    {
      id: 'faturamento',
      icon: <BsCashCoin className="home-rest__card-icon home-rest__card-icon--green" />,
      value: 'Faturamento',
      sub: ou(formatarReais(resumo.faturamento)),
      route: '/restaurante/relatorios',
    },
    {
      id: 'mesas',
      icon: <MdTableRestaurant className="home-rest__card-icon home-rest__card-icon--red" />,
      value: 'Mesas Disponíveis',
      sub: ou(`${resumo.mesasDisponiveis} ${resumo.mesasDisponiveis === 1 ? 'mesa' : 'mesas'}`),
      route: '/restaurante/mesas',
    },
  ];

  return (
    <RestaurantLayout>
      <div className="home-rest">
        <h2 className="home-rest__title">Pedidos Hoje</h2>

        {/* Erro de carga, com opção de tentar de novo */}
        {erro && (
          <div className="home-rest__erro" role="alert">
            <span>{erro}</span>
            <button type="button" onClick={() => void carregar()}>Tentar novamente</button>
          </div>
        )}

        {/* Grade 2×2 de cards navegáveis */}
        <div className="home-rest__grid">
          {cards.map((card) => (
            <button
              key={card.id}
              className="home-rest__card"
              onClick={() => navigate(card.route)}
              aria-label={`Ir para ${card.value}`}
            >
              {card.icon}
              <span className="home-rest__card-value">{card.value}</span>
              {card.sub && (
                <span className="home-rest__card-sub">{card.sub}</span>
              )}
              {card.badge !== undefined && (
                <span className="home-rest__card-badge">{card.badge}</span>
              )}
            </button>
          ))}
        </div>

        {/* Alerta: pedidos aguardando confirmação */}
        {!carregando && resumo.pedidosAguardando > 0 && (
          <div className="home-rest__alert">
            <HiExclamation className="home-rest__alert-icon" />
            <span>
              {resumo.pedidosAguardando}{' '}
              {resumo.pedidosAguardando === 1 ? 'pedido aguardando' : 'pedidos aguardando'} confirmação!
            </span>
          </div>
        )}
      </div>
    </RestaurantLayout>
  );
};

export default HomeRestaurante;