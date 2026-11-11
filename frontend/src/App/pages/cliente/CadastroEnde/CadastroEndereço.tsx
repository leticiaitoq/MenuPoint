import React, { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { HiHome, HiOfficeBuilding, HiCheckCircle } from 'react-icons/hi';
import { MdDiamond } from 'react-icons/md';
import { FiPhone, FiPlus } from 'react-icons/fi';
import CustomerLayout from '../../../shared/components/layout/Customerlayout';
import PagamentoDelivery, { itensParaPedido } from '../../../shared/components/PagamentoDelivery/PagamentoDelivery';
import { useCarrinho } from '../../../shared/contexts/CarrinhoContext';
import { useClienteAuth } from '../../../shared/contexts/ClienteAuthContext';
import { useRestauranteCliente } from '../../../shared/contexts/RestauranteClienteContext';
import PedidoClienteService, { FormaPagamentoDelivery } from '../../../services/pedidoCliente.service';
import { mensagemDeErro } from '../../../services/cliente.service';
import './CadastroEndereço.css';

// 
// Tipos
// 

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

// 
// Constantes
// 

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

// ── Endereços salvos ────────────────────────────────────
// Ainda não existe tabela de endereços no backend: ficam guardados neste aparelho, por conta
// (localStorage). O pedido sempre leva o endereço escolhido junto, então o restaurante recebe tudo.
const chaveEnderecos = (clienteId?: string) => `@menupoint:enderecos:${clienteId ?? 'anonimo'}`;

const lerEnderecos = (clienteId?: string): Endereco[] => {
  try {
    const bruto = localStorage.getItem(chaveEnderecos(clienteId));
    return bruto ? (JSON.parse(bruto) as Endereco[]) : [];
  } catch {
    return [];
  }
};

const CEP_VALIDO = /^\d{5}-?\d{3}$/;

// 
// Helpers
// 

/** Ícone correspondente a cada tipo de endereço. */
const IconeTipo: React.FC<{ tipo: TipoEndereco }> = ({ tipo }) => {
  if (tipo === 'Casa')     return <HiHome />;
  if (tipo === 'Trabalho') return <HiOfficeBuilding />;
  return <MdDiamond />;
};

/** "Rua XV de Novembro, 1000, 10º andar — Centro, Taquaritinga/SP" */
const formatarEnderecoCompleto = (end: Endereco): string => {
  const partes = [`${end.rua}, ${end.numero}`];
  if (end.complemento) partes.push(end.complemento);
  partes.push(`${end.bairro} — ${end.cidade}/${end.estado}`);
  return partes.join(', ');
};

/** "Rua XV de Novembro, 1000" (para o painel lateral) */
const formatarEnderecoResumido = (end: Endereco): string => {
  const partes = [end.rua, end.numero];
  if (end.complemento) partes.push(end.complemento);
  return partes.join(', ');
};

/** Aplica máscara de telefone: (16) 99999-9999 */
const formatarTelefone = (valor: string): string => {
  const digitos = valor.replace(/\D/g, '').slice(0, 11);
  if (digitos.length <= 2)  return `(${digitos}`;
  if (digitos.length <= 7)  return `(${digitos.slice(0, 2)}) ${digitos.slice(2)}`;
  return `(${digitos.slice(0, 2)}) ${digitos.slice(2, 7)}-${digitos.slice(7)}`;
};

// 
// Sub-componentes
// 

// ── Painel lateral compartilhado pelos dois modos ─────

interface PainelLateralProps {
  enderecos: Endereco[];
  telefones: string[];
  mostrarEnderecos?: boolean;
}

const PainelLateral: React.FC<PainelLateralProps> = ({
  enderecos,
  telefones,
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
      <h2 className="cad-end__secao-titulo">Referências salvas</h2>
      <div className="cad-end__lista">
        {telefones.map((tel) => (
          <div key={tel} className="cad-end__salvo">
            <FiPhone className="cad-end__salvo-icone" />
            <p className="cad-end__salvo-tipo">{tel}</p>
          </div>
        ))}
      </div>
    </section>
  </div>
);

// 
// Componente principal
// 

const CadastroEndereco: React.FC = () => {
  // ── Estado geral
  const navigate = useNavigate();
  const location = useLocation();
  const { cliente, isAuthenticated } = useClienteAuth();
  const { slug, restaurante } = useRestauranteCliente();
  const { itens, limparCarrinho } = useCarrinho();

  const [enderecos, setEnderecos]   = useState<Endereco[]>(() => lerEnderecos(cliente?.id));
  const [telefones, setTelefones]   = useState<string[]>(() => (cliente?.telefone ? [cliente.telefone] : []));
  // Sem endereço salvo, já abre o cadastro
  const [modo, setModo]             = useState<Modo>(() => (lerEnderecos(cliente?.id).length ? 'selecionar' : 'cadastrar'));
  const [showSucesso, setShowSucesso] = useState(false);
  const [enderecoSelecionadoId, setEnderecoSelecionadoId] = useState<string | null>(() => {
    const salvos = lerEnderecos(cliente?.id);
    return (salvos.find((e) => e.principal) ?? salvos[0])?.id ?? null;
  });
  const [forma, setForma]           = useState<FormaPagamentoDelivery>('PIX_PRESENCIAL');
  const [enviando, setEnviando]     = useState(false);
  const [erroPedido, setErroPedido] = useState('');
  const [numeroPedido, setNumeroPedido] = useState<number | null>(null);

  useEffect(() => {
    try {
      localStorage.setItem(chaveEnderecos(cliente?.id), JSON.stringify(enderecos));
    } catch {
      /* storage indisponível: segue só em memória */
    }
  }, [enderecos, cliente?.id]);

  const subtotal = itens.reduce((acc, i) => acc + i.preco * i.quantidade, 0);
  const taxa = Number(restaurante?.taxa_entrega ?? 0);

  // ── Estado do formulário de novo endereço
  const [form, setForm]               = useState({ ...FORM_VAZIO });
  const [tiposCustom, setTiposCustom] = useState<string[]>([]);
  const [novoTipo, setNovoTipo]       = useState('');
  const [addingTipo, setAddingTipo]   = useState(false);

  const todosOsTipos = [...TIPOS_PADRAO, ...tiposCustom];
  const enderecoConfirmado = enderecos.find((e) => e.id === enderecoSelecionadoId);

  // ── Handlers genéricos do form
  const handleChange = (field: keyof typeof form, value: string | boolean) =>
    setForm((prev) => ({ ...prev, [field]: value }));

  // ── Handlers de tipo customizado
  const handleAdicionarTipo = () => {
    const tipo = novoTipo.trim();
    if (!tipo || todosOsTipos.includes(tipo)) return;
    setTiposCustom((prev) => [...prev, tipo]);
    setForm((prev) => ({ ...prev, tipo }));
    setNovoTipo('');
    setAddingTipo(false);
  };

  // ── Handler de telefone — salva como referência
  const handleSalvarTelefone = () => {
    const tel = form.telefone.trim();
    if (!tel || telefones.includes(tel)) return;
    setTelefones((prev) => [...prev, tel]);
    handleChange('telefone', '');
  };

  /**
   * Salva o novo endereço, seleciona ele e volta para modo seleção.
   * Futuramente: POST /enderecos com o payload do form.
   */
  const handleSalvarEndereco = () => {
    if (!form.rua || !form.numero || !form.cidade || !form.bairro) { setErroPedido('Preencha rua, número, bairro e cidade.'); return; }
    if (!CEP_VALIDO.test(form.cep)) { setErroPedido('Informe um CEP válido (00000-000).'); return; }
    if (form.estado.length !== 2) { setErroPedido('Informe o estado com 2 letras (ex.: SP).'); return; }
    setErroPedido('');
    const novo: Endereco = { ...form, id: `end-${Date.now()}` };
    setEnderecos((prev) => [...prev.map((e) => (form.principal ? { ...e, principal: false } : e)), novo]);
    setEnderecoSelecionadoId(novo.id);
    setForm({ ...FORM_VAZIO });
    setModo('selecionar');
  };

  /**
   * Confirma entrega com o endereço selecionado e abre modal de sucesso.
   * Futuramente: POST /pedidos com { enderecoId: enderecoSelecionadoId }.
   */
  const handleConfirmar = async () => {
    if (!enderecoConfirmado || enviando) return;
    // Delivery: pode navegar sem conta, mas para ENVIAR o pedido precisa entrar (o carrinho é mantido)
    if (!isAuthenticated) {
      navigate('/login/cliente', {
        state: { from: location.pathname, aviso: 'Entre na sua conta para enviar o pedido ao restaurante.' },
      });
      return;
    }
    if (!slug) { setErroPedido('Abra o link do restaurante para pedir.'); return; }
    if (itens.length === 0) { setErroPedido('Seu carrinho está vazio. Escolha algo no cardápio.'); return; }
    if (itens.some((i) => !i.produtoId)) { limparCarrinho(); setErroPedido('Seu carrinho estava desatualizado. Adicione os itens novamente.'); return; }

    setErroPedido('');
    setEnviando(true);
    try {
      const pedido = await PedidoClienteService.criarDelivery(slug, {
        modalidade: 'ENTREGA',
        cliente_nome: cliente?.nome ?? '',
        cliente_telefone: enderecoConfirmado.telefone || cliente?.telefone || telefones[0] || '',
        forma_pagamento: forma,
        endereco_entrega: {
          rua: enderecoConfirmado.rua,
          numero: enderecoConfirmado.numero,
          ...(enderecoConfirmado.complemento ? { complemento: enderecoConfirmado.complemento } : {}),
          bairro: enderecoConfirmado.bairro,
          cidade: enderecoConfirmado.cidade,
          estado: enderecoConfirmado.estado,
          cep: enderecoConfirmado.cep,
          ...(enderecoConfirmado.referencia ? { referencia: enderecoConfirmado.referencia } : {}),
        },
        itens: itensParaPedido(itens),
      });
      limparCarrinho();
      setNumeroPedido(pedido.numero_pedido);
      setShowSucesso(true);
    } catch (err) {
      setErroPedido(mensagemDeErro(err, 'Não foi possível enviar o pedido. Tente novamente.'));
    } finally {
      setEnviando(false);
    }
  };

  const handleFecharSucesso = () => {
    setShowSucesso(false);
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

              <div className="cad-end__lista-selecao">
                {enderecos.map((end) => {
                  const ativo = enderecoSelecionadoId === end.id;
                  return (
                    <button
                      key={end.id}
                      className={`cad-end__item-selecao ${ativo ? 'cad-end__item-selecao--ativo' : ''}`}
                      onClick={() => setEnderecoSelecionadoId(end.id)}
                    >
                      <span className="cad-end__item-icone">
                        <IconeTipo tipo={end.tipo} />
                      </span>
                      <div className="cad-end__item-info">
                        <span className="cad-end__item-tipo">{end.tipo}</span>
                        <span className="cad-end__item-rua">{formatarEnderecoCompleto(end)}</span>
                      </div>
                      <span className="cad-end__item-radio">
                        {ativo && <span className="cad-end__item-radio-dot" />}
                      </span>
                    </button>
                  );
                })}
              </div>

              <button className="cad-end__novo-btn" onClick={() => setModo('cadastrar')}>
                <FiPlus /> Novo endereço
              </button>

              <PagamentoDelivery forma={forma} onChange={setForma} momento="na entrega" subtotal={subtotal} taxa={taxa} />
              {erroPedido && <p style={{ color: 'red', fontSize: 14 }}>{erroPedido}</p>}

              <div className="cad-end__acoes cad-end__acoes--direita">
                <button
                  className="cad-end__btn-salvar"
                  onClick={handleConfirmar}
                  disabled={!enderecoSelecionadoId || enviando}
                >
                  {enviando ? 'Enviando...' : 'Confirmar entrega'}
                </button>
              </div>
            </div>

            <PainelLateral enderecos={enderecos} telefones={telefones} />
          </>
        )}

        {/*
            MODO: CADASTRAR novo endereço
             */}
        {modo === 'cadastrar' && (
          <>
            <div className="cad-end__card">
              <h1 className="cad-end__titulo">Cadastro de Endereço</h1>

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

              {/* CEP */}
              <div className="cad-end__campo">
                <label className="cad-end__label">CEP</label>
                <input
                  className="cad-end__input cad-end__input--full"
                  placeholder="00000-000"
                  maxLength={9}
                  value={form.cep}
                  onChange={(e) => handleChange('cep', e.target.value)}
                />
              </div>

              {/* Rua + Número */}
              <div className="cad-end__linha">
                <div className="cad-end__campo cad-end__campo--flex">
                  <label className="cad-end__label">Rua</label>
                  <input className="cad-end__input" placeholder="Ex: Avenida Paulo Roberto"
                    value={form.rua} onChange={(e) => handleChange('rua', e.target.value)} />
                </div>
                <div className="cad-end__campo cad-end__campo--fixo">
                  <label className="cad-end__label">Número</label>
                  <input className="cad-end__input" placeholder="Ex: 245"
                    value={form.numero} onChange={(e) => handleChange('numero', e.target.value)} />
                </div>
              </div>

              {/* Complemento */}
              <div className="cad-end__campo">
                <label className="cad-end__label">Complemento</label>
                <input className="cad-end__input" placeholder="Ex: Apt 32 / Bloco B"
                  value={form.complemento} onChange={(e) => handleChange('complemento', e.target.value)} />
              </div>

              {/* Bairro + Cidade + Estado */}
              <div className="cad-end__linha">
                <div className="cad-end__campo cad-end__campo--flex">
                  <label className="cad-end__label">Bairro</label>
                  <input className="cad-end__input" placeholder="Ex: Centro"
                    value={form.bairro} onChange={(e) => handleChange('bairro', e.target.value)} />
                </div>
                <div className="cad-end__campo cad-end__campo--flex">
                  <label className="cad-end__label">Cidade</label>
                  <input className="cad-end__input" placeholder="Ex: Taquaritinga"
                    value={form.cidade} onChange={(e) => handleChange('cidade', e.target.value)} />
                </div>
                <div className="cad-end__campo cad-end__campo--estado">
                  <label className="cad-end__label">Estado</label>
                  <input className="cad-end__input cad-end__input--estado" placeholder="UF"
                    maxLength={2} value={form.estado}
                    onChange={(e) => handleChange('estado', e.target.value.toUpperCase())} />
                </div>
              </div>

              {/* Referência + Telefone */}
              <div className="cad-end__linha">
                <div className="cad-end__campo cad-end__campo--flex">
                  <label className="cad-end__label">Referência</label>
                  <input className="cad-end__input" placeholder="Ex: Próximo ao mercado"
                    value={form.referencia} onChange={(e) => handleChange('referencia', e.target.value)} />
                </div>
                <div className="cad-end__campo cad-end__campo--flex">
                  <label className="cad-end__label">Telefone para contato</label>
                  <div className="cad-end__tel-wrap">
                    <input
                      className="cad-end__input"
                      placeholder="(16) 99999-9999"
                      value={form.telefone}
                      onChange={(e) => handleChange('telefone', formatarTelefone(e.target.value))}
                      onKeyDown={(e) => e.key === 'Enter' && handleSalvarTelefone()}
                    />
                    <button
                      className="cad-end__tel-btn"
                      onClick={handleSalvarTelefone}
                      title="Salvar como referência"
                    >
                      <FiPlus />
                    </button>
                  </div>
                </div>
              </div>

              {erroPedido && <p style={{ color: 'red', fontSize: 14 }}>{erroPedido}</p>}

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

                <div className="cad-end__acoes">
                  <button className="cad-end__btn-cancelar" onClick={() => setModo('selecionar')}>
                    Voltar
                  </button>
                  <button className="cad-end__btn-salvar" onClick={handleSalvarEndereco}>
                    Salvar endereço
                  </button>
                </div>
              </div>
            </div>

            <PainelLateral enderecos={enderecos} telefones={telefones} mostrarEnderecos />
          </>
        )}

      </div>

      {/* ── Modal de sucesso ── */}
      {showSucesso && enderecoConfirmado && (
        <div className="cad-end__overlay" onClick={handleFecharSucesso}>
          <div className="cad-end__modal-sucesso" onClick={(e) => e.stopPropagation()}>
            <HiCheckCircle className="cad-end__sucesso-icone" />
            <h2 className="cad-end__sucesso-titulo">Pedido {numeroPedido ? `#${numeroPedido} ` : ''}confirmado!</h2>
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