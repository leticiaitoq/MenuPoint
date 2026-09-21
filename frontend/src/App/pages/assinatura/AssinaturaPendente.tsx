import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { HiCheckCircle, HiOutlineCreditCard, HiOutlineLogout } from 'react-icons/hi';
import AuthCard from '../auth/AuthCard';
import api from '../../services/api';
import AssinaturaService, { Plano } from '../../services/assinatura.service';
import './AssinaturaPendente.css';

type Estado = 'carregando' | 'sem_plano' | 'pendente' | 'ativa' | 'erro';

const AssinaturaPendente: React.FC = () => {
  const navigate = useNavigate();
  const [estado, setEstado] = useState<Estado>('carregando');
  const [planos, setPlanos] = useState<Plano[]>([]);
  const [checkoutUrl, setCheckoutUrl] = useState<string | null>(null);
  const [planoSelecionando, setPlanoSelecionando] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const pollRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const usuario = (() => {
    try {
      return JSON.parse(localStorage.getItem('@menupoint:usuario') ?? '{}');
    } catch {
      return {};
    }
  })();

  const verificarAssinatura = async () => {
    try {
      const { data } = await api.get('/assinatura/minha');
      if (data?.status === 'ATIVA') {
        setEstado('ativa');
        if (pollRef.current) clearTimeout(pollRef.current);
        setTimeout(() => navigate('/restaurante/home'), 1500);
        return;
      }
      // Existe assinatura, mas ainda não ativa (pendente, falhou, etc.)
      setCheckoutUrl(data?.checkout_url ?? null);
      setEstado('pendente');
    } catch {
      // 404: nenhuma assinatura foi criada ainda
      const lista = await AssinaturaService.listarPlanos();
      setPlanos(lista);
      setEstado('sem_plano');
    }
  };

  useEffect(() => {
    verificarAssinatura();
    return () => {
      if (pollRef.current) clearTimeout(pollRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Enquanto estiver "pendente", continua checando de tempos em tempos —
  // se a pessoa pagar em outra aba, o acesso libera sozinho aqui.
  useEffect(() => {
    if (estado !== 'pendente') return;
    pollRef.current = setTimeout(verificarAssinatura, 6000);
    return () => {
      if (pollRef.current) clearTimeout(pollRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [estado]);

  const handleEscolherPlano = async (plano: Plano) => {
    setPlanoSelecionando(plano.slug);
    setErro(null);
    try {
      const { init_point } = await AssinaturaService.criar(plano.id, usuario?.email);
      window.location.href = init_point;
    } catch (err: any) {
      setPlanoSelecionando(null);
      setErro(
        err?.response?.data?.message ??
        'Não foi possível iniciar o pagamento agora. Tente novamente em instantes.'
      );
    }
  };

  // Enterprise não é um plano de assinatura no Mercado Pago — é venda
  // consultiva, então aqui só abre o e-mail de contato (mesmo comportamento
  // já usado no site institucional).
  const handleFalarComEspecialista = () => {
    window.location.href =
      'mailto:contato@menupoint.com.br?subject=Interesse%20no%20Plano%20Enterprise';
  };

  const handleSair = () => {
    localStorage.removeItem('@menupoint:token');
    localStorage.removeItem('@menupoint:refresh_token');
    localStorage.removeItem('@menupoint:usuario');
    navigate('/login');
  };

  return (
    <div
      className="assinatura-pendente-page"
      style={{ backgroundImage: 'url(/images/Register-Back.png)' }}
    >
      <div className="assinatura-pendente-page__container">
        <AuthCard />

        <div className="assinatura-pendente-page__form-side">
          <div className="assinatura-pendente-page__icon-wrapper">
            <HiOutlineCreditCard className="assinatura-pendente-page__icon" />
          </div>

          {estado === 'carregando' && (
            <>
              <h1 className="assinatura-pendente-page__title">Só mais um passo</h1>
              <p className="assinatura-pendente-page__description">
                Estamos verificando sua assinatura...
              </p>
            </>
          )}

          {estado === 'sem_plano' && (
            <>
              <h1 className="assinatura-pendente-page__title">Escolha seu plano</h1>
              <p className="assinatura-pendente-page__description">
                Seu e-mail já foi confirmado. Falta só escolher um plano e concluir o
                pagamento pra liberar o acesso ao sistema.
              </p>

              {erro && <p className="assinatura-pendente-page__error">{erro}</p>}

              <div className="assinatura-pendente-page__planos">
                {planos.map((plano) => (
                  <div className="assinatura-pendente-page__plano-card" key={plano.slug}>
                    <div className="assinatura-pendente-page__plano-nome">{plano.nome}</div>
                    <div className="assinatura-pendente-page__plano-valor">
                      <span className="assinatura-pendente-page__plano-moeda">R$</span>
                      {plano.valor.toFixed(2).replace('.', ',')}
                      <span className="assinatura-pendente-page__plano-periodo">/mês</span>
                    </div>
                    <button
                      className="assinatura-pendente-page__plano-btn"
                      disabled={planoSelecionando === plano.slug}
                      onClick={() => handleEscolherPlano(plano)}
                    >
                      {planoSelecionando === plano.slug ? 'Aguarde…' : `Assinar ${plano.nome}`}
                    </button>
                  </div>
                ))}

                <div className="assinatura-pendente-page__plano-card">
                  <div className="assinatura-pendente-page__plano-nome">Enterprise</div>
                  <div className="assinatura-pendente-page__plano-valor assinatura-pendente-page__plano-valor--sob-consulta">
                    Sob consulta
                  </div>
                  <button
                    className="assinatura-pendente-page__plano-btn assinatura-pendente-page__plano-btn--outline"
                    onClick={handleFalarComEspecialista}
                  >
                    Falar com especialista
                  </button>
                </div>
              </div>
            </>
          )}

          {estado === 'pendente' && (
            <>
              <h1 className="assinatura-pendente-page__title">Pagamento pendente</h1>
              <p className="assinatura-pendente-page__description">
                Sua conta está criada, mas o pagamento ainda não foi confirmado. Conclua
                no Mercado Pago pra liberar o acesso — assim que confirmar, essa página
                libera sozinha.
              </p>

              {erro && <p className="assinatura-pendente-page__error">{erro}</p>}

              {checkoutUrl ? (
                <a
                  href={checkoutUrl}
                  className="assinatura-pendente-page__submit assinatura-pendente-page__submit--link"
                >
                  Concluir pagamento
                </a>
              ) : (
                <p className="assinatura-pendente-page__description">
                  Não encontramos o link do seu checkout. Fale com o suporte pra retomar o
                  pagamento.
                </p>
              )}

              <span className="assinatura-pendente-page__hint">
                Verificando automaticamente a cada poucos segundos…
              </span>
            </>
          )}

          {estado === 'erro' && (
            <>
              <h1 className="assinatura-pendente-page__title">Algo deu errado</h1>
              <p className="assinatura-pendente-page__description">
                Não conseguimos verificar sua assinatura agora. Tente recarregar a página.
              </p>
            </>
          )}

          <div className="assinatura-pendente-page__divider" />

          <button
            type="button"
            className="assinatura-pendente-page__logout"
            onClick={handleSair}
          >
            <HiOutlineLogout /> Sair
          </button>
        </div>

        {estado === 'ativa' && (
          <div className="assinatura-pendente-page__toast-overlay">
            <div className="assinatura-pendente-page__toast">
              <div className="assinatura-pendente-page__toast-inner">
                <HiCheckCircle className="assinatura-pendente-page__toast-icon" />
                <p className="assinatura-pendente-page__toast-text">
                  Pagamento confirmado! Redirecionando…
                </p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default AssinaturaPendente;
