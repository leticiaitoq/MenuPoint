import React, { useState, useRef, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { MdEmail } from 'react-icons/md';
import AuthCard from '../auth/AuthCard';
import AuthService from '../../services/auth.service';
import './VerifyCodeCliente.css';

interface LocationStateCliente {
  email?: string;
  mode?: 'register' | 'recover';
}

const VerifyCodeCliente: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const stateCliente = (location.state as LocationStateCliente) || {};

  const emailCliente = stateCliente.email ?? '';
  const modeCliente = stateCliente.mode ?? 'register';

  const [digitsCliente, setDigitsCliente] = useState<string[]>(['', '', '', '', '', '']);
  const [erroCliente, setErroCliente] = useState<string | null>(null);
  const [carregandoCliente, setCarregandoCliente] = useState(false);
  const [reenvioAtivoCliente, setReenvioAtivoCliente] = useState(false);
  const [segundosCliente, setSegundosCliente] = useState(60);

  const inputRefsCliente = useRef<(HTMLInputElement | null)[]>([]);

  /* ── Countdown para reenvio ── */
  useEffect(() => {
    if (segundosCliente === 0) {
      setReenvioAtivoCliente(true);
      return;
    }
    const timer = setTimeout(() => setSegundosCliente((s) => s - 1), 1000);
    return () => clearTimeout(timer);
  }, [segundosCliente]);

  /* ── Foca no primeiro campo ao montar ── */
  useEffect(() => {
    inputRefsCliente.current[0]?.focus();
  }, []);

  const handleChangeCliente = (index: number, value: string) => {
    const digit = value.replace(/\D/g, '').slice(-1);
    const next = [...digitsCliente];
    next[index] = digit;
    setDigitsCliente(next);
    setErroCliente(null);

    if (digit && index < 5) {
      inputRefsCliente.current[index + 1]?.focus();
    }
  };

  const handleKeyDownCliente = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace') {
      if (digitsCliente[index]) {
        const next = [...digitsCliente];
        next[index] = '';
        setDigitsCliente(next);
      } else if (index > 0) {
        inputRefsCliente.current[index - 1]?.focus();
      }
    }
    if (e.key === 'ArrowLeft' && index > 0) {
      inputRefsCliente.current[index - 1]?.focus();
    }
    if (e.key === 'ArrowRight' && index < 5) {
      inputRefsCliente.current[index + 1]?.focus();
    }
  };

  const handlePasteCliente = (e: React.ClipboardEvent<HTMLInputElement>) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
    const next = [...digitsCliente];
    pasted.split('').forEach((char, i) => {
      next[i] = char;
    });
    setDigitsCliente(next);
    const lastIndex = Math.min(pasted.length, 5);
    inputRefsCliente.current[lastIndex]?.focus();
  };

  const handleSubmitCliente = async (e: React.FormEvent) => {
    e.preventDefault();
    const codeCliente = digitsCliente.join('');

    if (codeCliente.length < 6) {
      setErroCliente('Preencha todos os 6 dígitos do código.');
      return;
    }

    setErroCliente(null);
    setCarregandoCliente(true);

    try {
      const resultadoCliente = await AuthService.verifyCode({ email: emailCliente, code: codeCliente });

      if (modeCliente === 'register') {
        localStorage.setItem('@menupoint:token', resultadoCliente.token);
        localStorage.setItem('@menupoint:usuario', JSON.stringify(resultadoCliente.usuario));
        navigate('/cliente/home');
      } else {
        navigate('/cliente/nova-senha', { state: { email: emailCliente, code: codeCliente } });
      }
    } catch (err: any) {
      setErroCliente(err?.response?.data?.message ?? 'Código inválido ou expirado.');
    } finally {
      setCarregandoCliente(false);
    }
  };

  const handleReenviarCliente = async () => {
    if (!reenvioAtivoCliente) return;
    setReenvioAtivoCliente(false);
    setSegundosCliente(60);
    setErroCliente(null);

    try {
      // TODO: await AuthService.resendCode({ email: emailCliente });
    } catch {
      setErroCliente('Não foi possível reenviar o código. Tente novamente.');
    }
  };

  const tituloCliente = modeCliente === 'register' ? 'Verificar email' : 'Verificar identidade';
  const descricaoCliente =
    modeCliente === 'register'
      ? 'Enviamos um código de 6 dígitos para confirmar seu email.'
      : 'Enviamos um código de 6 dígitos para redefinir sua senha.';

  return (
    <div
      className="verify-cliente"
      style={{ backgroundImage: 'url(/images/Register-Back.png)' }}
    >
      <div className="verify-cliente__container">
        <AuthCard />

        <div className="verify-cliente__form-side">
          {/* Ícone de e-mail */}
          <div className="verify-cliente__icon-wrapper">
            <MdEmail className="verify-cliente__email-icon" />
          </div>

          <h1 className="verify-cliente__title">{tituloCliente}</h1>

          <p className="verify-cliente__description">
            {descricaoCliente}
            {emailCliente && (
              <>
                {' '}Verifique a caixa de entrada de{' '}
                <strong className="verify-cliente__email">{emailCliente}</strong>.
              </>
            )}
          </p>

          <form className="verify-cliente__form" onSubmit={handleSubmitCliente}>
            {/* Mensagem de erro */}
            {erroCliente && (
              <p className="verify-cliente__error">{erroCliente}</p>
            )}

            {/* 6 campos OTP */}
            <div className="verify-cliente__otp-group">
              {digitsCliente.map((digit, index) => (
                <input
                  key={index}
                  ref={(el) => { inputRefsCliente.current[index] = el; }}
                  type="text"
                  inputMode="numeric"
                  maxLength={1}
                  value={digit}
                  onChange={(e) => handleChangeCliente(index, e.target.value)}
                  onKeyDown={(e) => handleKeyDownCliente(index, e)}
                  onPaste={handlePasteCliente}
                  className={`verify-cliente__otp-input ${digit ? 'verify-cliente__otp-input--filled' : ''}`}
                  aria-label={`Dígito ${index + 1} do código`}
                  autoComplete="one-time-code"
                />
              ))}
            </div>

            <button
              className="verify-cliente__submit"
              type="submit"
              disabled={carregandoCliente}
            >
              {carregandoCliente ? 'Verificando...' : 'Verificar código'}
            </button>
          </form>

          {/* Reenvio de código */}
          <div className="verify-cliente__resend">
            <span className="verify-cliente__resend-text">Não recebeu o código?</span>
            {reenvioAtivoCliente ? (
              <button
                type="button"
                className="verify-cliente__resend-btn"
                onClick={handleReenviarCliente}
              >
                Reenviar código
              </button>
            ) : (
              <span className="verify-cliente__resend-timer">
                Reenviar em {segundosCliente}s
              </span>
            )}
          </div>

          <div className="verify-cliente__divider" />

          <p className="verify-cliente__redirect">
            <button
              type="button"
              className="verify-cliente__back-btn"
              onClick={() => navigate(modeCliente === 'register' ? '/register/cliente' : '/recover/cliente')}
            >
              ← Voltar
            </button>
          </p>
        </div>
      </div>
    </div>
  );
};

export default VerifyCodeCliente;