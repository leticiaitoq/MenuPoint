import React, { useRef, useState } from 'react';
import { HiPlus, HiX, HiDownload, HiPrinter } from 'react-icons/hi';
import { MdQrCode2 } from 'react-icons/md';
import { QRCodeSVG, QRCodeCanvas } from 'qrcode.react';
import RestaurantLayout from '../../../../shared/components/layout/Restaurantelayout';
import './GestaoMesas.css';

// ── Tipos ──────────────────────────────────────────────────────────────────────
type StatusMesa = 'livre' | 'ocupada' | 'reservada';

interface Mesa {
  id: string;
  numero: number;
  capacidade: number;
  status: StatusMesa;
}

// ── URL base do cardápio que o cliente acessa ao escanear o QR ─────────────────
// Usa a variável de ambiente do projeto. Em produção vira o domínio real.
const BASE_URL = process.env.REACT_APP_API_URL ?? 'http://localhost:3333';

// ── Mock (substituir por API futuramente) ──────────────────────────────────────
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

// ── Componente ─────────────────────────────────────────────────────────────────
const GestaoMesas: React.FC = () => {

  const [mesas, setMesas]             = useState<Mesa[]>(MESAS_MOCK);
  const [modalAberto, setModalAberto] = useState(false);
  const [capacidade, setCapacidade]   = useState('4');
  const [erro, setErro]               = useState('');

  // mesaSelecionada guarda qual mesa está com o modal de QR aberto.
  // null = nenhum modal de QR aberto.
  const [mesaSelecionada, setMesaSelecionada] = useState<Mesa | null>(null);

  // Ref apontando para o <canvas> do QR — usado só no download do PNG.
  // O QRCodeCanvas renderiza um <canvas> real no DOM, então podemos
  // chamar canvas.toDataURL() para extrair os pixels como imagem.
  const qrCanvasRef = useRef<HTMLDivElement>(null);

  const mesasLivres = mesas.filter((m) => m.status === 'livre').length;

  // ── URL que será codificada dentro do QR code ──────────────────────────────
  // Quando o cliente escanear, o celular abre essa URL — que leva ao cardápio
  // da mesa específica (número passado como parâmetro de rota).
  const urlDaMesa = (numero: number) => `${BASE_URL}/mesa/${numero}`;

  // ── Adiciona nova mesa ─────────────────────────────────────────────────────
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

  // ── Download do QR como PNG ────────────────────────────────────────────────
  // Procura o elemento <canvas> dentro do div ref, converte para DataURL
  // (string base64 da imagem) e dispara o download via link temporário.
  const handleDownload = () => {
    if (!mesaSelecionada || !qrCanvasRef.current) return;

    const canvas = qrCanvasRef.current.querySelector('canvas');
    if (!canvas) return;

    const url      = canvas.toDataURL('image/png');
    const link     = document.createElement('a');
    link.href      = url;
    link.download  = `qrcode-mesa-${mesaSelecionada.numero}.png`;
    link.click();
  };

  // ── Impressão do QR ────────────────────────────────────────────────────────
  // Abre uma nova janela com apenas o QR e o título da mesa,
  // chama window.print() e fecha em seguida.
  // O SVG é usado aqui (não canvas) porque SVG escala sem perder qualidade
  // na impressão, independente da resolução da impressora.
  const handleImprimir = () => {
    if (!mesaSelecionada) return;

    const svgEl = qrCanvasRef.current?.querySelector('svg');
    if (!svgEl) return;

    const svgStr    = new XMLSerializer().serializeToString(svgEl);
    const janela    = window.open('', '_blank', 'width=400,height=500');
    if (!janela) return;

    janela.document.write(`
      <html>
        <head>
          <title>QR Code - Mesa ${mesaSelecionada.numero}</title>
          <style>
            body { display: flex; flex-direction: column; align-items: center;
                   justify-content: center; height: 100vh; font-family: sans-serif;
                   gap: 16px; }
            h2   { margin: 0; font-size: 20px; color: #333; }
            p    { margin: 0; font-size: 14px; color: #888; }
          </style>
        </head>
        <body>
          <h2>Mesa ${mesaSelecionada.numero}</h2>
          <p>${mesaSelecionada.capacidade} pessoas</p>
          ${svgStr}
          <p>${urlDaMesa(mesaSelecionada.numero)}</p>
          <script>window.onload = () => { window.print(); window.close(); }<\/script>
        </body>
      </html>
    `);
    janela.document.close();
  };

  // ── Render ─────────────────────────────────────────────────────────────────
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

                {/* Botão de QR — abre o modal passando a mesa clicada */}
                <button
                  className="mesas__btn-qr"
                  onClick={() => setMesaSelecionada(mesa)}
                  aria-label={`Ver QR Code da Mesa ${mesa.numero}`}
                >
                  <MdQrCode2 />
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* ── Rodapé ── */}
        <div className="mesas__rodape">
          <span className="mesas__rodape-texto">{mesasLivres} Mesas Disponíveis</span>
        </div>

        {/* ── Modal: Adicionar Mesa ── */}
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

        {/* ── Modal: QR Code da Mesa ── */}
        {mesaSelecionada && (
          <div className="mesas__overlay" onClick={() => setMesaSelecionada(null)}>
            <div className="mesas__modal mesas__modal--qr" onClick={(e) => e.stopPropagation()}>

              <div className="mesas__modal-header">
                <h3>QR Code — Mesa {mesaSelecionada.numero}</h3>
                <button className="mesas__modal-fechar" onClick={() => setMesaSelecionada(null)}>
                  <HiX />
                </button>
              </div>

              <div className="mesas__modal-corpo mesas__modal-corpo--qr">
                <p className="mesas__modal-info">
                  Escaneie para acessar o cardápio da{' '}
                  <strong>Mesa {mesaSelecionada.numero}</strong>{' '}
                  ({mesaSelecionada.capacidade} pessoas).
                </p>

                {/*
                  div ref usado para localizar os elementos SVG e Canvas no DOM.
                  Renderizamos os dois QRs ao mesmo tempo:
                  - QRCodeSVG → visível na tela e usado na impressão (escala perfeitamente)
                  - QRCodeCanvas → escondido, usado apenas para gerar o PNG do download
                */}
                <div className="mesas__qr-wrap" ref={qrCanvasRef}>
                  {/* SVG — exibido na tela e na impressão */}
                  <QRCodeSVG
                    value={urlDaMesa(mesaSelecionada.numero)}
                    size={200}
                    bgColor="#ffffff"
                    fgColor="#1a1a1a"
                    level="H"
                  />

                  {/* Canvas — invisível, só para o download PNG */}
                  <div style={{ display: 'none' }}>
                    <QRCodeCanvas
                      value={urlDaMesa(mesaSelecionada.numero)}
                      size={400}
                      bgColor="#ffffff"
                      fgColor="#1a1a1a"
                      level="H"
                    />
                  </div>
                </div>

                <p className="mesas__qr-url">{urlDaMesa(mesaSelecionada.numero)}</p>
              </div>

              <div className="mesas__modal-acoes">
                <button className="mesas__btn-cancelar" onClick={() => setMesaSelecionada(null)}>
                  Fechar
                </button>
                <button className="mesas__btn-imprimir" onClick={handleImprimir}>
                  <HiPrinter /> Imprimir
                </button>
                <button className="mesas__btn-salvar" onClick={handleDownload}>
                  <HiDownload /> Baixar PNG
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