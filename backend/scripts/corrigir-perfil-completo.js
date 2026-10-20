/**
 * Corrige retroativamente `perfil_completo` de estabelecimentos que já
 * têm todos os dados mínimos preenchidos (telefone, whatsapp e endereço
 * completo), mas ficaram travados em `false` por causa de um bug: nem
 * `criar` nem `atualizar` estabelecimento jamais setavam esse campo —
 * era só o valor padrão da coluna, nunca mudado em lugar nenhum. Isso já
 * foi corrigido no código (Estabelecimento.service.ts calcula sozinho a
 * partir de agora), mas não conserta os registros que já existiam antes
 * da correção — é isso que este script faz, uma vez.
 *
 * COMO USAR:
 *
 *   node scripts/corrigir-perfil-completo.js
 *
 *   Só mostra quais estabelecimentos seriam corrigidos, não muda nada.
 *
 *   node scripts/corrigir-perfil-completo.js --corrigir
 *
 *   Aplica a correção de fato.
 */

const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

function perfilEstaCompleto(estabelecimento) {
  if (!estabelecimento.telefone?.trim() || !estabelecimento.whatsapp?.trim()) {
    return false
  }
  const endereco = estabelecimento.endereco
  if (!endereco || typeof endereco !== 'object') return false

  return ['rua', 'numero', 'bairro', 'cidade', 'estado', 'cep'].every(
    (campo) => typeof endereco[campo] === 'string' && endereco[campo].trim().length > 0
  )
}

async function main() {
  const corrigir = process.argv.includes('--corrigir')

  const estabelecimentos = await prisma.estabelecimento.findMany({
    where: { perfil_completo: false },
  })

  const paraCorrigir = estabelecimentos.filter(perfilEstaCompleto)

  if (paraCorrigir.length === 0) {
    console.log('Nenhum estabelecimento precisa de correção — tudo certo.')
    return
  }

  console.log(`Encontrei ${paraCorrigir.length} estabelecimento(s) com dados completos`)
  console.log('mas marcados como perfil_completo = false:')
  console.log('')
  paraCorrigir.forEach((e) => console.log(`  - ${e.nome} (id: ${e.id})`))
  console.log('')

  if (!corrigir) {
    console.log('Rode de novo com --corrigir pra aplicar a correção.')
    return
  }

  for (const e of paraCorrigir) {
    await prisma.estabelecimento.update({
      where: { id: e.id },
      data: { perfil_completo: true },
    })
  }

  console.log(`✅ ${paraCorrigir.length} estabelecimento(s) corrigido(s).`)
  console.log('   As pessoas ligadas a eles precisam deslogar e logar de novo (ou')
  console.log('   esperar o app rebuscar /auth/me) pra pegar o `perfil_completo`')
  console.log('   atualizado e parar de cair na tela de cadastro do perfil.')
}

main()
  .catch((err) => {
    console.error('Erro ao executar o script:', err)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
