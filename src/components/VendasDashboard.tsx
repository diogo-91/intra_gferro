import React, { useEffect, useMemo, useState } from 'react';
import { Trophy, ArrowLeft, RefreshCw, AlertTriangle, FileDown, Store, Building2, Wallet, Users, Package, Clock3, X, ShoppingBag } from 'lucide-react';
import { VendedorRanking, ResumoVendas, PedidoVendedorDetalhe } from '../types';
import { RankingFilters, Periodo, periodos, SeletorMesEspecifico } from './RankingFilters';
import { RankingEmptyState } from './RankingEmptyState';
import { RankingPodio } from './RankingPodio';
import { RankingTable } from './RankingTable';
import { VendasResumo } from './VendasResumo';
import { LOJAS, lojaDoVendedor } from '../data/vendedorLoja';
import { formatCurrency, formatInteiro, formatNomeVendedor } from '../utils/format';

type VendasView = 'painel' | 'ranking' | 'loja';

const chaveCacheRankingLocal = (periodo: Periodo, mes: string | null) =>
  `gferro:ranking-v2:${periodo}:${periodo === 'mes' ? mes || 'atual' : ''}`;

const salvarRankingLocal = (
  periodo: Periodo,
  mes: string | null,
  dados: { ranking: VendedorRanking[]; atualizadoEm: string }
) => {
  try {
    localStorage.setItem(chaveCacheRankingLocal(periodo, mes), JSON.stringify(dados));
  } catch {
    // O cache do servidor continua sendo a fonte principal quando o navegador
    // bloqueia localStorage (modo privado/política corporativa).
  }
};

const formatCurrencyComCentavos = (valor: number) =>
  valor.toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

