import React, { useState } from 'react';
import { HiHome, HiOfficeBuilding, HiCheckCircle } from 'react-icons/hi';
import { MdDiamond } from 'react-icons/md';
import { FiPhone, FiPlus } from 'react-icons/fi';
import CustomerLayout from '../../../shared/components/layout/Customerlayout';
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

// ── Dados mockados — futuramente via API ───────────────
const ENDERECOS_MOCK: Endereco[] = [
  {
    id: 'end-1',
    tipo: 'Casa',
    cep: '15900-000',
    rua: 'Avenida Paulo Roberto',
    numero: '245',
    complemento: '',
    bairro: 'Centro',
    cidade: 'Taquaritinga',
    estado: 'SP',
    referencia: 'Próximo ao mercado',
    telefone: '(16) 99999-9999',
    principal: true,
  },
  {
    id: 'end-2',
    tipo: 'Trabalho',
    cep: '15900-100',
    rua: 'Rua XV de Novembro',
    numero: '1000',
    complemento: '10º andar, Centro',
    bairro: 'Centro',
    cidade: 'Taquaritinga',
    estado: 'SP',
    referencia: '',
    telefone: '(16) 99999-9999',
    principal: false,
  },
];

const TELEFONES_MOCK: string[] = ['(16) 99999-9999'];

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
  const [enderecos, setEnderecos]   = useState<Endereco[]>(ENDERECOS_MOCK);
  const [telefones, setTelefones]   = useState<string[]>(TELEFONES_MOCK);
  const [modo, setModo]             = useState<Modo>('selecionar');
  const [showSucesso, setShowSucesso] = useState(false);
  const [enderecoSelecionadoId, setEnderecoSelecionadoId] = useState<string | null>(
    ENDERECOS_MOCK.find((e) => e.principal)?.id ?? null
  );

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
    if (!form.rua || !form.numero || !form.cidade) return;
    const novo: Endereco = { ...form, id: `end-${Date.now()}` };
    setEnderecos((prev) => [...prev, novo]);
    setEnderecoSelecionadoId(novo.id);
    setForm({ ...FORM_VAZIO });
    setModo('selecionar');
  };

  /**
   * Confirma entrega com o endereço selecionado e abre modal de sucesso.
   * Futuramente: POST /pedidos com { enderecoId: enderecoSelecionadoId }.
   */
  const handleConfirmar = () => {
    if (!enderecoSelecionadoId) return;
    setShowSucesso(true);
  };

  const handleFecharSucesso = () => {
    setShowSucesso(false);
    // Futuramente: navigate('/customer/orders')
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

              <div className="cad-end__acoes cad-end__acoes--direita">
                <button
                  className="cad-end__btn-salvar"
                  onClick={handleConfirmar}
                  disabled={!enderecoSelecionadoId}
                >
                  Confirmar entrega
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
            <h2 className="cad-end__sucesso-titulo">Pedido confirmado!</h2>
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