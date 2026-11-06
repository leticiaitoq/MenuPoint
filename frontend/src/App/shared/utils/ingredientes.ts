/**
 * Ingredientes e adicionais de um produto, no estilo "totem":
 *  - quantidadeInclusa: unidades que JÁ vêm no produto (sem custo). 0 = é um adicional.
 *  - quantidadeMaxima: o máximo que o cliente pode pedir.
 *  - O cliente paga precoExtra só pelas unidades ACIMA da inclusa. Tirar não desconta.
 *
 * O servidor refaz esta conta com os dados do banco: o que a tela mostra é só uma prévia.
 */

import type { GrupoAdicional } from '../../services/categoria.service';

export interface IngredienteProduto {
  id: string;
  nome: string;
  precoExtra: number;
  quantidadeInclusa: number;
  quantidadeMaxima: number;
  /** Fixo: aparece, mas o cliente não pode retirar (nunca fica abaixo da quantidade inclusa) */
  fixo: boolean;
}

/** Junta os ingredientes de todos os grupos do produto (só os disponíveis), na ordem do cadastro. */
export const extrairIngredientes = (grupos?: GrupoAdicional[] | null): IngredienteProduto[] =>
  (grupos ?? []).flatMap((g) =>
    (g.adicionais ?? [])
      .filter((a) => a.disponivel !== false)
      .map((a) => {
        const inclusa = Math.max(0, Number(a.quantidade_inclusa ?? 0));
        return {
          id: a.id,
          nome: a.nome,
          precoExtra: Number(a.preco_extra ?? 0),
          quantidadeInclusa: inclusa,
          quantidadeMaxima: Math.max(inclusa, 1, Number(a.quantidade_maxima ?? 1)),
          fixo: !!a.fixo && inclusa > 0,
        };
      })
  );

/** Menor quantidade que o cliente pode escolher: ingrediente fixo nunca desce da inclusa. */
export const quantidadeMinima = (ing: IngredienteProduto): number =>
  ing.fixo ? ing.quantidadeInclusa : 0;

/** Quanto o cliente paga a mais pela quantidade escolhida (nunca negativo). */
export const custoExtraIngrediente = (ing: IngredienteProduto, quantidade: number): number =>
  Math.max(0, quantidade - ing.quantidadeInclusa) * ing.precoExtra;

export const formatarPreco = (valor: number): string => `R$${valor.toFixed(2).replace('.', ',')}`;
