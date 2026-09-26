import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  HiArrowLeft,
  HiCheckCircle,
  HiClipboardList,
  HiExclamationCircle,
  HiLockClosed,
  HiLogout,
  HiPencil,
  HiUpload,
  HiX,
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
// ────────────────────────────────────────────────────────────────────────────

// ── Identidade (só o nome — a logo tem upload próprio, fora daqui) ──────────

interface IdentidadeForm {
  nome: string;
}

const IDENTIDADE_PADRAO: IdentidadeForm = { nome: '' };

const extrairIdentidade = (e: Estabelecimento): IdentidadeForm => ({ nome: e.nome ?? '' });

function validarIdentidade(v: IdentidadeForm): Erros {
  const erros: Erros = {};
  if (v.nome.trim().length < 2) erros.nome = 'Informe o nome do restaurante.';
  return erros;
}

const payloadIdentidade = (v: IdentidadeForm): AtualizarEstabelecimentoDTO => ({ nome: v.nome.trim() });

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

// ── PIX é dado sensível: não usa o hook useSecao (que salva sem senha).
// A leitura para exibição usa os campos crus do Estabelecimento; a edição
// passa pelo ModalPix (senha → editar) definido mais abaixo.
function mascararChavePix(chave: string | null, tipo: TipoChavePix | null): string {
  if (!chave) return 'Nenhuma chave cadastrada';
  if (tipo === 'EMAIL' || tipo === 'ALEATORIA') {
    return chave.length <= 4 ? '••••' : `${'•'.repeat(chave.length - 4)}${chave.slice(-4)}`;
  }
  // CPF/CNPJ/telefone: mostra só os 4 últimos dígitos
  const digitos = chave.replace(/\D/g, '');
  return digitos.length <= 4 ? '••••' : `${'•'.repeat(digitos.length - 4)}${digitos.slice(-4)}`;
}

// ── Customização do site (tema) ───────────────────────────────────────────────

interface TemaForm {
  tema: 'CLARO' | 'ESCURO';
}

const TEMA_PADRAO: TemaForm = { tema: 'CLARO' };

const extrairTema = (e: Estabelecimento): TemaForm => ({ tema: e.tema ?? 'CLARO' });

function validarTema(_v: TemaForm): Erros {
  return {};
}

const payloadTema = (v: TemaForm): AtualizarEstabelecimentoDTO => ({ tema: v.tema });

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

  // Carrega os dados do banco uma única vez por estabelecimento — nunca por
  // cima de uma edição em andamento, mesmo que outra seção seja salva e o
  // contexto avise sobre uma leitura nova.
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

const Interruptor: React.FC<{
  id: string;
  rotulo: string;
  descricao: string;
  marcado: boolean;
  desabilitado: boolean;
  onChange: (v: boolean) => void;
}> = ({ id, rotulo, descricao, marcado, desabilitado, onChange }) => (
  <label className="config__switch" htmlFor={id}>
    <input
      id={id}
      type="checkbox"
      role="switch"
      checked={marcado}
      disabled={desabilitado}
      onChange={(e) => onChange(e.target.checked)}
    />
    <span className="config__switch-trilho" aria-hidden="true" />
    <span className="config__switch-texto">
      <strong>{rotulo}</strong>
      <small>{descricao}</small>
    </span>
  </label>
);

// Selo de status no canto do card — mesma ideia dos badges "Aberta/Fechada"
// da tela de Caixa, só que aqui é sobre a própria seção do formulário.
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

