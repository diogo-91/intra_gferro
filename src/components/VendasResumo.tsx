import React from 'react';
import { Wallet, Ruler, Package, Users, RefreshCw, AlertTriangle, BarChart3 } from 'lucide-react';
import { ResumoVendas } from '../types';
import { formatCurrency, formatMetrosQuadrados, formatInteiro } from '../utils/format';

interface VendasResumoProps {
  resumo: ResumoVendas | null;
  loading: boolean;
  erro: string | null;
}

const formatUnidade = (quantidade: number, unidade: string) => {
  const numero = quantidade.toLocaleString('pt-BR', { maximumFractionDigits: 2 });
  return unidade ? `${numero} ${unidade}` : numero;
};

// Preço médio = valor total dividido pela quantidade vendida — precisa de
// casas decimais (diferente do formatCurrency de totais, que arredonda pro
// real inteiro), senão R$ 0,xx vira "R$ 0".
const formatPrecoMedio = (valorTotal: number, quantidade: number, unidade: string): string | null => {
  if (quantidade <= 0) return null;
  const preco = valorTotal / quantidade;
  const precoFormatado = preco.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return unidade ? `${precoFormatado}/${unidade}` : precoFormatado;
};

interface ListaProdutosProps {
  produtos: ResumoVendas['produtos'];
  maiorValorProduto: number;
}

const ListaProdutos: React.FC<ListaProdutosProps> = ({ produtos, maiorValorProduto }) => (
  <ul className="space-y-3">
    {produtos.map((produto) => {
      const precoMedio = formatPrecoMedio(produto.valorTotal, produto.quantidade, produto.unidade);
      return (
        <li key={produto.nome} className="space-y-1">
          <div className="flex items-center justify-between gap-3 text-xs">
            <span className="text-neutral-800 font-medium truncate" title={produto.nome}>
              {produto.nome}
            </span>
            <span className="flex items-center gap-1.5 shrink-0 tabular-nums">
              <span className="text-neutral-500">{formatUnidade(produto.quantidade, produto.unidade)}</span>
              {precoMedio && (
                <span className="text-neutral-400 font-normal" title="Preço médio (valor total ÷ quantidade)">
                  · {precoMedio}
                </span>
              )}
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
      );
    })}
  </ul>
);

export const VendasResumo: React.FC<VendasResumoProps> = ({ resumo, loading, erro }) => {
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
  const metade = Math.ceil(resumo.produtos.length / 2);
  const primeiraColuna = resumo.produtos.slice(0, metade);
  const segundaColuna = resumo.produtos.slice(metade);

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="rounded-2xl bg-white border border-neutral-200 p-4 flex flex-col gap-1.5">
          <span className="flex items-center gap-1.5 text-xs text-neutral-500">
            <Wallet className="w-3.5 h-3.5 text-emerald-600" aria-hidden="true" />
            Total de Vendas
          </span>
          <span className="text-xl font-black text-neutral-900 tabular-nums">{formatCurrency(resumo.totalVendas)}</span>
        </div>

        <div className="rounded-2xl bg-white border border-neutral-200 p-4 flex flex-col gap-1.5">
          <span className="flex items-center gap-1.5 text-xs text-neutral-500">
            <Package className="w-3.5 h-3.5 text-violet-600" aria-hidden="true" />
            Pedidos
          </span>
          <span className="text-xl font-black text-neutral-900 tabular-nums">{formatInteiro(resumo.totalPedidos)}</span>
        </div>

        <div className="rounded-2xl bg-white border border-neutral-200 p-4 flex flex-col gap-1.5">
          <span className="flex items-center gap-1.5 text-xs text-neutral-500">
            <Ruler className="w-3.5 h-3.5 text-sky-600" aria-hidden="true" />
            Área Vendida
          </span>
          <span className="text-xl font-black text-neutral-900 tabular-nums">
            {formatMetrosQuadrados(resumo.totalMetrosQuadrados)}
          </span>
        </div>

        <div className="rounded-2xl bg-white border border-neutral-200 p-4 flex flex-col gap-1.5">
          <span className="flex items-center gap-1.5 text-xs text-neutral-500">
            <Users className="w-3.5 h-3.5 text-yellow-600" aria-hidden="true" />
            Vendedores Ativos
          </span>
          <span className="text-xl font-black text-neutral-900 tabular-nums">{formatInteiro(resumo.vendedoresAtivos)}</span>
        </div>
      </div>

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

        {resumo.produtos.length === 0 ? (
          <p className="text-neutral-500 text-xs">Nenhuma venda de produto encontrada nesse período.</p>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-x-8 gap-y-4 max-h-[480px] overflow-y-auto pr-1">
            <ListaProdutos produtos={primeiraColuna} maiorValorProduto={maiorValorProduto} />
            <ListaProdutos produtos={segundaColuna} maiorValorProduto={maiorValorProduto} />
          </div>
        )}
      </div>
    </div>
  );
};
