import React, { createContext, useCallback, useContext, useMemo, useState } from 'react'

/**
 * Os dois "sistemas" do cliente compartilham a MESMA conta (mesmo login no banco), mas são
 * produtos diferentes e nunca se misturam:
 *
 *  - 'local'    → está DENTRO do restaurante. Só entra pelo QR Code / link da mesa (/mesa/:token)
 *                 e só faz pedido de mesa. Mesmo logado, NUNCA é levado às telas de delivery.
 *  - 'delivery' → está FORA do restaurante. Só entra pelo link do perfil do restaurante (/r/:slug)
 *                 e só faz pedido de entrega/retirada.
 *
 * Quem decide em qual sistema a pessoa está é a ENTRADA (MesaQr ou RestauranteLink), não o login:
 * entrar na conta não troca de sistema, só guarda quem é a pessoa.
 *
 * Fica no sessionStorage (uma aba = um sistema): o token da conta fica no localStorage e é
 * compartilhado entre abas, então não pode ser ele a dizer onde a pessoa está.
 */
export type SistemaCliente = 'local' | 'delivery'

const CHAVE = '@menupoint:sistema'

/** Primeira tela de cada sistema (onde o login devolve a pessoa) */
export const ROTA_INICIAL_SISTEMA: Record<SistemaCliente, string> = {
  local: '/menulocal',
  delivery: '/dwelcome',
}

/** Quem chegou sem passar por nenhuma entrada (nem QR Code, nem link do restaurante) */
export const ROTA_SEM_SISTEMA = '/acesso-pelo-link'

// Telas de cada sistema. /personaliza é compartilhada (o modo vem do sistema ativo).
const PREFIXOS_LOCAL = ['/welcomepage', '/menulocal', '/historicolocal', '/perfillocal', '/mesa/']
const PREFIXOS_DELIVERY = ['/dwelcome', '/menu', '/reserva', '/endereço', '/retirada', '/historico', '/perfil']

const normalizar = (caminho: string) => {
  let c = caminho
  try {
    c = decodeURIComponent(caminho)
  } catch {
    /* mantém como veio */
  }
  return c.toLowerCase()
}

const casa = (caminho: string, prefixo: string) => {
  const c = normalizar(caminho).split('?')[0].split('#')[0]
  // "/menu" não pode casar com "/menulocal": compara o segmento inteiro
  return prefixo.endsWith('/') ? c.startsWith(prefixo) : c === prefixo || c.startsWith(`${prefixo}/`)
}

/** true se a tela pertence ao OUTRO sistema (o que não pode ser aberto a partir deste) */
const ehDoOutroSistema = (sistema: SistemaCliente, caminho: string) =>
  (sistema === 'local' ? PREFIXOS_DELIVERY : PREFIXOS_LOCAL).some((p) => casa(caminho, p))

/**
 * Destino depois do login/cadastro. Aceita a tela de onde a pessoa veio (`from`) só se ela for
 * do mesmo sistema; senão volta para a primeira tela do sistema em que ela está.
 * Sem sistema (entrou direto pela URL), vai para a tela que explica como acessar.
 */
export function destinoDoSistema(sistema: SistemaCliente | null, desejado?: string | null): string {
  if (!sistema) return ROTA_SEM_SISTEMA
  if (desejado && !ehDoOutroSistema(sistema, desejado) && desejado !== '/login/cliente') return desejado
  return ROTA_INICIAL_SISTEMA[sistema]
}

interface SistemaClienteContextData {
  sistema: SistemaCliente | null
  /** Chamado SÓ por /mesa/:token */
  entrarNoLocal: () => void
  /** Chamado SÓ por /r/:slug */
  entrarNoDelivery: () => void
}

const SistemaClienteContext = createContext<SistemaClienteContextData>({} as SistemaClienteContextData)

function lerSalvo(): SistemaCliente | null {
  try {
    const v = sessionStorage.getItem(CHAVE)
    return v === 'local' || v === 'delivery' ? v : null
  } catch {
    return null
  }
}

export const SistemaClienteProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [sistema, setSistema] = useState<SistemaCliente | null>(lerSalvo)

  const definir = useCallback((novo: SistemaCliente) => {
    setSistema(novo)
    try {
      sessionStorage.setItem(CHAVE, novo)
    } catch {
      /* storage indisponível: segue só em memória */
    }
  }, [])

  const entrarNoLocal = useCallback(() => definir('local'), [definir])
  const entrarNoDelivery = useCallback(() => definir('delivery'), [definir])

  const value = useMemo(
    () => ({ sistema, entrarNoLocal, entrarNoDelivery }),
    [sistema, entrarNoLocal, entrarNoDelivery]
  )

  return <SistemaClienteContext.Provider value={value}>{children}</SistemaClienteContext.Provider>
}

export const useSistemaCliente = () => useContext(SistemaClienteContext)
