import React from 'react';
import './Navbar.css';

interface NavbarProps {
  /**
   * Subtítulo exibido abaixo do logo — ex: "(Cliente)" ou "(Restaurante)"
   */
  subtitle: string;

  /**
   * Ícone exibido no lado direito da navbar.
   * Cada perfil passa o seu próprio ícone, mantendo o Navbar genérico.
   */
  rightIcon: React.ReactNode;

  /**
   * Ícone exibido no lado esquerdo — normalmente o logo do restaurante.
   */
  leftIcon?: React.ReactNode;
}

/**
 * Navbar compartilhada entre os dois perfis.
 * A diferença entre cliente e restaurante é resolvida via props,
 * evitando lógica condicional dentro do componente.
 */
const Navbar: React.FC<NavbarProps> = ({ subtitle, rightIcon, leftIcon }) => {
  return (
    <header className="navbar">
      <div className="navbar__left">
        {leftIcon && <div className="navbar__icon">{leftIcon}</div>}
      </div>

      <div className="navbar__center">
        <span className="navbar__logo">MenuPoint</span>
        <span className="navbar__subtitle">{subtitle}</span>
      </div>

      <div className="navbar__right">
        <div className="navbar__icon">{rightIcon}</div>
      </div>
    </header>
  );
};

export default Navbar;