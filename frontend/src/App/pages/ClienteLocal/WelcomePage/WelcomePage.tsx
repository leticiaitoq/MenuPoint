import React, { useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import CustomerLayout from '../../../shared/components/layout/Customerlayout';
import { useConvidado } from '../../../shared/contexts/Convidadocontext';
import { useClienteAuth, ROTA_APOS_LOGIN_CLIENTE } from '../../../shared/contexts/ClienteAuthContext';
import './WelcomePage.css';

/**
 * WelcomePage é a primeira tela que o cliente vê após escanear o QR code.
 *
 * Fluxo:
 * 1. Cliente digita o nome e pressiona Enter
 * 2. Modal abre confirmando o número da mesa (vindo do QR code)
 * 3. Cliente confirma → vai para o cardápio
 * 4. Cliente clica fora do modal → fecha e volta ao campo
 *
 * A mesa vem do link/QR Code (/mesa/:token → MesaQr), que grava mesa e restaurante
 * no contexto do convidado antes de redirecionar para cá.
 */
const WelcomePage: React.FC = () => {
  const navigate = useNavigate();
  const { isAuthenticated } = useClienteAuth();
  const {
    definirConvidado,
    mesa: tableNumber,
    mesaId,
    mesaToken,
    estabelecimentoId,
    restauranteNome,
    restauranteLogo,
  } = useConvidado();

  const [name, setName] = useState('');
  const [error, setError] = useState('');
  const [showModal, setShowModal] = useState(false);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      handleConfirmName();
    }
  };

  /**
   * Valida o nome e abre o modal de confirmação da mesa.
   * A navegação só acontece após o cliente confirmar no modal.
   */
  const handleConfirmName = () => {
    if (name.trim() === '') {
      setError('Por favor, digite seu nome para continuar.');
      return;
    }
    setError('');
    setShowModal(true);
  };

  /**
   * Chamado ao clicar em CONFIRMAR no modal.
   * Salva nome e mesa no contexto antes de navegar, para a navbar
   * (e as demais telas do cliente local) conseguirem usar.
   */
  const handleConfirmTable = () => {
    definirConvidado({
      nome: name.trim(),
      mesa: tableNumber,
      mesaId,
      mesaToken,
      estabelecimentoId,
      restauranteNome,
      restauranteLogo,
    });
    setShowModal(false);
    navigate('/menulocal');
  };

  /**
   * Quem já tem (ou quer criar) conta segue para o login/cadastro de cliente.
   * A mesa fica guardada no ConvidadoContext e, depois de entrar, o cliente cai na
   * dwelcome ainda vinculado a ela.
   */
  const irParaConta = (rota: '/login/cliente' | '/register/cliente') =>
    navigate(rota, { state: { from: ROTA_APOS_LOGIN_CLIENTE } });

  // Já está logado: não precisa digitar nome nem ver a tela de convidado
  if (isAuthenticated) return <Navigate to={ROTA_APOS_LOGIN_CLIENTE} replace />;

  /**
   * Fecha o modal ao clicar no overlay (fora do card).
   * O cliente volta ao campo de nome para corrigir se necessário.
   */
  const handleCloseModal = () => {
    setShowModal(false);
  };

  return (
    <CustomerLayout mode="welcome">
      {/* Sem mesa no contexto = o cliente não entrou pelo QR Code da mesa */}
      {!tableNumber ? (
        <div className="welcome-page">
          <p className="welcome-page__sem-mesa">
            Escaneie o QR Code da sua mesa para entrar.
          </p>
        </div>
      ) : (
      <div className="welcome-page">

        {/* Logo e nome do restaurante da mesa (vêm da API pelo QR Code) */}
        <div className="welcome-page__logo-wrapper">
          <img
            src={restauranteLogo || '/images/Menu/pizza.jpg'}
            alt={restauranteNome ? `Logo de ${restauranteNome}` : 'Logo do restaurante'}
            className="welcome-page__logo"
          />
        </div>
        {restauranteNome && (
          <h1 className="welcome-page__restaurante">{restauranteNome}</h1>
        )}

        {/* Campo de nome */}
        <div className="welcome-page__input-wrapper">
          <input
            type="text"
            placeholder="Digite seu nome..."
            className={`welcome-page__input ${error ? 'welcome-page__input--error' : ''}`}
            value={name}
            onChange={(e) => {
              setName(e.target.value);
              if (error) setError('');
            }}
            onKeyDown={handleKeyDown}
            autoFocus
          />
          {error && <span className="welcome-page__error">{error}</span>}
        
          <button
        type="button"
        className="welcome-page__enter-btn"
        onClick={handleConfirmName}
         disabled={name.trim() === ''}
          >
            Entrar
          </button>

          {/* Alternativa ao convidado: conta de cliente (continua na mesa depois de entrar) */}
          <div className="welcome-page__conta">
            <span className="welcome-page__conta-ou">ou</span>
            <div className="welcome-page__conta-botoes">
              <button
                type="button"
                className="welcome-page__conta-btn"
                onClick={() => irParaConta('/login/cliente')}
              >
                Entrar na conta
              </button>
              <button
                type="button"
                className="welcome-page__conta-btn"
                onClick={() => irParaConta('/register/cliente')}
              >
                Criar conta
              </button>
            </div>
          </div>

        </div>

      </div>
      )}

      {/* Modal de confirmação de mesa */}
      {showModal && (
        /**
         * Overlay escurece o fundo e detecta clique fora do card.
         * O stopPropagation no card impede que o clique dentro
         * do card feche o modal
         */
        <div className="welcome-page__overlay" onClick={handleCloseModal}>
          <div
            className="welcome-page__modal"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="welcome-page__modal-inner">

              <div className="welcome-page__modal-pill">
                Você está na mesa {tableNumber}
              </div>

              <p className="welcome-page__modal-text">
                Caso este não seja o número da sua mesa, escaneie o QR Code da mesa correta.
              </p>

              <button
                className="welcome-page__modal-button"
                onClick={handleConfirmTable}
              >
                CONFIRMAR
              </button>

            </div>
          </div>
        </div>
      )}

    </CustomerLayout>
  );
};

export default WelcomePage;