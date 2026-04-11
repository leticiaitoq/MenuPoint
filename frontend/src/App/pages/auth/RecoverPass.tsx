import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { MdEmail } from 'react-icons/md';
import AuthCard from './AuthCard';
import './RecoverPass.css';

const RecoverPass: React.FC = () => {
  const navigate = useNavigate();

  const [email, setEmail] = useState('');

  /**
   * Chamar API futuramente
   */
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    console.log({ email });
  };

  return (
    <div
      className="recover-pass"
      style= {{ backgroundImage: 'url(/images/Register-Back.png)' }}
    >
      <div className="recover-pass__container">

        {/*Imagem compartilhada */}
        <AuthCard />

        {/*Formulário */}
        <div className="recover-pass__form-side">
          <h1 className="recover-pass__title">Recuperar senha</h1>
          <p className="recover-pass__subtitle">Digite seu email para receber instruções</p>

          <form className="recover-pass__form" onSubmit={handleSubmit}>

            {/* Campo Email */}
            <div className="recover-pass__field">
              <label className="recover-pass__label" htmlFor="email">
                Email
              </label>
              <div className="recover-pass__input-wrapper">
                <MdEmail className="recover-pass__input-icon" />
                <input
                  id="email"
                  type="email"
                  placeholder="seu@email.com"
                  className="recover-pass__input recover-pass__input--with-icon"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>
            </div>

            <button className="recover-pass__submit">
              Enviar link
            </button>

          </form>

          <div className="recover-pass__divider" />
            <button
              className="recover-pass__redirect-link"
              onClick={() => navigate('/login')}
            >
              Voltar para o login
            </button>
        </div>

      </div>
    </div>
  );
};

export default RecoverPass;