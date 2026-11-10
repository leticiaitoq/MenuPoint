import { useCallback, useEffect, useState } from 'react'
import PedidoClienteService, { PedidoHistorico } from '../../../services/pedidoCliente.service'
import { mensagemDeErro } from '../../../services/cliente.service'

const INTERVALO_ATUALIZACAO_MS = 15000 // o cliente vê o pedido andar sozinho (pronto, entregue...)

/**
 * Histórico FIXO da conta logada (mesa + delivery juntos), atualizado sozinho.
 * Só existe para cliente logado: convidado não tem histórico guardado (passe `ativo = false`).
 * `slug` restringe ao restaurante atual; sem ele traz de todos os restaurantes da conta.
 */
export function useHistoricoCliente(slug: string | null | undefined, ativo = true) {
  const [pedidos, setPedidos] = useState<PedidoHistorico[]>([])
  const [carregando, setCarregando] = useState(ativo)
  const [erro, setErro] = useState<string | null>(null)

  const carregar = useCallback(async () => {
    if (!ativo) return
    try {
      setPedidos(await PedidoClienteService.historico({ slug }))
      setErro(null)
    } catch (err) {
      // Na atualização automática mantém o que já está na tela e só avisa
      setErro(mensagemDeErro(err, 'Não foi possível carregar seus pedidos.'))
    } finally {
      setCarregando(false)
    }
  }, [slug, ativo])

  useEffect(() => {
    if (!ativo) {
      setCarregando(false)
      return
    }
    void carregar()
    const timer = setInterval(carregar, INTERVALO_ATUALIZACAO_MS)
    return () => clearInterval(timer)
  }, [carregar, ativo])

  return { pedidos, carregando, erro, recarregar: carregar }
}
