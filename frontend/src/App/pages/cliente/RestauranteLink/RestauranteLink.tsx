import React, { useEffect, useRef } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useClienteAuth, ROTA_APOS_LOGIN_CLIENTE } from '../../../shared/contexts/ClienteAuthContext'
import { useRestauranteCliente } from '../../../shared/contexts/RestauranteClienteContext'
import { useCarrinho } from '../../../shared/contexts/CarrinhoContext'
import { useConvidado } from '../../../shared/contexts/Convidadocontext'
import { useSistemaCliente } from '../../../shared/contexts/SistemaClienteContext'

/**
 * Entrada pelo link do restaurante: /r/:slug — a ÚNICA porta do sistema DELIVERY.
 *  0. marca esta aba como "delivery" e descarta qualquer mesa (QR Code) que estivesse guardada:
 *     o cliente de fora do restaurante nunca carrega a sessão de quem está na mesa
 *  1. valida o slug na API e guarda o restaurante escolhido
 *  2. vai para /dwelcome, logado ou não: o cliente navega sem conta e só entra (modal de aviso)
 *     quando for fazer um pedido ou uma reserva
 *
 * Restaurante DIFERENTE do último acessado: a sessão do cliente é encerrada (o login vale só para o
 * restaurante em que foi feito) e ele segue como visitante. Abrir o link do MESMO restaurante de novo
 * mantém o cliente logado.
 */
const RestauranteLink: React.FC = () => {
  const { slug: slugDaUrl = '' } = useParams<{ slug: string }>()
  const navigate = useNavigate()
  const { isAuthenticated, sair } = useClienteAuth()
  const { slug, restaurante, erro, selecionar } = useRestauranteCliente()
  const { limparCarrinho } = useCarrinho()
  const { limparConvidado } = useConvidado()
  const { entrarNoDelivery } = useSistemaCliente()

  const slugNormalizado = slugDaUrl.trim().toLowerCase()
  const slugAnterior = useRef(slug)

  // Refs para ler o valor mais novo sem colocar no array de dependências do efeito:
  // senão o sair() (que muda isAuthenticated) refaria o selecionar() e a busca na API.
  const sessao = useRef({ isAuthenticated, sair })
  sessao.current = { isAuthenticated, sair }

  useEffect(() => {
    if (!slugNormalizado) return

    // Delivery não herda a mesa do sistema local
    entrarNoDelivery()
    limparConvidado()

    const trocouDeRestaurante = Boolean(slugAnterior.current) && slugAnterior.current !== slugNormalizado
    if (trocouDeRestaurante) {
      // O carrinho do restaurante anterior não pode ir junto...
      limparCarrinho()
      // ...e o cliente precisa entrar de novo neste restaurante
      if (sessao.current.isAuthenticated) sessao.current.sair()
    }

    slugAnterior.current = slugNormalizado
    selecionar(slugNormalizado)
  }, [slugNormalizado, selecionar, limparCarrinho, limparConvidado, entrarNoDelivery])

  const pronto = restaurante?.slug === slugNormalizado && restaurante.aceita_entrega

  useEffect(() => {
    if (!pronto) return
    navigate(ROTA_APOS_LOGIN_CLIENTE, { replace: true })
  }, [pronto, navigate])

  let mensagem = 'Abrindo o restaurante...'
  if (erro) mensagem = erro
  else if (restaurante?.slug === slugNormalizado && !restaurante.aceita_entrega)
    mensagem = `${restaurante.nome} não está aceitando pedidos de delivery no momento.`

  return (
    <div style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', padding: 24, textAlign: 'center' }}>
      <p>{mensagem}</p>
    </div>
  )
}

export default RestauranteLink
