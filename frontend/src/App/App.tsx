import React from 'react';
import { AuthProvider } from './shared/contexts/Authcontext';
import { CarrinhoProvider } from './shared/contexts/CarrinhoContext';
import AppRoutes from './routes/Index';

const App: React.FC = () => {
  return (
    <AuthProvider>
      <CarrinhoProvider>
        <AppRoutes />
      </CarrinhoProvider>
    </AuthProvider>
  );
};

export default App;