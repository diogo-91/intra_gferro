import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Factory,
  RefreshCw,
  AlertTriangle,
  Activity,
  PauseCircle,
  Clock,
  CheckCircle2,
  Users,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  Calendar,
  Search,
  FileDown,
  BarChart3,
} from 'lucide-react';
import {
  KanbanProducao,
  RelatorioProducao,
  CardProducao,
  StatusCardProducao,
  ApontamentoDetalhado,
  CentroProducao,
} from '../types';
import { formatNomeVendedor } from '../utils/format';
import {
  ModoPeriodoProducao,
  intervaloDoPeriodo,
  navegarPeriodo,
  formatarDuracao,
  quantidadePrincipal,
  calcularTendencia,
  Tendencia,
  ultimosDias,
  serieDiariaPorCentro,
  paginar,
  corDoCentro,
  somarValorProduzido,
  formatarNumeroBr,
  formatarMoedaNumero,
  formatarUnidade,
  pluralizar,
  gerarCsvRelatorioProducao,
} from '../utils/producaoCampos';

const STATUS_STYLE: Record<StatusCardProducao, { label: string; badge: string; dot: string }> = {
  EM_PRODUCAO: { label: 'Em produção', badge: 'bg-emerald-50 text-emerald-700 border-emerald-200', dot: 'bg-emerald-500' },
  PARADO: { label: 'Parado', badge: 'bg-red-50 text-red-700 border-red-200', dot: 'bg-red-500' },
  AGUARDANDO: { label: 'Aguardando', badge: 'bg-neutral-100 text-neutral-600 border-neutral-200', dot: 'bg-neutral-400' },
  CONCLUIDO: { label: 'Concluído', badge: 'bg-sky-50 text-sky-700 border-sky-200', dot: 'bg-sky-500' },
};

const MODOS_PERIODO: { valor: ModoPeriodoProducao; texto: string }[] = [
  { valor: 'dia', texto: 'Dia' },
  { valor: 'semana', texto: 'Semana' },
  { valor: 'mes', texto: 'Mês' },
];

const TAMANHO_PAGINA = 10;
const DIAS_SPARKLINE = 7;

function chaveDoDia(d: Date): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

function formatHoraInicio(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
}

const CardOrdem: React.FC<{ card: CardProducao }> = ({ card }) => {
  const estilo = STATUS_STYLE[card.status];
  const inicio = formatHoraInicio(card.dataHoraInicial);
  return (
    <div className="p-3 rounded-2xl bg-neutral-50 border border-neutral-100 space-y-1.5">
      <div className="flex items-center justify-between gap-2">
        <span className="font-bold text-neutral-900 text-[11px] truncate" title={card.nomeOrdem}>{card.nomeOrdem}</span>
        <span className={`shrink-0 flex items-center gap-1 px-1.5 py-0.5 rounded-full border text-[9px] font-bold ${estilo.badge}`}>
          <span className={`w-1.5 h-1.5 rounded-full ${estilo.dot}`} aria-hidden="true" />
          {estilo.label}
        </span>
      </div>
      {card.produto && (
        <span className="text-[10px] text-neutral-500 truncate block" title={card.produto}>{card.produto}</span>
      )}
      <div className="flex items-center justify-between gap-2 text-[10px] text-neutral-500">
        <span>{card.etapasConcluidas}/{card.totalEtapas} etapas</span>
        {card.quantidade && <span className="font-mono">{card.quantidade} {card.unidadeMedida ? formatarUnidade(card.unidadeMedida) : ''}</span>}
      </div>
      {card.status === 'EM_PRODUCAO' && card.operadorAtual && (
        <span className="text-[10px] text-emerald-700 font-semibold truncate block" title={card.operadorAtual}>
          {formatNomeVendedor(card.operadorAtual)}{inicio ? ` · desde ${inicio}` : ''}
        </span>
      )}
      {card.status === 'PARADO' && (
        <span className="text-[10px] text-red-600 font-semibold truncate block" title={card.motivoParada || undefined}>
          {card.motivoParada || 'Parado'}{card.operadorAtual ? ` · ${formatNomeVendedor(card.operadorAtual)}` : ''}
        </span>
      )}
    </div>
  );
};