export const VendasDashboard: React.FC = () => {
  const [view, setView] = useState<VendasView>('painel');
  const [periodo, setPeriodo] = useState<Periodo>('mes');
  // Só é usado quando periodo === 'mes'; null = mês corrente.
  const [mes, setMes] = useState<string | null>(null);
  const [busca, setBusca] = useState('');
  const [somenteComPedidos, setSomenteComPedidos] = useState(false);
  const [lojaSelecionada, setLojaSelecionada] = useState<string | null>(null);
  const [rankingSelecionado, setRankingSelecionado] = useState<string>('geral');

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
  const [atualizandoForcado, setAtualizandoForcado] = useState(false);
  const [vendedorModal, setVendedorModal] = useState<string | null>(null);
  const [pedidosVendedor, setPedidosVendedor] = useState<PedidoVendedorDetalhe[]>([]);
  const [pedidosVendedorLoading, setPedidosVendedorLoading] = useState(false);
  const [pedidosVendedorErro, setPedidosVendedorErro] = useState<string | null>(null);
  const [pedidosVendedorAtualizadoEm, setPedidosVendedorAtualizadoEm] = useState<string | null>(null);

  useEffect(() => {
    if (view !== 'ranking' && view !== 'loja') return;

    let cancelado = false;
    let possuiCacheLocal = false;
    try {
      const salvo = localStorage.getItem(chaveCacheRankingLocal(periodo, mes));
      if (salvo) {
        const cache = JSON.parse(salvo) as { ranking?: VendedorRanking[]; atualizadoEm?: string };
        if (Array.isArray(cache.ranking) && cache.atualizadoEm) {
          setRanking(cache.ranking);
          setAtualizadoEm(cache.atualizadoEm);
          possuiCacheLocal = true;
        }
      }
    } catch {
      // Se o cache local estiver inválido, busca normalmente no servidor.
    }
    if (!possuiCacheLocal) setRanking([]);
    setLoading(!possuiCacheLocal);
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
        salvarRankingLocal(periodo, mes, data);
      })
      .catch((err) => {
        if (cancelado) return;
        // Uma falha de atualização não deve apagar o último ranking bom que
        // já foi mostrado pelo cache local.
        if (!possuiCacheLocal) setErro(err.message || 'Falha ao buscar dados do Nomus');
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

  // No geral, a posição é corporativa. Dentro de uma loja, a posição é
  // recalculada somente entre os vendedores daquela unidade. Busca e checkbox
  // são aplicados depois, para nunca fabricar posições ao filtrar a tabela.
  const rankingDaVisao = useMemo(() => {
    const vendedores = rankingSelecionado === 'geral'
      // O geral representa a empresa inteira, inclusive vendedores que ainda
      // não foram vinculados a uma das quatro unidades. Assim os KPIs batem
      // com o Painel de Vendas, que também considera todos os pedidos.
      ? ranking
      : ranking.filter((v) => lojaDoVendedor(v.nome) === rankingSelecionado);
    return vendedores.map((v, index) => ({ ...v, posicao: index + 1 }));
  }, [ranking, rankingSelecionado]);

  const rankingFiltrado = useMemo(() => {
    const normalizar = (texto: string) =>
      texto.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase();
    const buscaNormalizada = normalizar(busca.trim());

    return rankingDaVisao.filter((v) => {
      const bateNome = normalizar(v.nome).includes(buscaNormalizada);
      const bateFiltro = !somenteComPedidos || v.pedidos > 0;
      return bateNome && bateFiltro;
    });
  }, [rankingDaVisao, busca, somenteComPedidos]);

  const vendedoresDaLojaSelecionada = useMemo(() => {
    if (!lojaSelecionada) return [];
    return ranking
      .filter((vendedor) => lojaDoVendedor(vendedor.nome) === lojaSelecionada)
      .map((vendedor, index) => ({ ...vendedor, posicao: index + 1 }));
  }, [ranking, lojaSelecionada]);

  const resumoRanking = useMemo(
    () => rankingDaVisao.reduce(
      (total, vendedor) => ({
        vendas: total.vendas + vendedor.valorTotal,
        pedidos: total.pedidos + vendedor.pedidos,
        vendedoresAtivos: total.vendedoresAtivos + (vendedor.pedidos > 0 ? 1 : 0),
      }),
      { vendas: 0, pedidos: 0, vendedoresAtivos: 0 }
    ),
    [rankingDaVisao]
  );

  // Arquivo de verdade gerado no servidor (não é window.print()) — mesmo
  // período já carregado na tela.
  const mesQuery = periodo === 'mes' && mes ? `&mes=${mes}` : '';

  // O primeiro GET pode devolver o último cache enquanto o Nomus atualiza em
  // segundo plano. Esta consulta silenciosa reaplica o resultado novo sem
  // recarregar a página nem esconder o ranking já visível.
  useEffect(() => {
    if (view !== 'ranking' && view !== 'loja') return;
    const timer = window.setInterval(async () => {
      try {
        const resposta = await fetch(`/api/vendas/ranking?periodo=${periodo}${mesQuery}`);
        const dados = await resposta.json();
        if (!resposta.ok) return;
        setRanking(dados.ranking);
        setAtualizadoEm(dados.atualizadoEm);
        salvarRankingLocal(periodo, mes, dados);
      } catch {
        // Preserva o último ranking bom e tenta novamente no próximo ciclo.
      }
    }, 20_000);
    return () => window.clearInterval(timer);
  }, [view, periodo, mesQuery]);

  // O financeiro dos pedidos é atualizado separadamente porque a paginação
  // de contas a receber pode levar alguns minutos no Nomus. Enquanto isso,
  // mantém os dados de vendas visíveis e consulta silenciosamente até o novo
  // cache financeiro ficar pronto.
  useEffect(() => {
    const resumoAtual = view === 'loja' ? resumoLoja : resumo;
    if (!resumoAtual?.financeiroPedidosCarregando || view === 'ranking') return;

    const timer = window.setTimeout(async () => {
      try {
        const url = view === 'loja' && lojaSelecionada
          ? `/api/vendas/lojas/${lojaSelecionada}/resumo?periodo=${periodo}${mesQuery}`
          : `/api/vendas/resumo?periodo=${periodo}${mesQuery}`;
        const resposta = await fetch(url);
        const dados = await resposta.json();
        if (!resposta.ok) return;
        if (view === 'loja') setResumoLoja(dados as ResumoVendas);
        else setResumo(dados as ResumoVendas);
      } catch {
        // A tela continua com o último dado bom; a próxima interação tenta de novo.
      }
    }, 12_000);

    return () => window.clearTimeout(timer);
  }, [view, resumo, resumoLoja, lojaSelecionada, periodo, mesQuery]);

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

  const abrirPedidosVendedor = async (nome: string) => {
    setVendedorModal(nome);
    setPedidosVendedor([]);
    setPedidosVendedorErro(null);
    setPedidosVendedorAtualizadoEm(null);
    setPedidosVendedorLoading(true);
    try {
      const resposta = await fetch(
        `/api/vendas/vendedores/pedidos?periodo=${periodo}${mesQuery}&nome=${encodeURIComponent(nome)}`
      );
      const dados = await resposta.json();
      if (!resposta.ok) throw new Error(dados?.error || 'Falha ao buscar os pedidos do vendedor');
      setPedidosVendedor(dados.pedidos as PedidoVendedorDetalhe[]);
      setPedidosVendedorAtualizadoEm(dados.atualizadoEm);
    } catch (err: any) {
      setPedidosVendedorErro(err.message || 'Falha ao buscar os pedidos do vendedor');
    } finally {
      setPedidosVendedorLoading(false);
    }
  };

  const fecharPedidosVendedor = () => setVendedorModal(null);

  useEffect(() => {
    if (!vendedorModal) return;
    const overflowAnterior = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const fecharComEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') fecharPedidosVendedor();
    };
    window.addEventListener('keydown', fecharComEscape);
    return () => {
      document.body.style.overflow = overflowAnterior;
      window.removeEventListener('keydown', fecharComEscape);
    };
  }, [vendedorModal]);

  const modalPedidosVendedor = vendedorModal ? (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-8" role="dialog" aria-modal="true" aria-labelledby="titulo-pedidos-vendedor">
      <button
        type="button"
        className="absolute inset-0 bg-black/55 backdrop-blur-[2px]"
        onClick={fecharPedidosVendedor}
        aria-label="Fechar pedidos do vendedor"
      />
      <div className="relative flex max-h-[88vh] w-full max-w-6xl flex-col overflow-hidden rounded-3xl border border-neutral-200 bg-white shadow-2xl">
        <header className="flex items-start justify-between gap-4 border-b border-neutral-100 px-5 py-5 sm:px-7">
          <div>
            <span className="text-[9px] font-black uppercase tracking-[0.2em] text-yellow-600">Pedidos do vendedor</span>
            <h2 id="titulo-pedidos-vendedor" className="mt-1 flex items-center gap-2 text-xl font-black text-neutral-950 sm:text-2xl">
              <ShoppingBag className="h-5 w-5 text-yellow-500" aria-hidden="true" />
              {formatNomeVendedor(vendedorModal)}
            </h2>
            <p className="mt-1 text-xs text-neutral-500">
              {pedidosVendedorLoading
                ? 'Carregando pedidos do período...'
                : `${formatInteiro(pedidosVendedor.length)} pedidos no período selecionado`}
              {pedidosVendedorAtualizadoEm && ` • Atualizado em ${new Date(pedidosVendedorAtualizadoEm).toLocaleString('pt-BR')}`}
            </p>
          </div>
          <button
            type="button"
            onClick={fecharPedidosVendedor}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-neutral-200 text-neutral-500 transition-colors hover:border-yellow-400 hover:text-neutral-950 focus:outline-none focus-visible:ring-2 focus-visible:ring-yellow-400"
            aria-label="Fechar"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </header>

        <div className="min-h-0 flex-1 overflow-auto p-4 sm:p-6">
          {pedidosVendedorLoading ? (
            <div className="flex min-h-52 items-center justify-center gap-2 text-xs text-neutral-500">
              <RefreshCw className="h-5 w-5 animate-spin text-yellow-600" aria-hidden="true" />
              Consultando pedidos no cache do Nomus...
            </div>
          ) : pedidosVendedorErro ? (
            <div className="flex min-h-52 flex-col items-center justify-center gap-2 text-center">
              <AlertTriangle className="h-5 w-5 text-red-600" aria-hidden="true" />
              <span className="text-xs font-semibold text-red-600">{pedidosVendedorErro}</span>
            </div>
          ) : pedidosVendedor.length === 0 ? (
            <div className="flex min-h-52 items-center justify-center text-xs text-neutral-500">
              Nenhum pedido encontrado para este vendedor no período.
            </div>
          ) : (
            <div className="overflow-hidden rounded-2xl border border-neutral-200">
              <table className="w-full min-w-[850px] border-collapse text-xs">
                <thead className="sticky top-0 bg-neutral-50 text-[10px] font-bold uppercase tracking-wider text-neutral-500">
                  <tr>
                    <th className="px-4 py-3 text-left">Pedido</th>
                    <th className="px-4 py-3 text-left">Emissão</th>
                    <th className="px-4 py-3 text-left">Itens</th>
                    <th className="px-4 py-3 text-left">Parafusos</th>
                    <th className="px-4 py-3 text-left">Recebido</th>
                    <th className="px-4 py-3 text-left">Falta receber</th>
                    <th className="px-4 py-3 text-left">Fretes e outros</th>
                    <th className="px-4 py-3 text-left">Valor total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-100">
                  {pedidosVendedor.map((pedido) => (
                    <tr key={pedido.id} className="transition-colors hover:bg-yellow-50/60">
                      <td className="px-4 py-3 font-black text-neutral-900">{pedido.codigo}</td>
                      <td className="px-4 py-3 whitespace-nowrap text-neutral-600">{pedido.dataEmissao}</td>
                      <td className="px-4 py-3 font-bold tabular-nums text-violet-600">{formatInteiro(pedido.quantidadeItens)}</td>
                      <td className="px-4 py-3 font-bold tabular-nums text-orange-600">
                        {pedido.quantidadeParafusos > 0 ? formatInteiro(pedido.quantidadeParafusos) : '—'}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap font-bold tabular-nums text-teal-700">{formatCurrencyComCentavos(pedido.valorRecebido)}</td>
                      <td className="px-4 py-3 whitespace-nowrap font-bold tabular-nums text-orange-700">{formatCurrencyComCentavos(pedido.valorPendente)}</td>
                      <td className="px-4 py-3 whitespace-nowrap font-bold tabular-nums text-cyan-700">{formatCurrencyComCentavos(pedido.valorFrete)}</td>
                      <td className="px-4 py-3 whitespace-nowrap font-black tabular-nums text-emerald-600">{formatCurrencyComCentavos(pedido.valorTotal)}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot className="border-t-2 border-neutral-200 bg-neutral-50">
                  <tr>
                    <td colSpan={7} className="px-4 py-3 text-right text-[10px] font-black uppercase tracking-wider text-neutral-500">Total vendido</td>
                    <td className="px-4 py-3 whitespace-nowrap font-black tabular-nums text-emerald-700">
                      {formatCurrencyComCentavos(pedidosVendedor.reduce((total, pedido) => total + pedido.valorTotal, 0))}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  ) : null;

  const atualizarAgora = async () => {
    setAtualizandoForcado(true);
    setResumoErro(null);
    setErro(null);
    try {
      if (view === 'ranking') {
        const resposta = await fetch(`/api/vendas/ranking/atualizar?periodo=${periodo}${mesQuery}`, { method: 'POST' });
        const dados = await resposta.json();
        if (!resposta.ok) throw new Error(dados?.error || 'Falha ao atualizar o ranking no Nomus');
        setRanking(dados.ranking);
        setAtualizadoEm(dados.atualizadoEm);
        salvarRankingLocal(periodo, mes, dados);
        return;
      }

      const resposta = await fetch(`/api/vendas/atualizar?periodo=${periodo}${mesQuery}`, { method: 'POST' });
      const dados = await resposta.json();
      if (!resposta.ok) throw new Error(dados?.error || 'Falha ao atualizar os dados do Nomus');

      setRanking(dados.ranking);
      setAtualizadoEm(dados.atualizadoEm);
      salvarRankingLocal(periodo, mes, dados);
      setResumo(dados.resumo);

      if (view === 'loja' && lojaSelecionada) {
        const lojaResposta = await fetch(`/api/vendas/lojas/${lojaSelecionada}/resumo?periodo=${periodo}${mesQuery}`);
        const lojaDados = await lojaResposta.json();
        if (!lojaResposta.ok) throw new Error(lojaDados?.error || 'Falha ao atualizar os dados da loja');
        setResumoLoja(lojaDados);
      }
    } catch (err: any) {
      const mensagem = err.message || 'Falha ao atualizar os dados do Nomus';
      if (view === 'ranking') setErro(mensagem);
      else if (view === 'loja') setResumoLojaErro(mensagem);
      else setResumoErro(mensagem);
    } finally {
      setAtualizandoForcado(false);
    }
  };

  const BotaoAtualizar = () => (
    <button
      type="button"
      onClick={atualizarAgora}
      disabled={atualizandoForcado}
      className="inline-flex items-center gap-2 rounded-full border border-neutral-200 bg-white px-4 py-2 text-xs font-bold text-neutral-700 transition-all hover:border-yellow-400 hover:text-yellow-700 disabled:cursor-not-allowed disabled:opacity-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-yellow-400"
    >
      <RefreshCw className={`h-4 w-4 ${atualizandoForcado ? 'animate-spin' : ''}`} aria-hidden="true" />
      {atualizandoForcado ? 'Atualizando no Nomus...' : 'Atualizar dados'}
    </button>
  );

  if (view === 'ranking') {
    return (
      <div className="space-y-5">
        <header className="border-b border-neutral-200 pb-5">
          <div className="flex flex-col gap-5">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <button
                  type="button"
                  onClick={() => setView('painel')}
                  className="mb-4 inline-flex items-center gap-1.5 text-[11px] font-semibold text-neutral-500 transition-colors hover:text-neutral-950 focus:outline-none focus-visible:ring-2 focus-visible:ring-yellow-400"
                >
                  <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />
                  Voltar ao painel
                </button>
                <span className="block text-[10px] font-black uppercase tracking-[0.2em] text-yellow-600">Dashboard de vendas</span>
                <h1 className="mt-1 flex items-center gap-2.5 text-2xl font-black tracking-tight text-neutral-950 sm:text-3xl">
                  <Trophy className="h-6 w-6 text-yellow-500" aria-hidden="true" />
                  Ranking de Vendedores
                </h1>
                <p className="mt-1.5 max-w-xl text-sm text-neutral-500">
                  Classificação geral da empresa e desempenho individual por unidade.
                </p>
              </div>

              <div className="flex shrink-0 flex-col items-start gap-3 sm:items-end">
                {atualizadoEm && !loading && (
                  <span className="inline-flex items-center gap-1.5 text-[10px] font-medium text-neutral-400">
                    <Clock3 className="h-3.5 w-3.5" aria-hidden="true" />
                    Atualizado em {new Date(atualizadoEm).toLocaleString('pt-BR')}
                  </span>
                )}
                <BotaoAtualizar />
                {rankingSelecionado === 'geral' && (
                  <button
                    type="button"
                    onClick={baixarPdf}
                    disabled={loading || !!erro || ranking.length === 0}
                    title="Baixa o ranking geral completo do período"
                    className="inline-flex items-center gap-2 rounded-xl border border-neutral-200 bg-white px-3.5 py-2 text-xs font-bold text-neutral-700 transition-colors hover:border-yellow-400 hover:text-neutral-950 disabled:cursor-not-allowed disabled:opacity-40 focus:outline-none focus-visible:ring-2 focus-visible:ring-yellow-400"
                  >
                    <FileDown className="h-4 w-4" aria-hidden="true" />
                    Exportar PDF
                  </button>
                )}
              </div>
            </div>

            <nav className="flex flex-wrap items-center gap-1.5 rounded-2xl bg-neutral-100 p-1.5" aria-label="Selecionar ranking geral ou por loja">
          <button
            type="button"
            aria-pressed={rankingSelecionado === 'geral'}
            onClick={() => setRankingSelecionado('geral')}
            className={`flex items-center gap-1.5 rounded-xl px-3.5 py-2 text-xs font-bold transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-yellow-400 ${
              rankingSelecionado === 'geral'
                ? 'bg-white text-neutral-950 shadow-sm'
                : 'text-neutral-500 hover:bg-white/60 hover:text-neutral-900'
            }`}
          >
            <Building2 className="w-3.5 h-3.5" aria-hidden="true" />
            Ranking Geral
          </button>
          {LOJAS.map((loja) => {
            const selecionada = rankingSelecionado === loja.id;
            return (
              <button
                key={loja.id}
                type="button"
                aria-pressed={selecionada}
                onClick={() => setRankingSelecionado(loja.id)}
                className={`flex items-center gap-1.5 rounded-xl px-3.5 py-2 text-xs font-bold transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-yellow-400 ${
                  selecionada
                    ? 'bg-white text-neutral-950 shadow-sm'
                    : 'text-neutral-500 hover:bg-white/60 hover:text-neutral-900'
                }`}
              >
                <Store className="w-3.5 h-3.5" aria-hidden="true" />
                {loja.nome}
              </button>
            );
          })}
            </nav>
          </div>
        </header>

        {!loading && !erro && (
          <section className="grid grid-cols-1 overflow-hidden rounded-2xl border border-neutral-200 bg-white sm:grid-cols-3" aria-label="Resumo do ranking selecionado">
            {[
              { label: 'Volume vendido', value: formatCurrency(resumoRanking.vendas), Icon: Wallet, color: 'text-emerald-600', bg: 'bg-emerald-50' },
              { label: 'Vendedores ativos', value: formatInteiro(resumoRanking.vendedoresAtivos), Icon: Users, color: 'text-amber-600', bg: 'bg-amber-50' },
              { label: 'Pedidos no período', value: formatInteiro(resumoRanking.pedidos), Icon: Package, color: 'text-violet-600', bg: 'bg-violet-50' },
            ].map(({ label, value, Icon, color, bg }) => (
              <article key={label} className="flex min-w-0 items-center gap-3 border-b border-r border-neutral-100 p-4 last:border-r-0 lg:border-b-0">
                <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${bg} ${color}`}>
                  <Icon className="h-4.5 w-4.5" aria-hidden="true" />
                </span>
                <div className="min-w-0">
                  <span className="block truncate text-[10px] font-bold uppercase tracking-wider text-neutral-400">{label}</span>
                  <strong className="mt-0.5 block truncate text-base font-black tabular-nums text-neutral-900" title={value}>{value}</strong>
                </div>
              </article>
            ))}
          </section>
        )}

        {!loading && !erro && rankingSelecionado === 'geral' && rankingDaVisao.length > 0 && (
          <RankingPodio vendedores={rankingDaVisao} />
        )}

        <section className="overflow-hidden rounded-3xl border border-neutral-200 bg-white shadow-sm">
          <div className="flex flex-col gap-2 border-b border-neutral-100 px-5 py-5 sm:flex-row sm:items-center sm:justify-between sm:px-6">
            <div>
              <span className="text-[9px] font-black uppercase tracking-[0.2em] text-yellow-600">
                {rankingSelecionado === 'geral' ? 'Visão corporativa' : 'Desempenho da unidade'}
              </span>
              <h2 className="mt-0.5 text-lg font-black tracking-tight text-neutral-950">
                {rankingSelecionado === 'geral'
                  ? 'Classificação geral'
                  : LOJAS.find((loja) => loja.id === rankingSelecionado)?.nome ?? 'Classificação da loja'}
              </h2>
            </div>
            <span className="w-fit rounded-full bg-neutral-100 px-3 py-1.5 text-[10px] font-bold text-neutral-500">
              {loading ? 'Atualizando dados...' : `${rankingFiltrado.length} vendedores exibidos`}
            </span>
          </div>

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
            <div className="p-4 sm:p-6">
              <RankingTable vendedores={rankingFiltrado} onSelecionarVendedor={abrirPedidosVendedor} />
            </div>
          )}
        </section>
        {modalPedidosVendedor}
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
          <div className="flex items-center gap-3">
            {resumoLoja && !resumoLojaLoading && (
              <span className="text-neutral-500 text-[11px] shrink-0 sm:text-right">
                Atualizado em {new Date(resumoLoja.atualizadoEm).toLocaleString('pt-BR')}
              </span>
            )}
            <BotaoAtualizar />
          </div>
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
          exibirDetalhesProdutos={false}
          exibirKpisParafusosFrete
        />

        {!resumoLojaLoading && !resumoLojaErro && (
          <section className="overflow-hidden rounded-3xl border border-neutral-200 bg-white shadow-sm">
            <div className="flex flex-col gap-1 border-b border-neutral-100 px-5 py-5 sm:flex-row sm:items-center sm:justify-between sm:px-6">
              <div>
                <span className="text-[9px] font-black uppercase tracking-[0.2em] text-yellow-600">
                  Desempenho da unidade
                </span>
                <h2 className="mt-0.5 text-lg font-black tracking-tight text-neutral-950">
                  Vendedores da {loja?.nome ?? 'loja'}
                </h2>
              </div>
              <span className="w-fit rounded-full bg-neutral-100 px-3 py-1.5 text-[10px] font-bold text-neutral-500">
                {loading ? 'Atualizando em segundo plano...' : `${vendedoresDaLojaSelecionada.length} vendedores`}
              </span>
            </div>

            {vendedoresDaLojaSelecionada.length > 0 ? (
              <div className="p-4 sm:p-6">
                <RankingTable vendedores={vendedoresDaLojaSelecionada} onSelecionarVendedor={abrirPedidosVendedor} />
              </div>
            ) : loading ? (
              <div className="flex items-center justify-center gap-2 px-5 py-10 text-xs text-neutral-500">
                <RefreshCw className="h-4 w-4 animate-spin text-yellow-600" aria-hidden="true" />
                Carregando vendedores da unidade...
              </div>
            ) : (
              <RankingEmptyState />
            )}
          </section>
        )}
        {modalPedidosVendedor}
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
          <BotaoAtualizar />
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
