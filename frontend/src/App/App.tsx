import React from 'react';
import { AuthProvider } from './shared/contexts/Authcontext';
import { CarrinhoProvider } from './shared/contexts/CarrinhoContext';
import { EstabelecimentoProvider } from './shared/contexts/Estabelecimentocontext';
import AppRoutes from './routes/Index';

const App: React.FC = () => {
  return (
    <AuthProvider>
      <EstabelecimentoProvider>
      <CarrinhoProvider>
        <AppRoutes />
      </CarrinhoProvider>
      </EstabelecimentoProvider>
    </AuthProvider>
  );
};

export default App;