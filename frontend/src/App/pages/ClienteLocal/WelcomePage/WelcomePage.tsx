import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import CustomerLayout from '../../../shared/components/layout/Customerlayout';
import { useConvidado } from '../../../shared/contexts/Convidadocontext';
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