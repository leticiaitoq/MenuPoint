import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { MdEmail } from 'react-icons/md';
import { HiEye, HiEyeOff } from 'react-icons/hi';
import AuthCard from '../auth/AuthCard';
import AuthService from '../../services/auth.service';
import './LoginCliente.css';

const LoginCliente: React.FC = () => {
  const navigate = useNavigate();

  const [emailCliente, setEmailCliente] = useState('');
  const [senhaCliente, setSenhaCliente] = useState('');
  const [mostrarSenha, setMostrarSenha] = useState(false);
  const [erroCliente, setErroCliente] = useState<string | null>(null);
  const [carregandoCliente, setCarregandoCliente] = useState(false);

  const handleSubmitCliente = async (e: React.FormEvent) => {
    e.preventDefault();
    setErroCliente(null);
    setCarregandoCliente(true);

    try {
      const resultadoCliente = await AuthService.login({
        email: emailCliente,
        senha: senhaCliente,
      });

      localStorage.setItem('@menupoint:token', resultadoCliente.token);
      localStorage.setItem('@menupoint:usuario', JSON.stringify(resultadoCliente.usuario));

      navigate('/cliente/home');
    } catch (err: any) {
      setErroCliente(err?.response?.data?.message ?? 'Email ou senha inválidos.');
    } finally {
      setCarregandoCliente(false);
    }
  };

  return (
    <div
      className="login-cliente"
      style={{ backgroundImage: 'url(/images/Register-Back.png)' }}
    >
      <div className="login-cliente__container">
        <AuthCard />

        <div className="login-cliente__form-side">
          <h1 className="login-cliente__title">Entrar</h1>

          <form className="login-cliente__form" onSubmit={handleSubmitCliente}>

            {/* Mensagem de erro */}
            {erroCliente && (
              <p style={{ color: 'red', fontSize: '14px', marginBottom: '8px' }}>
                {erroCliente}
              </p>
            )}

            {/* Campo Email */}
            <div className="login-cliente__field">
              <label className="login-cliente__label" htmlFor="emailCliente">Email</label>
              <div className="login-cliente__input-wrapper">
                <MdEmail className="login-cliente__input-icon" />
                <input
                  id="emailCliente"
                  type="email"
                  placeholder="seu@email.com"
                  className="login-cliente__input login-cliente__input--with-icon"
                  value={emailCliente}
                  onChange={(e) => setEmailCliente(e.target.value)}
                  required
                />
              </div>
            </div>

            {/* Campo Senha */}
            <div className="login-cliente__field">
              <label className="login-cliente__label" htmlFor="senhaCliente">Senha</label>
              <div className="login-cliente__input-wrapper">
                <input
                  id="senhaCliente"
                  type={mostrarSenha ? 'text' : 'password'}
                  placeholder="Digite sua senha"
                  className="login-cliente__input login-cliente__input--with-toggle"
                  value={senhaCliente}
                  onChange={(e) => setSenhaCliente(e.target.value)}
                  required
                />
                <button
                  type="button"
                  className="login-cliente__toggle-password"
                  onClick={() => setMostrarSenha((prev) => !prev)}
                  aria-label={mostrarSenha ? 'Ocultar senha' : 'Mostrar senha'}
                >
                  {mostrarSenha ? <HiEyeOff /> : <HiEye />}
                </button>
              </div>
            </div>

            <button
              className="login-cliente__submit"
              type="submit"
              disabled={carregandoCliente}
            >
              {carregandoCliente ? 'Entrando...' : 'Entrar'}
            </button>

          </form>

          <button className="login-cliente__forgot" onClick={() => navigate('/recover')}>
            Esqueceu sua senha?
          </button>

          <div className="login-cliente__divider" />

          <p className="login-cliente__redirect">
            Não possui uma conta?{' '}
            <button
              className="login-cliente__redirect-link"
              onClick={() => navigate('/register/cliente')}
            >
              Criar conta
            </button>
          </p>
        </div>
      </div>
    </div>
  );
};

export default LoginCliente;