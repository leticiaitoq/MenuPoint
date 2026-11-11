import React, { useState } from 'react';
import { HiUser, HiPhone } from 'react-icons/hi';
import { useLocation, useNavigate } from 'react-router-dom';
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

/** "Rua XV de Novembro, 1000, Sala 2 — Centro, Taquaritinga/SP" (ou '' se o restaurante não informou) */
const formatarEnderecoRestaurante = (e?: { rua?: string; numero?: string; complemento?: string; bairro?: string; cidade?: string; estado?: string } | null): string => {
  if (!e?.rua) return '';
  const rua = [e.rua, e.numero, e.complemento].filter(Boolean).join(', ');
  const cidade = [e.cidade, e.estado].filter(Boolean).join('/');
  const resto = [e.bairro, cidade].filter(Boolean).join(', ');
  return resto ? `${rua} — ${resto}` : rua;
};

const InfoRetirada: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();

  const { cliente, isAuthenticated } = useClienteAuth();
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
  // Delivery: pode navegar sem conta, mas para ENVIAR o pedido precisa entrar (o carrinho é mantido)
  if (!isAuthenticated) {
    navigate('/login/cliente', {
      state: { from: location.pathname, aviso: 'Entre na sua conta para enviar o pedido ao restaurante.' },
    });
    return;
  }
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

  const enderecoRestaurante = formatarEnderecoRestaurante(restaurante?.endereco);

  return (
    <CustomerLayout mode="logged">
      <div className="retirada">

        {/* ── Card principal */}
        <div className="retirada__card">
          <h1 className="retirada__titulo">Retirada no restaurante</h1>
          <p className="retirada__subtitulo">
            Confirme seus dados e retire o pedido no balcão quando estiver pronto.
          </p>

          <div className="retirada__campo">
            <label className="retirada__label" htmlFor="retiradaNome">
              <HiUser className="retirada__label-icone" /> Nome
            </label>
            <input
              id="retiradaNome"
              className="retirada__input"
              type="text"
              placeholder="Seu nome completo"
              value={form.nome}
              onChange={(e) => atualizarForm({ nome: e.target.value })}
            />
          </div>

          <PagamentoDelivery forma={forma} onChange={setForma} momento="na retirada" subtotal={subtotal} />

          {/* Erro */}
          {erro && <p className="retirada__erro">{erro}</p>}

          {/* Ações */}
          <button className="retirada__btn-continuar" onClick={handleContinuar} disabled={enviando}>
            {enviando ? 'Enviando...' : 'Confirmar pedido'}
          </button>

          {erro && <p className="pgp__erro">{erro}</p>}

          <div className="retirada__acoes">
            <button className="retirada__btn-voltar" onClick={() => navigate(-1)}>
              Voltar
            </button>
            <button
              className="retirada__btn-confirmar"
              onClick={handleContinuar}
              disabled={enviando || !forma}
            >
              {enviando ? 'Enviando...' : 'Confirmar pedido'}
            </button>
          </div>
        </div>

        {/* ── Painel lateral: onde retirar */}
        <aside className="retirada__painel">
          <section className="retirada__secao">
            <h2 className="retirada__secao-titulo">Local de retirada</h2>
            <div className="retirada__local">
              <span className="retirada__local-icone"><HiOfficeBuilding /></span>
              <div className="retirada__local-info">
                <p className="retirada__local-nome">{restaurante?.nome ?? 'Restaurante'}</p>
                {enderecoRestaurante && (
                  <p className="retirada__local-linha">
                    <HiLocationMarker /> <span>{enderecoRestaurante}</span>
                  </p>
                )}
                {restaurante?.telefone && (
                  <p className="retirada__local-linha">
                    <HiPhone /> <span>{formatarTelefone(restaurante.telefone)}</span>
                  </p>
                )}
              </div>
            </div>
          </section>
        </aside>
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
            <button className="retirada__btn-confirmar" onClick={() => navigate('/historico')}>
              Acompanhar pedido
            </button>
          </div>
        </div>
      )}
    </CustomerLayout>
  );
};

export default InfoRetirada;