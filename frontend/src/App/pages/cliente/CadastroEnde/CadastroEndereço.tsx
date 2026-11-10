import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { HiHome, HiOfficeBuilding, HiCheckCircle } from 'react-icons/hi';
import { MdDiamond } from 'react-icons/md';
import { FiEdit2, FiPhone, FiPlus, FiTrash2 } from 'react-icons/fi';
import CustomerLayout from '../../../shared/components/layout/Customerlayout';
import { useClienteAuth } from '../../../shared/contexts/ClienteAuthContext';
import { useRestauranteCliente } from '../../../shared/contexts/RestauranteClienteContext';
import { useCarrinho } from '../../../shared/contexts/CarrinhoContext';
import PagamentoPedido, { trocoParaNumero } from '../../../shared/components/PagamentoPedido/PagamentoPedido';
import {
  UFS_BR, buscarCepViaCep, cepValido, formatarCep, formatarTelefone, numeroValido, telefoneValido,
} from '../../../shared/utils/enderecoValidacao';
import EnderecoClienteService from '../../../services/enderecoCliente.service';
import PedidoClienteService, { FormaPagamentoOnline, PedidoCriado, itensDoCarrinho } from '../../../services/pedidoCliente.service';
import '../../../shared/components/PagamentoPedido/PagamentoPedido.css';
import './CadastroEndereço.css';

type TipoEndereco = 'Casa' | 'Trabalho' | 'Outro' | string;

/**
 * 'selecionar' → cliente escolhe um endereço salvo para entrega
 * 'cadastrar'  → cliente preenche um novo endereço
 */
type Modo = 'selecionar' | 'cadastrar';

interface Endereco {
  id: string;
  tipo: TipoEndereco;
  cep: string;
  rua: string;
  numero: string;
  complemento: string;
  bairro: string;
  cidade: string;
  estado: string;
  referencia: string;
  telefone: string;
  principal: boolean;
}

/** De onde um telefone veio: do cadastro da conta ou de um endereço. */
interface OrigemTelefone {
  tipo: 'cadastro' | 'endereco';
  /** "Cadastro" ou o nome do endereço (Casa, Trabalho...) */
  rotulo: string;
  /** só quando a origem é um endereço */
  enderecoId?: string;
}

interface TelefoneSalvo {
  numero: string;
  origens: OrigemTelefone[];
}


const TIPOS_PADRAO: TipoEndereco[] = ['Casa', 'Trabalho', 'Outro'];

const FORM_VAZIO: Omit<Endereco, 'id'> = {
  tipo: 'Casa',
  cep: '',
  rua: '',
  numero: '',
  complemento: '',
  bairro: '',
  cidade: '',
  estado: '',
  referencia: '',
  telefone: '',
  principal: false,
};


type CampoComErro = 'cep' | 'rua' | 'numero' | 'bairro' | 'cidade' | 'estado' | 'telefone';
type ErrosForm = Partial<Record<CampoComErro, string>>;

/** Confere o formulário inteiro. Vazio = tudo certo. */
const validarEndereco = (f: Omit<Endereco, 'id'>): ErrosForm => {
  const e: ErrosForm = {};
  if (!cepValido(f.cep))               e.cep = 'Informe um CEP válido (8 números).';
  if (f.rua.trim().length < 3)         e.rua = 'Informe o nome da rua.';
  if (!numeroValido(f.numero))         e.numero = 'Informe o número (ex.: 245) ou S/N.';
  if (f.bairro.trim().length < 2)      e.bairro = 'Informe o bairro.';
  if (f.cidade.trim().length < 2)      e.cidade = 'Informe a cidade.';
  if (!UFS_BR.includes(f.estado))      e.estado = 'Selecione o estado.';
  if (f.telefone && !telefoneValido(f.telefone)) {
    e.telefone = 'Telefone inválido. Use DDD + número, ex.: (16) 99999-9999.';
  }
  return e;
};

