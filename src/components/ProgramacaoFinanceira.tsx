import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Wallet,
  TrendingUp,
  TrendingDown,
  Target,
  Search,
  Calendar,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  AlertTriangle,
  Building2,
  User,
  Undo2,
  X,
  RefreshCw,
  Move,
  Printer,
  Sparkles,
  CheckCircle2,
  Inbox,
  Package,
  PiggyBank,
  FileText,
  ArrowDownCircle,
  ArrowUpCircle,
  ArrowLeft,
  FileDown,
} from 'lucide-react';
import { ContaReceber, ContaPagar, ContaConcluida, ResumoFinanceiro } from '../types';
import { formatCurrency, parseDataBr, chaveDia } from '../utils/format';
import { GRUPOS_CLASSIFICACAO_FINANCEIRA } from '../data/classificacoesFinanceiras';
import { COMPOSICAO_MATERIA_PRIMA, ItemComposicaoMateriaPrima } from '../data/composicaoMateriaPrima';

// Ordem oficial dos grupos (1, 2, 4, 6, 7...16) — chaves numéricas em objeto JS
// já saem nessa ordem ascendente independente da ordem de inserção.
const ORDEM_GRUPOS = Object.values(GRUPOS_CLASSIFICACAO_FINANCEIRA);

const NOMES_MES = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
];
const DIAS_SEMANA = ['DOM', 'SEG', 'TER', 'QUA', 'QUI', 'SEX', 'SÁB'];

type TipoConta = 'receber' | 'pagar';
type CorChip = 'emerald' | 'amber' | 'red' | 'sky';

const CHIP_STYLE: Record<CorChip, string> = {
  emerald: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  amber: 'bg-amber-50 text-amber-700 border-amber-200',
  red: 'bg-red-50 text-red-700 border-red-200',
  sky: 'bg-sky-50 text-sky-700 border-sky-200',
};

const BADGE_STYLE: Record<'vencido' | 'pagar' | 'receber', string> = {
  vencido: 'bg-red-50 text-red-700 border-red-200',
  pagar: 'bg-amber-50 text-amber-700 border-amber-200',
  receber: 'bg-emerald-50 text-emerald-700 border-emerald-200',
};

