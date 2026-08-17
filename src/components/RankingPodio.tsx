import React from 'react';
import { Crown, Medal, Package, Ruler, Store, Trophy } from 'lucide-react';
import { VendedorRanking } from '../types';
import { LOJAS, lojaDoVendedor } from '../data/vendedorLoja';
import { formatCurrency, formatInteiro, formatMetrosQuadrados, formatNomeVendedor } from '../utils/format';

interface RankingComPosicao extends VendedorRanking {
  posicao: number;
}

interface RankingPodioProps {
  vendedores: RankingComPosicao[];
}

const estilos = {
  1: { ordem: 'order-1 sm:order-2', card: 'sm:-translate-y-3 border-yellow-300 bg-yellow-50/40', faixa: 'from-yellow-300 via-yellow-400 to-amber-500', medalha: 'bg-yellow-400 text-neutral-950 ring-yellow-100', numero: 'text-yellow-600', titulo: 'Campeão de vendas' },
  2: { ordem: 'order-2 sm:order-1', card: 'border-neutral-200 bg-white', faixa: 'from-slate-200 via-slate-300 to-slate-400', medalha: 'bg-slate-200 text-slate-700 ring-slate-100', numero: 'text-slate-500', titulo: 'Vice-campeão' },
  3: { ordem: 'order-3', card: 'border-neutral-200 bg-white', faixa: 'from-orange-200 via-orange-300 to-orange-500', medalha: 'bg-orange-500 text-white ring-orange-100', numero: 'text-orange-600', titulo: 'Terceiro lugar' },
} as const;

function nomeDaLoja(nomeVendedor: string): string {
  const lojaId = lojaDoVendedor(nomeVendedor);
  return LOJAS.find((loja) => loja.id === lojaId)?.nome ?? 'GFERRO';
}

export const RankingPodio: React.FC<RankingPodioProps> = ({ vendedores }) => {
  const primeiros = vendedores.slice(0, 3);
  if (primeiros.length === 0) return null;

  const ordemVisual = [primeiros[1], primeiros[0], primeiros[2]].filter(Boolean);

  return (
    <section className="rounded-3xl border border-neutral-200 bg-neutral-50/60 p-5 sm:p-7">
      <div className="flex flex-col gap-3 mb-8 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-yellow-100 text-yellow-700">
            <Trophy className="h-5 w-5" aria-hidden="true" />
          </div>
          <div>
            <span className="text-[10px] font-black uppercase tracking-[0.2em] text-yellow-700">Destaques do período</span>
            <h2 className="text-xl font-black tracking-tight text-neutral-950">Pódio GFERRO</h2>
          </div>
        </div>
        <div className="w-fit rounded-full border border-neutral-200 bg-white px-3 py-1.5 text-[10px] font-bold text-neutral-500">
          Ranking geral da empresa
        </div>
      </div>

      <div className="mx-auto grid max-w-5xl grid-cols-1 items-end gap-4 sm:grid-cols-3 sm:gap-5">
        {ordemVisual.map((vendedor) => {
          const estilo = estilos[vendedor.posicao as 1 | 2 | 3];
          const primeiro = vendedor.posicao === 1;
          const nomeExibido = formatNomeVendedor(vendedor.nome);

          return (
            <article key={vendedor.nome} className={`${estilo.ordem} ${estilo.card} relative overflow-hidden rounded-2xl border shadow-sm`}>
              <div className={`h-1.5 bg-gradient-to-r ${estilo.faixa}`} />
              <div className="p-5 text-center sm:p-6">
                <div className="relative mx-auto w-fit">
                  {primeiro && <Crown className="absolute -top-7 left-1/2 h-6 w-6 -translate-x-1/2 text-yellow-500" aria-hidden="true" />}
                  <div className={`${estilo.medalha} flex h-12 w-12 items-center justify-center rounded-2xl ring-8 shadow-md`}>
                    {primeiro ? <Trophy className="h-5 w-5" aria-hidden="true" /> : <Medal className="h-5 w-5" aria-hidden="true" />}
                  </div>
                  <span className="absolute -bottom-1.5 -right-2 flex h-6 min-w-6 items-center justify-center rounded-full border-2 border-white bg-neutral-950 px-1 text-[10px] font-black text-white shadow">{vendedor.posicao}º</span>
                </div>

                <span className={`mt-4 block text-[9px] font-black uppercase tracking-[0.18em] ${estilo.numero}`}>{estilo.titulo}</span>
                <h3 className="mt-1.5 truncate text-base font-black text-neutral-950" title={nomeExibido}>{nomeExibido}</h3>
                <span className="mt-1 inline-flex max-w-full items-center gap-1 text-[10px] font-semibold text-neutral-400">
                  <Store className="h-3 w-3 shrink-0" aria-hidden="true" />
                  <span className="truncate">{nomeDaLoja(vendedor.nome)}</span>
                </span>

                <strong className="mt-4 block text-xl font-black tabular-nums tracking-tight text-emerald-700">{formatCurrency(vendedor.valorTotal)}</strong>
                <span className="text-[9px] font-bold uppercase tracking-wider text-neutral-400">Total vendido</span>

                <div className="mt-5 grid grid-cols-2 divide-x divide-neutral-100 rounded-2xl bg-neutral-50 px-2 py-3">
                  <div className="flex flex-col items-center gap-1 px-2">
                    <Package className="h-3.5 w-3.5 text-violet-500" aria-hidden="true" />
                    <strong className="text-xs font-black tabular-nums text-neutral-800">{formatInteiro(vendedor.pedidos)}</strong>
                    <span className="text-[9px] font-semibold text-neutral-400">Pedidos</span>
                  </div>
                  <div className="flex flex-col items-center gap-1 px-2">
                    <Ruler className="h-3.5 w-3.5 text-sky-500" aria-hidden="true" />
                    <strong className="max-w-full truncate text-xs font-black tabular-nums text-neutral-800" title={formatMetrosQuadrados(vendedor.metrosQuadrados)}>{formatMetrosQuadrados(vendedor.metrosQuadrados)}</strong>
                    <span className="text-[9px] font-semibold text-neutral-400">Área vendida</span>
                  </div>
                </div>
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
};
