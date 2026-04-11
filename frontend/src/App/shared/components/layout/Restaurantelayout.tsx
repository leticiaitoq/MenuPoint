import React from 'react';
import Navbar from './Navbar/Navbar';
import Footer from './Footer/Footer';
import RestaurantSidebar from './Sidebar/RestaurantSidebar';
import './Restaurantelayout.css';

interface RestaurantLayoutProps {
  children: React.ReactNode;
}

const RestaurantLayout: React.FC<RestaurantLayoutProps> = ({ children }) => {
  const rightIcon = (
    <img src="/icons/restaurant-avatar.png" alt="Perfil do restaurante" />
  );

  const leftIcon = (
    <img src="/icons/restaurant-logo.png" alt="Logo do restaurante" />
  );

  return (
   
    <div className="restaurant-layout">
      <Navbar subtitle="(Restaurante)" rightIcon={rightIcon} leftIcon={leftIcon} />

      <div className="restaurant-layout__body" style={{ backgroundImage: 'url(/images/home-restimg.png)' }}>
        <RestaurantSidebar />
        <main className="restaurant-layout__content">{children}</main>
      </div>

      <Footer />
    </div>
    
  );
};

export default RestaurantLayout;