function chaveMes(ano: number, mes: number): string {
  return `${ano}-${String(mes + 1).padStart(2, '0')}`;
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

interface ItemParaMover {
  id: string;
  tipo: TipoConta;
  nome: string;
  valor: number;
  vencimentoOriginal: string;
}

interface ContaAberta {
  id: string;
  tipo: TipoConta;
  pessoa: string;
  categoria: string;
  grupo?: string;
  valor: number;
  vencimento: string;
  status: ContaReceber['status'] | ContaPagar['status'];
  vencimentoOriginal?: string;
}

interface ChipDia {
  key: string;
  label: string;
  valor: number;
  cor: CorChip;
  Icon: React.FC<{ className?: string }>;
  item?: ContaAberta;
}

const Sparkline: React.FC<{ data: number[]; color: string }> = ({ data, color }) => {
  if (data.length < 2 || data.every((v) => v === 0)) {
    return <div className="w-12 h-6 hidden sm:block" />;
  }
  const w = 64;
  const h = 24;
  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  const points = data
    .map((v, i) => {
      const x = (i / (data.length - 1)) * w;
      const y = h - ((v - min) / range) * (h - 4) - 2;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(' ');
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="w-12 h-6 shrink-0 hidden sm:block" preserveAspectRatio="none">
      <polyline points={points} fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
};

interface RelatorioDetalhadoConteudoProps {
  recebidoHoje: ContaConcluida[];
  totalRecebidoHoje: number;
  pagoHoje: ContaConcluida[];
  totalPagoHoje: number;
  /** Valor Meta da Matéria Prima (70% da receita do dia — o número grande do KPI), não o Realizado. */
  valorMateriaPrimaHoje: number;
  composicaoMateriaPrima: ItemComposicaoMateriaPrima[];
  layout?: 'modal' | 'tela';
}

// Conteúdo compartilhado entre o modal rápido e a tela cheia do Relatório
// Detalhado — mesmos blocos (Entrou/Saiu/Composição), só o layout muda:
// empilhado no modal (mais estreito), lado a lado na tela (mais espaço).
const RelatorioDetalhadoConteudo: React.FC<RelatorioDetalhadoConteudoProps> = ({
  recebidoHoje,
  totalRecebidoHoje,
  pagoHoje,
  totalPagoHoje,
  valorMateriaPrimaHoje,
  composicaoMateriaPrima,
  layout = 'modal',
}) => {
  const listaAltura = layout === 'tela' ? 'max-h-[480px] overflow-y-auto pr-1' : '';

  // As porcentagens de composição são as informadas pela GFERRO, mas nem
  // sempre somam exatos 100% — normaliza aqui pra garantir que a soma das
  // partes bata sempre com o total exibido (a proporção ENTRE as categorias
  // continua a mesma, só a base de cálculo passa a ser 100%).
  const somaPctComposicao = composicaoMateriaPrima.reduce((s, item) => s + item.pct, 0);
  const composicaoNormalizada = composicaoMateriaPrima.map((item) => ({
    ...item,
    pctExibido: somaPctComposicao > 0 ? (item.pct / somaPctComposicao) * 100 : 0,
  }));

  return (
    <>
      {/* Composição da Matéria Prima */}
      <div className="space-y-2">
        <h3
          className="flex items-center justify-between gap-2 text-xs font-extrabold uppercase tracking-wider text-amber-600"
          title="Fatia fixa (não vem do Nomus) aplicada sobre o valor Meta do KPI Matéria Prima (70% da receita do dia)"
        >
          <span className="flex items-center gap-1.5">
            <Package className="w-3.5 h-3.5" aria-hidden="true" />
            Composição da Matéria Prima
          </span>
          <span className="font-mono">{formatCurrency(valorMateriaPrimaHoje)}</span>
        </h3>
        {valorMateriaPrimaHoje === 0 ? (
          <p className="text-neutral-400 text-[11px] py-2 text-center">Sem valor de Matéria Prima neste dia.</p>
        ) : (
          <div className={layout === 'tela' ? 'grid grid-cols-1 sm:grid-cols-2 gap-1.5' : 'space-y-1.5'}>
            {composicaoNormalizada.map((item) => (
              <div key={item.nome} className="flex items-center gap-3 p-2.5 rounded-xl bg-neutral-50 border border-neutral-100">
                <span className="text-xs font-semibold text-neutral-700 w-28 shrink-0 truncate">{item.nome}</span>
                <div className="flex-1 h-1.5 rounded-full bg-neutral-200 overflow-hidden">
                  <div className="h-full rounded-full bg-amber-500" style={{ width: `${item.pctExibido}%` }} />
                </div>
                <span className="text-xs font-bold text-neutral-900 w-24 shrink-0 text-right font-mono">
                  {formatCurrency((valorMateriaPrimaHoje * item.pctExibido) / 100)}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className={`${layout === 'tela' ? 'grid grid-cols-1 lg:grid-cols-2 gap-6' : 'space-y-6'} pt-1 border-t border-neutral-100`}>
        {/* Entrou no Caixa */}
        <div className="space-y-2 pt-4">
          <h3 className="flex items-center justify-between gap-2 text-xs font-extrabold uppercase tracking-wider text-emerald-600">
            <span className="flex items-center gap-1.5">
              <ArrowDownCircle className="w-3.5 h-3.5" aria-hidden="true" />
              Entrou no Caixa
            </span>
            <span className="font-mono">{formatCurrency(totalRecebidoHoje)}</span>
          </h3>
          {recebidoHoje.length === 0 ? (
            <p className="text-neutral-400 text-[11px] py-2 text-center">Nada entrou no caixa neste dia.</p>
          ) : (
            <div className={`space-y-1.5 ${listaAltura}`}>
              {recebidoHoje.map((c) => (
                <div key={c.id} className="p-3 rounded-2xl bg-neutral-50 border border-neutral-100 flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <span className="font-bold text-neutral-900 text-xs truncate block">{c.pessoa}</span>
                    <span className="text-[10px] text-neutral-500 truncate block">{c.categoria}</span>
                  </div>
                  <span className="font-mono font-bold text-xs text-emerald-600 shrink-0">{formatCurrency(c.valor)}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Saiu do Caixa */}
        <div className="space-y-2 pt-4">
          <h3 className="flex items-center justify-between gap-2 text-xs font-extrabold uppercase tracking-wider text-red-600">
            <span className="flex items-center gap-1.5">
              <ArrowUpCircle className="w-3.5 h-3.5" aria-hidden="true" />
              Saiu do Caixa
            </span>
            <span className="font-mono">{formatCurrency(totalPagoHoje)}</span>
          </h3>
          {pagoHoje.length === 0 ? (
            <p className="text-neutral-400 text-[11px] py-2 text-center">Nada saiu do caixa neste dia.</p>
          ) : (
            <div className={`space-y-1.5 ${listaAltura}`}>
              {pagoHoje.map((c) => (
                <div key={c.id} className="p-3 rounded-2xl bg-neutral-50 border border-neutral-100 flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <span className="font-bold text-neutral-900 text-xs truncate block">{c.pessoa}</span>
                    <span className="text-[10px] text-neutral-500 truncate block">{c.categoria}</span>
                  </div>
                  <span className="font-mono font-bold text-xs text-red-600 shrink-0">{formatCurrency(c.valor)}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </>
  );
};

export const ProgramacaoFinanceira: React.FC = () => {
  const hoje = useMemo(() => new Date(), []);
  const hoje0h = useMemo(() => new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate()), [hoje]);
  const chaveHoje = useMemo(() => chaveDia(hoje), [hoje]);

  const [mesSelecionado, setMesSelecionado] = useState({ ano: hoje.getFullYear(), mes: hoje.getMonth() });
  const mesKey = chaveMes(mesSelecionado.ano, mesSelecionado.mes);
  const noMesAtual = mesKey === chaveMes(hoje.getFullYear(), hoje.getMonth());

  const [resumo, setResumo] = useState<ResumoFinanceiro | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const ultimaRequisicao = useRef<string | null>(null);
  // Guarda a função de busca do efeito atual pra o botão "Atualizar" poder
  // disparar o mesmo fetch sem duplicar a lógica de loading/erro/cancelamento.
  const buscarRef = useRef<(silencioso: boolean) => void>(() => {});

  useEffect(() => {
    let cancelado = false;
    ultimaRequisicao.current = mesKey;
    setCarregando(true);
    setErro(null);

    const buscar = (silencioso: boolean) => {
      if (!silencioso) {
        setCarregando(true);
        setErro(null);
      }

      fetch(`/api/financeiro/resumo?mes=${mesKey}`)
        .then(async (res) => {
          const data = await res.json();
          if (!res.ok) throw new Error(data?.error || 'Falha ao buscar dados financeiros do Nomus');
          return data as ResumoFinanceiro;
        })
        .then((data) => {
          if (cancelado || ultimaRequisicao.current !== mesKey) return;
          setResumo(data);
        })
        .catch((err) => {
          if (cancelado || ultimaRequisicao.current !== mesKey || silencioso) return;
          setErro(err.message || 'Falha ao buscar dados financeiros do Nomus');
        })
        .finally(() => {
          if (!cancelado && ultimaRequisicao.current === mesKey) setCarregando(false);
        });
    };

    buscarRef.current = buscar;
    buscar(false);
    const intervalo = setInterval(() => buscar(true), 60_000);

    return () => {
      cancelado = true;
      clearInterval(intervalo);
    };
  }, [mesKey]);

  function atualizarManualmente() {
    buscarRef.current(false);
  }

  function mudarMes(delta: number) {
    setMesSelecionado(({ ano, mes }) => {
      const d = new Date(ano, mes + delta, 1);
      return { ano: d.getFullYear(), mes: d.getMonth() };
    });
  }

  function irParaHoje() {
    setMesSelecionado({ ano: hoje.getFullYear(), mes: hoje.getMonth() });
    setFiltroDia('');
  }

  function baixarRelatorioPdf() {
    const a = document.createElement('a');
    a.href = `/api/financeiro/relatorio/pdf?mes=${mesKey}`;
    a.click();
  }

  function baixarRelatorioDetalhadoPdf() {
    const a = document.createElement('a');
    a.href = `/api/financeiro/relatorio-detalhado/pdf?dia=${diaReferencia}`;
    a.click();
  }

  // ---- Replanejamento (reagenda local, nunca muda o Nomus) — usado tanto
  // pelo fluxo de clique (banner "mover") quanto pelo drag-and-drop. ----
  const [itemParaMover, setItemParaMover] = useState<ItemParaMover | null>(null);
  const [movendo, setMovendo] = useState(false);
  const [erroMover, setErroMover] = useState<string | null>(null);
  const [diaArrastandoSobre, setDiaArrastandoSobre] = useState<string | null>(null);

  function iniciarMover(item: ItemParaMover) {
    setDiaSelecionado(null);
    setErroMover(null);
    setItemParaMover(item);
  }

  async function reprogramarConta(item: ItemParaMover, dia: Date): Promise<void> {
    const novaDataIso = `${dia.getFullYear()}-${String(dia.getMonth() + 1).padStart(2, '0')}-${String(dia.getDate()).padStart(2, '0')}`;
    const novaDataBr = `${String(dia.getDate()).padStart(2, '0')}/${String(dia.getMonth() + 1).padStart(2, '0')}/${dia.getFullYear()}`;

    setMovendo(true);
    setErroMover(null);
    try {
      const res = await fetch('/api/financeiro/reprogramar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: item.id, tipo: item.tipo, vencimentoOriginal: item.vencimentoOriginal, novaData: novaDataIso }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data?.error || 'Falha ao mover a conta');
      }

      setResumo((prev) => {
        if (!prev) return prev;
        const atualizar = <T extends { id: string; vencimento: string; vencimentoOriginal?: string }>(lista: T[]): T[] =>
          lista.map((c) => (c.id === item.id ? { ...c, vencimento: novaDataBr, vencimentoOriginal: item.vencimentoOriginal } : c));
        return {
          ...prev,
          contasReceber: item.tipo === 'receber' ? atualizar(prev.contasReceber) : prev.contasReceber,
          contasPagar: item.tipo === 'pagar' ? atualizar(prev.contasPagar) : prev.contasPagar,
        };
      });
    } catch (err: any) {
      setErroMover(err.message || 'Falha ao mover a conta');
      throw err;
    } finally {
      setMovendo(false);
    }
  }

  async function moverParaDia(dia: Date) {
    if (!itemParaMover) return;
    try {
      await reprogramarConta(itemParaMover, dia);
      setItemParaMover(null);
    } catch {
      // erroMover já foi setado dentro de reprogramarConta.
    }
  }

  function onDropDia(e: React.DragEvent, dia: Date) {
    e.preventDefault();
    setDiaArrastandoSobre(null);
    if (movendo) return;
    const dados = e.dataTransfer.getData('application/json');
    if (!dados) return;
    try {
      const item: ItemParaMover = JSON.parse(dados);
      reprogramarConta(item, dia).catch(() => {});
    } catch {
      // payload inválido — ignora.
    }
  }

  // Props de arrastar reaproveitadas tanto pelos cards da fila de pendências
  // quanto pelos chips já agendados no calendário (mesmo payload, mesmo destino).
  function draggableProps(it: ContaAberta) {
    return {
      draggable: true,
      onDragStart: (e: React.DragEvent) => {
        const item: ItemParaMover = { id: it.id, tipo: it.tipo, nome: it.pessoa, valor: it.valor, vencimentoOriginal: it.vencimento };
        e.dataTransfer.setData('application/json', JSON.stringify(item));
        e.dataTransfer.effectAllowed = 'move';
      },
    };
  }

  async function desfazerReprogramacao(id: string, tipo: TipoConta, vencimentoOriginal: string) {
    setMovendo(true);
    setErroMover(null);
    try {
      const res = await fetch(`/api/financeiro/reprogramar/${tipo}/${id}`, { method: 'DELETE' });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data?.error || 'Falha ao desfazer o replanejamento');
      }
      setResumo((prev) => {
        if (!prev) return prev;
        const atualizar = <T extends { id: string; vencimento: string; vencimentoOriginal?: string }>(lista: T[]): T[] =>
          lista.map((c) => (c.id === id ? { ...c, vencimento: vencimentoOriginal, vencimentoOriginal: undefined } : c));
        return {
          ...prev,
          contasReceber: tipo === 'receber' ? atualizar(prev.contasReceber) : prev.contasReceber,
          contasPagar: tipo === 'pagar' ? atualizar(prev.contasPagar) : prev.contasPagar,
        };
      });
    } catch (err: any) {
      setErroMover(err.message || 'Falha ao desfazer o replanejamento');
    } finally {
      setMovendo(false);
    }
  }

  const contasReceber = resumo?.contasReceber ?? [];
  const contasPagar = resumo?.contasPagar ?? [];
  const contasConcluidas = resumo?.contasConcluidas ?? [];

  // Lista global (não filtrada por mês) — alimenta a sidebar de pendências e a
  // grade do calendário.
  const itensAbertos: ContaAberta[] = useMemo(
    () => [
      ...contasReceber.map((c): ContaAberta => ({
        id: c.id, tipo: 'receber', pessoa: c.cliente, categoria: c.categoria, grupo: c.grupo,
        valor: c.valor, vencimento: c.vencimento, status: c.status, vencimentoOriginal: c.vencimentoOriginal,
      })),
      ...contasPagar.map((c): ContaAberta => ({
        id: c.id, tipo: 'pagar', pessoa: c.fornecedor, categoria: c.categoria, grupo: c.grupo,
        valor: c.valor, vencimento: c.vencimento, status: c.status, vencimentoOriginal: c.vencimentoOriginal,
      })),
    ],
    [contasReceber, contasPagar]
  );

  const abertasDoMes = useMemo(
    () =>
      itensAbertos.filter((it) => {
        const d = parseDataBr(it.vencimento);
        return d.getFullYear() === mesSelecionado.ano && d.getMonth() === mesSelecionado.mes;
      }),
    [itensAbertos, mesSelecionado]
  );

  // ---- KPIs + sparklines (tudo derivado de dado real, nada fabricado) ----
  const diasNoMes = new Date(mesSelecionado.ano, mesSelecionado.mes + 1, 0).getDate();
  const receberPorDiaArr = useMemo(() => {
    const arr = new Array(diasNoMes).fill(0);
    for (const it of abertasDoMes) if (it.tipo === 'receber') arr[parseDataBr(it.vencimento).getDate() - 1] += it.valor;
    return arr;
  }, [abertasDoMes, diasNoMes]);
  const pagarPorDiaArr = useMemo(() => {
    const arr = new Array(diasNoMes).fill(0);
    for (const it of abertasDoMes) if (it.tipo === 'pagar') arr[parseDataBr(it.vencimento).getDate() - 1] += it.valor;
    return arr;
  }, [abertasDoMes, diasNoMes]);
  const saldoProjetadoArr = useMemo(() => {
    let acumulado = 0;
    return receberPorDiaArr.map((v, i) => (acumulado += v - pagarPorDiaArr[i]));
  }, [receberPorDiaArr, pagarPorDiaArr]);
  const saldoAtualArr = useMemo(() => (resumo ? resumo.fluxoCaixa.map((f) => f.receitas - f.despesas) : []), [resumo]);

  const saldoProjetado = (resumo?.saldoMes ?? 0) + (resumo?.totalReceber ?? 0) - (resumo?.totalPagar ?? 0);

  // ---- Fila "Pendências Financeiras" (globais, não presa ao mês exibido) ----
  const [buscaPendencias, setBuscaPendencias] = useState('');
  const [filtroGrupo, setFiltroGrupo] = useState('');

  // Fila de pendências mostra só atrasos de até 30 dias — dívidas mais
  // antigas (a GFERRO tem alguma com 1300+ dias) só viram ruído na fila do
  // dia a dia. Não some em silêncio: o contador abaixo mostra quantas
  // ficaram de fora.
  const LIMITE_DIAS_ATRASO = 30;

  const todasAtrasadas = useMemo(
    () =>
      itensAbertos
        .filter((it) => it.status === 'Vencida')
        .sort((a, b) => parseDataBr(a.vencimento).getTime() - parseDataBr(b.vencimento).getTime()),
    [itensAbertos]
  );
  const contasAtrasadas = useMemo(
    () =>
      todasAtrasadas.filter(
        (it) => Math.round((hoje0h.getTime() - parseDataBr(it.vencimento).getTime()) / 86_400_000) <= LIMITE_DIAS_ATRASO
      ),
    [todasAtrasadas, hoje0h]
  );
  const atrasadasOcultas = todasAtrasadas.length - contasAtrasadas.length;
  const proximosVencimentos = useMemo(
    () =>
      itensAbertos
        .filter((it) => it.status !== 'Vencida')
        .sort((a, b) => parseDataBr(a.vencimento).getTime() - parseDataBr(b.vencimento).getTime()),
    [itensAbertos]
  );
  const pendencias = useMemo(() => [...contasAtrasadas, ...proximosVencimentos], [contasAtrasadas, proximosVencimentos]);

  // Opções do filtro de grupo — vêm de TODAS as pendências (não das já
  // filtradas), pra a lista de opções não ficar pulando enquanto o usuário digita.
  const opcoesGrupo = useMemo(() => {
    const todos: string[] = pendencias.map((it) => it.grupo || it.categoria || 'Outros');
    const presentes = new Set(todos);
    const grupoConhecidoSet = new Set(ORDEM_GRUPOS);
    const conhecidos = ORDEM_GRUPOS.filter((g) => presentes.has(g));
    const outros = todos.filter((g, i) => todos.indexOf(g) === i && !grupoConhecidoSet.has(g));
    return [...conhecidos, ...outros];
  }, [pendencias]);

  const pendenciasFiltradas = useMemo(
    () =>
      pendencias.filter((it) => {
        if (filtroGrupo && (it.grupo || it.categoria || 'Outros') !== filtroGrupo) return false;
        return bateBusca(`${it.pessoa} ${it.categoria}`, buscaPendencias);
      }),
    [pendencias, buscaPendencias, filtroGrupo]
  );

  // Fila agrupada pela Classificação Financeira oficial da GFERRO (ver
  // src/data/classificacoesFinanceiras.ts) — mesma ordem de grupos usada lá
  // (Receita Bruta, Dedução de Receita Bruta, CMV/CPV/CSV...). Dentro de cada
  // grupo mantém a ordem original (vencidas primeiro, depois por proximidade).
  const pendenciasPorGrupo = useMemo(() => {
    const mapa = new Map<string, ContaAberta[]>();
    for (const it of pendenciasFiltradas) {
      const grupo = it.grupo || it.categoria || 'Outros';
      if (!mapa.has(grupo)) mapa.set(grupo, []);
      mapa.get(grupo)!.push(it);
    }
    return mapa;
  }, [pendenciasFiltradas]);

  const gruposOrdenados = useMemo(() => {
    const chaves: string[] = [...pendenciasPorGrupo.keys()];
    const grupoConhecidoSet = new Set(ORDEM_GRUPOS);
    const conhecidos = ORDEM_GRUPOS.filter((g) => pendenciasPorGrupo.has(g));
    const outros = chaves.filter((g) => !grupoConhecidoSet.has(g));
    return [...conhecidos, ...outros];
  }, [pendenciasPorGrupo]);

  function descreverPrazo(vencimento: string): { texto: string; cor: string } {
    const diff = Math.round((parseDataBr(vencimento).getTime() - hoje0h.getTime()) / 86_400_000);
    if (diff === 0) return { texto: 'vence hoje', cor: 'text-red-600' };
    if (diff === 1) return { texto: 'vence amanhã', cor: 'text-amber-600' };
    if (diff > 1) return { texto: `vence em ${diff} dias`, cor: 'text-neutral-500' };
    return { texto: `atrasado há ${Math.abs(diff)} dia${Math.abs(diff) === 1 ? '' : 's'}`, cor: 'text-red-600' };
  }

  // ---- Grade do calendário ----
  const [diaSelecionado, setDiaSelecionado] = useState<string | null>(null);
  const [buscaCalendario, setBuscaCalendario] = useState('');
  const [filtroDia, setFiltroDia] = useState('');
  const dias = useMemo(() => gerarGradeMes(mesSelecionado.ano, mesSelecionado.mes), [mesSelecionado]);

  // Filtro "ir para o dia" — pula direto pro mês daquela data e já abre o
  // modal de detalhe do dia, sem precisar navegar mês a mês no calendário.
  function irParaDia(valorIso: string) {
    setFiltroDia(valorIso);
    if (!valorIso) return;
    const [ano, mes] = valorIso.split('-').map(Number);
    setMesSelecionado({ ano, mes: mes - 1 });
    setDiaSelecionado(valorIso);
  }

  const receberPorDia = useMemo(() => {
    const mapa = new Map<string, ContaAberta[]>();
    for (const it of itensAbertos) {
      if (it.tipo !== 'receber') continue;
      const chave = chaveDia(parseDataBr(it.vencimento));
      if (!mapa.has(chave)) mapa.set(chave, []);
      mapa.get(chave)!.push(it);
    }
    return mapa;
  }, [itensAbertos]);

  const pagarPorDia = useMemo(() => {
    const mapa = new Map<string, ContaAberta[]>();
    for (const it of itensAbertos) {
      if (it.tipo !== 'pagar') continue;
      const chave = chaveDia(parseDataBr(it.vencimento));
      if (!mapa.has(chave)) mapa.set(chave, []);
      mapa.get(chave)!.push(it);
    }
    return mapa;
  }, [itensAbertos]);

  // Caixa REALIZADO por dia — usa dataBaixa (quando o Nomus deu baixa de fato),
  // não o vencimento. É o que efetivamente entrou/saiu, diferente das linhas
  // acima (que são só o AGENDADO pra aquele dia, recebido ou não). Vira o chip
  // azul "Conciliado" no calendário (não é arrastável — já aconteceu).
  const recebidoPorDia = useMemo(() => {
    const mapa = new Map<string, ContaConcluida[]>();
    for (const c of contasConcluidas) {
      if (c.tipo !== 'receber') continue;
      const chave = chaveDia(parseDataBr(c.dataBaixa));
      if (!mapa.has(chave)) mapa.set(chave, []);
      mapa.get(chave)!.push(c);
    }
    return mapa;
  }, [contasConcluidas]);

  const pagoPorDia = useMemo(() => {
    const mapa = new Map<string, ContaConcluida[]>();
    for (const c of contasConcluidas) {
      if (c.tipo !== 'pagar') continue;
      const chave = chaveDia(parseDataBr(c.dataBaixa));
      if (!mapa.has(chave)) mapa.set(chave, []);
      mapa.get(chave)!.push(c);
    }
    return mapa;
  }, [contasConcluidas]);

  // Dia de referência dos KPIs "Entrou no Caixa" e "Resultado do Dia" — segue
  // o dia escolhido no filtro "Ir para um dia específico"; sem filtro, é hoje.
  // Só existe dado real quando esse dia cai dentro do mês exibido
  // (contasConcluidas vem filtrado pro mês selecionado no servidor); fora
  // dele não há como saber o que baixou naquele dia sem trocar de mês.
  const diaReferencia = filtroDia || chaveHoje;
  const diaReferenciaEhHoje = diaReferencia === chaveHoje;
  const diaReferenciaNoMesExibido = diaReferencia.startsWith(mesKey);
  const [anoRef, mesRefNum, diaRefNum] = diaReferencia.split('-').map(Number);
  const labelDiaReferencia = diaReferenciaEhHoje
    ? 'hoje'
    : new Date(anoRef, mesRefNum - 1, diaRefNum).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });

  const recebidoHoje = diaReferenciaNoMesExibido ? recebidoPorDia.get(diaReferencia) ?? [] : [];
  const totalRecebidoHoje = recebidoHoje.reduce((s, c) => s + c.valor, 0);

  // KPIs "Matéria Prima / Custo Fixo / Lucro" — regra 70/20/10 da GFERRO.
  // Base é a receita do dia de referência (Entrou no Caixa); Matéria Prima e
  // Custo Fixo são o que está programado pra pagar nesse dia no Nomus (grupo
  // "CMV / CPV / CSV" vs todo o resto); Lucro é o residual (receita menos as duas).
  const GRUPO_MATERIA_PRIMA = 'CMV / CPV / CSV';
  const META_PCT_MATERIA_PRIMA = 70;
  const pagarHoje = diaReferenciaNoMesExibido ? pagarPorDia.get(diaReferencia) ?? [] : [];
  const totalMateriaPrimaHoje = pagarHoje
    .filter((it) => (it.grupo || it.categoria) === GRUPO_MATERIA_PRIMA)
    .reduce((s, it) => s + it.valor, 0);
  const totalCustoFixoHoje = pagarHoje
    .filter((it) => (it.grupo || it.categoria) !== GRUPO_MATERIA_PRIMA)
    .reduce((s, it) => s + it.valor, 0);
  const totalLucroHoje = totalRecebidoHoje - totalMateriaPrimaHoje - totalCustoFixoHoje;

  const pctDaReceita = (valor: number) => (totalRecebidoHoje > 0 ? (valor / totalRecebidoHoje) * 100 : 0);
  const pctMateriaPrimaHoje = pctDaReceita(totalMateriaPrimaHoje);
  const pctCustoFixoHoje = pctDaReceita(totalCustoFixoHoje);
  const pctLucroHoje = pctDaReceita(totalLucroHoje);

  // Versão acumulada do mês das mesmas 3 métricas — usada só na legenda
  // "Realizado" dos cards (o número grande/meta continuam sendo do dia).
  // Tudo aqui vem do REALIZADO (contasConcluidas, já baixado no Nomus) desde
  // o dia 1 do mês até hoje — não do agendado (que incluiria dias futuros
  // ainda não vencidos e infla o total).
  const pagoMes = contasConcluidas.filter((c) => c.tipo === 'pagar');
  const totalMateriaPrimaMes = pagoMes
    .filter((c) => (c.grupo || c.categoria) === GRUPO_MATERIA_PRIMA)
    .reduce((s, c) => s + c.valor, 0);
  const totalCustoFixoMes = pagoMes
    .filter((c) => (c.grupo || c.categoria) !== GRUPO_MATERIA_PRIMA)
    .reduce((s, c) => s + c.valor, 0);
  const totalRecebidoMes = contasConcluidas.filter((c) => c.tipo === 'receber').reduce((s, c) => s + c.valor, 0);
  const totalLucroMes = totalRecebidoMes - totalMateriaPrimaMes - totalCustoFixoMes;

  const pctDaReceitaMes = (valor: number) => (totalRecebidoMes > 0 ? (valor / totalRecebidoMes) * 100 : 0);
  const pctMateriaPrimaMes = pctDaReceitaMes(totalMateriaPrimaMes);
  const pctCustoFixoMes = pctDaReceitaMes(totalCustoFixoMes);
  const pctLucroMes = pctDaReceitaMes(totalLucroMes);

  // Valor Meta da Matéria Prima (o número grande do card — 70% da receita do
  // dia), não o Realizado — é esse que o Relatório Detalhado fraciona, pra
  // bater com "o valor total da KPI Matéria Prima" (ex.: R$ 113.857).
  const valorMetaMateriaPrimaHoje = (META_PCT_MATERIA_PRIMA / 100) * totalRecebidoHoje;

  // "Saiu do Caixa" do Relatório Detalhado — pago DE FATO (baixado no Nomus),
  // diferente de pagarHoje acima (que é só o AGENDADO pra hoje, pago ou não).
  const pagoHoje = diaReferenciaNoMesExibido ? pagoPorDia.get(diaReferencia) ?? [] : [];
  const totalPagoHoje = pagoHoje.reduce((s, c) => s + c.valor, 0);

  // Item em aberto (a receber/a pagar) só aparece no calendário depois de
  // arrastado da fila de Pendências pra um dia — enquanto não é agendado
  // manualmente (vencimentoOriginal ainda vazio), fica só na fila, mesmo já
  // tendo um vencimento real lá no Nomus. "Conciliado" (já aconteceu de
  // verdade) continua aparecendo direto, sempre — não dá pra arrastar fato passado.
  const emAberto = (it: ContaAberta) => !!it.vencimentoOriginal;

  const itensDoDiaSelecionado = diaSelecionado
    ? {
        receber: (receberPorDia.get(diaSelecionado) ?? []).filter(emAberto),
        pagar: (pagarPorDia.get(diaSelecionado) ?? []).filter(emAberto),
        recebido: recebidoPorDia.get(diaSelecionado) ?? [],
        pago: pagoPorDia.get(diaSelecionado) ?? [],
      }
    : null;

  // Monta os chips de um dia: vencidos primeiro, depois agendados, depois
  // conciliados — no máximo 3 visíveis, o resto vira "+N mais" (abre o modal
  // do dia, que já lista tudo).
  function chipsDoDia(chave: string): { visiveis: ChipDia[]; restantes: number } {
    const receberDia = (receberPorDia.get(chave) ?? []).filter(emAberto).filter((it) => bateBusca(`${it.pessoa} ${it.categoria}`, buscaCalendario));
    const pagarDia = (pagarPorDia.get(chave) ?? []).filter(emAberto).filter((it) => bateBusca(`${it.pessoa} ${it.categoria}`, buscaCalendario));
    const recebidoDia = (recebidoPorDia.get(chave) ?? []).filter((c) => bateBusca(`${c.pessoa} ${c.categoria}`, buscaCalendario));
    const pagoDia = (pagoPorDia.get(chave) ?? []).filter((c) => bateBusca(`${c.pessoa} ${c.categoria}`, buscaCalendario));

    const abertos: ChipDia[] = [...receberDia, ...pagarDia].map((it) => ({
      key: `${it.tipo}-${it.id}`,
      label: it.pessoa,
      valor: it.valor,
      cor: it.status === 'Vencida' ? 'red' : it.tipo === 'receber' ? 'emerald' : 'amber',
      Icon: it.status === 'Vencida' ? AlertTriangle : it.tipo === 'receber' ? TrendingUp : Building2,
      item: it,
    }));
    const conciliados: ChipDia[] = [...recebidoDia, ...pagoDia].map((c) => ({
      key: `conc-${c.tipo}-${c.id}`,
      label: c.pessoa,
      valor: c.valor,
      cor: 'sky',
      Icon: CheckCircle2,
    }));

    const ordenados = [...abertos.filter((c) => c.cor === 'red'), ...abertos.filter((c) => c.cor !== 'red'), ...conciliados];
    return { visiveis: ordenados.slice(0, 3), restantes: Math.max(0, ordenados.length - 3) };
  }

  // ---- Relatório Detalhado do dia (entrou/saiu + composição de Matéria Prima) ----
  // Tela cheia própria (view === 'relatorio-detalhado'), com "Voltar ao Painel".
  const [view, setView] = useState<'painel' | 'relatorio-detalhado'>('painel');

  // ---- Previsão de fluxo de caixa com IA ----
  const [previsaoIAAberta, setPrevisaoIAAberta] = useState(false);
  const [previsaoIATexto, setPrevisaoIATexto] = useState<string | null>(null);
  const [previsaoIACarregando, setPrevisaoIACarregando] = useState(false);
  const [previsaoIAErro, setPrevisaoIAErro] = useState<string | null>(null);

  function abrirPrevisaoIA() {
    setPrevisaoIAAberta(true);
    setPrevisaoIATexto(null);
    setPrevisaoIAErro(null);
    setPrevisaoIACarregando(true);
    fetch(`/api/financeiro/previsao-ia?mes=${mesKey}`)
      .then(async (res) => {
        const data = await res.json();
        if (!res.ok) throw new Error(data?.error || 'Falha ao gerar previsão com IA');
        return data as { previsao: string; geradoEm: string };
      })
      .then((data) => setPrevisaoIATexto(data.previsao))
      .catch((err) => setPrevisaoIAErro(err.message || 'Falha ao gerar previsão com IA'))
      .finally(() => setPrevisaoIACarregando(false));
  }

  const nomeMesSelecionado = NOMES_MES[mesSelecionado.mes];

  if (view === 'relatorio-detalhado') {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={() => setView('painel')}
            className="flex items-center gap-2 px-3 py-2 rounded-full bg-white border border-neutral-200 text-neutral-600 hover:text-yellow-600 hover:border-yellow-400 text-xs font-semibold transition-all"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Voltar ao Painel</span>
          </button>
          <button
            type="button"
            onClick={baixarRelatorioDetalhadoPdf}
            disabled={!resumo}
            className="flex items-center gap-1.5 px-4 py-2 rounded-full bg-yellow-400 text-black font-extrabold text-xs hover:bg-yellow-300 shadow-sm active:scale-95 disabled:opacity-40 transition-all"
          >
            <FileDown className="w-3.5 h-3.5" aria-hidden="true" />
            Baixar PDF
          </button>
        </div>

        <div>
          <span className="text-xs font-bold uppercase tracking-widest text-yellow-600">Financeiro • Relatório Detalhado</span>
          <h1 className="text-2xl font-black text-neutral-900 mt-1 flex items-center gap-2">
            <FileText className="w-6 h-6 text-yellow-600" aria-hidden="true" />
            {diaReferenciaEhHoje ? 'Hoje' : labelDiaReferencia} — {nomeMesSelecionado} {mesSelecionado.ano}
          </h1>
          <p className="text-neutral-500 text-sm mt-1">Tudo que entrou, tudo que saiu e a composição da Matéria Prima nesse dia.</p>
        </div>

        <div className="rounded-3xl bg-white border border-neutral-200 p-6 space-y-6">
          <RelatorioDetalhadoConteudo
            recebidoHoje={recebidoHoje}
            totalRecebidoHoje={totalRecebidoHoje}
            pagoHoje={pagoHoje}
            totalPagoHoje={totalPagoHoje}
            valorMateriaPrimaHoje={valorMetaMateriaPrimaHoje}
            composicaoMateriaPrima={COMPOSICAO_MATERIA_PRIMA}
            layout="tela"
          />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-neutral-900 uppercase tracking-tight">Planejamento Financeiro</h1>
          <p className="text-neutral-500 text-sm mt-1">Arraste os lançamentos da fila para o dia em que devem ser pagos ou recebidos.</p>
        </div>

        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 w-full lg:w-auto">
          <div className="relative w-full sm:w-80 shrink-0">
            <Search className="w-3.5 h-3.5 text-neutral-400 absolute left-3 top-1/2 -translate-y-1/2" aria-hidden="true" />
            <input
              type="text"
              value={buscaCalendario}
              onChange={(e) => setBuscaCalendario(e.target.value)}
              placeholder="Buscar lançamento agendado no calendário..."
              className="w-full pl-8 pr-3 py-2 rounded-full bg-white border border-neutral-200 text-xs text-neutral-800 placeholder-neutral-400 focus:outline-none focus:border-yellow-400"
            />
          </div>
          <div className="relative w-full sm:w-48 shrink-0">
            <Calendar className="w-3.5 h-3.5 text-neutral-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none z-10" aria-hidden="true" />
            <input
              type="date"
              value={filtroDia}
              onChange={(e) => irParaDia(e.target.value)}
              aria-label="Ir para um dia específico"
              title="Escolher um dia para visualizar"
              className="w-full pl-8 pr-3 py-2 rounded-full bg-white border border-neutral-200 text-xs text-neutral-800 focus:outline-none focus:border-yellow-400"
            />
          </div>
        </div>
      </div>

      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex items-center gap-1.5 bg-neutral-50 p-1 rounded-full border border-neutral-200">
          <button type="button" onClick={() => mudarMes(-1)} aria-label="Mês anterior" className="w-8 h-8 flex items-center justify-center rounded-full text-neutral-500 hover:text-yellow-600 hover:bg-neutral-100 transition-all">
            <ChevronLeft className="w-4 h-4" />
          </button>
          <span className="px-2 text-xs font-black text-neutral-900 min-w-[104px] text-center">{nomeMesSelecionado} {mesSelecionado.ano}</span>
          <button type="button" onClick={() => mudarMes(1)} aria-label="Próximo mês" className="w-8 h-8 flex items-center justify-center rounded-full text-neutral-500 hover:text-yellow-600 hover:bg-neutral-100 transition-all">
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
        <button type="button" onClick={irParaHoje} disabled={noMesAtual} className="px-3.5 py-2 rounded-full border border-neutral-200 bg-white text-xs font-bold text-neutral-600 hover:border-yellow-400 hover:text-yellow-600 disabled:opacity-40 transition-all">
          Hoje
        </button>
        <button type="button" onClick={atualizarManualmente} disabled={carregando} className="flex items-center gap-1.5 px-3.5 py-2 rounded-full border border-neutral-200 bg-white text-xs font-bold text-neutral-600 hover:border-yellow-400 hover:text-yellow-600 disabled:opacity-40 transition-all">
          <RefreshCw className={`w-3.5 h-3.5 ${carregando ? 'animate-spin' : ''}`} aria-hidden="true" />
          Atualizar
        </button>
        <button type="button" onClick={baixarRelatorioPdf} disabled={!resumo} className="flex items-center gap-1.5 px-3.5 py-2 rounded-full border border-neutral-200 bg-white text-xs font-bold text-neutral-600 hover:border-yellow-400 hover:text-yellow-600 disabled:opacity-40 transition-all">
          <Printer className="w-3.5 h-3.5" aria-hidden="true" />
          Imprimir relatório
        </button>
        <button
          type="button"
          onClick={() => setView('relatorio-detalhado')}
          disabled={!resumo || !diaReferenciaNoMesExibido}
          title={!diaReferenciaNoMesExibido ? 'Só disponível para dias dentro do mês exibido' : undefined}
          className="flex items-center gap-1.5 px-3.5 py-2 rounded-full border border-neutral-200 bg-white text-xs font-bold text-neutral-600 hover:border-yellow-400 hover:text-yellow-600 disabled:opacity-40 transition-all"
        >
          <FileText className="w-3.5 h-3.5" aria-hidden="true" />
          Relatório Detalhado
        </button>
        <button
          type="button"
          onClick={abrirPrevisaoIA}
          disabled={!resumo}
          className="flex items-center gap-1.5 px-4 py-2 rounded-full bg-emerald-600 text-white font-extrabold text-xs hover:bg-emerald-500 shadow-sm active:scale-95 disabled:opacity-40 transition-all ml-auto"
        >
          <Sparkles className="w-3.5 h-3.5" aria-hidden="true" />
          Gerar previsão com IA
        </button>
      </div>

      {/* Move-mode banner */}
      {itemParaMover && (
        <div className="p-3.5 rounded-2xl bg-yellow-50 border border-yellow-200 flex items-center justify-between gap-3 flex-wrap">
          <span className="text-xs font-semibold text-yellow-700 flex items-center gap-2">
            <Move className="w-4 h-4 shrink-0" aria-hidden="true" />
            {movendo ? 'Movendo...' : (
              <>Clique (ou arraste) no dia do calendário pra onde quer mover <strong>{itemParaMover.nome}</strong> ({formatCurrency(itemParaMover.valor)})</>
            )}
          </span>
          <button type="button" onClick={() => setItemParaMover(null)} disabled={movendo} className="px-3 py-1 rounded-full bg-white text-neutral-600 hover:text-neutral-900 text-[11px] font-bold disabled:opacity-40">
            Cancelar
          </button>
        </div>
      )}
      {erroMover && <div className="p-3.5 rounded-2xl bg-red-50 border border-red-200 text-xs text-red-700">{erroMover}</div>}

      {/* Loading / erro states */}
      {carregando && !resumo && (
        <div className="p-10 rounded-3xl bg-white border border-neutral-200 flex flex-col items-center justify-center gap-2 text-neutral-500 text-xs text-center">
          <RefreshCw className="w-5 h-5 animate-spin text-yellow-600" aria-hidden="true" />
          <span>Consultando contas a pagar/receber no Nomus...</span>
          <span className="text-neutral-500 text-[11px] max-w-sm">
            Pode levar alguns minutos na primeira consulta a um mês novo — depois fica em cache por 10 minutos.
          </span>
        </div>
      )}
      {!carregando && erro && !resumo && (
        <div className="p-10 rounded-3xl bg-white border border-neutral-200 flex flex-col items-center justify-center gap-2 text-center">
          <AlertTriangle className="w-5 h-5 text-red-600" aria-hidden="true" />
          <span className="text-red-600 text-xs font-semibold">Não foi possível carregar os dados financeiros</span>
          <span className="text-neutral-500 text-[11px] max-w-sm">{erro}</span>
        </div>
      )}
      {erro && resumo && (
        <div className="p-3.5 rounded-2xl bg-red-50 border border-red-200 flex items-center gap-2 text-xs text-red-700">
          <AlertTriangle className="w-4 h-4 shrink-0" aria-hidden="true" />
          <span>Não foi possível atualizar para {nomeMesSelecionado}: {erro}</span>
        </div>
      )}

      {resumo && (
        <div className={carregando ? 'opacity-50 pointer-events-none transition-opacity space-y-6' : 'transition-opacity space-y-6'}>
          {/* KPI cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-5 gap-4">
            <div className="rounded-2xl bg-white border border-neutral-200 p-4 flex items-center gap-2.5">
              <span className="w-9 h-9 shrink-0 rounded-full bg-emerald-50 flex items-center justify-center">
                <TrendingUp className="w-4 h-4 text-emerald-600" aria-hidden="true" />
              </span>
              <div className="flex-1 min-w-0" title={`Recebido de fato (baixado no Nomus) só no dia ${diaReferenciaEhHoje ? 'de hoje' : labelDiaReferencia}`}>
                <span className="text-xs text-neutral-500 block">
                  {diaReferenciaEhHoje ? 'Entrou no Caixa Hoje' : `Entrou no Caixa em ${labelDiaReferencia}`}
                </span>
                <span className="text-base font-black text-emerald-600 tabular-nums block truncate" title={formatCurrency(totalRecebidoHoje)}>
                  {diaReferenciaNoMesExibido ? formatCurrency(totalRecebidoHoje) : '—'}
                </span>
                <span className="text-[10px] text-neutral-400 block truncate">
                  {diaReferenciaNoMesExibido ? `${recebidoHoje.length} lançamento${recebidoHoje.length === 1 ? '' : 's'}` : 'Fora do mês exibido'}
                </span>
              </div>
            </div>

            <div className="rounded-2xl bg-white border border-neutral-200 p-4 flex items-center gap-2.5">
              <span className="w-9 h-9 shrink-0 rounded-full bg-sky-50 flex items-center justify-center">
                <Wallet className="w-4 h-4 text-sky-600" aria-hidden="true" />
              </span>
              <div className="flex-1 min-w-0">
                <span className="text-xs text-neutral-500 block">Saldo do mês</span>
                <span className="text-base font-black text-neutral-900 tabular-nums block truncate" title={formatCurrency(resumo.saldoMes)}>{formatCurrency(resumo.saldoMes)}</span>
                <span className="text-[10px] text-neutral-400 block truncate">Atualizado {new Date(resumo.atualizadoEm).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}</span>
              </div>
              <Sparkline data={saldoAtualArr} color="#0284c7" />
            </div>

            <div className="rounded-2xl bg-white border border-neutral-200 p-4 flex items-center gap-2.5">
              <span className="w-9 h-9 shrink-0 rounded-full bg-emerald-50 flex items-center justify-center">
                <TrendingUp className="w-4 h-4 text-emerald-600" aria-hidden="true" />
              </span>
              <div className="flex-1 min-w-0" title="Saldo total em aberto hoje, não filtrado pelo mês selecionado">
                <span className="text-xs text-neutral-500 block">A receber</span>
                <span className="text-base font-black text-neutral-900 tabular-nums block truncate" title={formatCurrency(resumo.totalReceber)}>{formatCurrency(resumo.totalReceber)}</span>
                <span className="text-[10px] text-neutral-400 block truncate">Total de {contasReceber.length} contas</span>
              </div>
              <Sparkline data={receberPorDiaArr} color="#059669" />
            </div>

            <div className="rounded-2xl bg-white border border-neutral-200 p-4 flex items-center gap-2.5">
              <span className="w-9 h-9 shrink-0 rounded-full bg-red-50 flex items-center justify-center">
                <TrendingDown className="w-4 h-4 text-red-600" aria-hidden="true" />
              </span>
              <div className="flex-1 min-w-0" title="Saldo total em aberto hoje, não filtrado pelo mês selecionado">
                <span className="text-xs text-neutral-500 block">A pagar</span>
                <span className="text-base font-black text-neutral-900 tabular-nums block truncate" title={formatCurrency(resumo.totalPagar)}>{formatCurrency(resumo.totalPagar)}</span>
                <span className="text-[10px] text-neutral-400 block truncate">Total de {contasPagar.length} contas</span>
              </div>
              <Sparkline data={pagarPorDiaArr} color="#dc2626" />
            </div>

            <div className="rounded-2xl bg-white border border-neutral-200 p-4 flex items-center gap-2.5">
              <span className="w-9 h-9 shrink-0 rounded-full bg-sky-50 flex items-center justify-center">
                <Target className="w-4 h-4 text-sky-600" aria-hidden="true" />
              </span>
              <div className="flex-1 min-w-0">
                <span className="text-xs text-neutral-500 block">Saldo projetado</span>
                <span className={`text-base font-black tabular-nums block truncate ${saldoProjetado >= 0 ? 'text-neutral-900' : 'text-red-600'}`} title={formatCurrency(saldoProjetado)}>{formatCurrency(saldoProjetado)}</span>
                <span className="text-[10px] text-neutral-400 block truncate">Ao final de {nomeMesSelecionado}</span>
              </div>
              <Sparkline data={saldoProjetadoArr} color="#4f46e5" />
            </div>
          </div>

          {/* KPIs "Resultado do Dia" — regra 70/20/10 (Matéria Prima / Custo Fixo / Lucro) */}
          <div className="space-y-2">
            <h3 className="text-xs font-black uppercase tracking-wider text-neutral-500" title={`Percentuais calculados sobre a receita do dia ${diaReferenciaEhHoje ? 'de hoje' : labelDiaReferencia} (Entrou no Caixa); Matéria Prima e Custo Fixo vêm do que está programado pra pagar nesse dia no Nomus`}>
              Resultado do Dia — Meta 70/20/10{!diaReferenciaEhHoje && ` (${labelDiaReferencia})`}
            </h3>
            {!diaReferenciaNoMesExibido ? (
              <div className="rounded-2xl bg-white border border-neutral-200 p-4">
                <span className="text-xs text-neutral-400">Só disponível para dias dentro do mês exibido.</span>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                {([
                  { titulo: 'Matéria Prima', meta: 70, atual: pctMateriaPrimaHoje, valor: totalMateriaPrimaHoje, valorMes: totalMateriaPrimaMes, atualMes: pctMateriaPrimaMes, tipoCusto: true, barra: '#d97706', Icon: Package, bg: 'bg-amber-50', texto: 'text-amber-600' },
                  { titulo: 'Custo Fixo', meta: 20, atual: pctCustoFixoHoje, valor: totalCustoFixoHoje, valorMes: totalCustoFixoMes, atualMes: pctCustoFixoMes, tipoCusto: true, barra: '#0284c7', Icon: Building2, bg: 'bg-sky-50', texto: 'text-sky-600' },
                  { titulo: 'Lucro', meta: 10, atual: pctLucroHoje, valor: totalLucroHoje, valorMes: totalLucroMes, atualMes: pctLucroMes, tipoCusto: false, barra: '#059669', Icon: PiggyBank, bg: 'bg-emerald-50', texto: 'text-emerald-600' },
                ] as const).map((k) => {
                  const dentroDaMeta = k.tipoCusto ? k.atual <= k.meta : k.atual >= k.meta;
                  const corTexto = totalRecebidoHoje === 0 ? 'text-neutral-400' : dentroDaMeta ? 'text-emerald-600' : 'text-red-600';
                  // Meta em R$ — fatia fixa (70/20/10%) da receita do dia, não o
                  // valor realmente gasto/lucrado (esse vai na legenda abaixo).
                  const valorMeta = (k.meta / 100) * totalRecebidoHoje;
                  return (
                    <div key={k.titulo} className="relative rounded-2xl bg-white border border-neutral-200 p-4 pl-5 overflow-hidden">
                      <span className="absolute left-0 top-0 bottom-0 w-1" style={{ backgroundColor: k.barra }} aria-hidden="true" />
                      <div className="flex items-center justify-between gap-2">
                        <span className="flex items-center gap-2 min-w-0">
                          <span className={`w-8 h-8 shrink-0 rounded-full flex items-center justify-center ${k.bg}`}>
                            <k.Icon className={`w-4 h-4 ${k.texto}`} aria-hidden="true" />
                          </span>
                          <span className="text-xs font-bold text-neutral-600 truncate">{k.titulo}</span>
                        </span>
                        <span className="shrink-0 px-2 py-0.5 rounded-full border border-neutral-200 text-[10px] font-bold text-neutral-500">Meta {k.meta}%</span>
                      </div>
                      <span className={`text-xl font-black tabular-nums block mt-2.5 ${corTexto}`} title={`${k.meta}% da receita do dia (${formatCurrency(totalRecebidoHoje)})`}>
                        {totalRecebidoHoje > 0 ? formatCurrency(valorMeta) : '—'}
                      </span>
                      <div className="h-1.5 rounded-full bg-neutral-100 overflow-hidden mt-2">
                        <div
                          className="h-full rounded-full transition-all"
                          style={{ width: `${Math.max(0, Math.min(100, k.atual))}%`, backgroundColor: k.barra }}
                        />
                      </div>
                      <span className="text-[10px] text-neutral-400 block mt-1.5 truncate" title={`Realizado no mês (${nomeMesSelecionado}): ${formatCurrency(k.valorMes)} de ${formatCurrency(totalRecebidoMes)} recebidos no mês (${totalRecebidoMes > 0 ? k.atualMes.toFixed(1) : '0'}% da receita)`}>
                        Realizado no mês: {formatCurrency(k.valorMes)} ({totalRecebidoMes > 0 ? `${k.atualMes.toFixed(1)}%` : '—'})
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Pendências + Calendário */}
          <div className="grid grid-cols-1 xl:grid-cols-[320px_1fr] gap-6">
            {/* Sidebar — fila de pendências arrastável */}
            <div className="rounded-[2rem] bg-white border border-neutral-200 p-4 sm:p-5 space-y-3 xl:max-h-[760px] xl:overflow-hidden xl:flex xl:flex-col">
              <div className="flex items-center justify-between gap-2">
                <h3 className="text-sm font-black text-neutral-900 flex items-center gap-2">
                  <Inbox className="w-4 h-4 text-yellow-600" aria-hidden="true" />
                  Pendências Financeiras
                </h3>
                <span className="w-7 h-7 shrink-0 flex items-center justify-center rounded-full bg-yellow-400 text-black text-[11px] font-black">
                  {pendencias.length}
                </span>
              </div>

              <div className="relative">
                <Search className="w-3.5 h-3.5 text-neutral-400 absolute left-3 top-1/2 -translate-y-1/2" aria-hidden="true" />
                <input
                  type="text"
                  value={buscaPendencias}
                  onChange={(e) => setBuscaPendencias(e.target.value)}
                  placeholder="Buscar fornecedor, cliente ou descrição..."
                  className="w-full pl-8 pr-3 py-2 rounded-full bg-neutral-50 border border-neutral-200 text-xs text-neutral-800 placeholder-neutral-400 focus:outline-none focus:border-yellow-400"
                />
              </div>

              <div className="relative">
                <select
                  value={filtroGrupo}
                  onChange={(e) => setFiltroGrupo(e.target.value)}
                  className="w-full appearance-none pl-3.5 pr-8 py-2 rounded-full bg-neutral-50 border border-neutral-200 text-xs font-semibold text-neutral-700 focus:outline-none focus:border-yellow-400 cursor-pointer"
                >
                  <option value="">Todos os grupos ({pendencias.length})</option>
                  {opcoesGrupo.map((g) => (
                    <option key={g} value={g}>{g}</option>
                  ))}
                </select>
                <ChevronDown className="w-3.5 h-3.5 text-neutral-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              </div>

              <div className="flex items-center justify-between gap-2 flex-wrap">
                <span className="text-[10px] text-neutral-400">Atualizado às {new Date(resumo.atualizadoEm).toLocaleTimeString('pt-BR')}</span>
                {atrasadasOcultas > 0 && (
                  <span className="text-[10px] text-neutral-400" title="Atrasos com mais de 30 dias não entram nessa fila, pra não virar ruído">
                    +{atrasadasOcultas} atrasada{atrasadasOcultas === 1 ? '' : 's'} há mais de {LIMITE_DIAS_ATRASO} dias (ocultas)
                  </span>
                )}
              </div>

              <div className="space-y-4 xl:flex-1 xl:min-h-0 xl:overflow-y-auto xl:pr-1">
                {pendenciasFiltradas.length === 0 && (
                  <p className="text-neutral-500 text-xs py-8 text-center">Nenhuma pendência encontrada.</p>
                )}
                {gruposOrdenados.map((grupo) => {
                  const itensDoGrupo = pendenciasPorGrupo.get(grupo) ?? [];
                  return (
                    <div key={grupo} className="space-y-2">
                      <h4 className="flex items-center justify-between gap-2 text-[10px] font-black uppercase tracking-wider text-neutral-500 sticky top-0 bg-white/95 backdrop-blur-sm py-1">
                        <span className="truncate">{grupo}</span>
                        <span className="shrink-0 text-neutral-400">{itensDoGrupo.length}</span>
                      </h4>
                      {itensDoGrupo.map((it) => {
                        const vencida = it.status === 'Vencida';
                        const prazo = descreverPrazo(it.vencimento);
                        return (
                          <div
                            key={`${it.tipo}-${it.id}`}
                            {...draggableProps(it)}
                            className="p-3.5 rounded-2xl bg-neutral-50 border border-neutral-100 space-y-2 cursor-grab active:cursor-grabbing hover:border-yellow-300 transition-all"
                          >
                            <div className="flex items-center justify-between gap-2">
                              <span className={`w-7 h-7 shrink-0 rounded-lg flex items-center justify-center ${vencida ? 'bg-red-50 text-red-600' : it.tipo === 'pagar' ? 'bg-amber-50 text-amber-600' : 'bg-emerald-50 text-emerald-600'}`}>
                                {vencida ? <AlertTriangle className="w-3.5 h-3.5" /> : it.tipo === 'pagar' ? <Building2 className="w-3.5 h-3.5" /> : <User className="w-3.5 h-3.5" />}
                              </span>
                              <span className={`px-2 py-0.5 rounded-full border text-[9px] font-bold ${vencida ? BADGE_STYLE.vencido : it.tipo === 'pagar' ? BADGE_STYLE.pagar : BADGE_STYLE.receber}`}>
                                {vencida ? 'VENCIDO' : it.tipo === 'pagar' ? 'A PAGAR' : 'A RECEBER'}
                              </span>
                            </div>
                            <div className="min-w-0">
                              <span className="font-bold text-neutral-900 text-xs truncate block" title={it.pessoa}>{it.pessoa}</span>
                              <span className="text-[10px] text-neutral-500 truncate block" title={it.categoria}>{it.categoria}</span>
                              <span className={`text-[10px] font-semibold ${prazo.cor}`}>{prazo.texto}</span>
                            </div>
                            <div className="flex items-center justify-between gap-2">
                              <span className="font-mono font-bold text-xs text-neutral-900">{formatCurrency(it.valor)}</span>
                              <button
                                type="button"
                                onClick={() => iniciarMover({ id: it.id, tipo: it.tipo, nome: it.pessoa, valor: it.valor, vencimentoOriginal: it.vencimento })}
                                className="px-3 py-1 rounded-full bg-white border border-neutral-200 text-[10px] font-bold text-neutral-600 hover:border-yellow-400 hover:text-yellow-600 transition-all"
                              >
                                Agendar
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Calendário */}
            <div className="rounded-[2rem] bg-white border border-neutral-200 p-4 sm:p-5 space-y-3">
              <div className="grid grid-cols-7 gap-1.5 sm:gap-2">
                {DIAS_SEMANA.map((d) => (
                  <div key={d} className="text-center text-[10px] font-bold text-neutral-500 uppercase tracking-wider py-1.5">{d}</div>
                ))}

                {dias.map((dia) => {
                  const chave = chaveDia(dia);
                  const doMes = dia.getMonth() === mesSelecionado.mes;
                  const isHoje = chave === chaveHoje;
                  const { visiveis, restantes } = chipsDoDia(chave);
                  const arrastandoSobre = diaArrastandoSobre === chave;

                  // Clicar em QUALQUER lugar do dia (célula vazia, chip ou "+N
                  // mais") abre o modal com tudo daquele dia — ou, em modo de
                  // mover, completa o replanejamento pra esse dia.
                  const abrirDia = () => {
                    if (itemParaMover) {
                      moverParaDia(dia);
                      return;
                    }
                    setDiaSelecionado(chave);
                  };

                  return (
                    <div
                      key={chave}
                      onDragOver={(e) => e.preventDefault()}
                      onDragEnter={() => setDiaArrastandoSobre(chave)}
                      onDragLeave={() => setDiaArrastandoSobre((atual) => (atual === chave ? null : atual))}
                      onDrop={(e) => onDropDia(e, dia)}
                      onClick={abrirDia}
                      className={`min-h-[92px] sm:min-h-[112px] rounded-xl border p-1.5 sm:p-2 flex flex-col gap-1 text-left transition-all cursor-pointer ${
                        !doMes ? 'border-neutral-100 bg-neutral-50 opacity-40' : 'border-neutral-200 bg-white'
                      } ${arrastandoSobre ? 'border-yellow-400 bg-yellow-400/10 ring-1 ring-yellow-400/30' : ''} ${
                        itemParaMover ? 'hover:border-yellow-400/60' : 'hover:border-yellow-300/60'
                      }`}
                    >
                      <span className={`w-5 h-5 flex items-center justify-center text-[11px] font-bold rounded-full ${isHoje ? 'bg-sky-600 text-white' : doMes ? 'text-neutral-700' : 'text-neutral-400'}`}>
                        {dia.getDate()}
                      </span>
                      <div className="flex flex-col gap-1 w-full flex-1 min-h-0">
                        {visiveis.map((chip) => (
                          <button
                            key={chip.key}
                            type="button"
                            draggable={!!chip.item}
                            onDragStart={chip.item ? draggableProps(chip.item).onDragStart : undefined}
                            title={`${chip.label} — ${formatCurrency(chip.valor)}`}
                            className={`flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[9px] sm:text-[10px] font-semibold truncate border transition-all ${CHIP_STYLE[chip.cor]} ${
                              chip.item ? 'cursor-grab active:cursor-grabbing' : 'cursor-pointer'
                            }`}
                          >
                            <chip.Icon className="w-2.5 h-2.5 shrink-0" />
                            <span className="truncate">{chip.label}</span>
                          </button>
                        ))}
                        {restantes > 0 && (
                          <span className="text-[9px] font-bold text-neutral-500 text-left">
                            +{restantes} mais
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Legenda */}
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 pt-2 border-t border-neutral-100 text-[10px] text-neutral-500">
                <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0" />A receber</span>
                <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-amber-500 shrink-0" />A pagar (em dia)</span>
                <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-red-500 shrink-0" />Vencido</span>
                <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-sky-500 shrink-0" />Conciliado</span>
                <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full border border-neutral-300 shrink-0" />Arraste para agendar</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal de detalhe do dia */}
      {diaSelecionado && itensDoDiaSelecionado && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm" onClick={() => setDiaSelecionado(null)}>
          <div className="w-full max-w-lg max-h-[85vh] overflow-y-auto rounded-[2rem] bg-white border border-neutral-200 p-6 space-y-5 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-start justify-between gap-4">
              <div>
                <span className="text-xs font-bold uppercase tracking-widest text-yellow-600">Movimentações do Dia</span>
                <h2 className="text-xl font-black text-neutral-900 mt-1">
                  {parseDataBr(`${diaSelecionado.split('-')[2]}/${diaSelecionado.split('-')[1]}/${diaSelecionado.split('-')[0]}`).toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' })}
                </h2>
              </div>
              <button type="button" onClick={() => setDiaSelecionado(null)} aria-label="Fechar" className="w-8 h-8 shrink-0 flex items-center justify-center rounded-full bg-neutral-100 text-neutral-500 hover:text-neutral-900 transition-all">
                <X className="w-4 h-4" />
              </button>
            </div>

            {itensDoDiaSelecionado.receber.length === 0 &&
              itensDoDiaSelecionado.pagar.length === 0 &&
              itensDoDiaSelecionado.recebido.length === 0 &&
              itensDoDiaSelecionado.pago.length === 0 && (
                <p className="text-neutral-500 text-xs py-6 text-center">Nenhuma movimentação nesse dia.</p>
              )}

            {(['receber', 'pagar'] as TipoConta[]).map((tipo) => {
              const itens = itensDoDiaSelecionado[tipo];
              if (itens.length === 0) return null;
              const cor = tipo === 'receber' ? 'emerald' : 'red';
              return (
                <div key={tipo} className="space-y-2">
                  <h3 className={`flex items-center gap-2 text-xs font-extrabold uppercase tracking-wider ${cor === 'emerald' ? 'text-emerald-600' : 'text-red-600'}`}>
                    {tipo === 'receber' ? <TrendingUp className="w-3.5 h-3.5" /> : <TrendingDown className="w-3.5 h-3.5" />}
                    {tipo === 'receber' ? 'A Receber' : 'A Pagar'}
                  </h3>
                  {itens.map((c) => (
                    <div key={c.id} className="p-3.5 rounded-2xl bg-neutral-50 border border-neutral-100 flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <span className="font-bold text-neutral-900 text-xs truncate block">{c.pessoa}</span>
                        <span className="text-[10px] text-neutral-500 truncate block">{c.categoria}</span>
                        {c.vencimentoOriginal && <span className="text-[9px] text-yellow-600/80">Replanejada — original: {c.vencimentoOriginal}</span>}
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        <span className={`font-mono font-bold text-xs ${cor === 'emerald' ? 'text-emerald-600' : 'text-red-600'}`}>{formatCurrency(c.valor)}</span>
                        {c.vencimentoOriginal ? (
                          <button type="button" title="Desfazer replanejamento" onClick={() => desfazerReprogramacao(c.id, tipo, c.vencimentoOriginal!)} className="w-6 h-6 shrink-0 flex items-center justify-center rounded-full bg-neutral-100 text-neutral-500 hover:text-yellow-600 transition-all">
                            <Undo2 className="w-3.5 h-3.5" />
                          </button>
                        ) : (
                          <button type="button" title="Mover pra outro dia" onClick={() => iniciarMover({ id: c.id, tipo, nome: c.pessoa, valor: c.valor, vencimentoOriginal: c.vencimento })} className="w-6 h-6 shrink-0 flex items-center justify-center rounded-full bg-neutral-100 text-neutral-500 hover:text-yellow-600 transition-all">
                            <Move className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              );
            })}

            {(['recebido', 'pago'] as const).map((tipo) => {
              const itens = itensDoDiaSelecionado[tipo];
              if (itens.length === 0) return null;
              const cor = tipo === 'recebido' ? 'emerald' : 'red';
              return (
                <div key={tipo} className="space-y-2 pt-1 border-t border-neutral-100">
                  <h3 className={`flex items-center gap-2 text-xs font-extrabold uppercase tracking-wider ${cor === 'emerald' ? 'text-emerald-600' : 'text-red-600'}`}>
                    <Wallet className="w-3.5 h-3.5" />
                    Caixa Realizado — {tipo === 'recebido' ? 'Entrou' : 'Saiu'}
                  </h3>
                  {itens.map((c) => (
                    <div key={c.id} className="p-3.5 rounded-2xl bg-neutral-50 border border-neutral-100 flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <span className="font-bold text-neutral-900 text-xs truncate block">{c.pessoa}</span>
                        <span className="text-[10px] text-neutral-500 truncate block">{c.categoria}</span>
                      </div>
                      <span className={`font-mono font-bold text-xs shrink-0 ${cor === 'emerald' ? 'text-emerald-600' : 'text-red-600'}`}>{formatCurrency(c.valor)}</span>
                    </div>
                  ))}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Modal de Previsão com IA */}
      {previsaoIAAberta && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm" onClick={() => setPrevisaoIAAberta(false)}>
          <div className="w-full max-w-lg max-h-[85vh] overflow-y-auto rounded-[2rem] bg-white border border-neutral-200 p-6 space-y-4 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-start justify-between gap-4">
              <div>
                <span className="text-xs font-bold uppercase tracking-widest text-emerald-600 flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5" aria-hidden="true" />
                  Previsão com IA
                </span>
                <h2 className="text-xl font-black text-neutral-900 mt-1">{nomeMesSelecionado} {mesSelecionado.ano}</h2>
              </div>
              <button type="button" onClick={() => setPrevisaoIAAberta(false)} aria-label="Fechar" className="w-8 h-8 shrink-0 flex items-center justify-center rounded-full bg-neutral-100 text-neutral-500 hover:text-neutral-900 transition-all">
                <X className="w-4 h-4" />
              </button>
            </div>

            {previsaoIACarregando && (
              <div className="py-10 flex flex-col items-center gap-2 text-neutral-500 text-xs text-center">
                <RefreshCw className="w-5 h-5 animate-spin text-emerald-600" aria-hidden="true" />
                <span>Analisando o fluxo de caixa com IA...</span>
              </div>
            )}
            {!previsaoIACarregando && previsaoIAErro && (
              <div className="py-10 flex flex-col items-center gap-2 text-center">
                <AlertTriangle className="w-5 h-5 text-red-600" aria-hidden="true" />
                <span className="text-red-600 text-xs font-semibold">Não foi possível gerar a previsão</span>
                <span className="text-neutral-500 text-[11px] max-w-sm">{previsaoIAErro}</span>
              </div>
            )}
            {!previsaoIACarregando && previsaoIATexto && (
              <p className="text-xs text-neutral-700 leading-relaxed whitespace-pre-line">{previsaoIATexto}</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
