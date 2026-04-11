import React from 'react'
import { Navigate } from 'react-router-dom'
import { useAuth } from '../contexts/Authcontext'

interface RotaProtegidaProps {
  children: React.ReactNode
  perfisPermitidos?: Array<"ADMIN" | "ATENDENTE" | "CAIXA">
}

export function RotaProtegida({
  children,
  perfisPermitidos,
}: RotaProtegidaProps) {
  const { isAuthenticated, user } = useAuth()

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />
  }

  if (perfisPermitidos && user && !perfisPermitidos.includes(user.role)) {
    return <Navigate to="/sem-permissao" replace />
  }

  return <>{children}</>
}