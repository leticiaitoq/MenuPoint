import React, { useState } from 'react';
import { HiPlus, HiX } from 'react-icons/hi';
import RestaurantLayout from '../../../../shared/components/layout/Restaurantelayout';
import './GestaoMesas.css';

// ── Tipos
type StatusMesa = 'livre' | 'ocupada' | 'reservada';

interface Mesa {
  id: string;
  numero: number;
  capacidade: number;
  status: StatusMesa;
}

// ── Mock (substituir por API futuramente)
const MESAS_MOCK: Mesa[] = [
  { id: 'm1',  numero: 1,  capacidade: 4,  status: 'ocupada'   },
  { id: 'm2',  numero: 2,  capacidade: 6,  status: 'livre'     },
  { id: 'm3',  numero: 3,  capacidade: 4,  status: 'ocupada'   },
  { id: 'm4',  numero: 4,  capacidade: 4,  status: 'ocupada'   },
  { id: 'm5',  numero: 5,  capacidade: 2,  status: 'livre'     },
  { id: 'm6',  numero: 6,  capacidade: 8,  status: 'reservada' },
  { id: 'm7',  numero: 7,  capacidade: 5,  status: 'reservada' },
  { id: 'm8',  numero: 8,  capacidade: 4,  status: 'livre'     },
  { id: 'm9',  numero: 9,  capacidade: 4,  status: 'livre'     },
  { id: 'm10', numero: 10, capacidade: 6,  status: 'livre'     },
  { id: 'm11', numero: 11, capacidade: 12, status: 'ocupada'   },
  { id: 'm12', numero: 12, capacidade: 4,  status: 'livre'     },
];



const GestaoMesas: React.FC = () => {

  const [mesas, setMesas]             = useState<Mesa[]>(MESAS_MOCK);
  const [modalAberto, setModalAberto] = useState(false);
  const [capacidade, setCapacidade]   = useState('4');
  const [erro, setErro]               = useState('');

  const mesasLivres = mesas.filter((m) => m.status === 'livre').length;



  // ── Adiciona nova mesa com número sequencial
  const handleAdicionarMesa = () => {
    if (!capacidade || Number(capacidade) < 1) {
      setErro('Informe uma capacidade válida.');
      return;
    }

    const proximoNumero = mesas.length > 0
      ? Math.max(...mesas.map((m) => m.numero)) + 1
      : 1;

    const novaMesa: Mesa = {
      id:         `m${Date.now()}`,
      numero:     proximoNumero,
      capacidade: Number(capacidade),
      status:     'livre',
    };

    setMesas((prev) => [...prev, novaMesa]);
    setCapacidade('4');
    setErro('');
    setModalAberto(false);
  };

  const abrirModal = () => {
    setCapacidade('4');
    setErro('');
    setModalAberto(true);
  };



  return (
    <RestaurantLayout>
      <div className="mesas">

        {/* ── Cabeçalho ── */}
        <div className="mesas__header">
          <h2 className="mesas__titulo">Gestão de mesas</h2>
          <button className="mesas__btn-adicionar" onClick={abrirModal}>
            <HiPlus /> Adicionar Mesas
          </button>
        </div>

        {/* ── Legenda ── */}
        <div className="mesas__container">

        <div className="mesas__legenda">
          <span className="mesas__legenda-item mesas__legenda-item--livre">● Livre</span>
          <span className="mesas__legenda-item mesas__legenda-item--ocupada">● Ocupada</span>
          <span className="mesas__legenda-item mesas__legenda-item--reservada">● Reservada</span>
        </div>

        {/* ── Grid de mesas ── */}
        <div className="mesas__grid">
          {mesas.map((mesa) => (
            <div key={mesa.id} className={`mesas__card mesas__card--${mesa.status}`}>
              <span className="mesas__numero">{mesa.numero}</span>
              <span className="mesas__capacidade">{mesa.capacidade} Pessoas</span>
            </div>
          ))}
        </div>
        </div>
        
        {/* ── Rodapé ── */}
        <div className="mesas__rodape">
          <span className="mesas__rodape-texto">{mesasLivres} Mesas Disponíveis</span>
        </div>

        {/* ── Modal Adicionar Mesa ── */}
        {modalAberto && (
          <div className="mesas__overlay" onClick={() => setModalAberto(false)}>
            <div className="mesas__modal" onClick={(e) => e.stopPropagation()}>

              <div className="mesas__modal-header">
                <h3>Adicionar Mesa</h3>
                <button className="mesas__modal-fechar" onClick={() => setModalAberto(false)}>
                  <HiX />
                </button>
              </div>

              <div className="mesas__modal-corpo">
                <p className="mesas__modal-info">
                  A nova mesa será cadastrada como <strong>Mesa {mesas.length + 1}</strong>.
                </p>

                <div className="mesas__campo">
                  <label className="mesas__label">Capacidade (pessoas)</label>
                  <input
                    className="mesas__input"
                    type="number"
                    min="1"
                    value={capacidade}
                    onChange={(e) => setCapacidade(e.target.value)}
                  />
                </div>

                {erro && <p className="mesas__erro">{erro}</p>}
              </div>

              <div className="mesas__modal-acoes">
                <button className="mesas__btn-cancelar" onClick={() => setModalAberto(false)}>
                  Cancelar
                </button>
                <button className="mesas__btn-salvar" onClick={handleAdicionarMesa}>
                  <HiPlus /> Adicionar
                </button>
              </div>

            </div>
          </div>
        )}

      </div>
    </RestaurantLayout>
  );
};

export default GestaoMesas;