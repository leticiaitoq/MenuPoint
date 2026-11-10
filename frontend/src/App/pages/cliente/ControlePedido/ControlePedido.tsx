import React, { useState } from 'react';
import CustomerLayout from '../../../shared/components/layout/Customerlayout';
import HistoricoPedidos, { FiltroOrigem } from '../../../shared/components/HistoricoPedidos/HistoricoPedidos';
import { useHistoricoCliente } from '../../../shared/components/HistoricoPedidos/useHistoricoCliente';
import { useRestauranteCliente } from '../../../shared/contexts/RestauranteClienteContext';
import './ControlePedido.css';

/**
 * Histórico do cliente DELIVERY (link do restaurante). Sempre logado (a rota exige login),
 * então o histórico é o FIXO da conta: nunca some. É o mesmo da mesa, separado em dois filtros:
 * Restaurante local × Delivery.
 */
const ControlePedido: React.FC = () => {
  const { slug } = useRestauranteCliente();
  const { pedidos, carregando, erro } = useHistoricoCliente(slug);
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
          vazioTexto="Você ainda não fez nenhum pedido. Escolha algo no cardápio!"
        />
      </div>
    </CustomerLayout>
  );
};

export default ControlePedido;
