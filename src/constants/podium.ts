import type { CSSProperties } from 'react';

export type Colocacao = 1 | 2 | 3;

interface PodiumStyle {
  /** Rótulo visível de destaque (só o 1º exibe; acessibilidade não depende só de cor). */
  rotuloDestaque?: string;
  /** Fundo cheio do card (gradiente sutil), aplicado via inline style. */
  background: CSSProperties;
  borda: string;
  badge: string;
  icone: string;
  brilho?: string;
}

// Tokens centralizados de cor por colocação — nenhum outro arquivo deve
// hardcodar essas cores. Fundo sempre um wash translúcido sutil sobre a
// superfície clara do card (branca), nunca uma cor sólida forte.
export const PODIUM_STYLES: Record<Colocacao, PodiumStyle> = {
  1: {
    rotuloDestaque: 'Líder do período',
    background: {
      backgroundImage: 'linear-gradient(135deg, rgba(255,196,0,0.16), rgba(255,196,0,0.04))',
    },
    borda: 'border-yellow-400/50',
    badge: 'bg-yellow-400 text-black',
    icone: 'text-yellow-600',
    brilho: 'shadow-[0_0_28px_-12px_rgba(250,204,21,0.5)]',
  },
  2: {
    background: {
      backgroundImage: 'linear-gradient(135deg, rgba(148,163,184,0.18), rgba(148,163,184,0.05))',
    },
    borda: 'border-slate-300/60',
    badge: 'bg-slate-300 text-black',
    icone: 'text-slate-500',
  },
  3: {
    background: {
      backgroundImage: 'linear-gradient(135deg, rgba(194,100,28,0.16), rgba(194,100,28,0.05))',
    },
    borda: 'border-amber-700/50',
    badge: 'bg-amber-700 text-white',
    icone: 'text-amber-600',
  },
};
