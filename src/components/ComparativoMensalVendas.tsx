import React, { useEffect, useState } from 'react';
import { BarChart3, RefreshCw, TrendingDown, TrendingUp } from 'lucide-react';
import { ComparativoMensalVendasItem } from '../types';

interface ComparativoMensalVendasProps {
  mesBase?: string;
}

type ChaveMetrica = keyof Pick<
  ComparativoMensalVendasItem,
  | 'totalVendas'
  | 'totalPedidos'
  | 'vendedoresAtivos'
  | 'ticketMedio'
  | 'valorRecebido'
  | 'valorPendente'
  | 'totalValorParafusos'
  | 'totalFrete'
>;

interface Metrica {
  chave: ChaveMetrica;
  label: string;
  formato: 'moeda' | 'inteiro';
  cor: string;
}

const grupos: { titulo: string; subtitulo: string; metricas: Metrica[] }[] = [
  {
    titulo: 'Visão financeira',
    subtitulo: 'Faturamento e liquidação dos pedidos',
    metricas: [
      { chave: 'totalVendas', label: 'Total vendido', formato: 'moeda', cor: 'bg-emerald-500' },
      { chave: 'valorRecebido', label: 'Recebido', formato: 'moeda', cor: 'bg-teal-500' },
      { chave: 'valorPendente', label: 'Falta receber', formato: 'moeda', cor: 'bg-orange-500' },
    ],
  },
  {
    titulo: 'Desempenho comercial',
    subtitulo: 'Volume, equipe ativa e eficiência',
    metricas: [
      { chave: 'totalPedidos', label: 'Pedidos', formato: 'inteiro', cor: 'bg-violet-500' },
      { chave: 'vendedoresAtivos', label: 'Vendedores ativos', formato: 'inteiro', cor: 'bg-amber-500' },
      { chave: 'ticketMedio', label: 'Ticket médio', formato: 'moeda', cor: 'bg-rose-500' },
    ],
  },
  {
    titulo: 'Receitas complementares',
    subtitulo: 'Parafusos, fretes e outras despesas',
    metricas: [
      { chave: 'totalValorParafusos', label: 'Total em parafusos', formato: 'moeda', cor: 'bg-yellow-500' },
      { chave: 'totalFrete', label: 'Fretes e outros', formato: 'moeda', cor: 'bg-cyan-500' },
    ],
  },
];

const formatar = (valor: number, formato: Metrica['formato']) =>
  formato === 'moeda'
    ? valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 })
    : valor.toLocaleString('pt-BR', { maximumFractionDigits: 0 });

