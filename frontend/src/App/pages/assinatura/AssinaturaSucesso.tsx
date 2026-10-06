import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../../services/api';
import { useAuth, ROTA_APOS_LOGIN } from '../../shared/contexts/Authcontext';

const AssinaturaSucesso: React.FC = () => {
  const navigate = useNavigate();
  const { token, usuario, entrar } = useAuth();
  const [status, setStatus] = useState<'checando' | 'ativa' | 'demorando' | 'recusado'>('checando');

  // Logo após o cadastro falta confirmar o e-mail; nos demais casos vai direto ao sistema
  const irParaProximaTela = () => {
    let pos: { email?: string; verificarEmail?: boolean } = {};
    try { pos = JSON.parse(localStorage.getItem('@menupoint:pos_pagamento') || '{}'); } catch { /* ignora */ }
    localStorage.removeItem('@menupoint:pos_pagamento');
    if (pos.verificarEmail) navigate('/verify-code', { state: { email: pos.email, mode: 'register' }, replace: true });
    else navigate(ROTA_APOS_LOGIN, { replace: true });
  };

  useEffect(() => {
    let tentativas = 0;
    const maxTentativas = 8;

    const verificar = async () => {
      try {
        const { data } = await api.get('/assinatura/minha');
        if (data?.status === 'CANCELADA' || data?.status === 'FALHOU') {
          setStatus('recusado');
          return;
        }
        if (data?.status === 'ATIVA') {
          setStatus('ativa');
          // Pagamento aprovado: libera o restante do sistema
          if (token && usuario) entrar({ token, usuario: { ...usuario, pagamento_pendente: false } });
          setTimeout(irParaProximaTela, 1500);
          return;
        }
      } catch {
        // ainda sem assinatura confirmada, tenta de novo
      }

      tentativas += 1;
      if (tentativas >= maxTentativas) {
        setStatus('demorando');
        return;
      }
      setTimeout(verificar, 3000);
    };

    verificar();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      textAlign: 'center',
      padding: '24px',
    }}>
      {status === 'checando' && (
        <>
          <h2>Confirmando seu pagamento...</h2>
          <p>Isso leva só alguns segundos. Não feche esta página.</p>
        </>
      )}
      {status === 'ativa' && (
        <>
          <h2>Pagamento confirmado! 🎉</h2>
          <p>Levando você para o sistema...</p>
        </>
      )}
      {status === 'demorando' && (
        <>
          <h2>Ainda não recebemos a confirmação</h2>
          <p>
            Se você já pagou, pode levar alguns minutos. Se o pagamento não foi concluído,
            é só tentar de novo.
          </p>
          <button onClick={() => window.location.reload()}>Verificar novamente</button>
          <button onClick={() => navigate('/pagamento', { replace: true })} style={{ marginTop: 8 }}>
            Voltar ao pagamento
          </button>
        </>
      )}
      {status === 'recusado' && (
        <>
          <h2>Não foi possível concluir o pagamento</h2>
          <p>O pagamento foi recusado ou cancelado. Você pode tentar novamente.</p>
          <button onClick={() => navigate('/pagamento', { replace: true })}>Tentar novamente</button>
        </>
      )}
    </div>
  );
};

export default AssinaturaSucesso;