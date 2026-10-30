import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import AuthCard from '../auth/AuthCard';
import AssinaturaService from '../../services/assinatura.service';
import { ROTA_APOS_LOGIN } from '../../shared/contexts/Authcontext';
import '../auth/LoginPage.css';
import './PagamentoPage.css';

// Tela única de escolha do plano: aparece depois da confirmação do e-mail e antes do pagamento.
// Quem já escolheu o plano no site (/cadastro?plano=...) não passa por aqui.

const CHAVE_PLANO = '@menupoint:plano';

const PLANOS = [
  { slug: 'starter', nome: 'Starter', valor: 97 },
  { slug: 'pro', nome: 'Pro', valor: 197 },
];

const PlanosPage: React.FC = () => {
  const navigate = useNavigate();
  const [escolhido, setEscolhido] = useState<string | null>(() => {
    const guardado = sessionStorage.getItem(CHAVE_PLANO);
    return PLANOS.some((p) => p.slug === guardado) ? guardado : null;
  });
  const [erro, setErro] = useState<string | null>(null);
  const [carregando, setCarregando] = useState(false);

  // Assinatura já ativa: não há o que escolher, segue para o sistema
  useEffect(() => {
    AssinaturaService.minha()
      .then((a) => { if (a.status === 'ATIVA') navigate(ROTA_APOS_LOGIN, { replace: true }); })
      .catch(() => undefined);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleContinuar = async () => {
    if (!escolhido) return;
    setErro(null);
    setCarregando(true);
    try {
      await AssinaturaService.escolherPlano(escolhido);
      sessionStorage.setItem(CHAVE_PLANO, escolhido);
      navigate('/pagamento', { replace: true });
    } catch (err: any) {
      setErro(err?.response?.data?.message ?? 'Não foi possível salvar o plano. Tente novamente.');
      setCarregando(false);
    }
  };

  return (
    <div className="login-page" style={{ backgroundImage: 'url(/images/Register-Back.png)' }}>
      <div className="login-page__container">
        <AuthCard />

        <div className="login-page__form-side">
          <div className="pagamento">
            <h1 className="pagamento__titulo">Escolha seu plano</h1>
            <p className="pagamento__subtitulo">
              Seu e-mail foi confirmado. Falta escolher o plano para seguir ao pagamento.
            </p>

            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 16 }}>
              {PLANOS.map((pl) => {
                const ativo = escolhido === pl.slug;
                return (
                  <button
                    key={pl.slug}
                    type="button"
                    onClick={() => setEscolhido(pl.slug)}
                    aria-pressed={ativo}
                    style={{
                      flex: '1 1 180px',
                      textAlign: 'left',
                      padding: '16px 18px',
                      borderRadius: 12,
                      cursor: 'pointer',
                      background: ativo ? '#fdf2f2' : '#fff',
                      border: `2px solid ${ativo ? '#a91e22' : '#e5e7eb'}`,
                      color: '#111827',
                    }}
                  >
                    <strong style={{ display: 'block', fontSize: 18 }}>{pl.nome}</strong>
                    <span style={{ fontSize: 24, fontWeight: 700 }}>
                      {pl.valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                    </span>
                    <small style={{ color: '#6b7280' }}> /mês</small>
                    <span style={{ display: 'block', fontSize: 13, color: '#6b7280', marginTop: 4 }}>
                      Cobrança mensal recorrente.
                    </span>
                  </button>
                );
              })}
            </div>

            {erro && <p className="pagamento__erro">{erro}</p>}

            <button
              type="button"
              className="pagamento__botao"
              onClick={handleContinuar}
              disabled={carregando || !escolhido}
            >
              {carregando ? 'Salvando...' : 'Continuar para o pagamento'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PlanosPage;