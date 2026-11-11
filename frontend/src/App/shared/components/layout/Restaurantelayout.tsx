import React from 'react';
import { useNavigate } from 'react-router-dom';
import Navbar from './Navbar/Navbar';
import Footer from './Footer/Footer';
import ChamadosMesa from '../ChamadosMesa/ChamadosMesa';
import NovosPedidosDelivery from '../NovosPedidosDelivery/NovosPedidosDelivery';
import RestaurantSidebar from './Sidebar/RestaurantSidebar';
import { useEstabelecimento } from '../../contexts/Estabelecimentocontext';
import './Restaurantelayout.css';

interface RestaurantLayoutProps {
  children: React.ReactNode;
}

const RestaurantLayout: React.FC<RestaurantLayoutProps> = ({ children }) => {
  const navigate = useNavigate();
  const { logoUrl, nomeRestaurante } = useEstabelecimento();

  /**
   * Ícone direito clicável — navega para as configurações do restaurante.
   * Mostra a logo salva no banco (com fallback pro avatar padrão enquanto
   * nenhuma foto foi enviada ainda).
   */
  const rightIcon = (
    <button
      className="restaurant-layout__avatar-btn"
      onClick={() => navigate('/restaurante/config')}
      aria-label="Ir para configurações"
    >
      <img src={logoUrl ?? '/icons/restaurant-avatar.png'} alt="Foto do restaurante" />
    </button>
  );

  const leftIcon = (
    <img src="/icons/restaurant-logo.png" alt="Logo do restaurante" />
  );

  return (
    <div className="restaurant-layout">
      <Navbar subtitle={nomeRestaurante ?? '(Restaurante)'} rightIcon={rightIcon} leftIcon={leftIcon} mostrarTema homePath="/restaurante/home" />

      <div className="restaurant-layout__body">
        <RestaurantSidebar />
        <main className="restaurant-layout__content">{children}</main>
      </div>

      <Footer />

      {/* Chamados de garçom e pedidos de conta das mesas: aparece em qualquer tela do restaurante */}
      <ChamadosMesa />

      {/* Pedidos novos de entrega e retirada (link do restaurante): também em qualquer tela, com som diferente */}
      <NovosPedidosDelivery />
    </div>
  );
};

export default RestaurantLayout;