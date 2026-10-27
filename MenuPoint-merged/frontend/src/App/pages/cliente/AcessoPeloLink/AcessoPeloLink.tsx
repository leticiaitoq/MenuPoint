import React from 'react'
import { useNavigate } from 'react-router-dom'
import { useClienteAuth } from '../../../shared/contexts/ClienteAuthContext'

/** Destino de quem tentou entrar direto, sem passar pelo link do restaurante. */
const AcessoPeloLink: React.FC = () => {
  const navigate = useNavigate()
  const { isAuthenticated, sair } = useClienteAuth()

  return (
    <div style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', padding: 24, textAlign: 'center' }}>
      <div style={{ maxWidth: 420 }}>
        <h1 style={{ marginBottom: 12 }}>Acesse pelo link do restaurante</h1>
        <p style={{ marginBottom: 20 }}>
          Para fazer pedidos, abra o link que o restaurante divulgou (Instagram, WhatsApp ou QR code).
          Ele leva você direto ao cardápio dele.
        </p>
        {isAuthenticated && (
          <button
            type="button"
            onClick={() => {
              sair()
              navigate('/login/cliente', { replace: true })
            }}
          >
            Sair da conta
          </button>
        )}
      </div>
    </div>
  )
}

export default AcessoPeloLink
