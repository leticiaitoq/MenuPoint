import React, { useEffect, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  HiOutlineArrowLeft,
  HiOutlineArrowRight,
  HiOutlineBuildingOffice2,
  HiOutlineBuildingStorefront,
  HiOutlineCheck,
  HiOutlineCheckCircle,
  HiOutlineChevronDown,
  HiOutlineDocumentText,
  HiOutlineEnvelope,
  HiOutlineExclamationCircle,
  HiOutlineEye,
  HiOutlineEyeSlash,
  HiOutlineHashtag,
  HiOutlineHome,
  HiOutlineLockClosed,
  HiOutlineMap,
  HiOutlineMapPin,
  HiOutlineShieldCheck,
  HiOutlineUser,
  HiOutlineXCircle,
} from 'react-icons/hi2';
import AuthService from '../../services/auth.service';
import { useAuth } from '../../shared/contexts/Authcontext';
import AssinaturaService from '../../services/assinatura.service';
import TermsModal from '../../shared/components/TermsModal/TermesModal';
import './RegisterPage.css';

/* ────────────────────────────────────────────────────────────────
   Constantes e utilitários
──────────────────────────────────────────────────────────────── */

const ESTADOS_BR = [
  'AC', 'AL', 'AP', 'AM', 'BA', 'CE', 'DF', 'ES', 'GO',
  'MA', 'MT', 'MS', 'MG', 'PA', 'PB', 'PR', 'PE', 'PI',
  'RJ', 'RN', 'RS', 'RO', 'RR', 'SC', 'SP', 'SE', 'TO',
];

const somenteDigitos = (v: string) => v.replace(/\D/g, '');

/** Aplica uma máscara onde cada "0" é um dígito. Ex.: mascarar('123', '000.000') → '123' */
const mascarar = (valor: string, padrao: string) => {
  const digitos = somenteDigitos(valor);
  let i = 0;
  let saida = '';
  for (const ch of padrao) {
    if (i >= digitos.length) break;
    saida += ch === '0' ? digitos[i++] : ch;
  }
  return saida;
};

const normalizar = (s: string) =>
  s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();

const cpfValido = (valor: string) => {
  const d = somenteDigitos(valor);
  if (d.length !== 11 || /^(\d)\1{10}$/.test(d)) return false;
  const calc = (len: number) => {
    let soma = 0;
    for (let i = 0; i < len; i++) soma += Number(d[i]) * (len + 1 - i);
    const r = (soma * 10) % 11;
    return r === 10 ? 0 : r;
  };
  return calc(9) === Number(d[9]) && calc(10) === Number(d[10]);
};

