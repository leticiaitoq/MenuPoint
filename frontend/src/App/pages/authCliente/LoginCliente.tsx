import React, { useState } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import { MdEmail } from 'react-icons/md';
import { HiEye, HiEyeOff } from 'react-icons/hi';
import AuthCard from '../auth/AuthCard';
import ClienteService, { mensagemDeErro } from '../../services/cliente.service';
import { useClienteAuth, ROTA_APOS_LOGIN_CLIENTE } from '../../shared/contexts/ClienteAuthContext';
import './LoginCliente.css';

const LoginCliente: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { entrar, isAuthenticated } = useClienteAuth();

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
      const sessao = await ClienteService.login({
        email: emailCliente.trim(),
        senha: senhaCliente,
      });

      entrar(sessao);

      // Se foi barrado numa tela protegida, volta para ela; senão vai para a dwelcome
      const destino = (location.state as { from?: string } | null)?.from;
      navigate(destino ?? ROTA_APOS_LOGIN_CLIENTE, { replace: true });
    } catch (err: any) {
      // 403 = e-mail ainda não confirmado (o back já enviou um código novo)
      if (err?.response?.status === 403) {
        navigate('/verify-code/cliente', {
          state: { email: emailCliente.trim().toLowerCase(), mode: 'register' },
        });
        return;
      }
      setErroCliente(mensagemDeErro(err, 'E-mail ou senha inválidos.'));
    } finally {
      setCarregandoCliente(false);
    }
  };

  // Já está logado: não precisa ver a tela de login
  if (isAuthenticated) {
    return <Navigate to={ROTA_APOS_LOGIN_CLIENTE} replace />;
  }

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

          <button className="login-cliente__forgot" onClick={() => navigate('/recover/cliente')}>
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