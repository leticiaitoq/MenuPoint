import React from "react";
import { BrowserRouter, Routes, Route, Navigate, useLocation } from "react-router-dom";
import { ROTAS_CAIXA } from "./caixaRotas";
import LoginPage from "../pages/auth/LoginPage";
import RegisterPage from "../pages/auth/RegisterPage";
import AssinaturaSucesso from "../pages/assinatura/AssinaturaSucesso";
import PagamentoPage from "../pages/assinatura/PagamentoPage";
import PlanosPage from "../pages/assinatura/PlanosPage";
import NovaSenha from "../pages/auth/NovaSenha";
import WelcomePage from "../pages/ClienteLocal/WelcomePage/WelcomePage";
import MesaQr from "../pages/ClienteLocal/MesaQr/MesaQr";
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
import HistoricoReservas from '../pages/Restaurante/Reservas/HistoricoReservas';
import RestProdutos from '../pages/Restaurante/Produtos/RestProdutos';
import CadProdutos from '../pages/Restaurante/Cadastros/Produtos/CadProdutos';
import EditProduto from '../pages/Restaurante/Cadastros/Produtos/EditProduto';
import GestaoCate from '../pages/Restaurante/Produtos/Categoria/GestaoCate';
import InfoRetirada from "../pages/cliente/Retirada/InfoRetirada";
import PerfilCliente from "../pages/cliente/Perfil/PerfilCliente";
import EnderecosPerfil from "../pages/cliente/Perfil/EnderecosPerfil";
import PerfilLocal from "../pages/ClienteLocal/Perfil/PerfilLocal";
import Fila from "../pages/Restaurante/Gestão/Fila/Fila";
import Relatorios from "../pages/Restaurante/Gestão/Relatorios/Relatorios";
import RestauranteLink from "../pages/cliente/RestauranteLink/RestauranteLink";
import { RotaProtegida } from "../shared/components/RotaProtegida";
import { RotaExigeLogin } from "../shared/components/RotaExigeLogin";
import { LoginObrigatorioProvider } from "../shared/contexts/LoginObrigatorioContext";
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
import AbaterValor from "../pages/Restaurante/Gestão/Caixa/AbaterValor";
import Despesas from "../pages/Restaurante/Gestão/Relatorios/Despesas/Despesa";
import CadDespesa from "../pages/Restaurante/Gestão/Relatorios/Despesas/CadDespesa";
import { EmBreve } from "../pages/Restaurante/Embreve/EmBreve";
import Termospage from "../pages/Termos/Termospage";
import NaoEncontrada from "../pages/NaoEncontrada/NaoEncontrada";
import { ThemeToggleRotasPublicas } from "../shared/components/ThemeToggleFlutuante/ThemeToggleFlutuante";
// O cadastro fica em /cadastro (o site abre com ?plano=).
// O "/" continua aceitando os links antigos (/?plano=pro); sem plano, manda para o site.
const EntradaSistema: React.FC = () => {
  const { search } = useLocation();
  if (search.includes('plano=')) return <Navigate to={`/cadastro${search}`} replace />;
  window.location.replace('/site/index.html');
  return null;
};

