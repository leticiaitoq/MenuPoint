import prisma from '@config/prisma'

// Cache curto: evita uma consulta ao banco em TODA requisição, mas faz um funcionário desligado
// (ou com perfil alterado) perder o acesso em até TTL_MS, em vez de manter o token por 7 dias.
const TTL_MS = 30_000
const cache = new Map<string, { ativo: boolean; perfil: string; expira: number }>()

export async function situacaoDoUsuario(id: string) {
  const agora = Date.now()
  const hit = cache.get(id)
  if (hit && hit.expira > agora) return hit

  const u = await prisma.usuario.findUnique({
    where: { id },
    select: { ativo: true, perfil: true },
  })
  const valor = { ativo: !!u?.ativo, perfil: u?.perfil ?? '', expira: agora + TTL_MS }
  cache.set(id, valor)

  // Evita crescer sem limite
  if (cache.size > 5000) {
    for (const [k, v] of cache) if (v.expira <= agora) cache.delete(k)
  }
  return valor
}

/** Chame quando desativar um usuário ou trocar o perfil, para valer na hora neste processo */
export function invalidarUsuario(id: string) {
  cache.delete(id)
}
