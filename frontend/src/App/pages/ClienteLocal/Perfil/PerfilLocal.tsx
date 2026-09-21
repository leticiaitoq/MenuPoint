import React, { useState, useRef } from 'react';
import CustomerLayout from '../../../shared/components/layout/Customerlayout';
import './PerfilLocal.css';

// ── Tipos
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

const formatarTelefone = (valor: string): string => {
  const digitos = valor.replace(/\D/g, '').slice(0, 11);
  if (digitos.length <= 2)  return `(${digitos}`;
  if (digitos.length <= 7)  return `(${digitos.slice(0, 2)}) ${digitos.slice(2)}`;
  return `(${digitos.slice(0, 2)}) ${digitos.slice(2, 7)}-${digitos.slice(7)}`;
};

const PerfilLocal: React.FC = () => {
  const fotoRef = useRef<HTMLInputElement>(null);

  const [cliente, setCliente]       = useState<Cliente>(CLIENTE_MOCK);
  const [editando, setEditando]     = useState(false);
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

  return (
    <CustomerLayout mode="guest">
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

      </div>
    </CustomerLayout>
  );
};

export default PerfilLocal;