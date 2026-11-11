import React from 'react';
import { NavLink } from 'react-router-dom';
import { HiHome, HiClipboardList, HiViewList } from 'react-icons/hi';
import { MdTableRestaurant } from 'react-icons/md';
import { useClienteAuth } from '../../../contexts/ClienteAuthContext';
import { useLoginObrigatorio } from '../../../contexts/LoginObrigatorioContext';
import { MotivoLogin } from '../../../utils/pendenciaLogin';
import './CustomerSidebar.css';

// ── Tipos ──────────────────────────────────────────────
export type CustomerSidebarItem = 'home' | 'orders' | 'tables' | 'menu';

interface CustomerSidebarProps {
  items: CustomerSidebarItem[];
  /**
   * onClick opcional por item — se fornecido, vira botão ao invés de NavLink.
   * Útil para abrir painéis laterais (ex: histórico).
   */
  onItemClick?: Partial<Record<CustomerSidebarItem, () => void>>;
  /**
   * Permite sobrescrever a rota padrão de qualquer item.
   * Útil quando o mesmo item aponta para páginas diferentes
   */
  routeOverrides?: Partial<Record<CustomerSidebarItem, string>>;
}

// ── Configuração padrão dos itens ──────────────────────
// Para adicionar um novo item, basta incluir aqui — sem tocar em outro TSX.
const SIDEBAR_CONFIG: Record<CustomerSidebarItem, { to: string; icon: React.ReactNode; label: string }> = {
  home:   { to: '/dwelcome',   icon: <HiHome />,           label: 'Início'   },
  orders: { to: '/historico',  icon: <HiClipboardList />,  label: 'Pedidos'  },
  tables: { to: '/reserva',    icon: <MdTableRestaurant />, label: 'Mesas'    },
  menu:   { to: '/menu',       icon: <HiViewList />,        label: 'Cardápio' },
};

// Itens que o visitante (sem conta) não abre: o clique mostra o aviso de login em vez de navegar
const ITENS_QUE_EXIGEM_LOGIN: Partial<Record<CustomerSidebarItem, MotivoLogin>> = {
  tables: 'reserva',
};

// ── Componente ─────────────────────────────────────────
const CustomerSidebar: React.FC<CustomerSidebarProps> = ({
  items,
  onItemClick,
  routeOverrides,
}) => {
  const { isAuthenticated } = useClienteAuth();
  const { exigirLogin } = useLoginObrigatorio();

  return (
    <aside className="customer-sidebar">
      <nav className="customer-sidebar__nav">
        {items.map((item) => {
          const config     = SIDEBAR_CONFIG[item];
          const handleClick = onItemClick?.[item];

          // Override de rota tem prioridade sobre o padrão
          const to = routeOverrides?.[item] ?? config.to;

          // Se tiver onClick, vira botão — clique abre painel ao invés de navegar
          if (handleClick) {
            return (
              <button
                key={item}
                className="customer-sidebar__item"
                onClick={handleClick}
                aria-label={config.label}
              >
                <span className="customer-sidebar__icon">{config.icon}</span>
              </button>
            );
          }

          const motivoLogin = ITENS_QUE_EXIGEM_LOGIN[item];
          if (motivoLogin && !isAuthenticated) {
            return (
              <button
                key={item}
                className="customer-sidebar__item"
                onClick={() => exigirLogin({ motivo: motivoLogin, retorno: to })}
                aria-label={config.label}
              >
                <span className="customer-sidebar__icon">{config.icon}</span>
              </button>
            );
          }

          return (
            <NavLink
              key={item}
              to={to}
              className="customer-sidebar__item"
              aria-label={config.label}
            >
              <span className="customer-sidebar__icon">{config.icon}</span>
            </NavLink>
          );
        })}
      </nav>
    </aside>
  );
};

export default CustomerSidebar;