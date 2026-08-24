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
  { label: 'Pelo menos 1 caractere especial', valido: /[^A-Za-z0-9]/.test(senha) },
  { label: 'Senhas iguais', valido: senha === confirmarSenha}
];

const [showTermosModal, setShowTermosModal] = useState(false);

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
        nome_fantasia: nomeFantasia || undefined,
        razao_social: razaoSocial,
        nome_responsavel: nomeCompleto,
        cpf,
        cnpj: cnpj,
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
      // Se o backend já mandou um motivo específico (ex: "Este e-mail já
      // está cadastrado"), mostramos ele. Senão, caímos numa mensagem mais
      // empática do que um erro genérico.
      const mensagemDoServidor = err?.response?.data?.message;
      setErro(
        mensagemDoServidor ??
        'Não foi possível criar sua conta. Tente novamente mais tarde. Se o problema persistir, entre em contato com nossa equipe.'
      );
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

            {/* Nome completo + CPF (dados de quem está cadastrando) */}
            <div className="register-page__field-row">
              <div className="register-page__field">
                <label className="register-page__label" htmlFor="nomeCompleto">
                  <span>Nome completo <span className="register-page__obrigatorio">*</span></span>
                  <span className="register-page__contador">{nomeCompleto.length}/100</span>
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
              </div>

              <div className="register-page__field">
                <label className="register-page__label" htmlFor="cpf">
                  <span>CPF (quem cadastra) <span className="register-page__obrigatorio">*</span></span>
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
            </div>

            {/* Nome do restaurante + Nome fantasia */}
            <div className="register-page__field-row">
              <div className="register-page__field">
                <label className="register-page__label" htmlFor="nome">
                  <span>Nome do restaurante <span className="register-page__obrigatorio">*</span></span>
                  <span className="register-page__contador">{nome.length}/100</span>
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
              </div>
              <div className="register-page__field">
                <label className="register-page__label" htmlFor="cnpj">
                  <span>CNPJ <span className="register-page__obrigatorio">*</span></span>
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
                    required
                  />
                </div>
              </div>

            </div>

            {/* Razão social + CNPJ */}
            <div className="register-page__field-row">
               <div className="register-page__field">
                <label className="register-page__label" htmlFor="nomeFantasia">
                  <span>Nome fantasia</span>
                  <span className="register-page__contador">{nomeFantasia.length}/100</span>
                </label>
                <div className="register-page__input-wrapper">
                  <span className="register-page__input-icon"><HiOutlineTag /></span>
                  <input
                    id="nomeFantasia"
                    type="text"
                    placeholder="Digite o nome fantasia"
                    className="register-page__input register-page__input--with-icon"
                    value={nomeFantasia}
                    onChange={(e) => setNomeFantasia(e.target.value)}
                    maxLength={100}
                  />
                </div>
              </div>
              
              <div className="register-page__field">
                <label className="register-page__label" htmlFor="razaoSocial">
                  <span>Razão social <span className="register-page__obrigatorio">*</span></span>
                  <span className="register-page__contador">{razaoSocial.length}/150</span>
                </label>
                <div className="register-page__input-wrapper">
                  <span className="register-page__input-icon"><HiOutlineDocumentText /></span>
                  <input
                    id="razaoSocial"
                    type="text"
                    placeholder="Digite a razão social"
                    className="register-page__input register-page__input--with-icon"
                    value={razaoSocial}
                    onChange={(e) => setRazaoSocial(e.target.value)}
                    maxLength={150}
                    required
                  />
                </div>
              </div>
            </div>

            {/* Email + Estado */}
            <div className="register-page__field-row">
              <div className="register-page__field">
                <label className="register-page__label" htmlFor="email">
                  <span>Email <span className="register-page__obrigatorio">*</span></span>
                  <span className="register-page__contador">{email.length}/150</span>
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
              </div>
              {/* Cidade */}
              <div className="register-page__field">
              <label className="register-page__label" htmlFor="cidade">
                <span>Cidade <span className="register-page__obrigatorio">*</span></span>
                <span className="register-page__contador">{cidade.length}/80</span>
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
            </div>
              
            </div>


            {/* Senhas*/}
            <div className="register-page__field-row">
              <div className="register-page__field">
                <label className="register-page__label" htmlFor="estado">
                  <span>Estado <span className="register-page__obrigatorio">*</span></span>
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
                    <option value="" disabled>Selecione</option>
                    {ESTADOS_BR.map((uf) => (
                      <option key={uf} value={uf}>{uf}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="register-page__field">
                <label className="register-page__label" htmlFor="senha">
                  <span>Senha <span className="register-page__obrigatorio">*</span></span>
                  <span className="register-page__contador">{senha.length}/60</span>
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
              </div>

              <div className="register-page__field">
                <label className="register-page__label" htmlFor="confirmarSenha">
                  <span>Confirmar senha <span className="register-page__obrigatorio">*</span></span>
                  <span className="register-page__contador">{confirmarSenha.length}/60</span>
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
              </div>
            </div>

            {/* Requisitos de senha — em linha (wrap), pra ocupar menos altura */}
            <ul className="register-page__senha-regras">
              {regrasSenha.map((regra) => {
                // Antes de a pessoa digitar qualquer coisa, os requisitos
                // ficam neutros (cinza). Só viram vermelho/verde depois
                // que ela começa a digitar no campo de senha.
                const aindaNaoDigitou = senha.length === 0;
                const classeRegra = aindaNaoDigitou
                  ? 'register-page__regra register-page__regra--neutro'
                  : regra.valido
                  ? 'register-page__regra register-page__regra--ok'
                  : 'register-page__regra register-page__regra--erro';

                return (
                  <li key={regra.label} className={classeRegra}>
                    {aindaNaoDigitou ? '•' : regra.valido ? '✔' : '✘'} {regra.label}
                  </li>
                );
              })}
            </ul>

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

            {/* Mensagem de erro */}
              {erro && (
              <p style={{ color: 'red', fontSize: '14px', marginBottom: '8px' }}>
                {erro}
              </p>
            )}

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

        {showTermosModal && (
  <div className="register-page__overlay" onClick={() => setShowTermosModal(false)}>
    <div
      className="register-page__modal register-page__modal--termos"
      onClick={(e) => e.stopPropagation()}
    >
      <div className="register-page__modal-inner register-page__modal-inner--termos">
        <h2 className="register-page__modal-titulo">
          Termos de Uso e Política de Privacidade
        </h2>

        <div className="register-page__modal-scroll">
          <p>
            {/* TODO: substituir pelo texto real dos seus Termos de Uso */}
            TERMOS DE USO E CONDIÇÕES GERAIS DE UTILIZAÇÃO — MENUPOINT

Última atualização: 22 de agosto de 2026.

Bem-vindo ao MenuPoint. Estes Termos de Uso estabelecem as regras, direitos, deveres e responsabilidades relacionados ao acesso e à utilização da plataforma MenuPoint, incluindo seu sistema de cardápio digital, funcionalidades destinadas a restaurantes e clientes, gerenciamento de pedidos, mesas, produtos, pagamentos e demais serviços disponibilizados pela plataforma.

Ao acessar, cadastrar-se ou utilizar o MenuPoint, o usuário declara que leu, compreendeu e concorda com estes Termos de Uso e com a Política de Privacidade da plataforma. Caso não concorde com qualquer uma das condições apresentadas, o usuário deverá interromper a utilização do sistema.

O MenuPoint é uma plataforma tecnológica destinada a facilitar a interação entre restaurantes e seus clientes. Por meio do sistema, os restaurantes podem disponibilizar seus cardápios digitais, cadastrar produtos, receber pedidos, gerenciar mesas, acompanhar vendas e utilizar outras ferramentas de gerenciamento disponibilizadas pela plataforma.

O usuário é responsável por utilizar o MenuPoint de maneira correta, ética e de acordo com a legislação brasileira. É proibida a utilização da plataforma para atividades ilegais, fraudulentas, ofensivas ou que possam prejudicar o funcionamento do sistema, outros usuários, restaurantes ou terceiros.

Para utilizar determinadas funcionalidades, poderá ser necessário realizar um cadastro. O usuário deverá fornecer informações verdadeiras, completas e atualizadas. O fornecimento de informações falsas, incompletas ou pertencentes a terceiros poderá resultar na suspensão ou encerramento da conta.

O usuário é responsável pela segurança de seus dados de acesso, incluindo senha, e-mail e demais informações utilizadas para autenticação. O usuário não deverá compartilhar suas credenciais com terceiros e deverá comunicar imediatamente ao MenuPoint qualquer suspeita de acesso não autorizado à sua conta.

Os restaurantes são responsáveis pelas informações disponibilizadas em seus cardápios, incluindo nomes dos produtos, descrições, imagens, ingredientes, preços, adicionais, tamanhos, disponibilidade, promoções e demais características. O restaurante também é responsável pela atualização dessas informações e pela veracidade dos dados apresentados aos clientes.

Os produtos e serviços apresentados no MenuPoint são fornecidos pelos respectivos restaurantes. O MenuPoint atua como uma plataforma tecnológica de intermediação e disponibilização de ferramentas digitais e não é necessariamente responsável pela produção, preparação, qualidade, composição, embalagem ou entrega dos alimentos comercializados pelos estabelecimentos.

Antes de realizar um pedido, o cliente deverá conferir atentamente os produtos selecionados, quantidades, adicionais, observações, valores, taxas e demais informações apresentadas. Após a confirmação, o pedido poderá ser encaminhado ao restaurante para processamento.

A aceitação de um pedido dependerá da disponibilidade dos produtos e das condições operacionais do restaurante. O estabelecimento poderá recusar ou cancelar pedidos em situações como indisponibilidade de produtos, encerramento do atendimento, problemas operacionais, informações incorretas ou outras circunstâncias justificáveis.

Os preços apresentados no sistema são definidos pelos respectivos restaurantes e poderão ser alterados pelos estabelecimentos a qualquer momento. Alterações posteriores não deverão afetar pedidos que já tenham sido devidamente confirmados, salvo situações previstas pela legislação ou pelas condições específicas da compra.

Quando houver pagamento realizado por meio da plataforma ou por serviços integrados ao MenuPoint, o processamento poderá ser realizado por empresas especializadas, instituições financeiras, operadoras de cartão ou outros prestadores de serviços de pagamento. O MenuPoint não se responsabiliza por falhas exclusivamente relacionadas aos sistemas desses terceiros.

As condições de cancelamento, reembolso e estorno poderão variar de acordo com o restaurante, o tipo de pedido, o estágio de preparação e o meio de pagamento utilizado. Quando aplicável, o prazo para realização de estornos poderá depender da instituição financeira ou empresa responsável pelo processamento do pagamento.

Os restaurantes que utilizarem o MenuPoint são responsáveis pelo cumprimento da legislação aplicável às suas atividades, incluindo normas relacionadas à defesa do consumidor, segurança alimentar, informações sobre produtos, tributos, direitos trabalhistas e demais obrigações legais pertinentes ao funcionamento do estabelecimento.

O restaurante também deverá garantir que possui autorização para utilizar imagens, marcas, fotografias, textos, logotipos e demais conteúdos inseridos em seu cardápio ou em qualquer outra área da plataforma.

O cliente é responsável por fornecer corretamente as informações necessárias para a realização de pedidos e pela conferência dos dados antes da confirmação. O uso de dados falsos, pedidos fraudulentos, tentativas de obtenção de vantagens indevidas ou qualquer outra forma de utilização abusiva da plataforma poderá resultar na suspensão ou encerramento da conta.

O MenuPoint poderá utilizar informações fornecidas pelos usuários para permitir o funcionamento da plataforma, processar pedidos, realizar autenticação, oferecer suporte, melhorar os serviços, prevenir fraudes, cumprir obrigações legais e exercer direitos legítimos, sempre observando a legislação aplicável.

O tratamento de dados pessoais realizado pelo MenuPoint deverá observar a Lei Geral de Proteção de Dados Pessoais, Lei nº 13.709/2018, bem como outras normas aplicáveis à proteção de dados e à privacidade. As informações detalhadas sobre coleta, utilização, armazenamento, compartilhamento e proteção dos dados pessoais estão disponíveis na Política de Privacidade do MenuPoint.

O MenuPoint poderá utilizar cookies e tecnologias semelhantes para garantir o funcionamento adequado da plataforma, armazenar preferências, melhorar a experiência do usuário, gerar estatísticas e disponibilizar determinadas funcionalidades.

O MenuPoint poderá enviar comunicações relacionadas ao funcionamento da conta, pedidos, segurança, atualizações, suporte, alterações importantes no serviço e, quando permitido, informações promocionais.

A plataforma poderá apresentar promoções, cupons e descontos disponibilizados pelo próprio MenuPoint ou pelos restaurantes. Cada promoção poderá possuir regras específicas, incluindo prazo de validade, quantidade disponível, produtos participantes, valor mínimo de compra e outras condições.

O MenuPoint buscará manter seus sistemas disponíveis e funcionando adequadamente, porém não garante que a plataforma permanecerá permanentemente livre de erros, interrupções ou indisponibilidades. O sistema poderá ficar temporariamente indisponível em razão de manutenções, atualizações, falhas técnicas, problemas de infraestrutura, falhas de serviços de terceiros, ataques virtuais, eventos de força maior ou outras situações fora do controle razoável da plataforma.

O MenuPoint poderá realizar alterações, atualizações, melhorias, substituições ou descontinuações de funcionalidades sempre que necessário para o aprimoramento da plataforma, adequação às necessidades dos usuários, segurança do sistema ou cumprimento de obrigações legais.

Todo o conteúdo pertencente ao MenuPoint, incluindo sua marca, logotipo, identidade visual, código-fonte, interfaces, layout, textos, sistemas, funcionalidades e elementos gráficos, é protegido pela legislação aplicável de propriedade intelectual. O uso da plataforma não concede ao usuário qualquer direito de propriedade sobre esses elementos.

É proibida a reprodução, cópia, distribuição, alteração, engenharia reversa, comercialização ou utilização não autorizada de qualquer parte do sistema MenuPoint.

Os conteúdos inseridos pelos restaurantes permanecem sob responsabilidade de seus respectivos titulares. Ao inserir imagens, textos, logotipos, descrições ou outros materiais na plataforma, o restaurante declara possuir os direitos necessários para sua utilização e autoriza o MenuPoint a armazenar, processar e exibir esses conteúdos para a execução dos serviços disponibilizados.

O MenuPoint poderá adotar medidas técnicas e administrativas destinadas a proteger as informações tratadas pela plataforma contra acessos não autorizados, perda, alteração, divulgação ou destruição indevida. Entretanto, nenhum sistema eletrônico é completamente imune a falhas, ataques ou incidentes de segurança.

O MenuPoint não será responsável por problemas decorrentes exclusivamente de informações incorretas fornecidas pelos usuários ou restaurantes, indisponibilidade de produtos, atrasos causados pelos estabelecimentos ou terceiros, qualidade dos alimentos, preparação dos pedidos ou outras circunstâncias que estejam fora do controle razoável da plataforma, respeitados os direitos garantidos pela legislação brasileira.

O MenuPoint poderá suspender ou encerrar contas que apresentem comportamento fraudulento, violem estes Termos de Uso, descumpram a legislação aplicável ou prejudiquem o funcionamento da plataforma e seus usuários.

O usuário poderá solicitar o encerramento de sua conta por meio dos canais oficiais disponibilizados pelo MenuPoint. O encerramento da conta não necessariamente resultará na exclusão imediata de todas as informações relacionadas ao usuário, especialmente quando determinados dados precisarem ser mantidos para cumprimento de obrigações legais, prevenção de fraudes, segurança, auditoria ou exercício regular de direitos.

A plataforma poderá disponibilizar links, integrações ou serviços de empresas terceiras. Esses serviços poderão possuir seus próprios termos de uso e políticas de privacidade, sendo de responsabilidade do usuário verificar as condições aplicáveis ao utilizar serviços externos.

O MenuPoint poderá entrar em contato com os usuários por meio dos dados fornecidos durante o cadastro. O usuário deverá manter suas informações de contato atualizadas para garantir o recebimento de comunicações importantes relacionadas à sua conta e aos serviços utilizados.

Caso alguma disposição destes Termos de Uso seja considerada inválida ou inexigível, as demais disposições permanecerão válidas e continuarão produzindo seus efeitos.

A eventual ausência de cobrança ou aplicação imediata de determinada regra pelo MenuPoint não significa renúncia ao direito de exigir seu cumprimento posteriormente.

Estes Termos de Uso serão regidos pelas leis da República Federativa do Brasil. As relações de consumo eventualmente existentes deverão observar a legislação brasileira aplicável, incluindo o Código de Defesa do Consumidor e demais normas pertinentes.

Eventuais dúvidas, reclamações ou solicitações relacionadas ao MenuPoint deverão ser encaminhadas pelos canais oficiais de atendimento disponibilizados pela plataforma.

Ao selecionar a opção "Li e concordo com os Termos de Uso", criar uma conta, realizar um pedido ou utilizar as funcionalidades do MenuPoint, o usuário declara que teve acesso a estes Termos, compreendeu seu conteúdo e concorda com as condições estabelecidas.

O MenuPoint poderá atualizar estes Termos de Uso sempre que necessário. A versão vigente estará disponível na plataforma, sendo responsabilidade do usuário consultar periodicamente eventuais alterações.

MenuPoint — O ponto que transforma fome em vendas.

          </p>
          <p>
            {/* TODO: continue com o restante do texto / política de privacidade */}
          </p>
          <button
          type="button"
          className="register-page__modal-button"
          onClick={() => {
            setAceitaTermos(true);
            setShowTermosModal(false);
          }}
        >
          LI E CONCORDO
        </button>
        </div>

        
      </div>
    </div>
  </div>
)}

    </div>

    
    );
};

export default RegisterPage;