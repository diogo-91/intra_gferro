import React from 'react';
import { Wallet, Package, Nut, Truck, Receipt, BadgePercent, HandCoins, BadgeDollarSign } from 'lucide-react';
import { VendedorRanking } from '../types';
import { formatInteiro, formatNomeVendedor } from '../utils/format';

const formatCurrencyComCentavos = (value: number) => value.toLocaleString('pt-BR', {
  style: 'currency', currency: 'BRL', minimumFractionDigits: 2, maximumFractionDigits: 2,
});

interface RankingComPosicao extends VendedorRanking { posicao: number; }
interface RankingTableProps { vendedores: RankingComPosicao[]; onSelecionarVendedor?: (nome: string) => void; }

const badgeStyleByPosicao: Record<number, string> = {
  1: 'bg-yellow-400 text-black', 2: 'bg-neutral-300 text-black', 3: 'bg-amber-700 text-white',
};
const linhaDestaqueByPosicao: Record<number, string> = {
  1: 'bg-yellow-50/70 hover:bg-yellow-50', 2: 'bg-neutral-50 hover:bg-neutral-100', 3: 'bg-amber-50/70 hover:bg-amber-50',
};
const valorOpcional = (valor: number | null | undefined) => valor == null ? 'Não informada' : formatCurrencyComCentavos(valor);

