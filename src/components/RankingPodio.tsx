import React from 'react';
import { Crown, Medal, Package, Ruler, Trophy, Wallet } from 'lucide-react';
import { VendedorRanking } from '../types';
import { formatCurrency, formatInteiro, formatMetrosQuadrados, formatNomeVendedor } from '../utils/format';

interface RankingComPosicao extends VendedorRanking {
  posicao: number;
}

interface RankingPodioProps {
  vendedores: RankingComPosicao[];
}

const estilos = {
  1: {
    ordem: 'order-1 sm:order-2',
    margem: 'sm:-translate-y-5',
    card: 'border-yellow-300 bg-gradient-to-b from-yellow-50 via-white to-white shadow-yellow-200/60',
    icone: 'bg-yellow-400 text-black',
    valor: 'text-yellow-700',
    rotulo: '1º lugar',
  },
  2: {
    ordem: 'order-2 sm:order-1',
    margem: '',
    card: 'border-neutral-300 bg-gradient-to-b from-neutral-100 via-white to-white shadow-neutral-200/60',
    icone: 'bg-neutral-300 text-neutral-800',
    valor: 'text-neutral-700',
    rotulo: '2º lugar',
  },
  3: {
    ordem: 'order-3',
    margem: '',
    card: 'border-amber-300 bg-gradient-to-b from-amber-50 via-white to-white shadow-amber-200/60',
    icone: 'bg-amber-700 text-white',
    valor: 'text-amber-700',
    rotulo: '3º lugar',
  },
} as const;

export const RankingPodio: React.FC<RankingPodioProps> = ({ vendedores }) => {
  const primeiros = vendedores.slice(0, 3);
  if (primeiros.length === 0) return null;

  const ordemVisual = [primeiros[1], primeiros[0], primeiros[2]].filter(Boolean);

  return (
    <section className="rounded-3xl border border-yellow-200 bg-gradient-to-br from-neutral-950 via-neutral-900 to-yellow-950 p-5 sm:p-7 overflow-hidden">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-9">
        <div>
          <span className="text-[10px] font-black uppercase tracking-[0.22em] text-yellow-400">Destaques do período</span>
          <h2 className="text-xl font-black text-white mt-1 flex items-center gap-2">
            <Trophy className="w-5 h-5 text-yellow-400" aria-hidden="true" />
            Pódio GFERRO
          </h2>
        </div>
        <span className="text-[11px] text-neutral-400">Ranking geral de vendas da empresa</span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 items-end">
        {ordemVisual.map((vendedor) => {
          const estilo = estilos[vendedor.posicao as 1 | 2 | 3];
          const primeiro = vendedor.posicao === 1;
          return (
            <article
              key={vendedor.nome}
              className={`${estilo.ordem} ${estilo.margem} ${estilo.card} rounded-2xl border p-5 text-center shadow-xl relative`}
            >
              {primeiro && <Crown className="w-7 h-7 text-yellow-500 mx-auto mb-1" aria-hidden="true" />}
              <div className={`${estilo.icone} w-11 h-11 rounded-full mx-auto flex items-center justify-center shadow-md`}>
                {primeiro ? <Trophy className="w-5 h-5" aria-hidden="true" /> : <Medal className="w-5 h-5" aria-hidden="true" />}
              </div>
              <span className="block mt-3 text-[10px] font-black uppercase tracking-widest text-neutral-500">{estilo.rotulo}</span>
              <h3 className="mt-1 text-sm font-black text-neutral-950 truncate" title={formatNomeVendedor(vendedor.nome)}>
                {formatNomeVendedor(vendedor.nome)}
              </h3>
              <strong className={`block mt-3 text-lg font-black tabular-nums ${estilo.valor}`}>
                {formatCurrency(vendedor.valorTotal)}
              </strong>
              <div className="mt-4 pt-3 border-t border-neutral-200 flex items-center justify-center gap-4 text-[10px] font-semibold text-neutral-500">
                <span className="inline-flex items-center gap-1" title="Pedidos">
                  <Package className="w-3 h-3" aria-hidden="true" /> {formatInteiro(vendedor.pedidos)}
                </span>
                <span className="inline-flex items-center gap-1" title="Área vendida">
                  <Ruler className="w-3 h-3" aria-hidden="true" /> {formatMetrosQuadrados(vendedor.metrosQuadrados)}
                </span>
              </div>
              <Wallet className="absolute top-4 right-4 w-3.5 h-3.5 text-neutral-300" aria-hidden="true" />
            </article>
          );
        })}
      </div>
    </section>
  );
};
