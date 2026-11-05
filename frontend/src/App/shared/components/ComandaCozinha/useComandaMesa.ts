import { useCallback, useRef, useState } from 'react';
import PedidoService from '../../../services/pedido.service';
import ProdutoService from '../../../services/produto.service';
import { mensagemDeErro } from '../../../services/cliente.service';
import { pedidosParaComanda } from './comanda.adapter';
import type { PedidoParaComanda } from './comanda';

export interface MesaDaComanda {
  id: string;
  numero: number;
}

/**
 * Carrega e controla a "Comanda da cozinha" de uma mesa — a MESMA comanda que o Caixa mostra
 * em ⋮ > "Comanda da cozinha": todos os pedidos em andamento da mesa, itens agrupados por
 * categoria. Nada é guardado: a comanda é recalculada a cada abertura, com dados frescos.
 *
 * Uso:
 *   const comanda = useComandaMesa();
 *   <button onClick={() => comanda.abrir({ id, numero })}>Comanda da cozinha</button>
 *   <ComandaCozinha aberta={comanda.mesa !== null} pedido={comanda.pedido} ... />
 */
export function useComandaMesa() {
  const [mesa, setMesa] = useState<MesaDaComanda | null>(null);
  const [pedido, setPedido] = useState<PedidoParaComanda | null>(null);
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const requisicao = useRef(0);

  const carregar = useCallback(async (alvo: MesaDaComanda) => {
    const req = ++requisicao.current;
    setPedido(null);
    setErro(null);
    setCarregando(true);
    try {
      const [pedidos, produtos] = await Promise.all([
        PedidoService.listar({ mesa_id: alvo.id, status: ['RECEBIDO', 'PREPARO', 'PRONTO'] }),
        ProdutoService.listar(),
      ]);
      if (req !== requisicao.current) return; // outra abertura/fechamento aconteceu enquanto buscava

      const categoriaPorProduto: Record<string, string> = {};
      produtos.forEach((p) => {
        if (p.categoria?.nome) categoriaPorProduto[p.id] = p.categoria.nome;
      });

      const comanda = pedidosParaComanda({ mesaNumero: alvo.numero, pedidos, categoriaPorProduto });
      if (comanda) setPedido(comanda);
      else setErro('Esta mesa não tem mais pedidos em andamento. Atualize a fila.');
    } catch (err: any) {
      if (req !== requisicao.current) return;
      setErro(mensagemDeErro(err, 'Não foi possível carregar a comanda da cozinha.'));
    } finally {
      if (req === requisicao.current) setCarregando(false);
    }
  }, []);

  const abrir = useCallback((alvo: MesaDaComanda) => {
    setMesa(alvo);
    void carregar(alvo);
  }, [carregar]);

  const fechar = useCallback(() => {
    requisicao.current++; // descarta qualquer busca em andamento
    setMesa(null);
    setPedido(null);
    setErro(null);
    setCarregando(false);
  }, []);

  const tentarNovamente = useCallback(() => {
    if (mesa) void carregar(mesa);
  }, [mesa, carregar]);

  return { mesa, pedido, carregando, erro, abrir, fechar, tentarNovamente };
}
