// Instância única do PrismaClient compartilhada por toda a aplicação
// Usar uma única instância evita abrir múltiplas conexões com o banco

import { PrismaClient } from '@prisma/client'
import { env } from './env'

// Em desenvolvimento logamos as queries para facilitar o debug
// Em produção logamos apenas erros para não poluir os logs
const prisma = new PrismaClient({
  log: env.NODE_ENV === 'development'
    ? ['query', 'info', 'warn', 'error']
    : ['error'],
})

export default prisma