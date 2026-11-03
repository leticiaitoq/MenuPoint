import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import AuthCard from '../auth/AuthCard';
import AuthService from '../../services/auth.service';
import AssinaturaService from '../../services/assinatura.service';
import { useAuth, ROTA_APOS_LOGIN } from '../../shared/contexts/Authcontext';
import '../auth/LoginPage.css';
import './PagamentoPage.css';

// Tela de retorno do Mercado Pago: confere o pagamento direto no MP (sem esperar o webhook)
// e segue para a confirmação do e-mail ou para o sistema.

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
  const { token, usuario, entrar } = useAuth();
  const [estado, setEstado] = useState<Estado>('checando');
  const [rodada, setRodada] = useState(0);
  const [statusMP, setStatusMP] = useState<string | null>(null);

  // Logo após o cadastro falta confirmar o e-mail; nos demais casos vai direto ao sistema
  const irParaProximaTela = () => {
    let pos: { email?: string; verificarEmail?: boolean } = {};
    try { pos = JSON.parse(localStorage.getItem('@menupoint:pos_pagamento') || '{}'); } catch { /* ignora */ }
    localStorage.removeItem('@menupoint:pos_pagamento');
    // Pagamento aprovado: envia um código novo (o do cadastro pode ter expirado). Falhas, como o
    // intervalo mínimo entre reenvios, são ignoradas: a tela do código tem o botão "Reenviar".
    if (pos.verificarEmail && pos.email) AuthService.resendCode(pos.email, 'registro').catch(() => undefined);
    if (pos.verificarEmail) navigate('/verify-code', { state: { email: pos.email, mode: 'register' }, replace: true });
    else navigate(ROTA_APOS_LOGIN, { replace: true });
  };

  useEffect(() => {
    let cancelado = false;
    let tentativas = 0;
    setEstado('checando');

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
          // Pagamento aprovado: libera o restante do sistema
          if (token && usuario) entrar({ token, usuario: { ...usuario, pagamento_pendente: false } });
          setTimeout(() => { if (!cancelado) irParaProximaTela(); }, 800);
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
    <div className="login-page" style={{ backgroundImage: 'url(/images/Register-Back.png)' }}>
      <div className="login-page__container">
        <AuthCard />

        <div className="login-page__form-side">
          <div className="pagamento pagamento--centro">
            {estado === 'checando' && (
              <>
                <div className="pagamento__spinner" aria-hidden="true" />
                <h1 className="pagamento__titulo">Confirmando seu pagamento...</h1>
                <p className="pagamento__subtitulo">Estamos consultando o Mercado Pago. Isso leva só alguns segundos, não feche esta página.</p>
              </>
            )}

            {estado === 'ativa' && (
              <>
                <div className="pagamento__icone pagamento__icone--ok" aria-hidden="true">✓</div>
                <h1 className="pagamento__titulo">Pagamento confirmado!</h1>
                <p className="pagamento__subtitulo">Levando você para o próximo passo...</p>
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