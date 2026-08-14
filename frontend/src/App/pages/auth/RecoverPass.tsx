import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { MdEmail } from 'react-icons/md';
import AuthCard from './AuthCard';
import AuthService from '../../services/auth.service';
import './RecoverPass.css';

const RecoverPass: React.FC = () => {
  const navigate = useNavigate();

  const [email, setEmail] = useState('');
  const [erro, setErro] = useState<string | null>(null);
  const [carregando, setCarregando] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErro(null);
    setCarregando(true);

    try {
      await AuthService.esqueciSenha(email);
      navigate('/verify-code', { state: { email, mode: 'recover' } });
    } catch (err: any) {
      setErro(err?.response?.data?.message ?? 'Erro ao enviar o e-mail. Tente novamente.');
    } finally {
      setCarregando(false);
    }
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
          <p className="recover-pass__subtitle">Digite seu email para receber o código</p>

          <form className="recover-pass__form" onSubmit={handleSubmit}>

            {/* Mensagem de erro */}
            {erro && (
              <p style={{ color: 'red', fontSize: '14px', marginBottom: '8px' }}>
                {erro}
              </p>
            )}

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

            <button className="recover-pass__submit" type="submit" disabled={carregando}>
              {carregando ? 'Enviando...' : 'Enviar código'}
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