import React, { useState } from 'react';
import { HiUser, HiPhone } from 'react-icons/hi';
import { useNavigate } from 'react-router-dom';
import CustomerLayout from '../../../shared/components/layout/Customerlayout';
import PagamentoDelivery, { itensParaPedido } from '../../../shared/components/PagamentoDelivery/PagamentoDelivery';
import { useCarrinho } from '../../../shared/contexts/CarrinhoContext';
import { useClienteAuth } from '../../../shared/contexts/ClienteAuthContext';
import { useRestauranteCliente } from '../../../shared/contexts/RestauranteClienteContext';
import PedidoClienteService, { FormaPagamentoDelivery } from '../../../services/pedidoCliente.service';
import { mensagemDeErro } from '../../../services/cliente.service';
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

  const { cliente } = useClienteAuth();
  const { slug } = useRestauranteCliente();
  const { itens, limparCarrinho } = useCarrinho();

  // Dados da conta já vêm preenchidos (o cliente pode trocar)
  const [form, setForm] = useState<FormRetirada>({
    nome:     cliente?.nome ?? '',
    telefone: formatarTelefone(cliente?.telefone ?? ''),
  });
  const [erro, setErro] = useState('');
  const [forma, setForma] = useState<FormaPagamentoDelivery>('PIX_PRESENCIAL');
  const [enviando, setEnviando] = useState(false);
  const [numeroPedido, setNumeroPedido] = useState<number | null>(null);
  const subtotal = itens.reduce((acc, i) => acc + i.preco * i.quantidade, 0);

  const atualizarForm = (campo: Partial<FormRetirada>) =>
    setForm((prev) => ({ ...prev, ...campo }));

const handleTelefone = (e: React.ChangeEvent<HTMLInputElement>) =>
    atualizarForm({ telefone: formatarTelefone(e.target.value) });

 const handleContinuar = async () => {
  if (enviando) return;
  if (!form.nome.trim()) { setErro('Informe seu nome.'); return; }
  if (!form.telefone || form.telefone.length < 14) { setErro('Informe um telefone válido.'); return; }
  if (!slug) { setErro('Abra o link do restaurante para pedir.'); return; }
  if (itens.length === 0) { setErro('Seu carrinho está vazio. Escolha algo no cardápio.'); return; }
  if (itens.some((i) => !i.produtoId)) { limparCarrinho(); setErro('Seu carrinho estava desatualizado. Adicione os itens novamente.'); return; }

  setErro('');
  setEnviando(true);
  try {
    const pedido = await PedidoClienteService.criarDelivery(slug, {
      modalidade: 'RETIRADA',
      cliente_nome: form.nome.trim(),
      cliente_telefone: form.telefone,
      forma_pagamento: forma,
      itens: itensParaPedido(itens),
    });
    limparCarrinho();
    setNumeroPedido(pedido.numero_pedido);
    setSucesso(true);  // abre o modal
  } catch (err) {
    setErro(mensagemDeErro(err, 'Não foi possível enviar o pedido. Tente novamente.'));
  } finally {
    setEnviando(false);
  }
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

          <PagamentoDelivery forma={forma} onChange={setForma} momento="na retirada" subtotal={subtotal} />

          {/* Erro */}
          {erro && <p className="retirada__erro">{erro}</p>}

          {/* Ações */}
          <button className="retirada__btn-continuar" onClick={handleContinuar} disabled={enviando}>
            {enviando ? 'Enviando...' : 'Confirmar pedido'}
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
            <h2 className="retirada__modal-titulo">Pedido {numeroPedido ? `#${numeroPedido} ` : ''}confirmado!</h2>
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