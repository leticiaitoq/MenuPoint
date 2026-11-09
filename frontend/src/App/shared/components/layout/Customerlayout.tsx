import React, { useState } from 'react';
import Navbar from './Navbar/Navbar';
import { useLocation, useNavigate } from 'react-router-dom';
import { HiArrowLeft } from 'react-icons/hi';
import Footer from './Footer/Footer';
import CustomerSidebar, { CustomerSidebarItem } from './Sidebar/CustomerSidebar';
import { useClienteAuth } from '../../contexts/ClienteAuthContext';
import { FOTO_PADRAO_CLIENTE } from '../../../services/cliente.service';
import { useConvidado } from '../../contexts/Convidadocontext';
import ContaConvidadoModal from '../ContaConvidadoModal/ContaConvidadoModal';
import './Customerlayout.css';

// ── Tipos ──────────────────────────────────────────────
interface CustomerLayoutProps {
  children: React.ReactNode;
  /**
   * Define o modo do layout:
   * - 'welcome' → tela de entrada, só navbar e footer, sem sidebar
   * - 'guest'   → cliente local (QR code), carrinho na navbar, sidebar reduzida
   * - 'logged'  → cliente delivery logado, avatar na navbar, sidebar completa
   */
  mode?: 'welcome' | 'guest' | 'logged';
  cartCount?: number;
  /** Abre o painel do carrinho ao clicar no ícone da navbar */
  onCartClick?: () => void;
  /** Abre o painel do histórico ao clicar no ícone de pedidos da sidebar */
  onOrdersClick?: () => void;
}

// ── Itens da sidebar por modo
const GUEST_ITEMS:  CustomerSidebarItem[] = ['home', 'orders'];
const LOGGED_ITEMS: CustomerSidebarItem[] = ['home', 'orders', 'tables', 'menu'];

/**
 * No modo guest o cliente está no restaurante (veio pelo QR code).
 * O item 'menu' deve apontar para /menulocal, não para /menu (delivery).
 */
const GUEST_ROUTE_OVERRIDES: Partial<Record<CustomerSidebarItem, string>> = {
  home: '/menulocal',
  orders: '/historicolocal',
};

/**
 * Telas "raiz" do cliente (cardápio e boas-vindas): não têm para onde voltar.
 * Telas que já trazem o próprio botão de voltar no formulário também ficam de fora.
 */
const SEM_BOTAO_VOLTAR = ['/menulocal', '/menu', '/welcomepage', '/dwelcome', '/retirada', '/endereço'];

// ── Componente ─────────────────────────────────────────
const CustomerLayout: React.FC<CustomerLayoutProps> = ({
  children,
  mode = 'logged',
  cartCount = 0,
  onCartClick,
  onOrdersClick,
}) => {
  // ── cliente logado (nome na navbar)
  const { cliente, isAuthenticated } = useClienteAuth();

  // Nome digitado na WelcomePage (só existe no fluxo do cliente local)
  // e a mesa em que ele está (vem do QR Code; continua valendo depois de entrar na conta)
  const { nome: nomeConvidado, mesa: mesaConvidado } = useConvidado();

  // ── navegação
  const navigate = useNavigate();
  const location = useLocation();

  // Botão "Voltar": nas telas internas volta para a anterior. Se a página foi aberta direto
  // (sem histórico, ex.: recarregou ou abriu o link), leva para o cardápio.
  const caminhoAtual = decodeURIComponent(location.pathname).toLowerCase();
  const mostrarVoltar = mode !== 'welcome' && !SEM_BOTAO_VOLTAR.includes(caminhoAtual);
  const voltar = () => {
    if (location.key !== 'default') navigate(-1);
    else navigate(mode === 'guest' ? '/menulocal' : '/menu', { replace: true });
  };
  // Convidado não tem perfil: o ícone oferece entrar/criar conta. Logado vai para o perfil.
  const [mostrarConta, setMostrarConta] = useState(false);
  const handleClick = () => {
    if (isAuthenticated) navigate('/perfil');
    else setMostrarConta(true);
  };

  // Sempre mostra o perfil na navbar, independente do modo
  const rightIcon = (
    <button className="btn-imagem" onClick={handleClick}>
      <img
        src={(isAuthenticated && cliente?.foto_url) || FOTO_PADRAO_CLIENTE}
        alt={cliente?.nome ? `Perfil de ${cliente.nome}` : 'Perfil do cliente'}
        onError={(e) => {
          if (!e.currentTarget.src.endsWith(FOTO_PADRAO_CLIENTE)) e.currentTarget.src = FOTO_PADRAO_CLIENTE;
        }}
      />
    </button>
  );

  const leftIcon = (
    <img src="/icons/restaurant-logo.png" alt="Logo do restaurante" />
  );

  // Logado: mostra o primeiro nome do cliente. Sem nome (não deveria ocorrer) cai no texto antigo.
  const primeiroNome = cliente?.nome?.trim().split(/\s+/)[0] ?? '';

  // Guest: mostra o nome digitado na WelcomePage (cai em 'MenuPoint' se ainda não houver)
  const subtitle =
    mode === 'guest'
      ? (nomeConvidado || primeiroNome || 'MenuPoint')
      : mode === 'logged' && primeiroNome
        // Cliente logado que entrou pela mesa continua identificado com a mesa
        ? `Olá, ${primeiroNome}${mesaConvidado ? ` · Mesa ${mesaConvidado}` : ''}`
        : '(Cliente)';

  const showSidebar = mode !== 'welcome';
  const sidebarItems = mode === 'guest' ? GUEST_ITEMS : LOGGED_ITEMS;

  // Passa o onClick de histórico apenas para o item 'orders'
  const sidebarClicks = onOrdersClick ? { orders: onOrdersClick } : undefined;

  // Overrides de rota só se aplicam no modo guest
  const routeOverrides = mode === 'guest' ? GUEST_ROUTE_OVERRIDES : undefined;
  
// Rota da tela inicial conforme o modo (o logo "MenuPoint" da navbar leva para ela)
const homePath =
  mode === 'guest' ? '/menulocal'
  : mode === 'logged' ? '/dwelcome'
  : undefined;

  return (
    <div className="customer-layout">
     <Navbar subtitle={subtitle} rightIcon={rightIcon} leftIcon={leftIcon} mostrarTema homePath={homePath} />

      <div className="customer-layout__body">
        {showSidebar && (
          <CustomerSidebar
            items={sidebarItems}
            onItemClick={sidebarClicks}
            routeOverrides={routeOverrides}
          />
        )}
        <main className="customer-layout__content">
          {mostrarVoltar && (
            <button type="button" className="customer-layout__voltar" onClick={voltar}>
              <HiArrowLeft aria-hidden="true" /> Voltar
            </button>
          )}
          {children}
        </main>
      </div>

      <Footer />

      <ContaConvidadoModal
        aberto={mostrarConta}
        mesa={mesaConvidado || undefined}
        onFechar={() => setMostrarConta(false)}
      />
    </div>
  );
};

export default CustomerLayout;