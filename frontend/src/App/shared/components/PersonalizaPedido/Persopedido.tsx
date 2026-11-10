import React, { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { HiLockClosed } from 'react-icons/hi';
import CustomerLayout from '../layout/Customerlayout';
import { ItemCarrinho } from '../Carrinho/Carrinho';
import { useCarrinho } from '../../contexts/CarrinhoContext';
import { useSistemaCliente } from '../../contexts/SistemaClienteContext';
import ContadorCaracteres from '../ContadorCaracteres/ContadorCaracteres';
import QuantidadeStepper from '../QuantidadeStepper/QuantidadeStepper';
import {
  IngredienteProduto,
  custoExtraIngrediente,
  formatarPreco,
  quantidadeMinima,
} from '../../utils/ingredientes';
import './Persopedido.css';

/**
 * PersoPedido é a tela de ajuste do pedido: o cliente chega aqui a partir
 * de um produto do Menu, escolhe ingredientes/adicionais e escreve uma
 * observação antes de mandar o item para o carrinho.
 *
 * Funciona no estilo dos totens de lanchonete:
 *  - o que já vem no produto (quantidade inclusa) está dentro do preço;
 *  - tirar um ingrediente NÃO desconta;
 *  - só aumenta o preço quem pedir MAIS do que vem incluso (ou um adicional).
 * Os ingredientes e seus preços são cadastrados pelo restaurante (vêm da API junto
 * com o produto). O servidor refaz a conta no pedido: aqui é só a prévia.
 *
 * Fica em shared/components porque é reaproveitada tanto pelo Menu do cliente
 * local (QR code) quanto pelo Menu do cliente delivery — igual ao Carrinho.
 */

// ── Tipos
interface ProdutoPersonalizavel {
  id: string;
  nome: string;
  descricao: string;
  preco: number;
  imagem: string;
  ingredientes?: IngredienteProduto[];
}

interface PersoPedidoRouteState {
  produto?: ProdutoPersonalizavel;
  modoCliente?: 'guest' | 'logged';
}

// ── Componente
const PersoPedido: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { adicionarItem } = useCarrinho();
  const { sistema } = useSistemaCliente();

  /**
   * Produto e modo do cliente vêm pelo state da navegação (o card do Menu
   * leva pra cá passando o produto clicado e o próprio modo).
   */
  const state = location.state as PersoPedidoRouteState | null;
  const produto = state?.produto;
  // O modo vem do SISTEMA em que a aba entrou (mesa ou link do restaurante), não de quem navegou
  const modoLayout: 'guest' | 'logged' = sistema === 'delivery' ? 'logged' : sistema === 'local' ? 'guest' : state?.modoCliente ?? 'guest';
  const ingredientes = produto?.ingredientes ?? [];

  // Quantidade escolhida de cada ingrediente; começa na quantidade que já vem inclusa
  const [quantidades, setQuantidades] = useState<Record<string, number>>(() =>
    Object.fromEntries(ingredientes.map((i) => [i.id, i.quantidadeInclusa]))
  );
  const [observacao, setObservacao] = useState('');
  const [paraLevar, setParaLevar] = useState(false);

  const quantidadeDe = (ing: IngredienteProduto) => quantidades[ing.id] ?? ing.quantidadeInclusa;

  const definirQuantidade = (ing: IngredienteProduto, valor: number) =>
    setQuantidades((prev) => ({
      ...prev,
      [ing.id]: Math.min(ing.quantidadeMaxima, Math.max(quantidadeMinima(ing), valor)),
    }));

  // Sem state (refresh ou acesso direto pela URL) não há produto para personalizar
  if (!produto) {
    return (
      <CustomerLayout mode={modoLayout}>
        <div className="perso-pedido">
          <p className="perso-pedido__aviso">Escolha um produto no cardápio para personalizar.</p>
          <button
            type="button"
            className="perso-pedido__botao-confirmar"
            onClick={() => navigate(modoLayout === 'logged' ? '/menu' : '/menulocal', { replace: true })}
          >
            Voltar ao cardápio
          </button>
        </div>
      </CustomerLayout>
    );
  }

  // ── Totais: só o que passa do incluso é cobrado; tirar não muda nada
  const totalExtras = ingredientes.reduce((acc, ing) => acc + custoExtraIngrediente(ing, quantidadeDe(ing)), 0);
  const totalFinal = produto.preco + totalExtras;

  const personalizacao = ingredientes.filter((i) => i.quantidadeInclusa > 0);
  const adicionais = ingredientes.filter((i) => i.quantidadeInclusa === 0);

  // ── Adiciona o item já customizado ao carrinho e volta pro menu
  const handleAdicionarAoCarrinho = () => {
    // Só vai o que difere do padrão: o servidor trata o resto como "como vem no produto"
    const ajustes = ingredientes
      .filter((ing) => quantidadeDe(ing) !== ing.quantidadeInclusa)
      .map((ing) => ({ adicional_id: ing.id, quantidade: quantidadeDe(ing) }));

    // Resumo para o cliente conferir no carrinho (a cozinha recebe o mesmo, gerado no servidor)
    const sem = ingredientes.filter((i) => quantidadeDe(i) < i.quantidadeInclusa).map((i) => i.nome);
    const extras = ingredientes
      .filter((i) => quantidadeDe(i) > i.quantidadeInclusa)
      .map((i) => `${i.nome} x${quantidadeDe(i) - i.quantidadeInclusa}`);
    const detalhes = [
      paraLevar ? 'Para levar' : '',
      sem.length ? `Sem: ${sem.join(', ')}` : '',
      extras.length ? `Extra: ${extras.join(', ')}` : '',
    ]
      .filter(Boolean)
      .join(' | ');

    const item: ItemCarrinho = {
      // Id próprio da linha do carrinho (não o id do produto): assim dá pra
      // adicionar o mesmo produto mais de uma vez com customizações diferentes.
      id: `${produto.id}-${Date.now()}`,
      produtoId: produto.id,
      nome: produto.nome,
      preco: totalFinal,
      quantidade: 1,
      imagem: produto.imagem,
      ingredientes: ajustes.length ? ajustes : undefined,
      paraLevar: paraLevar || undefined,
      detalhes: detalhes || undefined,
      observacao: observacao.trim() || undefined,
    };

    adicionarItem(item);

    // Volta para o menu que trouxe o cliente até aqui (local ou delivery)
    navigate(-1);
  };

  // Texto de apoio de cada linha: explica o que acontece com o preço conforme o cliente mexe
  const detalheDe = (ing: IngredienteProduto): { texto: string; destaque: boolean } => {
    const qtd = quantidadeDe(ing);
    const extra = Math.max(0, qtd - ing.quantidadeInclusa);
    const preco = ing.precoExtra > 0 ? formatarPreco(ing.precoExtra) : 'grátis';

    if (ing.quantidadeInclusa === 0) {
      return qtd > 0
        ? { texto: `${qtd} × ${preco} = ${formatarPreco(extra * ing.precoExtra)}`, destaque: true }
        : { texto: ing.precoExtra > 0 ? `+${preco} cada` : 'Grátis', destaque: false };
    }
    if (qtd === 0) return { texto: `Sem ${ing.nome.toLowerCase()}`, destaque: false };
    if (extra > 0) return { texto: `+${extra} extra · +${formatarPreco(extra * ing.precoExtra)}`, destaque: true };
    if (qtd < ing.quantidadeInclusa) return { texto: `Vem ${ing.quantidadeInclusa}, você pediu ${qtd}`, destaque: false };
    const podeMais = ing.quantidadeMaxima > ing.quantidadeInclusa;
    return {
      texto: `Já vem ${ing.quantidadeInclusa}${podeMais ? ` · mais por +${preco}` : ''}`,
      destaque: false,
    };
  };

  // ── Uma seção da tela (O que vem no produto / Adicionais)
  const renderSecao = (titulo: string, subtitulo: string, lista: IngredienteProduto[]) => (
    <section className="perso-pedido__secao">
      <header className="perso-pedido__secao-cab">
        <h3 className="perso-pedido__secao-titulo">{titulo}</h3>
        <p className="perso-pedido__secao-sub">{subtitulo}</p>
      </header>

      <ul className="perso-pedido__lista">
        {lista.map((ing) => {
          const qtd = quantidadeDe(ing);
          const { texto, destaque } = detalheDe(ing);
          const removido = ing.quantidadeInclusa > 0 && qtd === 0;
          return (
            <li
              key={ing.id}
              className={`perso-pedido__item${removido ? ' perso-pedido__item--removido' : ''}${destaque ? ' perso-pedido__item--extra' : ''}`}
            >
              <div className="perso-pedido__item-info">
                <span className="perso-pedido__item-nome">
                  {ing.nome}
                  {ing.fixo && (
                    <span className="perso-pedido__fixo" title="Faz parte do produto e não pode ser retirado">
                      <HiLockClosed aria-hidden="true" /> Fixo
                    </span>
                  )}
                </span>
                <span className="perso-pedido__item-detalhe">{texto}</span>
              </div>

              <QuantidadeStepper
                valor={qtd}
                min={quantidadeMinima(ing)}
                max={ing.quantidadeMaxima}
                onChange={(v) => definirQuantidade(ing, v)}
                rotulo={ing.nome}
              />
            </li>
          );
        })}
      </ul>
    </section>
  );

  return (
    <CustomerLayout mode={modoLayout}>
      <div className="perso-pedido">

        {/* Cabeçalho do produto */}
        <div className="perso-pedido__topo">
          <img src={produto.imagem} alt={produto.nome} className="perso-pedido__imagem" />
          <div className="perso-pedido__info">
            <h2 className="perso-pedido__nome">{produto.nome}</h2>
            <p className="perso-pedido__descricao">{produto.descricao}</p>
          </div>
          <span className="perso-pedido__preco">{formatarPreco(totalFinal)}</span>
        </div>

        {/* Ingredientes e adicionais (só aparecem se o restaurante cadastrou) */}
        {ingredientes.length === 0 && (
          <p className="perso-pedido__aviso">Este produto não tem ingredientes para personalizar.</p>
        )}
        {personalizacao.length > 0 &&
          renderSecao(
            'O que vem no produto',
            'Já está no preço. Retire o que não quiser (sem desconto) e só pague extra se pedir mais.',
            personalizacao
          )}
        {adicionais.length > 0 &&
          renderSecao('Quer adicionar mais?', 'Cada adicional é somado ao valor do pedido.', adicionais)}

        {/* Para levar */}
        <label className="perso-pedido__levar">
          <span className="perso-pedido__levar-info">
            <strong>Para levar</strong>
            <small>Embalar este item para viagem</small>
          </span>
          <input
            type="checkbox"
            role="switch"
            className="perso-pedido__switch"
            checked={paraLevar}
            onChange={(e) => setParaLevar(e.target.checked)}
            aria-label="Para levar"
          />
        </label>

        {/* Observação */}
        <div className="perso-pedido__observacao">
          <h3 className="perso-pedido__observacao-titulo">Observação</h3>
          <textarea
            className="perso-pedido__observacao-campo"
            placeholder="escreva aqui a sua observação"
            maxLength={500}
            value={observacao}
            onChange={(e) => setObservacao(e.target.value)}
          />
          <ContadorCaracteres valor={observacao} max={500} />
        </div>

        {/* Barra de confirmação: o total sempre à vista */}
        <div className="perso-pedido__barra">
          <div className="perso-pedido__barra-total">
            <span>Total</span>
            <strong>{formatarPreco(totalFinal)}</strong>
          </div>
          <button
            type="button"
            className="perso-pedido__botao-confirmar"
            onClick={handleAdicionarAoCarrinho}
          >
            Adicionar ao carrinho
          </button>
        </div>

      </div>
    </CustomerLayout>
  );
};

export default PersoPedido;
