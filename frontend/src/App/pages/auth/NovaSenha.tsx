import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { MdLock } from 'react-icons/md';
import { HiEye, HiEyeOff, HiCheckCircle } from 'react-icons/hi';
import AuthCard from './AuthCard';
import AuthService from '../../services/auth.service';
import { mensagemDeErro } from '../../services/cliente.service';
import './RecoverPass.css';

interface LocationState {
  email?: string;
  code?: string;
}

const NovaSenha: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const state = (location.state as LocationState) || {};

  const email = state.email ?? '';
  const codigo = state.code ?? '';

  const [novaSenha, setNovaSenha] = useState('');
  const [confirmarSenha, setConfirmarSenha] = useState('');
  const [mostrarSenha, setMostrarSenha] = useState(false);
  const [mostrarConfirmar, setMostrarConfirmar] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [carregando, setCarregando] = useState(false);
  const [sucesso, setSucesso] = useState(false);

  // Mesmas regras do cadastro do restaurante (RegisterPage) e do back-end (Auth.schema.ts)
  const regrasSenha = [
    { label: 'Mínimo de 8 caracteres', ok: novaSenha.length >= 8 },
    { label: 'Uma letra maiúscula', ok: /[A-Z]/.test(novaSenha) },
    { label: 'Uma letra minúscula', ok: /[a-z]/.test(novaSenha) },
    { label: 'Um número', ok: /[0-9]/.test(novaSenha) },
  ];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErro(null);

    if (!email || !codigo) {
      setErro('Sessão de verificação perdida. Solicite a recuperação novamente.');
      return;
    }

    if (!regrasSenha.every((r) => r.ok)) {
      setErro('A senha não atende aos requisitos mínimos.');
      return;
    }

    if (novaSenha !== confirmarSenha) {
      setErro('As senhas não coincidem.');
      return;
    }

    setCarregando(true);
    try {
      await AuthService.redefinirSenha({
        email,
        codigo,
        nova_senha: novaSenha,
        confirmar_senha: confirmarSenha,
      });
      setNovaSenha('');
      setConfirmarSenha('');
      setSucesso(true);
    } catch (err: any) {
      setErro(
        mensagemDeErro(err, 'Não foi possível redefinir sua senha. O código pode ter expirado.')
      );
    } finally {
      setCarregando(false);
    }
  };

  return (
    <div
      className="recover-pass"
      style={{ backgroundImage: 'url(/images/Register-Back.png)' }}
    >
      <div className="recover-pass__container">

        <AuthCard />

        <div className="recover-pass__form-side">
          <h1 className="recover-pass__title">Nova senha</h1>

          {!email || !codigo ? (
            <>
              <p className="recover-pass__subtitle">
                Sessão de verificação perdida. Solicite a recuperação de senha novamente.
              </p>
              <div className="recover-pass__divider" />
              <button
                className="recover-pass__redirect-link"
                onClick={() => navigate('/recover', { replace: true })}
              >
                Solicitar recuperação
              </button>
            </>
          ) : (
            <>
              <p className="recover-pass__subtitle">Escolha uma nova senha</p>

              <form className="recover-pass__form" onSubmit={handleSubmit}>

                {erro && (
                  <p style={{ color: 'red', fontSize: '14px', marginBottom: '8px' }}>
                    {erro}
                  </p>
                )}

                <div className="recover-pass__field">
                  <label className="recover-pass__label" htmlFor="novaSenha">
                    Nova senha
                  </label>
                  <div className="recover-pass__input-wrapper">
                    <MdLock className="recover-pass__input-icon" />
                    <input
                      id="novaSenha"
                      type={mostrarSenha ? 'text' : 'password'}
                      placeholder="Digite a nova senha"
                      className="recover-pass__input recover-pass__input--with-icon recover-pass__input--with-toggle"
                      value={novaSenha}
                      onChange={(e) => setNovaSenha(e.target.value)}
                      autoComplete="new-password"
                      maxLength={60}
                      required
                    />
                    <button
                      type="button"
                      className="recover-pass__toggle"
                      onClick={() => setMostrarSenha((p) => !p)}
                      aria-label={mostrarSenha ? 'Ocultar senha' : 'Mostrar senha'}
                    >
                      {mostrarSenha ? <HiEyeOff /> : <HiEye />}
                    </button>
                  </div>

                  {novaSenha.length > 0 && (
                    <ul className="recover-pass__rules">
                      {regrasSenha.map((regra) => (
                        <li
                          key={regra.label}
                          className={regra.ok ? 'is-ok' : 'is-missing'}
                        >
                          {regra.ok ? '✔' : '✘'} {regra.label}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>

                <div className="recover-pass__field">
                  <label className="recover-pass__label" htmlFor="confirmarSenha">
                    Confirmar nova senha
                  </label>
                  <div className="recover-pass__input-wrapper">
                    <MdLock className="recover-pass__input-icon" />
                    <input
                      id="confirmarSenha"
                      type={mostrarConfirmar ? 'text' : 'password'}
                      placeholder="Repita a nova senha"
                      className="recover-pass__input recover-pass__input--with-icon recover-pass__input--with-toggle"
                      value={confirmarSenha}
                      onChange={(e) => setConfirmarSenha(e.target.value)}
                      autoComplete="new-password"
                      maxLength={60}
                      required
                    />
                    <button
                      type="button"
                      className="recover-pass__toggle"
                      onClick={() => setMostrarConfirmar((p) => !p)}
                      aria-label={mostrarConfirmar ? 'Ocultar senha' : 'Mostrar senha'}
                    >
                      {mostrarConfirmar ? <HiEyeOff /> : <HiEye />}
                    </button>
                  </div>
                </div>

                <button className="recover-pass__submit" type="submit" disabled={carregando}>
                  {carregando ? 'Salvando...' : 'Redefinir senha'}
                </button>

              </form>

              <div className="recover-pass__divider" />
              <button
                className="recover-pass__redirect-link"
                onClick={() => navigate('/login')}
              >
                Voltar para o login
              </button>
            </>
          )}
        </div>

        {sucesso && (
          <div className="recover-pass__modal-overlay">
            <div
              className="recover-pass__modal"
              role="dialog"
              aria-modal="true"
              aria-labelledby="modal-senha-titulo"
            >
              <div className="recover-pass__modal-inner">
                <div className="recover-pass__modal-icon-wrap">
                  <HiCheckCircle className="recover-pass__modal-icon" />
                </div>
                <h2 id="modal-senha-titulo" className="recover-pass__modal-title">
                  Senha redefinida!
                </h2>
                <p className="recover-pass__modal-text">
                  Tudo certo. Agora é só entrar com a sua nova senha.
                </p>
                <button
                  type="button"
                  className="recover-pass__submit recover-pass__modal-btn"
                  onClick={() => navigate('/login', { replace: true })}
                  autoFocus
                >
                  Ir para o login
                </button>
              </div>
            </div>
          </div>
        )}

      </div>
    </div>
  );
};

export default NovaSenha;