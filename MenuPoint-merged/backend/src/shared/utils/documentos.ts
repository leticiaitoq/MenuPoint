// Validação de CPF e CNPJ (formato + dígitos verificadores).
// O front já valida, mas a API nunca deve confiar só no cliente.

const somenteDigitos = (v: string) => v.replace(/\D/g, '')

export function cpfValido(valor: string): boolean {
  const d = somenteDigitos(valor)
  if (d.length !== 11 || /^(\d)\1{10}$/.test(d)) return false

  const calc = (len: number) => {
    let soma = 0
    for (let i = 0; i < len; i++) soma += Number(d[i]) * (len + 1 - i)
    const r = (soma * 10) % 11
    return r === 10 ? 0 : r
  }

  return calc(9) === Number(d[9]) && calc(10) === Number(d[10])
}

export function cnpjValido(valor: string): boolean {
  const d = somenteDigitos(valor)
  if (d.length !== 14 || /^(\d)\1{13}$/.test(d)) return false

  const calc = (len: number) => {
    const pesos =
      len === 12
        ? [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]
        : [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]
    let soma = 0
    for (let i = 0; i < len; i++) soma += Number(d[i]) * pesos[i]
    const r = soma % 11
    return r < 2 ? 0 : 11 - r
  }

  return calc(12) === Number(d[12]) && calc(13) === Number(d[13])
}
