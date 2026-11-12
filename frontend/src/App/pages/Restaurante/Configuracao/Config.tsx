import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  HiArrowLeft,
  HiCash,
  HiCheckCircle,
  HiClipboardList,
  HiClipboard,
  HiExternalLink,
  HiClock,
  HiExclamationCircle,
  HiLocationMarker,
  HiLockClosed,
  HiLogout,
  HiMail,
  HiOfficeBuilding,
  HiPencil,
  HiPhone,
  HiShoppingBag,
  HiTrash,
  HiTruck,
  HiUpload,
  HiX,
  HiEye,
  HiEyeOff
} from 'react-icons/hi';
import RestaurantLayout from '../../../shared/components/layout/Restaurantelayout';
import { useEstabelecimento } from '../../../shared/contexts/Estabelecimentocontext';
import { useAuth } from '../../../shared/contexts/Authcontext';
import AuthService, { LoginResponse } from '../../../services/auth.service';
import EstabelecimentoService, {
  AtualizarEstabelecimentoDTO,
  AtualizarPixDTO,
  DiaSemana,
  Estabelecimento,
  HorarioFuncionamento,
  TipoChavePix,
} from '../../../services/estabelecimento.service';
import RecortadorImagem from '../../../shared/components/RecortadorImagem/RecortadorImagem';
import './Config.css';

// Constantes


// Constantes
const DIAS: { chave: DiaSemana; nome: string }[] = [
  { chave: 'segunda', nome: 'Segunda-feira' },
  { chave: 'terca', nome: 'Terça-feira' },
  { chave: 'quarta', nome: 'Quarta-feira' },
  { chave: 'quinta', nome: 'Quinta-feira' },
  { chave: 'sexta', nome: 'Sexta-feira' },
  { chave: 'sabado', nome: 'Sábado' },
  { chave: 'domingo', nome: 'Domingo' },
];

const UFS = [
  'AC', 'AL', 'AP', 'AM', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA', 'MT', 'MS', 'MG', 'PA',
  'PB', 'PR', 'PE', 'PI', 'RJ', 'RN', 'RS', 'RO', 'RR', 'SC', 'SP', 'SE', 'TO',
];

const TIPOS_PIX: { valor: TipoChavePix; rotulo: string }[] = [
  { valor: 'CNPJ', rotulo: 'CNPJ' },
  { valor: 'CPF', rotulo: 'CPF' },
  { valor: 'EMAIL', rotulo: 'E-mail' },
  { valor: 'TELEFONE', rotulo: 'Telefone' },
  { valor: 'ALEATORIA', rotulo: 'Chave aleatória' },
];

const LOGO_PADRAO = '/icons/restaurant-avatar.png';
const TAMANHO_MAX_LOGO = 20 * 1024 * 1024; // original; é reduzida antes do envio

type Erros = Partial<Record<string, string>>;

// Utilitários de máscara / conversão 

const soDigitos = (v: string) => v.replace(/\D/g, '');

function mascaraTelefone(valor: string): string {
  let d = soDigitos(valor);
  if (d.length > 11 && d.startsWith('55')) d = d.slice(2);
  d = d.slice(0, 11);
  if (d.length === 0) return '';
  if (d.length <= 2) return `(${d}`;
  if (d.length <= 6) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
  if (d.length <= 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
}

function telefoneValido(valor: string): boolean {
  let d = soDigitos(valor);
  if (d.length > 11 && d.startsWith('55')) d = d.slice(2);
  if (!/^[1-9][1-9]/.test(d)) return false;
  if (d.length === 10) return true;
  return d.length === 11 && d[2] === '9';
}

function mascaraCpf(valor: string): string {
  const d = soDigitos(valor).slice(0, 11);
  if (d.length <= 3) return d;
  if (d.length <= 6) return `${d.slice(0, 3)}.${d.slice(3)}`;
  if (d.length <= 9) return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6)}`;
  return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9)}`;
}