// Toda tela nova precisa de uma rota aqui
const AppRoutes: React.FC = () => {
  return (
    <BrowserRouter>
      {/* Modal de "faça login para continuar", precisa ficar dentro do Router */}
      <LoginObrigatorioProvider>
      {/* Botão de tema das telas públicas sem navbar */}
      <ThemeToggleRotasPublicas />
      <Routes>
        <Route path="/welcomepage" element={<WelcomePage />} />
        {/* Link do QR Code da mesa: resolve o token e vai para /welcomepage */}
        <Route path="/mesa/:token" element={<MesaQr />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/r/:slug" element={<RestauranteLink />} />
        <Route path="/acesso-pelo-link" element={<AcessoPeloLink />} />
        <Route path="/login/cliente" element={<LoginCliente />} />
        <Route path="/register/cliente" element={<RegisterCliente />} />
        <Route path="/" element={<EntradaSistema />} />
        <Route path="/cadastro" element={<RegisterPage />} />
        <Route path="/assinatura/sucesso" element={<AssinaturaSucesso />} />
        <Route path="/nova-senha" element={<NovaSenha />} />
        <Route path="/menulocal" element={<MenuLocal />} />
        <Route path="/recover" element={<RecoverPass />} />
         <Route path="/recover/cliente" element={<RecoverPassCliente />} />
        <Route path="/verify-code" element={<VerifyCodePage />} />   {/* Serve para cadastro e para recuperação de senha */}
        <Route path="/verify-code/cliente" element={<VerifyCodeCliente />} />
        <Route path="/nova-senha/cliente" element={<NovaSenhaCliente />} />
        <Route path="/historicolocal" element={<ControlePedidoLocal />} />
          <Route path="/perfilLocal" element={<PerfilLocal />} />
         <Route path="/personaliza" element={<Persopedido />} />
         <Route path="/termos" element={<Termospage />} />


        {/*
          Sistema delivery: só abre para quem entrou pelo link /r/:slug.
          O guard de sistema roda antes do login, então quem está na mesa (QR Code) volta
          para o cardápio da mesa mesmo logado. Aqui dentro dá para navegar sem login;
          reserva, perfil e envio do pedido pedem conta.
          O cliente local usa /menulocal, /historicolocal e /perfilLocal (acima).
        */}
        <Route element={<RotaComRestaurante />}>
          {/* Sem login: início, cardápio, carrinho e histórico (vazio sem conta) */}
          <Route path="/dwelcome" element={<DWelcomePage />} />
          <Route path="/menu" element={<MenuCliente />} />
          <Route path="/historico" element={<ControlePedido />} />

          {/* Exigem login. Sem conta, volta para a tela de origem e mostra o modal de aviso */}
          <Route element={<RotaExigeLogin motivo="reserva" fallback="/dwelcome" />}>
            <Route path="/reserva" element={<Reserva />} />
          </Route>
          <Route element={<RotaExigeLogin motivo="perfil" fallback="/dwelcome" />}>
            <Route path="/perfil" element={<PerfilCliente />} />
            <Route path="/perfil/enderecos" element={<EnderecosPerfil />} />
          </Route>
          {/* Enviar o pedido exige conta, o carrinho é mantido durante o login */}
          <Route element={<RotaExigeLogin motivo="pedido" fallback="/menu" />}>
            <Route path="/endereço" element={<CadastroEndereco />} />
            <Route path="/retirada" element={<InfoRetirada />} />
          </Route>
        </Route>

        {/* Rotas do restaurante, exigem login */}
        <Route element={<RotaProtegida />}>
          <Route path="/planos" element={<PlanosPage />} />
          <Route path="/pagamento" element={<PagamentoPage />} />
          <Route path="/restaurante/home" element={<HomeRestaurante /> } />
          <Route path="/restaurante/pedido" element={<Pedido />} />
          <Route path="/restaurante/historico" element={<RestHistorico />} />
          {/* Não tem item na sidebar, o acesso é pelo botão Histórico da aba Reservas do Caixa */}
          <Route path="/restaurante/reservas/historico" element={<HistoricoReservas />} />
          <Route path="/restaurante/produtos" element={<RestProdutos />} />
          <Route path="/restaurante/cadprodutos" element={<CadProdutos />} />
          <Route path="/restaurante/editprodutos/:id" element={<EditProduto />} />
          <Route path="/restaurante/categories" element={<GestaoCate />} />
          <Route path="/restaurante/fila" element={<Fila />} />
          <Route path="/restaurante/relatorios" element={<Relatorios />} />
          <Route path="/restaurante/config" element={<Config />} />
          <Route path="/restaurante/caixa" element={<GerenPagamentos />} />
          {/* Telas por mesa, o :id é a mesa aberta. Sem id volta para o caixa */}
          <Route path="/restaurante/caixa/pagar" element={<Navigate to={ROTAS_CAIXA.lista} replace />} />
          <Route path={ROTAS_CAIXA.pagarMesaPadrao} element={<PagarMesa />} />
          <Route path="/restaurante/caixa/pagarParcial" element={<Navigate to={ROTAS_CAIXA.lista} replace />} />
          <Route path={ROTAS_CAIXA.pagarParcialPadrao} element={<PagarParcial />} />
          <Route path={ROTAS_CAIXA.abaterValorPadrao} element={<AbaterValor />} />
          <Route path="/restaurante/despesas" element={<Despesas />} />
          <Route path="/restaurante/despesas/cadastrodespe" element={<CadDespesa />} />
          <Route path="/restaurante/embreve" element={<EmBreve />} />
          <Route
            path="/restaurante/whatsapp"
            element={<EmBreve descricao="A integração com o WhatsApp está em desenvolvimento e estará disponível em breve." />}
          />
        </Route>

        {/* Rota inexistente, precisa ser a última */}
        <Route path="*" element={<NaoEncontrada />} />
      </Routes>
      </LoginObrigatorioProvider>
    </BrowserRouter>
  );
};

export default AppRoutes;