import { useEffect, useRef } from 'react'
import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { useClienteAuth } from '../contexts/ClienteAuthContext'
import { useLoginObrigatorio } from '../contexts/LoginObrigatorioContext'
import { MotivoLogin } from '../utils/pendenciaLogin'

interface RotaExigeLoginProps {
  motivo: MotivoLogin
  /** Para onde o visitante volta (sem login) enquanto o modal de aviso é mostrado */
  fallback: string
}

/**
 * Telas do delivery que só abrem logado (reserva, perfil, endereço e retirada do pedido).
 * Quem chega sem conta (link direto, F5, atalho) NÃO vai direto para o login: volta para `fallback`
 * e vê o modal "faça login para continuar". Se aceitar, o login o traz de volta a esta mesma tela.
 */
export function RotaExigeLogin({ motivo, fallback }: RotaExigeLoginProps) {
  const { isAuthenticated } = useClienteAuth()
  const { exigirLogin } = useLoginObrigatorio()
  const { pathname } = useLocation()

  // Só avisa quem CHEGOU sem conta. Quem estava logado e acabou de sair (ex.: botão "Sair" do perfil)
  // é só devolvido para `fallback`, sem modal.
  const chegouSemConta = useRef(!isAuthenticated)

  useEffect(() => {
    if (!isAuthenticated && chegouSemConta.current) exigirLogin({ motivo, retorno: pathname })
  }, [isAuthenticated, exigirLogin, motivo, pathname])

  if (!isAuthenticated) return <Navigate to={fallback} replace />
  return <Outlet />
}

export default RotaExigeLogin
