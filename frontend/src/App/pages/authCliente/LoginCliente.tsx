import React, { useEffect, useState } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import { MdEmail } from 'react-icons/md';
import { HiEye, HiEyeOff, HiCheckCircle } from 'react-icons/hi';
import AuthCard from '../auth/AuthCard';
import ClienteService, { mensagemDeErro } from '../../services/cliente.service';
import { useClienteAuth } from '../../shared/contexts/ClienteAuthContext';
import { useSistemaCliente, destinoDoSistema } from '../../shared/contexts/SistemaClienteContext';
import { consumirRetornoLogin } from '../../shared/utils/pendenciaLogin';
import './LoginCliente.css';

const LoginCliente: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { entrar, isAuthenticated } = useClienteAuth();
  // A conta é a mesma nos dois sistemas, mas o login não troca a pessoa de sistema:
  // quem veio da mesa volta para a mesa, quem veio do link do restaurante volta para o delivery
  const { sistema } = useSistemaCliente();

  const [emailCliente, setEmailCliente] = useState('');
  const [senhaCliente, setSenhaCliente] = useState('');
  const [mostrarSenha, setMostrarSenha] = useState(false);
  const [erroCliente, setErroCliente] = useState<string | null>(null);
  const [carregandoCliente, setCarregandoCliente] = useState(false);
  const [showSucesso, setShowSucesso] = useState(false);

  // Aviso vindo de outra tela, ex.: "você abriu outro restaurante, entre novamente"
  const avisoCliente = (location.state as { aviso?: string } | null)?.aviso;

  // Igual ao login do restaurante: toast de sucesso e navega depois de um tempo
  useEffect(() => {
    if (!showSucesso) return;
    const timer = setTimeout(() => {
      // Volta para a tela de origem se for do mesmo sistema, senão para a primeira tela dele.
      // A origem vem do aviso de "faça login" ou da pendência de login guardada
      const destino = consumirRetornoLogin((location.state as { from?: string } | null)?.from);
      navigate(destinoDoSistema(sistema, destino), { replace: true });
    }, 1200);
    return () => clearTimeout(timer);
  }, [showSucesso, navigate, location.state, sistema]);

  const handleSubmitCliente = async (e: React.FormEvent) => {
    e.preventDefault();
    setErroCliente(null);
    setCarregandoCliente(true);

    try {
      const sessao = await ClienteService.login({
        email: emailCliente.trim(),
        senha: senhaCliente,
      });

      // O toast vem antes do entrar(), senão o guard abaixo ("já está logado")
      // redireciona antes da mensagem aparecer
      setShowSucesso(true);
      entrar(sessao);
    } catch (err: any) {
      // 403: e-mail não confirmado, o back já enviou um código novo
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

  // Já logado não vê a tela de login, só durante o toast de sucesso
  if (isAuthenticated && !showSucesso) {
    return <Navigate to={destinoDoSistema(sistema)} replace />;
  }

  return (
    <div
      className="login-cliente"
      style={{ backgroundImage: 'url(/images/Register-Back.webp)' }}
    >
      <div className="login-cliente__container">
        <AuthCard />

        <div className="login-cliente__form-side">
          <h1 className="login-cliente__title">Entrar como Cliente</h1>

          <form className="login-cliente__form" onSubmit={handleSubmitCliente}>

            {avisoCliente && !erroCliente && (
              <p className="login-cliente__info" role="status">{avisoCliente}</p>
            )}

            {erroCliente && (
              <p style={{ color: 'red', fontSize: '14px', marginBottom: '8px' }}>
                {erroCliente}
              </p>
            )}

            <div className="login-cliente__field">
              <label className="login-cliente__label" htmlFor="emailCliente">Email</label>
              <div className="login-cliente__input-wrapper">
                <MdEmail className="login-cliente__input-icon" />
                <input
                  id="emailCliente"
                  autoComplete="username"
                  type="email"
                  placeholder="seu@email.com"
                  className="login-cliente__input login-cliente__input--with-icon"
                  value={emailCliente}
                  onChange={(e) => setEmailCliente(e.target.value)}
                  required
                />
              </div>
            </div>

            <div className="login-cliente__field">
              <label className="login-cliente__label" htmlFor="senhaCliente">Senha</label>
              <div className="login-cliente__input-wrapper">
                <input
                  id="senhaCliente"
                  autoComplete="current-password"
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