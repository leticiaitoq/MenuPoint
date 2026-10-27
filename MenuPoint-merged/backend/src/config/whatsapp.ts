import axios from 'axios'
import { env } from './env'
import { telefoneParaWhatsApp } from '@shared/utils/telefone'

export async function enviarMensagemWhatsApp(
  numero: string,
  mensagem: string
): Promise<boolean> {
  try {
    await axios.post(
      `https://api.z-api.io/instances/${env.ZAPI_INSTANCE_ID}/token/${env.ZAPI_TOKEN}/send-text`,
      {
        // O cadastro guarda "(11) 91234-5678"; a Z-API precisa de DDI+DDD+número.
        phone: telefoneParaWhatsApp(numero),
        message: mensagem,
      }
    )
    return true
  } catch (error) {
    console.error('Erro ao enviar WhatsApp:', error)
    return false
  }
}
