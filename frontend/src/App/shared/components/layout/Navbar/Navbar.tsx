import React from 'react';
import { Link } from 'react-router-dom';
import ThemeToggle from '../ThemeToggle/ThemeToggle';
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

  /**
   * Mostra o botão de alternar tema claro/escuro.
   * Desligado por padrão: ative por layout, conforme as telas forem migradas.
   */
  mostrarTema?: boolean;

  /**
   * Rota da tela inicial. Quando informada, o logo "MenuPoint" vira um link
   * clicável para ela. Sem ela (ex.: tela de boas-vindas), o logo fica só como texto.
   */
  homePath?: string;
}

/**
 * Navbar compartilhada entre os dois perfis.
 * A diferença entre cliente e restaurante é resolvida via props,
 * evitando lógica condicional dentro do componente.
 */
const Navbar: React.FC<NavbarProps> = ({ subtitle, rightIcon, leftIcon, mostrarTema = false, homePath }) => {
  return (
    <header className="navbar">

  <div className="navbar__left">
    {leftIcon && (
      <div className="navbar__icon navbar__logo-icon">
  {leftIcon}
</div>
    )}

    {homePath ? (
      <Link to={homePath} className="navbar__logo navbar__logo--link" aria-label="MenuPoint — ir para o início">
        <span className="navbar__menu">Menu</span><span className="navbar__point">Point</span>
      </Link>
    ) : (
      <span className="navbar__logo" aria-label="MenuPoint">
        <span className="navbar__menu">Menu</span><span className="navbar__point">Point</span>
      </span>
    )}
  </div>

  <div className="navbar__center">
    <span className="navbar__subtitle">{subtitle}</span>
  </div>

  <div className="navbar__right">
    {mostrarTema && <ThemeToggle />}
    <div className="navbar__icon">
      {rightIcon}
    </div>
  </div>

</header>
  );
};

export default Navbar;