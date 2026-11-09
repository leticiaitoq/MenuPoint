import React, { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import CheckoutShell from './CheckoutShell';
import AssinaturaService from '../../services/assinatura.service';
import { useAuth, ROTA_APOS_LOGIN } from '../../shared/contexts/Authcontext';

interface LocationState {
  email?: string;
  verificarEmail?: boolean;
}

const NOME_PLANO: Record<string, string> = { STARTER: 'Starter', PRO: 'Pro' };
const brl = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

// "Finalize sua assinatura": resumo do plano e botão que leva ao Checkout Pro do Mercado Pago NA
// MESMA ABA. O Mercado Pago devolve a pessoa sozinho para /assinatura/sucesso (auto_return).
const PagamentoPage: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const state = (location.state as LocationState) || {};
  const { usuario } = useAuth();

  const [plano, setPlano] = useState<{ plano: string; valor: number; periodo?: string } | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [redirecionando, setRedirecionando] = useState(false);
  const [aviso, setAviso] = useState<string | null>(null);

  // Ao abrir: confere o pagamento no Mercado Pago (caso a pessoa já tenha pago e não voltado ao
  // site). Se já estiver pago, vai para a tela de confirmação; senão mostra o resumo do plano.
  useEffect(() => {
    let cancelado = false;
    (async () => {
      try {
        const { status, status_mp } = await AssinaturaService.sincronizar();
        if (cancelado) return;
        if (status === 'ATIVA') {
          navigate('/assinatura/sucesso', { replace: true });
          return;
        }
        if (status === 'CANCELADA' || status === 'FALHOU') {
          setAviso('O pagamento anterior foi cancelado ou recusado. Você pode tentar de novo.');
        } else if (status_mp === 'pending') {
          setAviso('Você iniciou um pagamento que ainda não foi concluído. Clique em pagar para continuar.');
        }
      } catch {
        // sem resposta agora: segue mostrando o resumo
      }
      try {
        const a = await AssinaturaService.minha();
        if (!cancelado) setPlano({ plano: a.plano, valor: Number(a.valor), periodo: a.periodo });
      } catch {
        if (!cancelado) navigate(ROTA_APOS_LOGIN, { replace: true });
      }
    })();
    return () => { cancelado = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handlePagar = async () => {
    setErro(null);
    setRedirecionando(true);
    try {
      // Lembra o que fazer depois do pagamento (confirmar o e-mail do cadastro, se faltar)
      localStorage.setItem('@menupoint:pos_pagamento', JSON.stringify({
        email: state.email,
        verificarEmail: Boolean(state.verificarEmail),
      }));
      const { init_point } = await AssinaturaService.checkout();
      window.location.href = init_point;
    } catch (err: any) {
      setErro(err?.response?.data?.message ?? 'Não foi possível abrir o pagamento. Tente novamente.');
      setRedirecionando(false);
    }
  };

  const anual = plano?.periodo === 'ANUAL';
  const nome = plano ? NOME_PLANO[plano.plano] ?? plano.plano : '';
  const mensal = plano ? (anual ? plano.valor / 12 : plano.valor) : 0;
  const emailConta = state.email || usuario?.email;

  return (
    <CheckoutShell voltarPara="/planos">
      <h1 className="ck__titulo">Finalize sua assinatura</h1>
      <p className="ck__sub">Pagamento único pelo Mercado Pago. Sem cobrança automática.</p>

      {plano && (
        <>
          <div className="ck__plano ck__plano--resumo">
            <span className="ck__plano-icone" aria-hidden="true">{nome[0]}</span>
            <span className="ck__plano-info">
              <span className="ck__plano-nome">{nome}</span>
              <span className="ck__plano-detalhe">
                {anual ? `12 meses por ${brl(plano.valor)}` : '1 mês, pagamento único'}
              </span>
            </span>
            <span className="ck__plano-preco">
              {brl(mensal)}
              <small>/mês</small>
            </span>
          </div>
          <button type="button" className="ck__link" onClick={() => navigate('/planos')}>
            Trocar plano
          </button>
        </>
      )}

      {aviso && <p className="ck__aviso">{aviso}</p>}

      <p className="ck__texto">
        Você vai finalizar o pagamento no Mercado Pago, com cartão, Pix ou outro meio disponível.
        Depois, volta automaticamente para o MenuPoint.
      </p>

      {process.env.REACT_APP_MP_MODO_TESTE === 'true' ? (
        <p className="ck__aviso ck__aviso--teste">
          🧪 Modo de teste: no Mercado Pago, entre com o usuário comprador de teste.
        </p>
      ) : (
        emailConta && (
          <p className="ck__texto">
            No Mercado Pago, entre ou pague com a conta do e-mail <strong>{emailConta}</strong>.
          </p>
        )
      )}

      {erro && <p className="ck__aviso ck__aviso--erro">{erro}</p>}

      <button type="button" className="ck__botao" onClick={handlePagar} disabled={redirecionando || !plano}>
        {redirecionando ? 'Redirecionando...' : plano ? `Pagar ${brl(plano.valor)} no Mercado Pago` : 'Carregando...'}
      </button>

      <p className="ck__nota">
        🔒 Seus dados de pagamento ficam com o Mercado Pago, não passam pelo MenuPoint.
      </p>
    </CheckoutShell>
  );
};

export default PagamentoPage;
