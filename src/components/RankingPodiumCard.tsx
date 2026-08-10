import React from 'react';
import { Trophy, Medal, Wallet, Ruler, Package } from 'lucide-react';
import { VendedorRanking } from '../types';
import { formatCurrency, formatMetrosQuadrados, formatInteiro, formatNomeVendedor } from '../utils/format';
import { PODIUM_STYLES, Colocacao } from '../constants/podium';

interface RankingPodiumCardProps {
  posicao: Colocacao;
  vendedor: VendedorRanking;
  className?: string;
}

export const RankingPodiumCard: React.FC<RankingPodiumCardProps> = ({ posicao, vendedor, className = '' }) => {
  const estilo = PODIUM_STYLES[posicao];
  const lider = posicao === 1;
  const nomeExibido = formatNomeVendedor(vendedor.nome);

  return (
    <div
      style={estilo.background}
      className={`rounded-2xl border ${estilo.borda} ${estilo.brilho ?? ''} p-4 flex flex-col gap-2.5 ${
        lider ? 'sm:-translate-y-[10px] sm:p-5' : ''
      } ${className}`}
    >
      <div className="flex items-center justify-between">
        <span
          className={`rounded-full flex items-center justify-center font-black shrink-0 ${estilo.badge} ${
            lider ? 'w-10 h-10 text-base' : 'w-8 h-8 text-sm'
          }`}
          aria-hidden="true"
        >
          {posicao}
        </span>

        <div className="flex items-center gap-1.5">
          {lider && (
            <span className="text-[11px] font-bold uppercase tracking-wide text-yellow-200">
              {estilo.rotuloDestaque}
            </span>
          )}
          {lider ? (
            <Trophy className={`w-5 h-5 ${estilo.icone}`} aria-hidden="true" />
          ) : (
            <Medal className={`w-5 h-5 ${estilo.icone}`} aria-hidden="true" />
          )}
        </div>
      </div>

      <div className="min-w-0">
        <h3
          tabIndex={0}
          aria-label={`${posicao}º colocado: ${nomeExibido}`}
          title={nomeExibido}
          className="text-neutral-900 font-bold text-sm truncate rounded focus:outline-none focus-visible:ring-2 focus-visible:ring-yellow-400"
        >
          {nomeExibido}
        </h3>
      </div>

      <dl className="grid grid-cols-[1fr_auto] gap-x-3 gap-y-1.5 items-baseline">
        <dt className="flex items-center gap-1.5 text-xs text-neutral-600">
          <Wallet className="w-3 h-3 text-emerald-600 shrink-0" aria-hidden="true" />
          Total vendido
        </dt>
        <dd
          className={`text-right font-black text-neutral-900 tabular-nums whitespace-nowrap ${
            lider ? 'text-lg' : 'text-sm'
          }`}
        >
          {formatCurrency(vendedor.valorTotal)}
        </dd>

        <dt className="flex items-center gap-1.5 text-xs text-neutral-600">
          <Ruler className="w-3 h-3 text-sky-600 shrink-0" aria-hidden="true" />
          Área vendida
        </dt>
        <dd className="text-right font-semibold text-neutral-700 text-xs tabular-nums whitespace-nowrap">
          {formatMetrosQuadrados(vendedor.metrosQuadrados)}
        </dd>

        <dt className="flex items-center gap-1.5 text-xs text-neutral-600">
          <Package className="w-3 h-3 text-violet-600 shrink-0" aria-hidden="true" />
          Pedidos
        </dt>
        <dd className="text-right font-semibold text-neutral-700 text-xs tabular-nums whitespace-nowrap">
          {formatInteiro(vendedor.pedidos)}
        </dd>
      </dl>
    </div>
  );
};
