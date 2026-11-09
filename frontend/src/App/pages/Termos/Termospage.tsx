import React, { useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { termsContent } from '../../shared/components/TermsModal/termsContent';
import './Termospage.css';

/**
 * Página pública com os Termos de Uso e a Política de Privacidade.
 *
 * Usa o MESMO `termsContent.ts` do modal do cadastro: o texto existe em um só lugar.
 * Editou o texto lá, muda aqui e no cadastro ao mesmo tempo.
 *
 * Rota: /termos
 * A Política de Privacidade é a seção "privacidade-lgpd" do mesmo documento:
 *   /termos#privacidade-lgpd
 */
const TermosPage: React.FC = () => {
  const { hash } = useLocation();

  // O React Router não rola sozinho até o #âncora: fazemos aqui.
  useEffect(() => {
    if (hash) {
      document.getElementById(decodeURIComponent(hash.slice(1)))?.scrollIntoView();
    } else {
      window.scrollTo(0, 0);
    }
  }, [hash]);

  return (
    <div className="termos">
      <header className="termos__topo">
        <Link to="/" className="termos__marca" aria-label="MenuPoint — início">
          <span className="termos__marca-menu">Menu</span>
          <span className="termos__marca-point">Point</span>
        </Link>
      </header>

      <main className="termos__conteudo">
        <h1 className="termos__titulo">{termsContent.tituloDocumento}</h1>
        <p className="termos__atualizacao">Última atualização: {termsContent.ultimaAtualizacao}</p>

        <p className="termos__intro">{termsContent.introducao}</p>

        <nav className="termos__indice" aria-label="Índice">
          <h2 className="termos__indice-titulo">Índice</h2>
          <ol className="termos__indice-lista">
            {termsContent.secoes.map((secao) => (
              <li key={secao.id}>
                <a href={`#${secao.id}`}>{secao.titulo.replace(/^\d+\.\s*/, '')}</a>
              </li>
            ))}
          </ol>
        </nav>

        {termsContent.secoes.map((secao) => (
          <section key={secao.id} id={secao.id} className="termos__secao">
            <h2 className="termos__secao-titulo">{secao.titulo}</h2>
            {secao.paragrafos.map((paragrafo, i) => (
              <p key={`${secao.id}-${i}`} className="termos__paragrafo">
                {paragrafo}
              </p>
            ))}
          </section>
        ))}

        <p className="termos__rodape">{termsContent.rodape}</p>
      </main>
    </div>
  );
};

export default TermosPage;