function mascaraCnpj(valor: string): string {
  const d = soDigitos(valor).slice(0, 14);
  if (d.length <= 2) return d;
  if (d.length <= 5) return `${d.slice(0, 2)}.${d.slice(2)}`;
  if (d.length <= 8) return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5)}`;
  if (d.length <= 12) return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8)}`;
  return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8, 12)}-${d.slice(12)}`;
}

function cpfValido(valor: string): boolean {
  const d = soDigitos(valor);
  if (d.length !== 11 || /^(\d)\1{10}$/.test(d)) return false;
  const dv = (n: number) => {
    let soma = 0;
    for (let i = 0; i < n; i++) soma += Number(d[i]) * (n + 1 - i);
    const r = (soma * 10) % 11;
    return r === 10 ? 0 : r;
  };
  return dv(9) === Number(d[9]) && dv(10) === Number(d[10]);
}

function cnpjValido(valor: string): boolean {
  const d = soDigitos(valor);
  if (d.length !== 14 || /^(\d)\1{13}$/.test(d)) return false;
  const dv = (n: number) => {
    const pesos = n === 12 ? [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2] : [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
    let soma = 0;
    for (let i = 0; i < n; i++) soma += Number(d[i]) * pesos[i];
    const r = soma % 11;
    return r < 2 ? 0 : 11 - r;
  };
  return dv(12) === Number(d[12]) && dv(13) === Number(d[13]);
}

const REGEX_UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function mascaraChavePix(tipo: TipoChavePix | '', valor: string): string {
  switch (tipo) {
    case 'CPF': return mascaraCpf(valor);
    case 'CNPJ': return mascaraCnpj(valor);
    case 'TELEFONE': return mascaraTelefone(valor);
    case 'EMAIL': return valor.replace(/\s/g, '').toLowerCase().slice(0, 77);
    case 'ALEATORIA': return valor.replace(/[^0-9a-fA-F-]/g, '').toLowerCase().slice(0, 36);
    default: return valor;
  }
}

function erroChavePix(tipo: TipoChavePix | '', valor: string): string | null {
  const v = valor.trim();
  if (!v) return null;
  if (!tipo) return 'Escolha o tipo da chave PIX.';
  switch (tipo) {
    case 'CPF': return cpfValido(v) ? null : 'CPF inválido.';
    case 'CNPJ': return cnpjValido(v) ? null : 'CNPJ inválido.';
    case 'TELEFONE': return telefoneValido(v) ? null : 'Telefone inválido. Use DDD + número.';
    case 'EMAIL': return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v) ? null : 'E-mail inválido.';
    case 'ALEATORIA': return REGEX_UUID.test(v) ? null : 'Chave aleatória inválida. Cole os 36 caracteres da chave.';
  }
}

function normalizarChavePix(tipo: TipoChavePix | '', valor: string): string {
  const v = valor.trim();
  switch (tipo) {
    case 'CPF':
    case 'CNPJ': return soDigitos(v);
    case 'TELEFONE': {
      const d = soDigitos(v);
      return `+55${d.length > 11 && d.startsWith('55') ? d.slice(2) : d}`;
    }
    case 'EMAIL':
    case 'ALEATORIA': return v.toLowerCase();
    default: return v;
  }
}

const PLACEHOLDER_PIX: Record<TipoChavePix, string> = {
  CPF: '000.000.000-00',
  CNPJ: '00.000.000/0000-00',
  EMAIL: 'voce@exemplo.com',
  TELEFONE: '(00) 00000-0000',
  ALEATORIA: 'xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx',
};

function mascaraCep(valor: string): string {
  const d = soDigitos(valor).slice(0, 8);
  return d.length > 5 ? `${d.slice(0, 5)}-${d.slice(5)}` : d;
}

// Máscara de moeda: digita só números e os 2 últimos viram centavos (R$ 1.234,56)
const MAX_DIGITOS_MOEDA = 8; // até R$ 999.999,99
const centavosParaMoeda = (centavos: number): string => {
  const c = Math.max(0, Math.round(centavos));
  const reais = String(Math.floor(c / 100)).replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  return `R$ ${reais},${String(c % 100).padStart(2, '0')}`;
};
/** Texto digitado → "R$ 12,50". Campo vazio (ou zero) apaga o texto. */
const mascaraMoeda = (texto: string): string => {
  const centavos = Number(texto.replace(/\D/g, '').slice(0, MAX_DIGITOS_MOEDA));
  return centavos > 0 ? centavosParaMoeda(centavos) : '';
};
/** "R$ 12,50" → 12.5 (campo vazio → 0) */
const moedaParaNumero = (texto: string): number => Number(texto.replace(/\D/g, '') || 0) / 100;
/** 12.5 → "R$ 12,50" (usado para preencher o campo com um valor já salvo) */
const numeroParaMoeda = (valor: number): string => centavosParaMoeda(Math.round(valor * 100));

function mensagemDeErro(err: any, padrao: string): string {
  const dados = err?.response?.data;
  if (!err?.response) {
    return err?.code === 'ECONNABORTED'
      ? 'O servidor demorou para responder. Tente novamente.'
      : 'Não foi possível conectar ao servidor.';
  }
  const primeiro = Array.isArray(dados?.errors) ? dados.errors[0]?.message : null;
  return primeiro ?? dados?.message ?? padrao;
}

//  Horários: todos os dias sempre existem; o padrão é "fechado" 

function horarioTodoFechado(): HorarioFuncionamento {
  const base = {} as HorarioFuncionamento;
  DIAS.forEach(({ chave }) => {
    base[chave] = { aberto: false, abertura: null, fechamento: null };
  });
  return base;
}

function normalizarHorario(bruto: unknown): HorarioFuncionamento {
  const horario = horarioTodoFechado();
  if (!bruto || typeof bruto !== 'object') return horario;

  DIAS.forEach(({ chave }) => {
    const dia = (bruto as Record<string, any>)[chave];
    if (dia && typeof dia === 'object') {
      horario[chave] = {
        aberto: Boolean(dia.aberto),
        abertura: typeof dia.abertura === 'string' ? dia.abertura : null,
        fechamento: typeof dia.fechamento === 'string' ? dia.fechamento : null,
      };
    }
  });
  return horario;
}

// Contato 

interface ContatoForm {
  telefone: string;
  whatsapp: string;
  email: string;
}

const CONTATO_PADRAO: ContatoForm = { telefone: '', whatsapp: '', email: '' };

const extrairContato = (e: Estabelecimento): ContatoForm => ({
  telefone: e.telefone ?? '',
  whatsapp: e.whatsapp ?? '',
  email: e.email ?? '',
});

function validarContato(v: ContatoForm): Erros {
  const erros: Erros = {};
  if (v.telefone.trim() && !telefoneValido(v.telefone)) {
    erros.telefone = 'Informe DDD + número. Ex.: (11) 3456-7890';
  }
  if (v.whatsapp.trim() && !telefoneValido(v.whatsapp)) {
    erros.whatsapp = 'Informe DDD + número. Ex.: (11) 91234-5678';
  }
  if (v.email.trim() && !/^\S+@\S+\.\S+$/.test(v.email.trim())) {
    erros.email = 'E-mail inválido.';
  }
  return erros;
}

const payloadContato = (v: ContatoForm): AtualizarEstabelecimentoDTO => ({
  telefone: v.telefone.trim(),
  whatsapp: v.whatsapp.trim(),
  email: v.email.trim(),
});

// Endereço 

interface EnderecoForm {
  rua: string;
  numero: string;
  complemento: string;
  bairro: string;
  cidade: string;
  estado: string;
  cep: string;
}

const ENDERECO_PADRAO: EnderecoForm = {
  rua: '', numero: '', complemento: '', bairro: '', cidade: '', estado: '', cep: '',
};

const extrairEndereco = (e: Estabelecimento): EnderecoForm => {
  const end = e.endereco ?? {};
  return {
    rua: end.rua ?? '',
    numero: end.numero ?? '',
    complemento: end.complemento ?? '',
    bairro: end.bairro ?? '',
    cidade: end.cidade ?? '',
    estado: end.estado ?? '',
    cep: end.cep ?? '',
  };
};

function validarEndereco(v: EnderecoForm): Erros {
  const erros: Erros = {};
  if (!v.rua.trim()) erros.rua = 'Informe a rua.';
  if (!v.numero.trim()) erros.numero = 'Informe o número.';
  if (!v.bairro.trim()) erros.bairro = 'Informe o bairro.';
  if (!v.cidade.trim()) erros.cidade = 'Informe a cidade.';
  if (!UFS.includes(v.estado)) erros.estado = 'Escolha o estado.';
  if (soDigitos(v.cep).length !== 8) erros.cep = 'CEP deve ter 8 números.';
  return erros;
}

const payloadEndereco = (v: EnderecoForm): AtualizarEstabelecimentoDTO => {
  const complemento = v.complemento.trim();
  return {
    endereco: {
      rua: v.rua.trim(),
      numero: v.numero.trim(),
      ...(complemento ? { complemento } : {}),
      bairro: v.bairro.trim(),
      cidade: v.cidade.trim(),
      estado: v.estado,
      cep: mascaraCep(v.cep),
    },
  };
};

//  Horário de funcionamento 

interface HorarioForm {
  horario: HorarioFuncionamento;
}

const HORARIO_PADRAO: HorarioForm = { horario: horarioTodoFechado() };

const extrairHorario = (e: Estabelecimento): HorarioForm => ({
  horario: normalizarHorario(e.horario_funcionamento),
});

function validarHorario(v: HorarioForm): Erros {
  const erros: Erros = {};
  DIAS.forEach(({ chave }) => {
    const dia = v.horario[chave];
    if (dia.aberto && (!dia.abertura || !dia.fechamento)) {
      erros[`horario_${chave}`] = 'Informe abertura e fechamento.';
    }
  });
  return erros;
}

const payloadHorario = (v: HorarioForm): AtualizarEstabelecimentoDTO => {
  const horario = horarioTodoFechado();
  DIAS.forEach(({ chave }) => {
    const dia = v.horario[chave];
    horario[chave] = dia.aberto
      ? { aberto: true, abertura: dia.abertura, fechamento: dia.fechamento }
      : { aberto: false, abertura: null, fechamento: null };
  });
  return { horario_funcionamento: horario };
};

//  Atendimento e entrega 

interface AtendimentoForm {
  aceita_entrega: boolean;
  aceita_retirada: boolean;
  aceita_mesa: boolean;
  tempo_entrega_min: string;
  tempo_entrega_max: string;
  taxa_entrega: string;
  pedido_minimo: string;
}

const ATENDIMENTO_PADRAO: AtendimentoForm = {
  aceita_entrega: true,
  aceita_retirada: true,
  aceita_mesa: true,
  tempo_entrega_min: '30',
  tempo_entrega_max: '60',
  taxa_entrega: 'R$ 0,00',
  pedido_minimo: 'R$ 0,00',
};

const extrairAtendimento = (e: Estabelecimento): AtendimentoForm => ({
  aceita_entrega: e.aceita_entrega,
  aceita_retirada: e.aceita_retirada,
  aceita_mesa: true,
  tempo_entrega_min: String(e.tempo_entrega_min ?? 30),
  tempo_entrega_max: String(e.tempo_entrega_max ?? 60),
  taxa_entrega: numeroParaMoeda(Number(e.taxa_entrega ?? 0)),
  pedido_minimo: numeroParaMoeda(Number(e.pedido_minimo ?? 0)),
});

function validarAtendimento(v: AtendimentoForm): Erros {
  const erros: Erros = {};
  const min = Number(v.tempo_entrega_min);
  const max = Number(v.tempo_entrega_max);
  if (!Number.isInteger(min) || min < 1) erros.tempo = 'Tempo mínimo inválido.';
  else if (!Number.isInteger(max) || max < min) {
    erros.tempo = 'O tempo máximo deve ser maior ou igual ao mínimo.';
  }
  const taxa = moedaParaNumero(v.taxa_entrega);
  if (!Number.isFinite(taxa) || taxa < 0) erros.taxa_entrega = 'Valor inválido.';
  const minimo = moedaParaNumero(v.pedido_minimo);
  if (!Number.isFinite(minimo) || minimo < 0) erros.pedido_minimo = 'Valor inválido.';
  return erros;
}

const payloadAtendimento = (v: AtendimentoForm): AtualizarEstabelecimentoDTO => ({
  aceita_entrega: v.aceita_entrega,
  aceita_retirada: v.aceita_retirada,
  aceita_mesa: true,
  tempo_entrega_min: Number(v.tempo_entrega_min),
  tempo_entrega_max: Number(v.tempo_entrega_max),
  taxa_entrega: moedaParaNumero(v.taxa_entrega),
  pedido_minimo: moedaParaNumero(v.pedido_minimo),
});

// Divulgação (tipo de cozinha + link do cardápio) 

const TIPOS_COZINHA = [
  'Pizzaria',
  'Hamburgueria',
  'Lanchonete',
  'Churrascaria',
  'Brasileira',
  'Marmitaria',
  'Italiana',
  'Japonesa',
  'Chinesa',
  'Árabe',
  'Mexicana',
  'Frutos do mar',
  'Pastelaria',
  'Padaria e café',
  'Açaí e sorvetes',
  'Doces e confeitaria',
  'Saudável e vegetariana',
  'Bar e petiscos',
];
const OUTROS = '__outros__';

interface DivulgacaoForm {
  tipo_cozinha: string; // item de TIPOS_COZINHA, OUTROS ou ''
  tipo_cozinha_outro: string;
}

const DIVULGACAO_PADRAO: DivulgacaoForm = { tipo_cozinha: '', tipo_cozinha_outro: '' };

const extrairDivulgacao = (e: Estabelecimento): DivulgacaoForm => {
  const atual = (e.tipo_cozinha ?? '').trim();
  if (!atual) return DIVULGACAO_PADRAO;
  if (TIPOS_COZINHA.includes(atual)) return { tipo_cozinha: atual, tipo_cozinha_outro: '' };
  // Valor que não está na lista = foi digitado em "Outros"
  return { tipo_cozinha: OUTROS, tipo_cozinha_outro: atual };
};

function validarDivulgacao(v: DivulgacaoForm): Erros {
  const erros: Erros = {};
  if (v.tipo_cozinha === OUTROS) {
    const texto = v.tipo_cozinha_outro.trim();
    if (!texto) erros.tipo_cozinha_outro = 'Digite o tipo de cozinha.';
    else if (texto.length > 60) erros.tipo_cozinha_outro = 'Use no máximo 60 caracteres.';
  }
  return erros;
}

const payloadDivulgacao = (v: DivulgacaoForm): AtualizarEstabelecimentoDTO => ({
  tipo_cozinha: v.tipo_cozinha === OUTROS ? v.tipo_cozinha_outro.trim() : v.tipo_cozinha,
});

// PIX 

interface PixForm {
  tipo_chave_pix: TipoChavePix | '';
  chave_pix: string;
}

const PIX_PADRAO: PixForm = { tipo_chave_pix: '', chave_pix: '' };

const extrairPix = (e: Estabelecimento): PixForm => ({
  tipo_chave_pix: e.tipo_chave_pix ?? '',
  chave_pix: mascaraChavePix(e.tipo_chave_pix ?? '', e.chave_pix ?? ''),
});

function validarPix(v: PixForm): Erros {
  const erros: Erros = {};
  const erro = erroChavePix(v.tipo_chave_pix, v.chave_pix);
  if (erro) erros.chave_pix = erro;
  return erros;
}

// Hook: uma seção completa (valor, validação, salvar, descartar)


// Hook:seção completa (valor, validação, salvar, descartar)
interface Secao<T> {
  valor: T;
  definir: <K extends keyof T>(campo: K, valor: T[K]) => void;
  erros: Erros;
  limparErro: (chave: string) => void;
  definirErro: (chave: string, mensagem: string) => void;
  alterado: boolean;
  salvando: boolean;
  salvoRecente: boolean;
  erroGeral: string | null;
  salvar: () => Promise<boolean>;
  descartar: () => void;
}

function useSecao<T>(
  estab: Estabelecimento | null,
  valorPadrao: T,
  extrair: (e: Estabelecimento) => T,
  validar: (v: T) => Erros,
  construirPayload: (v: T) => AtualizarEstabelecimentoDTO,
  aoSalvar: (payload: AtualizarEstabelecimentoDTO) => void
): Secao<T> {
  const [valor, setValor] = useState<T>(valorPadrao);
  const [baseline, setBaseline] = useState<T>(valorPadrao);
  const [erros, setErros] = useState<Erros>({});
  const [salvando, setSalvando] = useState(false);
  const [salvoRecente, setSalvoRecente] = useState(false);
  const [erroGeral, setErroGeral] = useState<string | null>(null);
  const hidratadoId = useRef<string | null>(null);
  const estabIdRef = useRef<string | null>(null);

  useEffect(() => {
    if (!estab) return;
    estabIdRef.current = estab.id;
    if (hidratadoId.current === estab.id) return;
    hidratadoId.current = estab.id;
    const v = extrair(estab);
    setValor(v);
    setBaseline(v);
    setErros({});
    setErroGeral(null);
    setSalvoRecente(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [estab]);

  const alterado = useMemo(() => JSON.stringify(valor) !== JSON.stringify(baseline), [valor, baseline]);

  const definir = <K extends keyof T>(campo: K, v: T[K]) => {
    setValor((atual) => ({ ...atual, [campo]: v }));
    if (erroGeral) setErroGeral(null);
    if (salvoRecente) setSalvoRecente(false);
  };

  const limparErro = (chave: string) =>
    setErros((atual) => (atual[chave] ? { ...atual, [chave]: undefined } : atual));

  const definirErro = (chave: string, mensagem: string) =>
    setErros((atual) => ({ ...atual, [chave]: mensagem }));

  const descartar = () => {
    setValor(baseline);
    setErros({});
    setErroGeral(null);
  };

  const salvar = async (): Promise<boolean> => {
    const id = estabIdRef.current;
    if (!id) return false;

    const encontrados = validar(valor);
    setErros(encontrados);
    if (Object.keys(encontrados).length > 0) return false;

    setSalvando(true);
    setErroGeral(null);
    try {
      const payload = construirPayload(valor);
      await EstabelecimentoService.atualizar(id, payload);
      setBaseline(valor);
      aoSalvar(payload);
      setSalvoRecente(true);
      window.setTimeout(() => setSalvoRecente(false), 2500);
      return true;
    } catch (err: any) {
      setErroGeral(mensagemDeErro(err, 'Não foi possível salvar.'));
      return false;
    } finally {
      setSalvando(false);
    }
  };

  return { valor, definir, erros, limparErro, definirErro, alterado, salvando, salvoRecente, erroGeral, salvar, descartar };
}

// PIX: hook dedicado, sem salvar automático

interface ResultadoPix {
  ok: boolean;
  mensagem?: string;
}

function usePix(estab: Estabelecimento | null) {
  const [valor, setValor] = useState<PixForm>(PIX_PADRAO);
  const [baseline, setBaseline] = useState<PixForm>(PIX_PADRAO);
  const [erros, setErros] = useState<Erros>({});
  const [salvando, setSalvando] = useState(false);
  const [salvoRecente, setSalvoRecente] = useState(false);
  const [erroGeral, setErroGeral] = useState<string | null>(null);
  const hidratadoId = useRef<string | null>(null);

  useEffect(() => {
    if (!estab) return;
    if (hidratadoId.current === estab.id) return;
    hidratadoId.current = estab.id;
    const v = extrairPix(estab);
    setValor(v);
    setBaseline(v);
    setErros({});
    setErroGeral(null);
    setSalvoRecente(false);
  }, [estab]);

  const alterado = useMemo(() => JSON.stringify(valor) !== JSON.stringify(baseline), [valor, baseline]);

  const definir = <K extends keyof PixForm>(campo: K, v: PixForm[K]) => {
    setValor((atual) => {
      if (campo === 'tipo_chave_pix') return { tipo_chave_pix: v as PixForm['tipo_chave_pix'], chave_pix: '' };
      return { ...atual, chave_pix: mascaraChavePix(atual.tipo_chave_pix, String(v)) };
    });
    setErros({});
    if (erroGeral) setErroGeral(null);
    if (salvoRecente) setSalvoRecente(false);
  };

  const preencher = (tipo: TipoChavePix, chave: string) => {
    setValor({ tipo_chave_pix: tipo, chave_pix: mascaraChavePix(tipo, chave) });
    setErros({});
    if (erroGeral) setErroGeral(null);
    if (salvoRecente) setSalvoRecente(false);
  };

  const descartar = () => {
    setValor(baseline);
    setErros({});
    setErroGeral(null);
  };

  // Só valida o formato (tipo + chave); não salva nada ainda.
  const validar = (): boolean => {
    const encontrados = validarPix(valor);
    setErros(encontrados);
    return Object.keys(encontrados).length === 0;
  };

  // Chamada pelo modal de senha, já com a senha em mãos.
  const confirmarComSenha = async (id: string, senhaAtual: string): Promise<ResultadoPix> => {
    setSalvando(true);
    setErroGeral(null);
    try {
      const chave = normalizarChavePix(valor.tipo_chave_pix, valor.chave_pix);
      const payload: AtualizarPixDTO = {
        senha_atual: senhaAtual,
        chave_pix: chave ? chave : null,
        tipo_chave_pix: chave && valor.tipo_chave_pix ? valor.tipo_chave_pix : null,
      };
      const atualizado = await EstabelecimentoService.atualizarPix(id, payload);
      const novoValor = extrairPix(atualizado);
      setValor(novoValor);
      setBaseline(novoValor);
      setSalvoRecente(true);
      window.setTimeout(() => setSalvoRecente(false), 2500);
      return { ok: true };
    } catch (err: any) {
      const mensagem = mensagemDeErro(err, 'Não foi possível salvar a chave PIX.');
      if (err?.response?.status === 403 && /senha/i.test(err?.response?.data?.message ?? '')) {
        return { ok: false, mensagem: 'Senha incorreta.' };
      }
      setErroGeral(mensagem);
      return { ok: false, mensagem };
    } finally {
      setSalvando(false);
    }
  };

  const temChave = baseline.chave_pix.trim() !== '';

  return { valor, temChave, definir, erros, alterado, salvando, salvoRecente, erroGeral, validar, preencher, confirmarComSenha, descartar };
}

// Peças de interface

interface CampoProps {
  id: string;
  rotulo: string;
  erro?: string;
  dica?: string;
  bloqueado?: boolean;
  className?: string;
  children: React.ReactNode;
}

const Campo: React.FC<CampoProps> = ({ id, rotulo, erro, dica, bloqueado, className, children }) => (
  <div className={`config__campo ${className ?? ''}`}>
    <label className="config__label" htmlFor={id}>
      {rotulo}
      {bloqueado && <HiLockClosed className="config__cadeado" aria-label="Campo bloqueado" />}
    </label>
    {children}
    {erro ? (
      <p className="config__erro" role="alert">{erro}</p>
    ) : dica ? (
      <p className="config__hint">{dica}</p>
    ) : null}
  </div>
);

const Bloqueado: React.FC<{ id: string; rotulo: string; valor: string | null | undefined; className?: string }> = ({
  id,
  rotulo,
  valor,
  className,
}) => (
  <Campo id={id} rotulo={rotulo} bloqueado className={className}>
    <input
      id={id}
      className="config__input config__input--bloqueado"
      value={valor && valor.trim() ? valor : '—'}
      readOnly
      aria-readonly="true"
    />
  </Campo>
);

// Cartão de opção clicável

const CartaoOpcao: React.FC<{
  id: string;
  rotulo: string;
  icone: React.ReactNode;
  marcado: boolean;
  desabilitado: boolean;
  onChange: (v: boolean) => void;
}> = ({ id, rotulo, icone, marcado, desabilitado, onChange }) => (
  <button
    id={id}
    type="button"
    className={`config__cartao-opcao ${marcado ? 'config__cartao-opcao--ativo' : ''}`}
    disabled={desabilitado}
    aria-pressed={marcado}
    onClick={() => onChange(!marcado)}
  >
    <span className="config__cartao-opcao-icone">{icone}</span>
    <span className="config__cartao-opcao-rotulo">{rotulo}</span>
    <span className={`config__pill ${marcado ? 'config__pill--ativo' : 'config__pill--inativo'}`}>
      {marcado ? 'Ativo' : 'Inativo'}
    </span>
  </button>
);

// Selo de status no canto do card.
const SecaoStatus: React.FC<{ alterado: boolean; salvando: boolean; salvoRecente: boolean; comErro: boolean }> = ({
  alterado,
  salvando,
  salvoRecente,
  comErro,
}) => {
  if (comErro) {
    return <span className="config__secao-status config__secao-status--erro">Não salvo</span>;
  }
  if (salvando) {
    return <span className="config__secao-status config__secao-status--salvando">Salvando…</span>;
  }
  if (salvoRecente) {
    return (
      <span className="config__secao-status config__secao-status--ok">
        <HiCheckCircle /> Salvo
      </span>
    );
  }
  if (alterado) {
    return <span className="config__secao-status config__secao-status--pendente">Alterações não salvas</span>;
  }
  return null;
};

const SecaoCabecalho: React.FC<{
  titulo: string;
  id: string;
  secao: Pick<Secao<unknown>, 'alterado' | 'salvando' | 'salvoRecente' | 'erroGeral' | 'salvar' | 'descartar'>;
  podeEditar: boolean;
  icone?: React.ReactNode;
  // Seções "travadas": campos cinzas até clicar em Alterar
  editando?: boolean;
  aoAlterar?: () => void;
  aoCancelar?: () => void;
  aoSalvar?: () => void;
}> = ({ titulo, id, secao, podeEditar, icone, editando, aoAlterar, aoCancelar, aoSalvar }) => (
  <div className="config__card-cabecalho">
    <h3 className="config__card-titulo" id={id}>
      {icone && <span className="config__card-titulo-icone">{icone}</span>}
      {titulo}
    </h3>
    {podeEditar && (
      <div className="config__secao-controles">
        <SecaoStatus
          alterado={secao.alterado}
          salvando={secao.salvando}
          salvoRecente={secao.salvoRecente}
          comErro={Boolean(secao.erroGeral)}
        />
        {aoAlterar && !editando && (
          <div className="config__secao-acoes">
            <button className="config__btn config__btn--pequeno" type="button" onClick={aoAlterar}>
              <HiPencil aria-hidden="true" /> Alterar
            </button>
          </div>
        )}
        {aoAlterar && editando && (
          <div className="config__secao-acoes">
            <button className="config__btn config__btn--pequeno" type="button" onClick={aoCancelar} disabled={secao.salvando}>
              {secao.alterado ? 'Descartar' : 'Cancelar'}
            </button>
            <button
              className="config__btn config__btn--primario config__btn--pequeno"
              type="button"
              onClick={aoSalvar}
              disabled={secao.salvando}
            >
              {secao.salvando ? 'Salvando…' : 'Salvar'}
            </button>
          </div>
        )}
        {!aoAlterar && secao.alterado && (
          <div className="config__secao-acoes">
            <button
              className="config__btn config__btn--pequeno"
              type="button"
              onClick={secao.descartar}
              disabled={secao.salvando}
            >
              Descartar
            </button>
            <button
              className="config__btn config__btn--primario config__btn--pequeno"
              type="button"
              onClick={() => void secao.salvar()}
              disabled={secao.salvando}
            >
              {secao.salvando ? 'Salvando…' : 'Salvar'}
            </button>
          </div>
        )}
      </div>
    )}
  </div>
);

const Dialogo: React.FC<{
  titulo: string;
  onFechar: () => void;
  fecharComEsc?: boolean;
  children: React.ReactNode;
}> = ({ titulo, onFechar, fecharComEsc = true, children }) => {
  const caixa = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const anterior = document.activeElement as HTMLElement | null;
    const primeiro = caixa.current?.querySelector<HTMLElement>('input, select, button');
    primeiro?.focus();

    const teclas = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && fecharComEsc) onFechar();
    };
    document.addEventListener('keydown', teclas);
    return () => {
      document.removeEventListener('keydown', teclas);
      anterior?.focus?.();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="config__overlay" onMouseDown={(e) => e.target === e.currentTarget && fecharComEsc && onFechar()}>
      <div className="config__dialogo" role="dialog" aria-modal="true" aria-label={titulo} ref={caixa}>
        {children}
      </div>
    </div>
  );
};

// Alterar dados sensíveis (exige a senha)

interface DadosSensiveis {
  nome_empresa: string;
  razao_social: string;
  nome_responsavel: string;
  email: string;
}

type PassoDadosSensiveis = 'senha' | 'editar' | 'codigo';

const PassoSenha: React.FC<{
  onConfirmar: (senha: string) => Promise<string | null>;
  onFechar: () => void;
}> = ({ onConfirmar, onFechar }) => {
  const [senha, setSenha] = useState('');
  const [mostrarSenha, setMostrarSenha] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [chacoalhar, setChacoalhar] = useState(false);
  const [verificando, setVerificando] = useState(false);
  const campoRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    campoRef.current?.focus();
  }, []);

  const dispararErro = (mensagem: string) => {
    setErro(mensagem);
    setChacoalhar(true);
    window.setTimeout(() => setChacoalhar(false), 400);
    campoRef.current?.focus();
    campoRef.current?.select();
  };

  const confirmar = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!senha) {
      dispararErro('Digite sua senha para continuar.');
      return;
    }
    setVerificando(true);
    setErro(null);
    const mensagem = await onConfirmar(senha);
    setVerificando(false);
    if (mensagem) dispararErro(mensagem);
  };

  return (
    <form className="config__dialogo-form" onSubmit={confirmar} noValidate>
      <div className="config__dialogo-topo">
        <div className="config__dialogo-icone">
          <HiLockClosed />
        </div>
        <button className="config__dialogo-x" type="button" onClick={onFechar} aria-label="Fechar" disabled={verificando}>
          <HiX />
        </button>
      </div>

      <h3 className="config__card-titulo">Confirme sua senha</h3>
      <p className="config__hint">
        Para alterar dados como e-mail de acesso e razão social, primeiro confirme que é você.
      </p>

      <Campo
        id="m-senha"
        rotulo="Sua senha atual"
        erro={erro ?? undefined}
        className={chacoalhar ? 'config__campo--chacoalha' : undefined}
      >
        <div className="config__campo-senha">
          <input
            id="m-senha"
            ref={campoRef}
            maxLength={60}
            className="config__input"
            type={mostrarSenha ? 'text' : 'password'}
            autoComplete="current-password"
            value={senha}
            disabled={verificando}
            onChange={(e) => {
              setSenha(e.target.value);
              setErro(null);
            }}
          />
          <button
            type="button"
            className="config__campo-senha-olho"
            onClick={() => setMostrarSenha((v) => !v)}
            disabled={verificando}
            aria-label={mostrarSenha ? 'Ocultar senha' : 'Mostrar senha'}
            tabIndex={-1}
          >
            {mostrarSenha ? <HiEyeOff /> : <HiEye />}
          </button>
        </div>
      </Campo>

      <div className="config__acoes config__acoes--modal">
        <button className="config__btn config__btn--primario config__btn--bloco" type="submit" disabled={verificando}>
          {verificando ? 'Verificando…' : 'Confirmar senha'}
        </button>
        <button className="config__btn config__btn--fantasma" type="button" onClick={onFechar} disabled={verificando}>
          Cancelar
        </button>
      </div>
    </form>
  );
};

const PassoEditar: React.FC<{
  atuais: DadosSensiveis;
  podeEmpresa: boolean;
  senha: string;
  onVoltar: () => void;
  onFechar: () => void;
  // token = sessão nova se algum dado (além do e-mail) foi salvo; emailPendente = e-mail novo
  // que está aguardando o código de confirmação (o e-mail atual continua valendo até lá)
  onSucesso: (novos: DadosSensiveis, token: string | null, emailPendente: string | null) => void;
}> = ({ atuais, podeEmpresa, senha, onVoltar, onFechar, onSucesso }) => {
  const [campos, setCampos] = useState<DadosSensiveis>(atuais);
  const [erros, setErros] = useState<Erros>({});
  const [erroGeral, setErroGeral] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  const primeiroCampoRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    primeiroCampoRef.current?.focus();
  }, []);

  const definirCampo = (campo: keyof DadosSensiveis, valor: string) => {
    setCampos((c) => ({ ...c, [campo]: valor }));
    setErros((e) => ({ ...e, [campo]: undefined }));
    setErroGeral(null);
  };

  const confirmar = async (e: React.FormEvent) => {
    e.preventDefault();

    const novos: DadosSensiveis = {
      nome_empresa: campos.nome_empresa.trim(),
      razao_social: campos.razao_social.trim(),
      nome_responsavel: campos.nome_responsavel.trim(),
      email: campos.email.trim().toLowerCase(),
    };

    const encontrados: Erros = {};
    if (podeEmpresa && novos.nome_empresa.length < 2) encontrados.nome_empresa = 'Informe o nome da empresa.';
    if (podeEmpresa && novos.razao_social.length < 3) encontrados.razao_social = 'Informe a razão social.';
    if (novos.nome_responsavel.length < 3) encontrados.nome_responsavel = 'Informe o nome completo.';
    if (!/^\S+@\S+\.\S+$/.test(novos.email)) encontrados.email = 'E-mail inválido.';

    const mudou: Partial<DadosSensiveis> = {};
    (Object.keys(novos) as (keyof DadosSensiveis)[]).forEach((k) => {
      const ehEmpresa = k === 'nome_empresa' || k === 'razao_social';
      if (ehEmpresa && !podeEmpresa) return;
      if (novos[k] !== atuais[k].trim() && !(k === 'email' && novos.email === atuais.email.toLowerCase())) {
        mudou[k] = novos[k];
      }
    });

    if (Object.keys(encontrados).length === 0 && Object.keys(mudou).length === 0) {
      setErroGeral('Você não alterou nenhum dado.');
      return;
    }
    if (Object.keys(encontrados).length > 0) {
      setErros(encontrados);
      return;
    }

    const { email: emailNovo, ...outros } = mudou;
    const temOutros = Object.keys(outros).length > 0;

    setEnviando(true);
    setErroGeral(null);
    let fase: 'email' | 'dados' = 'email';
    try {
      if (emailNovo !== undefined) {
        await AuthService.solicitarAlteracaoEmail({ novo_email: emailNovo, senha });
      }
      fase = 'dados';
      let token: string | null = null;
      if (temOutros) {
        const resultado = await AuthService.atualizarDadosSensiveis({ senha_atual: senha, ...outros });
        token = resultado.token;
      }
      onSucesso({ ...atuais, ...outros }, token, emailNovo ?? null);
    } catch (err: any) {
      const status = err?.response?.status;
      if (status === 403 && /senha/i.test(err?.response?.data?.message ?? '')) {
        setErroGeral('Sua senha não pôde ser confirmada. Volte e digite a senha de novo.');
      } else if (fase === 'email' && (status === 400 || status === 409)) {
        setErros({ email: mensagemDeErro(err, 'Não foi possível usar este e-mail.') });
      } else {
        setErroGeral(mensagemDeErro(err, 'Não foi possível alterar os dados.'));
      }
    } finally {
      setEnviando(false);
    }
  };

  const emailMudou = campos.email.trim().toLowerCase() !== atuais.email.trim().toLowerCase();

  return (
    <form className="config__dialogo-form" onSubmit={confirmar} noValidate>
      <div className="config__dialogo-topo">
        <button className="config__dialogo-voltar" type="button" onClick={onVoltar} disabled={enviando} aria-label="Voltar">
          <HiArrowLeft />
        </button>
        <span className="config__dialogo-selo-ok">
          <HiCheckCircle /> Senha confirmada
        </span>
        <button className="config__dialogo-x" type="button" onClick={onFechar} aria-label="Fechar" disabled={enviando}>
          <HiX />
        </button>
      </div>

      <h3 className="config__card-titulo">Alterar dados da empresa</h3>
      <p className="config__hint">
        Altere apenas o que precisa. É este mesmo formulário que atualiza o nome exibido no topo da tela.
      </p>

      <Campo
        id="m-empresa"
        rotulo="Nome da empresa"
        erro={erros.nome_empresa}
        bloqueado={!podeEmpresa}
        dica={!podeEmpresa ? 'Somente administradores podem alterar.' : 'Este é o nome mostrado no cabeçalho do seu perfil.'}
      >
        <input
          id="m-empresa"
          ref={podeEmpresa ? primeiroCampoRef : undefined}
          className={`config__input ${!podeEmpresa ? 'config__input--bloqueado' : ''}`}
          value={campos.nome_empresa}
          maxLength={150}
          disabled={!podeEmpresa || enviando}
          aria-readonly={!podeEmpresa}
          onChange={(e) => definirCampo('nome_empresa', e.target.value)}
        />
      </Campo>
      <Campo
        id="m-razao"
        rotulo="Razão social"
        erro={erros.razao_social}
        bloqueado={!podeEmpresa}
        dica={!podeEmpresa ? 'Somente administradores podem alterar.' : undefined}
      >
        <input
          id="m-razao"
          className={`config__input ${!podeEmpresa ? 'config__input--bloqueado' : ''}`}
          value={campos.razao_social}
          maxLength={200}
          disabled={!podeEmpresa || enviando}
          aria-readonly={!podeEmpresa}
          onChange={(e) => definirCampo('razao_social', e.target.value)}
        />
      </Campo>
      <Campo id="m-resp" rotulo="Nome do responsável" erro={erros.nome_responsavel}>
        <input
          id="m-resp"
          ref={!podeEmpresa ? primeiroCampoRef : undefined}
          className="config__input"
          value={campos.nome_responsavel}
          maxLength={100}
          disabled={enviando}
          onChange={(e) => definirCampo('nome_responsavel', e.target.value)}
        />
      </Campo>
      <Campo
        id="m-email"
        rotulo="E-mail de acesso"
        erro={erros.email}
        dica="Se mudar o e-mail, enviaremos um código para o novo endereço. O atual continua valendo até você confirmar."
      >
        <input
          id="m-email"
          maxLength={150}
          className="config__input"
          type="email"
          value={campos.email}
          disabled={enviando}
          onChange={(e) => definirCampo('email', e.target.value)}
        />
      </Campo>

      {erroGeral && <p className="config__erro" role="alert">{erroGeral}</p>}

      <div className="config__acoes config__acoes--fim">
        <button className="config__btn" type="button" onClick={onFechar} disabled={enviando}>
          Cancelar
        </button>
        <button className="config__btn config__btn--primario" type="submit" disabled={enviando}>
          {enviando ? 'Salvando…' : emailMudou ? 'Salvar e confirmar e-mail' : 'Salvar alterações'}
        </button>
      </div>
    </form>
  );
};

// confirmar o e-mail novo com o código 
const ESPERA_REENVIO_SEGUNDOS = 30;
const TAMANHO_CODIGO = 6;

const PassoCodigo: React.FC<{
  email: string;
  senha: string;
  onConfirmado: (sessao: LoginResponse) => void;
  onFechar: () => void;
}> = ({ email, senha, onConfirmado, onFechar }) => {
  const [digitos, setDigitos] = useState<string[]>(() => Array(TAMANHO_CODIGO).fill(''));
  const [erro, setErro] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [chacoalhar, setChacoalhar] = useState(false);
  const [confirmando, setConfirmando] = useState(false);
  const [reenviando, setReenviando] = useState(false);
  const [espera, setEspera] = useState(ESPERA_REENVIO_SEGUNDOS);
  const caixas = useRef<Array<HTMLInputElement | null>>([]);

  const codigo = digitos.join('');
  const completo = codigo.length === TAMANHO_CODIGO;
  const ocupado = confirmando || reenviando;

  useEffect(() => {
    caixas.current[0]?.focus();
  }, []);

  useEffect(() => {
    if (espera <= 0) return;
    const id = window.setTimeout(() => setEspera((e) => e - 1), 1000);
    return () => window.clearTimeout(id);
  }, [espera]);

  const limpar = () => {
    setDigitos(Array(TAMANHO_CODIGO).fill(''));
    caixas.current[0]?.focus();
  };

  const mostrarErro = (mensagem: string) => {
    setErro(mensagem);
    setChacoalhar(true);
    window.setTimeout(() => setChacoalhar(false), 400);
  };

  // Preenche a partir da caixa `inicio`
  const preencher = (texto: string, inicio: number) => {
    const novos = texto.replace(/\D/g, '').slice(0, TAMANHO_CODIGO - inicio).split('');
    if (novos.length === 0) return;
    setDigitos((atual) => {
      const copia = [...atual];
      novos.forEach((d, i) => {
        copia[inicio + i] = d;
      });
      return copia;
    });
    caixas.current[Math.min(inicio + novos.length, TAMANHO_CODIGO - 1)]?.focus();
    setErro(null);
    setAviso(null);
  };

  const aoDigitar = (valor: string, i: number) => {
    const so = valor.replace(/\D/g, '');
    if (so === '') {
      // apagou o conteúdo da caixa
      setDigitos((atual) => atual.map((d, k) => (k === i ? '' : d)));
      return;
    }
    // código inteiro de uma vez (autofill do celular) ou um dígito novo por cima de outro
    if (so.length >= TAMANHO_CODIGO) preencher(so, 0);
    else preencher(so.slice(-1), i);
  };

  const aoTeclar = (e: React.KeyboardEvent<HTMLInputElement>, i: number) => {
    if (e.key === 'Backspace' && digitos[i] === '' && i > 0) {
      e.preventDefault();
      setDigitos((atual) => atual.map((d, k) => (k === i - 1 ? '' : d)));
      caixas.current[i - 1]?.focus();
    } else if (e.key === 'ArrowLeft' && i > 0) {
      e.preventDefault();
      caixas.current[i - 1]?.focus();
    } else if (e.key === 'ArrowRight' && i < TAMANHO_CODIGO - 1) {
      e.preventDefault();
      caixas.current[i + 1]?.focus();
    }
  };

  const aoColar = (e: React.ClipboardEvent<HTMLInputElement>, i: number) => {
    e.preventDefault();
    const texto = e.clipboardData.getData('text');
    preencher(texto, texto.replace(/\D/g, '').length >= TAMANHO_CODIGO ? 0 : i);
  };

  const confirmar = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!completo) {
      mostrarErro('Digite os 6 dígitos do código.');
      return;
    }
    setConfirmando(true);
    setErro(null);
    setAviso(null);
    try {
      const sessao = await AuthService.confirmarAlteracaoEmail(codigo);
      onConfirmado(sessao);
    } catch (err: any) {
      mostrarErro(mensagemDeErro(err, 'Não foi possível confirmar o código.'));
      limpar();
    } finally {
      setConfirmando(false);
    }
  };

  const reenviar = async () => {
    setReenviando(true);
    setErro(null);
    setAviso(null);
    try {
      await AuthService.solicitarAlteracaoEmail({ novo_email: email, senha });
      limpar();
      setEspera(ESPERA_REENVIO_SEGUNDOS);
      setAviso('Enviamos um novo código. O anterior deixou de valer.');
    } catch (err: any) {
      mostrarErro(mensagemDeErro(err, 'Não foi possível reenviar o código.'));
    } finally {
      setReenviando(false);
    }
  };

  return (
    <form className="config__dialogo-form" onSubmit={confirmar} noValidate>
      <div className="config__dialogo-topo">
        <div className="config__dialogo-icone">
          <HiMail />
        </div>
        <button className="config__dialogo-x" type="button" onClick={onFechar} aria-label="Fechar" disabled={ocupado}>
          <HiX />
        </button>
      </div>

      <div className="config__dialogo-cabeca">
        <h3 className="config__card-titulo">Confirme o novo e-mail</h3>
        <p className="config__dialogo-texto">
          Enviamos um código de 6 dígitos para <strong className="config__email-chip">{email}</strong>.
          Seu e-mail atual continua valendo até você confirmar.
        </p>
      </div>

      <div className="config__campo">
        <span className="config__label" id="m-codigo-rotulo">Código de confirmação</span>
        <div
          className={`config__otp ${erro ? 'config__otp--erro' : ''} ${chacoalhar ? 'config__otp--chacoalha' : ''}`}
          role="group"
          aria-labelledby="m-codigo-rotulo"
        >
          {digitos.map((d, i) => (
            <input
              key={i}
              ref={(el) => {
                caixas.current[i] = el;
              }}
              className={`config__otp-campo ${d ? 'config__otp-campo--cheio' : ''}`}
              type="text"
              inputMode="numeric"
              autoComplete={i === 0 ? 'one-time-code' : 'off'}
              aria-label={`Dígito ${i + 1} de ${TAMANHO_CODIGO}`}
              value={d}
              disabled={confirmando}
              onChange={(e) => aoDigitar(e.target.value, i)}
              onKeyDown={(e) => aoTeclar(e, i)}
              onPaste={(e) => aoColar(e, i)}
              onFocus={(e) => e.target.select()}
            />
          ))}
        </div>
        {erro && <p className="config__erro" role="alert">{erro}</p>}
        {aviso && !erro && (
          <p className="config__hint config__hint--ok" role="status">
            <HiCheckCircle /> {aviso}
          </p>
        )}
      </div>

      <div className="config__acoes config__acoes--modal">
        <button
          className="config__btn config__btn--primario config__btn--bloco"
          type="submit"
          disabled={ocupado || !completo}
        >
          {confirmando ? 'Confirmando…' : 'Confirmar novo e-mail'}
        </button>
        <div className="config__acoes-sec">
          <button
            className="config__link-btn"
            type="button"
            onClick={reenviar}
            disabled={ocupado || espera > 0}
          >
            {reenviando ? 'Reenviando…' : espera > 0 ? `Reenviar código em ${espera}s` : 'Reenviar código'}
          </button>
          <button className="config__link-btn config__link-btn--neutro" type="button" onClick={onFechar} disabled={ocupado}>
            Cancelar troca
          </button>
        </div>
      </div>
    </form>
  );
};

const ModalDadosSensiveis: React.FC<{
  atuais: DadosSensiveis;
  podeEmpresa: boolean;
  onFechar: () => void;
  // Dados salvos (sem e-mail). fechar=false quando ainda falta confirmar o e-mail novo.
  onSucesso: (novos: DadosSensiveis, token: string, fechar: boolean) => void;
  // E-mail trocado depois de confirmar o código: chega uma sessão nova
  onEmailConfirmado: (sessao: LoginResponse) => void;
}> = ({ atuais, podeEmpresa, onFechar, onSucesso, onEmailConfirmado }) => {
  const [passo, setPasso] = useState<PassoDadosSensiveis>('senha');
  const [senhaConfirmada, setSenhaConfirmada] = useState('');
  const [emailPendente, setEmailPendente] = useState('');

  const aoSalvarDados = (novos: DadosSensiveis, token: string | null, email: string | null) => {
    if (token) onSucesso(novos, token, email === null);
    if (email !== null) {
      setEmailPendente(email);
      setPasso('codigo');
    }
  };

  const verificarSenha = async (senha: string): Promise<string | null> => {
    try {
      await AuthService.verificarSenha({ senha });
      setSenhaConfirmada(senha);
      setPasso('editar');
      return null;
    } catch (err: any) {
      if (err?.response?.status === 403) return 'Senha incorreta.';
      return mensagemDeErro(err, 'Não foi possível verificar a senha.');
    }
  };

  return (
    <Dialogo titulo="Alterar dados da empresa e do responsável" onFechar={onFechar}>
      <div className="config__dialogo-passos" aria-hidden="true">
        {(['senha', 'editar', ...(passo === 'codigo' ? ['codigo'] : [])] as PassoDadosSensiveis[]).map(
          (id, i, lista) => {
            const atual = lista.indexOf(passo);
            const rotulo = id === 'senha' ? 'Senha' : id === 'editar' ? 'Dados' : 'Código';
            return (
              <div className="config__dialogo-passo-item" key={id}>
                <span
                  className={`config__dialogo-passo ${
                    i === atual ? 'config__dialogo-passo--ativo' : i < atual ? 'config__dialogo-passo--feito' : ''
                  }`}
                />
                <small>{rotulo}</small>
              </div>
            );
          }
        )}
      </div>

      <div key={passo} className={`config__dialogo-tela config__dialogo-tela--${passo === 'senha' ? 'entra-dir' : 'entra-esq'}`}>
        {passo === 'senha' ? (
          <PassoSenha onConfirmar={verificarSenha} onFechar={onFechar} />
        ) : passo === 'editar' ? (
          <PassoEditar
            atuais={atuais}
            podeEmpresa={podeEmpresa}
            senha={senhaConfirmada}
            onVoltar={() => setPasso('senha')}
            onFechar={onFechar}
            onSucesso={aoSalvarDados}
          />
        ) : (
          <PassoCodigo
            email={emailPendente}
            senha={senhaConfirmada}
            onConfirmado={onEmailConfirmado}
            onFechar={onFechar}
          />
        )}
      </div>
    </Dialogo>
  );
};

// Confirmação de senha para salvar o PIX 

const ModalSenhaPix: React.FC<{
  onConfirmar: (senha: string) => Promise<ResultadoPix>;
  onFechar: () => void;
}> = ({ onConfirmar, onFechar }) => {
  const [senha, setSenha] = useState('');
  const [mostrarSenha, setMostrarSenha] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  const campoRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    campoRef.current?.focus();
  }, []);

  const confirmar = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!senha) {
      setErro('Digite sua senha para continuar.');
      return;
    }
    setEnviando(true);
    setErro(null);
    const resultado = await onConfirmar(senha);
    setEnviando(false);
    if (!resultado.ok) {
      setErro(resultado.mensagem ?? 'Não foi possível confirmar.');
      campoRef.current?.focus();
      campoRef.current?.select();
      return;
    }
    onFechar();
  };

  return (
    <Dialogo titulo="Confirmar alteração do PIX" onFechar={onFechar} fecharComEsc={!enviando}>
      <form className="config__dialogo-form" onSubmit={confirmar} noValidate>
        <div className="config__dialogo-topo">
          <div className="config__dialogo-icone">
            <HiLockClosed />
          </div>
          <button className="config__dialogo-x" type="button" onClick={onFechar} aria-label="Fechar" disabled={enviando}>
            <HiX />
          </button>
        </div>

        <h3 className="config__card-titulo">Confirme sua senha</h3>
        <p className="config__hint">Por segurança, confirme sua senha para salvar a nova chave PIX.</p>

        <Campo id="pix-senha" rotulo="Sua senha atual" erro={erro ?? undefined}>
          <div className="config__campo-senha">
            <input
              id="pix-senha"
              ref={campoRef}
              maxLength={60}
              className="config__input"
              type={mostrarSenha ? 'text' : 'password'}
              autoComplete="current-password"
              value={senha}
              disabled={enviando}
              onChange={(e) => {
                setSenha(e.target.value);
                setErro(null);
              }}
            />
            <button
              type="button"
              className="config__campo-senha-olho"
              onClick={() => setMostrarSenha((v) => !v)}
              disabled={enviando}
              aria-label={mostrarSenha ? 'Ocultar senha' : 'Mostrar senha'}
              tabIndex={-1}
            >
              {mostrarSenha ? <HiEyeOff /> : <HiEye />}
            </button>
          </div>
        </Campo>

        <div className="config__acoes config__acoes--fim">
          <button className="config__btn" type="button" onClick={onFechar} disabled={enviando}>
            Cancelar
          </button>
          <button className="config__btn config__btn--primario" type="submit" disabled={enviando}>
            {enviando ? 'Salvando…' : 'Confirmar e salvar'}
          </button>
        </div>
      </form>
    </Dialogo>
  );
};

// Tela

// Tela
type AbaId = 'dados-empresa' | 'contato-endereco' | 'horario' | 'atendimento';

const Config: React.FC = () => {
  const navigate = useNavigate();
  const { sair, entrar } = useAuth();
  const { perfil, carregando, erro, recarregar, mesclarEstabelecimento } = useEstabelecimento();

  const estab = perfil?.estabelecimento ?? null;
  const empresa = perfil?.empresa ?? null;
  const usuario = perfil?.usuario ?? null;
  const podeEditar = usuario?.perfil === 'ADMIN';

  const [enviandoLogo, setEnviandoLogo] = useState(false);
  const [logoAviso, setLogoAviso] = useState<{ tipo: 'ok' | 'erro'; texto: string } | null>(null);
  const inputLogoRef = useRef<HTMLInputElement>(null);
  const [logoParaAjustar, setLogoParaAjustar] = useState<File | null>(null);
  const [avisoGeral, setAvisoGeral] = useState<{ tipo: 'ok' | 'erro'; texto: string } | null>(null);
  const [modalSensivel, setModalSensivel] = useState(false);
  const [saidaPendente, setSaidaPendente] = useState<null | (() => void)>(null);
  const [salvandoSaida, setSalvandoSaida] = useState(false);

  useEffect(() => {
    void recarregar();
  }, [recarregar]);

  const mesclar = (payload: AtualizarEstabelecimentoDTO) => mesclarEstabelecimento(payload as Partial<Estabelecimento>);
  const contato = useSecao(estab, CONTATO_PADRAO, extrairContato, validarContato, payloadContato, mesclar);
  const endereco = useSecao(estab, ENDERECO_PADRAO, extrairEndereco, validarEndereco, payloadEndereco, mesclar);

  // CEP: mesma busca no ViaCEP do cadastro. Só dispara quando a pessoa digita o CEP (não ao abrir a tela).
  const [buscandoCep, setBuscandoCep] = useState(false);
  const buscaCepId = useRef(0);

  const buscarCep = async (cepFormatado: string) => {
    const idBusca = ++buscaCepId.current;
    setBuscandoCep(true);
    try {
      const resp = await fetch(`https://viacep.com.br/ws/${soDigitos(cepFormatado)}/json/`);
      const dados = await resp.json();
      if (idBusca !== buscaCepId.current) return; // a pessoa já digitou outro CEP

      if (dados.erro) {
        endereco.definirErro('cep', 'CEP não encontrado. Preencha o endereço manualmente.');
        return;
      }

      if (dados.logradouro) endereco.definir('rua', dados.logradouro);
      if (dados.bairro) endereco.definir('bairro', dados.bairro);
      if (dados.localidade) endereco.definir('cidade', dados.localidade);
      if (dados.uf && UFS.includes(dados.uf)) endereco.definir('estado', dados.uf);
      ['rua', 'bairro', 'cidade', 'estado'].forEach((c) => endereco.limparErro(c));
      document.getElementById('numero')?.focus();
    } catch {
      // Falha de rede: a pessoa preenche o endereço na mão.
    } finally {
      if (idBusca === buscaCepId.current) setBuscandoCep(false);
    }
  };

  const aoMudarCep = (e: React.ChangeEvent<HTMLInputElement>) => {
    const formatado = mascaraCep(e.target.value);
    endereco.definir('cep', formatado);
    endereco.limparErro('cep');
    if (formatado.length === 9) {
      buscarCep(formatado);
    } else {
      buscaCepId.current++; // cancela busca em andamento
      setBuscandoCep(false);
    }
  };
  const horario = useSecao(estab, HORARIO_PADRAO, extrairHorario, validarHorario, payloadHorario, mesclar);
  const atendimento = useSecao(estab, ATENDIMENTO_PADRAO, extrairAtendimento, validarAtendimento, payloadAtendimento, mesclar);
  const divulgacao = useSecao(estab, DIVULGACAO_PADRAO, extrairDivulgacao, validarDivulgacao, payloadDivulgacao, mesclar);
  const pix = usePix(estab);

  // Contato e Endereço ficam travados (cinza) até a pessoa clicar em "Alterar"
  const [editandoContato, setEditandoContato] = useState(false);
  const [editandoEndereco, setEditandoEndereco] = useState(false);

  const cancelarContato = () => { contato.descartar(); setEditandoContato(false); };
  const salvarContato = async () => {
    if (!contato.alterado) { setEditandoContato(false); return; }
    if (await contato.salvar()) setEditandoContato(false);
  };
  const cancelarEndereco = () => {
    buscaCepId.current++;
    setBuscandoCep(false);
    endereco.descartar();
    setEditandoEndereco(false);
  };
  const salvarEndereco = async () => {
    if (!endereco.alterado) { setEditandoEndereco(false); return; }
    if (await endereco.salvar()) setEditandoEndereco(false);
  };

  const [pixModalAberto, setPixModalAberto] = useState(false);
  // Só o dono da empresa mexe no PIX (o backend confere de novo; aqui só evita pedir a senha à toa)
  const [ehDonoPix, setEhDonoPix] = useState(false);
  useEffect(() => {
    if (!estab?.id || !podeEditar) { setEhDonoPix(false); return; }
    let ativo = true;
    EstabelecimentoService.podeAlterarPix(estab.id).then((ok) => { if (ativo) setEhDonoPix(ok); });
    return () => { ativo = false; };
  }, [estab?.id, podeEditar]);
  const podeEditarPix = podeEditar && ehDonoPix;
  const [editandoPix, setEditandoPix] = useState(false);
  const [avisoPix, setAvisoPix] = useState<string | null>(null);
  const desativandoPix = useRef(false);
  const pixTravado = pix.temChave && !editandoPix;

  // Link que o restaurante divulga
  const linkCardapio = estab?.slug ? `${window.location.origin}/r/${estab.slug}` : '';
  const [linkCopiado, setLinkCopiado] = useState(false);

  const copiarLink = async () => {
    if (!linkCardapio) return;
    try {
      await navigator.clipboard.writeText(linkCardapio);
    } catch {
      // Navegador sem permissão de área de transferência
      (document.getElementById('link-cardapio') as HTMLInputElement | null)?.select();
      return;
    }
    setLinkCopiado(true);
    window.setTimeout(() => setLinkCopiado(false), 2500);
  };

  const secoesAutoSalvaveis = useMemo(
    () => [contato, endereco, horario, atendimento, divulgacao],
    [contato, endereco, horario, atendimento, divulgacao]
  );
  const algumAlterado = secoesAutoSalvaveis.some((s) => s.alterado) || pix.alterado;
  const totalPendentes = secoesAutoSalvaveis.filter((s) => s.alterado).length + (pix.alterado ? 1 : 0);

  const atalhosPix = useMemo(() => {
    const lista: { tipo: TipoChavePix; rotulo: string; valor: string }[] = [];
    const cnpj = empresa?.cnpj ?? estab?.cnpj;
    if (cnpj) lista.push({ tipo: 'CNPJ', rotulo: 'CNPJ', valor: String(cnpj) });
    if (usuario?.cpf) lista.push({ tipo: 'CPF', rotulo: 'CPF', valor: String(usuario.cpf) });
    if (usuario?.email) lista.push({ tipo: 'EMAIL', rotulo: 'E-mail', valor: String(usuario.email) });
    return lista;
  }, [empresa?.cnpj, estab?.cnpj, usuario?.cpf, usuario?.email]);

  const iniciarSalvarPix = () => {
    if (!pix.alterado) {
      setEditandoPix(false);
      setAvisoPix('Nenhum dado alterado.');
      window.setTimeout(() => setAvisoPix(null), 3500);
      return;
    }
    if (!pix.validar()) return;
    setPixModalAberto(true);
  };

  const confirmarPix = async (senha: string) => {
    if (!estab) return { ok: false, mensagem: 'Estabelecimento não encontrado.' } as ResultadoPix;
    const resultado = await pix.confirmarComSenha(estab.id, senha);
    if (resultado.ok) {
      desativandoPix.current = false;
      setEditandoPix(false);
    }
    return resultado;
  };

  const desativarPix = () => {
    desativandoPix.current = true;
    pix.definir('tipo_chave_pix', '');
    setPixModalAberto(true);
  };

  const fecharModalPix = () => {
    setPixModalAberto(false);
    if (desativandoPix.current) {
      desativandoPix.current = false;
      pix.descartar();
    }
  };

  const descartarPix = () => {
    pix.descartar();
    setEditandoPix(false);
    setAvisoPix(null);
  };

  // Abas 
  const ABAS: { id: AbaId; titulo: string; icone: React.ReactNode; alterado: boolean }[] = [
    { id: 'dados-empresa', titulo: 'Dados da empresa', icone: <HiOfficeBuilding />, alterado: divulgacao.alterado },
    { id: 'contato-endereco', titulo: 'Contato e Endereço', icone: <HiLocationMarker />, alterado: contato.alterado || endereco.alterado },
    { id: 'horario', titulo: 'Horário de funcionamento', icone: <HiClock />, alterado: horario.alterado },
    { id: 'atendimento', titulo: 'Atendimento, entrega e PIX', icone: <HiTruck />, alterado: atendimento.alterado || pix.alterado },
  ];
  const [abaAtiva, setAbaAtiva] = useState<AbaId>('dados-empresa');

  useEffect(() => {
    if (avisoGeral?.tipo !== 'ok') return;
    const t = window.setTimeout(() => setAvisoGeral(null), 6000);
    return () => window.clearTimeout(t);
  }, [avisoGeral]);

  useEffect(() => {
    if (logoAviso?.tipo !== 'ok') return;
    const t = window.setTimeout(() => setLogoAviso(null), 6000);
    return () => window.clearTimeout(t);
  }, [logoAviso]);

  useEffect(() => {
    if (!algumAlterado) return;
    const antes = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', antes);
    return () => window.removeEventListener('beforeunload', antes);
  }, [algumAlterado]);

  const definirDia = (dia: DiaSemana, parcial: Partial<HorarioFuncionamento[DiaSemana]>) => {
    horario.definir('horario', { ...horario.valor.horario, [dia]: { ...horario.valor.horario[dia], ...parcial } });
    horario.limparErro(`horario_${dia}`);
  };

  const alternarDia = (dia: DiaSemana, aberto: boolean) => {
    const atual = horario.valor.horario[dia];
    horario.definir('horario', {
      ...horario.valor.horario,
      [dia]: {
        aberto,
        abertura: aberto ? atual.abertura ?? '11:00' : atual.abertura,
        fechamento: aberto ? atual.fechamento ?? '22:00' : atual.fechamento,
      },
    });
    horario.limparErro(`horario_${dia}`);
  };

  const copiarParaTodos = (origem: DiaSemana) => {
    const modelo = horario.valor.horario[origem];
    const novo = { ...horario.valor.horario };
    DIAS.forEach(({ chave }) => {
      novo[chave] = { aberto: true, abertura: modelo.abertura, fechamento: modelo.fechamento };
    });
    horario.definir('horario', novo);
  };

  const escolherLogo = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const arquivo = e.target.files?.[0];
    e.target.value = '';
    if (!arquivo || !estab) return;

    if (!['image/jpeg', 'image/png'].includes(arquivo.type)) {
      setLogoAviso({ tipo: 'erro', texto: 'Envie uma imagem JPG ou PNG.' });
      return;
    }
    if (arquivo.size > TAMANHO_MAX_LOGO) {
      setLogoAviso({ tipo: 'erro', texto: 'A imagem passa de 20MB. Escolha uma menor.' });
      return;
    }

    // Abre o editor para o usuário enquadrar a logo no círculo; o envio acontece ao confirmar
    setLogoAviso(null);
    setLogoParaAjustar(arquivo);
  };

  const enviarLogoAjustada = async (arquivo: File) => {
    if (!estab) return;
    setLogoParaAjustar(null);
    setEnviandoLogo(true);
    setLogoAviso(null);
    try {
      const url = await EstabelecimentoService.enviarLogo(estab.id, arquivo);
      mesclarEstabelecimento({ logo_url: url });
      setLogoAviso({ tipo: 'ok', texto: 'Logo enviada e salva.' });
    } catch (err: any) {
      setLogoAviso({ tipo: 'erro', texto: mensagemDeErro(err, 'Não foi possível enviar a logo.') });
    } finally {
      setEnviandoLogo(false);
    }
  };

    const removerLogo = async () => {
    if (!estab) return;
    setEnviandoLogo(true);
    setLogoAviso(null);
    try {
      await EstabelecimentoService.removerLogo(estab.id);
      mesclarEstabelecimento({ logo_url: null });
      setLogoAviso({ tipo: 'ok', texto: 'Logo removida.' });
    } catch (err: any) {
      setLogoAviso({ tipo: 'erro', texto: mensagemDeErro(err, 'Não foi possível remover a logo.') });
    } finally {
      setEnviandoLogo(false);
    }
  };

  const executarSaida = () => {
    sair();
    navigate('/login');
  };

  const sairDaConta = () => {
    if (algumAlterado) setSaidaPendente(() => executarSaida);
    else executarSaida();
  };

  useEffect(() => {
    if (!algumAlterado) return;
    const aoClicar = (e: MouseEvent) => {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const link = (e.target as Element | null)?.closest?.('a[href]') as HTMLAnchorElement | null;
      if (!link || link.target === '_blank' || link.origin !== window.location.origin) return;
      if (link.pathname === window.location.pathname) return;
      e.preventDefault();
      e.stopPropagation();
      const destino = link.pathname + link.search + link.hash;
      setSaidaPendente(() => () => navigate(destino));
    };
    document.addEventListener('click', aoClicar, true);
    return () => document.removeEventListener('click', aoClicar, true);
  }, [algumAlterado, navigate]);

  const salvarESair = async () => {
    if (!saidaPendente) return;
    setSalvandoSaida(true);
    const pendentes = secoesAutoSalvaveis.filter((s) => s.alterado);
    const resultados = await Promise.all(pendentes.map((s) => s.salvar()));
    setSalvandoSaida(false);
    setSaidaPendente(null);

    if (!resultados.every(Boolean)) return; // erro já aparece na seção que falhou

    if (pix.alterado) {
      setAvisoGeral({
        tipo: 'erro',
        texto: 'Você tem uma alteração de PIX pendente. Confirme sua senha na aba de PIX antes de sair.',
      });
      return;
    }

    const ir = saidaPendente;
    ir();
  };

  const abrirDadosSensiveis = () => {
    if (algumAlterado) {
      setAvisoGeral({
        tipo: 'erro',
        texto: 'Salve ou descarte as alterações pendentes antes de mudar os dados da empresa.',
      });
      return;
    }
    setAvisoGeral(null);
    setModalSensivel(true);
  };

  const aoAlterarDadosSensiveis = (novos: DadosSensiveis, token: string, fechar: boolean) => {
    if (fechar) setModalSensivel(false);
    if (usuario) {
      entrar({
        token,
        usuario: {
          id: usuario.id,
          nome: novos.nome_responsavel,
          email: usuario.email,
          perfil: usuario.perfil,
          escopo: usuario.escopo,
          estabelecimento_id: usuario.estabelecimento_id,
          empresa_id: usuario.empresa_id,
        },
      });
    }
    void recarregar();
    if (fechar) setAvisoGeral({ tipo: 'ok', texto: 'Dados alterados com sucesso.' });
  };

  // Código confirmado: o e-mail já foi trocado e as outras sessões foram encerradas.
  const aoConfirmarEmail = (sessao: LoginResponse) => {
    setModalSensivel(false);
    entrar(sessao);
    void recarregar();
    setAvisoGeral({
      tipo: 'ok',
      texto: 'E-mail alterado com sucesso. Avisamos o endereço antigo sobre a mudança.',
    });
  };

  //  Estados de carregamento / erro 

  if (!perfil && carregando) {
    return (
      <RestaurantLayout>
        <div className="config">
          <p className="config__estado" role="status">Carregando o perfil…</p>
        </div>
      </RestaurantLayout>
    );
  }

  if (!perfil || !estab || !usuario) {
    return (
      <RestaurantLayout>
        <div className="config">
          <div className="config__card config__card--vazio">
            <HiExclamationCircle className="config__estado-icone" />
            <h2 className="config__titulo">Não foi possível abrir o perfil</h2>
            <p className="config__hint">
              {erro ??
                (perfil && !estab
                  ? 'Sua conta não está vinculada a nenhum restaurante. Entre em contato com o suporte.'
                  : 'Os dados do cadastro ainda não foram carregados.')}
            </p>
            <div className="config__acoes">
              <button className="config__btn config__btn--primario" type="button" onClick={() => void recarregar()}>
                Tentar de novo
              </button>
              <button className="config__btn" type="button" onClick={sairDaConta}>
                Sair
              </button>
            </div>
          </div>
        </div>
      </RestaurantLayout>
    );
  }

  // Nome exibido no cabeçalho: vem da empresa
  const nomeExibido = empresa?.nome ?? estab.nome ?? 'Restaurante';
  const estabAtivo = (estab as unknown as { ativo?: boolean }).ativo ?? true;

  return (
    <RestaurantLayout>
      <div className="config">
        {/* Cabeçalho */}
        <header className="config__cabecalho">
          <div className="config__cabecalho-perfil">
            <div className="config__avatar-col">
              <img
                key={estab.logo_url || 'padrao'}
                className="config__avatar"
                src={estab.logo_url || LOGO_PADRAO}
                alt=""
                aria-label={`Logo de ${nomeExibido}`}
                onError={(e) => {
                  const img = e.currentTarget;
                  img.onerror = null;
                  if (!img.src.endsWith(LOGO_PADRAO)) img.src = LOGO_PADRAO;
                }}
              />
              {podeEditar && (
                <div className="config__avatar-acoes">
                  <button
                    className="config__btn config__btn--pequeno"
                    type="button"
                    onClick={() => inputLogoRef.current?.click()}
                    disabled={enviandoLogo}
                  >
                    <HiUpload /> {enviandoLogo ? 'Enviando…' : 'Alterar logo'}
                  </button>
                  {estab.logo_url && (
                    <button
                      className="config__btn config__btn--pequeno"
                      type="button"
                      onClick={removerLogo}
                      disabled={enviandoLogo}
                    >
                      <HiTrash /> Remover logo
                    </button>
                  )}
                </div>
              )}
              <input
                ref={inputLogoRef}
                type="file"
                accept="image/jpeg,image/png"
                className="config__arquivo"
                onChange={escolherLogo}
              />
              <RecortadorImagem
                arquivo={logoParaAjustar}
                titulo="Ajustar logo"
                onConfirmar={enviarLogoAjustada}
                onCancelar={() => setLogoParaAjustar(null)}
              />
              {logoAviso && (
                <p className={logoAviso.tipo === 'erro' ? 'config__erro' : 'config__hint'} role={logoAviso.tipo === 'erro' ? 'alert' : undefined}>
                  {logoAviso.texto}
                </p>
              )}
            </div>

            <div className="config__cabecalho-info">
              <div className="config__cabecalho-titulo-linha">
                <h2 className="config__titulo">{nomeExibido}</h2>
                <span className={`config__status-badge ${estabAtivo ? 'config__status-badge--ativo' : 'config__status-badge--inativo'}`}>
                  <span className="config__status-ponto" aria-hidden="true" />
                  {estabAtivo ? 'Restaurante ativo' : 'Restaurante inativo'}
                </span>
              </div>
              <p className="config__cabecalho-linha">
                <HiLocationMarker aria-hidden="true" /> Restaurante
                {estab.endereco?.cidade ? ` • ${estab.endereco.cidade}` : ''}
                {estab.endereco?.estado ? `/${estab.endereco.estado}` : ''}
              </p>
              <p className="config__cabecalho-linha config__cabecalho-linha--muted">
                CNPJ: {empresa?.cnpj ?? estab.cnpj ?? '—'}
              </p>
              <p className="config__subtitulo">
                Cada seção é salva por conta própria. Campos com cadeado vêm do cadastro e não podem ser alterados aqui.
              </p>
            </div>
          </div>

          <div className="config__cabecalho-acoes">
            <div
              className="config__chip-info"
              role="status"
              aria-label={`${totalPendentes} seções com alterações pendentes`}
              title="Seções com alterações ainda não salvas"
            >
              <HiClipboardList className="config__chip-info-icone" />
              <span className="config__chip-info-texto">Pendentes</span>
              <span className="config__chip-info-numero">{totalPendentes}</span>
            </div>
            <button className="config__btn config__btn--sair" type="button" onClick={sairDaConta}>
              <HiLogout /> Sair
            </button>
          </div>
        </header>

        {!podeEditar && (
          <p className="config__aviso config__aviso--info" role="status">
            Seu acesso é de {usuario.perfil.toLowerCase()}. Apenas administradores editam o perfil.
          </p>
        )}

        {!perfil.vinculo_ok && (
          <p className="config__aviso config__aviso--erro" role="alert">
            <HiExclamationCircle />
            Sua conta não está totalmente vinculada à empresa. Entre em contato com o suporte.
          </p>
        )}

        {avisoGeral && (
          <p className={`config__aviso config__aviso--${avisoGeral.tipo}`} role={avisoGeral.tipo === 'erro' ? 'alert' : 'status'}>
            {avisoGeral.tipo === 'ok' ? <HiCheckCircle /> : <HiExclamationCircle />}
            {avisoGeral.texto}
          </p>
        )}

        {/* Painel com abas: só o conteúdo da aba ativa aparece — os cards da
            referência visual ficam empilhados na mesma tela só para fins de
            ilustração; aqui cada um vive dentro da sua própria aba. */}
        <div className="config__painel">
          <div className="config__abas" role="tablist" aria-label="Seções do perfil">
            {ABAS.map((aba) => (
              <button
                key={aba.id}
                role="tab"
                aria-selected={abaAtiva === aba.id}
                className={`config__aba${abaAtiva === aba.id ? ' config__aba--ativa' : ''}`}
                onClick={(e) => {
                  setAbaAtiva(aba.id);
                  e.currentTarget.scrollIntoView?.({ behavior: 'smooth', inline: 'center', block: 'nearest' });
                }}
              >
                <span className="config__aba-icone">{aba.icone}</span>
                {aba.titulo}
                {aba.alterado && <span className="config__aba-ponto" aria-hidden="true" />}
              </button>
            ))}
          </div>

          {/* Dados da empresa */}
          {abaAtiva === 'dados-empresa' && (
            <section className="config__card" aria-labelledby="sec-cadastro">
              <div className="config__card-cabecalho">
                <h3 className="config__card-titulo" id="sec-cadastro">
                  <span className="config__card-titulo-icone"><HiOfficeBuilding /></span>
                  Dados da empresa
                </h3>
                <button className="config__btn config__btn--pequeno" type="button" onClick={abrirDadosSensiveis}>
                  <HiPencil /> Alterar dados
                </button>
              </div>
              <p className="config__hint">
                <HiLockClosed aria-hidden="true" /> Alguns dados são protegidos e não podem ser alterados aqui.
              </p>
              <div className="config__grade">
                <Bloqueado id="cad-empresa" rotulo="Nome da empresa" valor={empresa?.nome} />
                <Bloqueado id="cad-razao" rotulo="Razão social" valor={empresa?.razao_social} />
                <Bloqueado id="cad-resp" rotulo="Responsável" valor={usuario.nome} />
                <Bloqueado id="cad-email" rotulo="E-mail de acesso" valor={usuario.email} />
                <Bloqueado id="cad-cnpj" rotulo="CNPJ" valor={empresa?.cnpj ?? estab.cnpj} />
                <Bloqueado id="cad-cpf" rotulo="CPF do responsável" valor={usuario.cpf} />
              </div>
              <p className="config__hint">
                Para mudar nome da empresa, razão social, responsável ou e-mail — incluindo o nome exibido no
                topo desta tela — confirme sua senha em "Alterar dados". CNPJ e CPF não podem ser alterados.
              </p>
            </section>
          )}

          {/* Divulgação: tipo de cozinha + link do cardápio */}
          {abaAtiva === 'dados-empresa' && (
            <section className="config__card" aria-labelledby="sec-divulgacao">
              <SecaoCabecalho titulo="Divulgação" id="sec-divulgacao" secao={divulgacao} podeEditar={podeEditar} icone={<HiClipboard />} />
              {divulgacao.erroGeral && <p className="config__erro" role="alert">{divulgacao.erroGeral}</p>}
              <div className="config__grade">
                <Campo
                  id="tipo-cozinha"
                  rotulo="Tipo de cozinha"
                  erro={divulgacao.erros.tipo_cozinha_outro}
                  dica={'Opcional. Aparece para o cliente. Não achou o seu? Escolha "Outros".'}
                >
                  <select
                    id="tipo-cozinha"
                    className="config__input config__select"
                    value={divulgacao.valor.tipo_cozinha}
                    disabled={!podeEditar || divulgacao.salvando}
                    onChange={(e) => {
                      divulgacao.definir('tipo_cozinha', e.target.value);
                      divulgacao.limparErro('tipo_cozinha_outro');
                    }}
                  >
                    <option value="">Não informar</option>
                    {TIPOS_COZINHA.map((t) => (
                      <option key={t} value={t}>{t}</option>
                    ))}
                    <option value={OUTROS}>Outros</option>
                  </select>
                  {divulgacao.valor.tipo_cozinha === OUTROS && (
                    <input
                      id="tipo-cozinha-outro"
                      className="config__input"
                      style={{ marginTop: 8 }}
                      placeholder="Digite o tipo de cozinha"
                      maxLength={60}
                      value={divulgacao.valor.tipo_cozinha_outro}
                      disabled={!podeEditar || divulgacao.salvando}
                      onChange={(e) => {
                        divulgacao.definir('tipo_cozinha_outro', e.target.value);
                        divulgacao.limparErro('tipo_cozinha_outro');
                      }}
                    />
                  )}
                </Campo>

                <Campo
                  id="link-cardapio"
                  rotulo="Link para seus clientes"
                  dica="Divulgue no Instagram, WhatsApp ou em QR code. O cliente entra direto no seu restaurante."
                >
                  <div className="config__linha-link">
                    <input
                      id="link-cardapio"
                      className="config__input"
                      value={linkCardapio || '—'}
                      readOnly
                      onFocus={(e) => e.currentTarget.select()}
                    />
                    <button
                      type="button"
                      className="config__btn config__btn--pequeno"
                      onClick={() => void copiarLink()}
                      disabled={!linkCardapio}
                    >
                      <HiClipboard /> {linkCopiado ? 'Copiado!' : 'Copiar'}
                    </button>
                    <a
                      className="config__btn config__btn--pequeno"
                      href={linkCardapio || undefined}
                      target="_blank"
                      rel="noreferrer"
                      aria-disabled={!linkCardapio}
                    >
                      <HiExternalLink /> Abrir
                    </a>
                  </div>
                </Campo>
              </div>
            </section>
          )}

          {/* Contato e Endereço */}
          {abaAtiva === 'contato-endereco' && (
            <div className="config__duas-colunas">
              <section className="config__subcard" aria-labelledby="sec-contato">
                <SecaoCabecalho
                  titulo="Contato" id="sec-contato" secao={contato} podeEditar={podeEditar} icone={<HiPhone />}
                  editando={editandoContato} aoAlterar={() => setEditandoContato(true)}
                  aoCancelar={cancelarContato} aoSalvar={() => void salvarContato()}
                />
                {contato.erroGeral && <p className="config__erro" role="alert">{contato.erroGeral}</p>}
                <div className={`config__grade config__grade--1col ${!editandoContato ? 'config__campos--travados' : ''}`}>
                  <Campo id="telefone" rotulo="Telefone" erro={contato.erros.telefone} dica="Opcional. Aparece no seu cardápio.">
                    <input
                      id="telefone"
                      className="config__input"
                      inputMode="tel"
                      placeholder="(11) 3456-7890"
                      value={contato.valor.telefone}
                      disabled={!podeEditar || contato.salvando || !editandoContato}
                      onChange={(e) => contato.definir('telefone', mascaraTelefone(e.target.value))}
                    />
                  </Campo>
                  <Campo
                    id="whatsapp"
                    rotulo="WhatsApp"
                    erro={contato.erros.whatsapp}
                    dica="Opcional. É para este número que vão os avisos de novo pedido."
                  >
                    <input
                      id="whatsapp"
                      className="config__input"
                      inputMode="tel"
                      placeholder="(11) 91234-5678"
                      value={contato.valor.whatsapp}
                      disabled={!podeEditar || contato.salvando || !editandoContato}
                      onChange={(e) => contato.definir('whatsapp', mascaraTelefone(e.target.value))}
                    />
                  </Campo>
                  <Campo
                    id="email-contato"
                    rotulo="E-mail de contato"
                    erro={contato.erros.email}
                    dica="Opcional. É o e-mail que seus clientes veem. Usar o de acesso o deixa visível a eles."
                  >
                    <input
                      id="email-contato"
                      maxLength={150}
                      className="config__input"
                      type="email"
                      placeholder="contato@seurestaurante.com.br"
                      value={contato.valor.email}
                      disabled={!podeEditar || contato.salvando || !editandoContato}
                      onChange={(e) => contato.definir('email', e.target.value)}
                    />
                  </Campo>
                  {podeEditar && usuario?.email && contato.valor.email.trim().toLowerCase() !== usuario.email.toLowerCase() && (
                    <div className="config__pix-atalhos">
                      <button
                        type="button"
                        className="config__pix-atalho"
                        disabled={contato.salvando || !editandoContato}
                        onClick={() => contato.definir('email', usuario.email)}
                      >
                        Usar e-mail de acesso ({usuario.email})
                      </button>
                    </div>
                  )}
                </div>
              </section>

              <section className="config__subcard" aria-labelledby="sec-endereco">
                <SecaoCabecalho
                  titulo="Endereço" id="sec-endereco" secao={endereco} podeEditar={podeEditar} icone={<HiLocationMarker />}
                  editando={editandoEndereco} aoAlterar={() => setEditandoEndereco(true)}
                  aoCancelar={cancelarEndereco} aoSalvar={() => void salvarEndereco()}
                />
                {endereco.erroGeral && <p className="config__erro" role="alert">{endereco.erroGeral}</p>}
                <div className={`config__grade config__grade--endereco-compacta ${!editandoEndereco ? 'config__campos--travados' : ''}`}>
                  <Campo id="cep" rotulo="CEP" erro={endereco.erros.cep} className="config__col-cep">
                    <div className="config__cep-wrap">
                      <input
                        id="cep"
                        className="config__input"
                        inputMode="numeric"
                        placeholder="00000-000"
                        autoComplete="postal-code"
                        value={endereco.valor.cep}
                        disabled={!podeEditar || endereco.salvando || !editandoEndereco}
                        aria-invalid={!!endereco.erros.cep}
                        onChange={aoMudarCep}
                      />
                      {buscandoCep && <span className="config__spinner" aria-label="Buscando CEP" />}
                    </div>
                  </Campo>
                  <Campo id="rua" rotulo="Rua" erro={endereco.erros.rua} className="config__col-rua">
                    <input
                      id="rua"
                      className="config__input"
                      value={endereco.valor.rua}
                      maxLength={150}
                      disabled={!podeEditar || endereco.salvando || !editandoEndereco}
                      onChange={(e) => endereco.definir('rua', e.target.value)}
                    />
                  </Campo>
                  <Campo id="numero" rotulo="Número" erro={endereco.erros.numero} className="config__col-numero">
                    <input
                      id="numero"
                      className="config__input"
                      value={endereco.valor.numero}
                      maxLength={10}
                      disabled={!podeEditar || endereco.salvando || !editandoEndereco}
                      onChange={(e) => endereco.definir('numero', e.target.value)}
                    />
                  </Campo>
                  <Campo id="complemento" rotulo="Complemento" className="config__col-bairro">
                    <input
                      id="complemento"
                      className="config__input"
                      placeholder="Sala, andar… (opcional)"
                      value={endereco.valor.complemento}
                      maxLength={80}
                      disabled={!podeEditar || endereco.salvando || !editandoEndereco}
                      onChange={(e) => endereco.definir('complemento', e.target.value)}
                    />
                  </Campo>
                  <Campo id="bairro" rotulo="Bairro" erro={endereco.erros.bairro} className="config__col-bairro">
                    <input
                      id="bairro"
                      className="config__input"
                      value={endereco.valor.bairro}
                      maxLength={80}
                      disabled={!podeEditar || endereco.salvando || !editandoEndereco}
                      onChange={(e) => endereco.definir('bairro', e.target.value)}
                    />
                  </Campo>
                  <Campo id="cidade" rotulo="Cidade" erro={endereco.erros.cidade} className="config__col-cidade">
                    <input
                      id="cidade"
                      className="config__input"
                      value={endereco.valor.cidade}
                      maxLength={80}
                      disabled={!podeEditar || endereco.salvando || !editandoEndereco}
                      onChange={(e) => endereco.definir('cidade', e.target.value)}
                    />
                  </Campo>
                  <Campo id="estado" rotulo="Estado" erro={endereco.erros.estado} className="config__col-uf">
                    <select
                      id="estado"
                      className="config__input config__select"
                      value={endereco.valor.estado}
                      disabled={!podeEditar || endereco.salvando || !editandoEndereco}
                      onChange={(e) => endereco.definir('estado', e.target.value)}
                    >
                      <option value="">UF</option>
                      {UFS.map((uf) => (
                        <option key={uf} value={uf}>{uf}</option>
                      ))}
                    </select>
                  </Campo>
                </div>
              </section>
            </div>
          )}

          {/* Horário */}
          {abaAtiva === 'horario' && (
            <section className="config__card" aria-labelledby="sec-horarios">
              <SecaoCabecalho titulo="Horário de funcionamento" id="sec-horarios" secao={horario} podeEditar={podeEditar} icone={<HiClock />} />
              {horario.erroGeral && <p className="config__erro" role="alert">{horario.erroGeral}</p>}
              <p className="config__hint">
                Todos os dias começam fechados. Abra os dias em que você atende e defina o horário.
              </p>

              <ul className="config__dias config__dias--duas-colunas">
                {DIAS.map(({ chave, nome }) => {
                  const dia = horario.valor.horario[chave];
                  const erroDia = horario.erros[`horario_${chave}`];
                  const viraNoite =
                    dia.aberto && dia.abertura && dia.fechamento && dia.fechamento <= dia.abertura;

                  return (
                    <li key={chave} className={`config__dia ${dia.aberto ? 'config__dia--aberto' : ''}`}>
                      <label className="config__dia-nome" htmlFor={`dia-${chave}`}>
                        <input
                          id={`dia-${chave}`}
                          type="checkbox"
                          role="switch"
                          className="config__dia-check"
                          checked={dia.aberto}
                          disabled={!podeEditar || horario.salvando}
                          onChange={(e) => alternarDia(chave, e.target.checked)}
                        />
                        <span className="config__switch-trilho" aria-hidden="true" />
                        <span>{nome}</span>
                      </label>

                      {dia.aberto ? (
                        <div className="config__dia-horas">
                          <input
                            type="time"
                            className="config__input config__input--hora"
                            aria-label={`Abertura de ${nome}`}
                            value={dia.abertura ?? ''}
                            disabled={!podeEditar || horario.salvando}
                            onChange={(e) => definirDia(chave, { abertura: e.target.value || null })}
                          />
                          <span className="config__ate">até</span>
                          <input
                            type="time"
                            className="config__input config__input--hora"
                            aria-label={`Fechamento de ${nome}`}
                            value={dia.fechamento ?? ''}
                            disabled={!podeEditar || horario.salvando}
                            onChange={(e) => definirDia(chave, { fechamento: e.target.value || null })}
                          />
                          <button
                            className="config__link"
                            type="button"
                            disabled={!podeEditar || horario.salvando || !dia.abertura || !dia.fechamento}
                            onClick={() => copiarParaTodos(chave)}
                          >
                            Repetir em todos os dias
                          </button>
                        </div>
                      ) : (
                        <span className="config__dia-fechado">Fechado</span>
                      )}

                      {(erroDia || viraNoite) && (
                        <p className={erroDia ? 'config__erro' : 'config__hint'} role={erroDia ? 'alert' : undefined}>
                          {erroDia ?? 'Fecha depois da meia-noite, já no dia seguinte.'}
                        </p>
                      )}
                    </li>
                  );
                })}
              </ul>
            </section>
          )}

          {/* Atendimento, entrega e PIX */}
          {abaAtiva === 'atendimento' && (
            <div className="config__duas-colunas">
              <section className="config__subcard" aria-labelledby="sec-atendimento">
                <SecaoCabecalho titulo="Configurações de entrega" id="sec-atendimento" secao={atendimento} podeEditar={podeEditar} icone={<HiTruck />} />
                {atendimento.erroGeral && <p className="config__erro" role="alert">{atendimento.erroGeral}</p>}

                <div className="config__cartoes-opcao">
                  <CartaoOpcao
                    id="aceita-entrega"
                    rotulo="Entrega"
                    icone={<HiTruck />}
                    marcado={atendimento.valor.aceita_entrega}
                    desabilitado={!podeEditar || atendimento.salvando}
                    onChange={(v) => atendimento.definir('aceita_entrega', v)}
                  />
                  <CartaoOpcao
                    id="aceita-retirada"
                    rotulo="Retirada"
                    icone={<HiShoppingBag />}
                    marcado={atendimento.valor.aceita_retirada}
                    desabilitado={!podeEditar || atendimento.salvando}
                    onChange={(v) => atendimento.definir('aceita_retirada', v)}
                  />
                </div>

                <div className="config__grade config__grade--2col">
                  <Campo id="tempo-min" rotulo="Tempo mínimo (min)" erro={atendimento.erros.tempo}>
                    <input
                      id="tempo-min"
                      className="config__input"
                      type="number"
                      min={1}
                      value={atendimento.valor.tempo_entrega_min}
                      disabled={!podeEditar || atendimento.salvando}
                      onChange={(e) => atendimento.definir('tempo_entrega_min', e.target.value)}
                    />
                  </Campo>
                  <Campo id="tempo-max" rotulo="Tempo máximo (min)">
                    <input
                      id="tempo-max"
                      className="config__input"
                      type="number"
                      min={1}
                      value={atendimento.valor.tempo_entrega_max}
                      disabled={!podeEditar || atendimento.salvando}
                      onChange={(e) => atendimento.definir('tempo_entrega_max', e.target.value)}
                    />
                  </Campo>
                  <Campo id="taxa" rotulo="Taxa de entrega (R$)" erro={atendimento.erros.taxa_entrega}>
                    <input
                      id="taxa"
                      className="config__input"
                      inputMode="numeric"
                      placeholder="R$ 0,00"
                      value={atendimento.valor.taxa_entrega}
                      disabled={!podeEditar || atendimento.salvando}
                      onChange={(e) => atendimento.definir('taxa_entrega', mascaraMoeda(e.target.value))}
                    />
                  </Campo>
                  <Campo id="minimo" rotulo="Pedido mínimo (R$)" erro={atendimento.erros.pedido_minimo}>
                    <input
                      id="minimo"
                      className="config__input"
                      inputMode="numeric"
                      placeholder="R$ 0,00"
                      value={atendimento.valor.pedido_minimo}
                      disabled={!podeEditar || atendimento.salvando}
                      onChange={(e) => atendimento.definir('pedido_minimo', mascaraMoeda(e.target.value))}
                    />
                  </Campo>
                </div>
              </section>

              <section className="config__subcard" aria-labelledby="sec-pix">
                <div className="config__card-cabecalho">
                  <h3 className="config__card-titulo" id="sec-pix">
                    <span className="config__card-titulo-icone"><HiCash /></span>
                    Recebimento por PIX
                  </h3>
                  {podeEditarPix && (
                    <div className="config__secao-controles">
                      <SecaoStatus
                        alterado={pix.alterado}
                        salvando={pix.salvando}
                        salvoRecente={pix.salvoRecente}
                        comErro={Boolean(pix.erroGeral)}
                      />
                      {pixTravado && (
                        <div className="config__secao-acoes">
                          <span className="config__pix-ativa"><HiCheckCircle aria-hidden="true" /> Ativa</span>
                          <button className="config__btn config__btn--pequeno" type="button" onClick={() => setEditandoPix(true)}>
                            <HiPencil aria-hidden="true" /> Alterar
                          </button>
                          <button className="config__btn config__btn--pequeno config__btn--perigo" type="button" onClick={desativarPix}>
                            <HiTrash aria-hidden="true" /> Desativar
                          </button>
                        </div>
                      )}
                      {(pix.alterado || editandoPix) && (
                        <div className="config__secao-acoes">
                          <button className="config__btn config__btn--pequeno" type="button" onClick={descartarPix} disabled={pix.salvando}>
                            {pix.alterado ? 'Descartar' : 'Cancelar'}
                          </button>
                          <button
                            className="config__btn config__btn--primario config__btn--pequeno"
                            type="button"
                            onClick={iniciarSalvarPix}
                            disabled={pix.salvando}
                          >
                            {pix.salvando ? 'Salvando…' : 'Salvar'}
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
                {podeEditar && !ehDonoPix && (
                  <p className="config__pix-aviso" role="status">Apenas o dono da empresa pode alterar a chave PIX.</p>
                )}
                {pix.erroGeral && <p className="config__erro" role="alert">{pix.erroGeral}</p>}
                {avisoPix && <p className="config__pix-aviso" role="status">{avisoPix}</p>}

                <div className={`config__grade config__grade--1col config__pix-campos ${pixTravado ? 'config__pix-campos--travado' : ''}`}>
                  <Campo id="tipo-pix" rotulo="Tipo da chave">
                    <select
                      id="tipo-pix"
                      className="config__input config__select"
                      value={pix.valor.tipo_chave_pix}
                      disabled={!podeEditarPix || pix.salvando || pixTravado}
                      onChange={(e) => pix.definir('tipo_chave_pix', e.target.value as TipoChavePix | '')}
                    >
                      <option value="">Sem chave PIX</option>
                      {TIPOS_PIX.map((t) => (
                        <option key={t.valor} value={t.valor}>{t.rotulo}</option>
                      ))}
                    </select>
                  </Campo>
                  {podeEditarPix && !pixTravado && atalhosPix.length > 0 && (
                    <div className="config__pix-atalhos">
                      <span className="config__pix-atalhos-rotulo">Usar dado do cadastro:</span>
                      {atalhosPix.map((a) => (
                        <button
                          key={a.tipo}
                          type="button"
                          className={`config__pix-atalho ${pix.valor.tipo_chave_pix === a.tipo && soDigitos(pix.valor.chave_pix) === soDigitos(a.valor) ? 'config__pix-atalho--ativo' : ''}`}
                          disabled={pix.salvando}
                          onClick={() => pix.preencher(a.tipo, a.valor)}
                        >
                          {a.rotulo}
                        </button>
                      ))}
                    </div>
                  )}
                  <Campo
                    id="chave-pix"
                    rotulo="Chave PIX"
                    erro={pix.erros.chave_pix}
                    dica={pixTravado ? 'Seus clientes veem esta chave ao escolher pagar com Pix.' : pix.valor.tipo_chave_pix ? 'Opcional. Você pode trocar pelo dado que preferir.' : 'Escolha o tipo da chave para preencher.'}
                  >
                    <input
                      id="chave-pix"
                      className="config__input"
                      value={pix.valor.chave_pix}
                      inputMode={['CPF', 'CNPJ', 'TELEFONE'].includes(pix.valor.tipo_chave_pix) ? 'numeric' : pix.valor.tipo_chave_pix === 'EMAIL' ? 'email' : 'text'}
                      placeholder={pix.valor.tipo_chave_pix ? PLACEHOLDER_PIX[pix.valor.tipo_chave_pix] : ''}
                      autoComplete="off"
                      maxLength={77}
                      disabled={!podeEditarPix || pix.salvando || pixTravado || !pix.valor.tipo_chave_pix}
                      onChange={(e) => pix.definir('chave_pix', e.target.value)}
                    />
                  </Campo>
                </div>
              </section>
            </div>
          )}
        </div>
      </div>

      {modalSensivel && (
        <ModalDadosSensiveis
          atuais={{
            nome_empresa: empresa?.nome ?? '',
            razao_social: empresa?.razao_social ?? '',
            nome_responsavel: usuario.nome,
            email: usuario.email,
          }}
          podeEmpresa={podeEditar && Boolean(empresa)}
          onFechar={() => setModalSensivel(false)}
          onSucesso={aoAlterarDadosSensiveis}
          onEmailConfirmado={aoConfirmarEmail}
        />
      )}

      {pixModalAberto && (
        <ModalSenhaPix onConfirmar={confirmarPix} onFechar={fecharModalPix} />
      )}

      {saidaPendente && (
        <Dialogo titulo="Salvar alterações?" onFechar={() => setSaidaPendente(null)} fecharComEsc={!salvandoSaida}>
          <div className="config__dialogo-form">
            <h3 className="config__card-titulo">Salvar as alterações?</h3>
            <p className="config__hint">
              Você mudou dados do perfil e ainda não salvou. Se sair agora, as mudanças serão perdidas.
            </p>
            <div className="config__acoes config__acoes--fim">
              <button
                className="config__btn"
                type="button"
                onClick={() => setSaidaPendente(null)}
                disabled={salvandoSaida}
              >
                Continuar editando
              </button>
              <button
                className="config__btn config__btn--sair"
                type="button"
                onClick={() => {
                  const ir = saidaPendente;
                  setSaidaPendente(null);
                  ir();
                }}
                disabled={salvandoSaida}
              >
                Sair sem salvar
              </button>
              <button
                className="config__btn config__btn--primario"
                type="button"
                onClick={() => void salvarESair()}
                disabled={salvandoSaida}
              >
                {salvandoSaida ? 'Salvando…' : 'Salvar e sair'}
              </button>
            </div>
          </div>
        </Dialogo>
      )}
    </RestaurantLayout>
  );
};

export default Config;