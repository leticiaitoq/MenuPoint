import React from "react";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import LoginPage from "../pages/auth/LoginPage";
import RegisterPage from "../pages/auth/RegisterPage";
import AssinaturaSucesso from "../pages/assinatura/AssinaturaSucesso";
import NovaSenha from "../pages/auth/NovaSenha";
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
import GestaoCate from '../pages/Restaurante/Produtos/Categoria/GestaoCate';
import GestaoMesas from "../pages/Restaurante/Gestão/Mesas/GestaoMesas";
import InfoRetirada from "../pages/cliente/Retirada/InfoRetirada";
import PerfilCliente from "../pages/cliente/Perfil/PerfilCliente";
import PerfilLocal from "../pages/ClienteLocal/Perfil/PerfilLocal";
import Fila from "../pages/Restaurante/Gestão/Fila/Fila";
import Relatorios from "../pages/Restaurante/Gestão/Relatorios/Relatorios";
import RestauranteLink from "../pages/cliente/RestauranteLink/RestauranteLink";
import { RotaProtegida } from "../shared/components/RotaProtegida";
import { RotaProtegidaCliente } from "../shared/components/RotaProtegidaCliente";
import { RotaComRestaurante } from "../shared/components/RotaComRestaurante";
import AcessoPeloLink from "../pages/cliente/AcessoPeloLink/AcessoPeloLink";
import NovaSenhaCliente from "../pages/authCliente/NovaSenhaCliente";
import Config from '../pages/Restaurante/Configuracao/Config';
import VerifyCodePage from "../pages/auth/VerifyCodePage";
import LoginCliente from "../pages/authCliente/LoginCliente";
import RecoverPassCliente from "../pages/authCliente/RecoverPassCliente";
import RegisterCliente from "../pages/authCliente/RegisterCliente";
import VerifyCodeCliente from "../pages/authCliente/VerifyCodeCliente";
import ControlePedidoLocal from "../pages/ClienteLocal/ControlePedido/Controlepedidolocal";
import Persopedido from "../shared/components/PersonalizaPedido/Persopedido";
import GerenPagamentos from "../pages/Restaurante/Gestão/Caixa/GerenPagamentos";
import PagarMesa from "../pages/Restaurante/Gestão/Caixa/PagarMesa";
import PagarParcial from "../pages/Restaurante/Gestão/Caixa/PagarParcial";
import Despesas from "../pages/Restaurante/Gestão/Relatorios/Despesas/Despesa";
import CadDespesa from "../pages/Restaurante/Gestão/Relatorios/Despesas/CadDespesa";
/**
 * Novas telas = Novas rotas aqui (Obrigatorio)
 */
const AppRoutes: React.FC = () => {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/welcomepage" element={<WelcomePage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/r/:slug" element={<RestauranteLink />} />
        <Route path="/acesso-pelo-link" element={<AcessoPeloLink />} />
        <Route path="/login/cliente" element={<LoginCliente />} />
        <Route path="/register/cliente" element={<RegisterCliente />} />
        <Route path="/" element={<RegisterPage />} />
        <Route path="/assinatura/sucesso" element={<AssinaturaSucesso />} />
        <Route path="/nova-senha" element={<NovaSenha />} />
        <Route path="/menulocal" element={<MenuLocal />} />
        <Route path="/recover" element={<RecoverPass />} />
         <Route path="/recover/cliente" element={<RecoverPassCliente />} />
        <Route path="/verify-code" element={<VerifyCodePage />} />   {/* Rota para a página de verificação de código usada tanto para registro quanto para recuperação de senha */ }
        <Route path="/verify-code/cliente" element={<VerifyCodeCliente />} />
        <Route path="/nova-senha/cliente" element={<NovaSenhaCliente />} />
        <Route path="/historicolocal" element={<ControlePedidoLocal />} />
          <Route path="/perfilLocal" element={<PerfilLocal />} />
         <Route path="/personaliza" element={<Persopedido />} />



        {/* Rotas do cliente cadastrado: exigem login do cliente (/login/cliente) */}
        <Route element={<RotaProtegidaCliente />}>
          {/* Dependem do restaurante escolhido pelo link /r/:slug (entrada direta é barrada) */}
          <Route element={<RotaComRestaurante />}>
            <Route path="/dwelcome" element={<DWelcomePage />} />
            <Route path="/menu" element={<MenuCliente />} />
            <Route path="/reserva" element={<Reserva />} />
            <Route path="/endereço" element={<CadastroEndereco />} />
            <Route path="/retirada" element={<InfoRetirada />} />
          </Route>
          <Route path="/historico" element={<ControlePedido />} />
          <Route path="/perfil" element={<PerfilCliente />} />
        </Route>

        {/* Rotas do restaurante: exigem login */}
        <Route element={<RotaProtegida />}>
          <Route path="/restaurante/home" element={<HomeRestaurante /> } />
          <Route path="/restaurante/pedido" element={<Pedido />} />
          <Route path="/restaurante/historico" element={<RestHistorico />} />
          <Route path="/restaurante/produtos" element={<RestProdutos />} />
          <Route path="/restaurante/cadprodutos" element={<CadProdutos />} />
          <Route path="/restaurante/editprodutos/:id" element={<EditProduto />} />
          <Route path="/restaurante/categories" element={<GestaoCate />} />
          <Route path="/restaurante/mesas" element={<GestaoMesas />} />
          <Route path="/restaurante/fila" element={<Fila />} />
          <Route path="/restaurante/relatorios" element={<Relatorios />} />
          <Route path="/restaurante/config" element={<Config />} />
          <Route path="/restaurante/caixa" element={<GerenPagamentos />} />
          <Route path="/restaurante/caixa/pagar" element={<PagarMesa />} />
          <Route path="/restaurante/caixa/pagarParcial" element={<PagarParcial />} />
          <Route path="/restaurante/despesas" element={<Despesas />} />
          <Route path="/restaurante/despesas/cadastrodespe" element={<CadDespesa />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
};

export default AppRoutes;
