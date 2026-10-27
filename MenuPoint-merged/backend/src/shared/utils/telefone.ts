// Telefone brasileiro: aceita "(11) 91234-5678", "11912345678", "+55 11 91234-5678"...

/** Só os dígitos, sem o DDI 55 (se vier). */
export function digitosNacionais(valor: string): string {
  const d = valor.replace(/\D/g, '')
  return d.length > 11 && d.startsWith('55') ? d.slice(2) : d
}

/** DDD (11–99) + 8 dígitos (fixo) ou 9 dígitos começando com 9 (celular). */
export function telefoneValido(valor: string): boolean {
  const d = digitosNacionais(valor)
  if (!/^[1-9][1-9]/.test(d)) return false
  if (d.length === 10) return true
  return d.length === 11 && d[2] === '9'
}

/** "(11) 91234-5678" ou "(11) 1234-5678". Devolve o texto original se não der para formatar. */
export function formatarTelefone(valor: string): string {
  const d = digitosNacionais(valor)
  if (d.length === 11) return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`
  if (d.length === 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`
  return valor
}

/** Formato que a Z-API espera: DDI + DDD + número (ex.: 5511912345678). */
export function telefoneParaWhatsApp(valor: string): string {
  const d = digitosNacionais(valor)
  return d.length === 10 || d.length === 11 ? `55${d}` : valor.replace(/\D/g, '')
}
