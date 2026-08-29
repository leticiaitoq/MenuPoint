import React, { createContext, useContext, useState } from 'react'

/**
 * A logo do restaurante precisa aparecer tanto na tela de Configurações
 * quanto no cantinho esquerdo da Navbar (em qualquer página). Por isso ela
 * vive num Context (e não num useState local do Config) — assim, assim que
 * o usuário troca a foto, a Navbar já reflete a mudança em qualquer rota,
 * e o valor persiste entre sessões via localStorage.
 *
 * TODO: quando o endpoint de estabelecimento.service.ts existir, trocar a
 * persistência em localStorage por uma chamada real à API e usar a URL
 * retornada pelo backend em vez do base64 salvo localmente.
 */
interface EstabelecimentoContextData {
  logoUrl: string | null
  setLogoUrl: (url: string | null) => void
}

const EstabelecimentoContext = createContext<EstabelecimentoContextData>({} as EstabelecimentoContextData)

export const EstabelecimentoProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [logoUrl, setLogoUrlState] = useState<string | null>(
    localStorage.getItem('@menupoint:logoUrl')
  )

  const setLogoUrl = (url: string | null) => {
    if (url) {
      localStorage.setItem('@menupoint:logoUrl', url)
    } else {
      localStorage.removeItem('@menupoint:logoUrl')
    }
    setLogoUrlState(url)
  }

  return (
    <EstabelecimentoContext.Provider value={{ logoUrl, setLogoUrl }}>
      {children}
    </EstabelecimentoContext.Provider>
  )
}

export const useEstabelecimento = () => useContext(EstabelecimentoContext)