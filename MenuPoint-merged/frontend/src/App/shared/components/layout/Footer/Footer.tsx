import React from 'react';
import './Footer.css';

/**
 * Footer compartilhado entre CustomerLayout e RestaurantLayout.
 * Não aparece nas telas públicas (login, cadastro).
 */
const Footer: React.FC = () => {
  return (
    <footer className="footer">
      <span className="footer__text">@MenuPoint 2026</span>
    </footer>
  );
};

export default Footer;