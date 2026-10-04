import React, { createContext, useCallback, useContext, useMemo, useState } from 'react'

/**
 * Dados do cliente local (quem escaneou o QR code e está na mesa).
 *
 * Vive num Context porque o nome é digitado na WelcomePage e precisa
 * aparecer em outras rotas (MenuLocal, PersoPedido, Histórico, Perfil...),
 * e o state local de uma página some quando ela desmonta.
 *
 * Também é gravado no sessionStorage: se o cliente apertar F5, o nome
 * continua lá. Ao fechar a aba os dados somem — o que é o certo aqui,
 * já que o próximo cliente da mesa não deve herdar o nome do anterior.
 */
const CHAVE = '@menupoint:convidado'

export interface Convidado {
  nome: string
  mesa: string
}

interface ConvidadoContextData extends Convidado {
  definirConvidado: (dados: Convidado) => void
  limparConvidado: () => void
}

const VAZIO: Convidado = { nome: '', mesa: '' }

const ConvidadoContext = createContext<ConvidadoContextData>({} as ConvidadoContextData)

function lerSalvo(): Convidado {
  try {
    const bruto = sessionStorage.getItem(CHAVE)
    return bruto ? { ...VAZIO, ...(JSON.parse(bruto) as Convidado) } : VAZIO
  } catch {
    return VAZIO
  }
}

export const ConvidadoProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [convidado, setConvidado] = useState<Convidado>(lerSalvo)

  const definirConvidado = useCallback((dados: Convidado) => {
    setConvidado(dados)
    try {
      sessionStorage.setItem(CHAVE, JSON.stringify(dados))
    } catch {
      /* storage indisponível: segue só em memória */
    }
  }, [])

  const limparConvidado = useCallback(() => {
    setConvidado(VAZIO)
    try {
      sessionStorage.removeItem(CHAVE)
    } catch {
      /* ignora */
    }
  }, [])

  const value = useMemo(
    () => ({ ...convidado, definirConvidado, limparConvidado }),
    [convidado, definirConvidado, limparConvidado]
  )

  return <ConvidadoContext.Provider value={value}>{children}</ConvidadoContext.Provider>
}

export const useConvidado = () => useContext(ConvidadoContext)
