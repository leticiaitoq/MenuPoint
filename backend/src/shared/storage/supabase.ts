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

/** Chaves novas (sb_secret_...) não são JWT: só o header apikey. As legadas (JWT) usam os dois. */
function headersAuth(): Record<string, string> {
  const chave = (env.SUPABASE_SERVICE_KEY ?? '').trim()
  return chave.startsWith('sb_')
    ? { apikey: chave }
    : { Authorization: `Bearer ${chave}`, apikey: chave }
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
        ...headersAuth(),
        'Content-Type': contentType,
        'x-upsert': 'true',
      },
      maxBodyLength: Infinity,
    })
  } catch (err: any) {
    const detalhe = err?.response?.data ?? err?.message
    console.error('Falha no upload para o Supabase Storage:', err?.response?.status, detalhe)

    // Só em desenvolvimento: mostra o motivo real na tela/Network para facilitar a configuração
    if (env.NODE_ENV === 'development') {
      const texto = typeof detalhe === 'string' ? detalhe : JSON.stringify(detalhe)
      throw new AppError(`Supabase recusou o upload (${err?.response?.status ?? 'sem resposta'}): ${texto}`, 502)
    }
    throw new AppError('Não foi possível enviar a imagem. Tente novamente.', 502)
  }

  return `${base}/storage/v1/object/public/${env.SUPABASE_BUCKET}/${caminho}`
}


/**
 * Apaga um arquivo do bucket a partir da URL pública que enviarImagemPublica devolveu.
 * Best-effort: nunca lança erro (um arquivo órfão não pode quebrar a troca de foto).
 */
export async function removerImagemPublica(urlPublica: string): Promise<void> {
  if (!env.SUPABASE_URL || !env.SUPABASE_SERVICE_KEY) return

  const base = env.SUPABASE_URL.replace(/\/$/, '')
  const prefixo = `${base}/storage/v1/object/public/${env.SUPABASE_BUCKET}/`
  if (!urlPublica.startsWith(prefixo)) return // URL de outro lugar: não mexe

  const caminho = urlPublica.slice(prefixo.length)
  try {
    await axios.delete(`${base}/storage/v1/object/${env.SUPABASE_BUCKET}/${caminho}`, {
      headers: headersAuth(),
    })
  } catch (err: any) {
    console.warn('Não foi possível apagar a imagem antiga:', err?.response?.data ?? err?.message)
  }
}
