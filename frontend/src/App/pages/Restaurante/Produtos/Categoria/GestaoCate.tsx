import React, { useEffect, useRef, useState } from 'react';
import { HiPencil, HiTrash, HiPlus, HiX, HiPuzzle, HiChevronDown, HiChevronUp, HiChevronRight, HiLockClosed} from 'react-icons/hi';
import { MdDragIndicator } from 'react-icons/md';
import RestaurantLayout from '../../../../shared/components/layout/Restaurantelayout';
import {
  DndContext, closestCenter, PointerSensor,
  useSensor, useSensors, DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext, verticalListSortingStrategy,
  useSortable, arrayMove,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import CategoriaService, { Categoria } from '../../../../services/categoria.service';
import ProdutoService from '../../../../services/produto.service';
import AdicionalCategoriaService, { AdicionalCategoria } from '../../../../services/adicionalCategoria.service';
import ModalAlerta from '../../../../shared/components/ModalAlerta/ModalAlerta';
import QuantidadeStepper from '../../../../shared/components/QuantidadeStepper/QuantidadeStepper';
import SeletorCategoria from '../../../../shared/components/SeletorCategoria/SeletorCategoria';
import ContadorCaracteres from '../../../../shared/components/ContadorCaracteres/ContadorCaracteres';
import {
  SELECAO_VAZIA, SelecaoCategoria,
  chaveDeNome, resolverSelecao, selecaoDeNome, validarSelecao,
} from '../../../../shared/constants/categoriasPadrao';
import './GestaoCate.css';

// ── Tipos
interface CategoriaComContagem extends Categoria {
  produtos: number;
  /** Produtos da categoria que estão indisponíveis (candidatos a reativar junto) */
  produtosIndisponiveis: number;
}

interface FormCategoria {
  /** Categoria pronta escolhida na lista, ou "Outra" + texto digitado */
  nome: SelecaoCategoria;
  descricao: string;
  ativo: boolean;
}

const FORM_VAZIO: FormCategoria = { nome: SELECAO_VAZIA, descricao: '', ativo: true };

// Formulário do adicional (a categoria vem do contexto: o cadastro já nasce dentro dela)
interface FormAdicional {
  nome: string;
  /** "incluso" = já vem no produto · "adicional" = só entra se o cliente pedir */
  tipo: 'incluso' | 'adicional';
  /** Preço do extra em centavos; null enquanto o campo está vazio */
  precoCentavos: number | null;
  descricao: string;
  ativo: boolean;
  /** Quantas unidades já vêm no produto (1 a 20; só vale para tipo "incluso") */
  quantidadeInclusa: number;
  /** O máximo que o cliente pode pedir no total */
  quantidadeMaxima: number;
  /** Fixo: o cliente vê, mas não pode retirar */
  fixo: boolean;
}

const FORM_ADICIONAL_VAZIO: FormAdicional = {
  nome: '', tipo: 'incluso', precoCentavos: null, descricao: '', ativo: true,
  quantidadeInclusa: 1, quantidadeMaxima: 1, fixo: false,
};

const PRECO_MAX_CENTAVOS = 99_999_999; // R$ 999.999,99 (limite do banco: decimal 8,2)

const formatarReais = (centavos: number): string =>
  (centavos / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

const extrairErro = (err: any, padrao: string): string =>
  err?.response?.data?.message ?? err?.message ?? padrao;

interface LinhaProps {
  categoria: CategoriaComContagem;
  qtdAdicionais: number;
  selecionada: boolean;
  onSelecionar: (categoria: CategoriaComContagem) => void;
  onEditar: (categoria: CategoriaComContagem) => void;
  onDeletar: (categoria: CategoriaComContagem) => void;
  onRegistrarAdicional: (categoria: CategoriaComContagem) => void;
}

const LinhaCategoria: React.FC<LinhaProps> = ({
  categoria, qtdAdicionais, selecionada,
  onSelecionar, onEditar, onDeletar, onRegistrarAdicional,
}) => {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: categoria.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  // Cliques nos botões da linha não podem abrir/fechar a aba de adicionais
  const parar = (e: React.SyntheticEvent) => e.stopPropagation();

  return (
    <tr
      ref={setNodeRef}
      style={style}
      className={`cate__linha ${selecionada ? 'cate__linha--selecionada' : ''} ${isDragging ? 'cate__linha--arrastando' : ''}`}
      onClick={() => onSelecionar(categoria)}
      onKeyDown={(e) => {
        if (e.target === e.currentTarget && (e.key === 'Enter' || e.key === ' ')) {
          e.preventDefault();
          onSelecionar(categoria);
        }
      }}
      tabIndex={0}
      aria-expanded={selecionada}
      title={selecionada ? 'Ocultar adicionais' : 'Ver adicionais desta categoria'}
    >
      <td className="cate__td-ordem" onClick={parar}>
        <MdDragIndicator className="cate__drag-icon" {...attributes} {...listeners} />
        {categoria.ordem}
      </td>
      <td className="cate__td-nome">
        <span className="cate__icone" aria-hidden="true">{categoria.icone ?? '🍽️'}</span>
        {categoria.nome}
      </td>
      <td className="cate__td-produtos">
        {categoria.produtos}
        <span className="cate__so-mobile"> {categoria.produtos === 1 ? 'produto' : 'produtos'}</span>
      </td>
      <td className="cate__td-status">
        <span className={`cate__badge ${categoria.ativo ? 'cate__badge--ativo' : 'cate__badge--inativo'}`}>
          {categoria.ativo ? 'Ativa' : 'Oculta'}
        </span>
      </td>
      <td className="cate__td-acoes" onClick={parar}>
        <button className="cate__btn-acao" onClick={() => onEditar(categoria)} aria-label="Editar">
          <HiPencil />
        </button>
        <button className="cate__btn-acao cate__btn-acao--deletar" onClick={() => onDeletar(categoria)} aria-label="Deletar">
          <HiTrash />
        </button>
        <button
          className="cate__btn-adicional"
          onClick={() => onRegistrarAdicional(categoria)}
          title={`Ingredientes e adicionais de ${categoria.nome}`}
        >
          <HiPuzzle aria-hidden="true" />
          <span className="cate__btn-adicional-texto">Ingredientes e adicionais</span>
        </button>
        <button
          className="cate__btn-expandir"
          onClick={() => onSelecionar(categoria)}
          aria-label={selecionada ? 'Ocultar adicionais' : `Ver adicionais (${qtdAdicionais})`}
          title={selecionada ? 'Ocultar adicionais' : `Ver adicionais (${qtdAdicionais})`}
        >
          <span className="cate__so-desktop">{selecionada ? <HiChevronUp /> : <HiChevronDown />}</span>
          <span className="cate__so-mobile"><HiChevronRight /></span>
          <span className="cate__so-mobile">Adicionais</span>
          <span className="cate__contador-adicionais">{qtdAdicionais}</span>
        </button>
      </td>
    </tr>
  );
};

const GestaoCate: React.FC = () => {

  const [categorias, setCategorias]           = useState<CategoriaComContagem[]>([]);
  const [carregando, setCarregando]           = useState(true);
  const [modalNovo, setModalNovo]             = useState(false);
  const [modalEditar, setModalEditar]         = useState<CategoriaComContagem | null>(null);
  const [form, setForm]                       = useState<FormCategoria>(FORM_VAZIO);
  const [erro, setErro]                       = useState('');
  const [erroModal, setErroModal]             = useState('');
  const [salvando, setSalvando]               = useState(false);
  // Confirmação de desativação (avisa quando há produtos ligados à categoria)
  const [confirmacao, setConfirmacao]         = useState<{
    tipo: 'desativar' | 'reativar';
    categoria: CategoriaComContagem;
    /** Para 'reativar', recebe true quando o usuário quer reativar os produtos junto */
    aoConfirmar: (reativarProdutos?: boolean) => Promise<void>;
  } | null>(null);
  const [confirmando, setConfirmando]         = useState(false);

  // ── Adicionais da categoria
  const [qtdAdicionais, setQtdAdicionais]     = useState<Record<string, number>>({});
  const [categoriaAberta, setCategoriaAberta] = useState<string | null>(null);
  const [adicionais, setAdicionais]           = useState<AdicionalCategoria[]>([]);
  // Categoria a que a lista `adicionais` pertence (evita mostrar a lista antiga/vazia ao trocar de aba)
  const [adicionaisDe, setAdicionaisDe]       = useState<string | null>(null);
  const [carregandoAdic, setCarregandoAdic]   = useState(false);
  const [erroAdicionais, setErroAdicionais]   = useState('');
  // Modal de cadastro/edição: sempre dentro de uma categoria (não há seletor de categoria)
  const [modalAdicional, setModalAdicional]   = useState<{
    categoria: CategoriaComContagem;
    editando: AdicionalCategoria | null;
  } | null>(null);
  const [formAdic, setFormAdic]               = useState<FormAdicional>(FORM_ADICIONAL_VAZIO);
  const [erroModalAdic, setErroModalAdic]     = useState('');
  const [salvandoAdic, setSalvandoAdic]       = useState(false);
  const [adicParaExcluir, setAdicParaExcluir] = useState<AdicionalCategoria | null>(null);
  const [excluindoAdic, setExcluindoAdic]     = useState(false);
  const painelAdicionaisRef                   = useRef<HTMLDivElement>(null);

  const atualizarForm = (campo: Partial<FormCategoria>) =>
    setForm((prev) => ({ ...prev, ...campo }));

  // Nomes que o restaurante já tem: as prontas repetidas ficam desabilitadas na lista
  const nomesJaUsados = categorias
    .filter((c) => c.id !== modalEditar?.id)
    .map((c) => c.nome);

  // ── Carrega categorias reais + conta produtos de cada uma
  const carregar = async () => {
    setCarregando(true);
    setErro('');
    try {
      const [listaCategorias, listaProdutos] = await Promise.all([
        CategoriaService.listar(),
        ProdutoService.listar(),
      ]);

      const comContagem: CategoriaComContagem[] = listaCategorias
        .slice()
        .sort((a, b) => a.ordem - b.ordem)
        .map((c) => ({
          ...c,
          produtos: listaProdutos.filter((p) => p.categoria_id === c.id).length,
          produtosIndisponiveis: listaProdutos.filter((p) => p.categoria_id === c.id && !p.disponivel).length,
        }));

      setCategorias(comContagem);
    } catch (err: any) {
      setErro(extrairErro(err, 'Não foi possível carregar as categorias.'));
    } finally {
      setCarregando(false);
    }
  };

  useEffect(() => { carregar(); }, []);

  // ── Adicionais: contadores da tabela + lista da categoria aberta
  const carregarContagens = async () => {
    try {
      setQtdAdicionais(await AdicionalCategoriaService.contarPorCategoria());
    } catch {
      setQtdAdicionais({});
    }
  };

  const carregarAdicionais = async (categoriaId: string) => {
    setCarregandoAdic(true);
    setErroAdicionais('');
    try {
      setAdicionais(await AdicionalCategoriaService.listar(categoriaId));
    } catch (err: any) {
      setAdicionais([]);
      setErroAdicionais(extrairErro(err, 'Não foi possível carregar os adicionais.'));
    } finally {
      setAdicionaisDe(categoriaId);
      setCarregandoAdic(false);
    }
  };

  useEffect(() => { carregarContagens(); }, []);

  useEffect(() => {
    if (!categoriaAberta) { setAdicionais([]); setAdicionaisDe(null); return; }
    carregarAdicionais(categoriaAberta);
    if (!window.matchMedia('(max-width: 600px)').matches) painelAdicionaisRef.current?.scrollIntoView?.({ behavior: 'smooth', block: 'nearest' });
  }, [categoriaAberta]);

  // Esc fecha a aba de adicionais
  useEffect(() => {
    if (!categoriaAberta) return;
    const aoTeclar = (e: KeyboardEvent) => { if (e.key === 'Escape') setCategoriaAberta(null); };
    window.addEventListener('keydown', aoTeclar);
    return () => window.removeEventListener('keydown', aoTeclar);
  }, [categoriaAberta]);

  // Se a categoria aberta sumir da lista (ex.: foi desativada), fecha a aba
  useEffect(() => {
    if (categoriaAberta && !carregando && !categorias.some((c) => c.id === categoriaAberta)) {
      setCategoriaAberta(null);
    }
  }, [categorias, carregando, categoriaAberta]);

  const categoriaDaAba = categorias.find((c) => c.id === categoriaAberta) ?? null;

  const alternarCategoriaAberta = (categoria: CategoriaComContagem) =>
    setCategoriaAberta((atual) => (atual === categoria.id ? null : categoria.id));

  const atualizarFormAdic = (campo: Partial<FormAdicional>) =>
    setFormAdic((prev) => ({ ...prev, ...campo }));

  // Máscara de moeda: o usuário digita só números e o valor vai se montando (R$ 0,08 → 0,85 → 8,50)
  const mudarPreco = (texto: string) => {
    const digitos = texto.replace(/\D/g, '').slice(0, 8);
    atualizarFormAdic({ precoCentavos: digitos ? Math.min(parseInt(digitos, 10), PRECO_MAX_CENTAVOS) : null });
  };

  // Troca entre "já vem no produto" e "adicional", ajustando as quantidades para fazerem sentido
  const mudarTipo = (tipo: 'incluso' | 'adicional') =>
    setFormAdic((prev) => ({
      ...prev,
      tipo,
      quantidadeInclusa: tipo === 'incluso' ? Math.max(1, prev.quantidadeInclusa) : 0,
      quantidadeMaxima: Math.max(1, prev.quantidadeMaxima, tipo === 'incluso' ? Math.max(1, prev.quantidadeInclusa) : 0),
      fixo: tipo === 'incluso' ? prev.fixo : false,
    }));

  // "Quantidade que vem" sobe o limite junto, para nunca ficar maior que o máximo
  const mudarInclusa = (valor: number) =>
    setFormAdic((prev) => ({ ...prev, quantidadeInclusa: valor, quantidadeMaxima: Math.max(prev.quantidadeMaxima, valor) }));

  const abrirModalAdicional = (categoria: CategoriaComContagem, editando: AdicionalCategoria | null = null) => {
    setFormAdic(
      editando
        ? {
            nome: editando.nome,
            precoCentavos: Math.round(editando.preco * 100),
            descricao: editando.descricao ?? '',
            ativo: editando.ativo,
            tipo: editando.quantidade_inclusa > 0 ? 'incluso' : 'adicional',
            quantidadeInclusa: editando.quantidade_inclusa,
            quantidadeMaxima: editando.quantidade_maxima,
            fixo: editando.fixo,
          }
        : FORM_ADICIONAL_VAZIO,
    );
    setErroModalAdic('');
    setModalAdicional({ categoria, editando });
  };

  const salvarAdicional = async () => {
    if (!modalAdicional) return;
    const nome = formAdic.nome.trim();
    if (!nome) { setErroModalAdic('Informe o nome do adicional.'); return; }

    const inclusa = formAdic.tipo === 'incluso' ? formAdic.quantidadeInclusa : 0;
    const maxima  = formAdic.quantidadeMaxima;
    // Só existe extra a cobrar quando o cliente pode pedir mais do que já vem
    const temExtra = maxima > inclusa;
    if (temExtra && formAdic.precoCentavos === null) {
      setErroModalAdic('Informe o preço de cada extra (use R$ 0,00 se for grátis).');
      return;
    }

    const { categoria, editando } = modalAdicional;
    const dados = {
      nome,
      preco: temExtra ? (formAdic.precoCentavos ?? 0) / 100 : 0,
      descricao: formAdic.descricao.trim() || null,
      ativo: formAdic.ativo,
      quantidade_inclusa: inclusa,
      quantidade_maxima: maxima,
      fixo: formAdic.tipo === 'incluso' && formAdic.fixo,
    };

    setErroModalAdic('');
    setSalvandoAdic(true);
    try {
      if (editando) await AdicionalCategoriaService.atualizar(editando.id, dados);
      else          await AdicionalCategoriaService.criar(categoria.id, dados);

      setModalAdicional(null);
      await carregarContagens();
      if (categoriaAberta === categoria.id) await carregarAdicionais(categoria.id);
      else setCategoriaAberta(categoria.id); // abre a aba da categoria para mostrar o que foi cadastrado
    } catch (err: any) {
      setErroModalAdic(extrairErro(err, 'Não foi possível salvar o adicional.'));
    } finally {
      setSalvandoAdic(false);
    }
  };

  const excluirAdicional = async () => {
    if (!adicParaExcluir) return;
    setExcluindoAdic(true);
    try {
      await AdicionalCategoriaService.deletar(adicParaExcluir.id);
      setAdicParaExcluir(null);
      await carregarContagens();
      if (categoriaAberta) await carregarAdicionais(categoriaAberta);
    } catch (err: any) {
      setAdicParaExcluir(null);
      setErroAdicionais(extrairErro(err, 'Não foi possível excluir o adicional.'));
    } finally {
      setExcluindoAdic(false);
    }
  };

  // ── Abre modal novo
  const abrirModalNovo = () => {
    setForm(FORM_VAZIO);
    setErroModal('');
    setModalNovo(true);
  };

  // ── Abre modal editar preenchido
  const abrirModalEditar = (categoria: CategoriaComContagem) => {
    setForm({
      nome:      selecaoDeNome(categoria.nome),
      descricao: categoria.descricao ?? '',
      ativo:     categoria.ativo,
    });
    setErroModal('');
    setModalEditar(categoria);
  };

  // ── Salva nova categoria
  const salvarNova = async () => {
    const erroNome = validarSelecao(form.nome, nomesJaUsados);
    if (erroNome) { setErroModal(erroNome); return; }
    const { nome, icone } = resolverSelecao(form.nome);

    setErroModal('');
    setSalvando(true);
    try {
      await CategoriaService.criar({
        nome,
        ...(icone ? { icone } : {}),
        descricao: form.descricao.trim() || undefined,
        ativo: form.ativo,
      });
      setModalNovo(false);
      await carregar();
    } catch (err: any) {
      setErroModal(extrairErro(err, 'Não foi possível criar a categoria.'));
    } finally {
      setSalvando(false);
    }
  };

  // ── Salva edição
  const salvarEdicao = async () => {
    if (!modalEditar) return;
    // Ocultar uma categoria ativa desativa também os produtos: pede confirmação
    if (modalEditar.ativo && !form.ativo) {
      pedirConfirmacaoDesativar(modalEditar, executarSalvarEdicao);
      return;
    }
    // Reativar uma categoria com produtos indisponíveis: pergunta se reativa os produtos junto
    if (!modalEditar.ativo && form.ativo && modalEditar.produtosIndisponiveis > 0) {
      pedirConfirmacaoReativar(modalEditar, executarSalvarEdicao);
      return;
    }
    await executarSalvarEdicao();
  };

  const executarSalvarEdicao = async (reativarProdutos = false) => {
    if (!modalEditar) return;
    const erroNome = validarSelecao(form.nome, nomesJaUsados);
    if (erroNome) { setErroModal(erroNome); return; }
    const { nome, icone } = resolverSelecao(form.nome);

    // Categoria personalizada com o mesmo nome de antes: não mexe no ícone que ela já tem.
    // Trocou para outro nome personalizado: limpa o ícone da categoria pronta anterior.
    const mesmoNome = chaveDeNome(nome) === chaveDeNome(modalEditar.nome);
    const iconeParaSalvar = icone ?? (mesmoNome ? undefined : null);

    setErroModal('');
    setSalvando(true);
    try {
      await CategoriaService.atualizar(modalEditar.id, {
        nome,
        ...(iconeParaSalvar !== undefined ? { icone: iconeParaSalvar } : {}),
        descricao: form.descricao.trim() || undefined,
        ativo: form.ativo,
        ...(!modalEditar.ativo && form.ativo ? { reativar_produtos: reativarProdutos } : {}),
      });
      setModalEditar(null);
      await carregar();
    } catch (err: any) {
      setErroModal(extrairErro(err, 'Não foi possível salvar as alterações.'));
    } finally {
      setSalvando(false);
    }
  };

  // ── Desativa/reativa categoria imediatamente (botão no modal editar)
  const alternarAtivaModal = async () => {
    if (!modalEditar) return;
    if (form.ativo) {
      pedirConfirmacaoDesativar(modalEditar, executarAlternarAtiva);
      return;
    }
    if (modalEditar.produtosIndisponiveis > 0) {
      pedirConfirmacaoReativar(modalEditar, executarAlternarAtiva);
      return;
    }
    await executarAlternarAtiva();
  };

  const executarAlternarAtiva = async (reativarProdutos = false) => {
    if (!modalEditar) return;
    setErroModal('');
    setSalvando(true);
    try {
      if (form.ativo) {
        await CategoriaService.atualizar(modalEditar.id, { ativo: false });
      } else {
        await CategoriaService.reativar(modalEditar.id, reativarProdutos);
      }
      setModalEditar(null);
      await carregar();
    } catch (err: any) {
      setErroModal(extrairErro(err, 'Não foi possível alterar o status da categoria.'));
    } finally {
      setSalvando(false);
    }
  };

  // ── Abre a confirmação de desativação (avisa se há produtos ligados)
  const pedirConfirmacaoDesativar = (
    categoria: CategoriaComContagem,
    aoConfirmar: () => Promise<void>,
  ) => setConfirmacao({ tipo: 'desativar', categoria, aoConfirmar });

  // ── Abre a pergunta "reativar também os produtos?"
  const pedirConfirmacaoReativar = (
    categoria: CategoriaComContagem,
    aoConfirmar: (reativarProdutos?: boolean) => Promise<void>,
  ) => setConfirmacao({ tipo: 'reativar', categoria, aoConfirmar });

  const confirmarDesativacao = async (reativarProdutos?: boolean) => {
    if (!confirmacao) return;
    setConfirmando(true);
    try {
      await confirmacao.aoConfirmar(reativarProdutos);
    } finally {
      setConfirmando(false);
      setConfirmacao(null);
    }
  };

  // ── Deleta (desativa) categoria a partir da linha da tabela
  // O backend desativa também os produtos da categoria.
  const executarDeletar = async (categoria: CategoriaComContagem) => {
    setErro('');
    try {
      await CategoriaService.deletar(categoria.id);
      await carregar();
    } catch (err: any) {
      setErro(extrairErro(err, 'Não foi possível desativar a categoria.'));
    }
  };

  const deletarCategoria = (categoria: CategoriaComContagem) =>
    pedirConfirmacaoDesativar(categoria, () => executarDeletar(categoria));

  // ── Drag and drop — grava a nova ordem no backend
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex   = categorias.findIndex((c) => c.id === active.id);
    const newIndex   = categorias.findIndex((c) => c.id === over.id);
    const reordenado = arrayMove(categorias, oldIndex, newIndex).map((c, i) => ({ ...c, ordem: i + 1 }));

    setCategorias(reordenado);

    try {
      await CategoriaService.reordenar(reordenado.map((c) => ({ id: c.id, ordem: c.ordem })));
    } catch {
      setErro('Não foi possível salvar a nova ordem.');
      carregar();
    }
  };

  // Desktop: o painel abre numa linha logo abaixo da categoria (dentro da tabela).
  // Celular: o mesmo painel abre em tela cheia (.cate__tela). O CSS esconde o que não se aplica ao tamanho da tela;
  // o ref fica só na versão inline, que é a que precisa rolar até aparecer.
  const renderPainelAdicionais = (ref?: React.Ref<HTMLDivElement>) => categoriaDaAba && (
          <div className="cate__adic" ref={ref} role="region" aria-label={`Adicionais de ${categoriaDaAba.nome}`}>
            <div className="cate__adic-aba">
              <HiPuzzle aria-hidden="true" />
              Adicionais de
              <strong>{categoriaDaAba.icone ?? '🍽️'} {categoriaDaAba.nome}</strong>
              <span className="cate__adic-qtd">{adicionais.length}</span>
            </div>

            <div className="cate__adic-corpo">
              <div className="cate__adic-topo">
                <p className="cate__subtitulo">Complementos que o cliente pode escolher nos produtos desta categoria.</p>
                <button className="cate__btn-interno" onClick={() => abrirModalAdicional(categoriaDaAba)}>
                  <HiPlus /> Novo item
                </button>
              </div>

              {!categoriaDaAba.ativo && (
                <p className="cate__aviso-categoria">
                  Esta categoria está desativada, então nenhum adicional aparece no cardápio. Ao reativá-la, eles voltam ao status que tinham.
                </p>
              )}

              {erroAdicionais && <p className="cate__erro">{erroAdicionais}</p>}

              {carregandoAdic || adicionaisDe !== categoriaAberta ? (
                <p className="cate__dica cate__dica--neutra">Carregando adicionais...</p>
              ) : adicionais.length === 0 ? (
                <p className="cate__dica cate__dica--neutra">Nenhum item cadastrado nesta categoria ainda.</p>
              ) : (
                <div className="cate__tabela-scroll">
                  <table className="cate__tabela cate__tabela--adic">
                    <thead>
                      <tr>
                        <th>Item</th>
                        <th>Tipo</th>
                        <th>Pode pedir até</th>
                        <th>Preço do extra</th>
                        <th>Status</th>
                        <th>Ações</th>
                      </tr>
                    </thead>
                    <tbody>
                      {adicionais.map((adicional) => (
                        <tr key={adicional.id} className="cate__adic-linha">
                          <td className="cate__td-nome cate__td-quebra">
                            {adicional.nome}
                            {adicional.descricao && <small className="cate__adic-descricao">{adicional.descricao}</small>}
                          </td>
                          <td>
                            {adicional.quantidade_inclusa > 0 ? (
                              <span className="cate__tag">
                                Vem {adicional.quantidade_inclusa}
                                {adicional.fixo && <span className="cate__tag-fixo"><HiLockClosed aria-hidden="true" /> Fixo</span>}
                              </span>
                            ) : (
                              <span className="cate__tag cate__tag--extra">Adicional</span>
                            )}
                          </td>
                          <td>{adicional.quantidade_maxima}</td>
                          <td className="cate__td-preco">
                            {adicional.quantidade_maxima > adicional.quantidade_inclusa
                              ? formatarReais(Math.round(adicional.preco * 100))
                              : '—'}
                          </td>
                          <td className="cate__td-status">
                            {/* Categoria desativada oculta os adicionais sem alterar o status de cada um */}
                            <span className={`cate__badge ${adicional.ativo && categoriaDaAba.ativo ? 'cate__badge--ativo' : 'cate__badge--inativo'}`}>
                              {!adicional.ativo ? 'Oculto' : !categoriaDaAba.ativo ? 'Oculto (categoria desativada)' : 'Ativo'}
                            </span>
                          </td>
                          <td>
                            <div className="cate__td-acoes cate__td-acoes--adic">
                              <button className="cate__btn-acao" onClick={() => abrirModalAdicional(categoriaDaAba, adicional)} aria-label={`Editar ${adicional.nome}`}>
                                <HiPencil />
                              </button>
                              <button className="cate__btn-acao cate__btn-acao--deletar" onClick={() => setAdicParaExcluir(adicional)} aria-label={`Excluir ${adicional.nome}`}>
                                <HiTrash />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
  );

  return (
    <RestaurantLayout>
      <div className="cate">

        {/* ── Cabeçalho ── */}
        <div className="cate__header">
          <h2 className="cate__titulo">Gestão de Categorias</h2>
          <button className="cate__btn-novo" onClick={abrirModalNovo}>
            <HiPlus /> Nova Categoria
          </button>
        </div>

        {/* ── Card ── */}
        <div className="cate__card">
          <div className="cate__card-header">
            <div>
              <h3 className="cate__card-titulo">Gestão de Categorias</h3>
              <p className="cate__subtitulo">Organize as seções do seu cardápio</p>
            </div>
          </div>

          {erro && <p className="cate__erro">{erro}</p>}

          {/* Tabela */}
          {carregando ? (
            <p className="cate__dica">Carregando categorias...</p>
          ) : categorias.length === 0 ? (
            <p className="cate__dica">Nenhuma categoria cadastrada ainda.</p>
          ) : (
            <>
              <div className="cate__tabela-scroll">
              <DndContext sensors={sensors} collisionDetection={closestCenter} onDragStart={() => setCategoriaAberta(null)} onDragEnd={handleDragEnd}>
                <SortableContext items={categorias.map((c) => c.id)} strategy={verticalListSortingStrategy}>
                  <table className="cate__tabela">
                    <thead>
                      <tr>
                        <th>Ordem</th>
                        <th>Nome da Categoria</th>
                        <th>Produtos</th>
                        <th>Status</th>
                        <th>Ações</th>
                      </tr>
                    </thead>
                    <tbody>
                      {categorias.map((categoria) => (
                        <React.Fragment key={categoria.id}>
                          <LinhaCategoria
                            categoria={categoria}
                            qtdAdicionais={qtdAdicionais[categoria.id] ?? 0}
                            selecionada={categoriaAberta === categoria.id}
                            onSelecionar={alternarCategoriaAberta}
                            onEditar={abrirModalEditar}
                            onDeletar={deletarCategoria}
                            onRegistrarAdicional={(c) => abrirModalAdicional(c)}
                          />
                          {/* Desktop: adicionais abrem na linha logo abaixo da própria categoria */}
                          {categoriaAberta === categoria.id && (
                            <tr className="cate__linha-adic">
                              <td colSpan={5}>{renderPainelAdicionais(painelAdicionaisRef)}</td>
                            </tr>
                          )}
                        </React.Fragment>
                      ))}
                    </tbody>
                  </table>
                </SortableContext>
              </DndContext>
              </div>

              <p className="cate__dica">↺ Arraste para mudar a ordem das categorias (a nova ordem é salva automaticamente)</p>
              <p className="cate__dica cate__dica--neutra">Clique em uma categoria para ver os adicionais cadastrados nela.</p>
            </>
          )}
        </div>

       {categoriaDaAba && (
  <div className="cate__tela">
    <button className="cate__tela-fechar" onClick={() => setCategoriaAberta(null)} aria-label="Fechar adicionais">
      <HiX />
    </button>
    {renderPainelAdicionais()}
  </div>
)}

        {/* ── Modal Novo / Editar Adicional (já dentro da categoria) ── */}
        {modalAdicional && (
          <div className="cate__overlay" onClick={() => !salvandoAdic && setModalAdicional(null)}>
            <div className="cate__modal" role="dialog" aria-modal="true" aria-labelledby="adic-titulo" onClick={(e) => e.stopPropagation()}>
              <div className="cate__modal-header">
                <h3 id="adic-titulo" className="cate__modal-titulo-icone">
                  <HiPuzzle aria-hidden="true" />
                  {modalAdicional.editando ? 'Editar item' : 'Novo item'}
                </h3>
                <button className="cate__modal-fechar" onClick={() => setModalAdicional(null)} disabled={salvandoAdic} aria-label="Fechar">
                  <HiX />
                </button>
              </div>

              <div className="cate__modal-corpo">
                <p className="cate__adic-contexto">
                  Categoria: <strong>{modalAdicional.categoria.icone ?? '🍽️'} {modalAdicional.categoria.nome}</strong>
                </p>

                <div className="cate__campo">
                  <label className="cate__label" htmlFor="adic-nome">Nome <span className="cate__obrigatorio">*</span></label>
                  <input
                    id="adic-nome"
                    className="cate__input"
                    maxLength={100}
                    placeholder="Ex.: Pão"
                    value={formAdic.nome}
                    onChange={(e) => atualizarFormAdic({ nome: e.target.value })}
                    disabled={salvandoAdic}
                    autoFocus
                  />
                </div>

                <div className="cate__campo">
                  <span className="cate__label">Como esse item funciona?</span>
                  <div className="cate__tipos">
                    <button
                      type="button"
                      className={`cate__tipo${formAdic.tipo === 'incluso' ? ' cate__tipo--ativo' : ''}`}
                      onClick={() => mudarTipo('incluso')}
                      disabled={salvandoAdic}
                      aria-pressed={formAdic.tipo === 'incluso'}
                    >
                      <strong>Já vem no produto</strong>
                      <span>Faz parte do item, já está no preço.</span>
                    </button>
                    <button
                      type="button"
                      className={`cate__tipo${formAdic.tipo === 'adicional' ? ' cate__tipo--ativo' : ''}`}
                      onClick={() => mudarTipo('adicional')}
                      disabled={salvandoAdic}
                      aria-pressed={formAdic.tipo === 'adicional'}
                    >
                      <strong>Adicional</strong>
                      <span>Não vem no produto, só entra se o cliente pedir.</span>
                    </button>
                  </div>
                </div>

                {formAdic.tipo === 'incluso' && (
                  <div className="cate__campo cate__campo--linha">
                    <div className="cate__subcampo">
                      <span className="cate__label">Quantidade que vem</span>
                      <QuantidadeStepper
                        valor={formAdic.quantidadeInclusa}
                        min={1}
                        max={20}
                        onChange={mudarInclusa}
                        disabled={salvandoAdic}
                        rotulo="quantidade que vem no produto"
                      />
                    </div>
                    <label className="cate__fixo">
                      <input
                        type="checkbox"
                        checked={formAdic.fixo}
                        onChange={(e) => atualizarFormAdic({ fixo: e.target.checked })}
                        disabled={salvandoAdic}
                      />
                      <HiLockClosed aria-hidden="true" />
                      <span>
                        <strong>Fixo</strong>
                        <small>O cliente vê, mas não pode retirar.</small>
                      </span>
                    </label>
                  </div>
                )}

                <div className="cate__campo cate__campo--linha">
                  <div className="cate__subcampo">
                    <span className="cate__label">Cliente pode pedir até</span>
                    <QuantidadeStepper
                      valor={formAdic.quantidadeMaxima}
                      min={formAdic.tipo === 'incluso' ? formAdic.quantidadeInclusa : 1}
                      max={20}
                      onChange={(v) => atualizarFormAdic({ quantidadeMaxima: v })}
                      disabled={salvandoAdic}
                      rotulo="limite que o cliente pode pedir"
                    />
                  </div>
                  <div className="cate__subcampo cate__subcampo--preco">
                    <label className="cate__label" htmlFor="adic-preco">
                      {formAdic.tipo === 'incluso' ? 'Preço de cada extra' : 'Preço de cada um'}
                    </label>
                    {(() => {
                      const semExtra = formAdic.tipo === 'incluso' && formAdic.quantidadeMaxima <= formAdic.quantidadeInclusa;
                      return (
                        <>
                          <input
                            id="adic-preco"
                            className="cate__input"
                            inputMode="numeric"
                            placeholder={semExtra ? '—' : 'R$ 0,00'}
                            value={semExtra || formAdic.precoCentavos === null ? '' : formatarReais(formAdic.precoCentavos)}
                            onChange={(e) => mudarPreco(e.target.value)}
                            disabled={salvandoAdic || semExtra}
                          />
                          {semExtra && <small className="cate__dica-campo">Aumente o limite para cobrar extras.</small>}
                        </>
                      );
                    })()}
                  </div>
                </div>

                <div className="cate__campo">
                  <label className="cate__label" htmlFor="adic-descricao">Descrição <span className="cate__opcional">(opcional)</span></label>
                  <textarea
                    id="adic-descricao"
                    className="cate__input cate__textarea"
                    rows={3}
                    maxLength={255}
                    placeholder="Descreva o adicional..."
                    value={formAdic.descricao}
                    onChange={(e) => atualizarFormAdic({ descricao: e.target.value })}
                    disabled={salvandoAdic}
                  />
                  <ContadorCaracteres valor={formAdic.descricao} max={255} />
                </div>

                <div className="cate__campo">
                  <label className="cate__label">Status</label>
                  <div className="cate__radio-grupo">
                    <label className="cate__radio-label">
                      <input type="radio" name="status-adicional" checked={formAdic.ativo} onChange={() => atualizarFormAdic({ ativo: true })} />
                      <span className={`cate__radio-check ${formAdic.ativo ? 'cate__radio-check--ativo' : ''}`} />
                      Ativo
                    </label>
                    <label className="cate__radio-label">
                      <input type="radio" name="status-adicional" checked={!formAdic.ativo} onChange={() => atualizarFormAdic({ ativo: false })} />
                      <span className={`cate__radio-check ${!formAdic.ativo ? 'cate__radio-check--ativo' : ''}`} />
                      Oculto
                    </label>
                  </div>
                </div>

                {erroModalAdic && <p className="cate__erro">{erroModalAdic}</p>}
              </div>

              <div className="cate__modal-acoes cate__modal-acoes--direita">
                <button className="cate__btn-cancelar" onClick={() => setModalAdicional(null)} disabled={salvandoAdic}>Cancelar</button>
                <button className="cate__btn-salvar" onClick={salvarAdicional} disabled={salvandoAdic}>
                  <HiPlus /> {salvandoAdic ? 'Salvando...' : 'Salvar'}
                </button>
              </div>
            </div>
          </div>
        )}

        <ModalAlerta
          aberto={!!adicParaExcluir}
          variante="aviso"
          titulo="Excluir adicional?"
          mensagem={adicParaExcluir && <>O adicional <strong>"{adicParaExcluir.nome}"</strong> será removido desta categoria.</>}
          textoConfirmar={excluindoAdic ? 'Excluindo...' : 'Sim, excluir'}
          onConfirmar={excluirAdicional}
          onFechar={() => setAdicParaExcluir(null)}
          carregando={excluindoAdic}
        />

        {/* ── Modal Nova Categoria ── */}
        {modalNovo && (
          <div className="cate__overlay" onClick={() => !salvando && setModalNovo(false)}>
            <div className="cate__modal" onClick={(e) => e.stopPropagation()}>
              <div className="cate__modal-header">
                <h3>Nova Categoria</h3>
                <button className="cate__modal-fechar" onClick={() => setModalNovo(false)} disabled={salvando}>
                  <HiX />
                </button>
              </div>

              <div className="cate__modal-corpo">
                <div className="cate__campo">
                  <label className="cate__label">Nome da categoria</label>
                  <SeletorCategoria
                    id="cate-nome"
                    valor={form.nome}
                    onChange={(nome) => atualizarForm({ nome })}
                    jaUsadas={nomesJaUsados}
                    desabilitado={salvando}
                    selectClassName="cate__input cate__select"
                    inputClassName="cate__input"
                  />
                  <p className="cate__hint">Escolha uma categoria pronta. Não achou a sua? Use "Outra".</p>
                </div>

                <div className="cate__campo">
                  <label className="cate__label">Descrição <span className="cate__opcional">(opcional)</span></label>
                  <input className="cate__input" maxLength={255} value={form.descricao} onChange={(e) => atualizarForm({ descricao: e.target.value })} />
                  <ContadorCaracteres valor={form.descricao} max={255} />
                </div>


                <div className="cate__campo">
                  <label className="cate__label">Status</label>
                  <div className="cate__radio-grupo">
                    <label className="cate__radio-label">
                      <input type="radio" name="status-novo" checked={form.ativo} onChange={() => atualizarForm({ ativo: true })} />
                      <span className={`cate__radio-check ${form.ativo ? 'cate__radio-check--ativo' : ''}`} />
                      Ativa
                    </label>
                    <label className="cate__radio-label">
                      <input type="radio" name="status-novo" checked={!form.ativo} onChange={() => atualizarForm({ ativo: false })} />
                      <span className={`cate__radio-check ${!form.ativo ? 'cate__radio-check--ativo' : ''}`} />
                      Oculta
                    </label>
                  </div>
                </div>

                {erroModal && <p className="cate__erro">{erroModal}</p>}
              </div>

              <div className="cate__modal-acoes cate__modal-acoes--direita">
                <button className="cate__btn-cancelar" onClick={() => setModalNovo(false)} disabled={salvando}>Cancelar</button>
                <button className="cate__btn-salvar" onClick={salvarNova} disabled={salvando}>
                  {salvando ? 'Salvando...' : 'Salvar'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ── Modal Editar Categoria ── */}
        {modalEditar && (
          <div className="cate__overlay" onClick={() => !salvando && setModalEditar(null)}>
            <div className="cate__modal" onClick={(e) => e.stopPropagation()}>
              <div className="cate__modal-header">
                <h3>Editar Categoria</h3>
                <button className="cate__modal-fechar" onClick={() => setModalEditar(null)} disabled={salvando}>
                  <HiX />
                </button>
              </div>

              <div className="cate__modal-corpo">
                <div className="cate__campo">
                  <label className="cate__label">Nome da categoria</label>
                  <SeletorCategoria
                    id="cate-nome"
                    valor={form.nome}
                    onChange={(nome) => atualizarForm({ nome })}
                    jaUsadas={nomesJaUsados}
                    desabilitado={salvando}
                    selectClassName="cate__input cate__select"
                    inputClassName="cate__input"
                  />
                  <p className="cate__hint">Escolha uma categoria pronta. Não achou a sua? Use "Outra".</p>
                </div>

                <div className="cate__campo">
                  <label className="cate__label">Descrição</label>
                  <input className="cate__input" maxLength={255} value={form.descricao} onChange={(e) => atualizarForm({ descricao: e.target.value })} />
                  <ContadorCaracteres valor={form.descricao} max={255} />
                </div>


                <div className="cate__campo">
                  <label className="cate__label">Status</label>
                  <div className="cate__radio-grupo">
                    <label className="cate__radio-label">
                      <input type="radio" name="status-edit" checked={form.ativo} onChange={() => atualizarForm({ ativo: true })} />
                      <span className={`cate__radio-check ${form.ativo ? 'cate__radio-check--ativo' : ''}`} />
                      Ativa
                    </label>
                    <label className="cate__radio-label">
                      <input type="radio" name="status-edit" checked={!form.ativo} onChange={() => atualizarForm({ ativo: false })} />
                      <span className={`cate__radio-check ${!form.ativo ? 'cate__radio-check--ativo' : ''}`} />
                      Oculta
                    </label>
                  </div>
                </div>

                {erroModal && <p className="cate__erro">{erroModal}</p>}
              </div>

              <div className="cate__modal-acoes cate__modal-acoes--tres">
                <button className="cate__btn-desativar" onClick={alternarAtivaModal} disabled={salvando}>
                  {form.ativo ? 'Desativar' : 'Reativar'}
                </button>
                <button className="cate__btn-cancelar" onClick={() => setModalEditar(null)} disabled={salvando}>Cancelar</button>
                <button className="cate__btn-salvar" onClick={salvarEdicao} disabled={salvando}>
                  <HiPlus /> {salvando ? 'Salvando...' : 'Salvar'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ── Modal de confirmação de desativação ── */}
        {confirmacao && (
          <div className="cate__overlay" onClick={() => !confirmando && setConfirmacao(null)}>
            <div className="cate__modal" role="alertdialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
              <div className="cate__modal-header">
                <h3>{confirmacao.tipo === 'reativar' ? 'Reativar categoria' : 'Desativar categoria'}</h3>
                <button className="cate__modal-fechar" onClick={() => setConfirmacao(null)} disabled={confirmando}>
                  <HiX />
                </button>
              </div>

              <div className="cate__modal-corpo">
                {confirmacao.tipo === 'reativar' ? (
                  <>
                    <p className="cate__confirmar-texto">
                      A categoria <strong>"{confirmacao.categoria.nome}"</strong> possui{' '}
                      <strong>
                        {confirmacao.categoria.produtosIndisponiveis}{' '}
                        {confirmacao.categoria.produtosIndisponiveis === 1 ? 'produto desativado' : 'produtos desativados'}
                      </strong>.
                    </p>
                    <p className="cate__confirmar-texto">
                      Deseja ativar {confirmacao.categoria.produtosIndisponiveis === 1 ? 'esse produto' : 'esses produtos'} junto com a categoria?
                    </p>
                  </>
                ) : confirmacao.categoria.produtos > 0 || (qtdAdicionais[confirmacao.categoria.id] ?? 0) > 0 ? (
                  <>
                    <p className="cate__confirmar-texto">
                      A categoria <strong>"{confirmacao.categoria.nome}"</strong> possui{' '}
                      <strong>
                        {[
                          confirmacao.categoria.produtos > 0 &&
                            `${confirmacao.categoria.produtos} ${confirmacao.categoria.produtos === 1 ? 'produto conectado' : 'produtos conectados'}`,
                          (qtdAdicionais[confirmacao.categoria.id] ?? 0) > 0 &&
                            `${qtdAdicionais[confirmacao.categoria.id]} ${qtdAdicionais[confirmacao.categoria.id] === 1 ? 'adicional cadastrado' : 'adicionais cadastrados'}`,
                        ].filter(Boolean).join(' e ')}
                      </strong>.
                    </p>
                    <p className="cate__confirmar-texto">
                      Se continuar, {confirmacao.categoria.produtos > 0 && 'os produtos serão desativados e '}
                      {(qtdAdicionais[confirmacao.categoria.id] ?? 0) > 0 && 'os adicionais ficarão ocultos (o status de cada um é mantido e volta ao reativar a categoria) e '}
                      deixarão de aparecer no cardápio. Deseja realmente desativar esta categoria?
                    </p>
                  </>
                ) : (
                  <p className="cate__confirmar-texto">
                    Deseja realmente desativar a categoria <strong>"{confirmacao.categoria.nome}"</strong>?
                  </p>
                )}
              </div>

              {confirmacao.tipo === 'reativar' ? (
                <div className="cate__modal-acoes cate__modal-acoes--direita">
                  <button className="cate__btn-cancelar" onClick={() => setConfirmacao(null)} disabled={confirmando}>Cancelar</button>
                  <button className="cate__btn-cancelar" onClick={() => confirmarDesativacao(false)} disabled={confirmando}>
                    Só a categoria
                  </button>
                  <button className="cate__btn-salvar" onClick={() => confirmarDesativacao(true)} disabled={confirmando}>
                    {confirmando ? 'Ativando...' : 'Categoria e produtos'}
                  </button>
                </div>
              ) : (
                <div className="cate__modal-acoes cate__modal-acoes--direita">
                  <button className="cate__btn-cancelar" onClick={() => setConfirmacao(null)} disabled={confirmando}>Cancelar</button>
                  <button className="cate__btn-salvar" onClick={() => confirmarDesativacao()} disabled={confirmando}>
                    {confirmando ? 'Desativando...' : 'Sim, desativar'}
                  </button>
                </div>
              )}
            </div>
          </div>
        )}

      </div>
    </RestaurantLayout>
  );
};

export default GestaoCate;