const cnpjValido = (valor: string) => {
  const d = somenteDigitos(valor);
  if (d.length !== 14 || /^(\d)\1{13}$/.test(d)) return false;
  const calc = (len: number) => {
    const pesos = len === 12
      ? [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]
      : [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
    let soma = 0;
    for (let i = 0; i < len; i++) soma += Number(d[i]) * pesos[i];
    const r = soma % 11;
    return r < 2 ? 0 : 11 - r;
  };
  return calc(12) === Number(d[12]) && calc(13) === Number(d[13]);
};

const emailValido = (v: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);

type Erros = Record<string, string>;

/**
 * Largura de cada campo na grade de 12 colunas.
 *  d  = desktop (≥ 769px) · m = mobile · xs = telas muito estreitas (≤ 480px)
 */
const span = (d: number, m = 12, xs?: number) =>
  ({
    '--span-d': d,
    '--span-m': m,
    ...(xs ? { '--span-xs': xs } : {}),
  } as React.CSSProperties);

/* ────────────────────────────────────────────────────────────────
   Componentes de apoio (fora do componente principal para não
   remontar a cada digitação e perder o foco do input)
──────────────────────────────────────────────────────────────── */

interface FieldProps {
  name: string;
  label: string;
  icon: React.ReactNode;
  error?: string;
  layout: React.CSSProperties;
  children: React.ReactNode;
}

const Field: React.FC<FieldProps> = ({ name, label, icon, error, layout, children }) => (
  <div className="register-page__field" style={layout}>
    <label className="register-page__label" htmlFor={`rp-${name}`}>
      {label} <span className="register-page__req" aria-hidden="true">*</span>
    </label>
    <div className={`register-page__control${error ? ' register-page__control--error' : ''}`}>
      <span className="register-page__icon" aria-hidden="true">{icon}</span>
      {children}
    </div>
    {error && (
      <span className="register-page__error" role="alert">
        {error}
      </span>
    )}
  </div>
);

/** Ilustração decorativa (chapéu de chef + prato) do rodapé da lateral */
const ChefHatArt: React.FC = () => (
  <svg
    className="register-page__hat"
    viewBox="0 0 130 110"
    fill="none"
    stroke="currentColor"
    strokeWidth="3"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <path d="M34 56C14 55 9 32 30 25C32 9 55 4 64 17C73 5 96 10 97 26C118 32 112 56 92 56" />
    <path d="M36 56L40 79H88L92 56" />
    <path d="M38 67H90" />
    <ellipse cx="64" cy="93" rx="50" ry="9" />
    <path d="M110 76L122 70M114 88H128M104 66L110 55" />
  </svg>
);

/* ────────────────────────────────────────────────────────────────
   Página
──────────────────────────────────────────────────────────────── */

const RegisterPage: React.FC = () => {
  const navigate = useNavigate();
  const { entrar } = useAuth();
  const [searchParams] = useSearchParams();
  // Se a pessoa veio do site institucional com um plano já escolhido
  // (ex: menupoint-sistema.../?plano=pro), guardamos o slug aqui.
  const planoDesejado = searchParams.get('plano'); // 'basico' | 'pro' | null
  const [redirecionandoPagamento, setRedirecionandoPagamento] = useState(false);

  const [etapa, setEtapa] = useState<1 | 2>(1);

  // Etapa 1 — restaurante
  const [nome, setNome] = useState('');
  const [cnpj, setCnpj] = useState('');
  const [razaoSocial, setRazaoSocial] = useState('');
  const [cep, setCep] = useState('');
  const [estado, setEstado] = useState('');
  const [cidade, setCidade] = useState('');
  const [endereco, setEndereco] = useState('');
  const [bairro, setBairro] = useState('');
  const [numero, setNumero] = useState('');

  // Etapa 2 — responsável
  const [nomeCompleto, setNomeCompleto] = useState('');
  const [cpf, setCpf] = useState('');
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [confirmarSenha, setConfirmarSenha] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [aceitaTermos, setAceitaTermos] = useState(false);

  // Estado da tela
  const [erros, setErros] = useState<Erros>({});
  const [erro, setErro] = useState<string | null>(null);
  const [carregando, setCarregando] = useState(false);
  const [showSucesso, setShowSucesso] = useState(false);
  const [showTermosModal, setShowTermosModal] = useState(false);

  // CEP / cidades
  const [buscandoCep, setBuscandoCep] = useState(false);
  const [cidades, setCidades] = useState<string[]>([]);
  const [carregandoCidades, setCarregandoCidades] = useState(false);
  const [cidadesIndisponivel, setCidadesIndisponivel] = useState(false);
  const cidadesCache = useRef<Record<string, string[]>>({});

  /* ── Lista de cidades (IBGE) conforme o estado escolhido ── */
  useEffect(() => {
    if (!estado) {
      setCidades([]);
      setCarregandoCidades(false);
      return;
    }

    const emCache = cidadesCache.current[estado];
    if (emCache) {
      setCidades(emCache);
      setCidadesIndisponivel(false);
      return;
    }

    let cancelado = false;
    setCarregandoCidades(true);
    setCidadesIndisponivel(false);

    fetch(`https://servicodados.ibge.gov.br/api/v1/localidades/estados/${estado}/municipios?orderBy=nome`)
      .then((r) => {
        if (!r.ok) throw new Error('IBGE indisponível');
        return r.json();
      })
      .then((lista: { nome: string }[]) => {
        const nomes = lista.map((m) => m.nome);
        cidadesCache.current[estado] = nomes;
        if (!cancelado) setCidades(nomes);
      })
      .catch(() => {
        // Sem a lista, o campo vira texto livre para a pessoa não travar.
        if (!cancelado) setCidadesIndisponivel(true);
      })
      .finally(() => {
        if (!cancelado) setCarregandoCidades(false);
      });

    return () => {
      cancelado = true;
    };
  }, [estado]);

  /* ── Alinha o nome vindo do ViaCEP com o nome oficial da lista (acentos/caixa) ── */
  useEffect(() => {
    if (!cidade || cidades.length === 0) return;
    const alvo = normalizar(cidade);
    const oficial = cidades.find((c) => normalizar(c) === alvo);
    if (oficial && oficial !== cidade) setCidade(oficial);
  }, [cidades, cidade]);

  const opcoesCidade = cidade && !cidades.includes(cidade) ? [cidade, ...cidades] : cidades;

  /* ── Helpers de formulário ── */
  const limparErro = (...campos: string[]) =>
    setErros((prev) => {
      if (!campos.some((c) => prev[c])) return prev;
      const novo = { ...prev };
      campos.forEach((c) => delete novo[c]);
      return novo;
    });

  const focarPrimeiroErro = (e: Erros) => {
    const primeiro = Object.keys(e)[0];
    if (primeiro) document.getElementById(`rp-${primeiro}`)?.focus();
  };

  const irParaEtapa = (destino: 1 | 2) => {
    setErro(null);
    setEtapa(destino);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  /* ── Handlers de campos ── */
  const handleNomeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setNome(e.target.value.replace(/[^a-zA-ZÀ-ÿ0-9 ]/g, ''));
    limparErro('nome');
  };

  const handleCnpjChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setCnpj(mascarar(e.target.value, '00.000.000/0000-00'));
    limparErro('cnpj');
  };

  const handleCpfChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setCpf(mascarar(e.target.value, '000.000.000-00'));
    limparErro('cpf');
  };

  const buscarCep = async (cepFormatado: string) => {
    setBuscandoCep(true);
    try {
      const resp = await fetch(`https://viacep.com.br/ws/${somenteDigitos(cepFormatado)}/json/`);
      const dados = await resp.json();

      if (dados.erro) {
        setErros((prev) => ({ ...prev, cep: 'CEP não encontrado. Preencha o endereço manualmente.' }));
        return;
      }

      if (dados.uf) setEstado(dados.uf);
      if (dados.localidade) setCidade(dados.localidade);
      if (dados.logradouro) setEndereco(dados.logradouro);
      if (dados.bairro) setBairro(dados.bairro);
      limparErro('estado', 'cidade', 'endereco', 'bairro');
    } catch {
      // Falha de rede: a pessoa simplesmente preenche o endereço na mão.
    } finally {
      setBuscandoCep(false);
    }
  };

  const handleCepChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const formatado = mascarar(e.target.value, '00000-000');
    setCep(formatado);
    limparErro('cep');
    if (formatado.length === 9) buscarCep(formatado);
  };

  const handleEstadoChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setEstado(e.target.value);
    setCidade('');
    limparErro('estado', 'cidade');
  };

  /* ── Regras de senha ── */
  const regrasSenha = [
    { label: 'Mínimo de 8 caracteres', ok: senha.length >= 8 },
    { label: 'Uma letra maiúscula', ok: /[A-Z]/.test(senha) },
    { label: 'Uma letra minúscula', ok: /[a-z]/.test(senha) },
    { label: 'Um número', ok: /[0-9]/.test(senha) },
  ];
  const senhaForte = regrasSenha.every((r) => r.ok);

  /* ── Validação por etapa ── */
  const validarEtapa1 = (): Erros => {
    const e: Erros = {};
    if (nome.trim().length < 2) e.nome = 'Informe o nome do restaurante.';
    if (!cnpjValido(cnpj)) e.cnpj = 'Informe um CNPJ válido.';
    if (razaoSocial.trim().length < 3) e.razaoSocial = 'Informe a razão social.';
    if (somenteDigitos(cep).length !== 8) e.cep = 'Informe um CEP válido.';
    if (!estado) e.estado = 'Selecione o estado.';
    if (!cidade.trim()) e.cidade = 'Selecione a cidade.';
    if (endereco.trim().length < 3) e.endereco = 'Informe o endereço.';
    if (!bairro.trim()) e.bairro = 'Informe o bairro.';
    if (!numero.trim()) e.numero = 'Informe o nº.';
    return e;
  };

  const validarEtapa2 = (): Erros => {
    const e: Erros = {};
    if (nomeCompleto.trim().split(/\s+/).length < 2) e.nomeCompleto = 'Informe nome e sobrenome.';
    if (!cpfValido(cpf)) e.cpf = 'Informe um CPF válido.';
    if (!emailValido(email)) e.email = 'Informe um e-mail válido.';
    if (!senhaForte) e.senha = 'A senha não atende aos requisitos.';
    if (senha !== confirmarSenha) e.confirmarSenha = 'As senhas não coincidem.';
    return e;
  };

  /* ── Etapa 1 → 2 ── */
  const handleAvancar = (e: React.FormEvent) => {
    e.preventDefault();
    const encontrados = validarEtapa1();
    setErros(encontrados);
    if (Object.keys(encontrados).length > 0) {
      focarPrimeiroErro(encontrados);
      return;
    }
    irParaEtapa(2);
  };

  /* ── Envio final ── */
  const handleFinalizar = async (e: React.FormEvent) => {
    e.preventDefault();
    setErro(null);

    const encontrados = validarEtapa2();
    setErros(encontrados);
    if (Object.keys(encontrados).length > 0) {
      focarPrimeiroErro(encontrados);
      return;
    }

    if (!aceitaTermos) {
      setErro('Você precisa aceitar os Termos de Uso para continuar.');
      return;
    }

    setCarregando(true);
    try {
      const resultado = await AuthService.registrar({
        // restaurante
        nome_restaurante: nome.trim(),
        razao_social: razaoSocial.trim(),
        cnpj,
        cep,
        estado,
        cidade: cidade.trim(),
        endereco: endereco.trim(),
        numero: numero.trim(),
        bairro: bairro.trim(),
        // responsável
        nome_responsavel: nomeCompleto.trim(),
        cpf,
        email: email.trim(),
        senha,
        confirmar_senha: confirmarSenha,
      });

      entrar({
        token: resultado.token,
        refresh_token: resultado.refresh_token,
        usuario: resultado.usuario,
      });

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

          const { init_point } = await AssinaturaService.criar(planoEscolhido.id, email.trim());
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
    navigate('/verify-code', { state: { email: email.trim(), mode: 'register' } });
  };

  /* ────────────────────────────────────────────────────────────
     Render
  ──────────────────────────────────────────────────────────── */
  return (
    <div
      className="register-page"
      style={{ backgroundImage: 'url(/images/Register-Back.png)' }}
    >
      <div className="register-page__card">

        {/* ── Lateral da marca ── */}
        <aside className="register-page__brand">
          <img src="/images/lLogo.png" alt="" className="register-page__logo" />
          <span className="register-page__wordmark" aria-label="MenuPoint">
            Menu<span>Point</span>
          </span>
          <hr className="register-page__divider" />
          <p className="register-page__tagline">
            {etapa === 1
              ? 'Seu restaurante mais perto dos seus clientes.'
              : 'Agora é a vez de quem faz tudo acontecer.'}
          </p>
          <ChefHatArt />
        </aside>

        {/* ── Conteúdo ── */}
        <main className="register-page__content">

          {/* Indicador de etapas */}
          <p className="register-page__step-count">Etapa {etapa} de 2</p>
          <div className="register-page__stepper">
            <span className="register-page__step-line" aria-hidden="true">
              <span style={{ width: etapa === 1 ? '50%' : '100%' }} />
            </span>

            <div className="register-page__step">
              <button
                type="button"
                className={`register-page__step-dot ${etapa === 1 ? 'is-active' : 'is-done'}`}
                onClick={() => irParaEtapa(1)}
                disabled={etapa === 1}
                aria-label="Voltar para Dados do restaurante"
              >
                {etapa === 1 ? '1' : <HiOutlineCheck />}
              </button>
              <span className={`register-page__step-label ${etapa === 1 ? 'is-active' : ''}`}>
                Dados do restaurante
              </span>
            </div>

            <div className="register-page__step">
              <span className={`register-page__step-dot ${etapa === 2 ? 'is-active' : ''}`}>2</span>
              <span className={`register-page__step-label ${etapa === 2 ? 'is-active' : ''}`}>
                Dados do responsável
              </span>
            </div>
          </div>

          <h1 className="register-page__title">
            {etapa === 1 ? 'Vamos começar!' : 'Agora, sobre você!'}
          </h1>
          <p className="register-page__subtitle">
            {etapa === 1
              ? 'Informe os dados do seu restaurante para que possamos continuar.'
              : 'Informe seus dados para finalizar o seu cadastro.'}
          </p>

          {erro && (
            <div className="register-page__alert" role="alert">
              <HiOutlineExclamationCircle />
              <span>{erro}</span>
            </div>
          )}

          {/* ═══════════ ETAPA 1 — RESTAURANTE ═══════════ */}
          {etapa === 1 && (
            <form className="register-page__form" onSubmit={handleAvancar} noValidate>

              <Field name="nome" label="Nome do restaurante" icon={<HiOutlineBuildingStorefront />}
                error={erros.nome} layout={span(7)}>
                <input id="rp-nome" type="text" className="register-page__input"
                  placeholder="Ex: Sabor da Vila" value={nome} onChange={handleNomeChange}
                  maxLength={100} autoComplete="organization" aria-invalid={!!erros.nome} />
              </Field>

              <Field name="cnpj" label="CNPJ" icon={<HiOutlineDocumentText />}
                error={erros.cnpj} layout={span(5)}>
                <input id="rp-cnpj" type="text" inputMode="numeric" className="register-page__input"
                  placeholder="00.000.000/0000-00" value={cnpj} onChange={handleCnpjChange}
                  aria-invalid={!!erros.cnpj} />
              </Field>

              <Field name="razaoSocial" label="Razão Social" icon={<HiOutlineBuildingOffice2 />}
                error={erros.razaoSocial} layout={span(12)}>
                <input id="rp-razaoSocial" type="text" className="register-page__input"
                  placeholder="Digite a razão social" value={razaoSocial}
                  onChange={(e) => { setRazaoSocial(e.target.value); limparErro('razaoSocial'); }}
                  maxLength={150} aria-invalid={!!erros.razaoSocial} />
              </Field>

              <Field name="cep" label="CEP" icon={<HiOutlineMapPin />}
                error={erros.cep} layout={span(4)}>
                <input id="rp-cep" type="text" inputMode="numeric" className="register-page__input"
                  placeholder="00000-000" value={cep} onChange={handleCepChange}
                  autoComplete="postal-code" aria-invalid={!!erros.cep} />
                {buscandoCep && <span className="register-page__spinner" aria-label="Buscando CEP" />}
              </Field>

              <Field name="estado" label="Estado" icon={<HiOutlineMap />}
                error={erros.estado} layout={span(3, 6, 12)}>
                <select id="rp-estado" className="register-page__input register-page__input--select"
                  value={estado} onChange={handleEstadoChange} aria-invalid={!!erros.estado}>
                  <option value="" disabled>Selecione</option>
                  {ESTADOS_BR.map((uf) => <option key={uf} value={uf}>{uf}</option>)}
                </select>
                <HiOutlineChevronDown className="register-page__chevron" aria-hidden="true" />
              </Field>

              <Field name="cidade" label="Cidade" icon={<HiOutlineMapPin />}
                error={erros.cidade} layout={span(5, 6, 12)}>
                {cidadesIndisponivel ? (
                  <input id="rp-cidade" type="text" className="register-page__input"
                    placeholder="Digite a cidade" value={cidade}
                    onChange={(e) => { setCidade(e.target.value); limparErro('cidade'); }}
                    maxLength={80} autoComplete="address-level2" aria-invalid={!!erros.cidade} />
                ) : (
                  <>
                    <select id="rp-cidade" className="register-page__input register-page__input--select"
                      value={cidade} disabled={!estado || (carregandoCidades && !cidade)}
                      onChange={(e) => { setCidade(e.target.value); limparErro('cidade'); }}
                      aria-invalid={!!erros.cidade}>
                      <option value="" disabled>
                        {carregandoCidades ? 'Carregando...' : 'Selecione'}
                      </option>
                      {opcoesCidade.map((c) => <option key={c} value={c}>{c}</option>)}
                    </select>
                    <HiOutlineChevronDown className="register-page__chevron" aria-hidden="true" />
                  </>
                )}
              </Field>

              <Field name="endereco" label="Endereço" icon={<HiOutlineHome />}
                error={erros.endereco} layout={span(5)}>
                <input id="rp-endereco" type="text" className="register-page__input"
                  placeholder="Digite o endereço" value={endereco}
                  onChange={(e) => { setEndereco(e.target.value); limparErro('endereco'); }}
                  maxLength={150} autoComplete="address-line1" aria-invalid={!!erros.endereco} />
              </Field>

              <Field name="bairro" label="Bairro" icon={<HiOutlineHome />}
                error={erros.bairro} layout={span(4, 7, 12)}>
                <input id="rp-bairro" type="text" className="register-page__input"
                  placeholder="Digite o bairro" value={bairro}
                  onChange={(e) => { setBairro(e.target.value); limparErro('bairro'); }}
                  maxLength={80} aria-invalid={!!erros.bairro} />
              </Field>

              <Field name="numero" label="Número" icon={<HiOutlineHashtag />}
                error={erros.numero} layout={span(3, 5, 12)}>
                <input id="rp-numero" type="text" className="register-page__input"
                  placeholder="Ex: 123" value={numero}
                  onChange={(e) => { setNumero(e.target.value.replace(/[^\w/\-]/g, '')); limparErro('numero'); }}
                  maxLength={10} aria-invalid={!!erros.numero} />
              </Field>

              <div className="register-page__actions">
                <button type="submit" className="register-page__submit">
                  Próximo <HiOutlineArrowRight />
                </button>
                <p className="register-page__redirect">
                  Já possui conta?{' '}
                  <button type="button" className="register-page__link" onClick={() => navigate('/login')}>
                    Entrar
                  </button>
                </p>
              </div>
            </form>
          )}

          {/* ═══════════ ETAPA 2 — RESPONSÁVEL ═══════════ */}
          {etapa === 2 && (
            <form className="register-page__form" onSubmit={handleFinalizar} noValidate>

              <Field name="nomeCompleto" label="Nome completo (Dono do restaurante)" icon={<HiOutlineUser />}
                error={erros.nomeCompleto} layout={span(7)}>
                <input id="rp-nomeCompleto" type="text" className="register-page__input"
                  placeholder="Digite seu nome completo" value={nomeCompleto}
                  onChange={(e) => { setNomeCompleto(e.target.value); limparErro('nomeCompleto'); }}
                  maxLength={100} autoComplete="name" aria-invalid={!!erros.nomeCompleto} />
              </Field>

              <Field name="cpf" label="CPF (Dono do restaurante)" icon={<HiOutlineDocumentText />}
                error={erros.cpf} layout={span(5)}>
                <input id="rp-cpf" type="text" inputMode="numeric" className="register-page__input"
                  placeholder="000.000.000-00" value={cpf} onChange={handleCpfChange}
                  aria-invalid={!!erros.cpf} />
              </Field>

              <Field name="email" label="E-mail" icon={<HiOutlineEnvelope />}
                error={erros.email} layout={span(12)}>
                <input id="rp-email" type="email" className="register-page__input"
                  placeholder="Digite seu e-mail" value={email}
                  onChange={(e) => { setEmail(e.target.value); limparErro('email'); }}
                  maxLength={150} autoComplete="email" aria-invalid={!!erros.email} />
              </Field>

              <Field name="senha" label="Senha" icon={<HiOutlineLockClosed />}
                error={erros.senha} layout={span(6, 6, 12)}>
                <input id="rp-senha" type={showPassword ? 'text' : 'password'}
                  className="register-page__input register-page__input--toggle"
                  placeholder="Digite sua senha" value={senha}
                  onChange={(e) => { setSenha(e.target.value); limparErro('senha', 'confirmarSenha'); }}
                  maxLength={60} autoComplete="new-password" aria-invalid={!!erros.senha} />
                <button type="button" className="register-page__toggle"
                  onClick={() => setShowPassword((p) => !p)}
                  aria-label={showPassword ? 'Ocultar senha' : 'Mostrar senha'}>
                  {showPassword ? <HiOutlineEyeSlash /> : <HiOutlineEye />}
                </button>
              </Field>

              <Field name="confirmarSenha" label="Confirmar senha" icon={<HiOutlineLockClosed />}
                error={erros.confirmarSenha} layout={span(6, 6, 12)}>
                <input id="rp-confirmarSenha" type={showConfirm ? 'text' : 'password'}
                  className="register-page__input register-page__input--toggle"
                  placeholder="Confirme sua senha" value={confirmarSenha}
                  onChange={(e) => { setConfirmarSenha(e.target.value); limparErro('confirmarSenha'); }}
                  maxLength={60} autoComplete="new-password" aria-invalid={!!erros.confirmarSenha} />
                <button type="button" className="register-page__toggle"
                  onClick={() => setShowConfirm((p) => !p)}
                  aria-label={showConfirm ? 'Ocultar senha' : 'Mostrar senha'}>
                  {showConfirm ? <HiOutlineEyeSlash /> : <HiOutlineEye />}
                </button>
              </Field>

              <div className={`register-page__hint${senhaForte ? ' is-valid' : ''}`}>
                <HiOutlineShieldCheck />
                <div>
                  <p>Sua senha deve conter:</p>
                  <ul className="register-page__rules">
                    {regrasSenha.map((regra) => (
                      <li
                        key={regra.label}
                        className={regra.ok ? 'is-ok' : 'is-missing'}
                      >
                        {regra.ok ? <HiOutlineCheckCircle /> : <HiOutlineXCircle />}
                        <span>{regra.label}</span>
                        <span className="register-page__sr-only">
                          {regra.ok ? ' (atendido)' : ' (não atendido)'}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>

              {/* Termos de uso */}
              <div className="register-page__terms">
                <label>
                  <input
                    type="checkbox"
                    checked={aceitaTermos}
                    onChange={(e) => {
                      if (e.target.checked) setShowTermosModal(true);
                      else setAceitaTermos(false);
                    }}
                  />
                  <span>
                    Eu li e concordo com os{' '}
                    <button type="button" className="register-page__link" onClick={() => setShowTermosModal(true)}>
                      Termos de Uso
                    </button>{' '}
                    e com a{' '}
                    <button type="button" className="register-page__link" onClick={() => setShowTermosModal(true)}>
                      Política de Privacidade
                    </button>{' '}
                    do MenuPoint.
                  </span>
                </label>
              </div>

              <div className="register-page__actions">
                <button type="submit" className="register-page__submit"
                  disabled={carregando || redirecionandoPagamento}>
                  {redirecionandoPagamento
                    ? 'Levando você ao pagamento...'
                    : carregando
                    ? 'Criando conta...'
                    : <>Finalizar cadastro <HiOutlineCheck /></>}
                </button>
                <button type="button" className="register-page__back"
                  onClick={() => irParaEtapa(1)} disabled={carregando || redirecionandoPagamento}>
                  <HiOutlineArrowLeft /> Voltar para a etapa anterior
                </button>
              </div>
            </form>
          )}
        </main>
      </div>

      {/* ── Modal de sucesso ── */}
      {showSucesso && (
        <div className="register-page__overlay" onClick={() => setShowSucesso(false)}>
          <div className="register-page__modal" onClick={(e) => e.stopPropagation()}>
            <div className="register-page__modal-inner">
              <h2 className="register-page__modal-titulo">Cadastro realizado!</h2>
              <p className="register-page__modal-texto">
                Enviamos um código de 6 dígitos para o seu e-mail. Digite ele
                na próxima tela para confirmar sua conta.
              </p>
              <button className="register-page__modal-button" onClick={handleIrParaConfirmacao}>
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
