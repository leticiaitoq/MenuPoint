import React, { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import CustomerLayout from '../layout/Customerlayout';
import { ItemCarrinho } from '../Carrinho/Carrinho';
import { useCarrinho } from '../../contexts/CarrinhoContext';
import './Persopedido.css';

/**
 * PersoPedido é a tela de ajuste do pedido: o cliente chega aqui a partir
 * de um produto do Menu, escolhe personalizações/adicionais e escreve uma
 * observação antes de mandar o item para o carrinho.
 *
 * Fica em shared/components (e não dentro de uma pasta de fluxo específico)
 * porque é reaproveitada tanto pelo Menu do cliente local (QR code) quanto
 * pelo Menu do cliente delivery — igual ao Carrinho e ao Historico.
 */

// ── Tipos
interface ProdutoPersonalizavel {
  id: string;
  nome: string;
  descricao: string;
  preco: number;
  imagem: string;
}

interface OpcaoAjuste {
  id: string;
  nome: string;
  /** TODO: preço real virá da API de produtos/adicionais */
  precoUnitario: number;
  quantidade: number;
}

/** Item já customizado, pronto para ser adicionado ao carrinho */

interface PersoPedidoRouteState {
  produto?: ProdutoPersonalizavel;
  modoCliente?: 'guest' | 'logged';
}

// ── Dados mockados — Futuramente a lista de personalização e
// adicionais também virá da API, atrelada a cada produto.
const PRODUTO_MOCK: ProdutoPersonalizavel = {
  id: '1',
  nome: 'Hamburguer Celestino',
  descricao: 'Pão, gergilim, hamburguer, bacon, cheddar, alface, cebola, tomate',
  preco: 39.9,
  imagem: '/images/Menu/Lanche.jpg',
};

const PERSONALIZACAO_MOCK: Omit<OpcaoAjuste, 'quantidade'>[] = [
  { id: 'hamburguer', nome: 'hamburguer', precoUnitario: 0 },
  { id: 'alface', nome: 'alface', precoUnitario: 0 },
  { id: 'bacon', nome: 'bacon', precoUnitario: 0 },
  { id: 'cebola', nome: 'cebola', precoUnitario: 0 },
  { id: 'cheddar', nome: 'cheddar', precoUnitario: 0 },
  { id: 'tomate', nome: 'tomate', precoUnitario: 0 },
];

const ADICIONAIS_MOCK: Omit<OpcaoAjuste, 'quantidade'>[] = [
  { id: 'maionese', nome: 'maionese', precoUnitario: 0 },
  { id: 'azeitona', nome: 'azeitona', precoUnitario: 0 },
  { id: 'milho', nome: 'milho', precoUnitario: 0 },
  { id: 'pimenta', nome: 'pimenta', precoUnitario: 0 },
  { id: 'mussarela', nome: 'mussarela', precoUnitario: 0 },
  { id: 'palmito', nome: 'palmito', precoUnitario: 0 },
];

const QTD_MIN = 0;
const QTD_MAX = 5;

// ── Componente
const PersoPedido: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { adicionarItem } = useCarrinho();

  /**
   * Produto e modo do cliente vêm pelo state da navegação (o card do Menu
   * leva pra cá passando o produto clicado e o próprio modo). Sem state
   * (ex: refresh na tela, acesso direto pela URL), cai nos fallbacks só
   * pra tela não quebrar em desenvolvimento.
   */
  const state = location.state as PersoPedidoRouteState | null;
  const produto: ProdutoPersonalizavel = state?.produto ?? PRODUTO_MOCK;
  const modoLayout = state?.modoCliente ?? 'guest';

  const [personalizacao, setPersonalizacao] = useState<OpcaoAjuste[]>(
    PERSONALIZACAO_MOCK.map((op) => ({ ...op, quantidade: 1 }))
  );
  const [adicionais, setAdicionais] = useState<OpcaoAjuste[]>(
    ADICIONAIS_MOCK.map((op) => ({ ...op, quantidade: 0 }))
  );
  const [observacao, setObservacao] = useState('');

  // ── Ajusta a quantidade de uma opção (personalização ou adicional)
  const alterarQuantidade = (
    setLista: React.Dispatch<React.SetStateAction<OpcaoAjuste[]>>,
    id: string,
    delta: number
  ) => {
    setLista((prev) =>
      prev.map((op) =>
        op.id === id
          ? { ...op, quantidade: Math.min(QTD_MAX, Math.max(QTD_MIN, op.quantidade + delta)) }
          : op
      )
    );
  };

  // ── Totais
  const totalExtras = [...personalizacao, ...adicionais].reduce(
    (acc, op) => acc + op.precoUnitario * op.quantidade,
    0
  );
  const totalFinal = produto.preco + totalExtras;

  // ── Adiciona o item já customizado ao carrinho e volta pro menu
  const handleAdicionarAoCarrinho = () => {
    const item: ItemCarrinho = {
      // Id próprio da linha do carrinho (não o id do produto): assim dá pra
      // adicionar o mesmo produto mais de uma vez com customizações
      // diferentes sem que uma sobrescreva/remova a outra.
      id: `${produto.id}-${Date.now()}`,
      nome: produto.nome,
      preco: totalFinal,
      quantidade: 1,
      imagem: produto.imagem,
      observacao: observacao.trim() || undefined,
    };

    // TODO: quando a API de pedidos estiver pronta, mandar junto os ajustes
    // de personalizacao/adicionais (quais e quantos) além da observação.
    adicionarItem(item);

    // Volta para o menu que trouxe o cliente até aqui (local ou delivery),
    // em vez de fixar uma rota — assim a tela serve os dois fluxos.
    navigate(-1);
  };

  // ── Renderiza um grupo de opções (Personalização ou Adicionais)
  const renderGrupo = (
    titulo: string,
    opcoes: OpcaoAjuste[],
    setOpcoes: React.Dispatch<React.SetStateAction<OpcaoAjuste[]>>
  ) => (
    <div className="perso-pedido__grupo">
      <h3 className="perso-pedido__grupo-titulo">{titulo}</h3>
      <div className="perso-pedido__opcoes">
        {opcoes.map((op) => (
          <div key={op.id} className="perso-pedido__opcao">
            <span className="perso-pedido__opcao-nome">{op.nome}</span>
            <div className="perso-pedido__opcao-controle">
              <button
                type="button"
                className="perso-pedido__botao perso-pedido__botao--menos"
                onClick={() => alterarQuantidade(setOpcoes, op.id, -1)}
                aria-label={`Diminuir ${op.nome}`}
              >
                −
              </button>
              <span className="perso-pedido__opcao-qtd">{op.quantidade}</span>
              <button
                type="button"
                className="perso-pedido__botao perso-pedido__botao--mais"
                onClick={() => alterarQuantidade(setOpcoes, op.id, 1)}
                aria-label={`Aumentar ${op.nome}`}
              >
                +
              </button>
            </div>
            <span className="perso-pedido__opcao-preco">
              R${op.precoUnitario.toFixed(2).replace('.', ',')}
            </span>
          </div>
        ))}
      </div>
    </div>
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
          <span className="perso-pedido__preco">
            R${totalFinal.toFixed(2).replace('.', ',')}
          </span>
        </div>

        {/* Personalização + Adicionais */}
        <div className="perso-pedido__grupos">
          {renderGrupo('Personalização', personalizacao, setPersonalizacao)}
          {renderGrupo('Adicionais', adicionais, setAdicionais)}
        </div>

        {/* Observação */}
        <div className="perso-pedido__observacao">
          <h3 className="perso-pedido__observacao-titulo">Observação</h3>
          <textarea
            className="perso-pedido__observacao-campo"
            placeholder="escreva aqui a sua observação"
            value={observacao}
            onChange={(e) => setObservacao(e.target.value)}
          />
        </div>

        {/* Confirmação */}
        <button
          type="button"
          className="perso-pedido__botao-confirmar"
          onClick={handleAdicionarAoCarrinho}
        >
          Adicionar ao carrinho
        </button>

      </div>
    </CustomerLayout>
  );
};

export default PersoPedido;