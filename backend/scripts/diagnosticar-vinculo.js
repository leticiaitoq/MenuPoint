/**
 * Diagnostica (e corrige, se pedir) o vínculo entre um usuário e seu
 * estabelecimento — usado pra resolver de vez o erro
 * "Usuário não vinculado a um estabelecimento" numa conta específica.
 *
 * POR QUE ISSO PODE ACONTECER:
 * A rota que cria funcionários (POST /usuarios) era pública e confiava
 * no `estabelecimento_id` que o próprio navegador mandava no corpo da
 * requisição. Se em algum teste essa rota foi chamada sem esse campo
 * (ou por um cliente HTTP direto, tipo Insomnia/Postman), o usuário
 * ficou criado no banco com `estabelecimento_id = NULL` — e por mais
 * que você deslogue e logue de novo, o token sempre vai carregar esse
 * mesmo `null`, porque é isso que está salvo no banco. Já corrigi a
 * rota (patch anterior), mas ela não "conserta" contas que já foram
 * criadas erradas antes da correção — por isso este script.
 *
 * COMO USAR:
 *
 *   node scripts/diagnosticar-vinculo.js seu-email@exemplo.com
 *
 *   Só mostra o diagnóstico, não muda nada no banco.
 *
 *   node scripts/diagnosticar-vinculo.js seu-email@exemplo.com --corrigir
 *
 *   Se o usuário estiver sem `estabelecimento_id` mas existir algum
 *   estabelecimento vinculado à mesma empresa dele, vincula
 *   automaticamente ao mais recente. Se não existir estabelecimento
 *   nenhum pra essa empresa, avisa que não há nada pra vincular
 *   (nesse caso o problema é outro — fale comigo).
 */

const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

async function main() {
  const email = process.argv[2]
  const corrigir = process.argv.includes('--corrigir')

  if (!email) {
    console.error('Uso: node scripts/diagnosticar-vinculo.js <email> [--corrigir]')
    process.exit(1)
  }

  const usuario = await prisma.usuario.findUnique({
    where: { email },
    include: { estabelecimento: true, empresa: true },
  })

  if (!usuario) {
    console.log(`❌ Nenhum usuário encontrado com o e-mail "${email}".`)
    return
  }

  console.log('── Usuário ──────────────────────────────────────────────')
  console.log(`id:                 ${usuario.id}`)
  console.log(`nome:               ${usuario.nome}`)
  console.log(`email:              ${usuario.email}`)
  console.log(`perfil:             ${usuario.perfil}`)
  console.log(`escopo:             ${usuario.escopo}`)
  console.log(`empresa_id:         ${usuario.empresa_id ?? '(nenhum)'}`)
  console.log(`estabelecimento_id: ${usuario.estabelecimento_id ?? '(nenhum) ⚠️'}`)
  console.log(`ativo:              ${usuario.ativo}`)
  console.log(`email_verificado:   ${usuario.email_verificado}`)
  console.log('')

  if (usuario.estabelecimento_id) {
    console.log('── Estabelecimento vinculado ────────────────────────────')
    console.log(`id:               ${usuario.estabelecimento?.id}`)
    console.log(`nome:             ${usuario.estabelecimento?.nome}`)
    console.log(`perfil_completo:  ${usuario.estabelecimento?.perfil_completo}`)
    console.log('')
    console.log('✅ Este usuário JÁ ESTÁ corretamente vinculado a um estabelecimento.')
    console.log('   Se o erro "não vinculado" ainda aparece pra essa conta, o problema')
    console.log('   é o TOKEN salvo no navegador estar desatualizado — peça pra a')
    console.log('   pessoa deslogar e logar de novo (isso emite um token novo, já')
    console.log('   com o vínculo correto).')
    return
  }

  console.log('⚠️  Este usuário NÃO tem estabelecimento_id — é isso que causa o erro.')
  console.log('')

  if (!usuario.empresa_id) {
    console.log('❌ Esse usuário também não tem empresa_id — não há nenhum')
    console.log('   estabelecimento pra vincular automaticamente. Isso não deveria')
    console.log('   acontecer com uma conta criada pelo registro normal (/auth/register).')
    console.log('   Provavelmente essa conta foi criada de outra forma (script manual,')
    console.log('   Prisma Studio, chamada direta na API). Me avise os detalhes.')
    return
  }

  const estabelecimentos = await prisma.estabelecimento.findMany({
    where: { empresa_id: usuario.empresa_id },
    orderBy: { criado_em: 'desc' },
  })

  if (estabelecimentos.length === 0) {
    console.log('❌ A empresa desse usuário não tem NENHUM estabelecimento cadastrado.')
    console.log('   Isso é inesperado — normalmente o registro cria os dois juntos.')
    console.log('   Fale comigo com esses dados pra investigarmos mais a fundo.')
    return
  }

  const maisRecente = estabelecimentos[0]

  console.log(`Encontrei ${estabelecimentos.length} estabelecimento(s) na mesma empresa:`)
  estabelecimentos.forEach((e, i) => {
    console.log(`  ${i + 1}. ${e.nome} (id: ${e.id}, perfil_completo: ${e.perfil_completo})${i === 0 ? '  ← mais recente' : ''}`)
  })
  console.log('')

  if (!corrigir) {
    console.log('Rode de novo com --corrigir pra vincular esse usuário ao mais recente.')
    return
  }

  await prisma.usuario.update({
    where: { id: usuario.id },
    data: { estabelecimento_id: maisRecente.id },
  })

  console.log(`✅ Pronto! "${usuario.email}" agora está vinculado a "${maisRecente.nome}".`)
  console.log('   Peça pra a pessoa deslogar e logar de novo pra pegar um token novo,')
  console.log('   já com o vínculo correto.')
}

main()
  .catch((err) => {
    console.error('Erro ao executar o script:', err)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
