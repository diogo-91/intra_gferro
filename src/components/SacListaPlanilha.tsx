import React, { useEffect, useMemo, useState } from 'react';
import {
  ClipboardList,
  Clock3,
  Factory,
  PackageSearch,
  RefreshCw,
  Search,
  Sheet,
  ShoppingCart,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Pencil,
} from 'lucide-react';

const STATUS = [
  'Atendimento aberto',
  'Aguardando compras',
  'Aguardado programação',
  'Aguardando produção',
  'Em Analise',
  'Aguardando retorno',
  'Resolvido',
] as const;

type StatusPlanilha = typeof STATUS[number];

interface AtendimentoPlanilha {
  id: string;
  linha: number;
  cliente: string;
  telefone: string;
  numeroPedido: string;
  statusPedido: string;
  prazoEntrega: string;
  atendimento: StatusPlanilha | null;
  responsavel?: string;
}

interface DadosPlanilha {
  atendimentos: AtendimentoPlanilha[];
  contadores: Record<StatusPlanilha, number>;
  atualizadoEm: string;
  atualizando: boolean;
}

interface SacListaPlanilhaProps {
  onAbrirPlanilha: () => void;
}

const CACHE_LOCAL = 'gferro:sac-planilha:v2';
const ITENS_POR_PAGINA = 20;

const CONFIG_KPIS = [
  { status: 'Atendimento aberto' as const, Icon: ClipboardList, cor: 'sky' },
  { status: 'Aguardando compras' as const, Icon: ShoppingCart, cor: 'amber' },
  { status: 'Aguardado programação' as const, Icon: Clock3, cor: 'violet' },
  { status: 'Aguardando produção' as const, Icon: Factory, cor: 'orange' },
  { status: 'Em Analise' as const, Icon: PackageSearch, cor: 'indigo' },
  { status: 'Aguardando retorno' as const, Icon: RefreshCw, cor: 'cyan' },
  { status: 'Resolvido' as const, Icon: CheckCircle2, cor: 'emerald' },
] as const;

const CLASSES_KPI: Record<typeof CONFIG_KPIS[number]['cor'], { card: string; icone: string; numero: string }> = {
  sky: { card: 'border-sky-200 bg-sky-50', icone: 'bg-sky-100 text-sky-700', numero: 'text-sky-950' },
  amber: { card: 'border-amber-200 bg-amber-50', icone: 'bg-amber-100 text-amber-700', numero: 'text-amber-950' },
  violet: { card: 'border-violet-200 bg-violet-50', icone: 'bg-violet-100 text-violet-700', numero: 'text-violet-950' },
  orange: { card: 'border-orange-200 bg-orange-50', icone: 'bg-orange-100 text-orange-700', numero: 'text-orange-950' },
  indigo: { card: 'border-indigo-200 bg-indigo-50', icone: 'bg-indigo-100 text-indigo-700', numero: 'text-indigo-950' },
  cyan: { card: 'border-cyan-200 bg-cyan-50', icone: 'bg-cyan-100 text-cyan-700', numero: 'text-cyan-950' },
  emerald: { card: 'border-emerald-200 bg-emerald-50', icone: 'bg-emerald-100 text-emerald-700', numero: 'text-emerald-950' },
};

const CLASSES_STATUS: Record<StatusPlanilha, string> = {
  'Atendimento aberto': 'border-sky-200 bg-sky-50 text-sky-700',
  'Aguardando compras': 'border-amber-200 bg-amber-50 text-amber-700',
  'Aguardado programação': 'border-violet-200 bg-violet-50 text-violet-700',
  'Aguardando produção': 'border-orange-200 bg-orange-50 text-orange-700',
  'Em Analise': 'border-indigo-200 bg-indigo-50 text-indigo-700',
  'Aguardando retorno': 'border-cyan-200 bg-cyan-50 text-cyan-700',
  'Resolvido': 'border-emerald-200 bg-emerald-50 text-emerald-700',
};

