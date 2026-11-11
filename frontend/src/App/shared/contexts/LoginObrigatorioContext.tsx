import React, { createContext, useCallback, useContext, useMemo, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import ModalAlerta from '../components/ModalAlerta/ModalAlerta'
import { useClienteAuth } from './ClienteAuthContext'
import { MotivoLogin, RetomadaLogin, salvarPendenciaLogin } from '../utils/pendenciaLogin'

/**
 * Exige login do cliente DELIVERY na hora de pedir ou reservar.
 *
 *   if (!exigirLogin({ motivo: 'reserva', retorno: '/reserva' })) return   // abriu o modal
 *   ...segue com a ação (já está logado)
 *
 * Aceitou  → guarda a pendência (onde estava / o que ia fazer) e vai para /login/cliente.
 * Recusou  → o modal só fecha: nada acontece e a pessoa continua apenas olhando o sistema.
 *
 * Precisa ficar DENTRO do <BrowserRouter> (usa navegação).
 */
export interface OpcoesExigirLogin {
  motivo: MotivoLogin
  /** Tela para onde o login devolve o cliente (padrão: a tela atual) */
  retorno?: string
  /** Passo a retomar sozinho quando ele voltar */
  retomar?: RetomadaLogin
}

interface LoginObrigatorioData {
  /** true se já está logado; false se abriu o modal de aviso (e a ação deve parar) */
  exigirLogin: (opcoes: OpcoesExigirLogin) => boolean
}

const TEXTOS: Record<MotivoLogin, { titulo: string; mensagem: string; aviso: string }> = {
  pedido: {
    titulo: 'Faça login para enviar o pedido',
    mensagem:
      'Você precisa estar logado para fazer um pedido. Seu carrinho fica guardado e você continua de onde parou assim que entrar.',
    aviso: 'Entre na sua conta para enviar o pedido ao restaurante.',
  },
  reserva: {
    titulo: 'Faça login para reservar',
    mensagem:
      'Você precisa estar logado para fazer uma reserva. Depois de entrar, você volta direto para a reserva.',
    aviso: 'Entre na sua conta para fazer uma reserva.',
  },
  perfil: {
    titulo: 'Faça login para continuar',
    mensagem: 'Você precisa estar logado para acessar o seu perfil.',
    aviso: 'Entre na sua conta para acessar o seu perfil.',
  },
  historico: {
    titulo: 'Faça login para ver seus pedidos',
    mensagem: 'Você precisa estar logado para ver o seu histórico de pedidos.',
    aviso: 'Entre na sua conta para ver o seu histórico de pedidos.',
  },
}

const LoginObrigatorioContext = createContext<LoginObrigatorioData>({
  exigirLogin: () => false,
})

export const LoginObrigatorioProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const navigate = useNavigate()
  const location = useLocation()
  const { isAuthenticated } = useClienteAuth()
  const [pedido, setPedido] = useState<OpcoesExigirLogin | null>(null)

  const exigirLogin = useCallback(
    (opcoes: OpcoesExigirLogin) => {
      if (isAuthenticated) return true
      setPedido(opcoes)
      return false
    },
    [isAuthenticated]
  )

  const fechar = useCallback(() => setPedido(null), [])

  const aceitar = useCallback(() => {
    if (!pedido) return
    const retorno = pedido.retorno ?? location.pathname
    salvarPendenciaLogin({ motivo: pedido.motivo, retorno, retomar: pedido.retomar })
    setPedido(null)
    navigate('/login/cliente', { state: { from: retorno, aviso: TEXTOS[pedido.motivo].aviso } })
  }, [pedido, location.pathname, navigate])

  const value = useMemo(() => ({ exigirLogin }), [exigirLogin])
  const textos = pedido ? TEXTOS[pedido.motivo] : null

  return (
    <LoginObrigatorioContext.Provider value={value}>
      {children}
      <ModalAlerta
        aberto={Boolean(pedido)}
        variante="aviso"
        titulo={textos?.titulo ?? ''}
        mensagem={textos?.mensagem}
        textoConfirmar="Fazer login"
        textoCancelar="Agora não"
        onConfirmar={aceitar}
        onFechar={fechar}
      />
    </LoginObrigatorioContext.Provider>
  )
}

export const useLoginObrigatorio = () => useContext(LoginObrigatorioContext)
