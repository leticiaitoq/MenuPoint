import React, { useCallback, useEffect, useRef, useState } from 'react';
import './RecortadorImagem.css';

interface RecortadorImagemProps {
  /** Arquivo escolhido pelo usuário. null = modal fechado. */
  arquivo: File | null;
  titulo?: string;
  /** 'circulo' = saída quadrada vista num círculo (perfil/logo). 'retangulo' = saída na proporção informada (produto). */
  formato?: 'circulo' | 'retangulo';
  /** Só para 'retangulo': largura ÷ altura (padrão 4/3). */
  proporcao?: number;
  /** Largura, em pixels, da imagem entregue (padrão 512 no círculo, 800 no retângulo). */
  tamanhoSaida?: number;
  /** Recebe a imagem já enquadrada. */
  onConfirmar: (recortada: File) => void;
  onCancelar: () => void;
}

// Largura da área de enquadramento na tela (px)
const AREA_CIRCULO = 260;
const AREA_RETANGULO = 300;
const ZOOM_MIN = 1;
const ZOOM_MAX = 4;

/**
 * Editor de enquadramento: o usuário arrasta a imagem e ajusta o zoom dentro de um círculo.
 * O resultado é um quadrado (o círculo é só a máscara de visualização, como na tela final).
 */
const RecortadorImagem: React.FC<RecortadorImagemProps> = ({
  arquivo,
  titulo = 'Ajustar imagem',
  formato = 'circulo',
  proporcao = 4 / 3,
  tamanhoSaida,
  onConfirmar,
  onCancelar,
}) => {
  const circulo = formato === 'circulo';
  const AREA_W = circulo ? AREA_CIRCULO : AREA_RETANGULO;
  const AREA_H = circulo ? AREA_CIRCULO : Math.round(AREA_RETANGULO / proporcao);
  const saidaW = tamanhoSaida ?? (circulo ? 512 : 800);
  const saidaH = Math.round(saidaW * (AREA_H / AREA_W));

  const [url, setUrl] = useState<string | null>(null);
  const [dims, setDims] = useState<{ w: number; h: number } | null>(null);
  const [zoom, setZoom] = useState(1);
  const [pos, setPos] = useState({ x: 0, y: 0 }); // deslocamento do centro da imagem, em px da tela
  const [processando, setProcessando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const imgRef = useRef<HTMLImageElement>(null);
  const arrasto = useRef<{ px: number; py: number; ox: number; oy: number } | null>(null);

  // Carrega o arquivo escolhido
  useEffect(() => {
    if (!arquivo) {
      setUrl(null);
      setDims(null);
      return;
    }
    const novaUrl = URL.createObjectURL(arquivo);
    setUrl(novaUrl);
    setDims(null);
    setZoom(1);
    setPos({ x: 0, y: 0 });
    setErro(null);
    setProcessando(false);
    return () => URL.revokeObjectURL(novaUrl);
  }, [arquivo]);

  // Escala base: a imagem sempre COBRE a área (sem bordas vazias) em zoom 1
  const base = dims ? Math.max(AREA_W / dims.w, AREA_H / dims.h) : 1;
  const escala = base * zoom;

  // Impede de arrastar até aparecer espaço vazio dentro da área
  const limitar = useCallback(
    (x: number, y: number, z: number) => {
      if (!dims) return { x: 0, y: 0 };
      const e = Math.max(AREA_W / dims.w, AREA_H / dims.h) * z;
      const maxX = Math.max(0, (dims.w * e - AREA_W) / 2);
      const maxY = Math.max(0, (dims.h * e - AREA_H) / 2);
      return {
        x: Math.min(maxX, Math.max(-maxX, x)),
        y: Math.min(maxY, Math.max(-maxY, y)),
      };
    },
    [dims, AREA_W, AREA_H]
  );

  const mudarZoom = (novo: number) => {
    const z = Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, novo));
    setZoom(z);
    setPos((p) => limitar(p.x, p.y, z));
  };

  const iniciarArrasto = (e: React.PointerEvent<HTMLDivElement>) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    arrasto.current = { px: e.clientX, py: e.clientY, ox: pos.x, oy: pos.y };
  };
  const mover = (e: React.PointerEvent<HTMLDivElement>) => {
    const a = arrasto.current;
    if (!a) return;
    setPos(limitar(a.ox + (e.clientX - a.px), a.oy + (e.clientY - a.py), zoom));
  };
  const soltar = () => {
    arrasto.current = null;
  };

  const confirmar = async () => {
    if (!arquivo || !dims || !imgRef.current) return;
    setProcessando(true);
    setErro(null);
    try {
      const comTransparencia = arquivo.type === 'image/png';
      const canvas = document.createElement('canvas');
      canvas.width = saidaW;
      canvas.height = saidaH;
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('canvas');

      if (!comTransparencia) {
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, saidaW, saidaH);
      }

      // Canto superior esquerdo da imagem na área da tela
      const esq = AREA_W / 2 - (dims.w * escala) / 2 + pos.x;
      const topo = AREA_H / 2 - (dims.h * escala) / 2 + pos.y;
      // O que aparece na área, convertido para pixels da imagem original
      const sx = -esq / escala;
      const sy = -topo / escala;

      ctx.drawImage(imgRef.current, sx, sy, AREA_W / escala, AREA_H / escala, 0, 0, saidaW, saidaH);

      const tipo = comTransparencia ? 'image/png' : 'image/jpeg';
      const blob: Blob | null = await new Promise((ok) => canvas.toBlob(ok, tipo, 0.92));
      if (!blob) throw new Error('blob');

      const ext = comTransparencia ? 'png' : 'jpg';
      onConfirmar(new File([blob], `imagem.${ext}`, { type: tipo }));
    } catch {
      setErro('Não foi possível ajustar a imagem. Tente outra.');
      setProcessando(false);
    }
  };

  if (!arquivo) return null;

  return (
    <div className="recortador" role="dialog" aria-modal="true" aria-label={titulo}>
      <div className="recortador__caixa" style={{ maxWidth: AREA_W + 80 }}>
        <h3 className="recortador__titulo">{titulo}</h3>
        <p className="recortador__dica">Arraste a imagem para posicionar e use o zoom para ajustar.</p>

        <div
          className="recortador__area"
          style={{ width: AREA_W, height: AREA_H }}
          onPointerDown={iniciarArrasto}
          onPointerMove={mover}
          onPointerUp={soltar}
          onPointerCancel={soltar}
        >
          {url && (
            <img
              ref={imgRef}
              src={url}
              alt="Pré-visualização"
              draggable={false}
              className="recortador__img"
              onLoad={(e) =>
                setDims({ w: e.currentTarget.naturalWidth, h: e.currentTarget.naturalHeight })
              }
              style={
                dims
                  ? {
                      width: dims.w * escala,
                      height: dims.h * escala,
                      transform: `translate(calc(-50% + ${pos.x}px), calc(-50% + ${pos.y}px))`,
                    }
                  : { visibility: 'hidden' }
              }
            />
          )}
          <div className={`recortador__mascara${circulo ? '' : ' recortador__mascara--retangulo'}`} aria-hidden="true" />
        </div>

        <label className="recortador__zoom">
          <span>−</span>
          <input
            type="range"
            min={ZOOM_MIN}
            max={ZOOM_MAX}
            step={0.01}
            value={zoom}
            onChange={(e) => mudarZoom(Number(e.target.value))}
            aria-label="Zoom"
          />
          <span>+</span>
        </label>

        {erro && <p className="recortador__erro" role="alert">{erro}</p>}

        <div className="recortador__acoes">
          <button type="button" className="recortador__btn" onClick={onCancelar} disabled={processando}>
            Cancelar
          </button>
          <button
            type="button"
            className="recortador__btn recortador__btn--primario"
            onClick={confirmar}
            disabled={processando || !dims}
          >
            {processando ? 'Ajustando…' : 'Salvar'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default RecortadorImagem;
