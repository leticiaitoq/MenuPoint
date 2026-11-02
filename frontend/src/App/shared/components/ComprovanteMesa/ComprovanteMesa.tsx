import React, { useEffect, useMemo, useState } from 'react';
import { HiOutlineDownload, HiOutlinePrinter, HiOutlineShare, HiX } from 'react-icons/hi';
import { DadosComprovante, gerarImagemComprovante, Linha, ModoComprovante, montarLinhas } from './comprovante';
import './ComprovanteMesa.css';

interface Props {
  aberto: boolean;
  dados: DadosComprovante | null;
  /** Mostra as abas Comanda / Comprovante (a pré-visualização muda de acordo) */
  permitirTrocarModo?: boolean;
  onFechar: () => void;
}

const nomeArquivo = (d: DadosComprovante) =>
  `${d.modo}-${d.mesa.toLowerCase().replace(/\s+/g, '-')}.png`;

/**
 * Comanda da mesa e comprovante de pagamento (layout genérico).
 * Imprimir (impressora comum/térmica pelo navegador), baixar a imagem PNG ou compartilhar
 * (WhatsApp etc.) para mandar ao cliente.
 */
const ComprovanteMesa: React.FC<Props> = ({ aberto, dados, permitirTrocarModo = false, onFechar }) => {
  const [modo, setModo] = useState<ModoComprovante>('comanda');
  const [gerando, setGerando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    if (aberto && dados) {
      setModo(dados.modo);
      setErro(null);
    }
  }, [aberto, dados]);

  useEffect(() => {
    if (!aberto) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onFechar();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [aberto, onFechar]);

  const atual = useMemo(() => (dados ? { ...dados, modo } : null), [dados, modo]);
  const linhas = useMemo(() => (atual ? montarLinhas(atual) : []), [atual]);

  if (!aberto || !atual) return null;

  const baixar = async () => {
    setGerando(true);
    setErro(null);
    try {
      const blob = await gerarImagemComprovante(linhas);
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = nomeArquivo(atual);
      link.click();
      URL.revokeObjectURL(url);
    } catch {
      setErro('Não foi possível gerar a imagem.');
    } finally {
      setGerando(false);
    }
  };

  const compartilhar = async () => {
    setGerando(true);
    setErro(null);
    try {
      const blob = await gerarImagemComprovante(linhas);
      const arquivo = new File([blob], nomeArquivo(atual), { type: 'image/png' });
      const nav = navigator as Navigator & { canShare?: (d: ShareData) => boolean };
      if (nav.share && nav.canShare?.({ files: [arquivo] })) {
        await nav.share({ files: [arquivo], title: atual.modo === 'comprovante' ? 'Comprovante' : 'Comanda' });
      } else {
        // Navegador sem compartilhamento de arquivos: baixa a imagem para enviar manualmente
        await baixar();
      }
    } catch (err: any) {
      if (err?.name !== 'AbortError') setErro('Não foi possível compartilhar a imagem.');
    } finally {
      setGerando(false);
    }
  };

  const renderLinha = (ln: Linha, i: number) => {
    if (ln.tipo === 'espaco') return <div key={i} className="comprov__espaco" />;
    if (ln.tipo === 'divisor') return <hr key={i} className="comprov__divisor" />;
    if (ln.tipo === 'texto') {
      return (
        <p
          key={i}
          className={[
            'comprov__texto',
            ln.alinhar === 'centro' ? 'comprov__texto--centro' : '',
            ln.negrito ? 'comprov__negrito' : '',
            ln.grande ? 'comprov__grande' : '',
            ln.pequeno ? 'comprov__pequeno' : '',
          ].join(' ')}
        >
          {ln.texto}
        </p>
      );
    }
    return (
      <div key={i} className={`comprov__par${ln.negrito ? ' comprov__negrito' : ''}${ln.recuo ? ' comprov__recuo' : ''}`}>
        <span>{ln.esquerda}</span>
        <span>{ln.direita}</span>
      </div>
    );
  };

  return (
    <div className="comprov__overlay" onClick={onFechar}>
      <div className="comprov__modal" role="dialog" aria-modal="true" aria-label="Comanda e comprovante" onClick={(e) => e.stopPropagation()}>
        <div className="comprov__header">
          <h3>{atual.modo === 'comprovante' ? 'Comprovante de pagamento' : 'Comanda da mesa'}</h3>
          <button className="comprov__fechar" onClick={onFechar} aria-label="Fechar"><HiX /></button>
        </div>

        {permitirTrocarModo && (
          <div className="comprov__abas" role="tablist">
            <button role="tab" aria-selected={modo === 'comanda'} className={modo === 'comanda' ? 'comprov__aba--ativa' : ''} onClick={() => setModo('comanda')}>
              Comanda (pedidos feitos)
            </button>
            <button role="tab" aria-selected={modo === 'comprovante'} className={modo === 'comprovante' ? 'comprov__aba--ativa' : ''} onClick={() => setModo('comprovante')}>
              Comprovante
            </button>
          </div>
        )}

        <div className="comprov__corpo">
          {/* É só isto que vai para o papel */}
          <div className="comprov-folha">{linhas.map(renderLinha)}</div>
        </div>

        {erro && <p className="comprov__erro" role="alert">{erro}</p>}

        <div className="comprov__acoes">
          <button className="comprov__btn comprov__btn--sec" onClick={baixar} disabled={gerando}>
            <HiOutlineDownload /> Baixar imagem
          </button>
          <button className="comprov__btn comprov__btn--sec" onClick={() => void compartilhar()} disabled={gerando}>
            <HiOutlineShare /> Compartilhar
          </button>
          <button className="comprov__btn comprov__btn--prim" onClick={() => window.print()}>
            <HiOutlinePrinter /> Imprimir
          </button>
        </div>
      </div>
    </div>
  );
};

export default ComprovanteMesa;
