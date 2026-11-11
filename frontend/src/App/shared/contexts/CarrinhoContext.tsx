import React, { createContext, useContext, useEffect, useRef, useState } from 'react'
import { ItemCarrinho } from '../components/Carrinho/Carrinho'
import { useSistemaCliente } from './SistemaClienteContext'
import { useRestauranteCliente } from './RestauranteClienteContext'

/**
 * Carrinho do DELIVERY fica guardado no sessionStorage (por aba e por restaurante). Assim o visitante
 * sem conta não perde o que escolheu ao ir para o login/cadastro (nem se der F5) e continua de onde parou.
 * O carrinho da mesa (local) continua só em memória.
 */
const CHAVE_CARRINHO_DELIVERY = '@menupoint:carrinho_delivery'

function lerCarrinhoDelivery(slug: string | null): ItemCarrinho[] {
  try {
    const bruto = sessionStorage.getItem(CHAVE_CARRINHO_DELIVERY)
    if (!bruto) return []
    const salvo = JSON.parse(bruto) as { slug?: string; itens?: ItemCarrinho[] }
    return slug && salvo.slug === slug && Array.isArray(salvo.itens) ? salvo.itens : []
  } catch {
    return []
  }
}

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
  const { sistema } = useSistemaCliente()
  const { slug } = useRestauranteCliente()
  const [itens, setItens] = useState<ItemCarrinho[]>(() =>
    sistema === 'delivery' ? lerCarrinhoDelivery(slug) : []
  )

  // Delivery: guarda o carrinho a cada mudança. Fora do delivery não guarda nada.
  useEffect(() => {
    try {
      if (sistema === 'delivery' && slug) {
        sessionStorage.setItem(CHAVE_CARRINHO_DELIVERY, JSON.stringify({ slug, itens }))
      } else {
        sessionStorage.removeItem(CHAVE_CARRINHO_DELIVERY)
      }
    } catch {
      /* storage indisponível: segue só em memória */
    }
  }, [itens, sistema, slug])

  // O carrinho da mesa (local) e o do delivery são de sistemas diferentes: não podem se misturar.
  // Entrou em outro sistema nesta aba → começa vazio.
  const sistemaAnterior = useRef(sistema)
  useEffect(() => {
    if (sistemaAnterior.current !== sistema) {
      sistemaAnterior.current = sistema
      setItens([])
    }
  }, [sistema])

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