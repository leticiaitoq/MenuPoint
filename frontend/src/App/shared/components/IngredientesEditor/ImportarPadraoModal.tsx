import React, { useEffect, useMemo, useRef, useState } from 'react';
import { HiCheck, HiX } from 'react-icons/hi';
import AdicionalCategoriaService, { AdicionalCategoria } from '../../../services/adicionalCategoria.service';
import './ImportarPadraoModal.css';

/**
 * Modal para trazer os ingredientes/adicionais PADRÃO da categoria para o produto.
 * O restaurante escolhe o que importar (ou usa "Importar todos").
 * O que já está no produto (mesmo nome) aparece marcado e não pode ser importado de novo.
 */

interface ImportarPadraoModalProps {
  aberto: boolean;
  categoriaId: string;
  categoriaNome?: string;
  /** Nomes que o produto já tem (para não importar duas vezes) */
  nomesNoProduto: string[];
  /** Recebe só o que foi escolhido */
  onImportar: (escolhidos: AdicionalCategoria[]) => void;
  onFechar: () => void;
}

const formatarPreco = (valor: number) => `R$ ${valor.toFixed(2).replace('.', ',')}`;

const descricao = (a: AdicionalCategoria): string => {
  if (a.quantidade_inclusa > 0) {
    const partes = [`Vem ${a.quantidade_inclusa}`];
    if (a.quantidade_maxima > a.quantidade_inclusa) {
      partes.push(`até ${a.quantidade_maxima}`, `extra ${formatarPreco(a.preco)}`);
    }
    if (a.fixo) partes.push('fixo');
    return partes.join(' · ');
  }
  return `Até ${a.quantidade_maxima} · ${formatarPreco(a.preco)} cada`;
};

const ImportarPadraoModal: React.FC<ImportarPadraoModalProps> = ({
  aberto, categoriaId, categoriaNome, nomesNoProduto, onImportar, onFechar,
}) => {
  const [itens, setItens] = useState<AdicionalCategoria[]>([]);
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState('');
  const [marcados, setMarcados] = useState<Set<string>>(new Set());
  const cancelarRef = useRef<HTMLButtonElement>(null);

  // Cada vez que abre, busca a lista atual da categoria e limpa a seleção
  useEffect(() => {
    if (!aberto) return;
    let cancelado = false;
    setMarcados(new Set());
    setErro('');
    setCarregando(true);
    AdicionalCategoriaService.listar(categoriaId)
      .then((lista) => { if (!cancelado) setItens(lista.filter((a) => a.ativo)); })
      .catch(() => { if (!cancelado) setErro('Não foi possível carregar os ingredientes da categoria.'); })
      .finally(() => { if (!cancelado) setCarregando(false); });
    return () => { cancelado = true; };
  }, [aberto, categoriaId]);

  // Esc fecha; foco começa em "Cancelar"
  useEffect(() => {
    if (!aberto) return;
    cancelarRef.current?.focus();
    const aoTeclar = (e: KeyboardEvent) => { if (e.key === 'Escape') onFechar(); };
    document.addEventListener('keydown', aoTeclar);
    return () => document.removeEventListener('keydown', aoTeclar);
  }, [aberto, onFechar]);

  const jaTem = useMemo(
    () => new Set(nomesNoProduto.map((n) => n.trim().toLowerCase())),
    [nomesNoProduto]
  );
  const estaNoProduto = (a: AdicionalCategoria) => jaTem.has(a.nome.trim().toLowerCase());

  const importaveis = itens.filter((a) => !estaNoProduto(a));
  const todosMarcados = importaveis.length > 0 && importaveis.every((a) => marcados.has(a.id));

  const alternar = (id: string) =>
    setMarcados((atual) => {
      const novo = new Set(atual);
      if (novo.has(id)) novo.delete(id); else novo.add(id);
      return novo;
    });

  const alternarTodos = () =>
    setMarcados(todosMarcados ? new Set() : new Set(importaveis.map((a) => a.id)));

  if (!aberto) return null;

  const escolhidos = importaveis.filter((a) => marcados.has(a.id));
  const inclusos = itens.filter((a) => a.quantidade_inclusa > 0);
  const adicionais = itens.filter((a) => a.quantidade_inclusa === 0);

  const renderItem = (a: AdicionalCategoria) => {
    const ja = estaNoProduto(a);
    return (
      <li key={a.id}>
        <label className={`impmodal__item${ja ? ' impmodal__item--ja' : ''}`}>
          <input
            type="checkbox"
            checked={ja || marcados.has(a.id)}
            disabled={ja}
            onChange={() => alternar(a.id)}
          />
          <span className="impmodal__item-texto">
            <strong>{a.nome}</strong>
            <span>{ja ? 'Já está no produto' : descricao(a)}</span>
          </span>
          {ja && <HiCheck className="impmodal__item-ok" aria-hidden="true" />}
        </label>
      </li>
    );
  };

  return (
    <div className="impmodal__overlay" onClick={onFechar}>
      <div
        className="impmodal__dialogo"
        role="dialog"
        aria-modal="true"
        aria-labelledby="impmodal-titulo"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="impmodal__topo">
          <div>
            <h3 id="impmodal-titulo" className="impmodal__titulo">Importar da categoria</h3>
            <p className="impmodal__sub">
              {categoriaNome ? `${categoriaNome}: ` : ''}escolha o que entra neste produto.
            </p>
          </div>
          <button type="button" className="impmodal__fechar" onClick={onFechar} aria-label="Fechar">
            <HiX />
          </button>
        </div>

        {carregando && <p className="impmodal__aviso">Carregando ingredientes...</p>}
        {erro && <p className="impmodal__aviso impmodal__aviso--erro" role="alert">{erro}</p>}

        {!carregando && !erro && itens.length === 0 && (
          <p className="impmodal__aviso">
            Esta categoria ainda não tem ingredientes padrão (cadastre em Produtos → Categorias).
          </p>
        )}

        {!carregando && !erro && itens.length > 0 && (
          <>
            <label className="impmodal__todos">
              <input
                type="checkbox"
                checked={todosMarcados}
                disabled={importaveis.length === 0}
                onChange={alternarTodos}
              />
              <span>
                {importaveis.length === 0
                  ? 'Tudo desta categoria já está no produto'
                  : `Selecionar todos (${importaveis.length})`}
              </span>
            </label>

            <div className="impmodal__lista-area">
              {inclusos.length > 0 && (
                <section>
                  <h4 className="impmodal__secao">O que já vem no produto</h4>
                  <ul className="impmodal__lista">{inclusos.map(renderItem)}</ul>
                </section>
              )}
              {adicionais.length > 0 && (
                <section>
                  <h4 className="impmodal__secao">Adicionais</h4>
                  <ul className="impmodal__lista">{adicionais.map(renderItem)}</ul>
                </section>
              )}
            </div>
          </>
        )}

        <div className="impmodal__acoes">
          <button ref={cancelarRef} type="button" className="impmodal__btn" onClick={onFechar}>
            Cancelar
          </button>
          <button
            type="button"
            className="impmodal__btn impmodal__btn--sec"
            onClick={() => onImportar(escolhidos)}
            disabled={escolhidos.length === 0}
          >
            Importar selecionados{escolhidos.length > 0 ? ` (${escolhidos.length})` : ''}
          </button>
          <button
            type="button"
            className="impmodal__btn impmodal__btn--primario"
            onClick={() => onImportar(importaveis)}
            disabled={importaveis.length === 0}
          >
            Importar todos{importaveis.length > 0 ? ` (${importaveis.length})` : ''}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ImportarPadraoModal;
