import React, { useEffect, useMemo, useState } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  RefreshCw,
  Search,
  Inbox,
  X,
  AlertTriangle,
  Package,
  FileDown,
} from 'lucide-react';
import { ItemPlanejamentoProducao, KanbanProducao, CardProducao } from '../types';
import { ModoPeriodoProducao, intervaloDoPeriodo } from '../utils/producaoCampos';

const PERIODOS_RELATORIO: { id: ModoPeriodoProducao; label: string }[] = [
  { id: 'dia', label: 'Dia' },
  { id: 'semana', label: 'Semana' },
  { id: 'mes', label: 'Mês' },
];

const NOMES_MES = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
];
const DIAS_SEMANA = ['DOM', 'SEG', 'TER', 'QUA', 'QUI', 'SEX', 'SÁB'];

function chaveDia(d: Date): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

// 6 semanas (42 dias) sempre, começando no domingo antes (ou igual a) o dia 1 do mês.
function gerarGradeMes(ano: number, mes: number): Date[] {
  const primeiroDia = new Date(ano, mes, 1);
  const inicio = new Date(ano, mes, 1 - primeiroDia.getDay());
  return Array.from({ length: 42 }, (_, i) => new Date(inicio.getFullYear(), inicio.getMonth(), inicio.getDate() + i));
}

function bateBusca(texto: string, busca: string): boolean {
  const alvo = busca.trim().toLowerCase();
  if (!alvo) return true;
  return texto.toLowerCase().includes(alvo);
}

// Mesma regra da aba Planejamento do Apontamento de Produção (conferida
// direto no bundle de lá, pra bater com o "Aguardando 1º processo" de
// verdade): da fila de aguardando do kanban, tira quem já está no
// calendário (idOperacaoOrdem já agendado) e quem tem pedido com mais de
// 90 dias (backlog antigo não entra na fila de planejamento).
const LIMITE_DIAS_PEDIDO = 90;

function calcularFilaPrimeiroProcesso(kanban: KanbanProducao | null, itensAgendados: ItemPlanejamentoProducao[]): CardProducao[] {
  if (!kanban) return [];
  const idsOperacaoAgendados = new Set(itensAgendados.map((i) => i.idOperacaoOrdem));
  const agora = Date.now();
  return kanban.filaAguardando.filter((card) => {
    if (card.idOperacaoOrdem !== undefined && idsOperacaoAgendados.has(card.idOperacaoOrdem)) return false;
    if (!card.dataPedido) return true;
    const dias = (agora - new Date(card.dataPedido).getTime()) / 86_400_000;
    return dias <= LIMITE_DIAS_PEDIDO;
  });
}

