import React, { useState } from 'react';
import { HiUser, HiPhone } from 'react-icons/hi';
import { useNavigate } from 'react-router-dom';
import CustomerLayout from '../../../shared/components/layout/Customerlayout';
import './InfoRetirada.css';

// ── Tipos
interface FormRetirada {
  nome: string;
  telefone: string;
}

// ── Helper — máscara de telefone (mesmo padrão do CadastroEndereco)
const formatarTelefone = (valor: string): string => {
  const digitos = valor.replace(/\D/g, '').slice(0, 11);
  if (digitos.length <= 2)  return `(${digitos}`;
  if (digitos.length <= 7)  return `(${digitos.slice(0, 2)}) ${digitos.slice(2)}`;
  return `(${digitos.slice(0, 2)}) ${digitos.slice(2, 7)}-${digitos.slice(7)}`;
};

const InfoRetirada: React.FC = () => {
  const navigate = useNavigate();

  const [form, setForm] = useState<FormRetirada>({
    nome:     '',
    telefone: '',
  });
  const [erro, setErro] = useState('');

  const atualizarForm = (campo: Partial<FormRetirada>) =>
    setForm((prev) => ({ ...prev, ...campo }));

const handleTelefone = (e: React.ChangeEvent<HTMLInputElement>) =>
    atualizarForm({ telefone: formatarTelefone(e.target.value) });

 const handleContinuar = () => {
  if (!form.nome.trim()) { setErro('Informe seu nome.'); return; }
  if (!form.telefone || form.telefone.length < 14) { setErro('Informe um telefone válido.'); return; }

  setErro('');
  console.log(form); // substituir por chamada à API
  setSucesso(true);  // abre o modal
};

  const [sucesso, setSucesso] = useState(false);

  return (
    <CustomerLayout mode="logged">
      
      <div className="retirada">
        <div className="retirada__card">


          <span className="retirada__emoji">🛍️</span>

          {/* Título */}
          <h1 className="retirada__titulo">Informações para Retirada</h1>
          <p className="retirada__subtitulo">
            Preencha seus dados para retirar o pedido no restaurante
          </p>

          {/* Campos */}
          <div className="retirada__campos">

            {/* Nome */}
            <div className="retirada__campo">
              <div className="retirada__campo-label">
                <HiUser className="retirada__campo-icone" />
                <span>Nome</span>
              </div>
              <input
                className="retirada__input"
                type="text"
                placeholder="Seu nome completo"
                value={form.nome}
                onChange={(e) => atualizarForm({ nome: e.target.value })}
              />
            </div>

            {/* Telefone */}
            <div className="retirada__campo">
              <div className="retirada__campo-label">
                <HiPhone className="retirada__campo-icone" />
                <span>Telefone para contato</span>
              </div>
              <input
                className="retirada__input"
                type="text"
                placeholder="(11) 98765-4321"
                value={form.telefone}
                onChange={handleTelefone}
              />
            </div>

          </div>

          {/* Erro */}
          {erro && <p className="retirada__erro">{erro}</p>}

          {/* Ações */}
          <button className="retirada__btn-continuar" onClick={handleContinuar}>
            Continuar
          </button>

          <button className="retirada__btn-voltar" onClick={() => navigate(-1)}>
            Voltar
          </button>

        </div>
      </div>

            {sucesso && (
        <div className="retirada__overlay" onClick={() => setSucesso(false)}>
            <div className="retirada__modal" onClick={(e) => e.stopPropagation()}>
            <span className="retirada__modal-emoji">✅</span>
            <h2 className="retirada__modal-titulo">Pedido confirmado!</h2>
            <p className="retirada__modal-texto">
                Seu pedido está sendo preparado. Retire no balcão quando estiver pronto.
            </p>
            <div className="retirada__modal-info">
                <p><strong>Nome:</strong> {form.nome}</p>
                <p><strong>Telefone:</strong> {form.telefone}</p>
            </div>
            <button
                className="retirada__btn-continuar"
                onClick={() => navigate('/historico')}
            >
                Fechar
            </button>
            </div>
        </div>
        )}
    </CustomerLayout>
  );
};

export default InfoRetirada;