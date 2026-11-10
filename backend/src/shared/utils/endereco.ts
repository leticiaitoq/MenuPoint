// Regras de endereço do cliente (entrega).

export const UFS_BR = [
  'AC', 'AL', 'AP', 'AM', 'BA', 'CE', 'DF', 'ES', 'GO',
  'MA', 'MT', 'MS', 'MG', 'PA', 'PB', 'PR', 'PE', 'PI',
  'RJ', 'RN', 'RS', 'RO', 'RR', 'SC', 'SP', 'SE', 'TO',
] as const

/** Número do imóvel */
export function numeroEnderecoValido(valor: string): boolean {
  const v = valor.trim()
  return /^(s\/?n|\d{1,6}([-\s]?[a-z0-9]{1,4})?)$/i.test(v) && !/^0+$/.test(v)
}
