import React from 'react'
import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { useClienteAuth } from '../contexts/ClienteAuthContext'

interface RotaProtegidaClienteProps {
  children?: React.ReactNode
}

/**
 * Telas do cliente cadastrado (dwelcome, menu, perfil...). Quem não está logado vai
 * para /login/cliente. O visitante do QR code (welcomepage) NÃO passa por aqui.
 *
 * Uso 1 (agrupando rotas):  <Route element={<RotaProtegidaCliente />}> ...rotas... </Route>
 * Uso 2 (uma tela):         <RotaProtegidaCliente><Tela /></RotaProtegidaCliente>
 */
export function RotaProtegidaCliente({ children }: RotaProtegidaClienteProps) {
  const { isAuthenticated } = useClienteAuth()
  const location = useLocation()

  if (!isAuthenticated) {
    return <Navigate to="/login/cliente" replace state={{ from: location.pathname }} />
  }

  return children ? <>{children}</> : <Outlet />
}

export default RotaProtegidaCliente
