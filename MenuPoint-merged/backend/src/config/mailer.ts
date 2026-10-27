import { env } from './env'

// Envio de e-mails via Resend (https://resend.com/docs/api-reference/emails/send-email).
// Configuração: RESEND_API_KEY, MAIL_FROM e MAIL_REPLY_TO no .env (nada fica no código).
//
// `transporter.sendMail(...)` mantém o mesmo formato que o antigo nodemailer, então os
// serviços que já enviam e-mail continuam funcionando sem mudança.

const RESEND_URL = 'https://api.resend.com/emails'

interface EnvioEmail {
  from?: string
  to: string
  subject: string
  html: string
  text?: string
}

// Versão em texto puro do e-mail. Mensagens só com HTML pontuam pior nos filtros de spam;
// enviar HTML + texto é uma das práticas que mais ajudam a chegar na caixa de entrada.
function htmlParaTexto(html: string): string {
  return html
    .replace(/<(style|title)[\s\S]*?<\/\1>/gi, '')
    .replace(/<(br|\/p|\/div|\/h[1-6]|\/li)\s*\/?>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n\s*\n\s*\n+/g, '\n\n')
    .split('\n')
    .map((linha) => linha.trim())
    .join('\n')
    .trim()
}

export async function enviarEmail({ from, to, subject, html, text }: EnvioEmail): Promise<void> {
  const resposta = await fetch(RESEND_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${env.RESEND_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: from ?? env.MAIL_FROM,
      to: [to],
      subject,
      html,
      text: text ?? htmlParaTexto(html),
      ...(env.MAIL_REPLY_TO ? { reply_to: env.MAIL_REPLY_TO } : {}),
    }),
    // Sem isso uma falha de rede deixaria a requisição pendurada
    signal: AbortSignal.timeout(10_000),
  })

  if (!resposta.ok) {
    const detalhe = await resposta.text().catch(() => '')
    throw new Error(`Resend respondeu ${resposta.status}: ${detalhe}`)
  }
}

// Compatibilidade com o código que já chamava `transporter.sendMail(...)`
export const transporter = { sendMail: enviarEmail }

// Chamado na inicialização da API. Não faz chamada de rede (a chave do Resend pode ser
// só de envio): apenas confirma a configuração e mostra o remetente em uso.
export async function verificarConexaoEmail(): Promise<void> {
  console.log(`✅ E-mail via Resend configurado (remetente: ${env.MAIL_FROM})`)
}
