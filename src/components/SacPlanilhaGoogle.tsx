import React, { useState } from 'react';
import { ArrowLeft, ExternalLink, RefreshCw, Sheet } from 'lucide-react';

const PLANILHA_SAC_ID = '1LdXxN5A16kz2gFFMwu5dUzw8DrbpGTRbd_L4_lB4ni8';
const PLANILHA_SAC_URL = `https://docs.google.com/spreadsheets/d/${PLANILHA_SAC_ID}/edit?gid=0`;
const PLANILHA_SAC_EMBED_URL = `${PLANILHA_SAC_URL}&rm=minimal&widget=true`;

interface SacPlanilhaGoogleProps {
  onVoltar: () => void;
}

export const SacPlanilhaGoogle: React.FC<SacPlanilhaGoogleProps> = ({ onVoltar }) => {
  const [carregando, setCarregando] = useState(true);
  const [versaoFrame, setVersaoFrame] = useState(0);

  const recarregar = () => {
    setCarregando(true);
    setVersaoFrame((valor) => valor + 1);
  };

  return (
    <div className="flex min-h-[calc(100vh-9rem)] flex-col gap-4">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <button
            type="button"
            onClick={onVoltar}
            className="mb-3 inline-flex items-center gap-1.5 text-[11px] font-semibold text-neutral-500 transition-colors hover:text-neutral-950 focus:outline-none focus-visible:ring-2 focus-visible:ring-yellow-400"
          >
            <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />
            Voltar aos atendimentos
          </button>
          <p className="text-[11px] font-semibold text-neutral-500">Departamentos / SAC / Planilha</p>
          <h1 className="mt-1 flex items-center gap-2 text-2xl font-black tracking-tight text-neutral-900 sm:text-3xl">
            <Sheet className="h-6 w-6 text-emerald-600" aria-hidden="true" />
            Planilha SAC
          </h1>
          <p className="mt-1 text-sm text-neutral-500">
            Documento único do Google Drive. As alterações são salvas diretamente na planilha original.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={recarregar}
            className="inline-flex items-center gap-2 rounded-full border border-neutral-200 bg-white px-4 py-2.5 text-xs font-bold text-neutral-700 transition-colors hover:border-yellow-400 hover:text-yellow-700"
          >
            <RefreshCw className={`h-4 w-4 ${carregando ? 'animate-spin' : ''}`} aria-hidden="true" />
            Recarregar
          </button>
          <a
            href={PLANILHA_SAC_URL}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-2 rounded-full bg-yellow-400 px-4 py-2.5 text-xs font-extrabold text-black shadow-sm transition-colors hover:bg-yellow-300"
          >
            <ExternalLink className="h-4 w-4" aria-hidden="true" />
            Abrir no Google
          </a>
        </div>
      </header>

      <section className="relative min-h-[680px] flex-1 overflow-hidden rounded-2xl border border-neutral-200 bg-white shadow-sm">
        {carregando && (
          <div className="absolute inset-0 z-10 flex items-center justify-center bg-white">
            <div className="flex items-center gap-2 text-xs font-semibold text-neutral-500">
              <RefreshCw className="h-5 w-5 animate-spin text-yellow-600" aria-hidden="true" />
              Abrindo a planilha compartilhada...
            </div>
          </div>
        )}
        <iframe
          key={versaoFrame}
          src={PLANILHA_SAC_EMBED_URL}
          title="Planilha editável do SAC"
          className="h-full min-h-[680px] w-full border-0"
          onLoad={() => setCarregando(false)}
          allow="clipboard-read; clipboard-write"
        />
      </section>
    </div>
  );
};
