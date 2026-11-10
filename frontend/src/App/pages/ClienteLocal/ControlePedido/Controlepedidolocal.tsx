import React, { useCallback, useEffect, useMemo, useState } from 'react';
import CustomerLayout from '../../../shared/components/layout/Customerlayout';
import HistoricoPedidos, { FiltroOrigem } from '../../../shared/components/HistoricoPedidos/HistoricoPedidos';
import { useHistoricoCliente } from '../../../shared/components/HistoricoPedidos/useHistoricoCliente';
import { useConvidado } from '../../../shared/contexts/Convidadocontext';
import { useClienteAuth } from '../../../shared/contexts/ClienteAuthContext';
import MesaPublicaService, { PedidoMesaPublico } from '../../../services/mesaPublica.service';
import type { PedidoHistorico } from '../../../services/pedidoCliente.service';
import './Controlepedidolocal.css';

const INTERVALO_ATUALIZACAO_MS = 15000;

const formatarPrecoLocal = (valor: number): string => `R$ ${valor.toFixed(2).replace('.', ',')}`;

/** Pedido da mesa (rota pública) no formato do histórico compartilhado */
const daMesa = (p: PedidoMesaPublico, mesa: number): PedidoHistorico => ({
  id: p.id,
  numero: p.numero_pedido,
  origem: 'LOCAL',
  modalidade: 'MESA',
  status: p.status,
  criadoEm: p.criado_em,
  total: Number(p.total),
  taxaEntrega: 0,
  formaPagamento: null,
  mesaNumero: mesa,
  restaurante: null,
  endereco: null,
  motivoCancelamento: null,
  itens: p.itens.map((i) => ({
    id: i.id,
    nome: i.produto.nome,
    quantidade: i.quantidade,
    preco: Number(i.preco_unitario) + (i.itens_adicionais ?? []).reduce((s, a) => s + Number(a.preco_extra), 0),
    imagem: i.produto.imagem_url,
  })),
});

/**
 * Histórico do cliente LOCAL (dentro do restaurante).
 *  - Convidado: só a conta aberta da mesa. Quando o caixa fecha a conta, some (nada é guardado).
 *  - Logado: histórico FIXO da conta, com o filtro Restaurante local × Delivery. Mesmo vendo
 *    pedidos de delivery aqui, ele continua no sistema local (nenhum link leva ao delivery).
 */
const ControlePedidoLocal: React.FC = () => {
  const { mesaToken, restauranteSlug } = useConvidado();
  const { isAuthenticated } = useClienteAuth();
  const [origem, setOrigem] = useState<FiltroOrigem>('todos');

  // Pedidos da conta aberta da mesa (convidado: é a lista; logado: só o resumo)
  const [pedidosMesa, setPedidosMesa] = useState<PedidoHistorico[]>([]);
  const [mesaNumero, setMesaNumero] = useState<number | null>(null);
  const [carregandoMesa, setCarregandoMesa] = useState(true);
  const [erroMesa, setErroMesa] = useState<string | null>(null);

  const carregarMesa = useCallback(async () => {
    if (!mesaToken) {
      setCarregandoMesa(false);
      return;
    }
    try {
      const dados = await MesaPublicaService.listarPedidos(mesaToken);
      setMesaNumero(dados.mesa.numero);
      setPedidosMesa(dados.pedidos.map((p) => daMesa(p, dados.mesa.numero)));
      setErroMesa(null);
    } catch (err: any) {
      setErroMesa(err?.response?.data?.message ?? 'Não foi possível carregar os pedidos.');
    } finally {
      setCarregandoMesa(false);
    }
  }, [mesaToken]);

  useEffect(() => {
    void carregarMesa();
    const timer = setInterval(carregarMesa, INTERVALO_ATUALIZACAO_MS);
    return () => clearInterval(timer);
  }, [carregarMesa]);

  // Histórico fixo: só para quem está logado
  const conta = useHistoricoCliente(restauranteSlug, isAuthenticated);

  const totalMesa = useMemo(() => pedidosMesa.reduce((acc, p) => acc + p.total, 0), [pedidosMesa]);

  const resumo =
    mesaToken && mesaNumero !== null && !carregandoMesa && pedidosMesa.length > 0 ? (
      <div className="pedidos-local__resumo">
        <div className="pedidos-local__resumo-item">
          <span>Mesa</span>
          <strong>{String(mesaNumero).padStart(2, '0')}</strong>
        </div>
        <div className="pedidos-local__resumo-item">
          <span>Pedidos</span>
          <strong>{pedidosMesa.length}</strong>
        </div>
        <div className="pedidos-local__resumo-item">
          <span>Total da mesa</span>
          <strong>{formatarPrecoLocal(totalMesa)}</strong>
        </div>
      </div>
    ) : null;

  return (
    <CustomerLayout mode="guest">
      <div className="pedidos-local">
        <h1 className="pedidos-local__titulo">Meus Pedidos</h1>

        {isAuthenticated ? (
          <HistoricoPedidos
            pedidos={conta.pedidos}
            carregando={conta.carregando}
            erro={conta.erro}
            origem={origem}
            onOrigemChange={setOrigem}
            topo={resumo}
            vazioTexto="Seus pedidos ficam guardados aqui. Faça o primeiro pelo cardápio."
          />
        ) : !mesaToken ? (
          <p className="pedidos-local__vazio">Escaneie o QR Code da sua mesa para acompanhar os pedidos.</p>
        ) : (
          <HistoricoPedidos
            pedidos={pedidosMesa}
            carregando={carregandoMesa}
            erro={erroMesa}
            topo={
              <>
                {resumo}
                <p className="hist-cli__aviso">
                  Como convidado, seus pedidos somem quando a conta da mesa for fechada. Entre na sua conta
                  (ícone de perfil) para guardar o histórico.
                </p>
              </>
            }
            vazioTexto={`Ainda não há pedidos na mesa${mesaNumero !== null ? ` ${String(mesaNumero).padStart(2, '0')}` : ''}. Faça o primeiro pelo cardápio.`}
          />
        )}
      </div>
    </CustomerLayout>
  );
};

export default ControlePedidoLocal;
