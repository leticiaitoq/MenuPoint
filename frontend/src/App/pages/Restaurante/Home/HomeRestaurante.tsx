import { useNavigate } from 'react-router-dom';
import { HiClipboardList, HiExclamation,} from 'react-icons/hi';
import { MdTableRestaurant } from 'react-icons/md';
import { BsCashCoin } from 'react-icons/bs';
import RestaurantLayout from '../../../shared/components/layout/Restaurantelayout';
import './HomeRestaurante.css';

const HomeRestaurante: React.FC = () => {
  const navigate = useNavigate();
 
  // (substituir por chamada à API futuramente) ──
  const totalPedidos = 25;
  const pedidosNaFila = 3;
  const faturamento = 'R$ 1.240,00';
  const mesasDisponiveis = 8;
  const pedidosAguardando = 5;
 
  // ── Definição dos cards
  const cards = [
    {
      id: 'pedidos',
      icon: <HiClipboardList className="home-rest__card-icon home-rest__card-icon--red" />,
      value: `${totalPedidos} Pedidos`,
      route: '/restaurant/orders',
    },
    {
      id: 'fila',
      icon: <HiExclamation className="home-rest__card-icon home-rest__card-icon--yellow" />,
      value: 'Na fila',
      badge: pedidosNaFila > 0 ? pedidosNaFila : undefined,
      route: '/restaurant/queue',
    },
    {
      id: 'faturamento',
      icon: <BsCashCoin className="home-rest__card-icon home-rest__card-icon--green" />,
      value: 'Faturamento',
      sub: faturamento,
      route: '/restaurant/reports',
    },
    {
      id: 'mesas',
      icon: <MdTableRestaurant className="home-rest__card-icon home-rest__card-icon--red" />,
      value: 'Mesas Disponíveis',
      sub: `${mesasDisponiveis} mesas`,
      route: '/restaurant/tables',
    },
  ];
 
  return (
      <RestaurantLayout>
    <div className="home-rest">
      <h2 className="home-rest__title">Pedidos Hoje</h2>
 
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
      {pedidosAguardando > 0 && (
        <div className="home-rest__alert">
          <HiExclamation className="home-rest__alert-icon" />
          <span>{pedidosAguardando} pedidos aguardando confirmação!</span>
        </div>
      )}
    </div>
    </RestaurantLayout>
  );
};

export default HomeRestaurante;