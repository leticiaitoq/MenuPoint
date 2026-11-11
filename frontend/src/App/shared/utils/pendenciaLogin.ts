/**
 * "Pendência de login" do cliente DELIVERY.
 *
 * O visitante navega sem conta, mas para fazer um pedido ou uma reserva precisa entrar. Quando ele
 * aceita ir para o login, guardamos aqui ONDE ele estava e o que ia fazer, para devolvê-lo ao mesmo
 * ponto depois de entrar (ou de criar a conta e confirmar o e-mail, que passa por outras telas).
 *
 * Fica no sessionStorage: vale só para esta aba e some quando ela fecha. Expira em 30 min.
 * O carrinho em si é guardado pelo CarrinhoContext (também no sessionStorage).
 */
export type MotivoLogin = 'pedido' | 'reserva' | 'perfil' | 'historico'

/** Passo a retomar sozinho quando o cliente voltar (hoje: reabrir a escolha entrega × retirada) */
export type RetomadaLogin = 'tipo-pedido'

export interface PendenciaLogin {
  motivo: MotivoLogin
  /** Tela para onde o login devolve o cliente */
  retorno: string
  retomar?: RetomadaLogin
  criadoEm: number
}

const CHAVE = '@menupoint:pendencia_login'
const VALIDADE_MS = 30 * 60 * 1000

export function limparPendenciaLogin(): void {
  try {
    sessionStorage.removeItem(CHAVE)
  } catch {
    /* storage indisponível */
  }
}

export function salvarPendenciaLogin(pendencia: Omit<PendenciaLogin, 'criadoEm'>): void {
  try {
    sessionStorage.setItem(CHAVE, JSON.stringify({ ...pendencia, criadoEm: Date.now() }))
  } catch {
    /* storage indisponível: o login ainda funciona, só não retoma o passo */
  }
}

export function lerPendenciaLogin(): PendenciaLogin | null {
  try {
    const bruto = sessionStorage.getItem(CHAVE)
    if (!bruto) return null
    const p = JSON.parse(bruto) as PendenciaLogin
    if (!p?.retorno || Date.now() - p.criadoEm > VALIDADE_MS) {
      limparPendenciaLogin()
      return null
    }
    return p
  } catch {
    return null
  }
}

/**
 * Destino depois de entrar: a tela pedida explicitamente (`from`) ou a da pendência.
 * Pendência sem passo a retomar acaba aqui; com passo a retomar, continua até a tela consumi-lo.
 */
export function consumirRetornoLogin(from?: string | null): string | undefined {
  const p = lerPendenciaLogin()
  if (p && !p.retomar) limparPendenciaLogin()
  return from ?? p?.retorno
}

/** true (uma única vez) se existe a retomada pedida: a tela chama e então continua de onde parou */
export function consumirRetomada(retomar: RetomadaLogin): boolean {
  const p = lerPendenciaLogin()
  if (p?.retomar !== retomar) return false
  limparPendenciaLogin()
  return true
}
