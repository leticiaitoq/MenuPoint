import React, { useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import MesaPublicaService from '../../../services/mesaPublica.service';
import { useConvidado } from '../../../shared/contexts/Convidadocontext';
import { useClienteAuth } from '../../../shared/contexts/ClienteAuthContext';
import { useSistemaCliente, ROTA_INICIAL_SISTEMA } from '../../../shared/contexts/SistemaClienteContext';
import { useCarrinho } from '../../../shared/contexts/CarrinhoContext';
import './MesaQr.css';

/**
 * Destino do link/QR Code da mesa: /mesa/:token
 *
 * É a ÚNICA porta de entrada do sistema LOCAL (cliente dentro do restaurante).
 * Descobre a qual mesa (e a qual restaurante) o token pertence, marca esta aba como "local"
 * e guarda a mesa na sessão do convidado.
 *
 *  - Sem login  → /welcomepage (digita o nome)
 *  - Com login  → direto para o cardápio da mesa (/menulocal). NUNCA vai para o delivery:
 *                 a conta é a mesma, mas o sistema é outro.
 *
 * Esta tela NÃO grava o restaurante do delivery (RestauranteClienteContext): é isso que
 * impediria o cliente da mesa de abrir as telas de delivery.
 * Se o token for inválido, a mesa estiver inativa ou o restaurante não aceitar pedidos em
 * mesa, mostra o motivo.
 */
const MesaQr: React.FC = () => {
  const { token } = useParams<{ token: string }>();
  const navigate = useNavigate();
  const { definirConvidado } = useConvidado();
  const { isAuthenticated, cliente } = useClienteAuth();
  const { entrarNoLocal } = useSistemaCliente();
  const { limparCarrinho } = useCarrinho();
  const { estabelecimentoId: restauranteAnteriorId } = useConvidado();

  // Lidos pelo efeito sem entrar nas dependências (não refazer a busca da mesa a cada mudança)
  const contexto = useRef({ isAuthenticated, cliente, entrarNoLocal, limparCarrinho, restauranteAnteriorId });
  contexto.current = { isAuthenticated, cliente, entrarNoLocal, limparCarrinho, restauranteAnteriorId };

  const [erro, setErro] = useState<string | null>(null);
  const [tentativa, setTentativa] = useState(0);

  useEffect(() => {
    if (!token) {
      setErro('Link de mesa inválido.');
      return;
    }

    let cancelado = false;
    setErro(null);

    MesaPublicaService.buscarPorToken(token)
      .then((mesa) => {
        if (cancelado) return;
        const ctx = contexto.current;
        // Mesa de OUTRO restaurante: o carrinho do anterior não vai junto
        const trocouDeRestaurante =
          Boolean(ctx.restauranteAnteriorId) && ctx.restauranteAnteriorId !== mesa.estabelecimento?.id;
        if (trocouDeRestaurante) ctx.limparCarrinho();

        // Esta aba passa a ser do sistema LOCAL (mesa). O delivery fica intocado.
        ctx.entrarNoLocal();

        // Sem nome digitado: quem escaneia agora não herda o nome de outro cliente.
        // Já logado → o nome é o da conta.
        definirConvidado({
          nome: ctx.isAuthenticated ? ctx.cliente?.nome ?? '' : '',
          mesa: String(mesa.numero).padStart(2, '0'),
          mesaId: mesa.id,
          mesaToken: token,
          estabelecimentoId: mesa.estabelecimento?.id,
          restauranteSlug: mesa.estabelecimento?.slug?.trim().toLowerCase(),
          restauranteNome: mesa.estabelecimento?.nome,
          restauranteLogo: mesa.estabelecimento?.logo_url ?? null,
        });

        // Logado pula a tela de convidado e vai direto ao cardápio DA MESA (nunca ao delivery)
        navigate(ctx.isAuthenticated ? ROTA_INICIAL_SISTEMA.local : '/welcomepage', { replace: true });
      })
      .catch((err: any) => {
        if (cancelado) return;
        setErro(
          err?.response?.data?.message ??
            'Não foi possível abrir esta mesa. Verifique sua conexão e tente de novo.'
        );
      });

    return () => {
      cancelado = true;
    };
  }, [token, tentativa, definirConvidado, navigate]);

  return (
    <div className="mesa-qr">
      {erro ? (
        <div className="mesa-qr__card" role="alert">
          <h1 className="mesa-qr__titulo">Não foi possível abrir a mesa</h1>
          <p className="mesa-qr__texto">{erro}</p>
          <button className="mesa-qr__btn" onClick={() => setTentativa((n) => n + 1)}>
            Tentar novamente
          </button>
        </div>
      ) : (
        <p className="mesa-qr__texto" role="status">Abrindo sua mesa…</p>
      )}
    </div>
  );
};

export default MesaQr;
