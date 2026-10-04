import { Navigate, Outlet } from 'react-router-dom'
import { useRestauranteCliente } from '../contexts/RestauranteClienteContext'

/**
 * Barra a entrada direta do cliente (ex.: digitar /dwelcome na barra de endereço).
 * Só passa quem já escolheu um restaurante pelo link /r/:slug; os demais vão para
 * /acesso-pelo-link. Deve ficar DENTRO de <RotaProtegidaCliente />.
 */
export function RotaComRestaurante() {
  const { slug } = useRestauranteCliente()

  if (!slug) return <Navigate to="/acesso-pelo-link" replace />

  return <Outlet />
}

export default RotaComRestaurante
