// scripts/seed.js
// Script para criar o primeiro usuário admin no banco
// Rode com: npm run prisma:seed

const { PrismaClient } = require('@prisma/client')
const bcrypt = require('bcryptjs')

const prisma = new PrismaClient()

async function main() {
  console.log('🌱 Iniciando seed...')

  // Cria o hash da senha
  const senha_hash = await bcrypt.hash('senha123', 10)

  // Cria o primeiro estabelecimento
  const estabelecimento = await prisma.estabelecimento.upsert({
    where: { slug: 'estabelecimento-padrao' },
    update: {},
    create: {
      nome: 'Estabelecimento Padrão',
      slug: 'estabelecimento-padrao',
      telefone: '(11) 99999-9999',
      whatsapp: '11999999999',
      endereco: {
        rua: 'Rua Exemplo',
        numero: '123',
        bairro: 'Centro',
        cidade: 'São Paulo',
        estado: 'SP',
        cep: '01001-000',
      },
    },
  })

  console.log(`✅ Estabelecimento criado: ${estabelecimento.nome}`)

  // Cria o usuário admin
  const admin = await prisma.usuario.upsert({
    where: { email: 'adminglobal@email.com' },
    update: {},
    create: {
      nome: 'Adminglobal',
      email: 'adminglobal@email.com',
      senha_hash,
      perfil: 'ADMIN',
      escopo: 'GLOBAL',
      estabelecimento_id: estabelecimento.id,
      ativo: true,
    },
  })

  console.log(`✅ Usuário admin criado: ${admin.email}`)
  console.log(`🔑 Senha: senha123`)
  console.log(`🏠 Estabelecimento ID: ${estabelecimento.id}`)
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())