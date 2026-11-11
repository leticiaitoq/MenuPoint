import { env } from '@config/env'
import { enviarEmail } from '@config/mailer'
import { enviarMensagemWhatsApp } from '@config/whatsapp'
import { AppError } from '@shared/errors/AppError'
import { templateContatoEspecialista } from '@shared/emails/templates'
import { ContatoEspecialistaDTO } from './Contato.schema'

const umaLinha = (texto: string): string => texto.replace(/[\r\n]+/g, ' ').trim()

export class ContatoService {
  async enviarParaEspecialista(dados: ContatoEspecialistaDTO): Promise<void> {
    // Para onde o alerta vai: CONTATO_EMAIL; se não existir, usa o MAIL_REPLY_TO já configurado.
    const destino = env.CONTATO_EMAIL ?? env.MAIL_REPLY_TO
    const whatsappAtivo = Boolean(env.ZAPI_INSTANCE_ID && env.WHATSAPP_NOTIFICACOES)

    if (!destino && !whatsappAtivo) {
      console.error('Contato Enterprise recebido, mas CONTATO_EMAIL não está configurado:', dados.email)
      throw new AppError('O contato por aqui está indisponível no momento. Tente pelo WhatsApp.', 503)
    }

    let entregue = false

    if (destino) {
      try {
        await enviarEmail({
          to: destino,
          subject: `Novo contato Enterprise: ${umaLinha(dados.restaurante || dados.nome)}`,
          html: templateContatoEspecialista(dados),
          // Responder o e-mail já responde direto para quem pediu contato
          replyTo: dados.email,
        })
        entregue = true
      } catch (err) {
        console.error('Erro ao enviar e-mail de contato Enterprise:', err)
      }
    }

    // Alerta extra no WhatsApp da equipe.
    if (whatsappAtivo) {
      const linhas = [
        '*Novo contato Enterprise (site)*',
        `Nome: ${umaLinha(dados.nome)}`,
        `E-mail: ${dados.email}`,
        dados.telefone ? `Telefone: ${umaLinha(dados.telefone)}` : '',
        dados.restaurante ? `Restaurante: ${umaLinha(dados.restaurante)}` : '',
        dados.mensagem ? `Mensagem: ${dados.mensagem}` : '',
      ].filter(Boolean)

      const enviado = await enviarMensagemWhatsApp(env.WHATSAPP_NOTIFICACOES as string, linhas.join('\n'))
      entregue = entregue || enviado
    }

    if (!entregue) {
      throw new AppError('Não foi possível enviar sua mensagem agora. Tente novamente em instantes.', 502)
    }
  }
}
