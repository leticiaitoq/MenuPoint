import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  HiArrowLeft,
  HiCash,
  HiCheckCircle,
  HiClipboardList,
  HiClock,
  HiExclamationCircle,
  HiLocationMarker,
  HiLockClosed,
  HiLogout,
  HiOfficeBuilding,
  HiPencil,
  HiPhone,
  HiShoppingBag,
  HiTruck,
  HiUpload,
  HiUserGroup,
  HiX,
  HiEye,
  HiEyeOff
} from 'react-icons/hi';
import RestaurantLayout from '../../../shared/components/layout/Restaurantelayout';
import { useEstabelecimento } from '../../../shared/contexts/Estabelecimentocontext';
import { useAuth } from '../../../shared/contexts/Authcontext';
import AuthService from '../../../services/auth.service';
import EstabelecimentoService, {
  AtualizarEstabelecimentoDTO,
  AtualizarPixDTO,
  DiaSemana,
  Estabelecimento,
  HorarioFuncionamento,
  TipoChavePix,
} from '../../../services/estabelecimento.service';
import './Config.css';

// ────────────────────────────────────────────────────────────────────────────
// Constantes
// ────────────────────────────────────────────────────────────────────────────

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
const TAMANHO_MAX_LOGO = 5 * 1024 * 1024;

type Erros = Partial<Record<string, string>>;

// ── Utilitários de máscara / conversão ──────────────────────────────────────

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

function mascaraCep(valor: string): string {
  const d = soDigitos(valor).slice(0, 8);
  return d.length > 5 ? `${d.slice(0, 5)}-${d.slice(5)}` : d;
}

function paraNumero(valor: string): number {
  const limpo = valor.trim();
  if (limpo === '') return NaN;
  const normalizado = limpo.includes(',') ? limpo.replace(/\./g, '').replace(',', '.') : limpo;
  return Number(normalizado);
}

function formatarMoeda(valor: string | number | null | undefined): string {
  const n = Number(valor ?? 0);
  return Number.isFinite(n) ? n.toFixed(2).replace('.', ',') : '0,00';
}

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

// ── Horários: todos os dias sempre existem; o padrão é "fechado" ────────────

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

// ────────────────────────────────────────────────────────────────────────────
// Seções — cada uma tem seu próprio pedaço do formulário, sua validação e
// o que ela manda pro backend. É isso que permite salvar cada uma sozinha.
// A antiga seção "Identidade" (nome livre do estabelecimento) foi removida:
// o nome exibido no cabeçalho agora vem da empresa e só muda pelo fluxo de
// "Alterar dados" (senha), dentro da aba "Dados da empresa".
// ────────────────────────────────────────────────────────────────────────────

// ── Contato ──────────────────────────────────────────────────────────────────

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

// ── Endereço ─────────────────────────────────────────────────────────────────

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

// ── Horário de funcionamento ─────────────────────────────────────────────────

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

// ── Atendimento e entrega ─────────────────────────────────────────────────────

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
  taxa_entrega: '0,00',
  pedido_minimo: '0,00',
};

const extrairAtendimento = (e: Estabelecimento): AtendimentoForm => ({
  aceita_entrega: e.aceita_entrega,
  aceita_retirada: e.aceita_retirada,
  aceita_mesa: e.aceita_mesa,
  tempo_entrega_min: String(e.tempo_entrega_min ?? 30),
  tempo_entrega_max: String(e.tempo_entrega_max ?? 60),
  taxa_entrega: formatarMoeda(e.taxa_entrega),
  pedido_minimo: formatarMoeda(e.pedido_minimo),
});