function carregarCacheLocal(): DadosPlanilha | null {
  try {
    const salvo = localStorage.getItem(CACHE_LOCAL);
    if (!salvo) return null;
    const dados = JSON.parse(salvo) as DadosPlanilha;
    return Array.isArray(dados?.atendimentos) && dados.atualizadoEm ? dados : null;
  } catch {
    return null;
  }
}

function salvarCacheLocal(dados: DadosPlanilha): void {
  try {
    localStorage.setItem(CACHE_LOCAL, JSON.stringify(dados));
  } catch {
    // O cache persistente do servidor em /app/data continua disponível.
  }
}

export const SacListaPlanilha: React.FC<SacListaPlanilhaProps> = ({ onAbrirPlanilha }) => {
  const cacheInicial = useMemo(carregarCacheLocal, []);
  const [dados, setDados] = useState<DadosPlanilha | null>(cacheInicial);
  const [carregando, setCarregando] = useState(!cacheInicial);
  const [atualizando, setAtualizando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [busca, setBusca] = useState('');
  const [filtroStatus, setFiltroStatus] = useState<StatusPlanilha | ''>('');
  const [pagina, setPagina] = useState(1);

  const consultar = async (forcar = false) => {
    if (forcar) setAtualizando(true);
    try {
      const resposta = await fetch(forcar ? '/api/sac/planilha/atualizar' : '/api/sac/planilha', {
        method: forcar ? 'POST' : 'GET',
      });
      const corpo = await resposta.json();
      if (!resposta.ok) throw new Error(corpo?.error || 'Falha ao consultar a planilha');
      setDados(corpo as DadosPlanilha);
      salvarCacheLocal(corpo as DadosPlanilha);
      setErro(null);
    } catch (error: any) {
      if (!dados) setErro(error.message || 'Falha ao consultar a planilha do SAC');
    } finally {
      setCarregando(false);
      if (forcar) setAtualizando(false);
    }
  };

  useEffect(() => {
    void consultar();
    const intervalo = window.setInterval(() => void consultar(), 30_000);
    return () => window.clearInterval(intervalo);
    // O polling usa sempre o último snapshot sem colocar a interface em loading.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const atendimentosFiltrados = useMemo(() => {
    const alvo = busca.trim().toLocaleLowerCase('pt-BR');
    return (dados?.atendimentos ?? []).filter((atendimento) => {
      if (filtroStatus && atendimento.atendimento !== filtroStatus) return false;
      if (!alvo) return true;
      return [
        atendimento.cliente,
        atendimento.telefone,
        atendimento.numeroPedido,
        atendimento.statusPedido,
        atendimento.prazoEntrega,
        atendimento.atendimento || 'Não informado',
        atendimento.responsavel || '',
      ].some((valor) => valor.toLocaleLowerCase('pt-BR').includes(alvo));
    });
  }, [dados, busca, filtroStatus]);

  const totalPaginas = Math.max(1, Math.ceil(atendimentosFiltrados.length / ITENS_POR_PAGINA));
  const paginaAtual = Math.min(pagina, totalPaginas);
  const paginaDados = atendimentosFiltrados.slice((paginaAtual - 1) * ITENS_POR_PAGINA, paginaAtual * ITENS_POR_PAGINA);

  const selecionarStatus = (status: StatusPlanilha) => {
    setFiltroStatus((atual) => atual === status ? '' : status);
    setPagina(1);
  };

  return (
    <div className="space-y-6 pb-12">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="mb-1 text-[11px] font-semibold text-neutral-500">Departamentos / SAC</p>
          <h1 className="text-2xl font-black tracking-tight text-neutral-900 sm:text-3xl">SAC / Pós-Vendas</h1>
          <p className="mt-1 text-sm text-neutral-500">Atendimentos sincronizados com a coluna F da planilha do Google.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {dados?.atualizadoEm && (
            <span className="text-[10px] font-medium text-neutral-400">
              Atualizado em {new Date(dados.atualizadoEm).toLocaleString('pt-BR')}
            </span>
          )}
          <button
            type="button"
            onClick={() => void consultar(true)}
            disabled={atualizando}
            className="inline-flex items-center gap-2 rounded-full border border-neutral-200 bg-white px-4 py-2.5 text-xs font-bold text-neutral-700 transition-colors hover:border-yellow-400 disabled:opacity-50"
          >
            <RefreshCw className={`h-4 w-4 ${atualizando || dados?.atualizando ? 'animate-spin' : ''}`} aria-hidden="true" />
            Atualizar
          </button>
          <button
            type="button"
            onClick={onAbrirPlanilha}
            className="inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-4 py-2.5 text-xs font-extrabold text-emerald-800 transition-colors hover:bg-emerald-100"
          >
            <Sheet className="h-4 w-4" aria-hidden="true" />
            Planilha SAC
          </button>
          <button
            type="button"
            onClick={onAbrirPlanilha}
            className="inline-flex items-center gap-2 rounded-full bg-yellow-400 px-5 py-2.5 text-xs font-extrabold text-black shadow-sm transition-colors hover:bg-yellow-300"
          >
            <Pencil className="h-4 w-4" aria-hidden="true" />
            Novo Atendimento
          </button>
        </div>
      </header>

      <section className="grid grid-cols-2 gap-2.5 sm:grid-cols-4 xl:grid-cols-7">
        {CONFIG_KPIS.map(({ status, Icon, cor }) => {
          const classes = CLASSES_KPI[cor];
          const selecionado = filtroStatus === status;
          return (
            <button
              key={status}
              type="button"
              onClick={() => selecionarStatus(status)}
              className={`min-w-0 rounded-2xl border p-3 text-left transition-all ${classes.card} ${selecionado ? 'ring-2 ring-yellow-400 ring-offset-2' : 'hover:-translate-y-0.5 hover:shadow-sm'}`}
            >
              <span className={`mb-2 flex h-7 w-7 items-center justify-center rounded-lg ${classes.icone}`}>
                <Icon className="h-3.5 w-3.5" aria-hidden="true" />
              </span>
              <span className="block min-h-7 text-[9px] font-black uppercase leading-tight tracking-wider text-neutral-600">{status}</span>
              <span className={`mt-1 block text-xl font-black tabular-nums ${classes.numero}`}>{dados?.contadores?.[status] ?? 0}</span>
            </button>
          );
        })}
      </section>

      <section className="overflow-hidden rounded-[2rem] border border-neutral-200 bg-white shadow-sm">
        <div className="flex flex-col gap-3 border-b border-neutral-100 p-5 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h2 className="text-lg font-black text-neutral-900">Atendimentos</h2>
            <p className="text-xs text-neutral-500">{atendimentosFiltrados.length} registros encontrados na planilha.</p>
          </div>
          <div className="flex flex-1 flex-col gap-2 sm:flex-row lg:max-w-3xl">
            <label className="relative flex-1">
              <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-400" aria-hidden="true" />
              <input
                value={busca}
                onChange={(event) => { setBusca(event.target.value); setPagina(1); }}
                placeholder="Buscar cliente, pedido, telefone, responsável ou status"
                className="w-full rounded-full border border-neutral-200 bg-neutral-50 py-2.5 pl-10 pr-4 text-xs outline-none transition-colors focus:border-yellow-400"
              />
            </label>
            <select
              value={filtroStatus}
              onChange={(event) => { setFiltroStatus(event.target.value as StatusPlanilha | ''); setPagina(1); }}
              className="rounded-full border border-neutral-200 bg-white px-4 py-2.5 text-xs font-semibold text-neutral-600 outline-none focus:border-yellow-400"
            >
              <option value="">Todos os status</option>
              {STATUS.map((status) => <option key={status} value={status}>{status}</option>)}
            </select>
          </div>
        </div>

        {carregando && !dados ? (
          <div className="flex items-center justify-center gap-2 py-20 text-xs font-semibold text-neutral-500">
            <RefreshCw className="h-5 w-5 animate-spin text-yellow-600" aria-hidden="true" />
            Carregando o primeiro cache da planilha...
          </div>
        ) : erro && !dados ? (
          <div className="py-20 text-center text-xs font-semibold text-red-600">{erro}</div>
        ) : paginaDados.length === 0 ? (
          <div className="py-20 text-center text-xs text-neutral-500">Nenhum atendimento encontrado.</div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[1050px] border-collapse text-left text-xs">
                <thead className="bg-neutral-50 text-[9px] font-black uppercase tracking-wider text-neutral-500">
                  <tr>
                    <th className="px-5 py-3">Cliente</th>
                    <th className="px-4 py-3">Telefone</th>
                    <th className="px-4 py-3">Pedido</th>
                    <th className="px-4 py-3">Status do pedido</th>
                    <th className="px-4 py-3">Prazo</th>
                    <th className="px-4 py-3">Responsável</th>
                    <th className="px-4 py-3">Atendimento — coluna F</th>
                    <th className="px-4 py-3 text-right">Ação</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-100">
                  {paginaDados.map((atendimento) => (
                    <tr key={atendimento.id} className="transition-colors hover:bg-yellow-50/40">
                      <td className="px-5 py-3 font-bold text-neutral-900">{atendimento.cliente}</td>
                      <td className="whitespace-nowrap px-4 py-3 text-neutral-600">{atendimento.telefone || '—'}</td>
                      <td className="px-4 py-3 font-black tabular-nums text-violet-700">{atendimento.numeroPedido || '—'}</td>
                      <td className="px-4 py-3 text-neutral-600">{atendimento.statusPedido || '—'}</td>
                      <td className="whitespace-nowrap px-4 py-3 font-semibold text-neutral-700">{atendimento.prazoEntrega || '—'}</td>
                      <td className="px-4 py-3 text-neutral-600">{atendimento.responsavel || '—'}</td>
                      <td className="px-4 py-3">
                        {atendimento.atendimento ? (
                          <span className={`inline-flex whitespace-nowrap rounded-full border px-2.5 py-1 text-[10px] font-black ${CLASSES_STATUS[atendimento.atendimento]}`}>
                            {atendimento.atendimento}
                          </span>
                        ) : (
                          <span className="inline-flex whitespace-nowrap rounded-full border border-neutral-200 bg-neutral-50 px-2.5 py-1 text-[10px] font-bold text-neutral-400">
                            Não informado
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <button type="button" onClick={onAbrirPlanilha} className="inline-flex items-center gap-1.5 font-bold text-yellow-700 hover:text-yellow-900">
                          <Pencil className="h-3.5 w-3.5" aria-hidden="true" />
                          Editar
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <footer className="flex items-center justify-between border-t border-neutral-100 px-5 py-4">
              <span className="text-[11px] font-medium text-neutral-500">Página {paginaAtual} de {totalPaginas}</span>
              <div className="flex items-center gap-2">
                <button type="button" disabled={paginaAtual <= 1} onClick={() => setPagina((valor) => Math.max(1, valor - 1))} className="rounded-full border border-neutral-200 p-2 text-neutral-600 disabled:opacity-30">
                  <ChevronLeft className="h-4 w-4" aria-label="Página anterior" />
                </button>
                <button type="button" disabled={paginaAtual >= totalPaginas} onClick={() => setPagina((valor) => Math.min(totalPaginas, valor + 1))} className="rounded-full border border-neutral-200 p-2 text-neutral-600 disabled:opacity-30">
                  <ChevronRight className="h-4 w-4" aria-label="Próxima página" />
                </button>
              </div>
            </footer>
          </>
        )}
      </section>
    </div>
  );
};
