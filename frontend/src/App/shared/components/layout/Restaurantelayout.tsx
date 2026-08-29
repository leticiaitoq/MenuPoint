import React from 'react';
import { useNavigate } from 'react-router-dom';
import Navbar from './Navbar/Navbar';
import Footer from './Footer/Footer';
import RestaurantSidebar from './Sidebar/RestaurantSidebar';
import { useEstabelecimento } from '../../contexts/Estabelecimentocontext';
import './Restaurantelayout.css';

interface RestaurantLayoutProps {
  children: React.ReactNode;
}

const RestaurantLayout: React.FC<RestaurantLayoutProps> = ({ children }) => {
  const navigate = useNavigate();
  const { logoUrl } = useEstabelecimento();

  /**
   * Ícone direito clicável — navega para as configurações do restaurante.
   * Mostra a foto que o restaurante enviou em Configurações (com fallback
   * pro avatar padrão enquanto nenhuma foto foi enviada ainda).
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
      <Navbar subtitle="(Restaurante)" rightIcon={rightIcon} leftIcon={leftIcon} />

      <div className="restaurant-layout__body">
        <RestaurantSidebar />
        <main className="restaurant-layout__content">{children}</main>
      </div>

      <Footer />
    </div>
  );
};

export default RestaurantLayout;