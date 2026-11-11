import React, { useEffect, useState } from 'react';
import { HiUser, HiPhone, HiOfficeBuilding, HiCheckCircle, HiLocationMarker } from 'react-icons/hi';
import { useLocation, useNavigate } from 'react-router-dom';
import CustomerLayout from '../../../shared/components/layout/Customerlayout';
import { useClienteAuth } from '../../../shared/contexts/ClienteAuthContext';
import { useRestauranteCliente } from '../../../shared/contexts/RestauranteClienteContext';
import { useCarrinho } from '../../../shared/contexts/CarrinhoContext';
import { formatarTelefone, telefoneValido } from '../../../shared/utils/enderecoValidacao';
import PagamentoPedido, { trocoParaNumero } from '../../../shared/components/PagamentoPedido/PagamentoPedido';
import PedidoClienteService, { FormaPagamentoDelivery, PedidoDeliveryCriado } from '../../../services/pedidoCliente.service';
import { itensParaPedido } from '../../../shared/components/PagamentoDelivery/PagamentoDelivery';
import { mensagemDeErro } from '../../../services/cliente.service';
import '../../../shared/components/PagamentoPedido/PagamentoPedido.css';
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
  const { slug, restaurante } = useRestauranteCliente();
  const { itens: itensCarrinho, limparCarrinho } = useCarrinho();

  // Nome e telefone já vêm da conta do cliente (dá para trocar neste pedido)
  const [form, setForm] = useState<FormRetirada>({
    nome:     cliente?.nome ?? '',
    telefone: cliente?.telefone ? formatarTelefone(cliente.telefone) : '',
  });
  const [erro, setErro] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [pedidoCriado, setPedidoCriado] = useState<PedidoDeliveryCriado | null>(null);
  const [forma, setForma] = useState<FormaPagamentoDelivery | null>(null);
  const [troco, setTroco] = useState('');

  // Carrinho vazio não tem o que retirar: volta para o cardápio (menos logo depois de pedir)
  useEffect(() => {
    if (itensCarrinho.length === 0 && !pedidoCriado) navigate('/menu', { replace: true });
  }, [itensCarrinho.length, pedidoCriado, navigate]);

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
    const nome = form.nome.trim();
    if (nome.length < 3 || !/^[A-Za-zÀ-ÿ' -]+$/.test(nome)) {
      setErro('Informe seu nome (só letras, com pelo menos 3 caracteres).');
      return;
    }
    if (!telefoneValido(form.telefone)) {
      setErro('Informe um telefone válido com DDD, ex.: (16) 99999-9999.');
      return;
    }
    if (!forma) { setErro('Escolha como você vai pagar.'); return; }
    if (!slug) { setErro('Abra o link do restaurante para pedir.'); return; }
    if (itensCarrinho.length === 0) { setErro('Seu carrinho está vazio. Escolha algo no cardápio.'); return; }
    if (itensCarrinho.some((i) => !i.produtoId)) { limparCarrinho(); setErro('Seu carrinho estava desatualizado. Adicione os itens novamente.'); return; }

    setErro('');
    setEnviando(true);
    try {
      const pedido = await PedidoClienteService.criarDelivery(slug, {
        modalidade: 'RETIRADA',
        cliente_nome: nome,
        cliente_telefone: form.telefone,
        forma_pagamento: forma,
        ...(forma === 'DINHEIRO' && trocoParaNumero(troco) ? { troco_para: trocoParaNumero(troco) } : {}),
        itens: itensParaPedido(itensCarrinho),
      });
      setPedidoCriado(pedido);
      limparCarrinho();
    } catch (e: any) {
      setErro(mensagemDeErro(e, 'Não foi possível enviar o pedido. Tente novamente.'));
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

          <div className="retirada__campo">
            <label className="retirada__label" htmlFor="retiradaTelefone">
              <HiPhone className="retirada__label-icone" /> Telefone para contato
            </label>
            <input
              id="retiradaTelefone"
              className="retirada__input"
              type="text"
              inputMode="tel"
              placeholder="(16) 99999-9999"
              value={form.telefone}
              onChange={handleTelefone}
            />
          </div>

          <PagamentoPedido
            itens={itensCarrinho}
            taxaEntrega={0}
            momento="na retirada"
            forma={forma}
            onForma={setForma}
            troco={troco}
            onTroco={setTroco}
          />

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

      {/* ── Modal de sucesso */}
      {pedidoCriado && (
        <div className="retirada__overlay" onClick={() => navigate('/historico')}>
          <div className="retirada__modal" onClick={(e) => e.stopPropagation()}>
            <HiCheckCircle className="retirada__modal-icone" />
            <h2 className="retirada__modal-titulo">Pedido #{pedidoCriado.numero_pedido} confirmado!</h2>
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