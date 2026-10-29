import React from 'react';
import './AuthCard.css';

/**
 * Painel da marca das telas de login, cadastro de cliente, recuperação de senha etc.
 * Segue o mesmo visual da lateral do cadastro de restaurante (RegisterPage):
 * gradiente vinho, logo, "MenuPoint", frase e chapéu de chef.
 * No mobile vira o cabeçalho vermelho no topo (só logo + nome).
 */

// Mesmo desenho do ChefHatArt do RegisterPage
const ChefHatArt: React.FC = () => (
  <svg
    className="auth-brand__hat"
    viewBox="0 0 130 110"
    fill="none"
    stroke="currentColor"
    strokeWidth="3"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <path d="M34 56C14 55 9 32 30 25C32 9 55 4 64 17C73 5 96 10 97 26C118 32 112 56 92 56" />
    <path d="M36 56L40 79H88L92 56" />
    <path d="M38 67H90" />
    <ellipse cx="64" cy="93" rx="50" ry="9" />
    <path d="M110 76L122 70M114 88H128M104 66L110 55" />
  </svg>
);

interface AuthCardProps {
  /** Frase abaixo do nome (aparece só no desktop) */
  tagline?: string;
}

const AuthCard: React.FC<AuthCardProps> = ({
  tagline = 'Seu restaurante mais perto dos seus clientes.',
}) => (
  <aside className="auth-brand">
    <img src="/images/lLogo.png" alt="" className="auth-brand__logo" />
    <span className="auth-brand__wordmark" aria-label="MenuPoint">
      Menu<span>Point</span>
    </span>
    <hr className="auth-brand__divider" />
    <p className="auth-brand__tagline">{tagline}</p>
    <ChefHatArt />
  </aside>
);

export default AuthCard;