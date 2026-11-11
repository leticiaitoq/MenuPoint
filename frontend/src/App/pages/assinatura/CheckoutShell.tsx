import React from 'react';
import { useNavigate } from 'react-router-dom';
import './checkout.css';

// Moldura das telas de assinatura (plano, pagamento e retorno)

interface CheckoutShellProps {
  children: React.ReactNode;
  /** Mostra o link "Voltar" (/planos). Sem valor, não aparece. */
  voltarPara?: string;
}

const CheckoutShell: React.FC<CheckoutShellProps> = ({ children, voltarPara }) => {
  const navigate = useNavigate();
  return (
    <div className="ck">
      <header className="ck__topo">
        <span className="ck__marca" aria-label="MenuPoint">
          Menu<span>Point</span>
        </span>
        <span className="ck__seguro">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <rect x="4" y="11" width="16" height="10" rx="2" />
            <path d="M8 11V7a4 4 0 0 1 8 0v4" />
          </svg>
          Pagamento seguro
        </span>
      </header>

      <div className="ck__corpo">
        <div className="ck__coluna">
          {voltarPara && (
            <button type="button" className="ck__voltar" onClick={() => navigate(voltarPara)}>
              ← Voltar
            </button>
          )}
          <div className="ck__conteudo">{children}</div>
        </div>
        <div className="ck__imagem" style={{ backgroundImage: 'url(/images/Register-Back.png)' }} aria-hidden="true" />
      </div>
    </div>
  );
};

export default CheckoutShell;
