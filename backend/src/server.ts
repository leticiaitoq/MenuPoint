import 'dotenv/config'
import { buildApp } from './app'
import { env } from '@config/env'
import { verificarConexaoEmail } from '@config/mailer'

async function main() {
  const app = buildApp()

  try {
    await app.listen({
      port: env.PORT,
      host: '0.0.0.0',
    })

    console.log(`🚀 API rodando em http://localhost:${env.PORT}`)
    console.log(`📦 Ambiente: ${env.NODE_ENV}`)

    await verificarConexaoEmail()

  } catch (err) {
    app.log.error(err)
    process.exit(1)
  }
}

main()