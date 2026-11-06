import React from 'react';
import { HiLockClosed, HiLockOpen, HiPlus, HiX } from 'react-icons/hi';
import type { Produto, IngredienteCadastro } from '../../../services/produto.service';
import type { AdicionalCategoria } from '../../../services/adicionalCategoria.service';
import QuantidadeStepper from '../QuantidadeStepper/QuantidadeStepper';
import './IngredientesEditor.css';

/**
 * Cadastro dos ingredientes de um produto, em duas listas:
 *  1) "O que já vem no produto": tudo o que faz parte do item (pão, carne, queijo...).
 *     O cliente pode retirar (sem desconto), a menos que o ingrediente seja FIXO.
 *  2) "Adicionais": extras que NÃO vêm no produto; só são cobrados se o cliente acrescentar.
 *
 * No banco continua sendo uma lista só: quantidade_inclusa >= 1 = "já vem", 0 = adicional.
 * O cliente paga o preço do extra apenas pelas unidades ACIMA do que já vem.
 */

export type TipoIngrediente = 'incluso' | 'adicional';

// Linha do formulário
export interface LinhaIngrediente {
  chave: string;               // identifica a linha na tela (não vai para a API)
  id?: string;                 // id real, quando o ingrediente já existe no banco
  tipo: TipoIngrediente;
  nome: string;
  quantidadeInclusa: number;   // "já vem": 1 a 20 · adicional: sempre 0
  quantidadeMaxima: number;    // quanto o cliente pode pedir no total
  precoExtra: string;          // "4,50"
  fixo: boolean;               // o cliente não pode retirar
}

const MAX_UNIDADES = 20;
const MAX_INGREDIENTES = 50;

let contador = 0;
const novaChave = () => `ing-${Date.now()}-${contador++}`;

export const linhaVazia = (tipo: TipoIngrediente = 'incluso'): LinhaIngrediente => ({
  chave: novaChave(),
  tipo,
  nome: '',
  quantidadeInclusa: tipo === 'incluso' ? 1 : 0,
  quantidadeMaxima: tipo === 'incluso' ? 1 : 1,
  precoExtra: '',
  fixo: false,
});

const formatarPrecoCampo = (valor: number) => Number(valor ?? 0).toFixed(2).replace('.', ',');

/** Carrega os ingredientes já cadastrados no produto (grupo "Ingredientes") para editar. */
export const linhasDoProduto = (produto: Produto): LinhaIngrediente[] =>
  (produto.grupos_adicionais ?? [])
    .filter((g) => g.nome === 'Ingredientes')
    .flatMap((g) => g.adicionais ?? [])
    .filter((a) => a.disponivel !== false)
    .map((a) => {
      const inclusa = Math.max(0, a.quantidade_inclusa ?? 0);
      return {
        chave: novaChave(),
        id: a.id,
        tipo: inclusa > 0 ? 'incluso' : 'adicional',
        nome: a.nome,
        quantidadeInclusa: inclusa,
        quantidadeMaxima: Math.max(inclusa, a.quantidade_maxima ?? 1, 1),
        precoExtra: formatarPrecoCampo(a.preco_extra),
        fixo: !!a.fixo && inclusa > 0,
      };
    });

/** Transforma os ingredientes padrão da categoria em linhas do formulário (só os ativos). */
export const linhasDaCategoria = (lista: AdicionalCategoria[]): LinhaIngrediente[] =>
  lista
    .filter((a) => a.ativo)
    .map((a) => ({
      chave: novaChave(),
      tipo: a.quantidade_inclusa > 0 ? ('incluso' as const) : ('adicional' as const),
      nome: a.nome,
      quantidadeInclusa: a.quantidade_inclusa,
      quantidadeMaxima: Math.max(a.quantidade_inclusa, a.quantidade_maxima, 1),
      precoExtra: formatarPrecoCampo(a.preco),
      fixo: !!a.fixo && a.quantidade_inclusa > 0,
    }));

/** Junta as linhas novas às atuais, sem repetir nomes (ignora maiúsculas/minúsculas). */
export const mesclarLinhas = (
  atuais: LinhaIngrediente[],
  novas: LinhaIngrediente[]
): { linhas: LinhaIngrediente[]; adicionadas: number } => {
  const nomes = new Set(atuais.map((l) => l.nome.trim().toLowerCase()));
  const faltando = novas.filter((l) => !nomes.has(l.nome.trim().toLowerCase()));
  return { linhas: [...atuais, ...faltando], adicionadas: faltando.length };
};

const paraNumero = (texto: string) => Number(texto.replace(/[^\d,]/g, '').replace(',', '.') || 0);

