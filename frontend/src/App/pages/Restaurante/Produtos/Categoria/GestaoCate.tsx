import React, { useEffect, useState } from 'react';
import { HiPencil, HiTrash, HiPlus, HiX } from 'react-icons/hi';
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
import SeletorCategoria from '../../../../shared/components/SeletorCategoria/SeletorCategoria';
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

const extrairErro = (err: any, padrao: string): string =>
  err?.response?.data?.message ?? padrao;

interface LinhaProps {
  categoria: CategoriaComContagem;
  onEditar: (categoria: CategoriaComContagem) => void;
  onDeletar: (categoria: CategoriaComContagem) => void;
}

const LinhaCategoria: React.FC<LinhaProps> = ({ categoria, onEditar, onDeletar }) => {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: categoria.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    background: isDragging ? '#fdf0f0' : 'white',
  };

  return (
    <tr ref={setNodeRef} style={style}>
      <td className="cate__td-ordem">
        <MdDragIndicator className="cate__drag-icon" {...attributes} {...listeners} />
        {categoria.ordem}
      </td>
      <td className="cate__td-nome">
        <span className="cate__icone" aria-hidden="true">{categoria.icone ?? '🍽️'}</span>
        {categoria.nome}
      </td>
      <td>{categoria.produtos}</td>
      <td>
        <span className={`cate__badge ${categoria.ativo ? 'cate__badge--ativo' : 'cate__badge--inativo'}`}>
          {categoria.ativo ? 'Ativa' : 'Oculta'}
        </span>
      </td>
      <td className="cate__td-acoes">
        <button className="cate__btn-acao" onClick={() => onEditar(categoria)} aria-label="Editar">
          <HiPencil />
        </button>
        <button className="cate__btn-acao cate__btn-acao--deletar" onClick={() => onDeletar(categoria)} aria-label="Deletar">
          <HiTrash />
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
              <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
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
                        <LinhaCategoria
                          key={categoria.id}
                          categoria={categoria}
                          onEditar={abrirModalEditar}
                          onDeletar={deletarCategoria}
                        />
                      ))}
                    </tbody>
                  </table>
                </SortableContext>
              </DndContext>
              </div>

              <p className="cate__dica">↺ Arraste para mudar a ordem das categorias (a nova ordem é salva automaticamente)</p>
            </>
          )}
        </div>

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
                ) : confirmacao.categoria.produtos > 0 ? (
                  <>
                    <p className="cate__confirmar-texto">
                      A categoria <strong>"{confirmacao.categoria.nome}"</strong> possui{' '}
                      <strong>
                        {confirmacao.categoria.produtos}{' '}
                        {confirmacao.categoria.produtos === 1 ? 'produto conectado' : 'produtos conectados'}
                      </strong>.
                    </p>
                    <p className="cate__confirmar-texto">
                      Se continuar, {confirmacao.categoria.produtos === 1 ? 'esse produto também será desativado' : 'todos eles também serão desativados'} e
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
