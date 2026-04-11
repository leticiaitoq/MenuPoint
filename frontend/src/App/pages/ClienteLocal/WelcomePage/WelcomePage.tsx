import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import CustomerLayout from '../../../shared/components/layout/Customerlayout';
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
 * Futuramente o número da mesa virá via parâmetro da URL:
 * ex: /welcome?restaurante=123&mesa=5
 */
const WelcomePage: React.FC = () => {
  const navigate = useNavigate();

  const [name, setName] = useState('');
  const [error, setError] = useState('');
  const [showModal, setShowModal] = useState(false);

  /**
   * Número da mesa — futuramente virá da URL via useSearchParams.
   * Por hora fixo para desenvolvimento.
   */
  const tableNumber = '05';

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
   * Futuramente: salvar nome e mesa no CustomerContext antes de navegar.
   */
  const handleConfirmTable = () => {
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
      <div className="welcome-page">

        {/* Logo do restaurante — futuramente virá da API */}
        <div className="welcome-page__logo-wrapper">
          <img
            src="/images/Menu/pizza.jpg"
            alt="Logo do restaurante"
            className="welcome-page__logo"
          />
        </div>

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
        </div>

      </div>

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
                Caso este não seja o número da sua mesa, altere antes de confirmar.
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