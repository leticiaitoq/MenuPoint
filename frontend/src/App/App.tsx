import React from 'react';
import { AuthProvider } from './shared/contexts/Authcontext';
import { CarrinhoProvider } from './shared/contexts/CarrinhoContext';
import { EstabelecimentoProvider } from './shared/contexts/Estabelecimentocontext';
import { ConvidadoProvider } from './shared/contexts/Convidadocontext';
import AppRoutes from './routes/Index';

const App: React.FC = () => {
  return (
    <AuthProvider>
      <EstabelecimentoProvider>
      <ConvidadoProvider>
      <CarrinhoProvider>
        <AppRoutes />
      </CarrinhoProvider>
      </ConvidadoProvider>
      </EstabelecimentoProvider>
    </AuthProvider>
  );
};

export default App;