import React, { useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import MesaPublicaService, { MesaPublica } from '../../../services/mesaPublica.service';
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

  // Mesa reservada para agora: o cliente confirma a reserva (telefone) antes de ocupar a mesa
  const [reservada, setReservada] = useState<{ hora: string } | null>(null);
  const [telefone, setTelefone] = useState('');
  const [validando, setValidando] = useState(false);
  const [erroValidacao, setErroValidacao] = useState('');
  const mesaPendente = useRef<MesaPublica | null>(null);
  const entrarRef = useRef<((mesa: MesaPublica) => void) | undefined>(undefined);

  useEffect(() => {
    if (!token) {
      setErro('Link de mesa inválido.');
      return;
    }

    let cancelado = false;
    setErro(null);

    // Grava a mesa na sessão do convidado e abre o cardápio da mesa
    const entrar = (mesa: MesaPublica) => {
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
    };
    entrarRef.current = entrar;

    MesaPublicaService.buscarPorToken(token)
      .then(async (mesa) => {
        if (cancelado) return;

        if (mesa.reserva_agora) {
          // Logado na conta que reservou: entra direto. Os demais validam a reserva.
          if (contexto.current.isAuthenticated) {
            try {
              await MesaPublicaService.registrarChegada(token);
              if (!cancelado) entrar(mesa);
              return;
            } catch {
              /* não é o dono da reserva: cai na validação por telefone */
            }
          }
          if (cancelado) return;
          mesaPendente.current = mesa;
          setReservada({ hora: mesa.reserva_agora.hora_inicio });
          return;
        }

        entrar(mesa);
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

  const validarReserva = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token || !mesaPendente.current || validando) return;
    if (telefone.replace(/\D/g, '').length < 10) {
      setErroValidacao('Informe o telefone com DDD, o mesmo usado na reserva.');
      return;
    }
    setValidando(true);
    setErroValidacao('');
    try {
      await MesaPublicaService.registrarChegada(token, telefone);
      entrarRef.current?.(mesaPendente.current);
    } catch (err: any) {
      setErroValidacao(
        err?.response?.data?.message ?? 'Não foi possível confirmar a reserva. Tente de novo.'
      );
    } finally {
      setValidando(false);
    }
  };

  return (
    <div className="mesa-qr">
      {reservada ? (
        <form className="mesa-qr__card" onSubmit={validarReserva}>
          <h1 className="mesa-qr__titulo">Mesa reservada</h1>
          <p className="mesa-qr__texto">
            Esta mesa está reservada para as {reservada.hora}. Se a reserva é sua, informe o telefone
            usado nela para confirmar sua chegada.
          </p>
          <input
            className="mesa-qr__input"
            type="tel"
            inputMode="tel"
            placeholder="(00) 00000-0000"
            value={telefone}
            onChange={(e) => setTelefone(e.target.value)}
            autoFocus
          />
          {erroValidacao && (
            <p className="mesa-qr__erro" role="alert">
              {erroValidacao}
            </p>
          )}
          <button className="mesa-qr__btn" type="submit" disabled={validando}>
            {validando ? 'Confirmando…' : 'Confirmar minha chegada'}
          </button>
        </form>
      ) : erro ? (
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
