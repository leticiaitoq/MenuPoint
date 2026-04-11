import React from 'react';
import './AuthCard.css';

const AuthCard: React.FC = () => {
  return (
    <div className="auth-card">
      <img
        src="/images/Register-Image.png"
        alt="MenuPoint - logo"
        className="auth-card__image"
      />
    </div>
  );
};

export default AuthCard;