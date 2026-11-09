import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import AuthCard from '../auth/AuthCard';
import AuthService from '../../services/auth.service';
import AssinaturaService from '../../services/assinatura.service';
import { useAuth } from '../../shared/contexts/Authcontext';
import '../auth/LoginPage.css';
import './PagamentoPage.css';

// Tela de retorno do Mercado Pago: confere o pagamento direto no MP (sem esperar o webhook)
// e, se aprovado, volta ao login com um aviso de sucesso.

type Estado = 'checando' | 'ativa' | 'demorando' | 'recusado';

const INTERVALO_MS = 2000;
const MAX_TENTATIVAS = 15;

const STATUS_MP_PT: Record<string, string> = {
  pending: 'aguardando confirmação',
  authorized: 'aprovado',
  cancelled: 'cancelado',
  paused: 'pausado',
};

const AssinaturaSucesso: React.FC = () => {
  const navigate = useNavigate();
  const { sair } = useAuth();
  const [estado, setEstado] = useState<Estado>('checando');
  const [rodada, setRodada] = useState(0);
  const [statusMP, setStatusMP] = useState<string | null>(null);
  const [progresso, setProgresso] = useState(5);
  // O Mercado Pago já mostrou a própria tela de carregamento, então a conferência roda em silêncio.
  // Só aparece uma tela de "Confirmando..." se demorar mais que isso (ou ao verificar de novo).
  const [mostrarCarregando, setMostrarCarregando] = useState(false);

  // Pagamento aprovado: encerra a sessão e volta ao login, que mostra o modal de sucesso.
  // Se o e-mail ainda não foi confirmado, manda um código novo (o do cadastro pode ter expirado);
  // falhas, como o intervalo mínimo entre reenvios, são ignoradas: o login tem o botão "Reenviar".
  const voltarParaLogin = () => {
    let pos: { email?: string; verificarEmail?: boolean } = {};
    try { pos = JSON.parse(localStorage.getItem('@menupoint:pos_pagamento') || '{}'); } catch { /* ignora */ }
    localStorage.removeItem('@menupoint:pos_pagamento');
    if (pos.verificarEmail && pos.email) AuthService.resendCode(pos.email, 'registro').catch(() => undefined);
    sair();
    navigate('/login', { replace: true, state: { pagamentoAprovado: true } });
  };

  // Barra "carregando": avança devagar até 90% enquanto confere o pagamento e completa ao aprovar
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
    setMostrarCarregando(rodada > 0);
    const timerCarregando = setTimeout(() => { if (!cancelado) setMostrarCarregando(true); }, 2500);

    const verificar = async () => {
      if (cancelado) return;
      try {
        const { status, status_mp } = await AssinaturaService.sincronizar();
        if (cancelado) return;
        setStatusMP(status_mp ?? null);
        if (status === 'CANCELADA' || status === 'FALHOU') {
          setEstado('recusado');
          return;
        }
        if (status === 'ATIVA') {
          setEstado('ativa');
          setProgresso(100);
          voltarParaLogin(); // o login já mostra o aviso de pagamento aprovado
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
    return () => { cancelado = true; clearTimeout(timerCarregando); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rodada]);

  return (
    <div className="login-page" style={{ backgroundImage: 'url(/images/Register-Back.png)' }}>
      <div className="login-page__container">
        <AuthCard />

        <div className="login-page__form-side">
          <div className="pagamento pagamento--centro">
            {estado === 'checando' && mostrarCarregando && (
              <>
                <h1 className="pagamento__titulo">Confirmando seu pagamento...</h1>
                <div className="pagamento__barra" role="progressbar" aria-valuenow={Math.round(progresso)} aria-valuemin={0} aria-valuemax={100}>
                  <div className="pagamento__barra-preenchimento" style={{ width: `${progresso}%` }} />
                </div>
                <p className="pagamento__subtitulo">Estamos consultando o Mercado Pago. Isso leva só alguns segundos, não feche esta página.</p>
              </>
            )}

            {estado === 'ativa' && (
              <>
                <div className="pagamento__icone pagamento__icone--ok" aria-hidden="true">✓</div>
                <h1 className="pagamento__titulo">Pagamento confirmado!</h1>
                <div className="pagamento__barra" role="progressbar" aria-valuenow={100} aria-valuemin={0} aria-valuemax={100}>
                  <div className="pagamento__barra-preenchimento" style={{ width: '100%' }} />
                </div>
                <p className="pagamento__subtitulo">Redirecionando para o login...</p>
              </>
            )}

            {estado === 'demorando' && (
              <>
                <div className="pagamento__icone pagamento__icone--aviso" aria-hidden="true">!</div>
                <h1 className="pagamento__titulo">Ainda não recebemos a confirmação</h1>
                <p className="pagamento__subtitulo">
                  Se você já pagou, pode levar alguns minutos. Se o pagamento não foi concluído, é só tentar de novo.
                </p>
                {statusMP && (
                  <p className="pagamento__subtitulo">
                    Status no Mercado Pago: <strong>{STATUS_MP_PT[statusMP] ?? statusMP}</strong>
                  </p>
                )}
                <button type="button" className="pagamento__botao" onClick={() => setRodada((r) => r + 1)}>
                  Verificar novamente
                </button>
                <button
                  type="button"
                  className="pagamento__botao pagamento__botao--secundario"
                  onClick={() => navigate('/pagamento', { replace: true })}
                >
                  Voltar ao pagamento
                </button>
              </>
            )}

            {estado === 'recusado' && (
              <>
                <div className="pagamento__icone pagamento__icone--erro" aria-hidden="true">✕</div>
                <h1 className="pagamento__titulo">Não foi possível concluir o pagamento</h1>
                <p className="pagamento__subtitulo">O pagamento foi recusado ou cancelado. Você pode tentar novamente.</p>
                <button type="button" className="pagamento__botao" onClick={() => navigate('/pagamento', { replace: true })}>
                  Tentar novamente
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default AssinaturaSucesso;