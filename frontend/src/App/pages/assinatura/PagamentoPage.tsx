import React, { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import AuthCard from '../auth/AuthCard';
import AssinaturaService from '../../services/assinatura.service';
import { useAuth, ROTA_APOS_LOGIN } from '../../shared/contexts/Authcontext';
import '../auth/LoginPage.css';

// PAGAMENTO TEMPORÁRIO (sem cobrança real).
// Para usar o Mercado Pago: no lugar de confirmarPagamento(), chame
// AssinaturaService.criar(plan_id, email) e redirecione para o init_point.

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

  // Mostra o plano escolhido; se não há pagamento pendente, não há o que fazer aqui
  useEffect(() => {
    AssinaturaService.minha()
      .then((a) => {
        if (a.status !== 'PENDENTE') navigate(ROTA_APOS_LOGIN, { replace: true });
        else setPlano({ plano: a.plano, valor: Number(a.valor) });
      })
      .catch(() => navigate(ROTA_APOS_LOGIN, { replace: true }));
  }, [navigate]);

  const handleConfirmar = async () => {
    setErro(null);
    setCarregando(true);
    try {
      await AssinaturaService.confirmarPagamento();
      if (token && usuario) {
        entrar({ token, usuario: { ...usuario, pagamento_pendente: false } });
      }
      // Logo após o cadastro, falta confirmar o e-mail com o código enviado
      if (state.verificarEmail) {
        navigate('/verify-code', { state: { email: state.email, mode: 'register' }, replace: true });
      } else {
        navigate(ROTA_APOS_LOGIN, { replace: true });
      }
    } catch (err: any) {
      setErro(err?.response?.data?.message ?? 'Não foi possível confirmar o pagamento. Tente novamente.');
      setCarregando(false);
    }
  };

  return (
    <div className="login-page" style={{ backgroundImage: 'url(/images/Register-Back.png)' }}>
      <div className="login-page__container">
        <AuthCard />

        <div className="login-page__form-side">
          <h1 className="login-page__title">Pagamento</h1>

          {plano && (
            <p style={{ textAlign: 'center', marginBottom: '16px' }}>
              Plano <strong>{NOME_PLANO[plano.plano] ?? plano.plano}</strong> —{' '}
              {plano.valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}/mês
            </p>
          )}

          {erro && (
            <p style={{ color: 'red', fontSize: '14px', marginBottom: '8px' }}>{erro}</p>
          )}

          <button
            type="button"
            className="login-page__submit"
            onClick={handleConfirmar}
            disabled={carregando || !plano}
          >
            {carregando ? 'Confirmando...' : 'Confirmar pagamento'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default PagamentoPage;