function validarAtendimento(v: AtendimentoForm): Erros {
  const erros: Erros = {};
  const min = Number(v.tempo_entrega_min);
  const max = Number(v.tempo_entrega_max);
  if (!Number.isInteger(min) || min < 1) erros.tempo = 'Tempo mínimo inválido.';
  else if (!Number.isInteger(max) || max < min) {
    erros.tempo = 'O tempo máximo deve ser maior ou igual ao mínimo.';
  }
  const taxa = paraNumero(v.taxa_entrega);
  if (!Number.isFinite(taxa) || taxa < 0) erros.taxa_entrega = 'Valor inválido.';
  const minimo = paraNumero(v.pedido_minimo);
  if (!Number.isFinite(minimo) || minimo < 0) erros.pedido_minimo = 'Valor inválido.';
  return erros;
}

const payloadAtendimento = (v: AtendimentoForm): AtualizarEstabelecimentoDTO => ({
  aceita_entrega: v.aceita_entrega,
  aceita_retirada: v.aceita_retirada,
  aceita_mesa: v.aceita_mesa,
  tempo_entrega_min: Number(v.tempo_entrega_min),
  tempo_entrega_max: Number(v.tempo_entrega_max),
  taxa_entrega: paraNumero(v.taxa_entrega),
  pedido_minimo: paraNumero(v.pedido_minimo),
});

// ── PIX ──────────────────────────────────────────────────────────────────────

interface PixForm {
  tipo_chave_pix: TipoChavePix | '';
  chave_pix: string;
}

const PIX_PADRAO: PixForm = { tipo_chave_pix: '', chave_pix: '' };

const extrairPix = (e: Estabelecimento): PixForm => ({
  tipo_chave_pix: e.tipo_chave_pix ?? '',
  chave_pix: e.chave_pix ?? '',
});

function validarPix(v: PixForm): Erros {
  const erros: Erros = {};
  if (v.chave_pix.trim() && !v.tipo_chave_pix) erros.chave_pix = 'Escolha o tipo da chave PIX.';
  return erros;
}

// PIX tem endpoint e DTO próprios (PATCH /estabelecimentos/:id/pix, que exige
// senha_atual) — por isso não usa o useSecao genérico nem o
// AtualizarEstabelecimentoDTO. Ver usePix logo abaixo.

// ────────────────────────────────────────────────────────────────────────────
// Hook: uma seção completa (valor, validação, salvar, descartar)
// ────────────────────────────────────────────────────────────────────────────

interface Secao<T> {
  valor: T;
  definir: <K extends keyof T>(campo: K, valor: T[K]) => void;
  erros: Erros;
  limparErro: (chave: string) => void;
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

  return { valor, definir, erros, limparErro, alterado, salvando, salvoRecente, erroGeral, salvar, descartar };
}

// ── PIX: hook dedicado, sem salvar automático ───────────────────────────────
// Diferente do useSecao, não chama EstabelecimentoService.atualizar. Ele só
// guarda o valor e valida; quem efetivamente salva é confirmarComSenha,
// chamada depois que o usuário confirma a senha no modal (o endpoint de PIX
// exige senha_atual a cada alteração).

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
    setValor((atual) => ({ ...atual, [campo]: v }));
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
      const chave = valor.chave_pix.trim();
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
      if (err?.response?.status === 403) {
        return { ok: false, mensagem: 'Senha incorreta.' };
      }
      const mensagem = mensagemDeErro(err, 'Não foi possível salvar a chave PIX.');
      setErroGeral(mensagem);
      return { ok: false, mensagem };
    } finally {
      setSalvando(false);
    }
  };

  return { valor, definir, erros, alterado, salvando, salvoRecente, erroGeral, validar, confirmarComSenha, descartar };
}

// ────────────────────────────────────────────────────────────────────────────
// Peças de interface
// ────────────────────────────────────────────────────────────────────────────

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

// Cartão de opção clicável usado em "Entrega / Retirada / Pedido na mesa".
// Substitui o antigo switch: mostra o ícone, o rótulo e uma pill de estado.
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

