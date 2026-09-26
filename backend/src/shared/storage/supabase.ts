import axios from 'axios'
import { env } from '@config/env'
import { AppError } from '@shared/errors/AppError'

/**
 * Descobre a extensão pelo CONTEÚDO do arquivo (não só pelo mimetype enviado):
 * PNG começa com 89 50 4E 47, JPEG com FF D8 FF.
 */
export function extensaoDeImagem(buffer: Buffer, mimetype: string): 'png' | 'jpg' | null {
  const png = buffer.length > 4 && buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4e && buffer[3] === 0x47
  const jpg = buffer.length > 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff
  if (png && mimetype === 'image/png') return 'png'
  if (jpg && (mimetype === 'image/jpeg' || mimetype === 'image/jpg')) return 'jpg'
  return null
}

/**
 * Envia a imagem para um bucket PÚBLICO do Supabase Storage e devolve a URL pública.
 * Requer SUPABASE_URL e SUPABASE_SERVICE_KEY (só no backend — nunca no frontend).
 */
export async function enviarImagemPublica(
  caminho: string,
  buffer: Buffer,
  contentType: string
): Promise<string> {
  if (!env.SUPABASE_URL || !env.SUPABASE_SERVICE_KEY) {
    throw new AppError('Upload de imagens não está configurado no servidor', 503)
  }

  const base = env.SUPABASE_URL.replace(/\/$/, '')

  try {
    await axios.post(`${base}/storage/v1/object/${env.SUPABASE_BUCKET}/${caminho}`, buffer, {
      headers: {
        Authorization: `Bearer ${env.SUPABASE_SERVICE_KEY}`,
        apikey: env.SUPABASE_SERVICE_KEY,
        'Content-Type': contentType,
        'x-upsert': 'true',
      },
      maxBodyLength: Infinity,
    })
  } catch (err: any) {
    console.error('Falha no upload para o Supabase Storage:', err?.response?.data ?? err?.message)
    throw new AppError('Não foi possível enviar a imagem. Tente novamente.', 502)
  }

  return `${base}/storage/v1/object/public/${env.SUPABASE_BUCKET}/${caminho}`
}
