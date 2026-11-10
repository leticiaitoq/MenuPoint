// Validações e máscaras de endereço/telefone do cliente (entrega e retirada).
// As mesmas regras são conferidas de novo no backend; aqui servem para avisar logo, no campo.

export const UFS_BR = [
  'AC', 'AL', 'AP', 'AM', 'BA', 'CE', 'DF', 'ES', 'GO',
  'MA', 'MT', 'MS', 'MG', 'PA', 'PB', 'PR', 'PE', 'PI',
  'RJ', 'RN', 'RS', 'RO', 'RR', 'SC', 'SP', 'SE', 'TO',
];

// DDDs que existem no Brasil
const DDDS_VALIDOS = new Set([
  11, 12, 13, 14, 15, 16, 17, 18, 19,
  21, 22, 24, 27, 28,
  31, 32, 33, 34, 35, 37, 38,
  41, 42, 43, 44, 45, 46, 47, 48, 49,
  51, 53, 54, 55,
  61, 62, 63, 64, 65, 66, 67, 68, 69,
  71, 73, 74, 75, 77, 79,
  81, 82, 83, 84, 85, 86, 87, 88, 89,
  91, 92, 93, 94, 95, 96, 97, 98, 99,
]);

export const somenteDigitos = (v: string): string => v.replace(/\D/g, '');

/** 16900000 → 16900-000 */
export const formatarCep = (v: string): string => {
  const d = somenteDigitos(v).slice(0, 8);
  return d.length > 5 ? `${d.slice(0, 5)}-${d.slice(5)}` : d;
};

export const cepValido = (v: string): boolean => somenteDigitos(v).length === 8;

/** (16) 99999-9999 (celular) ou (16) 3333-4444 (fixo), enquanto a pessoa digita */
export const formatarTelefone = (v: string): string => {
  const d = somenteDigitos(v).slice(0, 11);
  if (d.length === 0) return '';
  if (d.length <= 2) return `(${d}`;
  if (d.length <= 6) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
  if (d.length <= 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
};

/**
 * Telefone brasileiro de verdade: DDD existente + celular (11 dígitos, começa com 9)
 * ou fixo (10 dígitos, começa com 2 a 5). Números todos iguais (11111111111) não valem.
 */
export const telefoneValido = (v: string): boolean => {
  const d = somenteDigitos(v);
  if (d.length !== 10 && d.length !== 11) return false;
  if (/^(\d)\1+$/.test(d)) return false;
  if (!DDDS_VALIDOS.has(Number(d.slice(0, 2)))) return false;
  return d.length === 11 ? d[2] === '9' : /[2-5]/.test(d[2]);
};

/** Número do imóvel: 245, 245A, 245-B ou S/N */
export const numeroValido = (v: string): boolean =>
  /^(s\/?n|\d{1,6}([-\s]?[a-z0-9]{1,4})?)$/i.test(v.trim()) && !/^0+$/.test(v.trim());

export interface EnderecoViaCep {
  rua: string;
  bairro: string;
  cidade: string;
  estado: string;
}

/**
 * Busca o endereço no ViaCEP (o mesmo serviço do cadastro do restaurante).
 * Devolve null se o CEP não existe; lança erro se a internet falhar (aí a pessoa preenche na mão).
 */
export async function buscarCepViaCep(cep: string): Promise<EnderecoViaCep | null> {
  const resp = await fetch(`https://viacep.com.br/ws/${somenteDigitos(cep)}/json/`);
  if (!resp.ok) throw new Error('Falha ao consultar o CEP');
  const dados = await resp.json();
  if (dados.erro) return null;
  return {
    rua: dados.logradouro ?? '',
    bairro: dados.bairro ?? '',
    cidade: dados.localidade ?? '',
    estado: dados.uf ?? '',
  };
}
