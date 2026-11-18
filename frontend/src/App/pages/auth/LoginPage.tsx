import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { MdEmail } from 'react-icons/md';
import { HiEye, HiEyeOff, HiCheckCircle } from 'react-icons/hi';
import AuthCard from './AuthCard';
import AuthService from '../../services/auth.service';
import AssinaturaService from '../../services/assinatura.service';
import { useAuth, ROTA_APOS_LOGIN } from '../../shared/contexts/Authcontext';
import './LoginPage.css';

const LoginPage: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { entrar } = useAuth();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [carregando, setCarregando] = useState(false);
  const [showSucesso, setShowSucesso] = useState(false);
  const [pagamentoPendente, setPagamentoPendente] = useState(false);
  const [emailNaoVerificado, setEmailNaoVerificado] = useState(false);
  const [reenviando, setReenviando] = useState(false);
  // Veio do retorno do Mercado Pago com o pagamento aprovado
  const [pagamentoAprovado, setPagamentoAprovado] = useState(
    Boolean(
      (location.state as { pagamentoAprovado?: boolean; pagamentoConfirmado?: boolean } | null)?.pagamentoAprovado ||
      (location.state as { pagamentoAprovado?: boolean; pagamentoConfirmado?: boolean } | null)?.pagamentoConfirmado
    )
  );

  // Limpa o state da navegação para o modal não voltar ao atualizar a página
  useEffect(() => {
    if (pagamentoAprovado) window.history.replaceState({}, document.title);
  }, [pagamentoAprovado]);

  // Mostra o toast de sucesso e só navega depois de um tempo, para dar para ver a confirmação
  useEffect(() => {
    if (!showSucesso) return;
    const timer = setTimeout(() => navigate(ROTA_APOS_LOGIN), 1200);
    return () => clearTimeout(timer);
  }, [showSucesso, navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErro(null);
    setEmailNaoVerificado(false);
    setPagamentoPendente(false);
    setCarregando(true);

    try {
      const resultado = await AuthService.login({
        email,
        senha: password,
      });

      // Guarda a sessão, o perfil completo é buscado do banco em seguida
      entrar({
        token: resultado.token,
        refresh_token: resultado.refresh_token,
        usuario: resultado.usuario,
      });

      // Pagamento consta como pendente, mas a pessoa pode ter pago e fechado a aba.
      // Confere no Mercado Pago antes de barrar.
      if (resultado.usuario.pagamento_pendente) {
        try {
          const { status } = await AssinaturaService.sincronizar();
          if (status === 'ATIVA') {
            entrar({
              token: resultado.token,
              refresh_token: resultado.refresh_token,
              usuario: { ...resultado.usuario, pagamento_pendente: false },
            });
            setCarregando(false);
            setShowSucesso(true);
            return;
          }
        } catch {
          // Não deu para conferir, segue com o aviso de pagamento pendente
        }
        setCarregando(false);
        setPagamentoPendente(true);
        return;
      }

      setCarregando(false);
      setShowSucesso(true);
    } catch (err: any) {
      if (err?.response?.data?.code === 'EMAIL_NAO_VERIFICADO') {
        setEmailNaoVerificado(true);
      } else if (!err?.response) {
        // Servidor sem resposta (timeout ou rede), não é senha errada
        setErro('Não foi possível conectar ao servidor. Tente novamente em instantes.');
      } else {
        setErro(err.response.data?.message ?? 'Email ou senha inválidos.');
      }
      setCarregando(false);
    }
  };

  // Pede um novo código e leva para a tela onde ele é digitado
  const handleReenviarCodigo = async () => {
    setErro(null);
    setReenviando(true);
    try {
      await AuthService.resendCode(email.trim(), 'registro');
      navigate('/verify-code', { state: { email: email.trim(), mode: 'register' } });
    } catch (err: any) {
      setErro(err?.response?.data?.message ?? 'Não foi possível reenviar o código. Tente novamente.');
    } finally {
      setReenviando(false);
    }
  };

  return (
    <div
      className="login-page"
      style={{ backgroundImage: 'url(/images/Register-Back.webp)' }}
    >
      <div className="login-page__container">
        <AuthCard />

        <div className="login-page__form-side">
          <h1 className="login-page__title">Entrar como Restaurante</h1>

          <form className="login-page__form" onSubmit={handleSubmit}>

            {erro && (
              <p style={{ color: 'red', fontSize: '14px', marginBottom: '8px' }}>
                {erro}
              </p>
            )}

            {pagamentoPendente && (
              <div style={{ marginBottom: '8px' }}>
                <p style={{ color: 'red', fontSize: '14px', marginBottom: '8px' }}>
                  Pagamento pendente
                </p>
                <button
                  type="button"
                  className="login-page__submit"
                  onClick={() => navigate('/pagamento')}
                >
                  Realizar pagamento
                </button>
              </div>
            )}

            {emailNaoVerificado && (
              <div style={{ marginBottom: '8px' }}>
                <p style={{ color: 'red', fontSize: '14px', marginBottom: '8px' }}>
                  E-mail não verificado
                </p>
                <button
                  type="button"
                  className="login-page__submit"
                  onClick={handleReenviarCodigo}
                  disabled={reenviando}
                >
                  {reenviando ? 'Enviando...' : 'Reenviar código'}
                </button>
              </div>
            )}

            <div className="login-page__field">
              <label className="login-page__label" htmlFor="email">Email</label>
              <div className="login-page__input-wrapper">
                <MdEmail className="login-page__input-icon" />
                <input
                  id="email"
                  autoComplete="username"
                  type="email"
                  placeholder="seu@email.com"
                  className="login-page__input login-page__input--with-icon"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>
            </div>

            <div className="login-page__field">
              <label className="login-page__label" htmlFor="password">Senha</label>
              <div className="login-page__input-wrapper">
                <input
                  id="password"
                  autoComplete="current-password"
                  type={showPassword ? 'text' : 'password'}
                  placeholder="Digite sua senha"
                  className="login-page__input login-page__input--with-toggle"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
                <button
                  type="button"
                  className="login-page__toggle-password"
                  onClick={() => setShowPassword((prev) => !prev)}
                  aria-label={showPassword ? 'Ocultar senha' : 'Mostrar senha'}
                >
                  {showPassword ? <HiEyeOff /> : <HiEye />}
                </button>
              </div>
            </div>

            <button
              className="login-page__submit"
              type="submit"
              disabled={carregando}
            >
              {carregando ? 'Entrando...' : 'Entrar'}
            </button>

          </form>

          <button className="login-page__forgot" onClick={() => navigate('/recover')}>
            Esqueceu sua senha?
          </button>

          <div className="login-page__divider" />

          <p className="login-page__redirect">
            Não possui uma conta?{' '}
            <button
              className="login-page__redirect-link"
              onClick={() => navigate('/cadastro')}
            >
              Criar conta
            </button>
          </p>
        </div>
      </div>

      {pagamentoAprovado && (
        <div className="login-page__toast-overlay">
          <div className="login-page__toast">
            <div className="login-page__toast-inner">
              <HiCheckCircle className="login-page__toast-icon" />
              <p className="login-page__toast-text">Pagamento realizado com sucesso!</p>
              <p className="login-page__toast-sub">Sua assinatura está ativa. Entre com sua conta para continuar.</p>
              <button type="button" className="login-page__submit" onClick={() => setPagamentoAprovado(false)}>
                Fazer login
              </button>
            </div>
          </div>
        </div>
      )}

      {showSucesso && (
        <div className="login-page__toast-overlay">
          <div className="login-page__toast">
            <div className="login-page__toast-inner">
              <HiCheckCircle className="login-page__toast-icon" />
              <p className="login-page__toast-text">Login realizado com sucesso!</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default LoginPage;