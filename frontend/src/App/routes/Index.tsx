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

/**
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
      </Routes>
    </BrowserRouter>
  );
};

export default AppRoutes;
