import React from 'react'
import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { useAuth } from '../contexts/Authcontext'

interface RotaProtegidaProps {
  children?: React.ReactNode
  perfisPermitidos?: Array<'ADMIN' | 'ATENDENTE' | 'CAIXA'>
}

/**
 * Uso 1 (agrupando rotas):  <Route element={<RotaProtegida />}> ...rotas... </Route>
 * Uso 2 (uma tela):         <RotaProtegida><Tela /></RotaProtegida>
 */
export function RotaProtegida({ children, perfisPermitidos }: RotaProtegidaProps) {
  const { isAuthenticated, usuario } = useAuth()
  const location = useLocation()

  if (!isAuthenticated) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />
  }

  // Cadastro feito mas pagamento ainda não confirmado: só a tela de pagamento é liberada
  if (usuario?.pagamento_pendente && location.pathname !== '/pagamento') {
    return <Navigate to="/pagamento" replace />
  }

  if (perfisPermitidos && usuario && !perfisPermitidos.includes(usuario.perfil)) {
    return <Navigate to="/restaurante/home" replace />
  }

  return children ? <>{children}</> : <Outlet />
}

export default RotaProtegida
