import React, { useEffect, useMemo, useState } from 'react';
import {
  Headphones,
  Plus,
  Search,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Grid,
  List,
  MoreHorizontal,
  Inbox,
  Clock,
  Hourglass,
  CheckCircle2,
  AlertTriangle,
  X,
  Sheet,
} from 'lucide-react';
import { SacAtendimento, SacStatus, SacTipoAtendimento, SacPrioridade, SacProcedencia, User } from '../types';
import {
  SAC_STATUS,
  SAC_TIPOS_ATENDIMENTO,
  SAC_PRIORIDADES,
  SAC_PROCEDENCIAS,
  SAC_STATUS_EM_ANALISE,
  SAC_STATUS_AGUARDANDO,
} from '../data/sacOpcoes';
import { SAC_STATUS_BADGE, SAC_PRIORIDADE_BADGE, statusEhAberto, situacaoPrazo, corBadgePrazo } from '../utils/sacHelpers';
import { NovoAtendimentoModal } from './NovoAtendimentoModal';

export type SacAbaDetalhe = 'geral' | 'interacoes' | 'analise' | 'produtos' | 'anexos' | 'solucao' | 'historico';

interface SacListaAtendimentosProps {
  user: User;
  onSelecionarAtendimento: (id: string, abaInicial?: SacAbaDetalhe) => void;
  onAbrirPlanilha: () => void;
}

const ITENS_POR_PAGINA = 10;

function mesmoDia(dataIso: string, referencia: Date): boolean {
  const d = new Date(dataIso);
  return d.getFullYear() === referencia.getFullYear() && d.getMonth() === referencia.getMonth() && d.getDate() === referencia.getDate();
}

function mesmoMesAno(dataIso: string, referencia: Date): boolean {
  const d = new Date(dataIso);
  return d.getFullYear() === referencia.getFullYear() && d.getMonth() === referencia.getMonth();
}

