import React from "react";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import LoginPage from "../pages/auth/LoginPage";
import RegisterPage from "../pages/auth/RegisterPage";
import WelcomePage from "../pages/ClienteLocal/WelcomePage/WelcomePage";
import HomeRestaurante from "../pages/Restaurante/Home/HomeRestaurante";
import DWelcomePage from "../pages/cliente/Welcome/DWelcomePage";
import MenuCliente from "../pages/cliente/Menu/MenuCliente";
import Pedido from "../pages/Restaurante/Cadastros/Pedidos/Pedido";
import MenuLocal from "../pages/ClienteLocal/Menu/MenuLocal";
import RecoverPass from "../pages/auth/RecoverPass";
import Reserva from "../pages/cliente/Reserva/Reserva";
import ControlePedido from "../pages/cliente/ControlePedido/ControlePedido";
import CadastroEndereco from "../pages/cliente/CadastroEnde/CadastroEndereço";
import RestHistorico from '../pages/Restaurante/Historico/RestHistorico';
import RestProdutos from '../pages/Restaurante/Produtos/RestProdutos';
import CadProdutos from '../pages/Restaurante/Cadastros/Produtos/CadProdutos';
import EditProduto from '../pages/Restaurante/Cadastros/Produtos/EditProduto';
import GestãoCate from '../pages/Restaurante/Produtos/Categoria/GestãoCate';
import GestaoMesas from "../pages/Restaurante/Gestão/Mesas/GestaoMesas";
import InfoRetirada from "../pages/cliente/Retirada/InfoRetirada";
import PerfilCliente from "../pages/cliente/Perfil/PerfilCliente";
/**]
 * 
 * Novas telas = Novas rotas aqui (Obrigatorio)
 */
const AppRoutes: React.FC = () => {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/welcomepage" element={<WelcomePage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/" element={<RegisterPage />} />
        <Route path="/restaurante/home" element={<HomeRestaurante /> } />
        <Route path="/dwelcome" element={<DWelcomePage />} />
        <Route path="/menu" element={<MenuCliente />} />
        <Route path="/menulocal" element={<MenuLocal />} />
        <Route path="/restaurante/pedido" element={<Pedido />} />
        <Route path="/recover" element={<RecoverPass />} />
        <Route path="/reserva" element={<Reserva />} />
        <Route path="/historico" element={<ControlePedido />} />
        <Route path="/endereço" element={<CadastroEndereco />} />
        <Route path="/restaurante/historico" element={<RestHistorico />} />
        <Route path="/restaurante/produtos" element={<RestProdutos />} />
         <Route path="/restaurante/cadprodutos" element={<CadProdutos />} />
         <Route path="/restaurante/editprodutos" element={<EditProduto />} />
         <Route path="/restaurante/categories" element={<GestãoCate />} />
         <Route path="/restaurante/mesas" element={<GestaoMesas />} />
         <Route path="/retirada" element={<InfoRetirada />} />
         <Route path="/perfil" element={<PerfilCliente />} />
      </Routes>
    </BrowserRouter>
  );
};

export default AppRoutes;