export const PlanejamentoProducaoPCP: React.FC = () => {
  const [itens, setItens] = useState<ItemPlanejamentoProducao[]>([]);
  const [kanban, setKanban] = useState<KanbanProducao | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);

  const hoje = useMemo(() => new Date(), []);
  const [mesSelecionado, setMesSelecionado] = useState({ ano: hoje.getFullYear(), mes: hoje.getMonth() });
  const [diaSelecionado, setDiaSelecionado] = useState<string | null>(null);
  const [buscaCalendario, setBuscaCalendario] = useState('');
  const [buscaFila, setBuscaFila] = useState('');
  const [periodoRelatorio, setPeriodoRelatorio] = useState<ModoPeriodoProducao>('dia');

  function baixarRelatorioPdf() {
    const { inicio, fim, rotulo } = intervaloDoPeriodo(periodoRelatorio, new Date());
    const a = document.createElement('a');
    a.href = `/api/producao/planejamento/pdf?inicio=${inicio}&fim=${fim}&rotulo=${encodeURIComponent(rotulo)}`;
    a.click();
  }

  function carregar() {
    setCarregando(true);
    setErro(null);
    Promise.all([
      fetch('/api/producao/planejamento').then((r) => r.json()),
      fetch('/api/producao/kanban').then((r) => r.json()),
    ])
      .then(([planejamento, kanbanData]) => {
        if (planejamento?.error) throw new Error(planejamento.error);
        setItens(Array.isArray(planejamento) ? planejamento : []);
        setKanban(kanbanData);
      })
      .catch((err) => setErro(err.message || 'Falha ao carregar o planejamento de produção.'))
      .finally(() => setCarregando(false));
  }

  useEffect(() => {
    carregar();
  }, []);

  const chaveHoje = chaveDia(hoje);
  const dias = useMemo(() => gerarGradeMes(mesSelecionado.ano, mesSelecionado.mes), [mesSelecionado]);

  const itensPorDia = useMemo(() => {
    const mapa = new Map<string, ItemPlanejamentoProducao[]>();
    for (const item of itens) {
      if (!mapa.has(item.data)) mapa.set(item.data, []);
      mapa.get(item.data)!.push(item);
    }
    return mapa;
  }, [itens]);

  const filaAguardando = useMemo(() => calcularFilaPrimeiroProcesso(kanban, itens), [kanban, itens]);
  const filaFiltrada = filaAguardando.filter((c) => bateBusca(`${c.nomeOrdem} ${c.pedido || ''} ${c.produto || ''}`, buscaFila));

  function navegarMes(delta: number) {
    setMesSelecionado((atual) => {
      const data = new Date(atual.ano, atual.mes + delta, 1);
      return { ano: data.getFullYear(), mes: data.getMonth() };
    });
  }

  const itensDoDiaSelecionado = diaSelecionado ? (itensPorDia.get(diaSelecionado) ?? []) : [];
  const nomeMesSelecionado = NOMES_MES[mesSelecionado.mes];

  return (
    <div className="space-y-6 pb-12">
      {/* Cabeçalho */}
      <div>
        <p className="text-[11px] text-neutral-500 font-semibold mb-1">Departamentos / PCP</p>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-black text-neutral-900 tracking-tight">Planejamento da Produção</h1>
            <p className="text-sm text-neutral-500 mt-1">
              Calendário de agendamento das ordens de serviço — dado real do Apontamento de Produção.
            </p>
          </div>
          <button
            type="button"
            onClick={carregar}
            disabled={carregando}
            className="flex items-center gap-1.5 px-4 py-2.5 rounded-full border border-neutral-200 bg-white text-xs font-bold text-neutral-600 hover:border-yellow-400 hover:text-yellow-600 disabled:opacity-50 transition-all shrink-0"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${carregando ? 'animate-spin' : ''}`} aria-hidden="true" />
            Atualizar
          </button>
        </div>
        <p className="text-[11px] text-neutral-400 mt-2">
          Somente leitura por enquanto — pra reagendar uma ordem, use a aba Planejamento do Apontamento de Produção.
        </p>

        <div className="flex flex-wrap items-center gap-2 mt-4">
          <div role="group" aria-label="Período do relatório" className="flex items-center gap-1.5 bg-neutral-50 p-1 rounded-full border border-neutral-200">
            {PERIODOS_RELATORIO.map((p) => (
              <button
                key={p.id}
                type="button"
                aria-pressed={periodoRelatorio === p.id}
                onClick={() => setPeriodoRelatorio(p.id)}
                className={`px-3.5 py-1.5 rounded-full text-xs transition-all ${
                  periodoRelatorio === p.id ? 'bg-yellow-400 text-black font-bold' : 'text-neutral-500 font-medium hover:text-neutral-900'
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>
          <button
            type="button"
            onClick={baixarRelatorioPdf}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-full border border-neutral-200 bg-white text-xs font-bold text-neutral-600 hover:border-yellow-400 hover:text-yellow-600 transition-all"
          >
            <FileDown className="w-3.5 h-3.5" aria-hidden="true" />
            Baixar PDF
          </button>
        </div>
      </div>

      {erro && (
        <div className="flex items-center gap-2 text-xs text-red-600 bg-red-50 border border-red-200 rounded-2xl p-4">
          <AlertTriangle className="w-4 h-4 shrink-0" aria-hidden="true" />
          <span>{erro}</span>
        </div>
      )}

      {carregando ? (
        <p className="text-xs text-neutral-500 py-10 text-center">Carregando...</p>
      ) : (
        <div className="grid grid-cols-1 xl:grid-cols-[320px_1fr] gap-6">
          {/* Fila — ordens aguardando 1º processo */}
          <div className="rounded-[2rem] bg-white border border-neutral-200 p-4 sm:p-5 space-y-3 xl:max-h-[760px] xl:overflow-hidden xl:flex xl:flex-col">
            <div className="flex items-center justify-between gap-2">
              <h3 className="text-sm font-black text-neutral-900 flex items-center gap-2">
                <Inbox className="w-4 h-4 text-yellow-600" aria-hidden="true" />
                Aguardando 1º Processo
              </h3>
              <span className="w-7 h-7 shrink-0 flex items-center justify-center rounded-full bg-yellow-400 text-black text-[11px] font-black">
                {filaAguardando.length}
              </span>
            </div>

            <div className="relative">
              <Search className="w-3.5 h-3.5 text-neutral-400 absolute left-3 top-1/2 -translate-y-1/2" aria-hidden="true" />
              <input
                type="text"
                value={buscaFila}
                onChange={(e) => setBuscaFila(e.target.value)}
                placeholder="Buscar OS, pedido ou produto..."
                className="w-full pl-8 pr-3 py-2 rounded-full bg-neutral-50 border border-neutral-200 text-xs text-neutral-800 placeholder-neutral-400 focus:outline-none focus:border-yellow-400"
              />
            </div>

            {kanban?.atualizadoEm && (
              <span className="text-[10px] text-neutral-400">Atualizado às {new Date(kanban.atualizadoEm).toLocaleTimeString('pt-BR')}</span>
            )}

            <div className="space-y-2.5 xl:flex-1 xl:min-h-0 xl:overflow-y-auto xl:pr-1">
              {filaFiltrada.length === 0 && (
                <p className="text-neutral-500 text-xs py-8 text-center">Nenhuma ordem aguardando.</p>
              )}
              {filaFiltrada.map((card) => (
                <div key={`${card.idOrdem}-${card.idOperacaoOrdem}`} className="p-3.5 rounded-2xl bg-neutral-50 border border-neutral-100 space-y-1.5">
                  <span className="font-bold text-neutral-900 text-xs block">{card.nomeOrdem}</span>
                  {card.pedido && <span className="text-[10px] text-neutral-500 block">{card.pedido}</span>}
                  {card.produto && <span className="text-[10px] text-neutral-500 block truncate" title={card.produto}>{card.produto}</span>}
                  {card.valorTotal && <span className="text-[11px] font-mono font-bold text-neutral-700 block mt-1">R$ {card.valorTotal}</span>}
                </div>
              ))}
            </div>
          </div>

          {/* Calendário */}
          <div className="rounded-[2rem] bg-white border border-neutral-200 p-4 sm:p-5 space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <button type="button" onClick={() => navegarMes(-1)} className="w-8 h-8 flex items-center justify-center rounded-full bg-neutral-50 border border-neutral-200 text-neutral-500 hover:text-yellow-600 hover:border-yellow-400 transition-all">
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <span className="text-sm font-black text-neutral-900 w-36 text-center">{nomeMesSelecionado} {mesSelecionado.ano}</span>
                <button type="button" onClick={() => navegarMes(1)} className="w-8 h-8 flex items-center justify-center rounded-full bg-neutral-50 border border-neutral-200 text-neutral-500 hover:text-yellow-600 hover:border-yellow-400 transition-all">
                  <ChevronRight className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={() => setMesSelecionado({ ano: hoje.getFullYear(), mes: hoje.getMonth() })}
                  className="px-3 py-1.5 rounded-full border border-neutral-200 bg-white text-[11px] font-bold text-neutral-600 hover:border-yellow-400 hover:text-yellow-600 transition-all"
                >
                  Hoje
                </button>
              </div>
              <div className="relative w-full sm:w-64">
                <Search className="w-3.5 h-3.5 text-neutral-400 absolute left-3 top-1/2 -translate-y-1/2" aria-hidden="true" />
                <input
                  type="text"
                  value={buscaCalendario}
                  onChange={(e) => setBuscaCalendario(e.target.value)}
                  placeholder="Buscar OS já agendada..."
                  className="w-full pl-8 pr-3 py-2 rounded-full bg-neutral-50 border border-neutral-200 text-xs text-neutral-800 placeholder-neutral-400 focus:outline-none focus:border-yellow-400"
                />
              </div>
            </div>

            <div className="grid grid-cols-7 gap-1.5 sm:gap-2">
              {DIAS_SEMANA.map((d) => (
                <div key={d} className="text-center text-[10px] font-bold text-neutral-500 uppercase tracking-wider py-1.5">{d}</div>
              ))}

              {dias.map((dia) => {
                const chave = chaveDia(dia);
                const doMes = dia.getMonth() === mesSelecionado.mes;
                const isHoje = chave === chaveHoje;
                const itensDoDia = (itensPorDia.get(chave) ?? []).filter((it) =>
                  bateBusca(`${it.nomeOrdem} ${it.pedido || ''} ${it.produto || ''}`, buscaCalendario)
                );
                const visiveis = itensDoDia.slice(0, 3);
                const restantes = Math.max(0, itensDoDia.length - 3);

                return (
                  <div
                    key={chave}
                    onClick={() => setDiaSelecionado(chave)}
                    className={`min-h-[92px] sm:min-h-[112px] rounded-xl border p-1.5 sm:p-2 flex flex-col gap-1 text-left transition-all cursor-pointer hover:border-yellow-300/60 ${
                      !doMes ? 'border-neutral-100 bg-neutral-50 opacity-40' : 'border-neutral-200 bg-white'
                    }`}
                  >
                    <span className={`w-5 h-5 flex items-center justify-center text-[11px] font-bold rounded-full ${isHoje ? 'bg-sky-600 text-white' : doMes ? 'text-neutral-700' : 'text-neutral-400'}`}>
                      {dia.getDate()}
                    </span>
                    <div className="flex flex-col gap-1 w-full flex-1 min-h-0">
                      {visiveis.map((item) => (
                        <span
                          key={item.id}
                          title={`${item.nomeOrdem} — ${item.produto || ''}`}
                          className={`flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[9px] sm:text-[10px] font-semibold truncate border ${
                            item.atrasado ? 'bg-red-50 text-red-700 border-red-200' : 'bg-yellow-50 text-yellow-700 border-yellow-200'
                          }`}
                        >
                          <Package className="w-2.5 h-2.5 shrink-0" />
                          <span className="truncate">{item.nomeOrdem}</span>
                        </span>
                      ))}
                      {restantes > 0 && (
                        <span className="text-[9px] font-bold text-neutral-500 text-left">+{restantes} mais</span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Legenda */}
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 pt-2 border-t border-neutral-100 text-[10px] text-neutral-500">
              <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-yellow-400 shrink-0" />Agendada</span>
              <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-red-500 shrink-0" />Atrasada</span>
            </div>
          </div>
        </div>
      )}

      {/* Modal de detalhe do dia */}
      {diaSelecionado && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm" onClick={() => setDiaSelecionado(null)}>
          <div className="w-full max-w-lg max-h-[85vh] overflow-y-auto rounded-[2rem] bg-white border border-neutral-200 p-6 space-y-4 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-start justify-between gap-4">
              <div>
                <span className="text-xs font-bold uppercase tracking-widest text-yellow-600">Planejamento do Dia</span>
                <h2 className="text-xl font-black text-neutral-900 mt-1">
                  {(() => {
                    const [ano, mes, dia] = diaSelecionado.split('-').map(Number);
                    return new Date(ano, mes - 1, dia).toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' });
                  })()}
                </h2>
              </div>
              <button type="button" onClick={() => setDiaSelecionado(null)} aria-label="Fechar" className="w-8 h-8 shrink-0 flex items-center justify-center rounded-full bg-neutral-100 text-neutral-500 hover:text-neutral-900 transition-all">
                <X className="w-4 h-4" />
              </button>
            </div>

            {itensDoDiaSelecionado.length === 0 ? (
              <p className="text-neutral-500 text-xs py-6 text-center">Nenhuma ordem agendada nesse dia.</p>
            ) : (
              <div className="space-y-2.5">
                {itensDoDiaSelecionado.map((item) => (
                  <div key={item.id} className="p-3.5 rounded-2xl bg-neutral-50 border border-neutral-100 space-y-1.5">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-bold text-neutral-900 text-xs">{item.nomeOrdem}</span>
                      {item.atrasado && (
                        <span className="px-2 py-0.5 rounded-full bg-red-50 text-red-700 border border-red-200 text-[9px] font-bold">Atrasada</span>
                      )}
                    </div>
                    {item.pedido && <span className="text-[10px] text-neutral-500 block">{item.pedido}</span>}
                    {item.produto && <span className="text-[11px] text-neutral-700 block">{item.produto}</span>}
                    <div className="flex items-center gap-3 text-[11px] text-neutral-500 pt-1">
                      {item.quantidade && <span>{item.quantidade} {item.unidadeMedida}</span>}
                      {item.valorTotal && <span className="font-mono font-bold text-neutral-700">R$ {item.valorTotal}</span>}
                    </div>
                    {item.materiais.length > 0 && (
                      <div className="pt-2 mt-1 border-t border-neutral-200 space-y-1">
                        <span className="text-[9px] font-bold text-neutral-400 uppercase tracking-wider">Materiais</span>
                        {item.materiais.map((m) => (
                          <div key={m.codigo} className="flex items-center justify-between text-[10px] text-neutral-500">
                            <span className="truncate">{m.descricao}</span>
                            <span className="font-mono shrink-0 ml-2">{m.quantidade} {m.unidadeMedida}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