export const SacListaAtendimentos: React.FC<SacListaAtendimentosProps> = ({ user, onSelecionarAtendimento, onAbrirPlanilha }) => {
  const [atendimentos, setAtendimentos] = useState<SacAtendimento[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);

  const [busca, setBusca] = useState('');
  const [filtroStatus, setFiltroStatus] = useState('');
  const [filtroTipo, setFiltroTipo] = useState('');
  const [filtroPrioridade, setFiltroPrioridade] = useState('');
  const [filtroProcedencia, setFiltroProcedencia] = useState('');
  const [filtroResponsavel, setFiltroResponsavel] = useState('');
  const [filtroGrupoKpi, setFiltroGrupoKpi] = useState<'abertos' | 'analise' | 'aguardando' | 'resolvidos' | null>(null);
  const [maisFiltrosAberto, setMaisFiltrosAberto] = useState(false);

  const [viewMode, setViewMode] = useState<'lista' | 'cards'>('lista');
  const [pagina, setPagina] = useState(1);
  const [menuAbertoId, setMenuAbertoId] = useState<string | null>(null);
  const [novoAberto, setNovoAberto] = useState(false);

  function carregarLista() {
    setCarregando(true);
    setErro(null);
    fetch('/api/sac/atendimentos')
      .then((res) => res.json())
      .then((data) => setAtendimentos(Array.isArray(data) ? data : []))
      .catch(() => setErro('Falha ao carregar atendimentos.'))
      .finally(() => setCarregando(false));
  }

  useEffect(() => {
    carregarLista();
  }, []);

  const hoje = useMemo(() => new Date(), []);

  // ---- KPIs — sempre sobre a lista COMPLETA ----
  const abertos = atendimentos.filter((a) => statusEhAberto(a.status));
  const abertosHoje = abertos.filter((a) => mesmoDia(a.criadoEm, hoje)).length;

  const emAnalise = atendimentos.filter((a) => (SAC_STATUS_EM_ANALISE as string[]).includes(a.status));
  const aguardandoOutrosSetores = emAnalise.filter((a) => a.solicitacoesInternas.some((s) => s.status !== 'Respondido' && s.status !== 'Cancelado')).length;

  const aguardandoRetorno = atendimentos.filter((a) => (SAC_STATUS_AGUARDANDO as string[]).includes(a.status));
  const proximoDoPrazo = aguardandoRetorno.filter((a) => {
    const sit = situacaoPrazo(a.prazo, a.status);
    return sit.cor === 'amarelo' || sit.cor === 'vermelho';
  }).length;

  const resolvidosEsteMes = atendimentos.filter((a) => a.status === 'Resolvido' && a.dataResolucao && mesmoMesAno(a.dataResolucao, hoje));

  const KPIS = [
    {
      chave: 'abertos' as const,
      titulo: 'Atendimentos Abertos',
      valor: abertos.length,
      legenda: `${abertosHoje} aberto${abertosHoje === 1 ? '' : 's'} hoje`,
      Icon: Inbox,
    },
    {
      chave: 'analise' as const,
      titulo: 'Em Análise',
      valor: emAnalise.length,
      legenda: `${aguardandoOutrosSetores} aguardando outros setores`,
      Icon: Clock,
    },
    {
      chave: 'aguardando' as const,
      titulo: 'Aguardando Retorno',
      valor: aguardandoRetorno.length,
      legenda: `${proximoDoPrazo} próximo${proximoDoPrazo === 1 ? '' : 's'} do prazo`,
      Icon: Hourglass,
    },
    {
      chave: 'resolvidos' as const,
      titulo: 'Resolvidos',
      valor: resolvidosEsteMes.length,
      legenda: `${resolvidosEsteMes.length} este mês`,
      Icon: CheckCircle2,
    },
  ];

  function alternarFiltroGrupo(chave: typeof filtroGrupoKpi) {
    setFiltroGrupoKpi((atual) => (atual === chave ? null : chave));
    setFiltroStatus('');
    setPagina(1);
  }

  const responsaveisDisponiveis = useMemo(
    () => [...new Set(atendimentos.map((a) => a.responsavelSac).filter((v): v is string => !!v))].sort(),
    [atendimentos]
  );

  const filtrados = useMemo(() => {
    const alvo = busca.trim().toLowerCase();
    return atendimentos.filter((a) => {
      if (filtroStatus && a.status !== filtroStatus) return false;
      if (!filtroStatus && filtroGrupoKpi === 'abertos' && !statusEhAberto(a.status)) return false;
      if (!filtroStatus && filtroGrupoKpi === 'analise' && !(SAC_STATUS_EM_ANALISE as string[]).includes(a.status)) return false;
      if (!filtroStatus && filtroGrupoKpi === 'aguardando' && !(SAC_STATUS_AGUARDANDO as string[]).includes(a.status)) return false;
      if (!filtroStatus && filtroGrupoKpi === 'resolvidos' && !(a.status === 'Resolvido' && a.dataResolucao && mesmoMesAno(a.dataResolucao, hoje))) return false;
      if (filtroTipo && a.tipo !== filtroTipo) return false;
      if (filtroPrioridade && a.prioridade !== filtroPrioridade) return false;
      if (filtroProcedencia && a.procedencia !== filtroProcedencia) return false;
      if (filtroResponsavel && a.responsavelSac !== filtroResponsavel) return false;
      if (!alvo) return true;
      const alvoEmProdutos = a.produtos.some(
        (p) =>
          (p.lote || '').toLowerCase().includes(alvo) ||
          (p.corrida || '').toLowerCase().includes(alvo) ||
          (p.produto || '').toLowerCase().includes(alvo)
      );
      return (
        a.protocolo.toLowerCase().includes(alvo) ||
        a.cliente.toLowerCase().includes(alvo) ||
        (a.nomeFantasia || '').toLowerCase().includes(alvo) ||
        (a.cnpjCpf || '').toLowerCase().includes(alvo) ||
        (a.contato || '').toLowerCase().includes(alvo) ||
        (a.telefone || '').toLowerCase().includes(alvo) ||
        (a.email || '').toLowerCase().includes(alvo) ||
        (a.numeroPedido || '').toLowerCase().includes(alvo) ||
        (a.numeroNF || '').toLowerCase().includes(alvo) ||
        a.assunto.toLowerCase().includes(alvo) ||
        alvoEmProdutos
      );
    });
  }, [atendimentos, busca, filtroStatus, filtroGrupoKpi, filtroTipo, filtroPrioridade, filtroProcedencia, filtroResponsavel, hoje]);

  const totalPaginas = Math.max(1, Math.ceil(filtrados.length / ITENS_POR_PAGINA));
  const paginaAtual = Math.min(pagina, totalPaginas);
  const inicioPagina = (paginaAtual - 1) * ITENS_POR_PAGINA;
  const paginaDados = filtrados.slice(inicioPagina, inicioPagina + ITENS_POR_PAGINA);

  const filtrosAtivos =
    !!filtroStatus || !!filtroTipo || !!filtroPrioridade || !!filtroProcedencia || !!filtroResponsavel || !!filtroGrupoKpi || !!busca;

  function limparFiltros() {
    setBusca('');
    setFiltroStatus('');
    setFiltroTipo('');
    setFiltroPrioridade('');
    setFiltroProcedencia('');
    setFiltroResponsavel('');
    setFiltroGrupoKpi(null);
    setPagina(1);
  }

  function atualizarFiltro(fn: () => void) {
    fn();
    setPagina(1);
  }

  return (
    <div className="space-y-6 pb-12">
      {/* Cabeçalho */}
      <div>
        <p className="text-[11px] text-neutral-500 font-semibold mb-1">Departamentos / SAC</p>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-black text-neutral-900 tracking-tight">SAC / Pós-Vendas</h1>
            <p className="text-sm text-neutral-500 mt-1">Gerencie atendimentos, reclamações e solicitações de clientes.</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={onAbrirPlanilha}
              className="flex items-center justify-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-5 py-2.5 text-xs font-extrabold text-emerald-800 shadow-sm transition-all hover:border-emerald-400 hover:bg-emerald-100 active:scale-95"
            >
              <Sheet className="w-4 h-4" aria-hidden="true" />
              Planilha SAC
            </button>
            <button
              type="button"
              onClick={() => setNovoAberto(true)}
              className="flex items-center justify-center gap-2 px-5 py-2.5 rounded-full bg-yellow-400 text-black font-extrabold text-xs hover:bg-yellow-300 shadow-sm active:scale-95 transition-all shrink-0"
            >
              <Plus className="w-4 h-4" aria-hidden="true" />
              Novo Atendimento
            </button>
          </div>
        </div>
      </div>

      {/* KPIs — clicáveis, filtram a tabela abaixo */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {KPIS.map((k) => (
          <button
            key={k.chave}
            type="button"
            onClick={() => alternarFiltroGrupo(k.chave)}
            className={`text-left p-4 rounded-2xl border space-y-2 transition-all ${
              filtroGrupoKpi === k.chave
                ? 'bg-yellow-50 border-yellow-300 ring-1 ring-yellow-300'
                : 'bg-neutral-100 border-neutral-200/50 hover:border-yellow-300/60'
            }`}
          >
            <div className="w-8 h-8 rounded-lg bg-yellow-100 flex items-center justify-center">
              <k.Icon className="w-4 h-4 text-yellow-600" aria-hidden="true" />
            </div>
            <div>
              <span className="text-[9px] font-bold text-neutral-500 uppercase tracking-widest block">{k.titulo}</span>
              <span className="text-lg font-black text-neutral-900 block mt-0.5">{k.valor}</span>
              <span className="text-[10px] text-neutral-500 font-semibold">{k.legenda}</span>
            </div>
          </button>
        ))}
      </div>

      {/* Atendimentos */}
      <div className="rounded-[2rem] bg-white border border-neutral-200 p-6 shadow-sm space-y-5">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div>
            <h3 className="text-lg font-extrabold text-neutral-900 flex items-center gap-2">
              Atendimentos
              <span className="px-2.5 py-0.5 rounded-full bg-neutral-50 border border-neutral-200 text-[11px] font-mono font-bold text-neutral-500">
                {atendimentos.length}
              </span>
            </h3>
            <p className="text-xs text-neutral-500 mt-0.5">Visualize e acompanhe os atendimentos de pós-venda.</p>
          </div>
          <div className="flex items-center gap-1 bg-neutral-50 p-1.5 rounded-full border border-neutral-200 shrink-0">
            <button
              type="button"
              onClick={() => setViewMode('lista')}
              title="Visualização em Lista"
              className={`p-2 rounded-full text-xs font-extrabold transition-all ${
                viewMode === 'lista' ? 'bg-yellow-400 text-black shadow-md' : 'text-neutral-500 hover:text-neutral-900'
              }`}
            >
              <List className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => setViewMode('cards')}
              title="Visualização em Cards"
              className={`p-2 rounded-full text-xs font-extrabold transition-all ${
                viewMode === 'cards' ? 'bg-yellow-400 text-black shadow-md' : 'text-neutral-500 hover:text-neutral-900'
              }`}
            >
              <Grid className="w-4 h-4" />
            </button>
          </div>
        </div>

        <div className="space-y-3">
          <div className="flex flex-col lg:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="w-4 h-4 absolute left-4 top-1/2 -translate-y-1/2 text-neutral-400" aria-hidden="true" />
              <input
                type="text"
                value={busca}
                onChange={(e) => atualizarFiltro(() => setBusca(e.target.value))}
                placeholder="Buscar por protocolo, cliente, pedido, nota fiscal, contato ou assunto"
                className="w-full pl-10 pr-4 py-2.5 bg-neutral-50 border border-neutral-200 rounded-full text-xs text-neutral-900 placeholder-neutral-500 focus:outline-none focus:border-yellow-400 transition-all"
              />
            </div>
            <FiltroSelect label="Status" value={filtroStatus} opcoes={SAC_STATUS} onChange={(v) => atualizarFiltro(() => { setFiltroStatus(v); setFiltroGrupoKpi(null); })} />
            <FiltroSelect label="Tipo" value={filtroTipo} opcoes={SAC_TIPOS_ATENDIMENTO} onChange={(v) => atualizarFiltro(() => setFiltroTipo(v))} />
            <FiltroSelect label="Prioridade" value={filtroPrioridade} opcoes={SAC_PRIORIDADES} onChange={(v) => atualizarFiltro(() => setFiltroPrioridade(v))} />
            <button
              type="button"
              onClick={() => setMaisFiltrosAberto((v) => !v)}
              className="flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-full border border-neutral-200 bg-white text-xs font-bold text-neutral-600 hover:border-yellow-400 hover:text-yellow-600 transition-all shrink-0"
            >
              Mais filtros
              <ChevronDown className={`w-3.5 h-3.5 transition-transform ${maisFiltrosAberto ? 'rotate-180' : ''}`} />
            </button>
          </div>

          {maisFiltrosAberto && (
            <div className="flex flex-col lg:flex-row gap-3 pt-1">
              <FiltroSelect label="Procedência" value={filtroProcedencia} opcoes={SAC_PROCEDENCIAS} onChange={(v) => atualizarFiltro(() => setFiltroProcedencia(v))} />
              <FiltroSelect label="Responsável" value={filtroResponsavel} opcoes={responsaveisDisponiveis} onChange={(v) => atualizarFiltro(() => setFiltroResponsavel(v))} />
            </div>
          )}

          {filtrosAtivos && (
            <button
              type="button"
              onClick={limparFiltros}
              className="flex items-center gap-1.5 text-[11px] font-bold text-neutral-500 hover:text-red-600 transition-colors"
            >
              <X className="w-3 h-3" />
              Limpar filtros
            </button>
          )}
        </div>

        {carregando ? (
          <p className="text-xs text-neutral-500 py-10 text-center">Carregando...</p>
        ) : erro ? (
          <p className="text-xs text-red-600 py-10 text-center">{erro}</p>
        ) : filtrados.length === 0 ? (
          <p className="text-xs text-neutral-500 py-10 text-center">
            {atendimentos.length === 0 ? 'Nenhum atendimento registrado ainda.' : 'Nenhum atendimento encontrado com esse filtro.'}
          </p>
        ) : viewMode === 'lista' ? (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-neutral-600">
              <thead className="bg-neutral-50 border-b border-neutral-200 text-neutral-500 uppercase font-mono text-[10px] tracking-wider">
                <tr>
                  <th className="p-3">Protocolo</th>
                  <th className="p-3">Cliente</th>
                  <th className="p-3">Pedido / NF</th>
                  <th className="p-3">Motivo</th>
                  <th className="p-3">Prioridade</th>
                  <th className="p-3">Responsável</th>
                  <th className="p-3">Abertura</th>
                  <th className="p-3">Prazo</th>
                  <th className="p-3">Status</th>
                  <th className="p-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100">
                {paginaDados.map((a) => {
                  const sit = situacaoPrazo(a.prazo, a.status);
                  return (
                    <tr key={a.id} className="hover:bg-neutral-50 transition-colors cursor-pointer" onClick={() => onSelecionarAtendimento(a.id)}>
                      <td className="p-3 font-mono font-bold text-neutral-900">{a.protocolo}</td>
                      <td className="p-3">
                        <span className="font-bold text-neutral-900 block truncate max-w-[160px]">{a.cliente}</span>
                        {a.contato && <span className="text-[10px] text-neutral-500 block truncate max-w-[160px]">{a.contato}</span>}
                      </td>
                      <td className="p-3 font-mono text-[11px]">
                        {a.numeroPedido || '—'} {a.numeroNF && `/ ${a.numeroNF}`}
                      </td>
                      <td className="p-3 truncate max-w-[180px]">{a.assunto || a.tipo}</td>
                      <td className="p-3">
                        <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${SAC_PRIORIDADE_BADGE[a.prioridade]}`}>{a.prioridade}</span>
                      </td>
                      <td className="p-3">{a.responsavelSac || <span className="text-neutral-300">—</span>}</td>
                      <td className="p-3">{new Date(a.criadoEm).toLocaleDateString('pt-BR')}</td>
                      <td className="p-3">
                        <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold border whitespace-nowrap ${corBadgePrazo(sit.cor)}`}>{sit.label}</span>
                      </td>
                      <td className="p-3">
                        <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold border whitespace-nowrap ${SAC_STATUS_BADGE[a.status]}`}>{a.status}</span>
                      </td>
                      <td className="p-3 text-right relative" onClick={(e) => e.stopPropagation()}>
                        <button
                          type="button"
                          onClick={() => setMenuAbertoId((atual) => (atual === a.id ? null : a.id))}
                          className="w-7 h-7 flex items-center justify-center rounded-full bg-neutral-50 text-neutral-400 hover:text-neutral-700 hover:bg-neutral-100 transition-colors"
                        >
                          <MoreHorizontal className="w-4 h-4" />
                        </button>
                        {menuAbertoId === a.id && (
                          <MenuAcoesAtendimento
                            onFechar={() => setMenuAbertoId(null)}
                            onNavegar={(aba) => {
                              setMenuAbertoId(null);
                              onSelecionarAtendimento(a.id, aba);
                            }}
                          />
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {paginaDados.map((a) => {
              const sit = situacaoPrazo(a.prazo, a.status);
              return (
                <button
                  key={a.id}
                  onClick={() => onSelecionarAtendimento(a.id)}
                  className="text-left p-5 rounded-[1.5rem] bg-white border border-neutral-200 hover:border-yellow-400/60 transition-all space-y-3 shadow-sm"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-mono font-black text-neutral-900 text-sm">{a.protocolo}</span>
                    <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${SAC_STATUS_BADGE[a.status]}`}>{a.status}</span>
                  </div>
                  <div>
                    <span className="font-bold text-neutral-900 text-sm block truncate">{a.cliente}</span>
                    <span className="text-[11px] text-neutral-500 block truncate">{a.assunto || a.tipo}</span>
                  </div>
                  <div className="flex items-center gap-2 flex-wrap pt-2 border-t border-neutral-100">
                    <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${SAC_PRIORIDADE_BADGE[a.prioridade]}`}>{a.prioridade}</span>
                    <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${corBadgePrazo(sit.cor)}`}>{sit.label}</span>
                  </div>
                  {a.responsavelSac && <p className="text-[10px] text-neutral-500">Responsável: <span className="font-semibold text-neutral-700">{a.responsavelSac}</span></p>}
                </button>
              );
            })}
          </div>
        )}

        {filtrados.length > 0 && (
          <div className="flex items-center justify-between gap-3 pt-2 flex-wrap">
            <span className="text-[11px] text-neutral-500">
              Mostrando {paginaDados.length} de {filtrados.length} atendimentos
            </span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setPagina((p) => Math.max(1, p - 1))}
                disabled={paginaAtual <= 1}
                className="w-8 h-8 flex items-center justify-center rounded-full bg-neutral-50 border border-neutral-200 text-neutral-500 hover:text-yellow-600 hover:border-yellow-400 disabled:opacity-40 transition-all"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <span className="w-8 h-8 flex items-center justify-center rounded-full bg-yellow-400 text-black text-xs font-extrabold">{paginaAtual}</span>
              <button
                type="button"
                onClick={() => setPagina((p) => Math.min(totalPaginas, p + 1))}
                disabled={paginaAtual >= totalPaginas}
                className="w-8 h-8 flex items-center justify-center rounded-full bg-neutral-50 border border-neutral-200 text-neutral-500 hover:text-yellow-600 hover:border-yellow-400 disabled:opacity-40 transition-all"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>

      <NovoAtendimentoModal
        isOpen={novoAberto}
        user={user}
        onClose={() => setNovoAberto(false)}
        onCriado={(novo) => {
          setAtendimentos((prev) => [novo, ...prev]);
          setNovoAberto(false);
          onSelecionarAtendimento(novo.id);
        }}
      />
    </div>
  );
};