const LinhaComparativa: React.FC<{
  metrica: Metrica;
  anterior: ComparativoMensalVendasItem;
  atual: ComparativoMensalVendasItem;
}> = ({ metrica, anterior, atual }) => {
  const valorAnterior = Number(anterior[metrica.chave]) || 0;
  const valorAtual = Number(atual[metrica.chave]) || 0;
  const maior = Math.max(valorAnterior, valorAtual, 1);
  const variacao = valorAnterior > 0 ? ((valorAtual - valorAnterior) / valorAnterior) * 100 : null;
  const subiu = (variacao ?? 0) >= 0;

  return (
    <div className="space-y-1.5 rounded-xl border border-neutral-100 bg-neutral-50/60 p-3">
      <div className="flex items-center justify-between gap-3">
        <span className="text-[11px] font-black text-neutral-800">{metrica.label}</span>
        <span
          className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[9px] font-black ${
            variacao === null
              ? 'bg-neutral-200 text-neutral-600'
              : subiu
                ? 'bg-emerald-100 text-emerald-700'
                : 'bg-red-100 text-red-700'
          }`}
        >
          {variacao === null ? 'Sem base' : (
            <>
              {subiu ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
              {Math.abs(variacao).toLocaleString('pt-BR', { maximumFractionDigits: 1 })}%
            </>
          )}
        </span>
      </div>

      <div className="grid grid-cols-[42px_1fr_auto] items-center gap-2">
        <span className="text-[9px] font-bold text-neutral-400">{anterior.rotulo}</span>
        <div className="h-2 overflow-hidden rounded-full bg-neutral-200">
          <div className="h-full rounded-full bg-neutral-400" style={{ width: `${Math.max(2, (valorAnterior / maior) * 100)}%` }} />
        </div>
        <span className="min-w-20 text-right text-[10px] font-bold tabular-nums text-neutral-500">
          {formatar(valorAnterior, metrica.formato)}
        </span>
      </div>

      <div className="grid grid-cols-[42px_1fr_auto] items-center gap-2">
        <span className="text-[9px] font-black text-neutral-700">{atual.rotulo}</span>
        <div className="h-2.5 overflow-hidden rounded-full bg-neutral-200">
          <div className={`h-full rounded-full ${metrica.cor}`} style={{ width: `${Math.max(2, (valorAtual / maior) * 100)}%` }} />
        </div>
        <span className="min-w-20 text-right text-[10px] font-black tabular-nums text-neutral-900">
          {formatar(valorAtual, metrica.formato)}
        </span>
      </div>
    </div>
  );
};

export const ComparativoMensalVendas: React.FC<ComparativoMensalVendasProps> = ({ mesBase }) => {
  const chaveCache = `gferro:comparativo-mensal-v3-emissao-somente-liberados:${mesBase || 'atual'}`;
  const [meses, setMeses] = useState<ComparativoMensalVendasItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [atualizadoEm, setAtualizadoEm] = useState<string | null>(null);

  useEffect(() => {
    let cancelado = false;
    let possuiCache = false;
    try {
      const salvo = localStorage.getItem(chaveCache);
      if (salvo) {
        const cache = JSON.parse(salvo) as { meses: ComparativoMensalVendasItem[]; atualizadoEm: string };
        if (Array.isArray(cache.meses) && cache.meses.length === 2) {
          setMeses(cache.meses);
          setAtualizadoEm(cache.atualizadoEm);
          setLoading(false);
          possuiCache = true;
        }
      }
    } catch {
      // Segue com a consulta ao servidor.
    }

    const carregar = async () => {
      try {
        const query = mesBase ? `?mes=${encodeURIComponent(mesBase)}` : '';
        const resposta = await fetch(`/api/vendas/comparativo-mensal${query}`);
        const dados = await resposta.json();
        if (!resposta.ok) throw new Error(dados?.error || 'Falha ao buscar comparativo mensal');
        if (cancelado) return;
        setMeses(dados.meses);
        setAtualizadoEm(dados.atualizadoEm);
        setErro(null);
        localStorage.setItem(chaveCache, JSON.stringify(dados));
      } catch (err: any) {
        if (!cancelado && !possuiCache) setErro(err.message || 'Falha ao buscar comparativo mensal');
      } finally {
        if (!cancelado) setLoading(false);
      }
    };

    void carregar();
    const timer = window.setInterval(carregar, 3 * 60 * 1000);
    return () => {
      cancelado = true;
      window.clearInterval(timer);
    };
  }, [chaveCache, mesBase]);

  if (loading && meses.length === 0) {
    return (
      <section className="flex min-h-44 items-center justify-center gap-2 rounded-3xl border border-neutral-200 bg-white text-xs text-neutral-500">
        <RefreshCw className="h-5 w-5 animate-spin text-yellow-600" />
        Preparando comparativo mensal...
      </section>
    );
  }

  if (erro && meses.length === 0) return null;
  if (meses.length < 2) return null;
  const [anterior, atual] = meses;

  return (
    <section className="overflow-hidden rounded-3xl border border-neutral-200 bg-white shadow-sm">
      <header className="flex flex-col gap-3 border-b border-neutral-100 px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
        <div>
          <span className="text-[9px] font-black uppercase tracking-[0.2em] text-yellow-600">Inteligência comercial</span>
          <h2 className="mt-0.5 flex items-center gap-2 text-lg font-black text-neutral-950">
            <BarChart3 className="h-5 w-5 text-yellow-500" />
            Comparativo mensal
          </h2>
          <p className="mt-0.5 text-[11px] text-neutral-500">Análise de {anterior.rotulo} contra {atual.rotulo}, com variação percentual.</p>
        </div>
        <div className="flex items-center gap-3 text-[9px] font-bold text-neutral-400">
          <span className="inline-flex items-center gap-1"><i className="h-2 w-2 rounded-full bg-neutral-400" />{anterior.rotulo}</span>
          <span className="inline-flex items-center gap-1"><i className="h-2 w-2 rounded-full bg-yellow-500" />{atual.rotulo}</span>
          {atualizadoEm && <span>Atualizado {new Date(atualizadoEm).toLocaleString('pt-BR')}</span>}
        </div>
      </header>

      <div className="grid gap-4 p-4 lg:grid-cols-3 sm:p-6">
        {grupos.map((grupo) => (
          <article key={grupo.titulo} className="rounded-2xl border border-neutral-200 bg-white p-3 shadow-sm">
            <div className="mb-3 border-b border-neutral-100 px-1 pb-2">
              <h3 className="text-xs font-black text-neutral-900">{grupo.titulo}</h3>
              <p className="text-[9px] text-neutral-400">{grupo.subtitulo}</p>
            </div>
            <div className="space-y-2">
              {grupo.metricas.map((metrica) => (
                <LinhaComparativa key={metrica.chave} metrica={metrica} anterior={anterior} atual={atual} />
              ))}
            </div>
          </article>
        ))}
      </div>
    </section>
  );
};
