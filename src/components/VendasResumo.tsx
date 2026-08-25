import React from 'react';
import { Wallet, Package, Users, RefreshCw, AlertTriangle, BarChart3, Tag, Receipt, Target, CircleDollarSign, Hourglass, Nut, Truck } from 'lucide-react';
import { ResumoVendas } from '../types';
import { formatCurrency, formatInteiro } from '../utils/format';

interface VendasResumoProps {
  resumo: ResumoVendas | null;
  loading: boolean;
  erro: string | null;
  metaVendas?: number;
  exibirProgressoMeta?: boolean;
  exibirDetalhesProdutos?: boolean;
  exibirKpisParafusosFrete?: boolean;
}

const formatUnidade = (quantidade: number, unidade: string) => {
  const numero = quantidade.toLocaleString('pt-BR', { maximumFractionDigits: 2 });
  return unidade ? `${numero} ${unidade}` : numero;
};

// Preço médio = valor total dividido pela quantidade vendida — precisa de
// casas decimais (diferente do formatCurrency de totais, que arredonda pro
// real inteiro), senão R$ 0,xx vira "R$ 0".
function precoMedioDe(valorTotal: number, quantidade: number): number | null {
  return quantidade > 0 ? valorTotal / quantidade : null;
}

const formatPrecoMedio = (preco: number, unidade: string): string => {
  const precoFormatado = preco.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return unidade ? `${precoFormatado}/${unidade}` : precoFormatado;
};

interface ListaVendasPorProdutoProps {
  produtos: ResumoVendas['produtos'];
  maiorValorProduto: number;
}

// Tabela original: nome, quantidade e valor total vendido — sem alteração.
const ListaVendasPorProduto: React.FC<ListaVendasPorProdutoProps> = ({ produtos, maiorValorProduto }) => (
  <ul className="space-y-3">
    {produtos.map((produto) => (
      <li key={produto.nome} className="space-y-1">
        <div className="flex items-center justify-between gap-3 text-xs">
          <span className="text-neutral-800 font-medium truncate" title={produto.nome}>
            {produto.nome}
          </span>
          <span className="text-neutral-500 shrink-0 tabular-nums">
            {formatUnidade(produto.quantidade, produto.unidade)}
          </span>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex-1 h-2 rounded-full bg-neutral-100 overflow-hidden">
            <div
              className="h-full rounded-full"
              style={{
                width: `${Math.max(4, (produto.valorTotal / maiorValorProduto) * 100)}%`,
                backgroundImage: 'linear-gradient(90deg, #ca8a04, #facc15)',
              }}
            />
          </div>
          <span className="text-emerald-600 font-bold text-xs shrink-0 tabular-nums w-24 text-right">
            {formatCurrency(produto.valorTotal)}
          </span>
        </div>
      </li>
    ))}
  </ul>
);

interface ListaPrecoMedioProps {
  produtos: ResumoVendas['produtos'];
  maiorPrecoMedio: number;
}

// Tabela nova: mesmos produtos, mas com o preço médio de venda (valor total
// ÷ quantidade) em vez do valor total.
const ListaPrecoMedio: React.FC<ListaPrecoMedioProps> = ({ produtos, maiorPrecoMedio }) => (
  <ul className="space-y-3">
    {produtos.map((produto) => {
      const preco = precoMedioDe(produto.valorTotal, produto.quantidade);
      return (
        <li key={produto.nome} className="space-y-1">
          <div className="flex items-center justify-between gap-3 text-xs">
            <span className="text-neutral-800 font-medium truncate" title={produto.nome}>
              {produto.nome}
            </span>
            <span className="text-neutral-500 shrink-0 tabular-nums">
              {formatUnidade(produto.quantidade, produto.unidade)}
            </span>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex-1 h-2 rounded-full bg-neutral-100 overflow-hidden">
              {preco !== null && (
                <div
                  className="h-full rounded-full"
                  style={{
                    width: `${Math.max(4, (preco / maiorPrecoMedio) * 100)}%`,
                    backgroundImage: 'linear-gradient(90deg, #0284c7, #38bdf8)',
                  }}
                />
              )}
            </div>
            <span className="text-sky-600 font-bold text-xs shrink-0 tabular-nums w-28 text-right">
              {preco !== null ? formatPrecoMedio(preco, produto.unidade) : '—'}
            </span>
          </div>
        </li>
      );
    })}
  </ul>
);

