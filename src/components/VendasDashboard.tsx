import React, { useEffect, useMemo, useState } from 'react';
import { Trophy, ArrowLeft, RefreshCw, AlertTriangle, FileDown, Store } from 'lucide-react';
import { VendedorRanking, ResumoVendas } from '../types';
import { RankingFilters, Periodo, periodos, SeletorMesEspecifico } from './RankingFilters';
import { RankingPorLoja } from './RankingPorLoja';
import { RankingEmptyState } from './RankingEmptyState';
import { VendasResumo } from './VendasResumo';
import { LOJAS } from '../data/vendedorLoja';

type VendasView = 'painel' | 'ranking' | 'loja';

export const VendasDashboard: React.FC = () => {
  const [view, setView] = useState<VendasView>('painel');
  const [periodo, setPeriodo] = useState<Periodo>('mes');
  // Só é usado quando periodo === 'mes'; null = mês corrente.
  const [mes, setMes] = useState<string | null>(null);
  const [busca, setBusca] = useState('');
  const [somenteComPedidos, setSomenteComPedidos] = useState(false);
  const [lojaSelecionada, setLojaSelecionada] = useState<string | null>(null);

  const [ranking, setRanking] = useState<VendedorRanking[]>([]);
  const [atualizadoEm, setAtualizadoEm] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const [resumo, setResumo] = useState<ResumoVendas | null>(null);
  const [resumoLoading, setResumoLoading] = useState(false);
  const [resumoErro, setResumoErro] = useState<string | null>(null);

  const [resumoLoja, setResumoLoja] = useState<ResumoVendas | null>(null);
  const [resumoLojaLoading, setResumoLojaLoading] = useState(false);
  const [resumoLojaErro, setResumoLojaErro] = useState<string | null>(null);

  useEffect(() => {
    if (view !== 'ranking') return;

    let cancelado = false;
    setLoading(true);
    setErro(null);

    const mesQuery = periodo === 'mes' && mes ? `&mes=${mes}` : '';
    fetch(`/api/vendas/ranking?periodo=${periodo}${mesQuery}`)
      .then(async (res) => {
        const data = await res.json();
        if (!res.ok) throw new Error(data?.error || 'Falha ao buscar dados do Nomus');
        return data as { ranking: VendedorRanking[]; atualizadoEm: string };
      })
      .then((data) => {
        if (cancelado) return;
        setRanking(data.ranking);
        setAtualizadoEm(data.atualizadoEm);
      })
      .catch((err) => {
        if (cancelado) return;
        setErro(err.message || 'Falha ao buscar dados do Nomus');
      })
      .finally(() => {
        if (!cancelado) setLoading(false);
      });

    return () => {
      cancelado = true;
    };
  }, [view, periodo, mes]);

  useEffect(() => {
    if (view !== 'painel') return;

    let cancelado = false;
    setResumoLoading(true);
    setResumoErro(null);

    const mesQuery = periodo === 'mes' && mes ? `&mes=${mes}` : '';
    fetch(`/api/vendas/resumo?periodo=${periodo}${mesQuery}`)
      .then(async (res) => {
        const data = await res.json();
        if (!res.ok) throw new Error(data?.error || 'Falha ao buscar dados do Nomus');
        return data as ResumoVendas;
      })
      .then((data) => {
        if (cancelado) return;
        setResumo(data);
      })
      .catch((err) => {
        if (cancelado) return;
        setResumoErro(err.message || 'Falha ao buscar dados do Nomus');
      })
      .finally(() => {
        if (!cancelado) setResumoLoading(false);
      });

    return () => {
      cancelado = true;
    };
  }, [view, periodo, mes]);

  useEffect(() => {
    if (view !== 'loja' || !lojaSelecionada) return;

    let cancelado = false;
    setResumoLojaLoading(true);
    setResumoLojaErro(null);

    const mesQuery = periodo === 'mes' && mes ? `&mes=${mes}` : '';
    fetch(`/api/vendas/lojas/${lojaSelecionada}/resumo?periodo=${periodo}${mesQuery}`)
      .then(async (res) => {
        const data = await res.json();
        if (!res.ok) throw new Error(data?.error || 'Falha ao buscar dados do Nomus');
        return data as ResumoVendas;
      })
      .then((data) => {
        if (cancelado) return;
        setResumoLoja(data);
      })
      .catch((err) => {
        if (cancelado) return;
        setResumoLojaErro(err.message || 'Falha ao buscar dados do Nomus');
      })
      .finally(() => {
        if (!cancelado) setResumoLojaLoading(false);
      });

    return () => {
      cancelado = true;
    };
  }, [view, lojaSelecionada, periodo, mes]);

  // A posição sempre reflete o ranking completo do período (nunca é
  // recalculada a partir da lista filtrada), pra não fabricar posições.
  const rankingComPosicao = useMemo(
    () => ranking.map((v, index) => ({ ...v, posicao: index + 1 })),
    [ranking]
  );

  const rankingFiltrado = useMemo(() => {
    const normalizar = (texto: string) =>
      texto.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase();
    const buscaNormalizada = normalizar(busca.trim());

    return rankingComPosicao.filter((v) => {
      const bateNome = normalizar(v.nome).includes(buscaNormalizada);
      const bateFiltro = !somenteComPedidos || v.pedidos > 0;
      return bateNome && bateFiltro;
    });
  }, [rankingComPosicao, busca, somenteComPedidos]);

  // Arquivo de verdade gerado no servidor (não é window.print()) — mesmo
  // período já carregado na tela.
  const mesQuery = periodo === 'mes' && mes ? `&mes=${mes}` : '';

  const baixarPdf = () => {
    const a = document.createElement('a');
    a.href = `/api/vendas/ranking/pdf?periodo=${periodo}${mesQuery}`;
    a.click();
  };

  const baixarPdfResumo = () => {
    const a = document.createElement('a');
    a.href = `/api/vendas/resumo/pdf?periodo=${periodo}${mesQuery}`;
    a.click();
  };

  if (view === 'ranking') {
    return (
      <div className="space-y-6">
        <button
          type="button"
          onClick={() => setView('painel')}
          className="flex items-center gap-2 px-3 py-2 rounded-full bg-white border border-neutral-200 text-neutral-600 hover:text-yellow-600 hover:border-yellow-400 text-xs font-semibold transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-yellow-400"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Voltar ao Painel</span>
        </button>

        <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-2">
          <div>
            <span className="text-xs font-bold uppercase tracking-widest text-yellow-600">Dashboard • Vendas</span>
            <h1 className="text-2xl font-black text-neutral-900 mt-1 flex items-center gap-2">
              <Trophy className="w-6 h-6 text-yellow-600" aria-hidden="true" />
              Ranking de Vendedores
            </h1>
            <p className="text-neutral-500 text-sm mt-1">
              Soma do valor total dos pedidos por vendedor, do maior pro menor — direto do Nomus.
            </p>
          </div>
          <div className="flex items-center gap-3 shrink-0">
            {atualizadoEm && !loading && (
              <span className="text-neutral-500 text-[11px] sm:text-right">
                Atualizado em {new Date(atualizadoEm).toLocaleString('pt-BR')}
              </span>
            )}
            <button
              type="button"
              onClick={baixarPdf}
              disabled={loading || !!erro || ranking.length === 0}
              title="Baixa o ranking completo do período (não aplica a busca por nome)"
              className="flex items-center gap-2 px-4 py-2 rounded-full bg-white text-black font-bold text-xs hover:bg-neutral-200 disabled:opacity-40 disabled:cursor-not-allowed transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-yellow-400 focus-visible:ring-offset-2 focus-visible:ring-offset-black"
            >
              <FileDown className="w-4 h-4" aria-hidden="true" />
              Baixar PDF
            </button>
          </div>
        </div>

        <div className="rounded-3xl bg-white border border-neutral-200 overflow-hidden">
          <RankingFilters
            periodo={periodo}
            setPeriodo={setPeriodo}
            mes={mes}
            setMes={setMes}
            busca={busca}
            setBusca={setBusca}
            somenteComPedidos={somenteComPedidos}
            setSomenteComPedidos={setSomenteComPedidos}
          />

          <div className="px-5 pt-3 pb-1">
            <span className="text-neutral-500 text-[11px]">
              {loading ? 'Buscando no Nomus...' : `${rankingFiltrado.length} registros encontrados`}
            </span>
          </div>

          {loading && (
            <div className="px-5 py-10 flex flex-col items-center gap-2 text-neutral-500 text-xs">
              <RefreshCw className="w-5 h-5 animate-spin text-yellow-600" aria-hidden="true" />
              <span>Consultando pedidos e vendedores no Nomus...</span>
            </div>
          )}

          {!loading && erro && (
            <div className="px-5 py-10 flex flex-col items-center gap-2 text-center">
              <AlertTriangle className="w-5 h-5 text-red-600" aria-hidden="true" />
              <span className="text-red-600 text-xs font-semibold">Não foi possível carregar o ranking</span>
              <span className="text-neutral-500 text-[11px] max-w-sm">{erro}</span>
            </div>
          )}

          {!loading && !erro && rankingFiltrado.length === 0 && <RankingEmptyState />}

          {!loading && !erro && rankingFiltrado.length > 0 && (
            <div className="p-5">
              <RankingPorLoja vendedores={rankingFiltrado} />
            </div>
          )}
        </div>
      </div>
    );
  }

  if (view === 'loja' && lojaSelecionada) {
    const loja = LOJAS.find((l) => l.id === lojaSelecionada);
    return (
      <div className="space-y-6">
        <button
          type="button"
          onClick={() => setView('painel')}
          className="flex items-center gap-2 px-3 py-2 rounded-full bg-white border border-neutral-200 text-neutral-600 hover:text-yellow-600 hover:border-yellow-400 text-xs font-semibold transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-yellow-400"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Voltar ao Painel</span>
        </button>

        <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-2">
          <div>
            <span className="text-xs font-bold uppercase tracking-widest text-yellow-600">Dashboard • Vendas</span>
            <h1 className="text-2xl font-black text-neutral-900 mt-1 flex items-center gap-2">
              <Store className="w-6 h-6 text-yellow-600" aria-hidden="true" />
              {loja?.nome ?? 'Loja'}
            </h1>
            <p className="text-neutral-500 text-sm mt-1">Vendas do período — só os pedidos dos vendedores desta unidade.</p>
          </div>
          {resumoLoja && !resumoLojaLoading && (
            <span className="text-neutral-500 text-[11px] shrink-0 sm:text-right">
              Atualizado em {new Date(resumoLoja.atualizadoEm).toLocaleString('pt-BR')}
            </span>
          )}
        </div>

        <div className="flex flex-col sm:flex-row sm:items-center gap-3">
          <div
            role="group"
            aria-label="Período do resumo da loja"
            className="flex items-center gap-1.5 bg-neutral-50 p-1 rounded-full border border-neutral-200 w-fit"
          >
            {periodos.map((p) => {
              const selecionado = periodo === p.id;
              return (
                <button
                  key={p.id}
                  type="button"
                  aria-pressed={selecionado}
                  onClick={() => setPeriodo(p.id)}
                  className={`px-3.5 py-1.5 rounded-full text-xs transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-yellow-400 focus-visible:ring-offset-2 focus-visible:ring-offset-black ${
                    selecionado ? 'bg-yellow-400 text-black font-bold' : 'text-neutral-500 font-medium hover:text-neutral-900'
                  }`}
                >
                  {p.label}
                  {selecionado && <span className="sr-only"> (selecionado)</span>}
                </button>
              );
            })}
          </div>

          <SeletorMesEspecifico periodo={periodo} mes={mes} setMes={setMes} />
        </div>

        <VendasResumo
          resumo={resumoLoja}
          loading={resumoLojaLoading}
          erro={resumoLojaErro}
          metaVendas={loja?.metaVendas}
          exibirProgressoMeta={periodo === 'mes'}
        />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
        <div>
          <span className="text-xs font-bold uppercase tracking-widest text-yellow-600">Dashboard • Vendas</span>
          <h1 className="text-2xl font-black text-neutral-900 mt-1">Painel de Vendas</h1>
          <p className="text-neutral-500 text-sm mt-1">
            Acompanhamento de pedidos, vendedores e desempenho comercial da GFERRO.
          </p>
        </div>

        {/* Menuzinho interno */}
        <button
          type="button"
          onClick={() => setView('ranking')}
          className="shrink-0 flex items-center gap-2 px-4 py-2.5 rounded-full bg-yellow-400 text-black font-extrabold text-xs hover:bg-yellow-300 shadow-lg shadow-yellow-400/20 active:scale-95 transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-yellow-400 focus-visible:ring-offset-2 focus-visible:ring-offset-black"
        >
          <Trophy className="w-4 h-4" aria-hidden="true" />
          <span>Ranking de Vendedores</span>
        </button>
      </div>

      <div className="flex items-center gap-2 flex-wrap">
        {LOJAS.map((loja) => (
          <button
            key={loja.id}
            type="button"
            onClick={() => {
              setLojaSelecionada(loja.id);
              setView('loja');
            }}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-full bg-yellow-400 text-black font-bold hover:bg-yellow-300 shadow-sm active:scale-95 text-xs transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-yellow-400 focus-visible:ring-offset-2 focus-visible:ring-offset-black"
          >
            <Store className="w-3.5 h-3.5" aria-hidden="true" />
            <span>{loja.nome}</span>
          </button>
        ))}
      </div>

      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="flex items-center gap-3 flex-wrap">
          <div
            role="group"
            aria-label="Período do resumo de vendas"
            className="flex items-center gap-1.5 bg-neutral-50 p-1 rounded-full border border-neutral-200 w-fit"
          >
            {periodos.map((p) => {
              const selecionado = periodo === p.id;
              return (
                <button
                  key={p.id}
                  type="button"
                  aria-pressed={selecionado}
                  onClick={() => setPeriodo(p.id)}
                  className={`px-3.5 py-1.5 rounded-full text-xs transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-yellow-400 focus-visible:ring-offset-2 focus-visible:ring-offset-black ${
                    selecionado ? 'bg-yellow-400 text-black font-bold' : 'text-neutral-500 font-medium hover:text-neutral-900'
                  }`}
                >
                  {p.label}
                  {selecionado && <span className="sr-only"> (selecionado)</span>}
                </button>
              );
            })}
          </div>

          <SeletorMesEspecifico periodo={periodo} mes={mes} setMes={setMes} />
        </div>

        <div className="flex items-center gap-3">
          {resumo && !resumoLoading && (
            <span className="text-neutral-500 text-[11px]">
              Atualizado em {new Date(resumo.atualizadoEm).toLocaleString('pt-BR')}
            </span>
          )}
          <button
            type="button"
            onClick={baixarPdfResumo}
            disabled={resumoLoading || !!resumoErro || !resumo}
            className="flex items-center gap-2 px-4 py-2 rounded-full bg-white text-black font-bold text-xs hover:bg-neutral-200 disabled:opacity-40 disabled:cursor-not-allowed transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-yellow-400 focus-visible:ring-offset-2 focus-visible:ring-offset-black"
          >
            <FileDown className="w-4 h-4" aria-hidden="true" />
            Baixar PDF
          </button>
        </div>
      </div>

      <VendasResumo resumo={resumo} loading={resumoLoading} erro={resumoErro} />
    </div>
  );
};
