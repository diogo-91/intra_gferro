import React from 'react';
import { Wallet, Package, Nut, Truck, Receipt, BadgeDollarSign } from 'lucide-react';
import { VendedorRanking } from '../types';
import { formatInteiro, formatNomeVendedor } from '../utils/format';

const formatCurrencyComCentavos = (value: number) =>
  value.toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

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

// As 3 primeiras posições vêm com a linha destacada (sem pódio em cards
// separados) — mesmo tom de cor do badge, só bem mais sutil.
const linhaDestaqueByPosicao: Record<number, string> = {
  1: 'bg-yellow-50/70 hover:bg-yellow-50',
  2: 'bg-neutral-50 hover:bg-neutral-100',
  3: 'bg-amber-50/70 hover:bg-amber-50',
};

export const RankingTable: React.FC<RankingTableProps> = ({ vendedores }) => {
  if (vendedores.length === 0) return null;

  return (
    <div className="overflow-x-auto rounded-xl border border-neutral-100">
      <table className="w-full table-fixed text-xs border-collapse min-w-[1280px]">
        <thead className="bg-neutral-50">
          <tr className="text-[11px] font-bold uppercase tracking-wider text-neutral-600">
            <th scope="col" className="w-12 px-5 py-3 text-center font-bold">
              #
            </th>
            <th scope="col" className="w-56 px-2 py-3 text-left font-bold">
              Vendedor
            </th>
            <th scope="col" className="w-32 px-2 py-3 text-left font-bold">
              <span className="inline-flex items-center justify-start gap-1.5">
                <Wallet className="w-3 h-3" aria-hidden="true" />
                Total Vendido
              </span>
            </th>
            <th scope="col" className="w-28 px-2 py-3 text-left font-bold">
              <span className="inline-flex items-center justify-start gap-1.5" title="Média do valor vendido por pedido">
                <BadgeDollarSign className="w-3 h-3" aria-hidden="true" />
                Ticket médio
              </span>
            </th>
            <th scope="col" className="w-28 px-2 py-3 text-left font-bold">
              <span className="inline-flex items-center justify-start gap-1.5">
                <Package className="w-3 h-3" aria-hidden="true" />
                Pedidos
              </span>
            </th>
            <th scope="col" className="w-28 px-2 py-3 text-left font-bold">
              <span className="inline-flex items-center justify-start gap-1.5" title="Valor já recebido nas contas vinculadas aos pedidos">
                <Receipt className="w-3 h-3" aria-hidden="true" />
                Recebíveis
              </span>
            </th>
            <th scope="col" className="w-24 px-2 py-3 text-left font-bold">
              <span className="inline-flex items-center justify-start gap-1.5" title="Quantidade de pedidos que contêm parafusos">
                <Nut className="w-3 h-3" aria-hidden="true" />
                Ped. parafusos
              </span>
            </th>
            <th scope="col" className="w-24 px-2 py-3 text-left font-bold">
              <span className="inline-flex items-center justify-start gap-1.5" title="Quantidade total de parafusos vendidos">
                <Nut className="w-3 h-3" aria-hidden="true" />
                Qtd. parafusos
              </span>
            </th>
            <th scope="col" className="w-28 px-2 py-3 text-left font-bold">
              <span className="inline-flex items-center justify-start gap-1.5" title="Valor total vendido em itens classificados como parafuso">
                <Nut className="w-3 h-3" aria-hidden="true" />
                R$ parafusos
              </span>
            </th>
            <th scope="col" className="w-24 px-2 py-3 text-left font-bold">
              <span className="inline-flex items-center justify-start gap-1.5" title="Quantidade de pedidos com valor de frete maior que zero">
                <Truck className="w-3 h-3" aria-hidden="true" />
                Ped. frete
              </span>
            </th>
            <th scope="col" className="w-28 px-2 py-3 text-left font-bold">
              <span className="inline-flex items-center justify-start gap-1.5">
                <Truck className="w-3 h-3" aria-hidden="true" />
                Frete
              </span>
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-neutral-100">
          {vendedores.map((v) => {
            const nomeExibido = formatNomeVendedor(v.nome);
            return (
              <tr
                key={v.nome}
                className={`transition-colors motion-reduce:transition-none ${
                  linhaDestaqueByPosicao[v.posicao] ?? 'hover:bg-neutral-100'
                }`}
              >
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
                <td className="px-2 py-3 text-left text-emerald-600 font-bold tabular-nums whitespace-nowrap">
                  {formatCurrencyComCentavos(v.valorTotal)}
                </td>
                <td className="px-2 py-3 text-left text-fuchsia-700 font-bold tabular-nums whitespace-nowrap">
                  {formatCurrencyComCentavos(v.ticketMedio)}
                </td>
                <td className="px-2 py-3 text-left text-violet-600 font-bold tabular-nums whitespace-nowrap">
                  {formatInteiro(v.pedidos)}
                </td>
                <td className="px-2 py-3 text-left text-teal-700 font-bold tabular-nums whitespace-nowrap">
                  {formatCurrencyComCentavos(v.valorRecebido)}
                </td>
                <td className="px-2 py-3 text-left text-amber-700 font-bold tabular-nums whitespace-nowrap">
                  {formatInteiro(v.pedidosParafusos)}
                </td>
                <td className="px-2 py-3 text-left text-orange-600 font-bold tabular-nums whitespace-nowrap">
                  {formatInteiro(v.quantidadeParafusos)}
                </td>
                <td className="px-2 py-3 text-left text-rose-600 font-bold tabular-nums whitespace-nowrap">
                  {formatCurrencyComCentavos(v.valorParafusos)}
                </td>
                <td className="px-2 py-3 text-left text-indigo-600 font-bold tabular-nums whitespace-nowrap">
                  {formatInteiro(v.pedidosComFrete)}
                </td>
                <td className="px-2 py-3 text-left text-cyan-700 font-bold tabular-nums whitespace-nowrap">
                  {formatCurrencyComCentavos(v.valorFrete)}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
};
