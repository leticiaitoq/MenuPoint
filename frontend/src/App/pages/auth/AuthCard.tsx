import React from 'react';
import './AuthCard.css';

const MenuPointLogo: React.FC = () => (
  <span className="auth-card-mobile__title" aria-label="MenuPoint">
    Menu<span className="auth-card-mobile__point">Point</span>
  </span>
);

const AuthCard: React.FC = () => {
  return (
    <>
      {/* ── MOBILE HEADER (≤ 768px) ── */}
      <div className="auth-card-mobile auth-header-gradient">
        <img
          src="/images/lLogo.png"
          alt="MenuPoint"
          className="auth-card-mobile__logo"
        />
        <MenuPointLogo />
      </div>

      {/* ── DESKTOP CARD (≥ 769px) ── */}
      <div className="auth-card auth-header-gradient">
        <img
          src="/images/lLogo.png"
          alt="MenuPoint"
          className="auth-card__logo"
        />
        <span className="auth-card__title" aria-label="MenuPoint">
          Menu<span className="auth-card__point">Point</span>
        </span>
      </div>
    </>
  );
};

export default AuthCard;