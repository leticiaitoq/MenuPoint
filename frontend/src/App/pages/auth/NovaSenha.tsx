import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { MdLock } from 'react-icons/md';
import AuthCard from './AuthCard';
import AuthService from '../../services/auth.service';
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
  const [erro, setErro] = useState<string | null>(null);
  const [carregando, setCarregando] = useState(false);
  const [sucesso, setSucesso] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErro(null);

    if (!email || !codigo) {
      setErro('Sessão de verificação perdida. Solicite a recuperação novamente.');
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
      setSucesso(true);
    } catch (err: any) {
      setErro(
        err?.response?.data?.message ??
        'Não foi possível redefinir sua senha. O código pode ter expirado.'
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

          {sucesso ? (
            <>
              <p className="recover-pass__subtitle">
                Senha redefinida com sucesso! Já pode fazer login com a senha nova.
              </p>
              <div className="recover-pass__divider" />
              <button
                className="recover-pass__redirect-link"
                onClick={() => navigate('/login')}
              >
                Ir para o login
              </button>
            </>
          ) : !email || !codigo ? (
            <>
              <p className="recover-pass__subtitle">
                Sessão de verificação perdida. Solicite a recuperação de senha novamente.
              </p>
              <div className="recover-pass__divider" />
              <button
                className="recover-pass__redirect-link"
                onClick={() => navigate('/recover')}
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
                      type="password"
                      placeholder="Mínimo de 6 caracteres"
                      className="recover-pass__input recover-pass__input--with-icon"
                      value={novaSenha}
                      onChange={(e) => setNovaSenha(e.target.value)}
                    />
                  </div>
                </div>

                <div className="recover-pass__field">
                  <label className="recover-pass__label" htmlFor="confirmarSenha">
                    Confirmar nova senha
                  </label>
                  <div className="recover-pass__input-wrapper">
                    <MdLock className="recover-pass__input-icon" />
                    <input
                      id="confirmarSenha"
                      type="password"
                      placeholder="Repita a nova senha"
                      className="recover-pass__input recover-pass__input--with-icon"
                      value={confirmarSenha}
                      onChange={(e) => setConfirmarSenha(e.target.value)}
                    />
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

      </div>
    </div>
  );
};

export default NovaSenha;
