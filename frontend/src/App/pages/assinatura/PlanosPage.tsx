import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import CheckoutShell from './CheckoutShell';
import AssinaturaService from '../../services/assinatura.service';
import { ROTA_APOS_LOGIN } from '../../shared/contexts/Authcontext';

// Escolha do plano (depois da confirmação do e-mail e antes do pagamento).

const CHAVE_PLANO = '@menupoint:plano';
const CHAVE_PERIODO = '@menupoint:periodo';

// Valor mensal de cada plano. O anual é calculado no backend (Planos.config.ts: 12 x mensal, menos o
// desconto anual, se houver); aqui o desconto precisa ser o mesmo, por isso fica numa constante só.
const PLANOS = [
  { slug: 'starter', nome: 'Starter', valor: 97, popular: false },
  { slug: 'pro', nome: 'Pro', valor: 197, popular: true },
];
const DESCONTO_ANUAL_PERCENTUAL = 0; // manter igual ao backend

const valorAnual = (mensal: number) =>
  Math.round(mensal * 12 * (1 - DESCONTO_ANUAL_PERCENTUAL / 100) * 100) / 100;
const brl = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

const PlanosPage: React.FC = () => {
  const navigate = useNavigate();
  const [escolhido, setEscolhido] = useState<string | null>(() => {
    const guardado = sessionStorage.getItem(CHAVE_PLANO);
    return PLANOS.some((p) => p.slug === guardado) ? guardado : 'pro';
  });
  const [periodo, setPeriodo] = useState<'mensal' | 'anual'>(
    () => (sessionStorage.getItem(CHAVE_PERIODO) === 'mensal' ? 'mensal' : 'anual')
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
    <CheckoutShell>
      <h1 className="ck__titulo">Escolha seu plano</h1>
      <p className="ck__sub">Pagamento único pelo Mercado Pago. Sem cobrança automática.</p>

      <div className="ck__periodo" role="group" aria-label="Período de cobrança">
        {(['mensal', 'anual'] as const).map((p) => (
          <button key={p} type="button" onClick={() => setPeriodo(p)} aria-pressed={periodo === p}>
            {p === 'mensal' ? 'Mensal' : 'Anual'}
          </button>
        ))}
      </div>

      <span className="ck__rotulo">Planos disponíveis</span>
      {PLANOS.map((pl) => (
        <button
          key={pl.slug}
          type="button"
          className="ck__plano"
          aria-pressed={escolhido === pl.slug}
          onClick={() => setEscolhido(pl.slug)}
        >
          {pl.popular && <span className="ck__selo">Mais popular</span>}
          <span className="ck__plano-icone" aria-hidden="true">{pl.nome[0]}</span>
          <span className="ck__plano-info">
            <span className="ck__plano-nome">{pl.nome}</span>
            <span className="ck__plano-detalhe">
              {periodo === 'anual' ? `12 meses por ${brl(valorAnual(pl.valor))}` : '1 mês, pagamento único'}
            </span>
          </span>
          <span className="ck__plano-preco">
            {brl(periodo === 'anual' ? valorAnual(pl.valor) / 12 : pl.valor)}
            <small>/mês</small>
          </span>
        </button>
      ))}

      {erro && <p className="ck__aviso ck__aviso--erro">{erro}</p>}

      <button type="button" className="ck__botao" onClick={handleContinuar} disabled={carregando || !escolhido}>
        {carregando ? 'Salvando...' : 'Continuar'}
      </button>
    </CheckoutShell>
  );
};

export default PlanosPage;
