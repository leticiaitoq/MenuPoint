import React from 'react';
import { useLocation } from 'react-router-dom';
import { MdLightMode, MdDarkMode } from 'react-icons/md';
import { useTema } from '../../contexts/TemaContext';
import './ThemeToggleFlutuante.css';

// Botão de tema para as telas públicas que não têm navbar.
// Usa o mesmo TemaContext do app, e a landing lê a mesma chave do localStorage (@menupoint:tema).
export const ThemeToggleFlutuante: React.FC = () => {
  const { escuro, alternar } = useTema();
  const rotulo = escuro ? 'Ativar modo claro' : 'Ativar modo escuro';

  return (
    <button
      type="button"
      className="theme-toggle-flutuante"
      onClick={alternar}
      aria-label={rotulo}
      title={rotulo}
    >
      {escuro ? <MdLightMode size={22} /> : <MdDarkMode size={22} />}
    </button>
  );
};

const ROTAS_COM_BOTAO = [
  '/login',
  '/cadastro',
  '/recover',
  '/verify-code',
  '/nova-senha',
  '/login/cliente',
  '/register/cliente',
  '/recover/cliente',
  '/verify-code/cliente',
  '/nova-senha/cliente',
  '/termos',
];

// Usar uma vez dentro do <BrowserRouter>, ele mesmo decide em quais rotas aparece
export const ThemeToggleRotasPublicas: React.FC = () => {
  const { pathname } = useLocation();
  const caminho = pathname.length > 1 ? pathname.replace(/\/+$/, '') : pathname;
  return ROTAS_COM_BOTAO.includes(caminho) ? <ThemeToggleFlutuante /> : null;
};

export default ThemeToggleFlutuante;
