import React, { createContext, useContext, useEffect, useState } from 'react'
import { ItemCarrinho } from '../components/Carrinho/Carrinho'
import { CHAVE_RESTAURANTE_CLIENTE } from './RestauranteClienteContext'

/** Onde o carrinho fica guardado para sobreviver ao recarregar a página */
const CHAVE_CARRINHO = '@menupoint:carrinho'
/** Carrinho esquecido por mais tempo que isso é descartado */
const VALIDADE_CARRINHO_MS = 12 * 60 * 60 * 1000

const slugAtual = (): string => {
  try { return localStorage.getItem(CHAVE_RESTAURANTE_CLIENTE) ?? '' } catch { return '' }
}

const lerCarrinhoSalvo = (): ItemCarrinho[] => {
  try {
    const bruto = localStorage.getItem(CHAVE_CARRINHO)
    if (!bruto) return []
    const salvo = JSON.parse(bruto) as { slug?: string; salvoEm?: number; itens?: ItemCarrinho[] }
    const vencido = !salvo.salvoEm || Date.now() - salvo.salvoEm > VALIDADE_CARRINHO_MS
    const outroRestaurante = (salvo.slug ?? '') !== slugAtual()
    if (vencido || outroRestaurante || !Array.isArray(salvo.itens)) {
      localStorage.removeItem(CHAVE_CARRINHO)
      return []
    }
    return salvo.itens
  } catch {
    return []
  }
}

interface CarrinhoContextData {
  itens: ItemCarrinho[]
  adicionarItem: (item: ItemCarrinho) => void
  removerItem: (id: string) => void
  /** Muda a quantidade de uma linha do carrinho */
  alterarQuantidade: (id: string, quantidade: number) => void
  /** Troca os dados de uma linha; id e quantidade ficam como estão */
  atualizarItem: (id: string, dados: Partial<Omit<ItemCarrinho, 'id' | 'quantidade'>>) => void
  limparCarrinho: () => void
}

const CarrinhoContext = createContext<CarrinhoContextData>({} as CarrinhoContextData)

export const CarrinhoProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [itens, setItens] = useState<ItemCarrinho[]>(lerCarrinhoSalvo)

  // Guarda a cada mudança
  useEffect(() => {
    try {
      if (itens.length === 0) localStorage.removeItem(CHAVE_CARRINHO)
      else localStorage.setItem(CHAVE_CARRINHO, JSON.stringify({ slug: slugAtual(), salvoEm: Date.now(), itens }))
    } catch {
    }
  }, [itens])

  const adicionarItem = (item: ItemCarrinho) => {
    setItens((prev) => [...prev, item])
  }

  const removerItem = (id: string) => {
    setItens((prev) => prev.filter((i) => i.id !== id))
  }

  const alterarQuantidade = (id: string, quantidade: number) => {
    setItens((prev) =>
      quantidade <= 0
        ? prev.filter((i) => i.id !== id)
        : prev.map((i) => (i.id === id ? { ...i, quantidade } : i))
    )
  }

  const atualizarItem = (id: string, dados: Partial<Omit<ItemCarrinho, 'id' | 'quantidade'>>) => {
    setItens((prev) => prev.map((i) => (i.id === id ? { ...i, ...dados } : i)))
  }

  const limparCarrinho = () => setItens([])

  return (
    <CarrinhoContext.Provider value={{ itens, adicionarItem, removerItem, alterarQuantidade, atualizarItem, limparCarrinho }}>
      {children}
    </CarrinhoContext.Provider>
  )
}

export const useCarrinho = () => useContext(CarrinhoContext)