/** Valida as linhas e monta o que a API espera. Devolve a mensagem do primeiro problema. */
export const linhasParaPayload = (
  linhas: LinhaIngrediente[]
): { ok: true; lista: IngredienteCadastro[] } | { ok: false; erro: string } => {
  const lista: IngredienteCadastro[] = [];
  const nomes = new Set<string>();

  for (const [idx, l] of linhas.entries()) {
    const nome = l.nome.trim();

    if (!nome) return { ok: false, erro: 'Preencha o nome de todos os ingredientes ou remova a linha em branco.' };
    if (nomes.has(nome.toLowerCase())) return { ok: false, erro: `"${nome}" está repetido na lista.` };
    nomes.add(nome.toLowerCase());

    const inclusa = l.tipo === 'incluso' ? l.quantidadeInclusa : 0;
    const maxima = l.quantidadeMaxima;
    const fixo = l.tipo === 'incluso' && l.fixo;

    if (l.tipo === 'incluso' && (inclusa < 1 || inclusa > MAX_UNIDADES))
      return { ok: false, erro: `"${nome}": a quantidade que vem no produto deve ser de 1 a ${MAX_UNIDADES}.` };
    if (maxima < Math.max(1, inclusa) || maxima > MAX_UNIDADES)
      return { ok: false, erro: `"${nome}": o limite que o cliente pode pedir deve estar entre ${Math.max(1, inclusa)} e ${MAX_UNIDADES}.` };

    // Só existe extra a cobrar quando o cliente pode pedir mais do que já vem
    const temExtra = maxima > inclusa;
    let preco = 0;
    if (temExtra) {
      if (!l.precoExtra.trim())
        return { ok: false, erro: `"${nome}": informe o preço de cada extra (use 0 se for grátis).` };
      preco = paraNumero(l.precoExtra);
      if (!(preco >= 0) || preco > 999999.99) return { ok: false, erro: `"${nome}": preço inválido.` };
    }

    lista.push({
      ...(l.id ? { id: l.id } : {}),
      nome,
      preco_extra: preco,
      quantidade_inclusa: inclusa,
      quantidade_maxima: maxima,
      fixo,
      disponivel: true,
      ordem: idx,
    });
  }
  return { ok: true, lista };
};

interface IngredientesEditorProps {
  linhas: LinhaIngrediente[];
  onChange: (linhas: LinhaIngrediente[]) => void;
  disabled?: boolean;
  /** Se informado, mostra o botão que traz os ingredientes padrão da categoria do produto */
  onImportar?: () => void;
  importando?: boolean;
  /** Aviso curto (ex.: "3 ingredientes importados") */
  mensagem?: string;
  /** Erro de validação, mostrado aqui mesmo para o usuário ver o que corrigir */
  erro?: string;
}

