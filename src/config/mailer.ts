import nodemailer from 'nodemailer'
import { env } from './env'

// Cria o transporter do nodemailer com as configurações do Gmail
// O transporter é a instância que envia os e-mails
// Criamos uma vez e reutilizamos em toda a aplicação
export const transporter = nodemailer.createTransport({
  host: env.MAIL_HOST,
  port: env.MAIL_PORT,
  // secure: true usa SSL direto na porta 465
  // secure: false usa STARTTLS na porta 587
  // Para Gmail recomendamos porta 465 com secure: true
  secure: env.MAIL_PORT === 465,
  auth: {
    user: env.MAIL_USER,
    pass: env.MAIL_PASS,
  },
})

// Verifica se a conexão com o servidor de e-mail está funcionando
// Chamado na inicialização da API para detectar problemas cedo
export async function verificarConexaoEmail(): Promise<void> {
  try {
    await transporter.verify()
    console.log('✅ Serviço de e-mail conectado')
  } catch (error) {
    // Não derruba a API se o e-mail falhar — apenas avisa
    console.warn('⚠️  Serviço de e-mail indisponível:', error)
  }
}