// Cabeçalho padrão de cada (sub)seção: título à esquerda, selo + botões à direita.
const SecaoCabecalho: React.FC<{
  titulo: string;
  id: string;
  secao: Pick<Secao<unknown>, 'alterado' | 'salvando' | 'salvoRecente' | 'erroGeral' | 'salvar' | 'descartar'>;
  podeEditar: boolean;
  icone?: React.ReactNode;
}> = ({ titulo, id, secao, podeEditar, icone }) => (
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
        {secao.alterado && (
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

// ── Diálogo genérico (acessível: Esc fecha, foco entra no diálogo) ──────────

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

// ── Alterar dados sensíveis (exige a senha) ─────────────────────────────────
// Este é o ÚNICO fluxo de edição do nome exibido no cabeçalho: não existe
// mais um botão "Editar perfil" separado — ele cumpriria a mesma função
// deste modal, então foi removido.

interface DadosSensiveis {
  nome_empresa: string;
  razao_social: string;
  nome_responsavel: string;
  email: string;
}

type PassoDadosSensiveis = 'senha' | 'editar';

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
  onSucesso: (novos: DadosSensiveis, emailAlterado: boolean, token: string) => void;
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

    setEnviando(true);
    setErroGeral(null);
    try {
      const resultado = await AuthService.atualizarDadosSensiveis({ senha_atual: senha, ...mudou });
      onSucesso({ ...atuais, ...mudou }, resultado.email_alterado, resultado.token);
    } catch (err: any) {
      const status = err?.response?.status;
      if (status === 403 && /senha/i.test(err?.response?.data?.message ?? '')) {
        setErroGeral('Sua senha não pôde ser confirmada. Volte e digite a senha de novo.');
      } else {
        setErroGeral(mensagemDeErro(err, 'Não foi possível alterar os dados.'));
      }
    } finally {
      setEnviando(false);
    }
  };

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
        dica="Se mudar o e-mail, enviaremos um código para confirmar o novo endereço."
      >
        <input
          id="m-email"
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
          {enviando ? 'Salvando…' : 'Salvar alterações'}
        </button>
      </div>
    </form>
  );
};

const ModalDadosSensiveis: React.FC<{
  atuais: DadosSensiveis;
  podeEmpresa: boolean;
  onFechar: () => void;
  onSucesso: (novos: DadosSensiveis, emailAlterado: boolean, token: string) => void;
}> = ({ atuais, podeEmpresa, onFechar, onSucesso }) => {
  const [passo, setPasso] = useState<PassoDadosSensiveis>('senha');
  const [senhaConfirmada, setSenhaConfirmada] = useState('');

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
        <div className="config__dialogo-passo-item">
          <span className={`config__dialogo-passo ${passo === 'senha' ? 'config__dialogo-passo--ativo' : 'config__dialogo-passo--feito'}`} />
          <small>Senha</small>
        </div>
        <div className="config__dialogo-passo-item">
          <span className={`config__dialogo-passo ${passo === 'editar' ? 'config__dialogo-passo--ativo' : ''}`} />
          <small>Dados</small>
        </div>
      </div>

      <div key={passo} className={`config__dialogo-tela config__dialogo-tela--${passo === 'senha' ? 'entra-dir' : 'entra-esq'}`}>
        {passo === 'senha' ? (
          <PassoSenha onConfirmar={verificarSenha} onFechar={onFechar} />
        ) : (
          <PassoEditar
            atuais={atuais}
            podeEmpresa={podeEmpresa}
            senha={senhaConfirmada}
            onVoltar={() => setPasso('senha')}
            onFechar={onFechar}
            onSucesso={onSucesso}
          />
        )}
      </div>
    </Dialogo>
  );
};

// ── Confirmação de senha para salvar o PIX ──────────────────────────────────
// O endpoint de PIX exige senha_atual em toda alteração (diferente do fluxo
// de dados sensíveis, que confirma a senha uma vez e libera a edição).

