import React, { useState } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import {
  HiHome,
  HiClipboardList,
  HiViewList,
  HiUserGroup,
  HiChartBar,
  HiCog,
  HiChevronUp,
  HiX,
} from 'react-icons/hi';
import { MdTableRestaurant } from 'react-icons/md';
import './RestaurantSidebar.css';

interface NavItem {
  to?: string;
  icon: React.ReactNode;
  label: string;
  subitems?: { to: string; label: string }[];
  bottom?: boolean;
}

const NAV_ITEMS: NavItem[] = [
  { to: '/restaurante/home', icon: <HiHome />, label: 'Início' },
  {
    icon: <HiClipboardList />,
    label: 'Pedidos',
    to: '/restaurante/pedido',
    subitems: [{ to: '/restaurante/historico', label: 'Histórico' }],
  },
  {
    icon: <HiViewList />,
    label: 'Produtos',
    to: '/restaurante/produtos',
    subitems: [{ to: '/restaurante/categories', label: 'Categorias' }],
  },
  { to: '/restaurante/mesas', icon: <MdTableRestaurant />, label: 'Mesas' },
  { to: '/restaurante/fila', icon: <HiUserGroup />, label: 'Fila' },
  { to: '/restaurante/relatorios', icon: <HiChartBar />, label: 'Relatórios' },
  { to: '/restaurante/config', icon: <HiCog />, label: 'Configurações', bottom: true },
];

const RestaurantSidebar: React.FC = () => {
  const location = useLocation();
  // Controla qual item com submenu está aberto no drawer mobile
  const [drawerItem, setDrawerItem] = useState<NavItem | null>(null);

  const isGroupActive = (item: NavItem) =>
    (item.to && location.pathname.startsWith(item.to)) ||
    item.subitems?.some((s) => location.pathname.startsWith(s.to)) ||
    false;

  const handleMobileItemClick = (item: NavItem) => {
    if (item.subitems && item.subitems.length > 0) {
      setDrawerItem(item);
    } else {
      setDrawerItem(null);
    }
  };

  const closeDrawer = () => setDrawerItem(null);

  return (
    <>
      {/* ── DESKTOP: sidebar lateral ── */}
      <aside className="sidebar">
        <nav className="sidebar__nav">
          {NAV_ITEMS.map((item) =>
            item.subitems ? (
              <div
                key={item.label}
                className={`sidebar__group${item.bottom ? ' sidebar__group--bottom' : ''}`}
              >
                <NavLink
                  to={item.to!}
                  className={({ isActive }) =>
                    'sidebar__item' + (isActive || isGroupActive(item) ? ' active' : '')
                  }
                >
                  <span className="sidebar__icon">{item.icon}</span>
                  <span className="sidebar__item-label">{item.label}</span>
                </NavLink>
                <div className="sidebar__subitems">
                  {item.subitems.map((sub) => (
                    <NavLink key={sub.to} to={sub.to} className="sidebar__subitem">
                      • {sub.label}
                    </NavLink>
                  ))}
                </div>
              </div>
            ) : (
              <NavLink
                key={item.label}
                to={item.to!}
                className={({ isActive }) =>
                  'sidebar__item' +
                  (isActive ? ' active' : '') +
                  (item.bottom ? ' sidebar__item--bottom' : '')
                }
              >
                <span className="sidebar__icon">{item.icon}</span>
                <span className="sidebar__item-label">{item.label}</span>
              </NavLink>
            )
          )}
        </nav>
      </aside>

      {/* ── MOBILE: bottom navigation bar ── */}
      <nav className="mobile-nav">
        {NAV_ITEMS.map((item) => {
          const active = isGroupActive(item) || location.pathname === item.to;
          return (
            <button
              key={item.label}
              className={`mobile-nav__item${active ? ' active' : ''}`}
              onClick={() => handleMobileItemClick(item)}
              // Se não tem submenu, usa NavLink via wrapper (ver abaixo)
            >
              {item.subitems ? (
                <>
                  <span className="mobile-nav__icon">{item.icon}</span>
                  <span className="mobile-nav__label">{item.label}</span>
                  {active && <HiChevronUp className="mobile-nav__chevron" />}
                </>
              ) : (
                <NavLink
                  to={item.to!}
                  className="mobile-nav__link"
                  onClick={closeDrawer}
                >
                  <span className="mobile-nav__icon">{item.icon}</span>
                  <span className="mobile-nav__label">{item.label}</span>
                </NavLink>
              )}
            </button>
          );
        })}
      </nav>

      {/* ── MOBILE: drawer de subitens ── */}
      {drawerItem && (
        <>
          <div className="mobile-drawer__overlay" onClick={closeDrawer} />
          <div className="mobile-drawer">
            <div className="mobile-drawer__header">
              <span className="mobile-drawer__title">
                <span className="mobile-drawer__title-icon">{drawerItem.icon}</span>
                {drawerItem.label}
              </span>
              <button className="mobile-drawer__close" onClick={closeDrawer}>
                <HiX />
              </button>
            </div>

            {/* Link para a rota principal do grupo */}
            <NavLink
              to={drawerItem.to!}
              className="mobile-drawer__main-link"
              onClick={closeDrawer}
            >
              {drawerItem.label} (visão geral)
            </NavLink>

            <div className="mobile-drawer__subitems">
              {drawerItem.subitems?.map((sub) => (
                <NavLink
                  key={sub.to}
                  to={sub.to}
                  className="mobile-drawer__subitem"
                  onClick={closeDrawer}
                >
                  • {sub.label}
                </NavLink>
              ))}
            </div>
          </div>
        </>
      )}
    </>
  );
};

export default RestaurantSidebar;