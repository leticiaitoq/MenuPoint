import React from 'react';
import { AuthProvider } from './shared/contexts/Authcontext';
import { ClienteAuthProvider } from './shared/contexts/ClienteAuthContext';
import { CarrinhoProvider } from './shared/contexts/CarrinhoContext';
import { RestauranteClienteProvider } from './shared/contexts/RestauranteClienteContext';
import { EstabelecimentoProvider } from './shared/contexts/Estabelecimentocontext';
import { ConvidadoProvider } from './shared/contexts/Convidadocontext';
import { SistemaClienteProvider } from './shared/contexts/SistemaClienteContext';
import AppRoutes from './routes/Index';
import { TemaProvider } from './shared/contexts/TemaContext';

const App: React.FC = () => {
  return (
    <TemaProvider>
    <AuthProvider>
       <ClienteAuthProvider>
        <RestauranteClienteProvider>
          <EstabelecimentoProvider>
            <SistemaClienteProvider>
              <ConvidadoProvider>
                <CarrinhoProvider>
                  <AppRoutes />
                </CarrinhoProvider>
              </ConvidadoProvider>
            </SistemaClienteProvider>
          </EstabelecimentoProvider>
        </RestauranteClienteProvider>
      </ClienteAuthProvider>
    </AuthProvider>
    </TemaProvider>
  );
};

export default App;