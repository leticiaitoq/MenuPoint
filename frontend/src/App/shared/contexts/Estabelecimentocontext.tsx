import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import AuthService, { PerfilResponse } from '../../services/auth.service'
import type { Estabelecimento } from '../../services/estabelecimento.service'
import { useAuth } from './Authcontext'

/**
 * Perfil do restaurante logado (usuário + empresa + estabelecimento).
 *
 * Tudo vem do BANCO via GET /auth/me — nada é guardado no localStorage.
 * A Navbar e a tela de Perfil leem daqui, então o nome e a logo que aparecem
 * são sempre os que estão salvos de verdade.
 */
interface EstabelecimentoContextData {
  perfil: PerfilResponse | null
  carregando: boolean
  erro: string | null
  /** Contador que sobe a cada leitura completa do banco (a tela de Perfil usa para recarregar o formulário). */
  versao: number
  /** Lê tudo de novo do banco. */
  recarregar: () => Promise<PerfilResponse | null>
  /** Aplica no perfil campos que o servidor acabou de devolver (ex.: logo_url), sem reler tudo. */
  mesclarEstabelecimento: (parcial: Partial<Estabelecimento>) => void
  logoUrl: string | null
  nomeRestaurante: string | null
}

const EstabelecimentoContext = createContext<EstabelecimentoContextData>(
  {} as EstabelecimentoContextData
)

export const EstabelecimentoProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { token } = useAuth()
  const [perfil, setPerfil] = useState<PerfilResponse | null>(null)
  const [carregando, setCarregando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const [versao, setVersao] = useState(0)

  // Evita duas leituras simultâneas (ex.: o provider e a tela pedindo ao mesmo tempo)
  const emAndamento = useRef<Promise<PerfilResponse | null> | null>(null)

  const recarregar = useCallback((): Promise<PerfilResponse | null> => {
    if (emAndamento.current) return emAndamento.current

    setCarregando(true)
    setErro(null)

    const requisicao = AuthService.me()
      .then((dados) => {
        // O servidor devolve um token novo com os dados atuais (cura sessões antigas)
        if (dados.token) localStorage.setItem('@menupoint:token', dados.token)
        setPerfil(dados)
        setVersao((v) => v + 1)
        return dados
      })
      .catch((err: any) => {
        setErro(
          err?.response?.data?.message ??
            'Não foi possível carregar os dados do cadastro. Verifique a conexão com o servidor.'
        )
        return null
      })
      .finally(() => {
        emAndamento.current = null
        setCarregando(false)
      })

    emAndamento.current = requisicao
    return requisicao
  }, [])

  const mesclarEstabelecimento = useCallback((parcial: Partial<Estabelecimento>) => {
    setPerfil((atual) =>
      atual && atual.estabelecimento
        ? { ...atual, estabelecimento: { ...atual.estabelecimento, ...parcial } }
        : atual
    )
  }, [])

  // Entrou (ou trocou de conta) → busca do banco. Saiu → limpa.
  useEffect(() => {
    if (token) {
      void recarregar()
    } else {
      setPerfil(null)
      setErro(null)
    }
  }, [token, recarregar])

  const value = useMemo<EstabelecimentoContextData>(
    () => ({
      perfil,
      carregando,
      erro,
      versao,
      recarregar,
      mesclarEstabelecimento,
      logoUrl: perfil?.estabelecimento?.logo_url ?? null,
      nomeRestaurante: perfil?.estabelecimento?.nome ?? null,
    }),
    [perfil, carregando, erro, versao, recarregar, mesclarEstabelecimento]
  )

  return <EstabelecimentoContext.Provider value={value}>{children}</EstabelecimentoContext.Provider>
}

export const useEstabelecimento = () => useContext(EstabelecimentoContext)
