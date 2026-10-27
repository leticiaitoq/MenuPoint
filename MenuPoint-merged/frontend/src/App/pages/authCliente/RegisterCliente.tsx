import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { HiEye, HiEyeOff } from 'react-icons/hi';
import AuthCard from '../auth/AuthCard';
import ClienteService, { mensagemDeErro } from '../../services/cliente.service';
import './RegisterCliente.css';

const RegisterCliente: React.FC = () => {
  const navigate = useNavigate();

  const [nomeCliente, setNomeCliente] = useState('');
  const [cpfCliente, setCpfCliente] = useState('');
  const [telefoneCliente, setTelefoneCliente] = useState('');
  const [emailCliente, setEmailCliente] = useState('');
  const [senhaCliente, setSenhaCliente] = useState('');
  const [confirmarSenhaCliente, setConfirmarSenhaCliente] = useState('');
  const [mostrarSenha, setMostrarSenha] = useState(false);
  const [mostrarConfirmar, setMostrarConfirmar] = useState(false);
  const [erroCliente, setErroCliente] = useState<string | null>(null);
  const [carregandoCliente, setCarregandoCliente] = useState(false);
  const [mostrarSucesso, setMostrarSucesso] = useState(false);

  const handleCpfClienteChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const digits = e.target.value.replace(/\D/g, '').slice(0, 11);
    const formatted = digits
      .replace(/^(\d{3})(\d)/, '$1.$2')
      .replace(/^(\d{3})\.(\d{3})(\d)/, '$1.$2.$3')
      .replace(/\.(\d{3})(\d)/, '.$1-$2');
    setCpfCliente(formatted);
  };

  const handleNomeClienteChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const valor = e.target.value.replace(/[^a-zA-ZÀ-ÿ ]/g, '');
    setNomeCliente(valor);
  };

  const handleTelefoneClienteChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const d = e.target.value.replace(/\D/g, '').slice(0, 11);
    let formatado = d;
    if (d.length > 10) formatado = `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
    else if (d.length > 6) formatado = `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
    else if (d.length > 2) formatado = `(${d.slice(0, 2)}) ${d.slice(2)}`;
    else if (d.length > 0) formatado = `(${d}`;
    setTelefoneCliente(formatado);
  };

  const regrasSenhaCliente = [
    { label: 'Mínimo 8 caracteres', valido: senhaCliente.length >= 8 },
    { label: 'Pelo menos 1 letra maiúscula', valido: /[A-Z]/.test(senhaCliente) },
    { label: 'Pelo menos 1 letra minúscula', valido: /[a-z]/.test(senhaCliente) },
    { label: 'Pelo menos 1 número', valido: /[0-9]/.test(senhaCliente) },
  ];

  const handleSubmitCliente = async (e: React.FormEvent) => {
    e.preventDefault();
    setErroCliente(null);

    if (cpfCliente.length !== 14) {
      setErroCliente('Informe o CPF completo.');
      return;
    }

    if (telefoneCliente.replace(/\D/g, '').length < 10) {
      setErroCliente('Informe o telefone com DDD.');
      return;
    }

    if (senhaCliente !== confirmarSenhaCliente) {
      setErroCliente('As senhas não coincidem.');
      return;
    }

    const senhaValida = regrasSenhaCliente.every((r) => r.valido);
    if (!senhaValida) {
      setErroCliente('A senha não atende aos requisitos mínimos.');
      return;
    }

    setCarregandoCliente(true);
    try {
      // Não devolve token: o cliente só entra depois de confirmar o e-mail
      await ClienteService.registrar({
        nome: nomeCliente.trim(),
        cpf: cpfCliente,
        telefone: telefoneCliente,
        email: emailCliente.trim(),
        senha: senhaCliente,
        confirmar_senha: confirmarSenhaCliente,
      });

      setMostrarSucesso(true);
    } catch (err: any) {
      setErroCliente(mensagemDeErro(err, 'Erro ao criar conta. Tente novamente.'));
    } finally {
      setCarregandoCliente(false);
    }
  };

  const handleIrParaConfirmacaoCliente = () => {
    setMostrarSucesso(false);
    navigate('/verify-code/cliente', {
      state: { email: emailCliente.trim().toLowerCase(), mode: 'register' },
    });
  };

  return (
    <div
      className="register-cliente"
      style={{ backgroundImage: 'url(/images/Register-Back.png)' }}
    >
      <div className="register-cliente__container">

        {/* Imagem compartilhada */}
        <AuthCard />

        {/* Formulário */}
        <div className="register-cliente__form-side">
          <h1 className="register-cliente__title">Criar conta</h1>

          <form className="register-cliente__form" onSubmit={handleSubmitCliente}>

            {/* Mensagem de erro */}
            {erroCliente && (
              <p style={{ color: 'red', fontSize: '14px', marginBottom: '8px' }}>
                {erroCliente}
              </p>
            )}

            {/* Nome */}
            <div className="register-cliente__field">
              <label className="register-cliente__label" htmlFor="nomeCliente">
                Nome
              </label>
              <input
                id="nomeCliente"
                type="text"
                placeholder="Digite seu nome"
                className="register-cliente__input"
                value={nomeCliente}
                onChange={handleNomeClienteChange}
                required
              />
            </div>

            {/* CPF */}
            <div className="register-cliente__field">
              <label className="register-cliente__label" htmlFor="cpfCliente">
                CPF
              </label>
              <input
                id="cpfCliente"
                type="text"
                placeholder="000.000.000-00"
                className="register-cliente__input"
                value={cpfCliente}
                onChange={handleCpfClienteChange}
                required
              />
            </div>

            {/* Telefone */}
            <div className="register-cliente__field">
              <label className="register-cliente__label" htmlFor="telefoneCliente">
                Telefone
              </label>
              <input
                id="telefoneCliente"
                type="tel"
                inputMode="numeric"
                placeholder="(00) 00000-0000"
                className="register-cliente__input"
                value={telefoneCliente}
                onChange={handleTelefoneClienteChange}
                required
              />
            </div>

            {/* Email */}
            <div className="register-cliente__field">
              <label className="register-cliente__label" htmlFor="emailCliente">
                Email
              </label>
              <input
                id="emailCliente"
                type="email"
                placeholder="seu@email.com"
                className="register-cliente__input"
                value={emailCliente}
                onChange={(e) => setEmailCliente(e.target.value)}
                required
              />
            </div>

            {/* Senhas */}
            <div className="register-cliente__field-row">

              <div className="register-cliente__field">
                <label className="register-cliente__label" htmlFor="senhaCliente">
                  Senha
                </label>
                <div className="register-cliente__input-wrapper">
                  <input
                    id="senhaCliente"
                    type={mostrarSenha ? 'text' : 'password'}
                    placeholder="Digite sua senha"
                    className="register-cliente__input register-cliente__input--with-toggle"
                    value={senhaCliente}
                    onChange={(e) => setSenhaCliente(e.target.value)}
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
                {senhaCliente.length > 0 && (
                  <ul className="register-cliente__senha-regras">
                    {regrasSenhaCliente.map((regra) => (
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

              <div className="register-cliente__field">
                <label className="register-cliente__label" htmlFor="confirmarSenhaCliente">
                  Confirmar senha
                </label>
                <div className="register-cliente__input-wrapper">
                  <input
                    id="confirmarSenhaCliente"
                    type={mostrarConfirmar ? 'text' : 'password'}
                    placeholder="Confirme sua senha"
                    className="register-cliente__input register-cliente__input--with-toggle"
                    value={confirmarSenhaCliente}
                    onChange={(e) => setConfirmarSenhaCliente(e.target.value)}
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

            </div>

            <button
              className="register-cliente__submit"
              type="submit"
              disabled={carregandoCliente}
            >
              {carregandoCliente ? 'Criando conta...' : 'Criar conta'}
            </button>

          </form>

          <p className="register-cliente__redirect">
            Já possui conta?{' '}
            <button
              className="register-cliente__redirect-link"
              onClick={() => navigate('/login/cliente')}
            >
              Entrar
            </button>
          </p>
        </div>

      </div>

      {/* Modal de sucesso */}
      {mostrarSucesso && (
        <div
          className="register-cliente__overlay"
          onClick={() => setMostrarSucesso(false)}
        >
          <div
            className="register-cliente__modal-sucesso"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="register-cliente__sucesso-titulo">Cadastro realizado!</h2>
            <p className="register-cliente__sucesso-texto">
              Enviamos um e-mail para você confirmar sua conta.
            </p>
            <button
              className="register-cliente__btn"
              onClick={handleIrParaConfirmacaoCliente}
            >
              Confirmar e-mail
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default RegisterCliente;