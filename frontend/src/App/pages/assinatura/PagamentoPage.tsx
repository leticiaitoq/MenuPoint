import React, { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import AuthCard from '../auth/AuthCard';
import AuthService from '../../services/auth.service';
import AssinaturaService from '../../services/assinatura.service';
import { useAuth, ROTA_APOS_LOGIN } from '../../shared/contexts/Authcontext';
import '../auth/LoginPage.css';
import './PagamentoPage.css';

// Pagamento real pelo Mercado Pago: o botão pede o link ao backend (/assinatura/checkout)
// e leva o usuário para lá. A liberação do acesso vem do webhook do MP.

interface LocationState {
  email?: string;
  verificarEmail?: boolean;
}

const NOME_PLANO: Record<string, string> = { STARTER: 'Starter', PRO: 'Pro' };

const PagamentoPage: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const state = (location.state as LocationState) || {};
  const { token, usuario, entrar } = useAuth();

  const [plano, setPlano] = useState<{ plano: string; valor: number } | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [carregando, setCarregando] = useState(false);
  const [verificando, setVerificando] = useState(false);
  const [aviso, setAviso] = useState<{ tipo: 'ok' | 'info' | 'erro'; texto: string } | null>(null);

  // Pagamento aprovado: libera o sistema e segue para a confirmação do e-mail, se ainda faltar.
  const liberarAcesso = () => {
    if (token && usuario) entrar({ token, usuario: { ...usuario, pagamento_pendente: false } });
    let pos: { email?: string; verificarEmail?: boolean } = {};
    try { pos = JSON.parse(localStorage.getItem('@menupoint:pos_pagamento') || '{}'); } catch { /* ignora */ }
    localStorage.removeItem('@menupoint:pos_pagamento');
    if (pos.verificarEmail && pos.email) AuthService.resendCode(pos.email, 'registro').catch(() => undefined);
    if (pos.verificarEmail) navigate('/verify-code', { state: { email: pos.email, mode: 'register' }, replace: true });
    else navigate(ROTA_APOS_LOGIN, { replace: true });
  };

  // Consulta o Mercado Pago agora e conta ao usuário o que aconteceu com o pagamento dele.
  // Resolve o caso "paguei, mas fechei a aba antes de voltar": o banco é atualizado aqui.
  const verificarPagamento = async (manual: boolean) => {
    if (manual) { setVerificando(true); setAviso(null); }
    try {
      const { status, status_mp } = await AssinaturaService.sincronizar();
      if (status === 'ATIVA') {
        setAviso({ tipo: 'ok', texto: 'Pagamento confirmado! Liberando seu acesso...' });
        setTimeout(liberarAcesso, 800);
        return true;
      }
      if (status === 'CANCELADA' || status === 'FALHOU') {
        setAviso({ tipo: 'erro', texto: 'O pagamento foi cancelado ou recusado pelo Mercado Pago. Você pode tentar novamente.' });
      } else if (status_mp === 'pending') {
        setAviso({
          tipo: 'info',
          texto: manual
            ? 'O Mercado Pago ainda não confirmou o pagamento. Se você acabou de pagar, aguarde alguns segundos e verifique de novo.'
            : 'Você iniciou um pagamento que ainda não foi concluído. Se já pagou, clique em "Já paguei".',
        });
      } else if (manual) {
        setAviso({ tipo: 'info', texto: 'Ainda não encontramos um pagamento. Clique em "Pagar com Mercado Pago" para começar.' });
      }
    } catch {
      if (manual) setAviso({ tipo: 'erro', texto: 'Não foi possível consultar o pagamento agora. Tente novamente em instantes.' });
    } finally {
      if (manual) setVerificando(false);
    }
    return false;
  };

  // Ao abrir a tela: confere o pagamento no Mercado Pago (sem esperar o webhook) e mostra o plano.
  useEffect(() => {
    let cancelado = false;
    (async () => {
      const liberado = await verificarPagamento(false);
      if (liberado || cancelado) return;
      try {
        const a = await AssinaturaService.minha();
        if (!cancelado) setPlano({ plano: a.plano, valor: Number(a.valor) });
      } catch {
        if (!cancelado) navigate(ROTA_APOS_LOGIN, { replace: true });
      }
    })();
    return () => { cancelado = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Vai para o checkout do Mercado Pago. Ao voltar, /assinatura/sucesso confere o pagamento.
  const handlePagar = async () => {
    setErro(null);
    setCarregando(true);
    try {
      // Lembra o que fazer depois do pagamento (confirmar o e-mail do cadastro)
      localStorage.setItem('@menupoint:pos_pagamento', JSON.stringify({
        email: state.email,
        verificarEmail: Boolean(state.verificarEmail),
      }));
      const { init_point } = await AssinaturaService.checkout();
      window.location.href = init_point;
    } catch (err: any) {
      setErro(err?.response?.data?.message ?? 'Não foi possível abrir o pagamento. Tente novamente.');
      setCarregando(false);
    }
  };

  return (
    <div className="login-page" style={{ backgroundImage: 'url(/images/Register-Back.png)' }}>
      <div className="login-page__container">
        <AuthCard />

        <div className="login-page__form-side">
          <div className="pagamento">
            <h1 className="pagamento__titulo">Finalize sua assinatura</h1>
            <p className="pagamento__subtitulo">
              Falta só o pagamento para liberar o acesso ao seu restaurante.
            </p>

            {plano && (
              <div className="pagamento__card">
                <span className="pagamento__card-rotulo">Plano escolhido</span>
                <span className="pagamento__card-plano">{NOME_PLANO[plano.plano] ?? plano.plano}</span>
                <span className="pagamento__card-preco">
                  {plano.valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                  <small> /mês</small>
                </span>
                <span className="pagamento__card-obs">Cobrança mensal recorrente.</span>
              </div>
            )}

            {process.env.REACT_APP_MP_MODO_TESTE === 'true' ? (
              <p className="pagamento__seguro" style={{ marginBottom: 12 }}>
                🧪 Modo de teste: no Mercado Pago, entre com o usuário comprador de teste.
              </p>
            ) : (
              (state.email || usuario?.email) && (
                <p className="pagamento__seguro" style={{ marginBottom: 12 }}>
                  No Mercado Pago, entre ou pague com a conta do e-mail{' '}
                  <strong>{state.email || usuario?.email}</strong>.
                </p>
              )
            )}

            {aviso && (
              <p
                className={aviso.tipo === 'erro' ? 'pagamento__erro' : 'pagamento__seguro'}
                style={aviso.tipo === 'ok' ? { color: '#1e8e4e', fontWeight: 600 } : { marginBottom: 12 }}
              >
                {aviso.texto}
              </p>
            )}

            {erro && <p className="pagamento__erro">{erro}</p>}

            <button
              type="button"
              className="pagamento__botao"
              onClick={handlePagar}
              disabled={carregando || !plano}
            >
              {carregando ? 'Abrindo pagamento...' : 'Pagar com Mercado Pago'}
            </button>

            <button
              type="button"
              className="pagamento__botao pagamento__botao--secundario"
              onClick={() => verificarPagamento(true)}
              disabled={verificando || carregando}
            >
              {verificando ? 'Verificando...' : 'Já paguei, verificar agora'}
            </button>

            <p className="pagamento__seguro">
              🔒 Você será levado ao Mercado Pago para concluir o pagamento com segurança.
            </p>
            <p className="pagamento__seguro">
              <button
                type="button"
                onClick={() => navigate('/planos')}
                style={{ background: 'none', border: 0, color: '#a91e22', cursor: 'pointer', textDecoration: 'underline' }}
              >
                Alterar plano
              </button>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PagamentoPage;