import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { HiEye, HiEyeOff } from 'react-icons/hi';
import AuthCard from './AuthCard';
import AuthService from '../../services/auth.service';
import './RegisterPage.css';

const RegisterPage: React.FC = () => {
  const navigate = useNavigate();

  const [nome, setNome] = useState('');
  const [cnpj, setCnpj] = useState('');
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [confirmarSenha, setConfirmarSenha] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [carregando, setCarregando] = useState(false);
  const [showSucesso, setShowSucesso] = useState(false);

  const handleCnpjChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const digits = e.target.value.replace(/\D/g, '').slice(0, 14);
    const formatted = digits
      .replace(/^(\d{2})(\d)/, '$1.$2')
      .replace(/^(\d{2})\.(\d{3})(\d)/, '$1.$2.$3')
      .replace(/\.(\d{3})(\d)/, '.$1/$2')
      .replace(/(\d{4})(\d)/, '$1-$2');
    setCnpj(formatted);
  };

  const handleNomeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
  const valor = e.target.value.replace(/[^a-zA-ZÀ-ÿ0-9 ]/g, '');
  setNome(valor);
};

const regrasSenha = [
  { label: 'Mínimo 8 caracteres', valido: senha.length >= 8 },
  { label: 'Pelo menos 1 letra maiúscula', valido: /[A-Z]/.test(senha) },
  { label: 'Pelo menos 1 número', valido: /[0-9]/.test(senha) },
];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErro(null);

    if (senha !== confirmarSenha) {
      setErro('As senhas não coincidem.');
      return;
    }

        const senhaValida = regrasSenha.every((r) => r.valido);
    if (!senhaValida) {
      setErro('A senha não atende aos requisitos mínimos.');
      return;
    }

    setCarregando(true);
    try {
      const resultado = await AuthService.registrar({
        nome_restaurante: nome,
        cnpj: cnpj || undefined,
        email,
        senha,
        confirmar_senha: confirmarSenha,
      });

      localStorage.setItem('@menupoint:token', resultado.token)
      localStorage.setItem('@menupoint:usuario', JSON.stringify(resultado.usuario))
      setShowSucesso(true);
      //navigate('/verify-code', { state: { email, mode: 'register' } });  <- parte de verificação de email
    } catch (err: any) {
      setErro(err?.response?.data?.message ?? 'Erro ao criar conta. Tente novamente.');
    } finally {
      setCarregando(false);
    }
  };

      const handleIrParaConfirmacao = () => {
      setShowSucesso(false);
      navigate('/confirmar-email');
    };

  return (
    <div
      className="register-page"
      style= {{ backgroundImage: 'url(/images/Register-Back.png)' }}>
      <div className="register-page__container">

        {/* imagem compartilhada */}
        <AuthCard />

        {/*formulário */}
        <div className="register-page__form-side">
          <h1 className="register-page__title">Criar conta</h1>

          <form className="register-page__form" onSubmit={handleSubmit}>

            {/* Mensagem de erro */}
              {erro && (
              <p style={{ color: 'red', fontSize: '14px', marginBottom: '8px' }}>
                {erro}
              </p>
            )}

            {/* Nome do restaurante */}
            <div className="register-page__field">
              <label className="register-page__label" htmlFor="nome">
                Nome do restaurante
              </label>
              <input
                id="nome"
                type="text"
                placeholder="Digite o nome do restaurante"
                className="register-page__input"
                value={nome}
                onChange={handleNomeChange}
                required
              />
            </div>

            {/* CNPJ com máscara */}
            <div className="register-page__field">
              <label className="register-page__label" htmlFor="cnpj">
                CNPJ
              </label>
              <input
                id="cnpj"
                type="text"
                placeholder="00.000.000/0000-00"
                className="register-page__input"
                value={cnpj}
                onChange={handleCnpjChange}
              />
            </div>

            {/* Email */}
            <div className="register-page__field">
              <label className="register-page__label" htmlFor="email">
                Email
              </label>
              <input
                id="email"
                type="email"
                placeholder="digite seu email"
                className="register-page__input"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>

            {/* Senhas*/}
            <div className="register-page__field-row">

              <div className="register-page__field">
                <label className="register-page__label" htmlFor="senha">
                  Senha
                </label>
                <div className="register-page__input-wrapper">
                  <input
                    id="senha"
                    type={showPassword ? 'text' : 'password'}
                    placeholder="Digite sua senha"
                    className="register-page__input register-page__input--with-toggle"
                    value={senha}
                    onChange={(e) => setSenha(e.target.value)}
                    required
                  />
                  <button
                    type="button"
                    className="register-page__toggle-password"
                    onClick={() => setShowPassword((prev) => !prev)}
                    aria-label={showPassword ? 'Ocultar senha' : 'Mostrar senha'}
                  >
                    {showPassword ? <HiEyeOff /> : <HiEye />}
                  </button>
                </div>
                {senha.length > 0 && (
                  <ul className="register-page__senha-regras">
                    {regrasSenha.map((regra) => (
                      <li
                        key={regra.label}
                        className={regra.valido
                          ? 'register-page__regra register-page__regra--ok'
                          : 'register-page__regra register-page__regra--erro'
                        }
                      >
                        {regra.valido ? '✔' : '✘'} {regra.label}
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              <div className="register-page__field">
                <label className="register-page__label" htmlFor="confirmarSenha">
                  Confirmar senha
                </label>
                <div className="register-page__input-wrapper">
                  <input
                    id="confirmarSenha"
                    type={showConfirm ? 'text' : 'password'}
                    placeholder="Confirme sua senha"
                    className="register-page__input register-page__input--with-toggle"
                    value={confirmarSenha}
                    onChange={(e) => setConfirmarSenha(e.target.value)}
                    required
                  />
                  <button
                    type="button"
                    className="register-page__toggle-password"
                    onClick={() => setShowConfirm((prev) => !prev)}
                    aria-label={showConfirm ? 'Ocultar senha' : 'Mostrar senha'}
                  >
                    {showConfirm ? <HiEyeOff /> : <HiEye />}
                  </button>
                </div>
              </div>
            </div>
            
            <button
              className="register-page__submit"
              type="submit"
              disabled={carregando}
            >
              {carregando ? 'Criando conta...' : 'Criar conta'}
            </button>

          </form>

          <p className="register-page__redirect">
            Já possui conta?{' '}
            <button
              className="register-page__redirect-link"
              onClick={() => navigate('/login')} >
              Entrar
            </button>
          </p>
        </div>

      </div>
              {showSucesso && (
          <div className="register-page__overlay" onClick={() => setShowSucesso(false)}>
            <div
              className="register-page__modal-sucesso"
              onClick={(e) => e.stopPropagation()}
            >
              <h2 className="register-page__sucesso-titulo">Cadastro realizado!</h2>
              <p className="register-page__sucesso-texto">
                Enviamos um e-mail para você confirmar sua conta.
              </p>

              <button
                className="register-page__btn"
                onClick={handleIrParaConfirmacao}
              >
                Confirmar e-mail
              </button>
            </div>
          </div>
        )}
    </div>

    
  );
};

export default RegisterPage;