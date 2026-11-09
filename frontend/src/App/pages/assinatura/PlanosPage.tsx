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

const CHAVE_PERIODO = '@menupoint:periodo';

// Valor mensal de cada plano. O anual é calculado no backend (Planos.config.ts: 12 x mensal, menos o
// desconto anual, se houver); aqui o desconto precisa ser o mesmo, por isso fica numa constante só.
const PLANOS = [
  { slug: 'starter', nome: 'Starter', valor: 97 },
  { slug: 'pro', nome: 'Pro', valor: 197 },
];
const DESCONTO_ANUAL_PERCENTUAL = 0; // manter igual ao backend

const valorAnual = (mensal: number) =>
  Math.round(mensal * 12 * (1 - DESCONTO_ANUAL_PERCENTUAL / 100) * 100) / 100;
const brl = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

const PlanosPage: React.FC = () => {
  const navigate = useNavigate();
  const [escolhido, setEscolhido] = useState<string | null>(() => {
    const guardado = sessionStorage.getItem(CHAVE_PLANO);
    return PLANOS.some((p) => p.slug === guardado) ? guardado : null;
  });
  const [periodo, setPeriodo] = useState<'mensal' | 'anual'>(
    () => (sessionStorage.getItem(CHAVE_PERIODO) === 'anual' ? 'anual' : 'mensal')
  );
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
      await AssinaturaService.escolherPlano(escolhido, periodo);
      sessionStorage.setItem(CHAVE_PLANO, escolhido);
      sessionStorage.setItem(CHAVE_PERIODO, periodo);
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

            <div style={{ display: 'flex', gap: 8, marginBottom: 16 }} role="group" aria-label="Período de cobrança">
              {(['mensal', 'anual'] as const).map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => setPeriodo(p)}
                  aria-pressed={periodo === p}
                  style={{
                    flex: 1,
                    padding: '10px 12px',
                    borderRadius: 999,
                    cursor: 'pointer',
                    fontWeight: 600,
                    background: periodo === p ? '#a91e22' : '#fff',
                    color: periodo === p ? '#fff' : '#111827',
                    border: `2px solid ${periodo === p ? '#a91e22' : '#e5e7eb'}`,
                  }}
                >
                  {p === 'mensal' ? 'Mensal' : 'Anual'}
                </button>
              ))}
            </div>

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
                      {brl(periodo === 'anual' ? valorAnual(pl.valor) : pl.valor)}
                    </span>
                    <small style={{ color: '#6b7280' }}> {periodo === 'anual' ? '/ano' : '/mês'}</small>
                    <span style={{ display: 'block', fontSize: 13, color: '#6b7280', marginTop: 4 }}>
                      {periodo === 'anual' ? 'Pagamento único, válido por 12 meses.' : 'Pagamento único, válido por 1 mês.'}
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