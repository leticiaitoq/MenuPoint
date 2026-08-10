import axios from 'axios'
import { env } from './env'

export async function enviarMensagemWhatsApp(
  numero: string,
  mensagem: string
): Promise<boolean> {
  try {
    await axios.post(
      `https://api.z-api.io/instances/${env.ZAPI_INSTANCE_ID}/token/${env.ZAPI_TOKEN}/send-text`,
      {
        phone: numero.replace(/\D/g, ''),
        message: mensagem,
      }
    )
    return true
  } catch (error) {
    console.error('Erro ao enviar WhatsApp:', error)
    return false
  }
}