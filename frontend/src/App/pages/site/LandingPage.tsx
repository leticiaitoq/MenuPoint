import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import './LandingPage.css';

/**
 * Landing page institucional. Antes era um site estático separado
 * (menupoint.com.br); agora vive dentro do próprio app como rota "/",
 * já que o app assumiu o papel de tela inicial.
 *
 * Os botões dos cards de plano não iniciam mais nenhum checkout aqui:
 * eles só levam pro cadastro (/register, sem plano na URL). A escolha
 * de verdade acontece depois, na tela de pagamento pendente, assim que
 * o e-mail é confirmado — isso evita qualquer risco de o slug do plano
 * na landing page ficar dessincronizado do que o backend espera.
 */

type PlanoSlug = 'starter' | 'pro';

const PRICES: Record<PlanoSlug | 'enterprise', { monthly: number; annual: number }> = {
  starter: { monthly: 97, annual: 81 },
  pro: { monthly: 197, annual: 164 },
  enterprise: { monthly: 397, annual: 331 },
};

const LandingPage: React.FC = () => {
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);
  const [anual, setAnual] = useState(false);

  // Anima cards/seções conforme entram na tela, igual ao site original.
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            (entry.target as HTMLElement).style.opacity = '1';
            (entry.target as HTMLElement).style.transform = 'translateY(0)';
          }
        });
      },
      { threshold: 0.1 }
    );

    const els = document.querySelectorAll<HTMLElement>(
      '.mp-landing .feature-card, .mp-landing .step, .mp-landing .ps-box, .mp-landing .why-items li, .mp-landing .plan-card'
    );
    els.forEach((el) => {
      el.style.opacity = '0';
      el.style.transform = 'translateY(24px)';
      el.style.transition = 'opacity .5s ease, transform .5s ease';
      observer.observe(el);
    });

    return () => observer.disconnect();
  }, []);

  const handleEscolherPlano = (plano: PlanoSlug | 'enterprise') => {
    if (plano === 'enterprise') {
      window.location.href =
        'mailto:contato@menupoint.com.br?subject=Interesse%20no%20Plano%20Enterprise';
      return;
    }
    // A escolha de verdade acontece depois, na tela de pagamento pendente
    // (assim que o e-mail é confirmado) — aqui só levamos pro cadastro.
    navigate('/register');
  };

  const valorExibido = (slug: PlanoSlug | 'enterprise') =>
    anual ? PRICES[slug].annual : PRICES[slug].monthly;

  const textoAnual = (slug: PlanoSlug | 'enterprise') =>
    anual
      ? `R$${valorExibido(slug) * 12}/ano — você economiza R$${
          (PRICES[slug].monthly - PRICES[slug].annual) * 12
        }`
      : '';

  return (
    <div className="mp-landing">
      <nav>
        <div className="nav-inner">
          <a href="#" className="nav-logo">
            <div className="logo-icon">
              <img src="/site-assets/Logo.png" alt="Logo" className="logo-img" />
            </div>
            <img src="/site-assets/Texto.png" alt="MenuPoint" className="texto-img" />
          </a>
          <ul className={`nav-links${menuOpen ? ' open' : ''}`}>
            <li>
              <a href="#features" onClick={() => setMenuOpen(false)}>
                Funcionalidades
              </a>
            </li>
            <li>
              <a href="#how" onClick={() => setMenuOpen(false)}>
                Como funciona
              </a>
            </li>
            <li>
              <a href="#testimonial" onClick={() => setMenuOpen(false)}>
                Depoimentos
              </a>
            </li>
            <li>
              <a href="#pricing" onClick={() => setMenuOpen(false)}>
                Planos
              </a>
            </li>
            <li>
              <a href="#about" onClick={() => setMenuOpen(false)}>
                Sobre
              </a>
            </li>
            <li>
              <a
                href="/login"
                onClick={(e) => {
                  e.preventDefault();
                  setMenuOpen(false);
                  navigate('/login');
                }}
              >
                Entrar
              </a>
            </li>
          </ul>
          <a
            href="/register"
            className="btn-red nav-cta"
            onClick={(e) => {
              e.preventDefault();
              navigate('/register');
            }}
          >
            Começar agora
          </a>
          <button
            className="hamburger"
            aria-label="Menu"
            onClick={() => setMenuOpen((v) => !v)}
          >
            <span></span>
            <span></span>
            <span></span>
          </button>
        </div>
      </nav>

      <section className="hero">
        <div className="container">
          <div className="hero-inner">
            <div>
              <h1>
                <span className="brand">MenuPoint</span>
                <br />
                O point que transforma
                <br />
                fome em vendas
              </h1>
              <p>
                Sistema completo para restaurantes gerenciarem pedidos, cardápios e
                mesas de forma simples, inteligente e eficiente.
              </p>
              <div className="hero-btns">
                <a
                  href="/register"
                  className="btn-red"
                  onClick={(e) => {
                    e.preventDefault();
                    navigate('/register');
                  }}
                >
                  Começar agora
                </a>
                <a href="#how" className="btn-outline">
                  ▶ Como funciona
                </a>
              </div>
              <div className="hero-checks">
                <span>
                  <span className="check">✓</span> Fácil de usar
                </span>
                <span>
                  <span className="check">✓</span> Mais vendas
                </span>
                <span>
                  <span className="check">✓</span> Menos erros
                </span>
              </div>
            </div>
            <img src="/site-assets/Home.png" alt="Home" className="home-img" />
          </div>
        </div>
      </section>

      <section className="problem-solution">
        <div className="container">
          <div className="ps-grid">
            <div className="ps-box">
              <div className="badge">O problema</div>
              <h3>Muitos restaurantes ainda usam:</h3>
              <div className="old-methods">
                <div className="old-method">
                  <div className="icon">📄</div>Papel
                </div>
                <div className="old-method">
                  <div className="icon">📱</div>WhatsApp
                </div>
                <div className="old-method">
                  <div className="icon">🔧</div>Controle manual
                </div>
              </div>
              <p style={{ fontSize: '.85rem', color: 'var(--mp-gray-700)', marginBottom: 12 }}>
                Isso gera:
              </p>
              <ul className="problems-list">
                <li>
                  <span className="x">✗</span> Erros de pedidos
                </li>
                <li>
                  <span className="x">✗</span> Falta de organização
                </li>
                <li>
                  <span className="x">✗</span> Perda de vendas
                </li>
                <li>
                  <span className="x">✗</span> Clientes insatisfeitos
                </li>
              </ul>
            </div>
            <div>
              <img src="/site-assets/Mascote.png" alt="Mascote" className="chef-img" />
              <div className="ps-box" style={{ marginTop: 24 }}>
                <div className="badge">🚀 A solução</div>
                <h3>Com o MenuPoint você:</h3>
                <ul className="solution-list">
                  <li>
                    <span className="check-green">✔</span> Organiza pedidos em tempo real
                  </li>
                  <li>
                    <span className="check-green">✔</span> Controla mesas e atendimento
                  </li>
                  <li>
                    <span className="check-green">✔</span> Gerencia cardápio digital
                  </li>
                  <li>
                    <span className="check-green">✔</span> Aumenta suas vendas
                  </li>
                  <li>
                    <span className="check-green">✔</span> Melhora a experiência do cliente
                  </li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="features" id="features">
        <div className="container">
          <h2 className="section-title">Tudo que seu restaurante precisa</h2>
          <div className="features-grid">
            {[
              ['🛒', 'Gestão de Pedidos', 'Acompanhe todos os pedidos em tempo real e organize sua cozinha.'],
              ['🍔', 'Cardápio Digital', 'Organize produtos, categorias, preços e promoções facilmente.'],
              ['🪑', 'Gestão de Mesas', 'Veja mesas ocupadas, reservas e tempo de permanência.'],
              ['📊', 'Relatórios', 'Acompanhe vendas, faturamento e desempenho do seu restaurante.'],
              ['🏷️', 'Promoções', 'Crie ofertas e combos para atrair mais clientes e vender mais.'],
              ['📱', 'Experiência do Cliente', 'Pedidos rápidos, simples e intuitivos direto do celular.'],
            ].map(([icon, title, desc]) => (
              <div className="feature-card" key={title}>
                <div className="feature-icon">{icon}</div>
                <h4>{title}</h4>
                <p>{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="screenshots">
        <div className="container">
          <h2 className="section-title">Veja o MenuPoint em ação</h2>
          <div className="screens-row">
            {[
              ['📊', 'Dashboard', 'Dashboard'],
              ['📋', 'Pedidos', 'Fila de pedidos'],
              ['🪑', 'Mesas', 'Gestão de mesas'],
              ['🍽️', 'Cardápio', 'Cardápio'],
              ['📜', 'Histórico', 'Histórico de pedidos'],
              ['🏷️', 'Promoções', 'Promoções'],
            ].map(([icon, name, label]) => (
              <div className="screen-item" key={name}>
                <div className="screen-thumb">
                  <div className="screen-icon">{icon}</div>
                  <div className="screen-name">{name}</div>
                </div>
                <span>{label}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="how" id="how">
        <div className="container">
          <h2 className="section-title">Como funciona</h2>
          <div className="steps-row">
            {[
              ['📱', '1', 'Cliente faz o pedido pelo cardápio digital'],
              ['📋', '2', 'Pedido entra na fila e cozinha prepara'],
              ['🍳', '3', 'Pedido fica pronto e é marcado'],
              ['🚀', '4', 'Pedido é entregue ao cliente'],
              ['📈', '5', 'Restaurante acompanha tudo em tempo real'],
            ].map(([icon, num, title], idx, arr) => (
              <React.Fragment key={num}>
                <div className="step">
                  <div className="step-icon">{icon}</div>
                  <div className="step-num">{num}</div>
                  <h4>{title}</h4>
                </div>
                {idx < arr.length - 1 && <div className="step-arrow">→</div>}
              </React.Fragment>
            ))}
          </div>
        </div>
      </section>

      <section className="why-section" id="testimonial">
        <div className="container">
          <div className="why-grid">
            <div className="why-list">
              <h3>Por que usar o MenuPoint?</h3>
              <ul className="why-items">
                <li>
                  <span className="why-icon">💰</span> Aumenta o faturamento
                </li>
                <li>
                  <span className="why-icon">⚡</span> Agiliza o atendimento
                </li>
                <li>
                  <span className="why-icon">✅</span> Reduz erros
                </li>
                <li>
                  <span className="why-icon">🌟</span> Moderniza seu restaurante
                </li>
              </ul>
            </div>
            <div className="testimonial-box">
              <div>
                <div className="quote-mark">"</div>
                <p>
                  Depois que começamos a usar o MenuPoint, nossos pedidos ficaram muito
                  mais organizados e aumentamos nossas vendas. Hoje já não conseguimos
                  mais trabalhar sem ele!
                </p>
              </div>
              <div className="testi-author">
                <div className="testi-avatar">JS</div>
                <div>
                  <strong>João Silva</strong>
                  <small>Proprietário do Restaurante Sabor Caseiro</small>
                </div>
              </div>
            </div>
            <div className="restaurant-img">
              <div className="ri-icon">🍽️</div>
              <div className="ri-text">
                Restaurantes que
                <br />
                já usam o MenuPoint
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="pricing" id="pricing">
        <div className="container">
          <h2 className="section-title">Planos para todo tamanho de restaurante</h2>

          <div className="pricing-toggle">
            <span className={`toggle-label${!anual ? ' active' : ''}`}>Mensal</span>
            <label className="toggle-wrap">
              <input
                type="checkbox"
                checked={anual}
                onChange={(e) => setAnual(e.target.checked)}
              />
              <span className="toggle-knob"></span>
            </label>
            <span className={`toggle-label${anual ? ' active' : ''}`}>Anual</span>
            <span className="discount-badge">2 meses grátis</span>
          </div>

          <div className="pricing-grid">
            {/* BÁSICO */}
            <div className="plan-card">
              <div className="plan-name">Básico</div>
              <div className="plan-desc">Ideal para quem está começando</div>
              <div className="plan-price">
                <sup>R$</sup>
                <span className="val">{valorExibido('starter')}</span>
                <span className="period">/mês</span>
              </div>
              <div className="plan-price-annual">{textoAnual('starter')}</div>
              <hr className="plan-divider" />
              <ul className="plan-features">
                <li>
                  <span className="fi">✔</span> Gestão de pedidos
                </li>
                <li>
                  <span className="fi">✔</span> Cardápio digital
                </li>
                <li>
                  <span className="fi">✔</span> Até 10 mesas
                </li>
                <li>
                  <span className="fi">✔</span> 1 usuário / operador
                </li>
                <li>
                  <span className="fi">✔</span> Suporte por e-mail
                </li>
                <li className="disabled">
                  <span className="fi off">✔</span> Relatórios avançados
                </li>
                <li className="disabled">
                  <span className="fi off">✔</span> Promoções e combos
                </li>
                <li className="disabled">
                  <span className="fi off">✔</span> Múltiplos usuários
                </li>
              </ul>
              <button
                className="plan-btn filled"
                onClick={() => handleEscolherPlano('starter')}
              >
                Começar agora
              </button>
            </div>

            {/* PRO (popular) */}
            <div className="plan-card popular">
              <span className="popular-tag">⭐ Mais popular</span>
              <div className="plan-name" style={{ color: 'var(--mp-red)' }}>
                Pro
              </div>
              <div className="plan-desc">Para restaurantes em crescimento</div>
              <div className="plan-price">
                <sup>R$</sup>
                <span className="val">{valorExibido('pro')}</span>
                <span className="period">/mês</span>
              </div>
              <div className="plan-price-annual">{textoAnual('pro')}</div>
              <hr className="plan-divider" />
              <ul className="plan-features">
                <li>
                  <span className="fi">✔</span> Tudo do plano Básico
                </li>
                <li>
                  <span className="fi">✔</span> Mesas ilimitadas
                </li>
                <li>
                  <span className="fi">✔</span> Até 5 usuários
                </li>
                <li>
                  <span className="fi">✔</span> Relatórios completos
                </li>
                <li>
                  <span className="fi">✔</span> Promoções e combos
                </li>
                <li>
                  <span className="fi">✔</span> Histórico de pedidos
                </li>
                <li>
                  <span className="fi">✔</span> Suporte via WhatsApp
                </li>
                <li className="disabled">
                  <span className="fi off">✔</span> API de integrações
                </li>
              </ul>
              <button
                className="plan-btn filled"
                onClick={() => handleEscolherPlano('pro')}
              >
                Começar agora
              </button>
            </div>

            {/* ENTERPRISE */}
            <div className="plan-card">
              <div className="plan-name">Enterprise</div>
              <div className="plan-desc">Para redes e franquias</div>
              <div className="plan-price">
                <sup>R$</sup>
                <span className="val">{valorExibido('enterprise')}</span>
                <span className="period">/mês</span>
              </div>
              <div className="plan-price-annual">{textoAnual('enterprise')}</div>
              <hr className="plan-divider" />
              <ul className="plan-features">
                <li>
                  <span className="fi">✔</span> Tudo do plano Pro
                </li>
                <li>
                  <span className="fi">✔</span> Usuários ilimitados
                </li>
                <li>
                  <span className="fi">✔</span> Múltiplas unidades
                </li>
                <li>
                  <span className="fi">✔</span> API de integrações
                </li>
                <li>
                  <span className="fi">✔</span> Dashboard centralizado
                </li>
                <li>
                  <span className="fi">✔</span> Onboarding dedicado
                </li>
                <li>
                  <span className="fi">✔</span> Suporte prioritário 24/7
                </li>
                <li>
                  <span className="fi">✔</span> SLA garantido
                </li>
              </ul>
              <button
                className="plan-btn outline"
                onClick={() => handleEscolherPlano('enterprise')}
              >
                Falar com especialista
              </button>
            </div>
          </div>
        </div>
      </section>

      <section className="about-section" id="about">
        <div className="container">
          <h2 className="section-title">Sobre o MenuPoint</h2>
          <div className="about-grid">
            <div className="about-text">
              <p className="about-lead">
                Nascemos da frustração de ver bons restaurantes perderem vendas por
                causa de processos ultrapassados.
              </p>
              <p>
                Em 2026, um grupo de empreendedores apaixonados por tecnologia e
                gastronomia se uniu com um objetivo claro: criar uma ferramenta
                simples o suficiente para qualquer restaurante usar no primeiro dia,
                mas poderosa o bastante para crescer junto com o negócio.
              </p>
              <p>
                O MenuPoint nasceu para ser o ponto de encontro entre a eficiência
                digital e o calor humano da boa hospitalidade. Hoje, centenas de
                restaurantes em todo o Brasil usam nossa plataforma para atender
                melhor, vender mais e trabalhar com muito menos estresse.
              </p>
              <p>
                <strong>Nossa missão:</strong> transformar a gestão de restaurantes em
                algo tão simples quanto pedir uma pizza.
              </p>
            </div>
            <div className="about-stats">
              <div className="stat-card">
                <div className="stat-num">
                  500<span>+</span>
                </div>
                <div className="stat-label">Restaurantes ativos</div>
              </div>
              <div className="stat-card">
                <div className="stat-num">
                  98<span>%</span>
                </div>
                <div className="stat-label">Satisfação dos clientes</div>
              </div>
              <div className="stat-card">
                <div className="stat-num">
                  2M<span>+</span>
                </div>
                <div className="stat-label">Pedidos processados</div>
              </div>
              <div className="stat-card">
                <div className="stat-num">
                  24<span>h</span>
                </div>
                <div className="stat-label">Suporte disponível</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="cta-band" id="cta">
        <div className="container">
          <h2>Pronto para transformar seu restaurante?</h2>
          <p>O point que transforma fome em vendas</p>
          <a href="#pricing" className="btn-white">
            Começar agora →
          </a>
        </div>
      </section>

      <footer id="about">
        <div className="container">
          <div className="footer-grid">
            <div className="footer-brand">
              <div className="brand">🍽 MenuPoint</div>
              <p>Sistema completo para restaurantes venderem mais e atenderem melhor.</p>
            </div>
            <div className="footer-col">
              <h4>Navegação</h4>
              <ul>
                <li>
                  <a href="#">Início</a>
                </li>
                <li>
                  <a href="#features">Funcionalidades</a>
                </li>
                <li>
                  <a href="#how">Como funciona</a>
                </li>
                <li>
                  <a href="#testimonial">Depoimentos</a>
                </li>
              </ul>
            </div>
            <div className="footer-col">
              <h4>Suporte</h4>
              <ul>
                <li>
                  <a href="https://wa.me/5511999999999" target="_blank" rel="noreferrer">
                    Central de ajuda
                  </a>
                </li>
                <li>
                  <a href="mailto:contato@menupoint.com.br">Contato</a>
                </li>
                <li>
                  <a href="/politica-de-privacidade.html">Política de privacidade</a>
                </li>
                <li>
                  <a href="/termos-de-uso.html">Termos de uso</a>
                </li>
              </ul>
            </div>
            <div className="footer-col">
              <h4>Contato</h4>
              <ul>
                <li>
                  <a href="https://wa.me/5511999999999" target="_blank" rel="noreferrer">
                    WhatsApp
                  </a>
                </li>
                <li>
                  <a href="mailto:contato@menupoint.com.br">E-mail</a>
                </li>
                <li>
                  <a href="https://instagram.com/menupoint" target="_blank" rel="noreferrer">
                    Instagram
                  </a>
                </li>
              </ul>
            </div>
          </div>
          <div className="footer-bottom">© 2026 MenuPoint. Todos os direitos reservados.</div>
        </div>
      </footer>
    </div>
  );
};

export default LandingPage;
