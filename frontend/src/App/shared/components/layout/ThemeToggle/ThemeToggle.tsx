import React from 'react';
import { MdLightMode, MdDarkMode } from 'react-icons/md';
import { useTema } from '../../../contexts/TemaContext';
import './ThemeToggle.css';

/**
 * Botão sol/lua que alterna entre tema claro e escuro.
 * Fica na Navbar (compartilhada entre restaurante e cliente).
 * A preferência é salva pelo TemaContext em '@menupoint:tema'.
 */
const ThemeToggle: React.FC = () => {
  const { escuro, alternar } = useTema();
  const rotulo = escuro ? 'Ativar modo claro' : 'Ativar modo escuro';

  return (
    <button
      type="button"
      className="theme-toggle"
      onClick={alternar}
      aria-label={rotulo}
      title={rotulo}
    >
      {escuro ? <MdLightMode size={22} /> : <MdDarkMode size={22} />}
    </button>
  );
};

export default ThemeToggle;