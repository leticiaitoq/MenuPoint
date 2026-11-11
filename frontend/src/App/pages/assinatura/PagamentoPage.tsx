import React, { useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import AuthCard from '../auth/AuthCard';
import AuthService from '../../services/auth.service';
import AssinaturaService from '../../services/assinatura.service';
import { useAuth, ROTA_APOS_LOGIN } from '../../shared/contexts/Authcontext';
import '../auth/LoginPage.css';
import './PagamentoPage.css';
interface LocationState {
  email?: string;
  verificarEmail?: boolean;
}

const NOME_PLANO: Record<string, string> = { STARTER: 'Starter', PRO: 'Pro' };

const PagamentoPage: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const state = (location.state as LocationState) || {};
  const { token, usuario, entrar, sair } = useAuth();

  const [plano, setPlano] = useState<{ plano: string; valor: number; periodo?: string } | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [carregando, setCarregando] = useState(false);
  const [verificando, setVerificando] = useState(false);
  const [aviso, setAviso] = useState<{ tipo: 'ok' | 'info' | 'erro'; texto: string } | null>(null);
  const [aguardando, setAguardando] = useState(false);
  const janelaRef = useRef<Window | null>(null);
  const urlCheckoutRef = useRef('');

  // Pagamento aprovado: libera o sistema e segue para a confirmação do e-mail, se ainda faltar.
  const liberarAcesso = () => {
    if (token && usuario) entrar({ token, usuario: { ...usuario, pagamento_pendente: false } });
    let pos: { email?: string; verificarEmail?: boolean } = {};
    try { pos = JSON.parse(localStorage.getItem('@menupoint:pos_pagamento') || '{}'); } catch { /* ignora */ }
    localStorage.removeItem('@menupoint:pos_pagamento');
    if (pos.verificarEmail && pos.email) AuthService.resendCode(pos.email, 'registro').catch(() => undefined);
    if (pos.verificarEmail) {
      navigate('/verify-code', { state: { email: pos.email, mode: 'register' }, replace: true });
    } else {
      // Pagou: vai para o login com a mensagem de sucesso (navega primeiro, depois encerra a sessão)
      navigate('/login', { replace: true, state: { pagamentoConfirmado: true, email: usuario?.email } });
      sair();
    }
  };

  // Fecha a aba do Mercado Pago que nós abrimos 
  const fecharJanelaDoCheckout = () => {
    try { janelaRef.current?.close(); } catch { /* ignora */ }
    janelaRef.current = null;
  };

  // Enquanto o checkout está aberto em outra aba: confere o pagamento a cada 3 s e também
  // na hora em que a pessoa volta para a aba.
  useEffect(() => {
    if (!aguardando) return;
    let cancelado = false;
    let timer: number | undefined;
    const inicio = Date.now();

    const checar = async () => {
      if (cancelado) return;
      try {
        const { status } = await AssinaturaService.sincronizar();
        if (cancelado) return;
        if (status === 'ATIVA') {
          fecharJanelaDoCheckout();
          setAguardando(false);
          setAviso({ tipo: 'ok', texto: 'Pagamento confirmado! Levando você para o login...' });
          setTimeout(liberarAcesso, 800);
          return;
        }
        if (status === 'CANCELADA' || status === 'FALHOU') {
          fecharJanelaDoCheckout();
          setAguardando(false);
          setAviso({ tipo: 'erro', texto: 'O pagamento foi cancelado ou recusado pelo Mercado Pago. Você pode tentar novamente.' });
          return;
        }
      } catch {
        // sem resposta agora: tenta de novo
      }
      if (Date.now() - inicio > 10 * 60 * 1000) {
        setAguardando(false);
        setAviso({ tipo: 'info', texto: 'Não recebemos a confirmação ainda. Se você já pagou, clique em "Já paguei, verificar agora".' });
        return;
      }
      timer = window.setTimeout(checar, 3000);
    };

    const aoVoltarParaAba = () => {
      if (document.visibilityState !== 'visible' || cancelado) return;
      window.clearTimeout(timer);
      checar();
    };
    document.addEventListener('visibilitychange', aoVoltarParaAba);
    timer = window.setTimeout(checar, 3000);

    return () => {
      cancelado = true;
      window.clearTimeout(timer);
      document.removeEventListener('visibilitychange', aoVoltarParaAba);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [aguardando]);

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
        if (!cancelado) setPlano({ plano: a.plano, valor: Number(a.valor), periodo: a.periodo });
      } catch {
        if (!cancelado) navigate(ROTA_APOS_LOGIN, { replace: true });
      }
    })();
    return () => { cancelado = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Abre o checkout do Mercado Pago em outra aba e espera aqui. A aba é aberta ANTES da chamada
  // assíncrona (senão o navegador a bloqueia como pop-up) e depois recebe o endereço do checkout.
  const handlePagar = async () => {
    setErro(null);
    setAviso(null);
    setCarregando(true);

    // Padrão: mesma aba. O Mercado Pago devolve o cliente sozinho para /assinatura/sucesso (auto_return).
    // REACT_APP_PAGAMENTO_NOVA_ABA=true volta ao modo antigo (checkout em outra aba).
    const mesmaAba = process.env.REACT_APP_PAGAMENTO_NOVA_ABA !== 'true';
    const janela = mesmaAba ? null : window.open('', '_blank');
    if (janela) {
      // Corta o vínculo da aba do MP com esta (ela não precisa controlar o nosso site).
      // Continuamos com o controle dela daqui: ver o estado e fechá-la.
      try {
        janela.opener = null;
        janela.document.title = 'Mercado Pago';
        janela.document.body.style.cssText = 'font-family:sans-serif;text-align:center;margin-top:20vh;color:#444';
        janela.document.body.textContent = 'Abrindo o Mercado Pago...';
      } catch { /* ignora */ }
    }

    try {
      // Lembra o que fazer depois do pagamento (confirmar o e-mail do cadastro)
      localStorage.setItem('@menupoint:pos_pagamento', JSON.stringify({
        email: state.email,
        verificarEmail: Boolean(state.verificarEmail),
      }));
      const { init_point } = await AssinaturaService.checkout();
      urlCheckoutRef.current = init_point;

      if (janela) {
        janela.location.href = init_point;
        janelaRef.current = janela;
        setAguardando(true);
        setCarregando(false);
      } else {
        // Nova aba bloqueada pelo navegador: fluxo antigo, na mesma aba
        window.location.href = init_point;
      }
    } catch (err: any) {
      try { janela?.close(); } catch { /* ignora */ }
      setErro(err?.response?.data?.message ?? 'Não foi possível abrir o pagamento. Tente novamente.');
      setCarregando(false);
    }
  };

  // Aba do Mercado Pago fechada por engano: abre de novo o mesmo checkout
  const reabrirCheckout = () => {
    const url = urlCheckoutRef.current;
    if (!url) return;
    const janela = window.open(url, '_blank');
    if (janela) {
      try { janela.opener = null; } catch { /* ignora */ }
      janelaRef.current = janela;
    } else {
      window.location.href = url;
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
                  <small> {plano.periodo === 'ANUAL' ? '/ano' : '/mês'}</small>
                </span>
                <span className="pagamento__card-obs">
                  {plano.periodo === 'ANUAL' ? 'Pagamento único, válido por 12 meses.' : 'Pagamento único, válido por 1 mês.'}
                </span>
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

            {aguardando ? (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12, textAlign: 'center', marginBottom: 12 }}>
                <div className="pagamento__spinner" aria-hidden="true" />
                <p className="pagamento__seguro" style={{ margin: 0 }}>
                  <strong>Aguardando o pagamento...</strong><br />
                  Conclua na aba do Mercado Pago. Assim que for aprovado, levamos você para o login automaticamente.
                </p>
                <button type="button" className="pagamento__botao pagamento__botao--secundario" onClick={reabrirCheckout}>
                  Reabrir o Mercado Pago
                </button>
                <button
                  type="button"
                  onClick={() => { fecharJanelaDoCheckout(); setAguardando(false); }}
                  style={{ background: 'none', border: 0, color: '#a91e22', cursor: 'pointer', textDecoration: 'underline' }}
                >
                  Cancelar e voltar
                </button>
              </div>
            ) : (
              <button
                type="button"
                className="pagamento__botao"
                onClick={handlePagar}
                disabled={carregando || !plano}
              >
                {carregando ? 'Abrindo pagamento...' : 'Pagar com Mercado Pago'}
              </button>
            )}

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