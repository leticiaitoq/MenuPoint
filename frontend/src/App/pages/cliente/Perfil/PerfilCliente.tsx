import React, { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import CustomerLayout from '../../../shared/components/layout/Customerlayout';
import './PerfilCliente.css';

// ── Tipos
interface Endereco {
  id: string;
  tipo: string;
  rua: string;
}

interface Cliente {
  nome: string;
  telefone: string;
  email: string;
  foto: string;
}

// ── Mock (substituir por API futuramente)
const CLIENTE_MOCK: Cliente = {
  nome:     'Fulana da Silva',
  telefone: '',
  email:    'email.tal@email.com',
  foto:     '/images/avatar-cliente.png',
};

const ENDERECOS_MOCK: Endereco[] = [
  { id: 'e1', tipo: 'Casa',     rua: 'Rua XV de Novembro, 1000' },
  { id: 'e2', tipo: 'Trabalho', rua: 'Rua XV de Novembro, 1000' },
];

const formatarTelefone = (valor: string): string => {
  const digitos = valor.replace(/\D/g, '').slice(0, 11);
  if (digitos.length <= 2)  return `(${digitos}`;
  if (digitos.length <= 7)  return `(${digitos.slice(0, 2)}) ${digitos.slice(2)}`;
  return `(${digitos.slice(0, 2)}) ${digitos.slice(2, 7)}-${digitos.slice(7)}`;
};

const PerfilCliente: React.FC = () => {
  const navigate  = useNavigate();
  const fotoRef   = useRef<HTMLInputElement>(null);

  const [cliente, setCliente]     = useState<Cliente>(CLIENTE_MOCK);
  const [enderecos, setEnderecos] = useState<Endereco[]>(ENDERECOS_MOCK);
  const [editando, setEditando]   = useState(false);
  const [temaEscuro, setTemaEscuro] = useState(false);

  // campos do form de edição
  const [formNome, setFormNome]         = useState(cliente.nome);
  const [formTelefone, setFormTelefone] = useState(cliente.telefone);
  const [formEmail, setFormEmail]       = useState(cliente.email);
  const [fotoPreview, setFotoPreview]   = useState(cliente.foto);

const handleFoto = (e: React.ChangeEvent<HTMLInputElement>) => {
    const arquivo = e.target.files?.[0];
    if (!arquivo) return;
    setFotoPreview(URL.createObjectURL(arquivo));
  };

  const handleSalvar = () => {
    setCliente({
      nome:     formNome,
      telefone: formTelefone,
      email:    formEmail,
      foto:     fotoPreview,
    });
    setEditando(false);
  };

  const handleExcluirEndereco = (id: string) => {
    setEnderecos((prev) => prev.filter((e) => e.id !== id));
  };


return (
    <CustomerLayout mode="logged">
      <div className="perfil">

        {/* ── Card principal ── */}
        <div className="perfil__card">

          {/* Nome */}
          <h1 className="perfil__nome">{cliente.nome}</h1>

          {/* Foto + info */}
          <div className="perfil__info">

            {/* Foto */}
            <div className="perfil__foto-wrap">
              <img
                src={fotoPreview}
                alt="Foto do cliente"
                className="perfil__foto"
                onError={(e) => { (e.target as HTMLImageElement).src = '/icons/customer-avatar.png'; }}
              />
              {editando && (
                <>
                  <input ref={fotoRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handleFoto} />
                  <button className="perfil__foto-btn" onClick={() => fotoRef.current?.click()}>
                    Alterar foto
                  </button>
                </>
              )}
            </div>

            {/* Dados */}
            <div className="perfil__dados">
              {editando ? (
                <>
                  <div className="perfil__campo">
                    <label className="perfil__label">Nome</label>
                    <input className="perfil__input" value={formNome} onChange={(e) => setFormNome(e.target.value)} />
                  </div>
                  <div className="perfil__campo">
                    <label className="perfil__label">Telefone</label>
                    <input className="perfil__input" placeholder="(11) 99999-9999" value={formTelefone} onChange={(e) => setFormTelefone(formatarTelefone(e.target.value))} />
                  </div>
                  <div className="perfil__campo">
                    <label className="perfil__label">Email</label>
                    <input className="perfil__input" value={formEmail} onChange={(e) => setFormEmail(e.target.value)} />
                  </div>
                  <div className="perfil__acoes-edicao">
                    <button className="perfil__btn-cancelar" onClick={() => setEditando(false)}>Cancelar</button>
                    <button className="perfil__btn-salvar" onClick={handleSalvar}>Salvar</button>
                  </div>
                </>
              ) : (
                <>
                  <p className="perfil__detalhe">
                    <strong>Telefone:</strong> {cliente.telefone || 'adicione o telefone'}
                  </p>
                  <p className="perfil__detalhe">
                    <strong>Email:</strong> {cliente.email}
                  </p>

                  {/* Toggle tema */}
                  <div className="perfil__tema">
                    <label className="perfil__toggle-label">
                      <input
                        type="checkbox"
                        className="perfil__toggle-input"
                        checked={temaEscuro}
                        onChange={(e) => setTemaEscuro(e.target.checked)}
                      />
                      <span className="perfil__toggle-slider" />
                      <span className="perfil__tema-icone">{temaEscuro ? '🌙' : '☀️'}</span>
                    </label>
                  </div>

                  <button className="perfil__btn-editar" onClick={() => setEditando(true)}>
                    EDITAR
                  </button>
                </>
              )}
            </div>
          </div>
        </div>

        {/* ── Endereços ── */}
        <div className="perfil__enderecos">
          <h2 className="perfil__enderecos-titulo">SEUS ENDEREÇOS</h2>
          <div className="perfil__enderecos-lista">
            {enderecos.map((end) => (
              <div key={end.id} className="perfil__endereco-card">
                <p className="perfil__endereco-tipo">{end.tipo}</p>
                <p className="perfil__endereco-rua">{end.rua}</p>
                <div className="perfil__endereco-acoes">
                  <button className="perfil__btn-excluir" onClick={() => handleExcluirEndereco(end.id)}>
                    EXCLUIR
                  </button>
                  <button className="perfil__btn-editar-end" onClick={() => navigate('/cliente/enderecos')}>
                    EDITAR
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

      </div>
    </CustomerLayout>
  );
};

export default PerfilCliente;