const ModalSenhaPix: React.FC<{
  onConfirmar: (senha: string) => Promise<ResultadoPix>;
  onFechar: () => void;
}> = ({ onConfirmar, onFechar }) => {
  const [senha, setSenha] = useState('');
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
          <input
            id="pix-senha"
            ref={campoRef}
            className="config__input"
            type="password"
            autoComplete="current-password"
            value={senha}
            disabled={enviando}
            onChange={(e) => {
              setSenha(e.target.value);
              setErro(null);
            }}
          />
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

// ────────────────────────────────────────────────────────────────────────────
// Tela
// ────────────────────────────────────────────────────────────────────────────

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
  const horario = useSecao(estab, HORARIO_PADRAO, extrairHorario, validarHorario, payloadHorario, mesclar);
  const atendimento = useSecao(estab, ATENDIMENTO_PADRAO, extrairAtendimento, validarAtendimento, payloadAtendimento, mesclar);
  const pix = usePix(estab);
  const [pixModalAberto, setPixModalAberto] = useState(false);

  // PIX fica fora da lista de seções "auto-salváveis": ele exige senha a
  // cada alteração, então não pode ser salvo sozinho no fluxo de saída.
  const secoesAutoSalvaveis = useMemo(
    () => [contato, endereco, horario, atendimento],
    [contato, endereco, horario, atendimento]
  );
  const algumAlterado = secoesAutoSalvaveis.some((s) => s.alterado) || pix.alterado;
  const totalPendentes = secoesAutoSalvaveis.filter((s) => s.alterado).length + (pix.alterado ? 1 : 0);

  const iniciarSalvarPix = () => {
    if (!pix.validar()) return;
    setPixModalAberto(true);
  };

  const confirmarPix = (senha: string) => {
    if (!estab) return Promise.resolve<ResultadoPix>({ ok: false, mensagem: 'Estabelecimento não encontrado.' });
    return pix.confirmarComSenha(estab.id, senha);
  };

  // ── Abas ─────────────────────────────────────────────────────────────────
  const ABAS: { id: AbaId; titulo: string; icone: React.ReactNode; alterado: boolean }[] = [
    { id: 'dados-empresa', titulo: 'Dados da empresa', icone: <HiOfficeBuilding />, alterado: false },
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
      setLogoAviso({ tipo: 'erro', texto: 'A imagem passa de 5MB. Escolha uma menor.' });
      return;
    }

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

  const aoAlterarDadosSensiveis = (novos: DadosSensiveis, emailAlterado: boolean, token: string) => {
    setModalSensivel(false);
    if (usuario) {
      entrar({
        token,
        usuario: {
          id: usuario.id,
          nome: novos.nome_responsavel,
          email: novos.email,
          perfil: usuario.perfil,
          escopo: usuario.escopo,
          estabelecimento_id: usuario.estabelecimento_id,
          empresa_id: usuario.empresa_id,
        },
      });
    }
    void recarregar();
    if (emailAlterado) {
      navigate('/verify-code', { state: { email: novos.email, mode: 'register' } });
      return;
    }
    setAvisoGeral({ tipo: 'ok', texto: 'Dados alterados com sucesso.' });
  };

  // ── Estados de carregamento / erro ────────────────────────────────────────

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

  // Nome exibido no cabeçalho: vem da empresa (dado protegido) — não existe
  // mais um campo de "nome do restaurante" livre, editável fora do fluxo de
  // senha. Ver ModalDadosSensiveis / PassoEditar.
  const nomeExibido = empresa?.nome ?? estab.nome ?? 'Restaurante';
  // `ativo` ainda não existe no tipo Estabelecimento — adicionar no service
  // quando o backend expuser esse campo. Até lá, assume true.
  const estabAtivo = (estab as unknown as { ativo?: boolean }).ativo ?? true;

  return (
    <RestaurantLayout>
      <div className="config">
        {/* Cabeçalho */}
        <header className="config__cabecalho">
          <div className="config__cabecalho-perfil">
            <div className="config__avatar-col">
              <img
                className="config__avatar"
                src={estab.logo_url ?? LOGO_PADRAO}
                alt={`Logo de ${nomeExibido}`}
                onError={(e) => {
                  e.currentTarget.src = LOGO_PADRAO;
                }}
              />
              {podeEditar && (
                <button
                  className="config__btn config__btn--pequeno"
                  type="button"
                  onClick={() => inputLogoRef.current?.click()}
                  disabled={enviandoLogo}
                >
                  <HiUpload /> {enviandoLogo ? 'Enviando…' : 'Alterar logo'}
                </button>
              )}
              <input
                ref={inputLogoRef}
                type="file"
                accept="image/jpeg,image/png"
                className="config__arquivo"
                onChange={escolherLogo}
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
                onClick={() => setAbaAtiva(aba.id)}
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

          {/* Contato e Endereço */}
          {abaAtiva === 'contato-endereco' && (
            <div className="config__duas-colunas">
              <section className="config__subcard" aria-labelledby="sec-contato">
                <SecaoCabecalho titulo="Contato" id="sec-contato" secao={contato} podeEditar={podeEditar} icone={<HiPhone />} />
                {contato.erroGeral && <p className="config__erro" role="alert">{contato.erroGeral}</p>}
                <div className="config__grade config__grade--1col">
                  <Campo id="telefone" rotulo="Telefone" erro={contato.erros.telefone} dica="Opcional. Aparece no seu cardápio.">
                    <input
                      id="telefone"
                      className="config__input"
                      inputMode="tel"
                      placeholder="(11) 3456-7890"
                      value={contato.valor.telefone}
                      disabled={!podeEditar || contato.salvando}
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
                      disabled={!podeEditar || contato.salvando}
                      onChange={(e) => contato.definir('whatsapp', mascaraTelefone(e.target.value))}
                    />
                  </Campo>
                  <Campo
                    id="email-contato"
                    rotulo="E-mail de contato"
                    erro={contato.erros.email}
                    dica="Opcional. Diferente do e-mail de acesso, este é o que seus clientes veem."
                  >
                    <input
                      id="email-contato"
                      className="config__input"
                      type="email"
                      placeholder="contato@seurestaurante.com.br"
                      value={contato.valor.email}
                      disabled={!podeEditar || contato.salvando}
                      onChange={(e) => contato.definir('email', e.target.value)}
                    />
                  </Campo>
                </div>
              </section>

              <section className="config__subcard" aria-labelledby="sec-endereco">
                <SecaoCabecalho titulo="Endereço" id="sec-endereco" secao={endereco} podeEditar={podeEditar} icone={<HiLocationMarker />} />
                {endereco.erroGeral && <p className="config__erro" role="alert">{endereco.erroGeral}</p>}
                <div className="config__grade config__grade--endereco-compacta">
                  <Campo id="cep" rotulo="CEP" erro={endereco.erros.cep} className="config__col-cep">
                    <input
                      id="cep"
                      className="config__input"
                      inputMode="numeric"
                      placeholder="00000-000"
                      value={endereco.valor.cep}
                      disabled={!podeEditar || endereco.salvando}
                      onChange={(e) => endereco.definir('cep', mascaraCep(e.target.value))}
                    />
                  </Campo>
                  <Campo id="rua" rotulo="Rua" erro={endereco.erros.rua} className="config__col-rua">
                    <input
                      id="rua"
                      className="config__input"
                      value={endereco.valor.rua}
                      maxLength={150}
                      disabled={!podeEditar || endereco.salvando}
                      onChange={(e) => endereco.definir('rua', e.target.value)}
                    />
                  </Campo>
                  <Campo id="numero" rotulo="Número" erro={endereco.erros.numero} className="config__col-numero">
                    <input
                      id="numero"
                      className="config__input"
                      value={endereco.valor.numero}
                      maxLength={10}
                      disabled={!podeEditar || endereco.salvando}
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
                      disabled={!podeEditar || endereco.salvando}
                      onChange={(e) => endereco.definir('complemento', e.target.value)}
                    />
                  </Campo>
                  <Campo id="bairro" rotulo="Bairro" erro={endereco.erros.bairro} className="config__col-bairro">
                    <input
                      id="bairro"
                      className="config__input"
                      value={endereco.valor.bairro}
                      maxLength={80}
                      disabled={!podeEditar || endereco.salvando}
                      onChange={(e) => endereco.definir('bairro', e.target.value)}
                    />
                  </Campo>
                  <Campo id="cidade" rotulo="Cidade" erro={endereco.erros.cidade} className="config__col-cidade">
                    <input
                      id="cidade"
                      className="config__input"
                      value={endereco.valor.cidade}
                      maxLength={80}
                      disabled={!podeEditar || endereco.salvando}
                      onChange={(e) => endereco.definir('cidade', e.target.value)}
                    />
                  </Campo>
                  <Campo id="estado" rotulo="Estado" erro={endereco.erros.estado} className="config__col-uf">
                    <select
                      id="estado"
                      className="config__input config__select"
                      value={endereco.valor.estado}
                      disabled={!podeEditar || endereco.salvando}
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
                  <CartaoOpcao
                    id="aceita-mesa"
                    rotulo="Pedido na mesa"
                    icone={<HiUserGroup />}
                    marcado={atendimento.valor.aceita_mesa}
                    desabilitado={!podeEditar || atendimento.salvando}
                    onChange={(v) => atendimento.definir('aceita_mesa', v)}
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
                      inputMode="decimal"
                      value={atendimento.valor.taxa_entrega}
                      disabled={!podeEditar || atendimento.salvando}
                      onChange={(e) => atendimento.definir('taxa_entrega', e.target.value)}
                    />
                  </Campo>
                  <Campo id="minimo" rotulo="Pedido mínimo (R$)" erro={atendimento.erros.pedido_minimo}>
                    <input
                      id="minimo"
                      className="config__input"
                      inputMode="decimal"
                      value={atendimento.valor.pedido_minimo}
                      disabled={!podeEditar || atendimento.salvando}
                      onChange={(e) => atendimento.definir('pedido_minimo', e.target.value)}
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
                  {podeEditar && (
                    <div className="config__secao-controles">
                      <SecaoStatus
                        alterado={pix.alterado}
                        salvando={pix.salvando}
                        salvoRecente={pix.salvoRecente}
                        comErro={Boolean(pix.erroGeral)}
                      />
                      {pix.alterado && (
                        <div className="config__secao-acoes">
                          <button className="config__btn config__btn--pequeno" type="button" onClick={pix.descartar} disabled={pix.salvando}>
                            Descartar
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
                {pix.erroGeral && <p className="config__erro" role="alert">{pix.erroGeral}</p>}

                <div className="config__grade config__grade--1col">
                  <Campo id="tipo-pix" rotulo="Tipo da chave">
                    <select
                      id="tipo-pix"
                      className="config__input config__select"
                      value={pix.valor.tipo_chave_pix}
                      disabled={!podeEditar || pix.salvando}
                      onChange={(e) => pix.definir('tipo_chave_pix', e.target.value as TipoChavePix | '')}
                    >
                      <option value="">Sem chave PIX</option>
                      {TIPOS_PIX.map((t) => (
                        <option key={t.valor} value={t.valor}>{t.rotulo}</option>
                      ))}
                    </select>
                  </Campo>
                  <Campo id="chave-pix" rotulo="Chave PIX" erro={pix.erros.chave_pix} dica="Opcional.">
                    <input
                      id="chave-pix"
                      className="config__input"
                      value={pix.valor.chave_pix}
                      maxLength={150}
                      disabled={!podeEditar || pix.salvando}
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
        />
      )}

      {pixModalAberto && (
        <ModalSenhaPix onConfirmar={confirmarPix} onFechar={() => setPixModalAberto(false)} />
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