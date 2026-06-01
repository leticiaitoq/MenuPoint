import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { MdEmail } from 'react-icons/md';
import AuthCard from '../auth/AuthCard';
import './RecoverPassCliente.css';

const RecoverPassCliente: React.FC = () => {
  const navigate = useNavigate();

  const [emailCliente, setEmailCliente] = useState('');
  const [erroCliente, setErroCliente] = useState<string | null>(null);
  const [carregandoCliente, setCarregandoCliente] = useState(false);

  /**
   * Chamar API futuramente
   */
  const handleSubmitCliente = async (e: React.FormEvent) => {
    e.preventDefault();
    setErroCliente(null);
    setCarregandoCliente(true);

    try {
      // TODO: await AuthService.enviarCodigoRecuperacao({ email: emailCliente });
      navigate('/cliente/verify-code', { state: { email: emailCliente, mode: 'recover' } });
    } catch (err: any) {
      setErroCliente(err?.response?.data?.message ?? 'Erro ao enviar o código. Tente novamente.');
    } finally {
      setCarregandoCliente(false);
    }
  };

  return (
    <div
      className="recover-pass-cliente"
      style={{ backgroundImage: 'url(/images/Register-Back.png)' }}
    >
      <div className="recover-pass-cliente__container">

        {/* Imagem compartilhada */}
        <AuthCard />

        {/* Formulário */}
        <div className="recover-pass-cliente__form-side">
          <h1 className="recover-pass-cliente__title">Recuperar senha</h1>
          <p className="recover-pass-cliente__subtitle">Digite seu email para receber instruções</p>

          <form className="recover-pass-cliente__form" onSubmit={handleSubmitCliente}>

            {/* Mensagem de erro */}
            {erroCliente && (
              <p style={{ color: 'red', fontSize: '14px', marginBottom: '8px' }}>
                {erroCliente}
              </p>
            )}

            {/* Campo Email */}
            <div className="recover-pass-cliente__field">
              <label className="recover-pass-cliente__label" htmlFor="emailCliente">
                Email
              </label>
              <div className="recover-pass-cliente__input-wrapper">
                <MdEmail className="recover-pass-cliente__input-icon" />
                <input
                  id="emailCliente"
                  type="email"
                  placeholder="seu@email.com"
                  className="recover-pass-cliente__input recover-pass-cliente__input--with-icon"
                  value={emailCliente}
                  onChange={(e) => setEmailCliente(e.target.value)}
                />
              </div>
            </div>

            <button
              className="recover-pass-cliente__submit"
              type="submit"
              disabled={carregandoCliente}
            >
              {carregandoCliente ? 'Enviando...' : 'Enviar código'}
            </button>

          </form>

          <div className="recover-pass-cliente__divider" />
          <button
            className="recover-pass-cliente__redirect-link"
            onClick={() => navigate('/login/cliente')}
          >
            Voltar para o login
          </button>
        </div>

      </div>
    </div>
  );
};

export default RecoverPassCliente;