import { Navigate, Outlet } from 'react-router-dom'
import { useRestauranteCliente } from '../contexts/RestauranteClienteContext'
import {
  ROTA_INICIAL_SISTEMA,
  ROTA_SEM_SISTEMA,
  useSistemaCliente,
} from '../contexts/SistemaClienteContext'

/**
 * Porteiro da área de DELIVERY (dwelcome, cardápio, reservas, endereço, retirada, histórico, perfil).
 *
 * Só passa quem entrou pelo link do restaurante (/r/:slug):
 *  - veio pelo QR Code da mesa (sistema "local") → volta para o cardápio da mesa. NUNCA entra no delivery;
 *  - não passou por nenhuma entrada (digitou a URL) → /acesso-pelo-link.
 *
 * Fica POR FORA de <RotaProtegidaCliente />: o sistema é conferido antes do login, assim quem está na
 * mesa nem chega a ver a tela de login do delivery.
 */
export function RotaComRestaurante() {
  const { slug } = useRestauranteCliente()
  const { sistema } = useSistemaCliente()

  if (sistema === 'local') return <Navigate to={ROTA_INICIAL_SISTEMA.local} replace />
  if (sistema !== 'delivery' || !slug) return <Navigate to={ROTA_SEM_SISTEMA} replace />

  return <Outlet />
}

export default RotaComRestaurante