const IconeTipo: React.FC<{ tipo: TipoEndereco }> = ({ tipo }) => {
  if (tipo === 'Casa')     return <HiHome />;
  if (tipo === 'Trabalho') return <HiOfficeBuilding />;
  return <MdDiamond />;
};

const formatarEnderecoCompleto = (end: Endereco): string => {
  const partes = [`${end.rua}, ${end.numero}`];
  if (end.complemento) partes.push(end.complemento);
  partes.push(`${end.bairro} — ${end.cidade}/${end.estado}`);
  return partes.join(', ');
};

const formatarEnderecoResumido = (end: Endereco): string => {
  const partes = [end.rua, end.numero];
  if (end.complemento) partes.push(end.complemento);
  return partes.join(', ');
};


// Painel lateral compartilhado pelos dois modos

interface PainelLateralProps {
  enderecos: Endereco[];
  telefones: TelefoneSalvo[];
  onEditarTelefone: (origem: OrigemTelefone) => void;
  mostrarEnderecos?: boolean;
}

const PainelLateral: React.FC<PainelLateralProps> = ({
  enderecos,
  telefones,
  onEditarTelefone,
  mostrarEnderecos = false,
}) => (
  <div className="cad-end__painel">
    {mostrarEnderecos && (
      <section className="cad-end__secao">
        <h2 className="cad-end__secao-titulo">Endereços salvos</h2>
        <div className="cad-end__lista">
          {enderecos.map((end) => (
            <div key={end.id} className="cad-end__salvo">
              <span className="cad-end__salvo-icone"><IconeTipo tipo={end.tipo} /></span>
              <div>
                <p className="cad-end__salvo-tipo">{end.tipo}</p>
                <p className="cad-end__salvo-rua">{formatarEnderecoResumido(end)}</p>
              </div>
            </div>
          ))}
        </div>
      </section>
    )}

    <section className="cad-end__secao">
      <h2 className="cad-end__secao-titulo">Telefones salvos</h2>
      <div className="cad-end__lista">
        {telefones.length === 0 && (
          <p className="cad-end__salvo-rua">Nenhum telefone salvo ainda.</p>
        )}
        {telefones.map((tel) => (
          <div key={tel.numero} className="cad-end__salvo cad-end__salvo--tel">
            <FiPhone className="cad-end__salvo-icone" />
            <div className="cad-end__salvo-corpo">
              <p className="cad-end__salvo-tipo">{tel.numero}</p>
              <div className="cad-end__origens">
                {tel.origens.map((o) => (
                  <button
                    key={o.enderecoId ?? 'cadastro'}
                    type="button"
                    className="cad-end__origem"
                    onClick={() => onEditarTelefone(o)}
                    aria-label={o.tipo === 'cadastro' ? 'Editar telefone do cadastro' : `Editar endereço ${o.rotulo}`}
                    title={o.tipo === 'cadastro' ? 'Editar no perfil' : 'Editar endereço'}
                  >
                    {o.rotulo}
                    <FiEdit2 />
                  </button>
                ))}
              </div>
            </div>
          </div>
        ))}
      </div>
    </section>
  </div>
);


