import React, { useState, useRef, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { MdEmail } from 'react-icons/md';
import AuthCard from './AuthCard';
import AuthService from '../../services/auth.service';
import './VerifyCodePage.css';

interface LocationState {
  email?: string;
  mode?: 'register' | 'recover';
}

const VerifyCodePage: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const state = (location.state as LocationState) || {};

  const email = state.email ?? '';
  const mode = state.mode ?? 'register';

  const [digits, setDigits] = useState<string[]>(['', '', '', '', '', '']);
  const [erro, setErro] = useState<string | null>(null);
  const [carregando, setCarregando] = useState(false);
  const [reenvioAtivo, setReenvioAtivo] = useState(false);
  const [segundos, setSegundos] = useState(60);

  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  /* ── Countdown para reenvio ── */
  useEffect(() => {
    if (segundos === 0) {
      setReenvioAtivo(true);
      return;
    }
    const timer = setTimeout(() => setSegundos((s) => s - 1), 1000);
    return () => clearTimeout(timer);
  }, [segundos]);

  /* ── Foca no primeiro campo ao montar ── */
  useEffect(() => {
    inputRefs.current[0]?.focus();
  }, []);

  const handleChange = (index: number, value: string) => {
    // Aceita apenas dígitos
    const digit = value.replace(/\D/g, '').slice(-1);
    const next = [...digits];
    next[index] = digit;
    setDigits(next);
    setErro(null);

    // Avança para o próximo campo
    if (digit && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace') {
      if (digits[index]) {
        const next = [...digits];
        next[index] = '';
        setDigits(next);
      } else if (index > 0) {
        inputRefs.current[index - 1]?.focus();
      }
    }
    if (e.key === 'ArrowLeft' && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
    if (e.key === 'ArrowRight' && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  const handlePaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
    const next = [...digits];
    pasted.split('').forEach((char, i) => {
      next[i] = char;
    });
    setDigits(next);
    const lastIndex = Math.min(pasted.length, 5);
    inputRefs.current[lastIndex]?.focus();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const code = digits.join('');

    if (code.length < 6) {
      setErro('Preencha todos os 6 dígitos do código.');
      return;
    }

    setErro(null);
    setCarregando(true);

    try {
      // TODO: substituir pela chamada real da sua API
      const resultado = await AuthService.verifyCode({ email, code });

      if (mode === 'register') {
        // Salva o token aqui, após o email ser confirmado
        localStorage.setItem('@menupoint:token', resultado.token);
        localStorage.setItem('@menupoint:usuario', JSON.stringify(resultado.usuario));
        navigate('/restaurante/home');
      } else {
        navigate('/nova-senha', { state: { email, code } });
      }
    } catch (err: any) {
      setErro(err?.response?.data?.message ?? 'Código inválido ou expirado.');
    } finally {
      setCarregando(false);
    }
  };

  const handleReenviar = async () => {
    if (!reenvioAtivo) return;
    setReenvioAtivo(false);
    setSegundos(60);
    setErro(null);

    try {
      // TODO: chamar serviço de reenvio
      // await AuthService.resendCode({ email });
    } catch {
      setErro('Não foi possível reenviar o código. Tente novamente.');
    }
  };

  const titulo = mode === 'register' ? 'Verificar email' : 'Verificar identidade';
  const descricao =
    mode === 'register'
      ? 'Enviamos um código de 6 dígitos para confirmar seu email.'
      : 'Enviamos um código de 6 dígitos para redefinir sua senha.';

  return (
    <div
      className="verify-page"
      style={{ backgroundImage: 'url(/images/Register-Back.png)' }}
    >
      <div className="verify-page__container">
        <AuthCard />

        <div className="verify-page__form-side">
          {/* Ícone de e-mail */}
          <div className="verify-page__icon-wrapper">
            <MdEmail className="verify-page__email-icon" />
          </div>

          <h1 className="verify-page__title">{titulo}</h1>

          <p className="verify-page__description">
            {descricao}
            {email && (
              <>
                {' '}Verifique a caixa de entrada de{' '}
                <strong className="verify-page__email">{email}</strong>.
              </>
            )}
          </p>

          <form className="verify-page__form" onSubmit={handleSubmit}>
            {/* Mensagem de erro */}
            {erro && (
              <p className="verify-page__error">{erro}</p>
            )}

            {/* 6 campos OTP */}
            <div className="verify-page__otp-group">
              {digits.map((digit, index) => (
                <input
                  key={index}
                  ref={(el) => { inputRefs.current[index] = el; }}
                  type="text"
                  inputMode="numeric"
                  maxLength={1}
                  value={digit}
                  onChange={(e) => handleChange(index, e.target.value)}
                  onKeyDown={(e) => handleKeyDown(index, e)}
                  onPaste={handlePaste}
                  className={`verify-page__otp-input ${digit ? 'verify-page__otp-input--filled' : ''}`}
                  aria-label={`Dígito ${index + 1} do código`}
                  autoComplete="one-time-code"
                />
              ))}
            </div>

            <button
              className="verify-page__submit"
              type="submit"
              disabled={carregando}
            >
              {carregando ? 'Verificando...' : 'Verificar código'}
            </button>
          </form>

          {/* Reenvio de código */}
          <div className="verify-page__resend">
            <span className="verify-page__resend-text">Não recebeu o código?</span>
            {reenvioAtivo ? (
              <button
                type="button"
                className="verify-page__resend-btn"
                onClick={handleReenviar}
              >
                Reenviar código
              </button>
            ) : (
              <span className="verify-page__resend-timer">
                Reenviar em {segundos}s
              </span>
            )}
          </div>

          <div className="verify-page__divider" />

          <p className="verify-page__redirect">
            <button
              type="button"
              className="verify-page__back-btn"
              onClick={() => navigate(mode === 'register' ? '/' : '/recover')}
            >
              ← Voltar
            </button>
          </p>
        </div>
      </div>
    </div>
  );
};

export default VerifyCodePage;