const FiltroSelect: React.FC<{ label: string; value: string; opcoes: string[]; onChange: (v: string) => void }> = ({
  label,
  value,
  opcoes,
  onChange,
}) => (
  <div className="relative shrink-0 w-full lg:w-44">
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="appearance-none w-full pl-4 pr-9 py-2.5 bg-neutral-50 border border-neutral-200 rounded-full text-xs font-semibold text-neutral-700 focus:outline-none focus:border-yellow-400 cursor-pointer"
    >
      <option value="">{label}</option>
      {opcoes.map((o) => (
        <option key={o} value={o}>{o}</option>
      ))}
    </select>
    <ChevronDown className="w-3.5 h-3.5 text-neutral-400 absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
  </div>
);

// Ações rápidas do menu "..." — o que precisa de formulário maior manda pro
// detalhe do atendimento, já na aba certa.
const MenuAcoesAtendimento: React.FC<{ onFechar: () => void; onNavegar: (aba?: SacAbaDetalhe) => void }> = ({ onFechar, onNavegar }) => (
  <div className="absolute right-3 top-10 z-10 w-52 bg-white border border-neutral-200 rounded-2xl shadow-xl p-1.5" onMouseLeave={onFechar}>
    {[
      { label: 'Visualizar', aba: 'geral' as const },
      { label: 'Editar', aba: 'geral' as const },
      { label: 'Alterar responsável', aba: 'geral' as const },
      { label: 'Adicionar interação', aba: 'interacoes' as const },
      { label: 'Solicitar análise interna', aba: 'analise' as const },
      { label: 'Alterar status', aba: 'geral' as const },
      { label: 'Encerrar atendimento', aba: 'solucao' as const },
      { label: 'Cancelar atendimento', aba: 'geral' as const },
    ].map((item) => (
      <button
        key={item.label}
        type="button"
        onClick={() => onNavegar(item.aba)}
        className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-left text-xs font-semibold text-neutral-600 hover:bg-neutral-50 transition-colors"
      >
        {item.label}
      </button>
    ))}
  </div>
);
