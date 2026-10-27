// Gera o slug (parte da URL do cardápio) a partir do nome do restaurante.
// "Sabor da Vila & Cia" → "sabor-da-vila-cia"
export function gerarSlug(texto: string, max = 80): string {
  const slug = texto
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // remove acentos
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')     // tudo que não for letra/número vira hífen
    .replace(/^-+|-+$/g, '')
    .slice(0, max)
    .replace(/-+$/, '')

  return slug || 'restaurante'
}