// Cabeçalho padrão de cada seção: título à esquerda, selo + botões à direita.
// É esse par (selo + Salvar/Descartar) que muda de uma seção pra outra —
// o resto do card é conteúdo livre (os campos).
const SecaoCabecalho: React.FC<{
  titulo: string;
  id: string;
  secao: Pick<Secao<unknown>, 'alterado' | 'salvando' | 'salvoRecente' | 'erroGeral' | 'salvar' | 'descartar'>;
  podeEditar: boolean;
}> = ({ titulo, id, secao, podeEditar }) => (
  <div className="config__card-cabecalho">
    <h3 className="config__card-titulo" id={id}>{titulo}</h3>
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

interface DadosSensiveis {
  nome_empresa: string;
  razao_social: string;
  nome_responsavel: string;
  email: string;
}

type PassoDadosSensiveis = 'senha' | 'editar';

// Passo 1: só a senha. Foca sozinho e confirma com Enter.
const PassoSenha: React.FC<{
  onConfirmar: (senha: string) => Promise<string | null>; // devolve a mensagem de erro, ou null se deu certo
  onFechar: () => void;
}> = ({ onConfirmar, onFechar }) => {
  const [senha, setSenha] = useState('');
  const [erro, setErro] = useState<string | null>(null);
  const [verificando, setVerificando] = useState(false);
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
    setVerificando(true);
    setErro(null);
    const mensagem = await onConfirmar(senha);
    setVerificando(false);
    if (mensagem) {
      setErro(mensagem);
      campoRef.current?.focus();
      campoRef.current?.select();
    }
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

      <Campo id="m-senha" rotulo="Sua senha atual" erro={erro ?? undefined}>
        <input
          id="m-senha"
          ref={campoRef}
          className="config__input"
          type="password"
          autoComplete="current-password"
          value={senha}
          disabled={verificando}
          onChange={(e) => {
            setSenha(e.target.value);
            setErro(null);
          }}
        />
      </Campo>

      <div className="config__acoes config__acoes--fim">
        <button className="config__btn" type="button" onClick={onFechar} disabled={verificando}>
          Cancelar
        </button>
        <button className="config__btn config__btn--primario" type="submit" disabled={verificando}>
          {verificando ? 'Verificando…' : 'Confirmar senha'}
        </button>
      </div>
    </form>
  );
};

// Passo 2: edição liberada, com a senha já confirmada guardada em memória.
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

    // Só envia o que realmente mudou
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
        // A senha era válida no passo 1, mas pode ter sido trocada nesse meio-tempo (raro)
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
      <p className="config__hint">Altere apenas o que precisa. O resto continua como está.</p>

      <Campo
        id="m-empresa"
        rotulo="Nome da empresa"
        erro={erros.nome_empresa}
        bloqueado={!podeEmpresa}
        dica={!podeEmpresa ? 'Somente administradores podem alterar.' : undefined}
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
        <span className={`config__dialogo-passo ${passo === 'senha' ? 'config__dialogo-passo--ativo' : 'config__dialogo-passo--feito'}`} />
        <span className={`config__dialogo-passo ${passo === 'editar' ? 'config__dialogo-passo--ativo' : ''}`} />
      </div>

      {/* Só o passo ativo fica no DOM — evita que campos escondidos continuem
          alcançáveis pelo teclado e some com a duplicidade de rótulos. */}
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

// ── Alterar chave PIX (dado sensível: exige senha + só quem tem permissão) ──

type PassoPix = 'senha' | 'editar';

