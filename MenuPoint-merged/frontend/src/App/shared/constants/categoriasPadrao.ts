/**
 * Categorias prontas do cardápio (mesmo conceito do "Tipo de cozinha" em Configurações):
 * o restaurante escolhe numa lista e, se não achar a dele, usa "Outra" e digita.
 *
 * O que vai para o banco continua sendo o próprio texto (`nome`) + o emoji (`icone`),
 * então categorias antigas e personalizadas seguem funcionando.
 * O emoji aparece na barra de categorias do cardápio do cliente (MenuCliente).
 */

export interface CategoriaPadrao {
  nome: string
  icone: string // até 10 caracteres (limite da coluna `icone`)
}

export interface GrupoCategoriasPadrao {
  grupo: string
  itens: CategoriaPadrao[]
}

// Agrupadas só para o dropdown ficar fácil de percorrer (usa <optgroup>)
export const GRUPOS_CATEGORIAS_PADRAO: GrupoCategoriasPadrao[] = [
  {
    grupo: 'Para começar',
    itens: [
      { nome: 'Entradas', icone: '🍤' },
      { nome: 'Porções e petiscos', icone: '🍟' },
      { nome: 'Saladas', icone: '🥗' },
      { nome: 'Sopas e caldos', icone: '🍲' },
    ],
  },
  {
    grupo: 'Pratos',
    itens: [
      { nome: 'Pratos principais', icone: '🍽️' },
      { nome: 'Pratos executivos', icone: '🍱' },
      { nome: 'Marmitas', icone: '🥡' },
      { nome: 'Massas', icone: '🍝' },
      { nome: 'Carnes e grelhados', icone: '🥩' },
      { nome: 'Aves', icone: '🍗' },
      { nome: 'Peixes e frutos do mar', icone: '🐟' },
      { nome: 'Japonesa', icone: '🍣' },
      { nome: 'Vegetarianos e veganos', icone: '🥬' },
      { nome: 'Acompanhamentos', icone: '🍚' },
    ],
  },
  {
    grupo: 'Lanches e salgados',
    itens: [
      { nome: 'Pizzas', icone: '🍕' },
      { nome: 'Hambúrgueres', icone: '🍔' },
      { nome: 'Sanduíches e lanches', icone: '🥪' },
      { nome: 'Hot dogs', icone: '🌭' },
      { nome: 'Pastéis', icone: '🥟' },
      { nome: 'Salgados', icone: '🥐' },
      { nome: 'Crepes e tapiocas', icone: '🥞' },
      { nome: 'Café da manhã', icone: '🍳' },
    ],
  },
  {
    grupo: 'Sobremesas',
    itens: [
      { nome: 'Sobremesas', icone: '🍰' },
      { nome: 'Doces e confeitaria', icone: '🧁' },
      { nome: 'Açaí e sorvetes', icone: '🍨' },
    ],
  },
  {
    grupo: 'Bebidas',
    itens: [
      { nome: 'Bebidas', icone: '🥤' },
      { nome: 'Refrigerantes e águas', icone: '💧' },
      { nome: 'Sucos e vitaminas', icone: '🧃' },
      { nome: 'Cafés e chás', icone: '☕' },
      { nome: 'Cervejas', icone: '🍺' },
      { nome: 'Drinks e coquetéis', icone: '🍹' },
      { nome: 'Vinhos', icone: '🍷' },
    ],
  },
  {
    grupo: 'Especiais',
    itens: [
      { nome: 'Combos', icone: '🎁' },
      { nome: 'Promoções', icone: '🏷️' },
      { nome: 'Menu infantil', icone: '🧒' },
    ],
  },
]

export const CATEGORIAS_PADRAO: CategoriaPadrao[] = GRUPOS_CATEGORIAS_PADRAO.flatMap((g) => g.itens)

/** Valor do <select> que libera o campo de texto ("Outra") */
export const OUTRA_CATEGORIA = '__outra__'

/** Compara nomes sem diferenciar maiúsculas, acentos e espaços nas pontas */
export const chaveDeNome = (nome: string): string =>
  nome
    .trim()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()

export const acharCategoriaPadrao = (nome: string): CategoriaPadrao | undefined => {
  const chave = chaveDeNome(nome)
  return CATEGORIAS_PADRAO.find((c) => chaveDeNome(c.nome) === chave)
}

// ── Estado do seletor ────────────────────────────────────────────────────────
export interface SelecaoCategoria {
  /** nome de uma categoria pronta, OUTRA_CATEGORIA ou '' (nada escolhido) */
  selecao: string
  /** texto digitado quando selecao === OUTRA_CATEGORIA */
  texto: string
}

export const SELECAO_VAZIA: SelecaoCategoria = { selecao: '', texto: '' }

/** Monta o estado a partir de uma categoria já salva (usado ao editar) */
export const selecaoDeNome = (nome: string): SelecaoCategoria => {
  const padrao = acharCategoriaPadrao(nome)
  return padrao ? { selecao: padrao.nome, texto: '' } : { selecao: OUTRA_CATEGORIA, texto: nome }
}

/** Nome + ícone que serão gravados. Digitar em "Outra" um nome que já é pronto usa o pronto. */
export const resolverSelecao = (s: SelecaoCategoria): { nome: string; icone: string | null } => {
  if (s.selecao === OUTRA_CATEGORIA) {
    const texto = s.texto.trim()
    const padrao = acharCategoriaPadrao(texto)
    return padrao ? { nome: padrao.nome, icone: padrao.icone } : { nome: texto, icone: null }
  }
  const padrao = acharCategoriaPadrao(s.selecao)
  return { nome: padrao?.nome ?? s.selecao, icone: padrao?.icone ?? null }
}

/** Mensagem de erro, ou null se estiver tudo certo. `jaUsadas` = nomes que o restaurante já tem. */
export const validarSelecao = (s: SelecaoCategoria, jaUsadas: string[]): string | null => {
  if (!s.selecao) return 'Escolha uma categoria.'
  if (s.selecao === OUTRA_CATEGORIA) {
    const texto = s.texto.trim()
    if (!texto) return 'Digite o nome da categoria.'
    if (texto.length > 100) return 'Use no máximo 100 caracteres.'
  }
  const { nome } = resolverSelecao(s)
  if (jaUsadas.some((n) => chaveDeNome(n) === chaveDeNome(nome))) {
    return 'Você já tem uma categoria com esse nome.'
  }
  return null
}
