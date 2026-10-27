import React, { createContext, useContext, useState } from 'react'
import { ItemCarrinho } from '../components/Carrinho/Carrinho'

/**
 * Carrinho vive num Context (e não num useState local do MenuLocal) porque
 * o cliente navega para o PersoPedido (outra rota) pra customizar o
 * produto antes de adicionar — se o carrinho ficasse no state do MenuLocal,
 * ele seria perdido toda vez que a tela desmonta pra essa navegação.
 */
interface CarrinhoContextData {
  itens: ItemCarrinho[]
  adicionarItem: (item: ItemCarrinho) => void
  removerItem: (id: string) => void
  limparCarrinho: () => void
}

const CarrinhoContext = createContext<CarrinhoContextData>({} as CarrinhoContextData)

export const CarrinhoProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [itens, setItens] = useState<ItemCarrinho[]>([])

  const adicionarItem = (item: ItemCarrinho) => {
    setItens((prev) => [...prev, item])
  }

  const removerItem = (id: string) => {
    setItens((prev) => prev.filter((i) => i.id !== id))
  }

  const limparCarrinho = () => setItens([])

  return (
    <CarrinhoContext.Provider value={{ itens, adicionarItem, removerItem, limparCarrinho }}>
      {children}
    </CarrinhoContext.Provider>
  )
}

export const useCarrinho = () => useContext(CarrinhoContext)