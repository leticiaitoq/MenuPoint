import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import CheckoutShell from './CheckoutShell';
import AuthService from '../../services/auth.service';
import AssinaturaService from '../../services/assinatura.service';
import { useAuth, ROTA_APOS_LOGIN } from '../../shared/contexts/Authcontext';

// Tela de retorno do Mercado Pago (auto_return): confere o pagamento direto no MP, sem esperar o
// webhook, e mostra "Pagamento confirmado!" com o botão para entrar no sistema.

type Estado = 'checando' | 'ativa' | 'demorando' | 'recusado';

const INTERVALO_MS = 2000;
const MAX_TENTATIVAS = 15;
const NOME_PLANO: Record<string, string> = { STARTER: 'Starter', PRO: 'Pro' };

const AssinaturaSucesso: React.FC = () => {
  const navigate = useNavigate();
  const { token, usuario, entrar, sair } = useAuth();
  const [estado, setEstado] = useState<Estado>('checando');
  const [rodada, setRodada] = useState(0);
  const [progresso, setProgresso] = useState(5);
  const [nomePlano, setNomePlano] = useState('');
  const [periodoPlano, setPeriodoPlano] = useState('');

  // Pagamento aprovado: libera a sessão (se ela ainda existe) e segue para o sistema.
  // Se o e-mail do cadastro ainda não foi confirmado, leva à tela do código.
  const irParaOSistema = () => {
    let pos: { email?: string; verificarEmail?: boolean } = {};
    try { pos = JSON.parse(localStorage.getItem('@menupoint:pos_pagamento') || '{}'); } catch { /* ignora */ }
    localStorage.removeItem('@menupoint:pos_pagamento');

    if (pos.verificarEmail && pos.email) {
      AuthService.resendCode(pos.email, 'registro').catch(() => undefined);
      navigate('/verify-code', { state: { email: pos.email, mode: 'register' }, replace: true });
      return;
    }
    if (token && usuario) {
      entrar({ token, usuario: { ...usuario, pagamento_pendente: false } });
      navigate(ROTA_APOS_LOGIN, { replace: true });
      return;
    }
    sair();
    navigate('/login', { replace: true, state: { pagamentoAprovado: true } });
  };

  // Barra "carregando": avança devagar até 90% enquanto confere o pagamento
  useEffect(() => {
    if (estado !== 'checando') return;
    const id = setInterval(() => setProgresso((p) => (p < 90 ? p + (90 - p) * 0.06 : p)), 300);
    return () => clearInterval(id);
  }, [estado, rodada]);

  useEffect(() => {
    let cancelado = false;
    let tentativas = 0;
    setEstado('checando');
    setProgresso(5);

    const verificar = async () => {
      if (cancelado) return;
      try {
        const { status } = await AssinaturaService.sincronizar();
        if (cancelado) return;
        if (status === 'CANCELADA' || status === 'FALHOU') {
          setEstado('recusado');
          return;
        }
        if (status === 'ATIVA') {
          try {
            const a = await AssinaturaService.minha();
            if (!cancelado) {
              setNomePlano(NOME_PLANO[a.plano] ?? a.plano);
              setPeriodoPlano(a.periodo === 'ANUAL' ? 'anual' : 'mensal');
            }
          } catch { /* mostra a mensagem sem o nome do plano */ }
          if (cancelado) return;
          setProgresso(100);
          setEstado('ativa');
          return;
        }
      } catch {
        // ainda sem confirmação: tenta de novo
      }

      tentativas += 1;
      if (tentativas >= MAX_TENTATIVAS) {
        setEstado('demorando');
        return;
      }
      setTimeout(verificar, INTERVALO_MS);
    };

    verificar();
    return () => { cancelado = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rodada]);

  return (
    <CheckoutShell>
      <div className="ck__conteudo--centro" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16, textAlign: 'center' }}>
        {estado === 'checando' && (
          <>
            <div className="ck__giro" aria-hidden="true" />
            <h1 className="ck__titulo">Confirmando seu pagamento...</h1>
            <div className="ck__barra" role="progressbar" aria-valuenow={Math.round(progresso)} aria-valuemin={0} aria-valuemax={100}>
              <div style={{ width: `${progresso}%` }} />
            </div>
            <p className="ck__texto">Estamos consultando o Mercado Pago. Isso leva só alguns segundos, não feche esta página.</p>
          </>
        )}

        {estado === 'ativa' && (
          <>
            <div className="ck__icone ck__icone--ok" aria-hidden="true">✓</div>
            <h1 className="ck__titulo">Pagamento confirmado!</h1>
            <p className="ck__texto">
              {nomePlano
                ? `Sua assinatura do plano ${nomePlano} (${periodoPlano}) foi ativada. Agora é só aproveitar o MenuPoint.`
                : 'Sua assinatura foi ativada. Agora é só aproveitar o MenuPoint.'}
            </p>
            <button type="button" className="ck__botao" onClick={irParaOSistema}>
              Ir para o painel
            </button>
          </>
        )}

        {estado === 'demorando' && (
          <>
            <div className="ck__icone ck__icone--aviso" aria-hidden="true">!</div>
            <h1 className="ck__titulo">Ainda não recebemos a confirmação</h1>
            <p className="ck__texto">
              Se você já pagou, pode levar alguns minutos. Se o pagamento não foi concluído, é só tentar de novo.
            </p>
            <button type="button" className="ck__botao" onClick={() => setRodada((r) => r + 1)}>
              Verificar novamente
            </button>
            <button type="button" className="ck__botao ck__botao--sec" onClick={() => navigate('/pagamento', { replace: true })}>
              Voltar ao pagamento
            </button>
          </>
        )}

        {estado === 'recusado' && (
          <>
            <div className="ck__icone ck__icone--erro" aria-hidden="true">✕</div>
            <h1 className="ck__titulo">Não foi possível concluir o pagamento</h1>
            <p className="ck__texto">O pagamento foi recusado ou cancelado. Você pode tentar novamente.</p>
            <button type="button" className="ck__botao" onClick={() => navigate('/pagamento', { replace: true })}>
              Tentar novamente
            </button>
          </>
        )}
      </div>
    </CheckoutShell>
  );
};

export default AssinaturaSucesso;