const PassoEditarPix: React.FC<{
  estabelecimentoId: string;
  tipoAtual: TipoChavePix | '';
  chaveAtual: string;
  senha: string;
  onVoltar: () => void;
  onFechar: () => void;
  onSucesso: (tipo: TipoChavePix | null, chave: string | null) => void;
}> = ({ estabelecimentoId, tipoAtual, chaveAtual, senha, onVoltar, onFechar, onSucesso }) => {
  const [tipo, setTipo] = useState<TipoChavePix | ''>(tipoAtual);
  const [chave, setChave] = useState(chaveAtual);
  const [erros, setErros] = useState<Erros>({});
  const [erroGeral, setErroGeral] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  const primeiroCampoRef = useRef<HTMLSelectElement>(null);

  useEffect(() => {
    primeiroCampoRef.current?.focus();
  }, []);

  const confirmar = async (e: React.FormEvent) => {
    e.preventDefault();

    const chaveLimpa = chave.trim();
    const encontrados: Erros = {};
    if (chaveLimpa && !tipo) encontrados.chave_pix = 'Escolha o tipo da chave PIX.';
    if (Object.keys(encontrados).length > 0) {
      setErros(encontrados);
      return;
    }

    setEnviando(true);
    setErroGeral(null);
    try {
      const payload: AtualizarPixDTO = {
        senha_atual: senha,
        chave_pix: chaveLimpa || null,
        tipo_chave_pix: chaveLimpa && tipo ? tipo : null,
      };
      const estab = await EstabelecimentoService.atualizarPix(estabelecimentoId, payload);
      onSucesso(estab.tipo_chave_pix, estab.chave_pix);
    } catch (err: any) {
      const status = err?.response?.status;
      if (status === 403 && /senha/i.test(err?.response?.data?.message ?? '')) {
        setErroGeral('Sua senha não pôde ser confirmada. Volte e digite a senha de novo.');
      } else {
        setErroGeral(mensagemDeErro(err, 'Não foi possível alterar a chave PIX.'));
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

      <h3 className="config__card-titulo">Alterar chave PIX</h3>
      <p className="config__hint">É para esta chave que os pagamentos do seu cardápio caem.</p>

      <Campo id="m-tipo-pix" rotulo="Tipo da chave">
        <select
          id="m-tipo-pix"
          ref={primeiroCampoRef}
          className="config__input config__select"
          value={tipo}
          disabled={enviando}
          onChange={(e) => { setTipo(e.target.value as TipoChavePix | ''); setErros({}); }}
        >
          <option value="">Sem chave PIX</option>
          {TIPOS_PIX.map((t) => (
            <option key={t.valor} value={t.valor}>{t.rotulo}</option>
          ))}
        </select>
      </Campo>
      <Campo id="m-chave-pix" rotulo="Chave PIX" erro={erros.chave_pix}>
        <input
          id="m-chave-pix"
          className="config__input"
          value={chave}
          maxLength={150}
          disabled={enviando}
          onChange={(e) => { setChave(e.target.value); setErros({}); }}
        />
      </Campo>

      {erroGeral && <p className="config__erro" role="alert">{erroGeral}</p>}

      <div className="config__acoes config__acoes--fim">
        <button className="config__btn" type="button" onClick={onFechar} disabled={enviando}>
          Cancelar
        </button>
        <button className="config__btn config__btn--primario" type="submit" disabled={enviando}>
          {enviando ? 'Salvando…' : 'Salvar chave PIX'}
        </button>
      </div>
    </form>
  );
};

const ModalPix: React.FC<{
  estabelecimentoId: string;
  tipoAtual: TipoChavePix | '';
  chaveAtual: string;
  onFechar: () => void;
  onSucesso: (tipo: TipoChavePix | null, chave: string | null) => void;
}> = ({ estabelecimentoId, tipoAtual, chaveAtual, onFechar, onSucesso }) => {
  const [passo, setPasso] = useState<PassoPix>('senha');
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
    <Dialogo titulo="Alterar chave PIX" onFechar={onFechar}>
      <div className="config__dialogo-passos" aria-hidden="true">
        <span className={`config__dialogo-passo ${passo === 'senha' ? 'config__dialogo-passo--ativo' : 'config__dialogo-passo--feito'}`} />
        <span className={`config__dialogo-passo ${passo === 'editar' ? 'config__dialogo-passo--ativo' : ''}`} />
      </div>

      <div key={passo} className={`config__dialogo-tela config__dialogo-tela--${passo === 'senha' ? 'entra-dir' : 'entra-esq'}`}>
        {passo === 'senha' ? (
          <PassoSenha onConfirmar={verificarSenha} onFechar={onFechar} />
        ) : (
          <PassoEditarPix
            estabelecimentoId={estabelecimentoId}
            tipoAtual={tipoAtual}
            chaveAtual={chaveAtual}
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

// ────────────────────────────────────────────────────────────────────────────
// Tela
// ────────────────────────────────────────────────────────────────────────────

const Config: React.FC = () => {
  const navigate = useNavigate();
  const { sair, entrar } = useAuth();
  const { perfil, carregando, erro, recarregar, mesclarEstabelecimento } = useEstabelecimento();

  const estab = perfil?.estabelecimento ?? null;
  const empresa = perfil?.empresa ?? null;
  const usuario = perfil?.usuario ?? null;
  const podeEditar = usuario?.perfil === 'ADMIN';
  // PIX é dado sensível: além de ADMIN, exige escopo GLOBAL (o dono da
  // empresa, não um admin restrito a um único estabelecimento).
  const podePix = podeEditar && usuario?.escopo === 'GLOBAL';

  const [enviandoLogo, setEnviandoLogo] = useState(false);
  const [logoAviso, setLogoAviso] = useState<{ tipo: 'ok' | 'erro'; texto: string } | null>(null);
  const inputLogoRef = useRef<HTMLInputElement>(null);
  const [avisoGeral, setAvisoGeral] = useState<{ tipo: 'ok' | 'erro'; texto: string } | null>(null);
  const [modalSensivel, setModalSensivel] = useState(false);
  const [modalPix, setModalPix] = useState(false);
  const [saidaPendente, setSaidaPendente] = useState<null | (() => void)>(null);
  const [salvandoSaida, setSalvandoSaida] = useState(false);

  // Sempre que a tela abre, relê o cadastro do banco
  useEffect(() => {
    void recarregar();
  }, [recarregar]);

  // Cada seção do formulário cuida de si mesma — ver useSecao(). PIX não
  // entra aqui: é dado sensível e usa o fluxo do ModalPix (senha + permissão).
  const mesclar = (payload: AtualizarEstabelecimentoDTO) => mesclarEstabelecimento(payload as Partial<Estabelecimento>);
  const identidade = useSecao(estab, IDENTIDADE_PADRAO, extrairIdentidade, validarIdentidade, payloadIdentidade, mesclar);
  const contato = useSecao(estab, CONTATO_PADRAO, extrairContato, validarContato, payloadContato, mesclar);
  const endereco = useSecao(estab, ENDERECO_PADRAO, extrairEndereco, validarEndereco, payloadEndereco, mesclar);
  const horario = useSecao(estab, HORARIO_PADRAO, extrairHorario, validarHorario, payloadHorario, mesclar);
  const atendimento = useSecao(estab, ATENDIMENTO_PADRAO, extrairAtendimento, validarAtendimento, payloadAtendimento, mesclar);
  const customizacao = useSecao(estab, TEMA_PADRAO, extrairTema, validarTema, payloadTema, mesclar);

  const secoes = useMemo(
    () => [identidade, contato, endereco, horario, atendimento, customizacao],
    [identidade, contato, endereco, horario, atendimento, customizacao]
  );
  const algumAlterado = secoes.some((s) => s.alterado);
  const totalPendentes = secoes.filter((s) => s.alterado).length;

  // ── Abas: Identidade fica fora, fixa no topo — só o resto vira aba ─────────
  const ABAS = [
    { id: 'empresa', titulo: 'Dados da empresa', alterado: false },
    { id: 'contato', titulo: 'Contato e Endereço', alterado: contato.alterado || endereco.alterado },
    { id: 'horario', titulo: 'Horário de funcionamento', alterado: horario.alterado },
    { id: 'atendimento', titulo: 'Atendimento, entrega e PIX', alterado: atendimento.alterado },
    { id: 'customizacao', titulo: 'Customização do site', alterado: customizacao.alterado },
  ] as const;
  type AbaId = (typeof ABAS)[number]['id'];
  const [abaAtiva, setAbaAtiva] = useState<AbaId>('empresa');

  // Some sozinho o aviso de sucesso
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

  // Alterações não salvas em qualquer seção: avisa antes de fechar a aba
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
    // Ao abrir um dia pela primeira vez, já sugere um horário para não ficar vazio
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

  // Se há alterações não salvas em alguma seção, pergunta antes de sair
  const sairDaConta = () => {
    if (algumAlterado) setSaidaPendente(() => executarSaida);
    else executarSaida();
  };

  // Clique em qualquer link do menu com alterações pendentes → pergunta se quer salvar
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

  // Salva todas as seções que estiverem pendentes e só então sai
  const salvarESair = async () => {
    if (!saidaPendente) return;
    setSalvandoSaida(true);
    const pendentes = secoes.filter((s) => s.alterado);
    const resultados = await Promise.all(pendentes.map((s) => s.salvar()));
    setSalvandoSaida(false);
    if (resultados.every(Boolean)) {
      const ir = saidaPendente;
      setSaidaPendente(null);
      ir();
    } else {
      setSaidaPendente(null); // fica na tela para corrigir; o erro de cada seção já aparece nela
    }
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
      // O e-mail novo precisa ser confirmado com o código enviado
      navigate('/verify-code', { state: { email: novos.email, mode: 'register' } });
      return;
    }
    setAvisoGeral({ tipo: 'ok', texto: 'Dados alterados com sucesso.' });
  };

  const abrirModalPix = () => {
    if (algumAlterado) {
      setAvisoGeral({
        tipo: 'erro',
        texto: 'Salve ou descarte as alterações pendentes antes de mudar a chave PIX.',
      });
      return;
    }
    setAvisoGeral(null);
    setModalPix(true);
  };

  const aoAlterarPix = (tipo: TipoChavePix | null, chave: string | null) => {
    setModalPix(false);
    mesclarEstabelecimento({ tipo_chave_pix: tipo, chave_pix: chave });
    setAvisoGeral({ tipo: 'ok', texto: 'Chave PIX atualizada com sucesso.' });
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

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <RestaurantLayout>
      <div className="config">
        {/* Cabeçalho */}
        <header className="config__cabecalho">
          <div>
            <h2 className="config__titulo">Perfil do restaurante</h2>
            <p className="config__subtitulo">
              Cada seção é salva por conta própria. Campos com cadeado vêm do cadastro e não podem ser alterados aqui.
            </p>
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

        {/* Identidade — fora das seções: sempre visível no topo, centralizada */}
        <section className="config__identidade-topo" aria-labelledby="sec-identidade">
          <div className="config__identidade-avatar-col">
            <img
              className="config__avatar config__avatar--grande"
              src={estab.logo_url ?? LOGO_PADRAO}
              alt={`Logo de ${estab.nome}`}
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
            {logoAviso && (
              <p className={logoAviso.tipo === 'erro' ? 'config__erro' : 'config__hint'} role={logoAviso.tipo === 'erro' ? 'alert' : undefined}>
                {logoAviso.texto}
              </p>
            )}
            <input
              ref={inputLogoRef}
              type="file"
              accept="image/jpeg,image/png"
              className="config__arquivo"
              onChange={escolherLogo}
            />
          </div>

          <div className="config__identidade-nome-col">
            <input
              id="nome-identidade"
              className="config__input config__input--nome-topo"
              value={identidade.valor.nome}
              maxLength={150}
              disabled={!podeEditar || identidade.salvando}
              onChange={(e) => identidade.definir('nome', e.target.value)}
              aria-label="Nome do restaurante"
            />
            {identidade.erros.nome && <p className="config__erro" role="alert">{identidade.erros.nome}</p>}
            {identidade.erroGeral && <p className="config__erro" role="alert">{identidade.erroGeral}</p>}

            {podeEditar && identidade.alterado && (
              <div className="config__secao-acoes config__secao-acoes--centro">
                <button className="config__btn config__btn--pequeno" type="button" onClick={identidade.descartar} disabled={identidade.salvando}>
                  Descartar
                </button>
                <button
                  className="config__btn config__btn--primario config__btn--pequeno"
                  type="button"
                  onClick={() => void identidade.salvar()}
                  disabled={identidade.salvando}
                >
                  {identidade.salvando ? 'Salvando…' : 'Salvar'}
                </button>
              </div>
            )}
            {identidade.salvoRecente && (
              <span className="config__secao-status config__secao-status--ok"><HiCheckCircle /> Salvo</span>
            )}
          </div>
        </section>

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

        {/* Painel com abas — a mesma ideia da tela de Caixa: uma barra de
            abas em cima, e só o conteúdo da aba ativa aparece embaixo. */}
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
                {aba.titulo}
                {aba.alterado && <span className="config__aba-ponto" aria-hidden="true" />}
              </button>
            ))}
          </div>

        {/* Dados da empresa: alterar exige a senha */}
        {abaAtiva === 'empresa' && (
        <section className="config__card" aria-labelledby="sec-cadastro">
          <div className="config__card-cabecalho">
            <h3 className="config__card-titulo" id="sec-cadastro">Dados da empresa</h3>
            <button className="config__btn config__btn--pequeno" type="button" onClick={abrirDadosSensiveis}>
              <HiPencil /> Alterar dados
            </button>
          </div>
          <div className="config__grade">
            <Bloqueado id="cad-empresa" rotulo="Nome da empresa" valor={empresa?.nome} />
            <Bloqueado id="cad-razao" rotulo="Razão social" valor={empresa?.razao_social} />
            <Bloqueado id="cad-resp" rotulo="Responsável" valor={usuario.nome} />
            <Bloqueado id="cad-email" rotulo="E-mail de acesso" valor={usuario.email} />
            <Bloqueado id="cad-cnpj" rotulo="CNPJ" valor={empresa?.cnpj ?? estab.cnpj} />
            <Bloqueado id="cad-cpf" rotulo="CPF do responsável" valor={usuario.cpf} />
          </div>
          <p className="config__hint">
            Para mudar nome da empresa, razão social, responsável ou e-mail, confirme sua senha.
            CNPJ e CPF não podem ser alterados.
          </p>
        </section>
        )}

        {/* Contato */}
        {abaAtiva === 'contato' && (
        <>
        <section className="config__card" aria-labelledby="sec-contato">
          <SecaoCabecalho titulo="Contato" id="sec-contato" secao={contato} podeEditar={podeEditar} />
          {contato.erroGeral && <p className="config__erro" role="alert">{contato.erroGeral}</p>}

          <div className="config__grade">
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
              className="config__span-2"
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

        {/* Endereço — mesma aba de Contato, card separado (salva por conta própria) */}
        <section className="config__card" aria-labelledby="sec-endereco">
          <SecaoCabecalho titulo="Endereço" id="sec-endereco" secao={endereco} podeEditar={podeEditar} />
          {endereco.erroGeral && <p className="config__erro" role="alert">{endereco.erroGeral}</p>}

          <div className="config__grade config__grade--endereco">
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
            <Campo id="complemento" rotulo="Complemento" className="config__col-compl">
              <input
                id="complemento"
                className="config__input"
                placeholder="Sala, andar, referência… (opcional)"
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
        </>
        )}

        {/* Horários */}
        {abaAtiva === 'horario' && (
        <section className="config__card" aria-labelledby="sec-horarios">
          <SecaoCabecalho titulo="Horário de funcionamento" id="sec-horarios" secao={horario} podeEditar={podeEditar} />
          {horario.erroGeral && <p className="config__erro" role="alert">{horario.erroGeral}</p>}
          <p className="config__hint">
            Todos os dias começam fechados. Abra os dias em que você atende e defina o horário.
          </p>

          <ul className="config__dias">
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

        {/* Atendimento */}
        {abaAtiva === 'atendimento' && (
        <section className="config__card" aria-labelledby="sec-atendimento">
          <SecaoCabecalho titulo="Atendimento e entrega" id="sec-atendimento" secao={atendimento} podeEditar={podeEditar} />
          {atendimento.erroGeral && <p className="config__erro" role="alert">{atendimento.erroGeral}</p>}

          <div className="config__interruptores">
            <Interruptor
              id="aceita-entrega"
              rotulo="Entrega"
              descricao="Clientes podem pedir para receber em casa."
              marcado={atendimento.valor.aceita_entrega}
              desabilitado={!podeEditar || atendimento.salvando}
              onChange={(v) => atendimento.definir('aceita_entrega', v)}
            />
            <Interruptor
              id="aceita-retirada"
              rotulo="Retirada"
              descricao="Clientes buscam o pedido no balcão."
              marcado={atendimento.valor.aceita_retirada}
              desabilitado={!podeEditar || atendimento.salvando}
              onChange={(v) => atendimento.definir('aceita_retirada', v)}
            />
            <Interruptor
              id="aceita-mesa"
              rotulo="Pedido na mesa"
              descricao="Clientes pedem pelo cardápio da mesa."
              marcado={atendimento.valor.aceita_mesa}
              desabilitado={!podeEditar || atendimento.salvando}
              onChange={(v) => atendimento.definir('aceita_mesa', v)}
            />
          </div>

          <div className="config__grade config__grade--4">
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
        )}

        {/* PIX — dado sensível: mesma aba de Atendimento, card separado */}
        {abaAtiva === 'atendimento' && (
        <section className="config__card" aria-labelledby="sec-pix">
          <div className="config__card-cabecalho">
            <h3 className="config__card-titulo" id="sec-pix">Recebimento por PIX</h3>
            {podePix && (
              <button className="config__btn config__btn--pequeno" type="button" onClick={abrirModalPix}>
                <HiPencil /> Alterar chave PIX
              </button>
            )}
          </div>
          <div className="config__grade">
            <Bloqueado
              id="pix-tipo"
              rotulo="Tipo da chave"
              valor={estab.tipo_chave_pix ? TIPOS_PIX.find((t) => t.valor === estab.tipo_chave_pix)?.rotulo : null}
            />
            <Bloqueado
              id="pix-chave"
              rotulo="Chave PIX"
              valor={mascararChavePix(estab.chave_pix, estab.tipo_chave_pix)}
            />
          </div>
          <p className="config__hint">
            {podePix
              ? 'Dado sensível: para alterar, confirme sua senha atual.'
              : 'Dado sensível — apenas o dono da empresa pode alterar a chave PIX.'}
          </p>
        </section>
        )}

        {/* Customização do site */}
        {abaAtiva === 'customizacao' && (
        <section className="config__card" aria-labelledby="sec-customizacao">
          <SecaoCabecalho titulo="Customização do site" id="sec-customizacao" secao={customizacao} podeEditar={podeEditar} />
          {customizacao.erroGeral && <p className="config__erro" role="alert">{customizacao.erroGeral}</p>}

          <div className="config__campo">
            <label className="config__label">Tema do cardápio</label>
            <div className="config__radio-grupo">
              <label className="config__radio-label">
                <input
                  type="radio"
                  name="tema"
                  checked={customizacao.valor.tema === 'CLARO'}
                  disabled={!podeEditar || customizacao.salvando}
                  onChange={() => customizacao.definir('tema', 'CLARO')}
                />
                Tema claro
              </label>
              <label className="config__radio-label">
                <input
                  type="radio"
                  name="tema"
                  checked={customizacao.valor.tema === 'ESCURO'}
                  disabled={!podeEditar || customizacao.salvando}
                  onChange={() => customizacao.definir('tema', 'ESCURO')}
                />
                Tema escuro
              </label>
            </div>
            <p className="config__hint">Define a aparência do cardápio público do seu restaurante.</p>
          </div>
        </section>
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

      {modalPix && (
        <ModalPix
          estabelecimentoId={estab.id}
          tipoAtual={estab.tipo_chave_pix ?? ''}
          chaveAtual={estab.chave_pix ?? ''}
          onFechar={() => setModalPix(false)}
          onSucesso={aoAlterarPix}
        />
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