export const VendasResumo: React.FC<VendasResumoProps> = ({
  resumo,
  loading,
  erro,
  metaVendas,
  exibirProgressoMeta = false,
  exibirDetalhesProdutos = true,
  exibirKpisParafusosFrete = false,
}) => {
  if (loading) {
    return (
      <div className="p-10 rounded-3xl bg-white border border-neutral-200 flex flex-col items-center justify-center gap-2 text-neutral-500 text-xs">
        <RefreshCw className="w-5 h-5 animate-spin text-yellow-600" aria-hidden="true" />
        <span>Consultando vendas no Nomus...</span>
      </div>
    );
  }

  if (erro) {
    return (
      <div className="p-10 rounded-3xl bg-white border border-neutral-200 flex flex-col items-center justify-center gap-2 text-center">
        <AlertTriangle className="w-5 h-5 text-red-600" aria-hidden="true" />
        <span className="text-red-600 text-xs font-semibold">Não foi possível carregar o resumo de vendas</span>
        <span className="text-neutral-500 text-[11px] max-w-sm">{erro}</span>
      </div>
    );
  }

  if (!resumo) return null;

  const maiorValorProduto = resumo.produtos.reduce((max, p) => Math.max(max, p.valorTotal), 0) || 1;
  const maiorPrecoMedio = resumo.produtos.reduce((max, p) => Math.max(max, precoMedioDe(p.valorTotal, p.quantidade) ?? 0), 0) || 1;
  const ticketMedio = resumo.totalPedidos > 0 ? resumo.totalVendas / resumo.totalPedidos : 0;
  const percentualMeta = metaVendas ? (resumo.totalVendas / metaVendas) * 100 : 0;

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
        <div className="rounded-2xl bg-emerald-50 border border-emerald-100 p-4 flex flex-col gap-1.5">
          <span className="flex items-center gap-1.5 text-xs text-emerald-700/80 font-medium">
            <Wallet className="w-3.5 h-3.5 text-emerald-600" aria-hidden="true" />
            Total de Vendas
          </span>
          <span className="text-xl font-black text-emerald-900 tabular-nums">{formatCurrency(resumo.totalVendas)}</span>
        </div>

        <div className="rounded-2xl bg-violet-50 border border-violet-100 p-4 flex flex-col gap-1.5">
          <span className="flex items-center gap-1.5 text-xs text-violet-700/80 font-medium">
            <Package className="w-3.5 h-3.5 text-violet-600" aria-hidden="true" />
            Pedidos
          </span>
          <span className="text-xl font-black text-violet-900 tabular-nums">{formatInteiro(resumo.totalPedidos)}</span>
        </div>

        <div className="rounded-2xl bg-amber-50 border border-amber-100 p-4 flex flex-col gap-1.5">
          <span className="flex items-center gap-1.5 text-xs text-amber-700/80 font-medium">
            <Users className="w-3.5 h-3.5 text-amber-600" aria-hidden="true" />
            Vendedores Ativos
          </span>
          <span className="text-xl font-black text-amber-900 tabular-nums">{formatInteiro(resumo.vendedoresAtivos)}</span>
        </div>

        <div className="rounded-2xl bg-rose-50 border border-rose-100 p-4 flex flex-col gap-1.5">
          <span className="flex items-center gap-1.5 text-xs text-rose-700/80 font-medium">
            <Receipt className="w-3.5 h-3.5 text-rose-600" aria-hidden="true" />
            Ticket Médio
          </span>
          <span className="text-xl font-black text-rose-900 tabular-nums" title="Total de vendas ÷ número de pedidos do período">
            {formatCurrency(ticketMedio)}
          </span>
        </div>

        <div className="rounded-2xl bg-teal-50 border border-teal-100 p-4 flex flex-col gap-1.5">
          <span className="flex items-center gap-1.5 text-xs text-teal-700/80 font-medium">
            <CircleDollarSign className="w-3.5 h-3.5 text-teal-600" aria-hidden="true" />
            Recebido dos Pedidos
            {resumo.financeiroPedidosCarregando && (
              <RefreshCw className="h-3 w-3 animate-spin" aria-label="Atualizando em segundo plano" />
            )}
          </span>
          <span className="text-xl font-black text-teal-900 tabular-nums" title="Valor já recebido das contas vinculadas aos pedidos do período">
            {formatCurrency(resumo.valorRecebidoPedidos ?? 0)}
          </span>
          {resumo.financeiroPedidosCarregando && (
            <span className="text-[9px] font-semibold text-teal-700/60">Atualizando em segundo plano</span>
          )}
        </div>

        <div className="rounded-2xl bg-orange-50 border border-orange-100 p-4 flex flex-col gap-1.5">
          <span className="flex items-center gap-1.5 text-xs text-orange-700/80 font-medium">
            <Hourglass className="w-3.5 h-3.5 text-orange-600" aria-hidden="true" />
            Falta Receber
            {resumo.financeiroPedidosCarregando && (
              <RefreshCw className="h-3 w-3 animate-spin" aria-label="Atualizando em segundo plano" />
            )}
          </span>
          <span className="text-xl font-black text-orange-900 tabular-nums" title="Total dos pedidos menos os valores já recebidos">
            {formatCurrency(resumo.valorPendentePedidos ?? resumo.totalVendas)}
          </span>
          {resumo.financeiroPedidosCarregando && (
            <span className="text-[9px] font-semibold text-orange-700/60">Atualizando em segundo plano</span>
          )}
        </div>

        {exibirKpisParafusosFrete && (
          <>
            <div className="rounded-2xl bg-amber-50 border border-amber-200 p-4 flex flex-col gap-1.5">
              <span className="flex items-center gap-1.5 text-xs text-amber-700/80 font-medium">
                <Nut className="w-3.5 h-3.5 text-amber-600" aria-hidden="true" />
                Total em Parafusos
              </span>
              <span className="text-xl font-black text-amber-900 tabular-nums">
                {formatCurrency(resumo.totalValorParafusos ?? 0)}
              </span>
            </div>

            <div className="rounded-2xl bg-cyan-50 border border-cyan-200 p-4 flex flex-col gap-1.5">
              <span className="flex items-center gap-1.5 text-xs text-cyan-700/80 font-medium">
                <Truck className="w-3.5 h-3.5 text-cyan-600" aria-hidden="true" />
                Total em Frete
              </span>
              <span className="text-xl font-black text-cyan-900 tabular-nums">
                {formatCurrency(resumo.totalFrete ?? 0)}
              </span>
            </div>
          </>
        )}

        {metaVendas !== undefined && (
          <div className="rounded-2xl bg-yellow-50 border border-yellow-200 p-4 flex flex-col gap-1.5">
            <span className="flex items-center gap-1.5 text-xs text-yellow-800/80 font-medium">
              <Target className="w-3.5 h-3.5 text-yellow-600" aria-hidden="true" />
              Meta Mensal
            </span>
            <span className="text-xl font-black text-yellow-900 tabular-nums">{formatCurrency(metaVendas)}</span>
            {exibirProgressoMeta && (
              <>
                <div className="h-1.5 rounded-full bg-yellow-100 overflow-hidden" aria-hidden="true">
                  <div
                    className="h-full rounded-full bg-yellow-500 transition-all"
                    style={{ width: `${Math.min(100, percentualMeta)}%` }}
                  />
                </div>
                <span className="text-[11px] font-semibold text-yellow-800 tabular-nums">
                  {percentualMeta.toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}% atingido
                </span>
              </>
            )}
          </div>
        )}
      </div>

      {exibirDetalhesProdutos && (resumo.produtos.length === 0 ? (
        <div className="rounded-2xl bg-white border border-neutral-200 p-5">
          <p className="text-neutral-500 text-xs">Nenhuma venda de produto encontrada nesse período.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          <div className="rounded-2xl bg-white border border-neutral-200 p-5">
            <h3 className="flex items-center justify-between gap-2 text-sm font-bold text-neutral-900 mb-4">
              <span className="flex items-center gap-2">
                <BarChart3 className="w-4 h-4 text-yellow-600" aria-hidden="true" />
                Vendas por Produto
              </span>
              <span className="text-[11px] font-normal text-neutral-500">
                {formatInteiro(resumo.produtos.length)} {resumo.produtos.length === 1 ? 'produto' : 'produtos'}
              </span>
            </h3>
            <div className="max-h-[480px] overflow-y-auto pr-1">
              <ListaVendasPorProduto produtos={resumo.produtos} maiorValorProduto={maiorValorProduto} />
            </div>
          </div>

          <div className="rounded-2xl bg-white border border-neutral-200 p-5">
            <h3 className="flex items-center justify-between gap-2 text-sm font-bold text-neutral-900 mb-4">
              <span className="flex items-center gap-2">
                <Tag className="w-4 h-4 text-sky-600" aria-hidden="true" />
                Preço Médio de Venda
              </span>
              <span className="text-[11px] font-normal text-neutral-500">
                {formatInteiro(resumo.produtos.length)} {resumo.produtos.length === 1 ? 'produto' : 'produtos'}
              </span>
            </h3>
            <div className="max-h-[480px] overflow-y-auto pr-1">
              <ListaPrecoMedio produtos={resumo.produtos} maiorPrecoMedio={maiorPrecoMedio} />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
};
