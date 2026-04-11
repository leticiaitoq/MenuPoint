import React, { useState } from 'react';
import { HiUser, HiClipboardList, HiTrash, HiPlus } from 'react-icons/hi';
import { MdTableRestaurant } from 'react-icons/md';
import RestaurantLayout from '../../../../shared/components/layout/Restaurantelayout';
import './Pedido.css';

// ── Tipos 
interface ItemPedido {
  id: string;
  nome: string;
  quantidade: number;
  preco: number;
}

// ── Dados mockados (substituir por API)
const MESAS = ['Mesa 1', 'Mesa 2', 'Mesa 3', 'Mesa 4', 'Mesa 5'];
const ATENDENTES = ['Letícia', 'Heloisa', 'Sara', 'Enzo'];
const PRODUTOS_DISPONIVEIS = [
  { id: 'p1', nome: 'X-Burguer',         preco: 25.00 },
  { id: 'p2', nome: 'Refrigerante Lata', preco: 6.00  },
  { id: 'p3', nome: 'Batata Frita',      preco: 15.00 },
  { id: 'p4', nome: 'Suco Natural',      preco: 9.00  },
  { id: 'p5', nome: 'Macarrão ao Molho', preco: 24.99 },
];

const Pedido: React.FC = () => {

  const [cliente, setCliente]         = useState('');
  const [mesa, setMesa]               = useState('');
  const [atendente, setAtendente]     = useState('');
  const [itens, setItens]             = useState<ItemPedido[]>([]);
  const [observacoes, setObservacoes] = useState('');
  const [urgente, setUrgente]         = useState(false);
  const [sucesso, setSucesso]         = useState(false);
  const [erro, setErro]               = useState('');

  // ── Mockado (futuramente abrir modal de seleção)
  const adicionarItem = () => {
    const produto = PRODUTOS_DISPONIVEIS[Math.floor(Math.random() * PRODUTOS_DISPONIVEIS.length)];
    const existente = itens.find((i) => i.id === produto.id);
    if (existente) {
      setItens((prev) =>
        prev.map((i) => i.id === produto.id ? { ...i, quantidade: i.quantidade + 1 } : i)
      );
    } else {
      setItens((prev) => [...prev, { ...produto, quantidade: 1 }]);
    }
  };

  const removerItem = (id: string) => {
    setItens((prev) => prev.filter((i) => i.id !== id));
  };

  const total = itens.reduce((acc, i) => acc + i.preco * i.quantidade, 0);

  const cancelarPedido = () => {
    setCliente('');
    setMesa('');
    setAtendente('');
    setItens([]);
    setObservacoes('');
    setUrgente(false);
    setErro('');
  };

  const salvarPedido = () => {
    // ── Validações obrigatórias ──
    if (!cliente.trim()) {
      setErro('Informe o nome do cliente.');
      return;
    }
    if (!mesa) {
      setErro('Selecione uma mesa.');
      return;
    }
    if (!atendente) {
      setErro('Selecione um atendente.');
      return;
    }
    if (itens.length === 0) {
      setErro('Adicione pelo menos um item ao pedido.');
      return;
    }

    // Tudo ok — limpa erro e abre popup
    setErro('');
    console.log({ cliente, mesa, atendente, itens, observacoes, urgente, total });
    setSucesso(true);
  };

  return (
    <RestaurantLayout>
      <div className="pedido">

        {/* Cabeçalho */}
        <div className="pedido__header">
          <h2 className="pedido__titulo">Cadastrar Pedidos</h2>
          <p className="pedido__breadcrumb">
            Pedidos &gt; <strong>Novo Pedido</strong>
          </p>
        </div>

        {/* Card do formulário */}
        <div className="pedido__card">

          {/* Cliente */}
          <div className="pedido__secao">
            <label className="pedido__label">
              <HiUser className="pedido__label-icon" /> Cliente
            </label>
            <div className="pedido__input-wrap">
              <HiUser className="pedido__input-icon" />
              <input
                className="pedido__input"
                type="text"
                placeholder="Nome do cliente"
                value={cliente}
                onChange={(e) => setCliente(e.target.value)}
              />
            </div>
          </div>

          {/* Mesa + Atendente */}
          <div className="pedido__linha">
            <div className="pedido__campo">
              <label className="pedido__label">Mesa</label>
              <div className="pedido__select-wrap">
                <MdTableRestaurant className="pedido__select-icon" />
                <select
                  className="pedido__select"
                  value={mesa}
                  onChange={(e) => setMesa(e.target.value)}
                >
                  <option value="">Selecione a mesa</option>
                  {MESAS.map((m) => (
                    <option key={m} value={m}>{m}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="pedido__campo">
              <label className="pedido__label">Atendente</label>
              <div className="pedido__select-wrap">
                <select
                  className="pedido__select"
                  value={atendente}
                  onChange={(e) => setAtendente(e.target.value)}
                >
                  <option value="">Selecione</option>
                  {ATENDENTES.map((a) => (
                    <option key={a} value={a}>{a}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* Botão adicionar item */}
          <button className="pedido__btn-add" onClick={adicionarItem}>
            <HiPlus /> Adicionar item
          </button>

          {/* Tabela de itens */}
          <div className="pedido__tabela-wrap">
            <table className="pedido__tabela">
              <thead>
                <tr>
                  <th className="pedido__th pedido__th--item">Item</th>
                  <th className="pedido__th">Qtd</th>
                  <th className="pedido__th">Preço</th>
                  <th className="pedido__th">Subtotal</th>
                  <th className="pedido__th"></th>
                </tr>
              </thead>
              <tbody>
                {itens.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="pedido__vazio">
                      Nenhum item adicionado ainda.
                    </td>
                  </tr>
                ) : (
                  itens.map((item) => (
                    <tr key={item.id} className="pedido__tr">
                      <td className="pedido__td">{item.nome}</td>
                      <td className="pedido__td pedido__td--center">{item.quantidade}</td>
                      <td className="pedido__td">R$ {item.preco.toFixed(2).replace('.', ',')}</td>
                      <td className="pedido__td pedido__td--subtotal">
                        R$ {(item.preco * item.quantidade).toFixed(2).replace('.', ',')}
                      </td>
                      <td className="pedido__td pedido__td--center">
                        <button
                          className="pedido__btn-del"
                          onClick={() => removerItem(item.id)}
                          aria-label={`Remover ${item.nome}`}
                        >
                          <HiTrash />
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Observações + Total */}
          <div className="pedido__rodape">
            <div className="pedido__obs-wrap">
              <label className="pedido__label">
                <HiClipboardList className="pedido__label-icon" /> Observações
              </label>
              <input
                className="pedido__input pedido__input--obs"
                type="text"
                placeholder="Ex: Ponto do X-Burguer: bem passado"
                value={observacoes}
                onChange={(e) => setObservacoes(e.target.value)}
              />
            </div>

            <div className="pedido__total-wrap">
              <div className="pedido__urgente">
                <label className="pedido__toggle-label">
                  <input
                    type="checkbox"
                    className="pedido__toggle-input"
                    checked={urgente}
                    onChange={(e) => setUrgente(e.target.checked)}
                  />
                  <span className="pedido__toggle-slider" />
                  Pedido Urgente
                </label>
              </div>
              <p className="pedido__total">
                Total <span>R$ {total.toFixed(2).replace('.', ',')}</span>
              </p>
            </div>
          </div>

          {/* Mensagem de erro */}
          {erro && <p className="pedido__erro">{erro}</p>}

          {/* Ações */}
          <div className="pedido__acoes">
            <button className="pedido__btn-cancelar" onClick={cancelarPedido}>
              Cancelar
            </button>
            <button className="pedido__btn-salvar" onClick={salvarPedido}>
              Salvar Pedido
            </button>
          </div>

        </div>
      </div>

      {/* Popup de sucesso — fora do card para cobrir a tela toda */}
      {sucesso && (
        <div className="pedido__popup-overlay" onClick={() => setSucesso(false)}>
          <div className="pedido__popup" onClick={(e) => e.stopPropagation()}>
            <span className="pedido__popup-icon">✅</span>
            <h3>Pedido efetuado com sucesso!</h3>
            <p>O pedido foi registrado e enviado para a cozinha.</p>
            <button
              className="pedido__btn-salvar"
              onClick={() => { setSucesso(false); cancelarPedido(); }}
            >
              OK
            </button>
          </div>
        </div>
      )}

    </RestaurantLayout>
  );
};

export default Pedido;