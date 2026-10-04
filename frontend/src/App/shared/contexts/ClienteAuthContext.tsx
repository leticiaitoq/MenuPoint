import React, { createContext, useCallback, useContext, useMemo, useState } from 'react'
import { CHAVES_CLIENTE } from '../../services/apiCliente'
import ClienteService, { Cliente, SessaoCliente } from '../../services/cliente.service'

// Para onde o cliente cadastrado vai logo depois de entrar (a "dwelcome")
export const ROTA_APOS_LOGIN_CLIENTE = '/dwelcome'

interface ClienteAuthContextData {
  token: string | null
  cliente: Cliente | null
  isAuthenticated: boolean
  /** Guarda a sessão (login ou confirmação de e-mail). Único lugar que grava no localStorage. */
  entrar: (sessao: SessaoCliente) => void
  sair: () => void
  /** Atualiza os dados do cliente guardados (ex.: depois de editar o perfil). */
  atualizarCliente: (dados: Cliente) => void
}

const ClienteAuthContext = createContext<ClienteAuthContextData>({} as ClienteAuthContextData)

function lerClienteSalvo(): Cliente | null {
  try {
    const bruto = localStorage.getItem(CHAVES_CLIENTE.cliente)
    return bruto ? (JSON.parse(bruto) as Cliente) : null
  } catch {
    return null
  }
}

export const ClienteAuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [token, setToken] = useState<string | null>(() =>
    localStorage.getItem(CHAVES_CLIENTE.token)
  )
  const [cliente, setCliente] = useState<Cliente | null>(lerClienteSalvo)

  const entrar = useCallback((sessao: SessaoCliente) => {
    localStorage.setItem(CHAVES_CLIENTE.token, sessao.token)
    localStorage.setItem(CHAVES_CLIENTE.refresh, sessao.refresh_token)
    localStorage.setItem(CHAVES_CLIENTE.cliente, JSON.stringify(sessao.cliente))
    setToken(sessao.token)
    setCliente(sessao.cliente)
  }, [])

  const sair = useCallback(() => {
    const refresh = localStorage.getItem(CHAVES_CLIENTE.refresh)

    // Avisa o servidor, mas não depende dele para deslogar
    if (refresh) ClienteService.logout(refresh).catch(() => undefined)

    localStorage.removeItem(CHAVES_CLIENTE.token)
    localStorage.removeItem(CHAVES_CLIENTE.refresh)
    localStorage.removeItem(CHAVES_CLIENTE.cliente)
    setToken(null)
    setCliente(null)
  }, [])

  const atualizarCliente = useCallback((dados: Cliente) => {
    localStorage.setItem(CHAVES_CLIENTE.cliente, JSON.stringify(dados))
    setCliente(dados)
  }, [])

  const value = useMemo(
    () => ({ token, cliente, isAuthenticated: Boolean(token), entrar, sair, atualizarCliente }),
    [token, cliente, entrar, sair, atualizarCliente]
  )

  return <ClienteAuthContext.Provider value={value}>{children}</ClienteAuthContext.Provider>
}

export const useClienteAuth = () => useContext(ClienteAuthContext)
