import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import api from '../../services/api';

const ConfirmarEmail: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [status, setStatus] = useState<'confirmando' | 'sucesso' | 'erro'>('confirmando');
  const [mensagemErro, setMensagemErro] = useState('');

  useEffect(() => {
    const token = searchParams.get('token');

    if (!token) {
      setStatus('erro');
      setMensagemErro('Link inválido — nenhum token encontrado.');
      return;
    }

    api
      .post('/auth/confirmar-email', { token })
      .then(() => setStatus('sucesso'))
      .catch((err) => {
        setStatus('erro');
        setMensagemErro(
          err?.response?.data?.message ?? 'Não foi possível confirmar seu e-mail.'
        );
      });
  }, [searchParams]);

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
      {status === 'confirmando' && (
        <>
          <h2>Confirmando seu e-mail...</h2>
          <p>Um instante.</p>
        </>
      )}
      {status === 'sucesso' && (
        <>
          <h2>E-mail confirmado! ✅</h2>
          <p>Sua conta está totalmente ativa agora.</p>
          <button onClick={() => navigate('/restaurante/home')}>
            Ir para o sistema
          </button>
        </>
      )}
      {status === 'erro' && (
        <>
          <h2>Não foi possível confirmar</h2>
          <p>{mensagemErro}</p>
          <p>O link pode ter expirado (validade de 48h) ou já ter sido usado.</p>
          <button onClick={() => navigate('/restaurante/home')}>
            Ir para o sistema mesmo assim
          </button>
        </>
      )}
    </div>
  );
};

export default ConfirmarEmail;
