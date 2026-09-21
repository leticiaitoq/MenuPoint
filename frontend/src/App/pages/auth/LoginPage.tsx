import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { MdEmail } from 'react-icons/md';
import { HiEye, HiEyeOff, HiCheckCircle } from 'react-icons/hi';
import AuthCard from './AuthCard';
import AuthService from '../../services/auth.service';
import api from '../../services/api';
import './LoginPage.css';

const LoginPage: React.FC = () => {
  const navigate = useNavigate();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [erro, setErro] = useState<string | null>(null);      
  const [carregando, setCarregando] = useState(false);       
  const [showSucesso, setShowSucesso] = useState(false);

  // Mesmo padrão usado na tela de verificação de código: mostra o toast de
  // sucesso e só navega depois de um tempinho, pra pessoa ver a confirmação.
  useEffect(() => {
    if (!showSucesso) return;
    const timer = setTimeout(async () => {
      // Login não checa mais assinatura (bloquear ali impediria o token
      // de ser gerado, e sem token não dá pra consultar /assinatura/minha
      // depois). A checagem acontece aqui, já com o token em mãos.
      try {
        const { data } = await api.get('/assinatura/minha');
        navigate(data?.status === 'ATIVA' ? '/restaurante/home' : '/assinatura/pendente');
      } catch {
        navigate('/assinatura/pendente');
      }
    }, 1200);
    return () => clearTimeout(timer);
  }, [showSucesso, navigate]);

  const handleSubmit = async (e: React.FormEvent) => {      
    e.preventDefault();
    setErro(null);
    setCarregando(true);

    try {
      const resultado = await AuthService.login({
        email,
        senha: password,
      });

      // Salva token e usuário com as chaves corretas
      localStorage.setItem('@menupoint:token', resultado.token);
      localStorage.setItem('@menupoint:usuario', JSON.stringify(resultado.usuario));

      setCarregando(false);
      setShowSucesso(true);
    } catch (err: any) {
      const status = err?.response?.status;
      const mensagem = err?.response?.data?.message ?? 'Email ou senha inválidos.';

      // E-mail ainda não confirmado: dispara um código novo de verdade
      // (o login em si não envia nada) e só então manda pra tela de código,
      // que já tem o botão de reenviar caso precise de outro depois.
      if (status === 403 && mensagem.toLowerCase().includes('e-mail')) {
        try {
          await AuthService.resendCode(email, 'registro');
        } catch {
          // Se o reenvio falhar aqui, a pessoa ainda pode tentar de novo
          // manualmente na própria tela de verificação.
        }
        navigate('/verify-code', { state: { email, mode: 'register' } });
        return;
      }

      setErro(mensagem);
      setCarregando(false);
    }
  };

  return (
    <div
      className="login-page"
      style={{ backgroundImage: 'url(/images/Register-Back.png)' }}
    >
      <div className="login-page__container">
        <AuthCard />

        <div className="login-page__form-side">
          <h1 className="login-page__title">Entrar</h1>

          <form className="login-page__form" onSubmit={handleSubmit}>

            {/* Mensagem de erro ← novo */}
            {erro && (
              <p style={{ color: 'red', fontSize: '14px', marginBottom: '8px' }}>
                {erro}
              </p>
            )}

            {/* Campo Email */}
            <div className="login-page__field">
              <label className="login-page__label" htmlFor="email">Email</label>
              <div className="login-page__input-wrapper">
                <MdEmail className="login-page__input-icon" />
                <input
                  id="email"
                  type="email"
                  placeholder="seu@email.com"
                  className="login-page__input login-page__input--with-icon"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>
            </div>

            {/* Campo Senha */}
            <div className="login-page__field">
              <label className="login-page__label" htmlFor="password">Senha</label>
              <div className="login-page__input-wrapper">
                <input
                  id="password"
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
              onClick={() => navigate('/register')}
            >
              Criar conta
            </button>
          </p>
        </div>
      </div>

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