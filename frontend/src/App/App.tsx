import React from 'react';
import { AuthProvider } from './shared/contexts/Authcontext';
import { ClienteAuthProvider } from './shared/contexts/ClienteAuthContext';
import { CarrinhoProvider } from './shared/contexts/CarrinhoContext';
import { EstabelecimentoProvider } from './shared/contexts/Estabelecimentocontext';
import AppRoutes from './routes/Index';

const App: React.FC = () => {
  return (
    <AuthProvider>
      <ClienteAuthProvider>
        <EstabelecimentoProvider>
        <CarrinhoProvider>
          <AppRoutes />
        </CarrinhoProvider>
        </EstabelecimentoProvider>
      </ClienteAuthProvider>
    </AuthProvider>
  );
};

export default App;