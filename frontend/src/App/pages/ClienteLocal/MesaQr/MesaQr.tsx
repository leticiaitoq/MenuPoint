import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import MesaPublicaService from '../../../services/mesaPublica.service';
import { useConvidado } from '../../../shared/contexts/Convidadocontext';
import './MesaQr.css';

/**
 * Destino do link/QR Code da mesa: /mesa/:token
 *
 * Descobre a qual mesa (e a qual restaurante) o token pertence, guarda isso na
 * sessão do cliente local e manda direto para a WelcomePage — que já mostra a
 * mesa certa. Se o token for inválido, a mesa estiver inativa ou o restaurante
 * não aceitar pedidos em mesa, mostra o motivo.
 */
const MesaQr: React.FC = () => {
  const { token } = useParams<{ token: string }>();
  const navigate = useNavigate();
  const { definirConvidado } = useConvidado();

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
        // O nome começa vazio: quem escaneia agora não herda o nome de outro cliente
        definirConvidado({
          nome: '',
          mesa: String(mesa.numero).padStart(2, '0'),
          mesaId: mesa.id,
          mesaToken: token,
          estabelecimentoId: mesa.estabelecimento?.id,
          restauranteNome: mesa.estabelecimento?.nome,
          restauranteLogo: mesa.estabelecimento?.logo_url ?? null,
        });
        navigate('/welcomepage', { replace: true });
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
