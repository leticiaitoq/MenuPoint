import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../../services/api';

const AssinaturaSucesso: React.FC = () => {
  const navigate = useNavigate();
  const [status, setStatus] = useState<'checando' | 'ativa' | 'demorando'>('checando');

  useEffect(() => {
    let tentativas = 0;
    const maxTentativas = 8;

    const verificar = async () => {
      try {
        const { data } = await api.get('/assinatura/minha');
        if (data?.status === 'ATIVA') {
          setStatus('ativa');
          setTimeout(() => navigate('/restaurante/home'), 1500);
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
  }, [navigate]);

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
          <h2>Seu pagamento está sendo processado</h2>
          <p>
            Isso às vezes demora um pouco mais. Você já pode entrar no sistema —
            sua assinatura será ativada automaticamente assim que o pagamento for confirmado.
          </p>
          <button onClick={() => navigate('/restaurante/home')}>
            Ir para o sistema
          </button>
        </>
      )}
    </div>
  );
};

export default AssinaturaSucesso;