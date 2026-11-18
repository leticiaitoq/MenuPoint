/**
 * Reduz o tamanho das imagens que já estão no Supabase Storage
 * (logo do estabelecimento, produtos, categorias e foto do cliente).
 *
 * A imagem continua no mesmo caminho e no mesmo formato (PNG segue PNG, JPG segue JPG),
 * então a URL salva no banco não muda e nada precisa ser atualizado nas tabelas.
 * Antes de trocar, a original é guardada em scripts/backup-imagens/.
 *
 * Precisa do sharp: npm install --save-dev sharp
 *
 * Uso:
 *   node -r dotenv/config scripts/otimizar-imagens.js            só mostra o que seria feito
 *   node -r dotenv/config scripts/otimizar-imagens.js --aplicar  reenvia as imagens reduzidas
 */

const fs = require('fs')
const path = require('path')
const axios = require('axios')
const { PrismaClient } = require('@prisma/client')

let sharp
try {
  sharp = require('sharp')
} catch {
  console.error('Falta o sharp. Rode: npm install --save-dev sharp')
  process.exit(1)
}

const prisma = new PrismaClient()

// Só mexe em imagem maior que isso, e o resultado precisa ficar abaixo
const LIMITE = 500 * 1024

const ALVOS = [
  { nome: 'Logo', model: 'estabelecimento', campo: 'logo_url', maxLado: 800 },
  { nome: 'Produto', model: 'produto', campo: 'imagem_url', maxLado: 1200 },
  { nome: 'Categoria', model: 'categoria', campo: 'imagem_url', maxLado: 800 },
  { nome: 'Cliente', model: 'cliente', campo: 'foto_url', maxLado: 512 },
]

function headersAuth() {
  const chave = (process.env.SUPABASE_SERVICE_KEY ?? '').trim()
  return chave.startsWith('sb_')
    ? { apikey: chave }
    : { Authorization: `Bearer ${chave}`, apikey: chave }
}

// Descobre o formato pelo conteúdo, igual ao backend (extensaoDeImagem)
function formatoDe(buffer) {
  if (buffer.length > 4 && buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4e && buffer[3] === 0x47) return 'png'
  if (buffer.length > 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) return 'jpg'
  return null
}

// Tenta primeiro só comprimir, e se ainda ficar grande reduz as dimensões aos poucos
async function reduzir(buffer, formato, maxLadoInicial) {
  let maxLado = maxLadoInicial

  for (let tentativa = 0; tentativa < 5; tentativa++) {
    const base = sharp(buffer)
      .rotate()
      .resize({ width: maxLado, height: maxLado, fit: 'inside', withoutEnlargement: true })

    if (formato === 'png') {
      // Sem perda primeiro; se não bastar, paleta de cores (mantém a transparência)
      let saida = await base.clone().png({ compressionLevel: 9 }).toBuffer()
      if (saida.length <= LIMITE) return saida
      saida = await base.clone().png({ compressionLevel: 9, palette: true, quality: 85 }).toBuffer()
      if (saida.length <= LIMITE) return saida
    } else {
      for (const qualidade of [85, 78, 70, 62]) {
        const saida = await base.clone().jpeg({ quality: qualidade, mozjpeg: true }).toBuffer()
        if (saida.length <= LIMITE) return saida
      }
    }

    maxLado = Math.round(maxLado * 0.75)
  }

  return null
}

const kb = (n) => `${Math.round(n / 1024)} KB`

async function main() {
  const aplicar = process.argv.includes('--aplicar')
  const { SUPABASE_URL, SUPABASE_SERVICE_KEY } = process.env
  const bucket = process.env.SUPABASE_BUCKET || 'logos'

  if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
    console.error('Defina SUPABASE_URL e SUPABASE_SERVICE_KEY no .env')
    process.exit(1)
  }

  const base = SUPABASE_URL.replace(/\/$/, '')
  const prefixo = `${base}/storage/v1/object/public/${bucket}/`
  const pastaBackup = path.join(__dirname, 'backup-imagens')

  console.log(aplicar ? 'Modo APLICAR: as imagens serão trocadas.\n' : 'Modo simulação: nada será alterado (use --aplicar).\n')

  const vistos = new Set()
  let analisadas = 0
  let reduzidas = 0
  let falhas = 0
  let antes = 0
  let depois = 0

  for (const alvo of ALVOS) {
    const linhas = await prisma[alvo.model].findMany({
      where: { [alvo.campo]: { not: null } },
      select: { id: true, [alvo.campo]: true },
    })

    for (const linha of linhas) {
      const url = String(linha[alvo.campo] ?? '').split('?')[0]
      if (!url.startsWith(prefixo) || vistos.has(url)) continue
      vistos.add(url)
      analisadas++

      const caminho = url.slice(prefixo.length)
      try {
        const resposta = await axios.get(url, { responseType: 'arraybuffer' })
        const original = Buffer.from(resposta.data)
        if (original.length <= LIMITE) continue

        const formato = formatoDe(original)
        if (!formato) {
          console.log(`[${alvo.nome}] ${caminho}: formato desconhecido, ignorada`)
          continue
        }

        const nova = await reduzir(original, formato, alvo.maxLado)
        if (!nova || nova.length >= original.length) {
          console.log(`[${alvo.nome}] ${caminho}: não deu para reduzir, ignorada`)
          continue
        }

        console.log(`[${alvo.nome}] ${caminho}: ${kb(original.length)} -> ${kb(nova.length)}`)
        antes += original.length
        depois += nova.length
        reduzidas++

        if (aplicar) {
          const arquivoBackup = path.join(pastaBackup, caminho.replace(/[\\/]/g, '__'))
          fs.mkdirSync(pastaBackup, { recursive: true })
          fs.writeFileSync(arquivoBackup, original)

          await axios.post(`${base}/storage/v1/object/${bucket}/${caminho}`, nova, {
            headers: {
              ...headersAuth(),
              'Content-Type': formato === 'png' ? 'image/png' : 'image/jpeg',
              'x-upsert': 'true',
            },
            maxBodyLength: Infinity,
          })
        }
      } catch (err) {
        falhas++
        console.log(`[${alvo.nome}] ${caminho}: erro (${err?.response?.status ?? err?.message})`)
      }
    }
  }

  console.log(`\nAnalisadas: ${analisadas} | Reduzidas: ${reduzidas} | Falhas: ${falhas}`)
  if (reduzidas > 0) console.log(`Total: ${kb(antes)} -> ${kb(depois)} (economia de ${kb(antes - depois)})`)
  if (!aplicar && reduzidas > 0) console.log('Para aplicar, rode de novo com --aplicar')
}

module.exports = { reduzir, formatoDe }

if (require.main === module) {
  main()
    .catch((err) => {
      console.error(err)
      process.exitCode = 1
    })
    .finally(() => prisma.$disconnect())
}