// ---- Sparkline (últimos 7 dias) — mesmo desenho do painel original ----
const Sparkline: React.FC<{ valores: number[]; cor: string }> = ({ valores, cor }) => {
  const largura = 88;
  const altura = 30;
  const max = Math.max(...valores, 0);
  const min = Math.min(...valores, 0);
  const amplitude = max - min || 1;
  const pontos = valores
    .map((v, i) => {
      const x = valores.length > 1 ? (i / (valores.length - 1)) * largura : largura / 2;
      const y = altura - 3 - ((v - min) / amplitude) * (altura - 6);
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(' ');
  const ultimoY = altura - 3 - ((valores[valores.length - 1] - min) / amplitude) * (altura - 6);
  return (
    <svg viewBox={`0 0 ${largura} ${altura}`} className="w-[88px] h-[30px] shrink-0" preserveAspectRatio="none" aria-hidden="true">
      <polyline points={pontos} fill="none" stroke={cor} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      {valores.length > 0 && <circle cx={largura} cy={ultimoY.toFixed(1)} r="2.5" fill={cor} />}
    </svg>
  );
};

const BadgeTendencia: React.FC<{ tendencia: Tendencia }> = ({ tendencia }) => {
  if (tendencia.direcao === 'estavel') {
    return <span className="px-2 py-0.5 rounded-full border bg-neutral-100 text-neutral-600 border-neutral-200 text-[10px] font-bold">Estável</span>;
  }
  if (tendencia.direcao === 'novo') {
    return <span className="px-2 py-0.5 rounded-full border bg-sky-50 text-sky-700 border-sky-200 text-[10px] font-bold">Novo</span>;
  }
  const alta = tendencia.direcao === 'alta';
  return (
    <span className={`px-2 py-0.5 rounded-full border text-[10px] font-bold ${alta ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-red-50 text-red-700 border-red-200'}`}>
      {alta ? '+' : ''}
      {formatarNumeroBr(tendencia.percentual ?? 0)}%
    </span>
  );
};

interface ItemGrafico {
  centro: string;
  cor: string;
  principal: { unidade: string; total: number };
}

// Barras simples em CSS/flex — sem lib de gráfico, mesmo padrão do painel original.
const GraficoBarras: React.FC<{ itens: ItemGrafico[]; unidade: string }> = ({ itens, unidade }) => {
  const max = Math.max(...itens.map((i) => i.principal.total), 1);
  return (
    <div className="flex items-end gap-4 h-40 pt-2">
      {itens.map((item) => (
        <div key={item.centro} className="flex-1 min-w-0 flex flex-col items-center gap-1.5 h-full">
          <span className="text-[10px] font-bold text-neutral-700 truncate w-full text-center">
            {formatarNumeroBr(item.principal.total)} {formatarUnidade(unidade)}
          </span>
          <div className="flex-1 w-full flex items-end rounded-md bg-neutral-100 overflow-hidden">
            <div
              className="w-full rounded-t-md transition-all"
              style={{ height: `${Math.max(4, (item.principal.total / max) * 100)}%`, backgroundColor: item.cor }}
            />
          </div>
          <span className="text-[9px] font-semibold text-neutral-500 truncate w-full text-center">{item.centro}</span>
        </div>
      ))}
    </div>
  );
};

// Rosca via SVG (stroke-dasharray acumulado) — mesma lógica do painel original.
const GraficoDonut: React.FC<{ itens: ItemGrafico[]; unidade: string }> = ({ itens, unidade }) => {
  const total = itens.reduce((soma, i) => soma + i.principal.total, 0);
  const raio = 58;
  const circunferencia = 2 * Math.PI * raio;
  let acumulado = 0;

  return (
    <div className="flex flex-col sm:flex-row items-center gap-6">
      <svg viewBox="0 0 160 160" className="w-40 h-40 shrink-0" role="img" aria-label={`Distribuição por centro: ${formatarNumeroBr(total)} ${formatarUnidade(unidade)} no total`}>
        <g transform="translate(80,80) rotate(-90)">
          <circle r={raio} fill="none" stroke="#e5e5e5" strokeWidth="20" />
          {itens.map((item) => {
            const fracao = total > 0 ? item.principal.total / total : 0;
            const dash = Math.max(0, fracao * circunferencia - (itens.length > 1 ? 2 : 0));
            const offset = -acumulado * circunferencia;
            acumulado += fracao;
            return (
              <circle
                key={item.centro}
                r={raio}
                fill="none"
                stroke={item.cor}
                strokeWidth="20"
                strokeDasharray={`${dash} ${circunferencia - dash}`}
                strokeDashoffset={offset}
                strokeLinecap="round"
              />
            );
          })}
        </g>
        <text x="80" y="76" textAnchor="middle" className="fill-neutral-900 font-black" style={{ fontSize: '20px' }}>
          {formatarNumeroBr(total)}
        </text>
        <text x="80" y="94" textAnchor="middle" className="fill-neutral-400 font-semibold" style={{ fontSize: '10px' }}>
          {formatarUnidade(unidade)} totais
        </text>
      </svg>
      <ul className="space-y-1.5 flex-1 min-w-0 w-full">
        {itens.map((item) => (
          <li key={item.centro} className="flex items-center gap-2 text-xs">
            <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: item.cor }} aria-hidden="true" />
            <span className="text-neutral-700 font-semibold truncate flex-1">{item.centro}</span>
            <span className="text-neutral-500 font-bold tabular-nums shrink-0">
              {total > 0 ? formatarNumeroBr((item.principal.total / total) * 100) : '0'}%
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
};

export const Producao: React.FC = () => {
  // ---- Kanban (estado ao vivo) ----
  const [kanban, setKanban] = useState<KanbanProducao | null>(null);
  const [kanbanErro, setKanbanErro] = useState<string | null>(null);
  const [kanbanCarregando, setKanbanCarregando] = useState(true);

  useEffect(() => {
    let cancelado = false;
    const buscar = (silencioso: boolean) => {
      if (!silencioso) {
        setKanbanCarregando(true);
        setKanbanErro(null);
      }
      fetch('/api/producao/kanban')
        .then(async (res) => {
          const data = await res.json();
          if (!res.ok) throw new Error(data?.error || 'Falha ao buscar dados do Apontamento de Produção');
          return data as KanbanProducao;
        })
        .then((data) => {
          if (!cancelado) setKanban(data);
        })
        .catch((err) => {
          if (!cancelado && !silencioso) setKanbanErro(err.message || 'Falha ao buscar dados do Apontamento de Produção');
        })
        .finally(() => {
          if (!cancelado) setKanbanCarregando(false);
        });
    };
    buscar(false);
    const intervalo = setInterval(() => buscar(true), 30_000);
    return () => {
      cancelado = true;
      clearInterval(intervalo);
    };
  }, []);

  const todosCards = useMemo(() => kanban?.colunas.flatMap((c) => c.cards) ?? [], [kanban]);
  const totalEmProducao = todosCards.filter((c) => c.status === 'EM_PRODUCAO').length;
  const totalParados = todosCards.filter((c) => c.status === 'PARADO').length;
  const totalAguardando = todosCards.filter((c) => c.status === 'AGUARDANDO').length;

  // ---- Relatório de Produção — período, tendência e sparkline (ver src/utils/producaoCampos.ts) ----
  const [modo, setModo] = useState<ModoPeriodoProducao>('dia');
  const [referencia, setReferencia] = useState(() => new Date());
  const [dados, setDados] = useState<RelatorioProducao | null>(null);
  const [dadosAnterior, setDadosAnterior] = useState<RelatorioProducao | null>(null);
  const [dadosSpark, setDadosSpark] = useState<RelatorioProducao | null>(null);
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const [busca, setBusca] = useState('');
  const [filtroCentro, setFiltroCentro] = useState('');
  const [filtroEtapa, setFiltroEtapa] = useState('');
  const [filtroColaborador, setFiltroColaborador] = useState('');
  const [pagina, setPagina] = useState(1);
  const [filtrosAbertos, setFiltrosAbertos] = useState(false);
  const [exportAberto, setExportAberto] = useState(false);
  const dataOcultaRef = useRef<HTMLInputElement>(null);

  const periodo = useMemo(() => intervaloDoPeriodo(modo, referencia), [modo, referencia]);
  const diasSparkChaves = useMemo(() => ultimosDias(periodo.fim, DIAS_SPARKLINE), [periodo.fim]);

  async function buscarRelatorio(inicio: string, fim: string): Promise<RelatorioProducao> {
    const res = await fetch(`/api/producao/relatorio?inicio=${inicio}&fim=${fim}`);
    const data = await res.json();
    if (!res.ok) throw new Error(data?.error || 'Falha ao buscar dados do Apontamento de Produção');
    return data as RelatorioProducao;
  }

  async function carregarTudo() {
    setCarregando(true);
    try {
      const periodoAnterior = intervaloDoPeriodo(modo, navegarPeriodo(modo, referencia, -1));
      const diasSpark = ultimosDias(periodo.fim, DIAS_SPARKLINE);
      const [atual, anterior, spark] = await Promise.all([
        buscarRelatorio(periodo.inicio, periodo.fim),
        buscarRelatorio(periodoAnterior.inicio, periodoAnterior.fim),
        buscarRelatorio(diasSpark[0], periodo.fim),
      ]);
      setDados(atual);
      setDadosAnterior(anterior);
      setDadosSpark(spark);
      setErro(null);
    } catch (e: any) {
      setErro(e.message || 'Falha ao buscar dados do Apontamento de Produção');
    } finally {
      setCarregando(false);
    }
  }

  useEffect(() => {
    carregarTudo();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [periodo.inicio, periodo.fim]);

  useEffect(() => {
    setFiltroCentro('');
    setFiltroEtapa('');
    setFiltroColaborador('');
  }, [periodo.inicio, periodo.fim]);

  useEffect(() => {
    setPagina(1);
  }, [periodo.inicio, periodo.fim, busca, filtroCentro, filtroEtapa, filtroColaborador]);

  function abrirSeletorDeData() {
    const el = dataOcultaRef.current;
    if (!el) return;
    if (typeof (el as any).showPicker === 'function') (el as any).showPicker();
    else el.focus();
  }

  const cartoes = useMemo(() => {
    if (!dados) return [];
    const anteriorPorCentro = new Map<string, CentroProducao>((dadosAnterior?.porCentro ?? []).map((c) => [c.centro, c]));
    return dados.porCentro.map((c, i) => {
      const principal = quantidadePrincipal(c.quantidades);
      const anteriorCentro = anteriorPorCentro.get(c.centro);
      const anteriorPrincipal = anteriorCentro ? quantidadePrincipal(anteriorCentro.quantidades) : null;
      const tendencia = calcularTendencia(principal?.total ?? 0, anteriorPrincipal?.total ?? 0);
      const serie = dadosSpark ? serieDiariaPorCentro(dadosSpark.detalhado, c.centro, diasSparkChaves) : diasSparkChaves.map(() => 0);
      return { ...c, cor: corDoCentro(i), principal, tendencia, serie };
    });
  }, [dados, dadosAnterior, dadosSpark, diasSparkChaves]);

  const valorTotalPeriodo = useMemo(() => somarValorProduzido(dados?.porCentro), [dados]);

  const dadosGrafico = useMemo(() => {
    const comPrincipal = cartoes.filter((c) => c.principal);
    if (comPrincipal.length === 0) return { itens: [] as ItemGrafico[], unidade: '', excluidos: 0 };
    const contagem = new Map<string, number>();
    for (const c of comPrincipal) contagem.set(c.principal!.unidade, (contagem.get(c.principal!.unidade) ?? 0) + 1);
    const unidadeDominante = [...contagem.entries()].sort((a, b) => b[1] - a[1])[0][0];
    const itens = comPrincipal
      .filter((c) => c.principal!.unidade === unidadeDominante)
      .map((c) => ({ centro: c.centro, cor: c.cor, principal: c.principal! }));
    return { itens, unidade: unidadeDominante, excluidos: comPrincipal.length - itens.length };
  }, [cartoes]);

  const etapasDisponiveis = useMemo(() => {
    const valores: string[] = [];
    for (const d of dados?.detalhado ?? []) if (d.descricaoEtapa) valores.push(d.descricaoEtapa);
    return [...new Set<string>(valores)].sort((a: string, b: string) => a.localeCompare(b, 'pt-BR'));
  }, [dados]);
  const colaboradoresDisponiveis = useMemo(() => {
    const valores: string[] = [];
    for (const d of dados?.detalhado ?? []) if (d.funcionario) valores.push(d.funcionario);
    return [...new Set<string>(valores)].sort((a: string, b: string) => a.localeCompare(b, 'pt-BR'));
  }, [dados]);

  const detalhesFiltrados = useMemo(() => {
    if (!dados) return [] as ApontamentoDetalhado[];
    const alvo = busca.trim().toLowerCase();
    return dados.detalhado.filter((d) => {
      if (filtroCentro && d.centro !== filtroCentro) return false;
      if (filtroEtapa && d.descricaoEtapa !== filtroEtapa) return false;
      if (filtroColaborador && d.funcionario !== filtroColaborador) return false;
      if (!alvo) return true;
      return (
        (d.nomeOrdem ?? '').toLowerCase().includes(alvo) ||
        (d.funcionario ?? '').toLowerCase().includes(alvo) ||
        (d.descricaoEtapa ?? '').toLowerCase().includes(alvo)
      );
    });
  }, [dados, busca, filtroCentro, filtroEtapa, filtroColaborador]);

  const { itens: paginaAtual, totalPaginas } = useMemo(
    () => paginar(detalhesFiltrados, pagina, TAMANHO_PAGINA),
    [detalhesFiltrados, pagina]
  );

  function baixarPdf() {
    const params = new URLSearchParams({ inicio: periodo.inicio, fim: periodo.fim, rotulo: periodo.rotulo });
    const a = document.createElement('a');
    a.href = `/api/producao/relatorio/pdf?${params.toString()}`;
    a.click();
  }

  function exportarCsv() {
    const csv = gerarCsvRelatorioProducao(detalhesFiltrados);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `producao-${periodo.inicio}-a-${periodo.fim}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  const carregandoPrimeiraVez = carregando && !dados;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
        <div>
          <span className="text-xs font-bold uppercase tracking-widest text-yellow-600">Dashboard • Produção</span>
          <h1 className="text-2xl font-black text-neutral-900 mt-1 flex items-center gap-2">
            <Factory className="w-6 h-6 text-yellow-600" aria-hidden="true" />
            Painel de Produção
          </h1>
          <p className="text-neutral-500 text-sm mt-1">
            Ordens em execução, produtividade por centro e apontamento por operador — direto do Apontamento de Produção.
          </p>
        </div>
        {kanban && !kanbanCarregando && (
          <span className="text-neutral-500 text-[11px] shrink-0">
            Atualizado às {new Date(kanban.atualizadoEm).toLocaleTimeString('pt-BR')}
          </span>
        )}
      </div>

      {kanbanErro && !kanban && (
        <div className="p-10 rounded-3xl bg-white border border-neutral-200 flex flex-col items-center justify-center gap-2 text-center">
          <AlertTriangle className="w-5 h-5 text-red-600" aria-hidden="true" />
          <span className="text-red-600 text-xs font-semibold">Não foi possível carregar o painel de produção</span>
          <span className="text-neutral-500 text-[11px] max-w-sm">{kanbanErro}</span>
        </div>
      )}

      {kanbanCarregando && !kanban && (
        <div className="p-10 rounded-3xl bg-white border border-neutral-200 flex flex-col items-center justify-center gap-2 text-neutral-500 text-xs text-center">
          <RefreshCw className="w-5 h-5 animate-spin text-yellow-600" aria-hidden="true" />
          <span>Consultando o Apontamento de Produção...</span>
        </div>
      )}

      {kanban && (
        <>
          {/* KPIs ao vivo */}
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
            <div className="rounded-2xl bg-white border border-neutral-200 p-4 flex items-center gap-2.5">
              <span className="w-9 h-9 shrink-0 rounded-full bg-emerald-50 flex items-center justify-center">
                <Activity className="w-4 h-4 text-emerald-600" aria-hidden="true" />
              </span>
              <div className="flex-1 min-w-0">
                <span className="text-xs text-neutral-500 block">Em produção agora</span>
                <span className="text-base font-black text-emerald-600 tabular-nums block">{totalEmProducao}</span>
              </div>
            </div>
            <div className="rounded-2xl bg-white border border-neutral-200 p-4 flex items-center gap-2.5">
              <span className="w-9 h-9 shrink-0 rounded-full bg-red-50 flex items-center justify-center">
                <PauseCircle className="w-4 h-4 text-red-600" aria-hidden="true" />
              </span>
              <div className="flex-1 min-w-0">
                <span className="text-xs text-neutral-500 block">Parados</span>
                <span className="text-base font-black text-red-600 tabular-nums block">{totalParados}</span>
              </div>
            </div>
            <div className="rounded-2xl bg-white border border-neutral-200 p-4 flex items-center gap-2.5">
              <span className="w-9 h-9 shrink-0 rounded-full bg-neutral-100 flex items-center justify-center">
                <Clock className="w-4 h-4 text-neutral-500" aria-hidden="true" />
              </span>
              <div className="flex-1 min-w-0">
                <span className="text-xs text-neutral-500 block">Aguardando</span>
                <span className="text-base font-black text-neutral-700 tabular-nums block">{totalAguardando}</span>
              </div>
            </div>
            <div className="rounded-2xl bg-white border border-neutral-200 p-4 flex items-center gap-2.5">
              <span className="w-9 h-9 shrink-0 rounded-full bg-sky-50 flex items-center justify-center">
                <CheckCircle2 className="w-4 h-4 text-sky-600" aria-hidden="true" />
              </span>
              <div className="flex-1 min-w-0">
                <span className="text-xs text-neutral-500 block">Concluídas hoje</span>
                <span className="text-base font-black text-sky-600 tabular-nums block">{kanban.concluidos?.length ?? 0}</span>
              </div>
            </div>
          </div>

          {/* Ordens em Execução — Kanban por centro */}
          <div className="space-y-2">
            <h3 className="text-xs font-black uppercase tracking-wider text-neutral-500">Ordens em Execução</h3>
            {kanban.colunas.length === 0 ? (
              <div className="rounded-2xl bg-white border border-neutral-200 p-6 text-center">
                <span className="text-xs text-neutral-400">Nenhuma ordem em andamento agora.</span>
              </div>
            ) : (
              <div className="flex gap-3 overflow-x-auto pb-2">
                {kanban.colunas.map((coluna) => (
                  <div key={coluna.nome} className="w-64 shrink-0 rounded-[1.5rem] bg-neutral-50 border border-neutral-200 p-3 space-y-2 max-h-[520px] flex flex-col">
                    <div className="flex items-center justify-between gap-2 px-1">
                      <span className="text-[11px] font-black uppercase tracking-wider text-neutral-700 truncate">{coluna.nome}</span>
                      <span className="shrink-0 w-5 h-5 flex items-center justify-center rounded-full bg-neutral-200 text-neutral-600 text-[10px] font-black">
                        {coluna.cards.length}
                      </span>
                    </div>
                    <div className="space-y-2 overflow-y-auto flex-1 min-h-0 pr-0.5">
                      {coluna.cards.length === 0 ? (
                        <span className="text-[10px] text-neutral-400 block text-center py-4">Vazio</span>
                      ) : (
                        coluna.cards.map((card) => <CardOrdem key={card.idOperacaoOrdem ?? card.idOrdem} card={card} />)
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}

      {/* Relatório de Produção — histórico por período (mesmo painel de "GFERO - APONTAMENTO PRODUCAO") */}
      <div className="space-y-4 pt-2 border-t border-neutral-100">
        <div className="pt-3">
          <h2 className="text-lg font-black text-neutral-900">Relatório de Produção</h2>
          <p className="text-neutral-500 text-xs mt-0.5">Visão consolidada de produtividade, volumes e apontamentos operacionais.</p>
        </div>

        {/* Controles: modo, navegação de data, atualizar, exportar */}
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
          <div role="group" aria-label="Período" className="flex items-center gap-1.5 bg-neutral-50 p-1 rounded-full border border-neutral-200 w-fit">
            {MODOS_PERIODO.map((m) => (
              <button
                key={m.valor}
                type="button"
                aria-pressed={modo === m.valor}
                onClick={() => setModo(m.valor)}
                className={`px-3.5 py-1.5 rounded-full text-xs transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-yellow-400 ${
                  modo === m.valor ? 'bg-yellow-400 text-black font-bold' : 'text-neutral-500 font-medium hover:text-neutral-900'
                }`}
              >
                {m.texto}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <div className="flex items-center gap-1.5 bg-neutral-50 p-1 rounded-full border border-neutral-200">
              <button type="button" onClick={() => setReferencia((r) => navegarPeriodo(modo, r, -1))} aria-label="Período anterior" className="w-7 h-7 flex items-center justify-center rounded-full text-neutral-500 hover:text-yellow-600 hover:bg-neutral-100 transition-all">
                <ChevronLeft className="w-4 h-4" />
              </button>
              <span className="px-2 text-xs font-black text-neutral-900 min-w-[140px] text-center truncate">{periodo.rotulo}</span>
              <button type="button" onClick={() => setReferencia((r) => navegarPeriodo(modo, r, 1))} aria-label="Próximo período" className="w-7 h-7 flex items-center justify-center rounded-full text-neutral-500 hover:text-yellow-600 hover:bg-neutral-100 transition-all">
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
            <button type="button" onClick={() => setReferencia(new Date())} className="px-3.5 py-2 rounded-full border border-neutral-200 bg-white text-xs font-bold text-neutral-600 hover:border-yellow-400 hover:text-yellow-600 transition-all">
              Hoje
            </button>
            <button type="button" onClick={abrirSeletorDeData} aria-label="Escolher uma data" className="w-8 h-8 shrink-0 flex items-center justify-center rounded-full border border-neutral-200 bg-white text-neutral-500 hover:border-yellow-400 hover:text-yellow-600 transition-all">
              <Calendar className="w-3.5 h-3.5" />
            </button>
            <input
              ref={dataOcultaRef}
              type="date"
              className="sr-only"
              tabIndex={-1}
              value={chaveDoDia(referencia)}
              onChange={(e) => e.target.value && setReferencia(new Date(`${e.target.value}T00:00:00`))}
            />
            <button type="button" onClick={carregarTudo} disabled={carregando} className="flex items-center gap-1.5 px-3.5 py-2 rounded-full border border-neutral-200 bg-white text-xs font-bold text-neutral-600 hover:border-yellow-400 hover:text-yellow-600 disabled:opacity-40 transition-all">
              <RefreshCw className={`w-3.5 h-3.5 ${carregando ? 'animate-spin' : ''}`} aria-hidden="true" />
              Atualizar
            </button>
            <div className="relative">
              <button
                type="button"
                onClick={() => setExportAberto((a) => !a)}
                disabled={!dados}
                className="flex items-center gap-1.5 px-4 py-2 rounded-full bg-yellow-400 text-black font-extrabold text-xs hover:bg-yellow-300 disabled:opacity-40 transition-all"
              >
                <FileDown className="w-3.5 h-3.5" aria-hidden="true" />
                Exportar
                <ChevronDown className="w-3 h-3" aria-hidden="true" />
              </button>
              {exportAberto && (
                <div className="absolute right-0 top-full mt-1.5 w-44 rounded-2xl bg-white border border-neutral-200 shadow-lg z-20 overflow-hidden">
                  <button
                    type="button"
                    disabled={detalhesFiltrados.length === 0}
                    onClick={() => {
                      setExportAberto(false);
                      exportarCsv();
                    }}
                    className="w-full text-left px-4 py-2.5 text-xs font-semibold text-neutral-700 hover:bg-neutral-50 disabled:opacity-40"
                  >
                    Exportar CSV
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setExportAberto(false);
                      baixarPdf();
                    }}
                    className="w-full text-left px-4 py-2.5 text-xs font-semibold text-neutral-700 hover:bg-neutral-50 border-t border-neutral-100"
                  >
                    Baixar PDF
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

        {erro && !dados && (
          <div className="p-10 rounded-3xl bg-white border border-neutral-200 flex flex-col items-center justify-center gap-2 text-center">
            <AlertTriangle className="w-5 h-5 text-red-600" aria-hidden="true" />
            <span className="text-red-600 text-xs font-semibold">Não foi possível carregar o relatório de produção</span>
            <span className="text-neutral-500 text-[11px] max-w-sm">{erro}</span>
          </div>
        )}

        {carregandoPrimeiraVez && !erro && (
          <div className="p-10 rounded-3xl bg-white border border-neutral-200 flex flex-col items-center justify-center gap-2 text-neutral-500 text-xs text-center">
            <RefreshCw className="w-5 h-5 animate-spin text-yellow-600" aria-hidden="true" />
            <span>Consultando o histórico de apontamentos...</span>
          </div>
        )}

        {dados && (
          <div className={carregando ? 'opacity-50 pointer-events-none transition-opacity space-y-5' : 'transition-opacity space-y-5'}>
            {cartoes.length === 0 ? (
              <div className="rounded-2xl bg-white border border-neutral-200 p-6 text-center">
                <span className="text-xs text-neutral-400">Nenhum apontamento registrado neste período.</span>
              </div>
            ) : (
              <>
                {valorTotalPeriodo != null && (
                  <div
                    className="p-4 rounded-2xl bg-yellow-50 border border-yellow-200 flex flex-wrap items-center gap-2"
                    title="Soma do valor estimado (rateado do pedido pela quantidade produzida) de todos os centros no período — não é um valor exato do Nomus."
                  >
                    <span className="text-xs font-bold text-neutral-600">Valor total do período</span>
                    <span className="text-xl font-black text-neutral-900">{formatarMoedaNumero(valorTotalPeriodo)}</span>
                    <span className="px-2 py-0.5 rounded-full bg-white/70 text-[10px] font-bold text-neutral-500 uppercase tracking-wide">Estimado</span>
                  </div>
                )}

                {/* Cards por centro — quantidade principal, sparkline, tendência, valor estimado */}
                <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
                  {cartoes.map((c) => (
                    <div key={c.centro} className="rounded-2xl bg-white border border-neutral-200 p-4 space-y-2">
                      <div className="flex items-center gap-2">
                        <span className="w-8 h-8 shrink-0 rounded-full flex items-center justify-center" style={{ backgroundColor: `${c.cor}1a` }}>
                          <BarChart3 className="w-4 h-4" style={{ color: c.cor }} aria-hidden="true" />
                        </span>
                        <span className="text-xs font-bold text-neutral-700 truncate">{c.centro}</span>
                      </div>
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xl font-black text-neutral-900 truncate">
                          {c.principal ? `${formatarNumeroBr(c.principal.total)} ${formatarUnidade(c.principal.unidade)}` : '—'}
                        </span>
                        <Sparkline valores={c.serie} cor={c.cor} />
                      </div>
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-[10px] text-neutral-400">
                          {c.ordens} {pluralizar(c.ordens, 'ordem', 'ordens')} · {formatarDuracao(c.tempoMs)}
                        </span>
                        <BadgeTendencia tendencia={c.tendencia} />
                      </div>
                      {c.valorProduzido != null && (
                        <div
                          className="pt-2 border-t border-neutral-100 flex items-center justify-between"
                          title="Valor do pedido rateado pela quantidade produzida em cada etapa da OS — estimativa, o Nomus não informa valor por centro de trabalho."
                        >
                          <span className="text-sm font-bold text-emerald-600">{formatarMoedaNumero(c.valorProduzido)}</span>
                          <span className="text-[9px] font-bold text-neutral-400 uppercase tracking-wide">estimado</span>
                        </div>
                      )}
                    </div>
                  ))}
                </div>

                {/* Gráficos: barras + rosca */}
                {dadosGrafico.itens.length > 0 && (
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                    <div className="rounded-2xl bg-white border border-neutral-200 p-4">
                      <h3 className="text-sm font-black text-neutral-900">Produção por centro</h3>
                      <p className="text-[11px] text-neutral-500 mt-0.5">Comparativo do volume produzido no período</p>
                      <GraficoBarras itens={dadosGrafico.itens} unidade={dadosGrafico.unidade} />
                    </div>
                    <div className="rounded-2xl bg-white border border-neutral-200 p-4">
                      <h3 className="text-sm font-black text-neutral-900">Distribuição do período</h3>
                      <p className="text-[11px] text-neutral-500 mt-0.5 mb-2">Participação por centro de trabalho</p>
                      <GraficoDonut itens={dadosGrafico.itens} unidade={dadosGrafico.unidade} />
                    </div>
                  </div>
                )}
              </>
            )}

            {/* Tabela de apontamentos — busca, filtros, paginação */}
            <div className="space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <div>
                  <h3 className="text-sm font-black text-neutral-900">Apontamentos do período</h3>
                  <p className="text-[11px] text-neutral-500 mt-0.5">
                    {detalhesFiltrados.length === 0
                      ? 'Nenhum registro encontrado'
                      : `${detalhesFiltrados.length} ${pluralizar(detalhesFiltrados.length, 'registro encontrado', 'registros encontrados')}`}
                  </p>
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                  <div className="relative">
                    <Search className="w-3.5 h-3.5 text-neutral-400 absolute left-3 top-1/2 -translate-y-1/2" aria-hidden="true" />
                    <input
                      type="search"
                      value={busca}
                      onChange={(e) => setBusca(e.target.value)}
                      placeholder="Buscar por OS, etapa ou colaborador..."
                      className="pl-8 pr-3 py-2 rounded-full bg-white border border-neutral-200 text-xs text-neutral-800 placeholder-neutral-400 focus:outline-none focus:border-yellow-400 w-56"
                    />
                  </div>
                  <div className="relative">
                    <select
                      value={filtroCentro}
                      onChange={(e) => setFiltroCentro(e.target.value)}
                      className="appearance-none pl-3.5 pr-8 py-2 rounded-full bg-white border border-neutral-200 text-xs font-semibold text-neutral-700 focus:outline-none focus:border-yellow-400 cursor-pointer"
                    >
                      <option value="">Todos os centros</option>
                      {dados.porCentro.map((c) => (
                        <option key={c.centro} value={c.centro}>{c.centro}</option>
                      ))}
                    </select>
                    <ChevronDown className="w-3.5 h-3.5 text-neutral-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                  </div>
                  <div className="relative">
                    <select
                      value={filtroEtapa}
                      onChange={(e) => setFiltroEtapa(e.target.value)}
                      disabled={etapasDisponiveis.length === 0}
                      className="appearance-none pl-3.5 pr-8 py-2 rounded-full bg-white border border-neutral-200 text-xs font-semibold text-neutral-700 focus:outline-none focus:border-yellow-400 cursor-pointer disabled:opacity-40"
                    >
                      <option value="">Etapa</option>
                      {etapasDisponiveis.map((e) => (
                        <option key={e} value={e}>{e}</option>
                      ))}
                    </select>
                    <ChevronDown className="w-3.5 h-3.5 text-neutral-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                  </div>
                  <div className="relative">
                    <button
                      type="button"
                      onClick={() => setFiltrosAbertos((a) => !a)}
                      className={`px-3.5 py-2 rounded-full border text-xs font-bold transition-all ${filtroColaborador ? 'border-yellow-400 text-yellow-600 bg-yellow-50' : 'border-neutral-200 bg-white text-neutral-600 hover:border-yellow-400 hover:text-yellow-600'}`}
                    >
                      Colaborador{filtroColaborador ? ' (1)' : ''}
                    </button>
                    {filtrosAbertos && (
                      <div className="absolute right-0 top-full mt-1.5 w-56 rounded-2xl bg-white border border-neutral-200 shadow-lg z-20 p-3 space-y-2">
                        <label className="text-[10px] font-bold text-neutral-500 uppercase tracking-wide block">Colaborador</label>
                        <select
                          value={filtroColaborador}
                          onChange={(e) => setFiltroColaborador(e.target.value)}
                          disabled={colaboradoresDisponiveis.length === 0}
                          className="w-full appearance-none px-3 py-2 rounded-full bg-neutral-50 border border-neutral-200 text-xs font-semibold text-neutral-700 focus:outline-none focus:border-yellow-400 cursor-pointer disabled:opacity-40"
                        >
                          <option value="">Todos</option>
                          {colaboradoresDisponiveis.map((c) => (
                            <option key={c} value={c}>{formatNomeVendedor(c)}</option>
                          ))}
                        </select>
                        {filtroColaborador && (
                          <button type="button" onClick={() => setFiltroColaborador('')} className="w-full px-3 py-1.5 rounded-full bg-neutral-100 text-neutral-600 text-[11px] font-bold hover:bg-neutral-200">
                            Limpar filtro
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {detalhesFiltrados.length === 0 ? (
                <div className="rounded-2xl bg-white border border-neutral-200 p-6 text-center">
                  <span className="text-xs text-neutral-400">Nenhum apontamento encontrado para os filtros selecionados.</span>
                </div>
              ) : (
                <div className="overflow-x-auto rounded-2xl border border-neutral-200 bg-white">
                  <table className="w-full text-xs border-collapse min-w-[760px]">
                    <thead className="bg-neutral-50">
                      <tr className="text-[10px] font-bold uppercase tracking-wider text-neutral-500">
                        <th scope="col" className="px-4 py-2.5 text-left">Data/hora</th>
                        <th scope="col" className="px-3 py-2.5 text-left">Centro</th>
                        <th scope="col" className="px-3 py-2.5 text-left">OS</th>
                        <th scope="col" className="px-3 py-2.5 text-left">Etapa</th>
                        <th scope="col" className="px-3 py-2.5 text-right">Produção</th>
                        <th scope="col" className="px-3 py-2.5 text-left">Colaborador</th>
                        <th scope="col" className="px-3 py-2.5 text-right">Duração</th>
                        <th scope="col" className="px-4 py-2.5 text-right" title="Valor do pedido rateado pela quantidade produzida — estimativa, o Nomus não informa valor por etapa.">
                          Valor (estimado)
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-neutral-100">
                      {paginaAtual.map((d) => {
                        const indiceCentro = dados.porCentro.findIndex((c) => c.centro === d.centro);
                        const corCentro = corDoCentro(indiceCentro === -1 ? 0 : indiceCentro);
                        return (
                          <tr key={d.id} className="hover:bg-neutral-50 transition-colors">
                            <td className="px-4 py-2.5 whitespace-nowrap text-neutral-600">{d.dataHoraFinal ?? '—'}</td>
                            <td className="px-3 py-2.5">
                              <span className="px-2 py-0.5 rounded-full border text-[10px] font-bold" style={{ borderColor: corCentro, color: corCentro }}>
                                {d.centro}
                              </span>
                            </td>
                            <td className="px-3 py-2.5 font-bold text-neutral-900 whitespace-nowrap">{d.nomeOrdem ?? '—'}</td>
                            <td className="px-3 py-2.5 text-neutral-600 truncate max-w-[160px]">{d.descricaoEtapa || '—'}</td>
                            <td className="px-3 py-2.5 text-right font-bold text-neutral-900 whitespace-nowrap">
                              {d.quantidade != null ? `${formatarNumeroBr(d.quantidade)} ${formatarUnidade(d.unidadeMedida)}` : '—'}
                            </td>
                            <td className="px-3 py-2.5 text-neutral-600 truncate max-w-[180px]">{d.funcionario ? formatNomeVendedor(d.funcionario) : '—'}</td>
                            <td className="px-3 py-2.5 text-right text-neutral-600 whitespace-nowrap">{formatarDuracao(d.duracaoMs)}</td>
                            <td className="px-4 py-2.5 text-right font-bold text-emerald-600 whitespace-nowrap">
                              {d.valorProduzido != null ? formatarMoedaNumero(d.valorProduzido) : '—'}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}

              <div className="flex flex-col sm:flex-row items-center justify-between gap-2">
                <span className="text-[11px] text-neutral-400">
                  Mostrando {paginaAtual.length === 0 ? 0 : (pagina - 1) * TAMANHO_PAGINA + 1}–
                  {(pagina - 1) * TAMANHO_PAGINA + paginaAtual.length} de {detalhesFiltrados.length} {pluralizar(detalhesFiltrados.length, 'registro', 'registros')}
                </span>
                {totalPaginas > 1 && (
                  <div className="flex items-center gap-2">
                    <button type="button" disabled={pagina <= 1} onClick={() => setPagina((p) => p - 1)} aria-label="Página anterior" className="w-7 h-7 flex items-center justify-center rounded-full border border-neutral-200 bg-white text-neutral-500 hover:border-yellow-400 hover:text-yellow-600 disabled:opacity-30 transition-all">
                      <ChevronLeft className="w-3.5 h-3.5" />
                    </button>
                    <span className="text-xs font-bold text-neutral-700">{pagina}</span>
                    <button type="button" disabled={pagina >= totalPaginas} onClick={() => setPagina((p) => p + 1)} aria-label="Próxima página" className="w-7 h-7 flex items-center justify-center rounded-full border border-neutral-200 bg-white text-neutral-500 hover:border-yellow-400 hover:text-yellow-600 disabled:opacity-30 transition-all">
                      <ChevronRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                )}
              </div>
            </div>

            {dados.atualizadoEm && (
              <p className="text-[11px] text-neutral-400 text-center">
                Última atualização: {new Date(dados.atualizadoEm).toLocaleDateString('pt-BR')} {new Date(dados.atualizadoEm).toLocaleTimeString('pt-BR')}
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
