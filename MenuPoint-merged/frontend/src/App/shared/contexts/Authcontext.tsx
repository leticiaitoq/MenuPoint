import React, { createContext, useCallback, useContext, useMemo, useState } from 'react'
import type { Usuario } from '../../services/auth.service'

// Para onde o restaurante vai logo depois de entrar.
// Enquanto você confere o cadastro, é o perfil. Quando estiver validado,
// troque por '/restaurante/home'.
export const ROTA_APOS_LOGIN = '/restaurante/config'

const CHAVES = {
  token: '@menupoint:token',
  refresh: '@menupoint:refresh_token',
  usuario: '@menupoint:usuario',
}

export interface Sessao {
  token: string
  refresh_token?: string
  usuario: Usuario
}

interface AuthContextData {
  token: string | null
  usuario: Usuario | null
  isAuthenticated: boolean
  /** Guarda a sessão (login ou cadastro). É o único lugar que grava no localStorage. */
  entrar: (sessao: Sessao) => void
  sair: () => void
}

const AuthContext = createContext<AuthContextData>({} as AuthContextData)

function lerUsuarioSalvo(): Usuario | null {
  try {
    const bruto = localStorage.getItem(CHAVES.usuario)
    return bruto ? (JSON.parse(bruto) as Usuario) : null
  } catch {
    return null
  }
}

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [token, setToken] = useState<string | null>(() => localStorage.getItem(CHAVES.token))
  const [usuario, setUsuario] = useState<Usuario | null>(lerUsuarioSalvo)

  const entrar = useCallback((sessao: Sessao) => {
    localStorage.setItem(CHAVES.token, sessao.token)
    if (sessao.refresh_token) localStorage.setItem(CHAVES.refresh, sessao.refresh_token)
    localStorage.setItem(CHAVES.usuario, JSON.stringify(sessao.usuario))
    setToken(sessao.token)
    setUsuario(sessao.usuario)
  }, [])

  const sair = useCallback(() => {
    localStorage.removeItem(CHAVES.token)
    localStorage.removeItem(CHAVES.refresh)
    localStorage.removeItem(CHAVES.usuario)
    setToken(null)
    setUsuario(null)
  }, [])

  const value = useMemo(
    () => ({ token, usuario, isAuthenticated: Boolean(token), entrar, sair }),
    [token, usuario, entrar, sair]
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export const useAuth = () => useContext(AuthContext)
