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
  HiMenu,
  HiOfficeBuilding,
} from 'react-icons/hi';
import { MdPointOfSale, MdDarkMode, MdLightMode } from 'react-icons/md';
import { FaWhatsapp } from 'react-icons/fa';
import { useTema } from '../../../contexts/TemaContext';
import './RestaurantSidebar.css';

interface NavItem {
  to?: string;
  icon: React.ReactNode;
  label: string;
  subitems?: { to: string; label: string }[];
  bottom?: boolean;
  /** Rótulo curto para a barra inferior do celular (telas muito estreitas) */
  shortLabel?: string;
}

const NAV_ITEMS: NavItem[] = [
  { to: '/restaurante/home', icon: <HiHome />, label: 'Início' },
  { to: '/restaurante/caixa', icon: <MdPointOfSale />, label: 'Caixa' },
  {
    icon: <HiClipboardList />,
    label: 'Pedidos',
    to: '/restaurante/pedido',
    subitems: [{ to: '/restaurante/historico', label: 'Histórico' }],
  },
  {
    icon: <HiViewList />,
    label: 'Categorias',
    shortLabel: 'Categ.',
    to: '/restaurante/categories',
    subitems: [{ to: '/restaurante/produtos', label: 'Produtos' }],
  },
  { to: '/restaurante/fila', icon: <HiUserGroup />, label: 'Fila' },
  { to: '/restaurante/relatorios', icon: <HiChartBar />, label: 'Relatórios', shortLabel: 'Relat.' },
  { to: '/restaurante/embreve', icon: <HiOfficeBuilding />, label: 'Filiais' },
  { to: '/restaurante/whatsapp', icon: <FaWhatsapp />, label: 'WhatsApp' },
  { to: '/restaurante/config', icon: <HiCog />, label: 'Configurações', bottom: true },
];

/**
 * No celular a barra inferior mostra só os itens do dia a dia (MOBILE_PRINCIPAIS)
 * e um botão ☰ que abre a lista com os demais (MOBILE_MAIS) + o botão de tema.
 * No desktop a sidebar lateral continua mostrando todos os NAV_ITEMS.
 */
const MOBILE_PRINCIPAIS = NAV_ITEMS.filter(
  (i) => !['Filiais', 'WhatsApp', 'Configurações', 'Relatórios'].includes(i.label)
);
const ORDEM_MAIS = ['Relatórios', 'Configurações', 'Filiais', 'WhatsApp'];
const MOBILE_MAIS = ORDEM_MAIS.map((label) => NAV_ITEMS.find((i) => i.label === label)!);

const RestaurantSidebar: React.FC = () => {
  const location = useLocation();
  const { escuro, alternar } = useTema();
  const [maisAberto, setMaisAberto] = useState(false);
  // Controla qual item com submenu está aberto no drawer mobile
  const [drawerItem, setDrawerItem] = useState<NavItem | null>(null);

  const isGroupActive = (item: NavItem) =>
    (item.to && location.pathname.startsWith(item.to)) ||
    item.subitems?.some((s) => location.pathname.startsWith(s.to)) ||
    false;

  const maisAtivo = MOBILE_MAIS.some((i) => i.to && location.pathname.startsWith(i.to));

  const handleMobileItemClick = (item: NavItem) => {
    setMaisAberto(false);
    if (item.subitems && item.subitems.length > 0) {
      setDrawerItem(item);
    } else {
      setDrawerItem(null);
    }
  };

  const toggleMais = () => {
    setDrawerItem(null);
    setMaisAberto((v) => !v);
  };

  const closeDrawer = () => {
    setDrawerItem(null);
    setMaisAberto(false);
  };

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
        {MOBILE_PRINCIPAIS.map((item) => {
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
                  <span className="mobile-nav__label">{item.shortLabel ?? item.label}</span>
                  {active && <HiChevronUp className="mobile-nav__chevron" />}
                </>
              ) : (
                <NavLink
                  to={item.to!}
                  className="mobile-nav__link"
                  onClick={closeDrawer}
                >
                  <span className="mobile-nav__icon">{item.icon}</span>
                  <span className="mobile-nav__label">{item.shortLabel ?? item.label}</span>
                </NavLink>
              )}
            </button>
          );
        })}

        {/* Botão ☰ — abre Configurações, Filiais, WhatsApp e tema */}
        <button
          type="button"
          className={`mobile-nav__item${maisAberto || maisAtivo ? ' active' : ''}`}
          onClick={toggleMais}
          aria-label="Abrir menu"
          aria-expanded={maisAberto}
        >
          <span className="mobile-nav__icon"><HiMenu /></span>
          <span className="mobile-nav__label">Outros</span>
        </button>
      </nav>

      {/* ── MOBILE: lista do botão ☰ ── */}
      {maisAberto && (
        <>
          <div className="mobile-drawer__overlay" onClick={closeDrawer} />
          <div className="mobile-drawer" role="menu">
            <div className="mobile-drawer__header">
              <span className="mobile-drawer__title">
                <span className="mobile-drawer__title-icon"><HiMenu /></span>
                Menu
              </span>
              <button className="mobile-drawer__close" onClick={closeDrawer} aria-label="Fechar">
                <HiX />
              </button>
            </div>

            <div className="mobile-drawer__subitems">
              {MOBILE_MAIS.map((item) => (
                <NavLink
                  key={item.label}
                  to={item.to!}
                  className="mobile-drawer__subitem mobile-drawer__link"
                  onClick={closeDrawer}
                >
                  <span className="mobile-drawer__link-icon">{item.icon}</span>
                  {item.label}
                </NavLink>
              ))}

              <button
                type="button"
                className="mobile-drawer__subitem mobile-drawer__link mobile-drawer__tema"
                onClick={alternar}
              >
                <span className="mobile-drawer__link-icon">
                  {escuro ? <MdLightMode /> : <MdDarkMode />}
                </span>
                {escuro ? 'Modo claro' : 'Modo escuro'}
              </button>
            </div>
          </div>
        </>
      )}

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