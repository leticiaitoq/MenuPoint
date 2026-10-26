import React, { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import AuthCard from '../auth/AuthCard';
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

  // Mostra o plano escolhido. Se o pagamento já foi aprovado (ex.: pagou e fechou a aba),
  // libera o sistema e segue para a confirmação do e-mail, se ainda faltar.
  useEffect(() => {
    AssinaturaService.minha()
      .then((a) => {
        // Pendente, recusado ou cancelado: mostra o botão para pagar (de novo)
        if (a.status !== 'ATIVA') {
          setPlano({ plano: a.plano, valor: Number(a.valor) });
          return;
        }
        if (token && usuario) entrar({ token, usuario: { ...usuario, pagamento_pendente: false } });
        let pos: { email?: string; verificarEmail?: boolean } = {};
        try { pos = JSON.parse(localStorage.getItem('@menupoint:pos_pagamento') || '{}'); } catch { /* ignora */ }
        localStorage.removeItem('@menupoint:pos_pagamento');
        if (pos.verificarEmail) navigate('/verify-code', { state: { email: pos.email, mode: 'register' }, replace: true });
        else navigate(ROTA_APOS_LOGIN, { replace: true });
      })
      .catch(() => navigate(ROTA_APOS_LOGIN, { replace: true }));
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

            {erro && <p className="pagamento__erro">{erro}</p>}

            <button
              type="button"
              className="pagamento__botao"
              onClick={handlePagar}
              disabled={carregando || !plano}
            >
              {carregando ? 'Abrindo pagamento...' : 'Pagar com Mercado Pago'}
            </button>

            <p className="pagamento__seguro">
              🔒 Você será levado ao Mercado Pago para concluir o pagamento com segurança.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PagamentoPage;