export const RankingTable: React.FC<RankingTableProps> = ({ vendedores, onSelecionarVendedor }) => {
  if (vendedores.length === 0) return null;
  const fechamentoOficial = vendedores.some((vendedor) => vendedor.fechamentoOficial);
  return (
    <div className="overflow-x-auto rounded-xl border border-neutral-100">
      <table className="w-full table-fixed border-collapse text-xs min-w-[1480px]">
        <thead className="bg-neutral-50"><tr className="text-[11px] font-bold uppercase tracking-wider text-neutral-600">
          <th scope="col" className="w-12 px-5 py-3 text-center">#</th>
          <th scope="col" className="w-56 px-2 py-3 text-left">Vendedor</th>
          <th scope="col" className="w-32 px-2 py-3 text-left"><span className="inline-flex items-center gap-1.5"><Wallet className="h-3 w-3" />Total vendido</span></th>
          {!fechamentoOficial && <th scope="col" className="w-28 px-2 py-3 text-left"><span className="inline-flex items-center gap-1.5"><BadgeDollarSign className="h-3 w-3" />Ticket médio</span></th>}
          <th scope="col" className="w-24 px-2 py-3 text-left"><span className="inline-flex items-center gap-1.5"><Package className="h-3 w-3" />Pedidos</span></th>
          <th scope="col" className="w-32 px-2 py-3 text-left"><span className="inline-flex items-center gap-1.5"><Receipt className="h-3 w-3" />Total recebível</span></th>
          {fechamentoOficial && <th scope="col" className="w-24 px-2 py-3 text-left"><span className="inline-flex items-center gap-1.5"><BadgePercent className="h-3 w-3" />Percentual</span></th>}
          {fechamentoOficial && <th scope="col" className="w-32 px-2 py-3 text-left"><span className="inline-flex items-center gap-1.5"><HandCoins className="h-3 w-3" />Comissão vendas</span></th>}
          {!fechamentoOficial && <th scope="col" className="w-28 px-2 py-3 text-left"><span className="inline-flex items-center gap-1.5"><Nut className="h-3 w-3" />Ped. parafusos</span></th>}
          <th scope="col" className="w-28 px-2 py-3 text-left"><span className="inline-flex items-center gap-1.5"><Nut className="h-3 w-3" />Parafusos</span></th>
          <th scope="col" className="w-32 px-2 py-3 text-left"><span className="inline-flex items-center gap-1.5"><Nut className="h-3 w-3" />Valor parafusos</span></th>
          {!fechamentoOficial && <th scope="col" className="w-28 px-2 py-3 text-left"><span className="inline-flex items-center gap-1.5"><Truck className="h-3 w-3" />Ped. frete/outros</span></th>}
          <th scope="col" className="w-28 px-2 py-3 text-left"><span className="inline-flex items-center gap-1.5"><Truck className="h-3 w-3" />Fretes</span></th>
          {fechamentoOficial && <th scope="col" className="w-32 px-2 py-3 text-left"><span className="inline-flex items-center gap-1.5"><HandCoins className="h-3 w-3" />Comissão fretes</span></th>}
        </tr></thead>
        <tbody className="divide-y divide-neutral-100">
          {vendedores.map((v) => {
            const nomeExibido = formatNomeVendedor(v.nome);
            return <tr key={v.nome} className={`transition-colors ${linhaDestaqueByPosicao[v.posicao] ?? 'hover:bg-neutral-100'}`}>
              <td className="px-5 py-3"><span className={`mx-auto flex h-7 w-7 items-center justify-center rounded-full text-xs font-black ${badgeStyleByPosicao[v.posicao] ?? 'bg-neutral-100 text-neutral-600'}`}>{v.posicao}</span></td>
              <th scope="row" className="max-w-[220px] px-2 py-3 text-left font-semibold text-neutral-900">
                <button type="button" onClick={() => onSelecionarVendedor?.(v.nome)} disabled={!onSelecionarVendedor} title={nomeExibido} className="block w-full truncate rounded text-left underline-offset-2 enabled:cursor-pointer enabled:hover:text-yellow-700 enabled:hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-yellow-400">{nomeExibido}</button>
                {v.observacao && <span className="mt-1 block truncate text-[9px] font-medium text-amber-700" title={v.observacao}>Observação disponível</span>}
              </th>
              <td className="whitespace-nowrap px-2 py-3 font-bold tabular-nums text-emerald-600">{formatCurrencyComCentavos(v.valorTotal)}</td>
              {!fechamentoOficial && <td className="whitespace-nowrap px-2 py-3 font-bold tabular-nums text-fuchsia-700">{formatCurrencyComCentavos(v.ticketMedio)}</td>}
              <td className="px-2 py-3 font-bold tabular-nums text-violet-600">{formatInteiro(v.pedidos)}</td>
              <td className="whitespace-nowrap px-2 py-3 font-bold tabular-nums text-teal-700">{formatCurrencyComCentavos(v.valorRecebido)}</td>
              {fechamentoOficial && <td className="px-2 py-3 font-bold tabular-nums text-amber-700">{v.percentualIndicado == null ? '—' : `${formatInteiro(v.percentualIndicado)}%`}</td>}
              {fechamentoOficial && <td className="whitespace-nowrap px-2 py-3 font-bold tabular-nums text-fuchsia-700">{valorOpcional(v.comissaoVendas)}</td>}
              {!fechamentoOficial && <td className="px-2 py-3 font-bold tabular-nums text-amber-700">{formatInteiro(v.pedidosParafusos)}</td>}
              <td className="px-2 py-3 font-bold tabular-nums text-orange-600">{formatInteiro(v.quantidadeParafusos)}</td>
              <td className="whitespace-nowrap px-2 py-3 font-bold tabular-nums text-rose-600">{formatCurrencyComCentavos(v.valorParafusos)}</td>
              {!fechamentoOficial && <td className="px-2 py-3 font-bold tabular-nums text-indigo-600">{formatInteiro(v.pedidosComFrete)}</td>}
              <td className="whitespace-nowrap px-2 py-3 font-bold tabular-nums text-cyan-700">{formatCurrencyComCentavos(v.valorFrete)}</td>
              {fechamentoOficial && <td className="whitespace-nowrap px-2 py-3 font-bold tabular-nums text-indigo-700">{valorOpcional(v.comissaoFretes)}</td>}
            </tr>;
          })}
        </tbody>
      </table>
    </div>
  );
};
