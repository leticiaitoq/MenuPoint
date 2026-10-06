import React, { useEffect, useRef } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useClienteAuth, ROTA_APOS_LOGIN_CLIENTE } from '../../../shared/contexts/ClienteAuthContext'
import { useRestauranteCliente } from '../../../shared/contexts/RestauranteClienteContext'
import { useCarrinho } from '../../../shared/contexts/CarrinhoContext'

/**
 * Entrada pelo link do restaurante: /r/:slug
 *  1. valida o slug na API e guarda o restaurante escolhido
 *  2. logado → /dwelcome | não logado → /login/cliente (e volta para /dwelcome)
 *
 * Restaurante DIFERENTE do último acessado: a sessão do cliente é encerrada e ele precisa
 * entrar de novo (a conta é a mesma, mas o login vale só para o restaurante em que foi feito).
 * Abrir o link do MESMO restaurante de novo mantém o cliente logado.
 */
const RestauranteLink: React.FC = () => {
  const { slug: slugDaUrl = '' } = useParams<{ slug: string }>()
  const navigate = useNavigate()
  const { isAuthenticated, sair } = useClienteAuth()
  const { slug, restaurante, erro, selecionar } = useRestauranteCliente()
  const { limparCarrinho } = useCarrinho()

  const slugNormalizado = slugDaUrl.trim().toLowerCase()
  const slugAnterior = useRef(slug)
  // Marca que a sessão foi encerrada por causa da troca de restaurante (para avisar no login)
  const encerrouPorTroca = useRef(false)

  // Refs para ler o valor mais novo sem colocar no array de dependências do efeito:
  // senão o sair() (que muda isAuthenticated) refaria o selecionar() e a busca na API.
  const sessao = useRef({ isAuthenticated, sair })
  sessao.current = { isAuthenticated, sair }

  useEffect(() => {
    if (!slugNormalizado) return

    const trocouDeRestaurante = Boolean(slugAnterior.current) && slugAnterior.current !== slugNormalizado
    if (trocouDeRestaurante) {
      // O carrinho do restaurante anterior não pode ir junto...
      limparCarrinho()
      // ...e o cliente precisa entrar de novo neste restaurante
      if (sessao.current.isAuthenticated) {
        encerrouPorTroca.current = true
        sessao.current.sair()
      }
    }

    slugAnterior.current = slugNormalizado
    selecionar(slugNormalizado)
  }, [slugNormalizado, selecionar, limparCarrinho])

  const pronto = restaurante?.slug === slugNormalizado && restaurante.aceita_entrega

  useEffect(() => {
    if (!pronto) return
    navigate(isAuthenticated ? ROTA_APOS_LOGIN_CLIENTE : '/login/cliente', {
      replace: true,
      state: {
        from: ROTA_APOS_LOGIN_CLIENTE,
        aviso: encerrouPorTroca.current
          ? `Você abriu outro restaurante${restaurante?.nome ? ` (${restaurante.nome})` : ''}. Entre novamente para continuar.`
          : undefined,
      },
    })
  }, [pronto, isAuthenticated, navigate, restaurante?.nome])

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
