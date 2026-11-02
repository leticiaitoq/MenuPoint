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

  // Cadastro feito mas pagamento ainda não confirmado: só as telas de plano e pagamento são
  // liberadas. Quem já escolheu o plano (no site ou em /planos) vai direto ao pagamento.
  if (usuario?.pagamento_pendente && !['/planos', '/pagamento'].includes(location.pathname)) {
    const jaEscolheuPlano = Boolean(sessionStorage.getItem('@menupoint:plano'))
    return <Navigate to={jaEscolheuPlano ? '/pagamento' : '/planos'} replace />
  }

  if (perfisPermitidos && usuario && !perfisPermitidos.includes(usuario.perfil)) {
    return <Navigate to="/restaurante/home" replace />
  }

  return children ? <>{children}</> : <Outlet />
}

export default RotaProtegida