const CadastroEndereco: React.FC = () => {
  // ── Estado geral
  const navigate = useNavigate();
  const { cliente } = useClienteAuth();
  const { slug, restaurante } = useRestauranteCliente();
  const { itens: itensCarrinho, limparCarrinho } = useCarrinho();

  const [enderecos, setEnderecos]   = useState<Endereco[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [modo, setModo]             = useState<Modo>('selecionar');
  const [pedidoCriado, setPedidoCriado] = useState<PedidoCriado | null>(null);
  const [enviando, setEnviando]     = useState(false);
  const [erro, setErro]             = useState('');
  const [erros, setErros]           = useState<ErrosForm>({});
  const [editandoId, setEditandoId] = useState<string | null>(null);
  const [confirmandoExclusaoId, setConfirmandoExclusaoId] = useState<string | null>(null);
  const [buscandoCep, setBuscandoCep] = useState(false);
  const cepRequisicao = useRef(0);
  const numeroRef = useRef<HTMLInputElement>(null);
  const [enderecoSelecionadoId, setEnderecoSelecionadoId] = useState<string | null>(null);

  // ── Pagamento (acertado na entrega)
  const [forma, setForma] = useState<FormaPagamentoOnline | null>(null);
  const [troco, setTroco] = useState('');

  const taxaEntrega = Number(restaurante?.taxa_entrega ?? 0);

  // Formulário em branco, já com o telefone do cadastro do cliente
  const formularioNovo = () => ({
    ...FORM_VAZIO,
    telefone: cliente?.telefone ? formatarTelefone(cliente.telefone) : '',
  });

  // Estado do formulário de novo endereço
  const [form, setForm]               = useState(formularioNovo);
  const [tiposCustom, setTiposCustom] = useState<string[]>([]);
  const [novoTipo, setNovoTipo]       = useState('');
  const [addingTipo, setAddingTipo]   = useState(false);

  const todosOsTipos = [...TIPOS_PADRAO, ...tiposCustom];
  const enderecoConfirmado = enderecos.find((e) => e.id === enderecoSelecionadoId);

  // Telefones do painel lateral, o mesmo número aparece uma vez só, o resto é listado embaixo

  const telefones = useMemo<TelefoneSalvo[]>(() => {
    const porNumero = new Map<string, TelefoneSalvo>();
    const adicionar = (bruto: string | undefined, origem: OrigemTelefone) => {
      if (!bruto) return;
      const numero = formatarTelefone(bruto);
      const chave = numero.replace(/\D/g, '');
      if (!chave) return;
      const existente = porNumero.get(chave);
      if (existente) existente.origens.push(origem);
      else porNumero.set(chave, { numero, origens: [origem] });
    };
    adicionar(cliente?.telefone, { tipo: 'cadastro', rotulo: 'Cadastro' });
    enderecos.forEach((e) => adicionar(e.telefone, { tipo: 'endereco', rotulo: e.tipo, enderecoId: e.id }));
    return Array.from(porNumero.values());
  }, [cliente?.telefone, enderecos]);

  // Carrinho vazio não tem o que entregar: volta para o cardápio
  useEffect(() => {
    if (itensCarrinho.length === 0 && !pedidoCriado) navigate('/menu', { replace: true });
  }, [itensCarrinho.length, pedidoCriado, navigate]);

  // Endereços salvos na conta
  useEffect(() => {
    let cancelado = false;
    EnderecoClienteService.listar()
      .then((lista) => {
        if (cancelado) return;
        const convertidos: Endereco[] = lista.map((e) => ({
          ...e,
          complemento: e.complemento ?? '',
          referencia: e.referencia ?? '',
          telefone: e.telefone ?? '',
        }));
        setEnderecos(convertidos);
        setEnderecoSelecionadoId(convertidos.find((e) => e.principal)?.id ?? convertidos[0]?.id ?? null);
        if (convertidos.length === 0) setModo('cadastrar');
      })
      .catch((e: Error) => { if (!cancelado) setErro(e.message); })
      .finally(() => { if (!cancelado) setCarregando(false); });
    return () => { cancelado = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);


  const handleChange = (field: keyof typeof form, value: string | boolean) => {
    setForm((prev) => ({ ...prev, [field]: value }));
    setErros((prev) => {
      if (!(field in prev)) return prev;
      const novo = { ...prev };
      delete novo[field as CampoComErro];
      return novo;
    });
  };

  /** Avisa o erro do campo ao sair dele */
  const aoSair = (campo: CampoComErro) => {
    if (!String(form[campo]).trim()) return;
    const mensagem = validarEndereco(form)[campo];
    setErros((prev) => {
      const novo = { ...prev };
      if (mensagem) novo[campo] = mensagem;
      else delete novo[campo];
      return novo;
    });
  };

  /** Mensagem de erro logo abaixo do campo + borda vermelha */
  const erroCampo = (campo: CampoComErro) =>
    erros[campo] ? <span className="cad-end__erro-campo" role="alert">{erros[campo]}</span> : null;
  const classeErro = (campo: CampoComErro) => (erros[campo] ? ' cad-end__input--erro' : '');

  // ── CEP: preenche rua, bairro, cidade e estado sozinho (ViaCEP, igual ao cadastro do restaurante)
  const buscarCep = async (cepFormatado: string) => {
    const requisicao = ++cepRequisicao.current;
    setBuscandoCep(true);
    try {
      const r = await buscarCepViaCep(cepFormatado);
      if (requisicao !== cepRequisicao.current) return; // o CEP mudou enquanto buscava
      if (!r) {
        setErros((prev) => ({ ...prev, cep: 'CEP não encontrado. Confira ou preencha o endereço manualmente.' }));
        return;
      }
      setForm((prev) => ({ ...prev, rua: r.rua, bairro: r.bairro, cidade: r.cidade, estado: r.estado }));
      setErros((prev) => {
        const novo = { ...prev };
        (['cep', 'rua', 'bairro', 'cidade', 'estado'] as CampoComErro[]).forEach((c) => delete novo[c]);
        return novo;
      });
      setTimeout(() => numeroRef.current?.focus(), 0); // falta só o número
    } catch {
      if (requisicao === cepRequisicao.current) {
        setErros((prev) => ({ ...prev, cep: 'Não foi possível buscar o CEP agora. Preencha o endereço manualmente.' }));
      }
    } finally {
      if (requisicao === cepRequisicao.current) setBuscandoCep(false);
    }
  };

  const handleCepChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const formatado = formatarCep(e.target.value);
    handleChange('cep', formatado);
    if (formatado.length === 9) {
      buscarCep(formatado);
    } else {
      cepRequisicao.current++; // cancela busca em andamento
      setBuscandoCep(false);
    }
  };

  // ── Handlers de tipo customizado
  const handleAdicionarTipo = () => {
    const tipo = novoTipo.trim();
    if (!tipo || todosOsTipos.includes(tipo)) return;
    setTiposCustom((prev) => [...prev, tipo]);
    setForm((prev) => ({ ...prev, tipo }));
    setNovoTipo('');
    setAddingTipo(false);
  };

  /** Cria ou atualiza o endereço na conta, seleciona ele e volta para a lista. */
  const handleSalvarEndereco = async () => {
    const errosForm = validarEndereco(form);
    if (Object.keys(errosForm).length > 0) {
      setErros(errosForm);
      setErro('Confira os campos destacados em vermelho.');
      return;
    }
    setErros({});
    setErro('');
    setEnviando(true);
    try {
      const dados = {
        tipo: form.tipo,
        cep: form.cep,
        rua: form.rua,
        numero: form.numero,
        complemento: form.complemento,
        bairro: form.bairro,
        cidade: form.cidade,
        estado: form.estado,
        referencia: form.referencia,
        telefone: form.telefone,
        principal: editandoId ? form.principal : enderecos.length === 0 || form.principal,
      };
      const salvo = editandoId
        ? await EnderecoClienteService.atualizar(editandoId, dados)
        : await EnderecoClienteService.criar(dados);
      const novo: Endereco = {
        ...salvo,
        complemento: salvo.complemento ?? '',
        referencia: salvo.referencia ?? '',
        telefone: salvo.telefone ?? '',
      };
      setEnderecos((prev) => {
        const base = editandoId ? prev.map((e) => (e.id === novo.id ? novo : e)) : [...prev, novo];
        return base
          .map((e) => (novo.principal && e.id !== novo.id ? { ...e, principal: false } : e))
          .sort((x, y) => Number(y.principal) - Number(x.principal)); // principal primeiro
      });
      setEnderecoSelecionadoId(novo.id);
      setEditandoId(null);
      setForm(formularioNovo());
      setModo('selecionar');
    } catch (e: any) {
      setErro(e.message);
    } finally {
      setEnviando(false);
    }
  };

  /** Abre o formulário preenchido com o endereço escolhido */
  const handleEditar = (end: Endereco) => {
    const { id, ...campos } = end;
    setErro('');
    setErros({});
    setConfirmandoExclusaoId(null);
    setTiposCustom((prev) => (TIPOS_PADRAO.includes(end.tipo) || prev.includes(end.tipo) ? prev : [...prev, end.tipo]));
    setForm(campos);
    setEditandoId(id);
    setModo('cadastrar');
  };

  /** Editar um telefone do painel */
  const handleEditarTelefone = (origem: OrigemTelefone) => {
    if (origem.tipo === 'cadastro') {
      navigate('/perfil'); // o telefone do cadastro é editado no perfil
      return;
    }
    const end = enderecos.find((e) => e.id === origem.enderecoId);
    if (end) handleEditar(end);
  };

  /** Abre o formulário em branco para um endereço novo */
  const handleNovoEndereco = () => {
    setErro('');
    setErros({});
    setEditandoId(null);
    setForm(formularioNovo());
    setModo('cadastrar');
  };

  /** Fecha o formulário sem salvar */
  const handleVoltarDoForm = () => {
    setErro('');
    setErros({});
    setEditandoId(null);
    setForm(formularioNovo());
    if (enderecos.length > 0) setModo('selecionar');
    else navigate(-1);
  };

  /** Exclui o endereço da conta */
  const handleExcluir = async (id: string) => {
    setErro('');
    setEnviando(true);
    try {
      await EnderecoClienteService.excluir(id);
      const eraPrincipal = enderecos.find((e) => e.id === id)?.principal;
      const restantes = enderecos
        .filter((e) => e.id !== id)
        .map((e, i) => (eraPrincipal && i === 0 ? { ...e, principal: true } : e)); // o mais antigo assume
      setEnderecos(restantes);
      setConfirmandoExclusaoId(null);
      if (enderecoSelecionadoId === id) {
        setEnderecoSelecionadoId(restantes.find((e) => e.principal)?.id ?? restantes[0]?.id ?? null);
      }
      if (restantes.length === 0) {
        setForm(formularioNovo());
        setModo('cadastrar');
      }
    } catch (e: any) {
      setErro(e.message);
    } finally {
      setEnviando(false);
    }
  };

  /** Confirma a entrega: envia o pedido */
  const handleConfirmar = async () => {
    if (!enderecoConfirmado || !slug || !cliente) return;
    if (!forma) { setErro('Escolha como você vai pagar.'); return; }

    const telefone = enderecoConfirmado.telefone || cliente.telefone;
    if (!telefone) { setErro('Informe um telefone para contato no endereço.'); return; }

    setErro('');
    setEnviando(true);
    try {
      const pedido = await PedidoClienteService.criar(slug, {
        modalidade: 'ENTREGA',
        cliente_nome: cliente.nome,
        cliente_telefone: telefone,
        endereco_id: enderecoConfirmado.id,
        forma_pagamento: forma,
        ...(forma === 'DINHEIRO' && trocoParaNumero(troco) ? { troco_para: trocoParaNumero(troco) } : {}),
        itens: itensDoCarrinho(itensCarrinho),
      });
      setPedidoCriado(pedido);
      limparCarrinho();
    } catch (e: any) {
      setErro(e.message);
    } finally {
      setEnviando(false);
    }
  };

  const handleFecharSucesso = () => {
    // Não zera `pedidoCriado` aqui: o carrinho já está vazio e, sem o pedido, o efeito acima
    // redirecionaria para /menu e sobrescreveria esta navegação. A tela é desmontada ao navegar.
    navigate('/historico');
  };

  // ── Render
  return (
    <CustomerLayout mode="logged">
      <div className="cad-end">

        {/* 
            MODO: SELECIONAR endereço existente
             */}
        {modo === 'selecionar' && (
          <>
            <div className="cad-end__card">
              <h1 className="cad-end__titulo">Endereço de entrega</h1>
              <p className="cad-end__subtitulo">
                Selecione um endereço cadastrado ou adicione um novo.
              </p>

              {carregando && <p className="cad-end__subtitulo">Carregando seus endereços...</p>}

              <div className="cad-end__lista-selecao">
                {enderecos.map((end) => {
                  const ativo = enderecoSelecionadoId === end.id;
                  const confirmando = confirmandoExclusaoId === end.id;
                  return (
                    <div key={end.id} className="cad-end__item-linha">
                      <button
                        className={`cad-end__item-selecao ${ativo ? 'cad-end__item-selecao--ativo' : ''}`}
                        onClick={() => setEnderecoSelecionadoId(end.id)}
                      >
                        <span className="cad-end__item-icone">
                          <IconeTipo tipo={end.tipo} />
                        </span>
                        <div className="cad-end__item-info">
                          <span className="cad-end__item-tipo">
                            {end.tipo}
                            {end.principal && <span className="cad-end__item-principal">Principal</span>}
                          </span>
                          <span className="cad-end__item-rua">{formatarEnderecoCompleto(end)}</span>
                        </div>
                        <span className="cad-end__item-radio">
                          {ativo && <span className="cad-end__item-radio-dot" />}
                        </span>
                      </button>

                      {confirmando ? (
                        <div className="cad-end__item-confirma" role="alert">
                          <span>Excluir?</span>
                          <button
                            className="cad-end__item-acao cad-end__item-acao--perigo"
                            onClick={() => handleExcluir(end.id)}
                            disabled={enviando}
                          >
                            Sim
                          </button>
                          <button className="cad-end__item-acao" onClick={() => setConfirmandoExclusaoId(null)}>
                            Não
                          </button>
                        </div>
                      ) : (
                        <div className="cad-end__item-acoes">
                          <button
                            className="cad-end__item-acao"
                            onClick={() => handleEditar(end)}
                            aria-label={`Editar endereço ${end.tipo}`}
                            title="Editar"
                          >
                            <FiEdit2 />
                          </button>
                          <button
                            className="cad-end__item-acao cad-end__item-acao--perigo"
                            onClick={() => setConfirmandoExclusaoId(end.id)}
                            aria-label={`Excluir endereço ${end.tipo}`}
                            title="Excluir"
                          >
                            <FiTrash2 />
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              <button className="cad-end__novo-btn" onClick={handleNovoEndereco}>
                <FiPlus /> Novo endereço
              </button>

              <PagamentoPedido
                itens={itensCarrinho}
                taxaEntrega={taxaEntrega}
                momento="na entrega"
                forma={forma}
                onForma={setForma}
                troco={troco}
                onTroco={setTroco}
              />

              {erro && <p className="pgp__erro">{erro}</p>}

              <div className="cad-end__acoes cad-end__acoes--direita">
                <button
                  className="cad-end__btn-salvar"
                  onClick={handleConfirmar}
                  disabled={!enderecoSelecionadoId || !forma || enviando}
                >
                  {enviando ? 'Enviando...' : 'Confirmar entrega'}
                </button>
              </div>
            </div>

            <PainelLateral enderecos={enderecos} telefones={telefones} onEditarTelefone={handleEditarTelefone} />
          </>
        )}

        {/*
            CADASTRAR novo endereço
             */}
        {modo === 'cadastrar' && (
          <>
            <div className="cad-end__card">
              <h1 className="cad-end__titulo">{editandoId ? 'Editar endereço' : 'Cadastro de Endereço'}</h1>

              {/* Nome do endereço (tipo) */}
              <div className="cad-end__campo">
                <label className="cad-end__label">Nome do endereço</label>
                <div className="cad-end__tipos">
                  {todosOsTipos.map((tipo) => (
                    <button
                      key={tipo}
                      className={`cad-end__tipo-btn ${form.tipo === tipo ? 'cad-end__tipo-btn--ativo' : ''}`}
                      onClick={() => setForm((p) => ({ ...p, tipo }))}
                    >
                      <span className="cad-end__tipo-icon"><IconeTipo tipo={tipo} /></span>
                      {tipo}
                    </button>
                  ))}

                  {addingTipo ? (
                    <div className="cad-end__novo-tipo">
                      <input
                        className="cad-end__novo-tipo-input"
                        placeholder="Nome do tipo"
                        value={novoTipo}
                        autoFocus
                        onChange={(e) => setNovoTipo(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && handleAdicionarTipo()}
                      />
                      <button className="cad-end__novo-tipo-ok" onClick={handleAdicionarTipo}>OK</button>
                      <button className="cad-end__novo-tipo-cancel" onClick={() => setAddingTipo(false)}>✕</button>
                    </div>
                  ) : (
                    <button className="cad-end__add-tipo-btn" onClick={() => setAddingTipo(true)}>
                      <FiPlus /> Novo tipo
                    </button>
                  )}
                </div>
              </div>

              {/* CEP: ao completar, o endereço é preenchido sozinho */}
              <div className="cad-end__campo">
                <label className="cad-end__label">
                  CEP {buscandoCep && <span className="cad-end__buscando">buscando endereço...</span>}
                </label>
                <input
                  className={`cad-end__input cad-end__input--full${classeErro('cep')}`}
                  placeholder="00000-000"
                  inputMode="numeric"
                  maxLength={9}
                  value={form.cep}
                  onChange={handleCepChange}
                  onBlur={() => aoSair('cep')}
                />
                {erroCampo('cep')}
              </div>

              {/* Rua + Número */}
              <div className="cad-end__linha">
                <div className="cad-end__campo cad-end__campo--flex">
                  <label className="cad-end__label">Rua</label>
                  <input className={`cad-end__input${classeErro('rua')}`} placeholder="Ex: Avenida Paulo Roberto"
                    maxLength={150} value={form.rua}
                    onChange={(e) => handleChange('rua', e.target.value)} onBlur={() => aoSair('rua')} />
                  {erroCampo('rua')}
                </div>
                <div className="cad-end__campo cad-end__campo--fixo">
                  <label className="cad-end__label">Número</label>
                  <input ref={numeroRef} className={`cad-end__input${classeErro('numero')}`} placeholder="Ex: 245"
                    maxLength={10} value={form.numero}
                    onChange={(e) => handleChange('numero', e.target.value)} onBlur={() => aoSair('numero')} />
                  {erroCampo('numero')}
                </div>
              </div>

              {/* Complemento */}
              <div className="cad-end__campo">
                <label className="cad-end__label">Complemento</label>
                <input className="cad-end__input" placeholder="Ex: Apt 32 / Bloco B"
                  maxLength={100} value={form.complemento}
                  onChange={(e) => handleChange('complemento', e.target.value)} />
              </div>

              {/* Bairro + Cidade + Estado */}
              <div className="cad-end__linha">
                <div className="cad-end__campo cad-end__campo--flex">
                  <label className="cad-end__label">Bairro</label>
                  <input className={`cad-end__input${classeErro('bairro')}`} placeholder="Ex: Centro"
                    maxLength={100} value={form.bairro}
                    onChange={(e) => handleChange('bairro', e.target.value)} onBlur={() => aoSair('bairro')} />
                  {erroCampo('bairro')}
                </div>
                <div className="cad-end__campo cad-end__campo--flex">
                  <label className="cad-end__label">Cidade</label>
                  <input className={`cad-end__input${classeErro('cidade')}`} placeholder="Ex: Taquaritinga"
                    maxLength={100} value={form.cidade}
                    onChange={(e) => handleChange('cidade', e.target.value)} onBlur={() => aoSair('cidade')} />
                  {erroCampo('cidade')}
                </div>
                <div className="cad-end__campo cad-end__campo--estado">
                  <label className="cad-end__label">Estado</label>
                  <select className={`cad-end__input cad-end__input--estado${classeErro('estado')}`}
                    value={form.estado} onChange={(e) => handleChange('estado', e.target.value)}>
                    <option value="">UF</option>
                    {UFS_BR.map((uf) => <option key={uf} value={uf}>{uf}</option>)}
                  </select>
                  {erroCampo('estado')}
                </div>
              </div>

              {/* Referência + Telefone */}
              <div className="cad-end__linha">
                <div className="cad-end__campo cad-end__campo--flex">
                  <label className="cad-end__label">Referência</label>
                  <input className="cad-end__input" placeholder="Ex: Próximo ao mercado"
                    maxLength={200} value={form.referencia}
                    onChange={(e) => handleChange('referencia', e.target.value)} />
                </div>
                <div className="cad-end__campo cad-end__campo--flex">
                  <label className="cad-end__label">Telefone para contato</label>
                  <input
                    className={`cad-end__input${classeErro('telefone')}`}
                    placeholder="(16) 99999-9999"
                    inputMode="tel"
                    value={form.telefone}
                    onChange={(e) => handleChange('telefone', formatarTelefone(e.target.value))}
                    onBlur={() => aoSair('telefone')}
                  />
                  {erroCampo('telefone')}
                </div>
              </div>

              {/* Toggle + ações */}
              <div className="cad-end__rodape">
                <label className="cad-end__toggle">
                  <input
                    type="checkbox"
                    className="cad-end__toggle-input"
                    checked={form.principal}
                    onChange={(e) => handleChange('principal', e.target.checked)}
                  />
                  <span className="cad-end__toggle-slider" />
                  Definir como endereço principal
                </label>

                {erro && <p className="pgp__erro">{erro}</p>}

                <div className="cad-end__acoes">
                  <button
                    className="cad-end__btn-cancelar"
                    onClick={handleVoltarDoForm}
                  >
                    Voltar
                  </button>
                  <button className="cad-end__btn-salvar" onClick={handleSalvarEndereco} disabled={enviando}>
                    {enviando ? 'Salvando...' : editandoId ? 'Salvar alterações' : 'Salvar endereço'}
                  </button>
                </div>
              </div>
            </div>

            <PainelLateral enderecos={enderecos} telefones={telefones} onEditarTelefone={handleEditarTelefone} mostrarEnderecos />
          </>
        )}

      </div>

      {/* ── Modal de sucesso ── */}
      {pedidoCriado && enderecoConfirmado && (
        <div className="cad-end__overlay" onClick={handleFecharSucesso}>
          <div className="cad-end__modal-sucesso" onClick={(e) => e.stopPropagation()}>
            <HiCheckCircle className="cad-end__sucesso-icone" />
            <h2 className="cad-end__sucesso-titulo">Pedido #{pedidoCriado.numero_pedido} confirmado!</h2>
            <p className="cad-end__sucesso-texto">Seu pedido será entregue em:</p>
            <div className="cad-end__sucesso-endereco">
              <span className="cad-end__sucesso-tipo">
                <IconeTipo tipo={enderecoConfirmado.tipo} />
                {enderecoConfirmado.tipo}
              </span>
              <span className="cad-end__sucesso-rua">
                {formatarEnderecoCompleto(enderecoConfirmado)}
              </span>
            </div>
            <button className="cad-end__btn-salvar" onClick={handleFecharSucesso}>
              Acompanhar pedido
            </button>
          </div>
        </div>
      )}

    </CustomerLayout>
  );
};

export default CadastroEndereco;