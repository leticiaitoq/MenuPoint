// Ponto de entrada da aplicação
// Carrega as variáveis de ambiente e sobe o servidor

import 'dotenv/config'
import { buildApp } from './app'
import { env } from '@config/env'

async function main() {
  const app = buildApp()

  try {
    await app.listen({
      port: env.PORT,
      // 0.0.0.0 faz a API escutar em todas as interfaces de rede
      // Necessário para funcionar dentro de containers Docker
      host: '0.0.0.0',
    })

    console.log(`🚀 API rodando em http://localhost:${env.PORT}`)
    console.log(`📦 Ambiente: ${env.NODE_ENV}`)
  } catch (err) {
    app.log.error(err)
    // process.exit(1) encerra com código de erro
    // Sinaliza para o sistema operacional que o processo falhou
    process.exit(1)
  }
}

// Chama a função principal
main()