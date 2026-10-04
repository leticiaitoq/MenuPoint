import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import RestaurantePublicoService, { RestaurantePublico } from '../../services/restaurantePublico.service'
import { mensagemDeErro } from '../../services/cliente.service'

/**
 * Restaurante que o cliente (delivery) escolheu, normalmente pelo link /r/:slug.
 * Só o slug fica no localStorage; os dados vêm sempre da API.
 * Assim o restaurante sobrevive ao login, ao cadastro + confirmação de e-mail e ao F5.
 */
export const CHAVE_RESTAURANTE_CLIENTE = '@menupoint:cliente_restaurante_slug'

interface RestauranteClienteContextData {
  slug: string | null
  restaurante: RestaurantePublico | null
  carregando: boolean
  erro: string | null
  /** Define o restaurante (e recarrega os dados dele) */
  selecionar: (slug: string) => void
  limpar: () => void
}

const RestauranteClienteContext = createContext<RestauranteClienteContextData>(
  {} as RestauranteClienteContextData
)

export const RestauranteClienteProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [slug, setSlug] = useState<string | null>(() =>
    localStorage.getItem(CHAVE_RESTAURANTE_CLIENTE)
  )
  const [restaurante, setRestaurante] = useState<RestaurantePublico | null>(null)
  const [carregando, setCarregando] = useState<boolean>(Boolean(slug))
  const [erro, setErro] = useState<string | null>(null)
  const [tentativa, setTentativa] = useState(0)

  const selecionar = useCallback((novo: string) => {
    const limpo = novo.trim().toLowerCase()
    if (!limpo) return
    setSlug((atual) => {
      if (atual !== limpo) setRestaurante(null)
      return limpo
    })
    setErro(null)
    setCarregando(true)
    localStorage.setItem(CHAVE_RESTAURANTE_CLIENTE, limpo)
    setTentativa((t) => t + 1)
  }, [])

  const limpar = useCallback(() => {
    localStorage.removeItem(CHAVE_RESTAURANTE_CLIENTE)
    setSlug(null)
    setRestaurante(null)
    setErro(null)
    setCarregando(false)
  }, [])

  useEffect(() => {
    if (!slug) return
    let cancelado = false

    setCarregando(true)
    RestaurantePublicoService.buscarPorSlug(slug)
      .then((dados) => {
        if (cancelado) return
        setRestaurante(dados)
        setErro(null)
      })
      .catch((err) => {
        if (cancelado) return
        setRestaurante(null)
        if (err?.response?.status === 404) {
          // Link de restaurante inexistente: esquece o slug para não liberar o acesso
          localStorage.removeItem(CHAVE_RESTAURANTE_CLIENTE)
          setSlug(null)
          setErro('Restaurante não encontrado. Confira o link.')
          return
        }
        setErro(mensagemDeErro(err, 'Não foi possível carregar o restaurante.'))
      })
      .finally(() => {
        if (!cancelado) setCarregando(false)
      })

    return () => {
      cancelado = true
    }
  }, [slug, tentativa])

  const value = useMemo(
    () => ({ slug, restaurante, carregando, erro, selecionar, limpar }),
    [slug, restaurante, carregando, erro, selecionar, limpar]
  )

  return (
    <RestauranteClienteContext.Provider value={value}>{children}</RestauranteClienteContext.Provider>
  )
}

export const useRestauranteCliente = () => useContext(RestauranteClienteContext)
