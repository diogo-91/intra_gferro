import React from 'react';
import { Wallet, Ruler, Package } from 'lucide-react';
import { VendedorRanking } from '../types';
import { formatCurrency, formatMetrosQuadrados, formatInteiro, formatNomeVendedor } from '../utils/format';

interface RankingComPosicao extends VendedorRanking {
  posicao: number;
}

interface RankingTableProps {
  vendedores: RankingComPosicao[];
}

const badgeStyleByPosicao: Record<number, string> = {
  1: 'bg-yellow-400 text-black',
  2: 'bg-neutral-300 text-black',
  3: 'bg-amber-700 text-white',
};

export const RankingTable: React.FC<RankingTableProps> = ({ vendedores }) => {
  if (vendedores.length === 0) return null;

  return (
    <div className="overflow-x-auto rounded-xl border border-neutral-100">
      <table className="w-full text-xs border-collapse min-w-[560px]">
        <thead className="bg-neutral-50">
          <tr className="text-[11px] font-bold uppercase tracking-wider text-neutral-600">
            <th scope="col" className="w-12 px-5 py-3 text-center font-bold">
              #
            </th>
            <th scope="col" className="px-2 py-3 text-left font-bold">
              Vendedor
            </th>
            <th scope="col" className="w-32 px-2 py-3 text-right font-bold">
              <span className="inline-flex items-center justify-end gap-1.5">
                <Wallet className="w-3 h-3" aria-hidden="true" />
                Total Vendido
              </span>
            </th>
            <th scope="col" className="w-28 px-2 py-3 text-right font-bold">
              <span className="inline-flex items-center justify-end gap-1.5">
                <Ruler className="w-3 h-3" aria-hidden="true" />
                Área vendida
              </span>
            </th>
            <th scope="col" className="w-20 px-5 py-3 text-right font-bold">
              <span className="inline-flex items-center justify-end gap-1.5">
                <Package className="w-3 h-3" aria-hidden="true" />
                Pedidos
              </span>
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-neutral-100">
          {vendedores.map((v) => {
            const nomeExibido = formatNomeVendedor(v.nome);
            return (
              <tr key={v.nome} className="hover:bg-neutral-100 transition-colors motion-reduce:transition-none">
                <td className="px-5 py-3">
                  <span
                    className={`mx-auto w-7 h-7 rounded-full flex items-center justify-center text-xs font-black ${
                      badgeStyleByPosicao[v.posicao] ?? 'bg-neutral-100 text-neutral-600'
                    }`}
                  >
                    {v.posicao}
                  </span>
                </td>
                <th scope="row" className="px-2 py-3 text-left font-semibold text-neutral-900 max-w-[220px]">
                  <span
                    tabIndex={0}
                    title={nomeExibido}
                    aria-label={nomeExibido}
                    className="block truncate rounded focus:outline-none focus-visible:ring-2 focus-visible:ring-yellow-400"
                  >
                    {nomeExibido}
                  </span>
                </th>
                <td className="px-2 py-3 text-right text-emerald-600 font-bold tabular-nums whitespace-nowrap">
                  {formatCurrency(v.valorTotal)}
                </td>
                <td className="px-2 py-3 text-right text-sky-600 font-bold tabular-nums whitespace-nowrap">
                  {formatMetrosQuadrados(v.metrosQuadrados)}
                </td>
                <td className="px-5 py-3 text-right text-violet-600 font-bold tabular-nums whitespace-nowrap">
                  {formatInteiro(v.pedidos)}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
};
