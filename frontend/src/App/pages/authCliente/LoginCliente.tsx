import React, { useEffect, useState } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import { MdEmail } from 'react-icons/md';
import { HiEye, HiEyeOff, HiCheckCircle } from 'react-icons/hi';
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
  const [showSucesso, setShowSucesso] = useState(false);

  // Aviso vindo de outra tela (ex.: "você abriu outro restaurante, entre novamente")
  const avisoCliente = (location.state as { aviso?: string } | null)?.aviso;

  // Mesmo padrão do login do restaurante: mostra o toast de sucesso e só navega
  // depois de um tempinho, para a pessoa ver a confirmação.
  useEffect(() => {
    if (!showSucesso) return;
    const timer = setTimeout(() => {
      // Se foi barrado numa tela protegida, volta para ela; senão vai para a dwelcome
      const destino = (location.state as { from?: string } | null)?.from;
      navigate(destino ?? ROTA_APOS_LOGIN_CLIENTE, { replace: true });
    }, 1200);
    return () => clearTimeout(timer);
  }, [showSucesso, navigate, location.state]);

  const handleSubmitCliente = async (e: React.FormEvent) => {
    e.preventDefault();
    setErroCliente(null);
    setCarregandoCliente(true);

    try {
      const sessao = await ClienteService.login({
        email: emailCliente.trim(),
        senha: senhaCliente,
      });

      // O toast vem ANTES do entrar(): assim que a sessão existe, o guard abaixo
      // ("já está logado") não pode redirecionar antes da mensagem aparecer.
      setShowSucesso(true);
      entrar(sessao);
    } catch (err: any) {
      // 403 = e-mail ainda não confirmado (o back já enviou um código novo)
      if (err?.response?.status === 403) {
        navigate('/verify-code/cliente', {
          state: {
            email: emailCliente.trim().toLowerCase(),
            mode: 'register',
            aviso: 'Seu e-mail ainda não foi confirmado. Use o código mais recente enviado para a sua caixa de entrada.',
          },
        });
        return;
      }
      setErroCliente(mensagemDeErro(err, 'E-mail ou senha inválidos.'));
    } finally {
      setCarregandoCliente(false);
    }
  };

  // Já está logado: não precisa ver a tela de login (exceto durante o toast de sucesso)
  if (isAuthenticated && !showSucesso) {
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

            {/* Aviso informativo */}
            {avisoCliente && !erroCliente && (
              <p className="login-cliente__info" role="status">{avisoCliente}</p>
            )}

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

      {showSucesso && (
        <div className="login-cliente__toast-overlay">
          <div className="login-cliente__toast">
            <div className="login-cliente__toast-inner">
              <HiCheckCircle className="login-cliente__toast-icon" />
              <p className="login-cliente__toast-text">Login realizado com sucesso!</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default LoginCliente;