/**
 * Prepara uma imagem escolhida pelo usuário ANTES do upload:
 * corrige a rotação do celular, corta (opcional) e reduz o tamanho,
 * para caber no limite do bucket sem o usuário precisar editar a foto.
 */

interface OpcoesImagem {
  /** Maior lado final em pixels (a imagem nunca é ampliada). */
  maxLado?: number
  /** true = corta o centro em quadrado (ideal para foto de perfil). */
  quadrada?: boolean
  /** Tamanho máximo do arquivo final. Deve ficar abaixo do limite do bucket (ex.: 2MB). */
  maxBytes?: number
}

function paraBlob(canvas: HTMLCanvasElement, tipo: string, qualidade?: number): Promise<Blob | null> {
  return new Promise((resolve) => canvas.toBlob(resolve, tipo, qualidade))
}

async function abrirImagem(arquivo: File): Promise<{ img: CanvasImageSource; largura: number; altura: number }> {
  // createImageBitmap já aplica a orientação EXIF (foto de celular não sai deitada)
  if (typeof createImageBitmap === 'function') {
    try {
      const bmp = await createImageBitmap(arquivo, { imageOrientation: 'from-image' })
      return { img: bmp, largura: bmp.width, altura: bmp.height }
    } catch {
      /* cai no <img> abaixo */
    }
  }
  const url = URL.createObjectURL(arquivo)
  try {
    const img = await new Promise<HTMLImageElement>((ok, erro) => {
      const el = new Image()
      el.onload = () => ok(el)
      el.onerror = () => erro(new Error('Não foi possível ler a imagem.'))
      el.src = url
    })
    return { img, largura: img.naturalWidth, altura: img.naturalHeight }
  } finally {
    URL.revokeObjectURL(url)
  }
}

export async function prepararImagem(arquivo: File, opcoes: OpcoesImagem = {}): Promise<File> {
  const { maxLado = 1024, quadrada = false, maxBytes = 1.5 * 1024 * 1024 } = opcoes

  const { img, largura, altura } = await abrirImagem(arquivo)

  // Já está pequena e sem corte pedido: envia o original
  if (!quadrada && arquivo.size <= maxBytes && Math.max(largura, altura) <= maxLado) {
    return arquivo
  }

  // Área de origem (corte central quando quadrada)
  const lado = Math.min(largura, altura)
  const sx = quadrada ? (largura - lado) / 2 : 0
  const sy = quadrada ? (altura - lado) / 2 : 0
  const sw = quadrada ? lado : largura
  const sh = quadrada ? lado : altura

  // PNG sem corte mantém a transparência (logos); o resto vira JPEG, bem mais leve
  const manterPng = arquivo.type === 'image/png' && !quadrada

  let maxAtual = maxLado
  for (let tentativa = 0; tentativa < 4; tentativa++) {
    const escala = Math.min(1, maxAtual / Math.max(sw, sh))
    const canvas = document.createElement('canvas')
    canvas.width = Math.max(1, Math.round(sw * escala))
    canvas.height = Math.max(1, Math.round(sh * escala))

    const ctx = canvas.getContext('2d')
    if (!ctx) throw new Error('Seu navegador não conseguiu processar a imagem.')

    if (!manterPng) {
      ctx.fillStyle = '#ffffff' // JPEG não tem transparência: fundo branco em vez de preto
      ctx.fillRect(0, 0, canvas.width, canvas.height)
    }
    ctx.drawImage(img, sx, sy, sw, sh, 0, 0, canvas.width, canvas.height)

    if (manterPng) {
      const png = await paraBlob(canvas, 'image/png')
      if (png && png.size <= maxBytes) {
        return new File([png], arquivo.name.replace(/\.\w+$/, '') + '.png', { type: 'image/png' })
      }
      // PNG ficou grande: segue para JPEG abaixo
    }

    for (const q of [0.9, 0.8, 0.7, 0.6]) {
      const jpg = await paraBlob(canvas, 'image/jpeg', q)
      if (jpg && jpg.size <= maxBytes) {
        return new File([jpg], arquivo.name.replace(/\.\w+$/, '') + '.jpg', { type: 'image/jpeg' })
      }
    }

    maxAtual = Math.round(maxAtual * 0.75) // ainda grande: reduz as dimensões e tenta de novo
  }

  throw new Error('Não foi possível reduzir a imagem o suficiente. Escolha outra.')
}
