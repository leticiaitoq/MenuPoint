import React, { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  HiEye, HiEyeOff,
  HiOutlineUser, HiOutlineOfficeBuilding, HiOutlineTag,
  HiOutlineDocumentText, HiOutlineIdentification,
  HiOutlineMail, HiOutlineMap, HiOutlineLocationMarker,
  HiOutlineLockClosed,
} from 'react-icons/hi';
import AuthCard from './AuthCard';
import AuthService from '../../services/auth.service';
import AssinaturaService from '../../services/assinatura.service';
import TermsModal from '../../shared/components/TermsModal/TermesModal';
import './RegisterPage.css';

const RegisterPage: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  // Se a pessoa veio do site institucional com um plano já escolhido
  // (ex: menupoint-sistema.../?plano=pro), guardamos o slug aqui.
  const planoDesejado = searchParams.get('plano'); // 'basico' | 'pro' | null
  const [redirecionandoPagamento, setRedirecionandoPagamento] = useState(false);

  const [nome, setNome] = useState('');
  const [nomeCompleto, setNomeCompleto] = useState('');
  const [nomeFantasia, setNomeFantasia] = useState('');
  const [razaoSocial, setRazaoSocial] = useState('');
  const [cpf, setCpf] = useState('');
  const [estado, setEstado] = useState('');
  const [cidade, setCidade] = useState('');
  const [aceitaTermos, setAceitaTermos] = useState(false);
  const [cnpj, setCnpj] = useState('');
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [confirmarSenha, setConfirmarSenha] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [carregando, setCarregando] = useState(false);
  const [showSucesso, setShowSucesso] = useState(false);
  const [showTermosModal, setShowTermosModal] = useState(false);

  const handleCpfChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const digits = e.target.value.replace(/\D/g, '').slice(0, 11);
    const formatted = digits
      .replace(/^(\d{3})(\d)/, '$1.$2')
      .replace(/^(\d{3})\.(\d{3})(\d)/, '$1.$2.$3')
      .replace(/\.(\d{3})(\d)/, '.$1-$2');
    setCpf(formatted);
  };

  const ESTADOS_BR = [
    'AC', 'AL', 'AP', 'AM', 'BA', 'CE', 'DF', 'ES', 'GO',
    'MA', 'MT', 'MS', 'MG', 'PA', 'PB', 'PR', 'PE', 'PI',
    'RJ', 'RN', 'RS', 'RO', 'RR', 'SC', 'SP', 'SE', 'TO',
  ];

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

    if (!aceitaTermos) {
      setErro('Você precisa aceitar os Termos de Uso para continuar.');
      return;
    }

    setCarregando(true);
    try {
      const resultado = await AuthService.registrar({
        nome_restaurante: nome,
        nome_fantasia: nomeFantasia,
        razao_social: razaoSocial,
        nome_responsavel: nomeCompleto,
        cpf,
        cnpj: cnpj || undefined,
        email,
        estado,
        cidade,
        senha,
        confirmar_senha: confirmarSenha,
      });

      localStorage.setItem('@menupoint:token', resultado.token)
      localStorage.setItem('@menupoint:refresh_token', resultado.refresh_token)
      localStorage.setItem('@menupoint:usuario', JSON.stringify(resultado.usuario))

      // Se a pessoa veio de um botão "Assinar plano X" no site, pula direto
      // pro checkout do Mercado Pago em vez de mostrar o modal de boas-vindas.
      if (planoDesejado) {
        setCarregando(false);
        setRedirecionandoPagamento(true);
        try {
          const planos = await AssinaturaService.listarPlanos();
          const planoEscolhido = planos.find((p) => p.slug === planoDesejado);

          if (!planoEscolhido) {
            // Plano não reconhecido (link antigo ou slug errado): não trava o
            // cadastro, só cai no fluxo normal de confirmação por e-mail.
            setShowSucesso(true);
            return;
          }

          const { init_point } = await AssinaturaService.criar(planoEscolhido.id, email);
          window.location.href = init_point;
        } catch (err: any) {
          // Conta já foi criada com sucesso — não deixamos a pessoa perdida
          // só porque a etapa de pagamento falhou. Ela pode assinar depois.
          setRedirecionandoPagamento(false);
          setErro('Sua conta foi criada, mas não foi possível iniciar o pagamento agora. Você pode assinar um plano dentro do sistema.');
          setShowSucesso(true);
        }
        return;
      }

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
    navigate('/verify-code', { state: { email, mode: 'register' } });
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

                        {/* Nome completo (quem está cadastrando) */}
            <div className="register-page__field">
              <label className="register-page__label" htmlFor="nomeCompleto">
                Nome completo (quem está cadastrando)
              </label>
              <div className="register-page__input-wrapper">
                <span className="register-page__input-icon"><HiOutlineUser /></span>
                <input
                  id="nomeCompleto"
                  type="text"
                  placeholder="Digite seu nome completo"
                  className="register-page__input register-page__input--with-icon"
                  value={nomeCompleto}
                  onChange={(e) => setNomeCompleto(e.target.value)}
                  maxLength={100}
                  required
                />
              </div>
               <span className="register-page__contador">{nomeCompleto.length}/100</span>
            </div>

            {/* Nome do restaurante */}
            <div className="register-page__field">
              <label className="register-page__label" htmlFor="nome">
                Nome do restaurante
              </label>
              <div className="register-page__input-wrapper">
                <span className="register-page__input-icon"><HiOutlineOfficeBuilding /></span>
                <input
                  id="nome"
                  type="text"
                  placeholder="Digite o nome do restaurante"
                  className="register-page__input register-page__input--with-icon"
                  value={nome}
                  onChange={handleNomeChange}
                  maxLength={100}
                  required
                />
              </div>
               <span className="register-page__contador">{nomeCompleto.length}/100</span>
            </div>

            {/* Nome fantasia */}
            <div className="register-page__field">
              <label className="register-page__label" htmlFor="nomeFantasia">
                Nome fantasia do restaurante
              </label>
              <div className="register-page__input-wrapper">
                <span className="register-page__input-icon"><HiOutlineTag /></span>
                <input
                  id="nomeFantasia"
                  type="text"
                  placeholder="Digite o nome fantasia do restaurante"
                  className="register-page__input register-page__input--with-icon"
                  value={nomeFantasia}
                  onChange={(e) => setNomeFantasia(e.target.value)}
                  maxLength={100}
                  required
                />
              </div>
               <span className="register-page__contador">{nomeCompleto.length}/100</span>
            </div>

            {/* Razão social */}
            <div className="register-page__field">
              <label className="register-page__label" htmlFor="razaoSocial">
                Razão social
              </label>
              <div className="register-page__input-wrapper">
                <span className="register-page__input-icon"><HiOutlineDocumentText /></span>
                <input
                  id="razaoSocial"
                  type="text"
                  placeholder="Digite a razão social da empresa"
                  className="register-page__input register-page__input--with-icon"
                  value={razaoSocial}
                  onChange={(e) => setRazaoSocial(e.target.value)}
                  maxLength={150}
                  required
                />
              </div>
               <span className="register-page__contador">{nomeCompleto.length}/150</span>
            </div>

            {/* CNPJ com máscara */}
            <div className="register-page__field">
              <label className="register-page__label" htmlFor="cnpj">
                CNPJ
              </label>
              <div className="register-page__input-wrapper">
                <span className="register-page__input-icon"><HiOutlineIdentification /></span>
                <input
                  id="cnpj"
                  type="text"
                  placeholder="00.000.000/0000-00"
                  className="register-page__input register-page__input--with-icon"
                  value={cnpj}
                  onChange={handleCnpjChange}
                />
              </div>
            </div>

            {/* CPF + Email lado a lado */}
            <div className="register-page__field-row">
              <div className="register-page__field">
                <label className="register-page__label" htmlFor="cpf">
                  CPF (quem está cadastrando)
                </label>
                <div className="register-page__input-wrapper">
                  <span className="register-page__input-icon"><HiOutlineIdentification /></span>
                  <input
                    id="cpf"
                    type="text"
                    placeholder="000.000.000-00"
                    className="register-page__input register-page__input--with-icon"
                    value={cpf}
                    onChange={handleCpfChange}
                    required
                  />
                </div>
              </div>

              <div className="register-page__field">
                <label className="register-page__label" htmlFor="email">
                  Email
                </label>
                <div className="register-page__input-wrapper">
                  <span className="register-page__input-icon"><HiOutlineMail /></span>
                  <input
                    id="email"
                    type="email"
                    placeholder="digite seu email"
                    className="register-page__input register-page__input--with-icon"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    maxLength={150}
                    required
                  />
                </div>
                 <span className="register-page__contador">{nomeCompleto.length}/150</span>
              </div>
            </div>

            {/* Estado + Cidade lado a lado */}
            <div className="register-page__field-row">
              <div className="register-page__field">
                <label className="register-page__label" htmlFor="estado">
                  Estado
                </label>
                <div className="register-page__input-wrapper">
                  <span className="register-page__input-icon"><HiOutlineMap /></span>
                  <select
                    id="estado"
                    className="register-page__input register-page__input--with-icon"
                    value={estado}
                    onChange={(e) => setEstado(e.target.value)}
                    required
                  >
                    <option value="" disabled>Selecione o estado</option>
                    {ESTADOS_BR.map((uf) => (
                      <option key={uf} value={uf}>{uf}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="register-page__field">
                <label className="register-page__label" htmlFor="cidade">
                  Cidade
                </label>
                <div className="register-page__input-wrapper">
                  <span className="register-page__input-icon"><HiOutlineLocationMarker /></span>
                  <input
                    id="cidade"
                    type="text"
                    placeholder="Digite sua cidade"
                    className="register-page__input register-page__input--with-icon"
                    value={cidade}
                    onChange={(e) => setCidade(e.target.value)}
                    maxLength={80}
                    required
                  />
                </div>
                 <span className="register-page__contador">{nomeCompleto.length}/80</span>
              </div>
            </div>

            {/* Senhas*/}
            <div className="register-page__field-row">

              <div className="register-page__field">
                <label className="register-page__label" htmlFor="senha">
                  Senha
                </label>
                <div className="register-page__input-wrapper">
                   <span className="register-page__input-icon"><HiOutlineLockClosed /></span>
                  <input
                    id="senha"
                    type={showPassword ? 'text' : 'password'}
                    placeholder="Digite sua senha"
                    className="register-page__input register-page__input--with-icon register-page__input--with-toggle"
                    value={senha}
                    onChange={(e) => setSenha(e.target.value)}
                    maxLength={60}
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
                  <span className="register-page__contador">{nomeCompleto.length}/60</span>
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
                 
              </div>

              <div className="register-page__field">
                <label className="register-page__label" htmlFor="confirmarSenha">
                  Confirmar senha
                </label>
                <div className="register-page__input-wrapper">
                   <span className="register-page__input-icon"><HiOutlineLockClosed /></span>
                  <input
                    id="confirmarSenha"
                    type={showConfirm ? 'text' : 'password'}
                    placeholder="Confirme sua senha"
                    className="register-page__input register-page__input--with-icon register-page__input--with-toggle"
                    value={confirmarSenha}
                    onChange={(e) => setConfirmarSenha(e.target.value)}
                    maxLength={60}
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
                 <span className="register-page__contador">{nomeCompleto.length}/60</span>
              </div>
            </div>

            {/* Termos de uso */}
            <div className="register-page__termos">
              <label className="register-page__termos-label">
                <input
                  type="checkbox"
                  checked={aceitaTermos}
                  onChange={(e) => {
                    if (e.target.checked) {
                      setShowTermosModal(true);
                    } else {
                      setAceitaTermos(false);
                    }
                  }}
                />
                Eu li e concordo com os{' '}
                <button type="button" className="register-page__termos-link" onClick={() => setShowTermosModal(true)}>
                  Termos de Uso
                </button>
                {' '}e com a{' '}
                <button type="button" className="register-page__termos-link" onClick={() => setShowTermosModal(true)}>
                  Política de Privacidade
                </button>
                {' '}do MenuPoint.
              </label>
            </div>

            <button
              className="register-page__submit"
              type="submit"
              disabled={carregando || redirecionandoPagamento}
            >
              {redirecionandoPagamento
                ? 'Levando você ao pagamento...'
                : carregando
                ? 'Criando conta...'
                : 'Criar conta'}
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
            className="register-page__modal"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="register-page__modal-inner">
              <h2 className="register-page__modal-titulo">Cadastro realizado!</h2>
              <p className="register-page__modal-texto">
                Enviamos um código de 6 dígitos para o seu e-mail. Digite ele
                na próxima tela para confirmar sua conta.
              </p>
              <button
                className="register-page__modal-button"
                onClick={handleIrParaConfirmacao}
              >
                CONFIRMAR E-MAIL
              </button>
            </div>
          </div>
        </div>
      )}

      <TermsModal
        isOpen={showTermosModal}
        onClose={() => setShowTermosModal(false)}
        onAccept={() => {
          setAceitaTermos(true);
          setShowTermosModal(false);
        }}
      />
    </div>
  );
};

export default RegisterPage;