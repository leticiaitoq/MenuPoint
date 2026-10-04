import React from 'react';
import { AuthProvider } from './shared/contexts/Authcontext';
import { ClienteAuthProvider } from './shared/contexts/ClienteAuthContext';
import { CarrinhoProvider } from './shared/contexts/CarrinhoContext';
import { RestauranteClienteProvider } from './shared/contexts/RestauranteClienteContext';
import { EstabelecimentoProvider } from './shared/contexts/Estabelecimentocontext';
import AppRoutes from './routes/Index';

const App: React.FC = () => {
  return (
    <AuthProvider>
      <ClienteAuthProvider>
        <RestauranteClienteProvider>
          <EstabelecimentoProvider>
            <CarrinhoProvider>
              <AppRoutes />
            </CarrinhoProvider>
          </EstabelecimentoProvider>
        </RestauranteClienteProvider>
      </ClienteAuthProvider>
    </AuthProvider>
  );
};

export default App;