const IngredientesEditor: React.FC<IngredientesEditorProps> = ({
  linhas, onChange, disabled, onImportar, importando, mensagem, erro,
}) => {
  const alterar = (chave: string, campo: Partial<LinhaIngrediente>) =>
    onChange(linhas.map((l) => (l.chave === chave ? { ...l, ...campo } : l)));

  const remover = (chave: string) => onChange(linhas.filter((l) => l.chave !== chave));

  const adicionar = (tipo: TipoIngrediente) => onChange([...linhas, linhaVazia(tipo)]);

  const incluidos = linhas.filter((l) => l.tipo === 'incluso');
  const adicionais = linhas.filter((l) => l.tipo === 'adicional');
  const cheio = linhas.length >= MAX_INGREDIENTES;

  // "Quantidade que vem" sobe o limite junto, para nunca ficar maior que o máximo
  const mudarInclusa = (l: LinhaIngrediente, valor: number) =>
    alterar(l.chave, { quantidadeInclusa: valor, quantidadeMaxima: Math.max(l.quantidadeMaxima, valor) });

  const campoPreco = (l: LinhaIngrediente, semExtra: boolean) => (
    <div className="ing__campo">
      <span className="ing__rotulo">{l.tipo === 'incluso' ? 'Preço de cada extra' : 'Preço de cada um'}</span>
      <div className="ing__preco">
        <span className="ing__preco-prefixo" aria-hidden="true">R$</span>
        <input
          className="ing__input ing__input--preco"
          type="text"
          inputMode="decimal"
          placeholder={semExtra ? '—' : '0,00'}
          value={semExtra ? '' : l.precoExtra}
          disabled={disabled || semExtra}
          // aceita ponto ou vírgula como separador decimal
          onChange={(e) => alterar(l.chave, { precoExtra: e.target.value.replace('.', ',').replace(/[^\d,]/g, '').slice(0, 9) })}
          aria-label="Preço de cada unidade extra"
        />
      </div>
      {semExtra && <span className="ing__nota">Aumente o limite para cobrar extras</span>}
    </div>
  );

  const renderIncluso = (l: LinhaIngrediente) => (
    <div key={l.chave} className="ing__linha">
      <button type="button" className="ing__remover" onClick={() => remover(l.chave)} disabled={disabled} aria-label={`Remover ${l.nome || 'ingrediente'}`}>
        <HiX />
      </button>

      <div className="ing__campo ing__campo--nome">
        <span className="ing__rotulo">Ingrediente</span>
        <input
          className="ing__input"
          type="text"
          placeholder="Ex.: Pão"
          maxLength={100}
          value={l.nome}
          disabled={disabled}
          onChange={(e) => alterar(l.chave, { nome: e.target.value })}
          aria-label="Nome do ingrediente"
        />
      </div>

      <div className="ing__campo">
        <span className="ing__rotulo">Quantidade que vem</span>
        <QuantidadeStepper valor={l.quantidadeInclusa} min={1} max={MAX_UNIDADES} onChange={(v) => mudarInclusa(l, v)} disabled={disabled} rotulo={l.nome || 'ingrediente'} tamanho="sm" />
      </div>

      <div className="ing__campo">
        <span className="ing__rotulo">Cliente pode pedir até</span>
        <QuantidadeStepper valor={l.quantidadeMaxima} min={l.quantidadeInclusa} max={MAX_UNIDADES} onChange={(v) => alterar(l.chave, { quantidadeMaxima: v })} disabled={disabled} rotulo={`limite de ${l.nome || 'ingrediente'}`} tamanho="sm" />
      </div>

      {campoPreco(l, l.quantidadeMaxima <= l.quantidadeInclusa)}

      <button
        type="button"
        className={`ing__fixo${l.fixo ? ' ing__fixo--ativo' : ''}`}
        onClick={() => alterar(l.chave, { fixo: !l.fixo })}
        disabled={disabled}
        aria-pressed={l.fixo}
        title="Fixo: o cliente vê este ingrediente mas não pode retirá-lo"
      >
        {l.fixo ? <HiLockClosed aria-hidden="true" /> : <HiLockOpen aria-hidden="true" />}
        {l.fixo ? 'Fixo: não pode retirar' : 'Cliente pode retirar'}
      </button>
    </div>
  );

  const renderAdicional = (l: LinhaIngrediente) => (
    <div key={l.chave} className="ing__linha">
      <button type="button" className="ing__remover" onClick={() => remover(l.chave)} disabled={disabled} aria-label={`Remover ${l.nome || 'adicional'}`}>
        <HiX />
      </button>

      <div className="ing__campo ing__campo--nome">
        <span className="ing__rotulo">Adicional</span>
        <input
          className="ing__input"
          type="text"
          placeholder="Ex.: Bacon"
          maxLength={100}
          value={l.nome}
          disabled={disabled}
          onChange={(e) => alterar(l.chave, { nome: e.target.value })}
          aria-label="Nome do adicional"
        />
      </div>

      <div className="ing__campo">
        <span className="ing__rotulo">Cliente pode pedir até</span>
        <QuantidadeStepper valor={l.quantidadeMaxima} min={1} max={MAX_UNIDADES} onChange={(v) => alterar(l.chave, { quantidadeMaxima: v })} disabled={disabled} rotulo={`limite de ${l.nome || 'adicional'}`} tamanho="sm" />
      </div>

      {campoPreco(l, false)}
    </div>
  );

  return (
    <div className="ing">
      <div className="ing__cabecalho">
        <div>
          <h3 className="ing__titulo">Ingredientes e adicionais</h3>
          <p className="ing__intro">Liste tudo o que já vem neste produto e os adicionais que o cliente pode acrescentar.</p>
        </div>
        {onImportar && (
          <button type="button" className="ing__importar" onClick={onImportar} disabled={disabled || importando}>
            {importando ? 'Importando…' : 'Importar padrão da categoria'}
          </button>
        )}
      </div>

      {mensagem && <p className="ing__mensagem" role="status">{mensagem}</p>}

      {/* 1) O que já vem no produto */}
      <section className="ing__secao">
        <div className="ing__secao-topo">
          <div>
            <h4 className="ing__secao-titulo">O que já vem no produto</h4>
            <p className="ing__secao-texto">
              Todos os ingredientes que fazem parte do item. Já estão no preço: o cliente pode retirar (sem desconto) e só paga extra se pedir mais.
            </p>
          </div>
        </div>

        {incluidos.length === 0 ? (
          <p className="ing__vazio">Nenhum ingrediente ainda. Adicione o que já vem neste produto.</p>
        ) : (
          <div className="ing__lista">{incluidos.map(renderIncluso)}</div>
        )}

        <button type="button" className="ing__adicionar" onClick={() => adicionar('incluso')} disabled={disabled || cheio}>
          <HiPlus aria-hidden="true" /> Ingrediente que já vem
        </button>
      </section>

      {/* 2) Adicionais */}
      <section className="ing__secao">
        <div className="ing__secao-topo">
          <div>
            <h4 className="ing__secao-titulo">Adicionais</h4>
            <p className="ing__secao-texto">
              Itens extras que não vêm no produto. O cliente só leva se quiser e paga o valor de cada um.
            </p>
          </div>
        </div>

        {adicionais.length === 0 ? (
          <p className="ing__vazio">Nenhum adicional ainda.</p>
        ) : (
          <div className="ing__lista">{adicionais.map(renderAdicional)}</div>
        )}

        <button type="button" className="ing__adicionar" onClick={() => adicionar('adicional')} disabled={disabled || cheio}>
          <HiPlus aria-hidden="true" /> Adicional
        </button>
      </section>

      {erro && <p className="ing__erro" role="alert">{erro}</p>}
    </div>
  );
};

export default IngredientesEditor;
