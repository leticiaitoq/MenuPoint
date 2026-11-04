import React, { createContext, useContext, useEffect, useState } from 'react';

type Preferencia = 'sistema' | 'claro' | 'escuro';
const CHAVE = '@menupoint:tema';

interface TemaCtx {
  preferencia: Preferencia;
  escuro: boolean;
  setPreferencia: (p: Preferencia) => void;
  alternar: () => void;
}

const TemaContext = createContext<TemaCtx | null>(null);

const lerPreferencia = (): Preferencia => {
  try {
    const v = localStorage.getItem(CHAVE);
    return v === 'claro' || v === 'escuro' ? v : 'sistema';
  } catch { return 'sistema'; }
};

export const TemaProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [preferencia, setPreferencia] = useState<Preferencia>(lerPreferencia);
  const [sistemaEscuro, setSistemaEscuro] = useState(
    () => window.matchMedia('(prefers-color-scheme: dark)').matches
  );

  useEffect(() => {
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const aoMudar = (e: MediaQueryListEvent) => setSistemaEscuro(e.matches);
    mq.addEventListener('change', aoMudar);
    return () => mq.removeEventListener('change', aoMudar);
  }, []);

  const escuro = preferencia === 'escuro' || (preferencia === 'sistema' && sistemaEscuro);

  useEffect(() => {
    document.documentElement.dataset.theme = escuro ? 'dark' : 'light';
    try { localStorage.setItem(CHAVE, preferencia); } catch {}
  }, [escuro, preferencia]);

  const alternar = () => setPreferencia(escuro ? 'claro' : 'escuro');

  return (
    <TemaContext.Provider value={{ preferencia, escuro, setPreferencia, alternar }}>
      {children}
    </TemaContext.Provider>
  );
};

export const useTema = () => {
  const ctx = useContext(TemaContext);
  if (!ctx) throw new Error('useTema precisa estar dentro de TemaProvider');
  return ctx;
};