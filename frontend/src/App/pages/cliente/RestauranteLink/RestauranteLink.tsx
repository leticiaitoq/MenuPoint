import React, { useEffect, useRef } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useClienteAuth, ROTA_APOS_LOGIN_CLIENTE } from '../../../shared/contexts/ClienteAuthContext'
import { useRestauranteCliente } from '../../../shared/contexts/RestauranteClienteContext'
import { useCarrinho } from '../../../shared/contexts/CarrinhoContext'

/**
 * Entrada pelo link do restaurante: /r/:slug
 *  1. valida o slug na API e guarda o restaurante escolhido
 *  2. logado → /dwelcome | não logado → /login/cliente (e volta para /dwelcome)
 */
const RestauranteLink: React.FC = () => {
  const { slug: slugDaUrl = '' } = useParams<{ slug: string }>()
  const navigate = useNavigate()
  const { isAuthenticated } = useClienteAuth()
  const { slug, restaurante, erro, selecionar } = useRestauranteCliente()
  const { limparCarrinho } = useCarrinho()

  const slugNormalizado = slugDaUrl.trim().toLowerCase()
  const slugAnterior = useRef(slug)

  useEffect(() => {
    if (!slugNormalizado) return
    // Trocou de restaurante: o carrinho do anterior não pode ir junto
    if (slugAnterior.current && slugAnterior.current !== slugNormalizado) limparCarrinho()
    slugAnterior.current = slugNormalizado
    selecionar(slugNormalizado)
  }, [slugNormalizado, selecionar, limparCarrinho])

  const pronto = restaurante?.slug === slugNormalizado && restaurante.aceita_entrega

  useEffect(() => {
    if (!pronto) return
    navigate(isAuthenticated ? ROTA_APOS_LOGIN_CLIENTE : '/login/cliente', {
      replace: true,
      state: { from: ROTA_APOS_LOGIN_CLIENTE },
    })
  }, [pronto, isAuthenticated, navigate])

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
