import React, { useState } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import { HiEye, HiEyeOff } from 'react-icons/hi';
import AuthCard from '../auth/AuthCard';
import ClienteService, { mensagemDeErro } from '../../services/cliente.service';
import './RegisterCliente.css';

interface LocationStateCliente {
  email?: string;
  code?: string;
}

/**
 * Último passo da recuperação de senha do cliente.
 * Chega aqui vindo de /verify-code/cliente (mode "recover") com { email, code } no state.
 * Reaproveita o CSS do cadastro do cliente (mesmos campos e regras de senha).
 */
const NovaSenhaCliente: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const stateCliente = (location.state as LocationStateCliente) || {};

  const emailCliente = stateCliente.email ?? '';
  const codigoCliente = stateCliente.code ?? '';

  const [novaSenha, setNovaSenha] = useState('');
  const [confirmarSenha, setConfirmarSenha] = useState('');
  const [mostrarSenha, setMostrarSenha] = useState(false);
  const [mostrarConfirmar, setMostrarConfirmar] = useState(false);
  const [erroCliente, setErroCliente] = useState<string | null>(null);
  const [carregandoCliente, setCarregandoCliente] = useState(false);
  const [sucesso, setSucesso] = useState(false);

  // Mesmas regras do back-end (Cliente.schema.ts)
  const regrasSenha = [
    { label: 'Mínimo 8 caracteres', valido: novaSenha.length >= 8 },
    { label: 'Pelo menos 1 letra maiúscula', valido: /[A-Z]/.test(novaSenha) },
    { label: 'Pelo menos 1 letra minúscula', valido: /[a-z]/.test(novaSenha) },
    { label: 'Pelo menos 1 número', valido: /[0-9]/.test(novaSenha) },
  ];

  // Sem e-mail/código (abriu a URL direto ou recarregou): recomeça a recuperação
  if (!emailCliente || !codigoCliente) {
    return <Navigate to="/recover/cliente" replace />;
  }

  const handleSubmitCliente = async (e: React.FormEvent) => {
    e.preventDefault();
    setErroCliente(null);

    if (!regrasSenha.every((r) => r.valido)) {
      setErroCliente('A senha não atende aos requisitos mínimos.');
      return;
    }

    if (novaSenha !== confirmarSenha) {
      setErroCliente('As senhas não coincidem.');
      return;
    }

    setCarregandoCliente(true);
    try {
      await ClienteService.redefinirSenha({
        email: emailCliente,
        codigo: codigoCliente,
        nova_senha: novaSenha,
        confirmar_senha: confirmarSenha,
      });
      setSucesso(true);
    } catch (err: any) {
      setErroCliente(
        mensagemDeErro(err, 'Não foi possível redefinir sua senha. O código pode ter expirado.')
      );
    } finally {
      setCarregandoCliente(false);
    }
  };

  return (
    <div
      className="register-cliente"
      style={{ backgroundImage: 'url(/images/Register-Back.png)' }}
    >
      <div className="register-cliente__container">
        <AuthCard />

        <div className="register-cliente__form-side">
          <h1 className="register-cliente__title">Nova senha</h1>

          {sucesso ? (
            <>
              <p className="register-cliente__label" style={{ marginBottom: '16px' }}>
                Senha redefinida com sucesso! Faça login com a sua nova senha.
              </p>
              <button
                type="button"
                className="register-cliente__submit"
                onClick={() => navigate('/login/cliente', { replace: true })}
              >
                Ir para o login
              </button>
            </>
          ) : (
            <>
              <form className="register-cliente__form" onSubmit={handleSubmitCliente}>
                {erroCliente && (
                  <p style={{ color: 'red', fontSize: '14px', marginBottom: '8px' }}>
                    {erroCliente}
                  </p>
                )}

                {/* Nova senha */}
                <div className="register-cliente__field">
                  <label className="register-cliente__label" htmlFor="novaSenhaCliente">
                    Nova senha
                  </label>
                  <div className="register-cliente__input-wrapper">
                    <input
                      id="novaSenhaCliente"
                      type={mostrarSenha ? 'text' : 'password'}
                      placeholder="Digite a nova senha"
                      className="register-cliente__input register-cliente__input--with-toggle"
                      value={novaSenha}
                      onChange={(e) => setNovaSenha(e.target.value)}
                      required
                    />
                    <button
                      type="button"
                      className="register-cliente__toggle-password"
                      onClick={() => setMostrarSenha((prev) => !prev)}
                      aria-label={mostrarSenha ? 'Ocultar senha' : 'Mostrar senha'}
                    >
                      {mostrarSenha ? <HiEyeOff /> : <HiEye />}
                    </button>
                  </div>
                  {novaSenha.length > 0 && (
                    <ul className="register-cliente__senha-regras">
                      {regrasSenha.map((regra) => (
                        <li
                          key={regra.label}
                          className={
                            regra.valido
                              ? 'register-cliente__regra register-cliente__regra--ok'
                              : 'register-cliente__regra register-cliente__regra--erro'
                          }
                        >
                          {regra.valido ? '✔' : '✘'} {regra.label}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>

                {/* Confirmar senha */}
                <div className="register-cliente__field">
                  <label className="register-cliente__label" htmlFor="confirmarNovaSenhaCliente">
                    Confirmar senha
                  </label>
                  <div className="register-cliente__input-wrapper">
                    <input
                      id="confirmarNovaSenhaCliente"
                      type={mostrarConfirmar ? 'text' : 'password'}
                      placeholder="Confirme a nova senha"
                      className="register-cliente__input register-cliente__input--with-toggle"
                      value={confirmarSenha}
                      onChange={(e) => setConfirmarSenha(e.target.value)}
                      required
                    />
                    <button
                      type="button"
                      className="register-cliente__toggle-password"
                      onClick={() => setMostrarConfirmar((prev) => !prev)}
                      aria-label={mostrarConfirmar ? 'Ocultar senha' : 'Mostrar senha'}
                    >
                      {mostrarConfirmar ? <HiEyeOff /> : <HiEye />}
                    </button>
                  </div>
                </div>

                <button
                  className="register-cliente__submit"
                  type="submit"
                  disabled={carregandoCliente}
                >
                  {carregandoCliente ? 'Salvando...' : 'Redefinir senha'}
                </button>
              </form>

              <p className="register-cliente__redirect">
                <button
                  type="button"
                  className="register-cliente__redirect-link"
                  onClick={() => navigate('/login/cliente')}
                >
                  Voltar para o login
                </button>
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default NovaSenhaCliente;
