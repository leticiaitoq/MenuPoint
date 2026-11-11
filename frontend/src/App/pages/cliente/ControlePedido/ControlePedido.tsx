import React, { useState } from 'react';
import CustomerLayout from '../../../shared/components/layout/Customerlayout';
import HistoricoPedidos, { FiltroOrigem } from '../../../shared/components/HistoricoPedidos/HistoricoPedidos';
import { useHistoricoCliente } from '../../../shared/components/HistoricoPedidos/useHistoricoCliente';
import { useRestauranteCliente } from '../../../shared/contexts/RestauranteClienteContext';
import { useClienteAuth } from '../../../shared/contexts/ClienteAuthContext';
import { useLoginObrigatorio } from '../../../shared/contexts/LoginObrigatorioContext';
import './ControlePedido.css';

/**
 * Histórico do cliente DELIVERY (link do restaurante). Logado: é o histórico FIXO da conta (o mesmo
 * da mesa, separado em dois filtros: Restaurante local × Delivery). Sem conta: a tela abre normalmente,
 * mas fica vazia (nada é buscado na API).
 */
const ControlePedido: React.FC = () => {
  const { slug } = useRestauranteCliente();
  const { isAuthenticated } = useClienteAuth();
  const { exigirLogin } = useLoginObrigatorio();
  const { pedidos, carregando, erro } = useHistoricoCliente(slug, isAuthenticated);
  const [origem, setOrigem] = useState<FiltroOrigem>('todos');

  return (
    <CustomerLayout mode="logged">
      <div className="pedidos">
        <h1 className="pedidos__titulo">Meus Pedidos</h1>
        <HistoricoPedidos
          pedidos={pedidos}
          carregando={carregando}
          erro={erro}
          origem={origem}
          onOrigemChange={setOrigem}
          vazioTexto={
            isAuthenticated
              ? 'Você ainda não fez nenhum pedido. Escolha algo no cardápio!'
              : 'Entre na sua conta para ver o seu histórico de pedidos.'
          }
        />
        {!isAuthenticated && (
          <button
            type="button"
            className="pedidos__entrar"
            onClick={() => exigirLogin({ motivo: 'historico', retorno: '/historico' })}
          >
            Entrar na minha conta
          </button>
        )}
      </div>
    </CustomerLayout>
  );
};

export default ControlePedido;
