import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AlertTriangle, CalendarDays, ChevronLeft, ChevronRight, Loader2, RefreshCw, Search, Truck } from 'lucide-react';
import { totaisDasLinhas, type EntregaLinha, type RespostaEntregas, type TotaisEntregas } from '../entregas';
import { chaveDia, formatCurrency, formatDataIsoParaBr, formatInteiro, formatMetrosQuadrados } from '../utils/format';

type Modo = 'dia' | 'semana' | 'mes';

const MODOS: Array<{ id: Modo; rotulo: string }> = [
  { id: 'dia', rotulo: 'Dia' },
  { id: 'semana', rotulo: 'Semana' },
  { id: 'mes', rotulo: 'Mês' },
];

const MESES = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
const ERRO_RESPOSTA_INVALIDA = 'O servidor não respondeu como esperado. Atualize a página; se continuar, o servidor ainda não foi atualizado com esta funcionalidade.';
const CHAVE_ARMAZENAMENTO = 'gferro:entregas:v1';
const MAX_RESPOSTAS_GUARDADAS = 6;

// Última resposta de cada período: ao voltar à tela (ou dar F5) ela aparece na hora e atualiza por baixo.
function lerGuardadas(): Map<string, RespostaEntregas> {
  try {
    const entradas = JSON.parse(sessionStorage.getItem(CHAVE_ARMAZENAMENTO) ?? '[]');
    if (!Array.isArray(entradas)) return new Map();
    return new Map(entradas.filter((e): e is [string, RespostaEntregas] => Array.isArray(e) && typeof e[0] === 'string' && Array.isArray(e[1]?.entregas) && !e[1].carregando));
  } catch {
    return new Map();
  }
}
const ultimasRespostas = lerGuardadas();

function guardar(url: string, dados: RespostaEntregas) {
  ultimasRespostas.delete(url);
  ultimasRespostas.set(url, dados);
  while (ultimasRespostas.size > MAX_RESPOSTAS_GUARDADAS) ultimasRespostas.delete(ultimasRespostas.keys().next().value as string);
  try {
    sessionStorage.setItem(CHAVE_ARMAZENAMENTO, JSON.stringify([...ultimasRespostas]));
  } catch {
    // sem armazenamento (modo privado, cota cheia): segue só com a memória
  }
}

async function lerResposta(res: Response) {
  const corpo = await res.json().catch(() => null);
  if (!res.ok) throw new Error(corpo?.error || 'Não foi possível carregar as entregas.');
  if (corpo === null) throw new Error(ERRO_RESPOSTA_INVALIDA);
  return corpo;
}

const somarDias = (data: Date, dias: number) => new Date(data.getFullYear(), data.getMonth(), data.getDate() + dias);
const primeiroDoMes = (data: Date) => new Date(data.getFullYear(), data.getMonth(), 1);
const ultimoDoMes = (data: Date) => new Date(data.getFullYear(), data.getMonth() + 1, 0);

function intervaloDoModo(modo: Modo, referencia: Date): { inicio: string; fim: string } {
  if (modo === 'dia') return { inicio: chaveDia(referencia), fim: chaveDia(referencia) };
  if (modo === 'semana') {
    const domingo = somarDias(referencia, -referencia.getDay());
    return { inicio: chaveDia(domingo), fim: chaveDia(somarDias(domingo, 6)) };
  }
  return { inicio: chaveDia(primeiroDoMes(referencia)), fim: chaveDia(ultimoDoMes(referencia)) };
}

function rotuloPeriodo(inicio: string, fim: string, modo: Modo): string {
  if (modo === 'mes') {
    const [ano, mes] = inicio.split('-').map(Number);
    return `${MESES[mes - 1]} de ${ano}`;
  }
  return inicio === fim ? formatDataIsoParaBr(inicio) : `${formatDataIsoParaBr(inicio)} a ${formatDataIsoParaBr(fim)}`;
}

const formatarValor = (valor: number) => valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const normalizar = (texto: string) => texto.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase();
const plural = (n: number, singular: string, pluralTexto: string) => `${n} ${n === 1 ? singular : pluralTexto}`;
const formatPercentual = (valor: number | null) => (valor === null ? '—' : `${valor.toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 1 })}%`);

class LimiteDeErro extends React.Component<{ children: React.ReactNode }, { falhou: boolean }> {
  // O projeto não tem @types/react, então props/state precisam ser declarados à mão.
  declare props: { children: React.ReactNode };
  state = { falhou: false };
  static getDerivedStateFromError() { return { falhou: true }; }
  render() {
    if (!this.state.falhou) return this.props.children;
    return (
      <div role="alert" className="flex gap-2 p-4 rounded-xl bg-red-50 border border-red-200 text-sm text-red-700">
        <AlertTriangle className="w-5 h-5 shrink-0" aria-hidden="true" />
        Não foi possível exibir as entregas. Atualize a página e tente novamente.
      </div>
    );
  }
}

const Kpi: React.FC<{ titulo: string; valor: string; detalhe: string; classe: string; tituloClasse: string }> = ({ titulo, valor, detalhe, classe, tituloClasse }) => (
  <div className={`rounded-2xl border p-4 ${classe}`}>
    <div className={`text-[11px] font-bold uppercase tracking-wide ${tituloClasse}`}>{titulo}</div>
    <div className="text-2xl font-black text-neutral-900 tabular-nums mt-1">{valor}</div>
    <div className="text-[11px] text-neutral-500 mt-1">{detalhe}</div>
  </div>
);

function Recebimento({ linha }: { linha: EntregaLinha }) {
  const r = linha.recebimento;
  if (!linha.pedidoLido || (linha.pedidoEncontrado && !r)) return <span className="text-neutral-400 text-xs">Lendo...</span>;
  if (!r) return <span className="text-neutral-400 text-xs" title="Pedido não encontrado no Nomus">Sem dados</span>;
  const formas = r.formas.length > 0 ? r.formas.join(', ') : '';
  return (
    <div className="space-y-0.5">
      {r.situacao === 'RECEBIDO' && <div className="font-bold text-emerald-700 whitespace-nowrap">Recebido {formatarValor(r.naEntrega)}</div>}
      {r.situacao === 'PARCIAL' && <div className="font-bold text-amber-700 whitespace-nowrap">Parcial {formatarValor(r.naEntrega)} de {formatarValor(r.cobranca)}</div>}
      {r.situacao === 'A_RECEBER' && <div className="font-bold text-red-700 whitespace-nowrap">A receber {formatarValor(r.cobranca)}</div>}
      {r.situacao === 'PAGO_ANTES' && <div className="font-semibold text-neutral-600 whitespace-nowrap">Pago antes</div>}
      {r.situacao === 'NAO' && <div className="text-neutral-500 text-xs">Sem cobrança na entrega</div>}
      {formas && r.situacao !== 'PAGO_ANTES' && <div className="text-[10px] text-neutral-500">{formas}</div>}
      {r.emAberto !== null && r.emAberto > 0.5 && <div className="text-[10px] text-neutral-500 whitespace-nowrap">falta receber {formatarValor(r.emAberto)} do pedido</div>}
    </div>
  );
}

function Prazo({ linha }: { linha: EntregaLinha }) {
  if (!linha.pedidoLido) return <span className="text-neutral-400 text-xs">Lendo...</span>;
  if (!linha.prazo) return <span className="text-neutral-400">—</span>;
  return (
    <div className="space-y-1">
      <div className="tabular-nums text-neutral-700 whitespace-nowrap">{formatDataIsoParaBr(linha.prazo)}<span className="block text-[10px] text-neutral-400">prazo do Nomus</span></div>
      {linha.situacaoPrazo === 'atrasado' && <span className="inline-block rounded-full bg-red-100 text-red-700 px-2.5 py-0.5 text-[11px] font-bold whitespace-nowrap">Atrasada {plural(linha.diasAtraso, 'dia', 'dias')}</span>}
      {linha.situacaoPrazo === 'no-prazo' && <span className="inline-block rounded-full bg-emerald-100 text-emerald-700 px-2.5 py-0.5 text-[11px] font-bold whitespace-nowrap">{linha.diasAntecipado > 0 ? `No prazo (${linha.diasAntecipado}d antes)` : 'No prazo'}</span>}
      {!linha.primeiraDoPedido && <div className="text-[10px] text-neutral-400">pedido lançado {linha.lancamentosDoPedido}x</div>}
    </div>
  );
}

// Resumo por loja ou por motorista: uma linha por grupo, ordenada por quantidade de entregas.
const Resumo: React.FC<{ titulo: string; grupos: Array<{ nome: string; totais: TotaisEntregas; incompleto: boolean }>; mostrarPontualidade: boolean }> = ({ titulo, grupos, mostrarPontualidade }) => (
  <section className="rounded-2xl border border-neutral-200 bg-white shadow-sm overflow-hidden" aria-label={titulo}>
    <h2 className="text-sm font-black text-neutral-900 px-4 pt-4 pb-2">{titulo}</h2>
    <div className="overflow-x-auto">
      <table className="w-full text-[12px]">
        <thead className="bg-neutral-50 border-y border-neutral-200 text-neutral-600">
          <tr>
            <th scope="col" className="text-left font-bold px-3 py-2">{titulo.replace('Por ', '').replace(/^./, (c) => c.toUpperCase())}</th>
            <th scope="col" className="text-right font-bold px-3 py-2">Entregas</th>
            <th scope="col" className="text-right font-bold px-3 py-2">m²</th>
            <th scope="col" className="text-right font-bold px-3 py-2">Valor</th>
            <th scope="col" className="text-right font-bold px-3 py-2">Recebido na entrega</th>
            {mostrarPontualidade && <th scope="col" className="text-right font-bold px-3 py-2">No prazo</th>}
          </tr>
        </thead>
        <tbody className="divide-y divide-neutral-100">
          {grupos.length === 0 ? (
            <tr><td colSpan={mostrarPontualidade ? 6 : 5} className="px-3 py-6 text-center text-neutral-500">Sem entregas.</td></tr>
          ) : grupos.map(({ nome, totais, incompleto }) => (
            <tr key={nome}>
              <td className="px-3 py-2 font-semibold text-neutral-800">{nome}</td>
              <td className="px-3 py-2 text-right tabular-nums">{formatInteiro(totais.entregas)}</td>
              <td className="px-3 py-2 text-right tabular-nums">{formatInteiro(Math.round(totais.metragem))}</td>
              <td className="px-3 py-2 text-right tabular-nums">{formatCurrency(totais.valorPedidos)}</td>
              <td className="px-3 py-2 text-right tabular-nums" title={incompleto ? 'Parcial: o financeiro de alguns pedidos ainda está sendo lido no Nomus' : undefined}>{formatCurrency(totais.recebidoNaEntrega)}{incompleto ? '*' : ''}</td>
              {mostrarPontualidade && <td className="px-3 py-2 text-right tabular-nums">{formatPercentual(totais.pctNoPrazo)}</td>}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  </section>
);

const EntregasConteudo: React.FC = () => {
  const [modo, setModo] = useState<Modo>('mes');
  const [referencia, setReferencia] = useState<Date>(() => new Date());
  const [dataInicio, setDataInicio] = useState('');
  const [dataFim, setDataFim] = useState('');
  const [resposta, setResposta] = useState<RespostaEntregas | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [atualizando, setAtualizando] = useState(false);
  const [erro, setErro] = useState('');
  const [loja, setLoja] = useState('todas');
  const [motorista, setMotorista] = useState('todos');
  const [busca, setBusca] = useState('');
  const [soSemBaixa, setSoSemBaixa] = useState(false);

  const personalizado = !!dataInicio && !!dataFim;
  const periodoInvalido = personalizado && dataInicio > dataFim;
  const { inicio, fim } = personalizado ? { inicio: dataInicio, fim: dataFim } : intervaloDoModo(modo, referencia);
  const url = `/api/dashboard/entregas?inicio=${inicio}&fim=${fim}`;
  const urlExibida = useRef(url);
  urlExibida.current = url;

  const buscar = useCallback(async (urlBuscada: string, silencioso: boolean, forcar = false) => {
    if (silencioso) setAtualizando(true); else setCarregando(true);
    try {
      const dados: RespostaEntregas = await lerResposta(await fetch(forcar ? `${urlBuscada}&atualizar=1` : urlBuscada));
      if (!Array.isArray(dados?.entregas)) throw new Error(ERRO_RESPOSTA_INVALIDA);
      if (!dados.carregando) guardar(urlBuscada, dados);
      if (urlExibida.current !== urlBuscada) return;
      setResposta(dados);
      setErro('');
    } catch (e: any) {
      if (urlExibida.current === urlBuscada) setErro(e.message);
    } finally {
      if (urlExibida.current === urlBuscada) {
        setCarregando(false);
        setAtualizando(false);
      }
    }
  }, []);

  useEffect(() => {
    if (periodoInvalido) return;
    const guardada = ultimasRespostas.get(url) ?? null;
    setResposta(guardada);
    setErro('');
    setCarregando(guardada === null);
    buscar(url, guardada !== null);
  }, [url, periodoInvalido, buscar]);

  // Enquanto o servidor lê o apontamento ou o Nomus, pergunta de novo em poucos segundos; fora disso, a cada minuto.
  const lendo = !!(resposta?.carregando || resposta?.atualizando || (resposta?.pendentes ?? 0) > 0);
  useEffect(() => {
    if (periodoInvalido) return;
    const espera = setTimeout(() => buscar(urlExibida.current, true), lendo ? 8_000 : 60_000);
    return () => clearTimeout(espera);
  }, [resposta, lendo, periodoInvalido, buscar]);

  const entregas = resposta?.entregas ?? [];
  const lojas = useMemo(() => [...new Set<string>(entregas.map((e) => e.loja))].sort((a, b) => a.localeCompare(b, 'pt-BR')), [entregas]);
  const motoristas = useMemo(() => [...new Set<string>(entregas.map((e) => e.motorista))].sort((a, b) => a.localeCompare(b, 'pt-BR')), [entregas]);

  const selecionadas = useMemo(() => {
    const termo = normalizar(busca.trim());
    return entregas.filter((e) =>
      (loja === 'todas' || e.loja === loja)
      && (motorista === 'todos' || e.motorista === motorista)
      && (!soSemBaixa || e.liberadoNoNomus)
      && (!termo || normalizar(`${e.pedido} ${e.cliente ?? ''} ${e.vendedor ?? ''} ${e.motorista} ${e.loja}`).includes(termo))
    );
  }, [entregas, loja, motorista, soSemBaixa, busca]);

  const totais = useMemo(() => totaisDasLinhas(selecionadas), [selecionadas]);
  // Andamento da leitura do financeiro no Nomus (pedidos distintos): os valores de recebimento já aparecem, somando o que foi
  // lido até agora, e vão crescendo sozinhos até completar.
  const progresso = useMemo(() => {
    const pedidos = new Map<string, boolean>();
    for (const e of selecionadas) {
      if (e.pedidoLido && !e.pedidoEncontrado) continue; // pedido que o Nomus não tem: não há financeiro a ler
      pedidos.set(e.pedido, (pedidos.get(e.pedido) ?? true) && !!e.recebimento);
    }
    const total = pedidos.size;
    const lidos = [...pedidos.values()].filter(Boolean).length;
    return { total, lidos, incompleto: lidos < total };
  }, [selecionadas]);
  const financeiroIncompleto = progresso.incompleto;
  const notaParcial = `parcial: ${progresso.lidos} de ${progresso.total} pedidos lidos no Nomus`;
  // Pedidos entregues no período que ainda constam como Liberados no Nomus (falta dar a baixa).
  const semBaixa = useMemo(() => new Set(entregas.filter((e) => e.liberadoNoNomus).map((e) => e.pedido)).size, [entregas]);

  const agrupar = useCallback((chave: (e: EntregaLinha) => string) => {
    const grupos = new Map<string, EntregaLinha[]>();
    for (const entrega of selecionadas) grupos.set(chave(entrega), [...(grupos.get(chave(entrega)) ?? []), entrega]);
    return [...grupos].map(([nome, linhas]) => ({ nome, totais: totaisDasLinhas(linhas), incompleto: linhas.some((e) => !e.pedidoLido || (e.pedidoEncontrado && !e.recebimento)) })).sort((a, b) => b.totais.entregas - a.totais.entregas || a.nome.localeCompare(b.nome, 'pt-BR'));
  }, [selecionadas]);
  const porLoja = useMemo(() => agrupar((e) => e.loja), [agrupar]);
  const porMotorista = useMemo(() => agrupar((e) => e.motorista), [agrupar]);

  const mover = (passo: number) => setReferencia((atual) => {
    if (modo === 'dia') return somarDias(atual, passo);
    if (modo === 'semana') return somarDias(atual, passo * 7);
    return new Date(atual.getFullYear(), atual.getMonth() + passo, 1);
  });
  const escolherModo = (novo: Modo) => { setModo(novo); setDataInicio(''); setDataFim(''); setReferencia(new Date()); };

  const opcoesMes = useMemo(() => {
    const hoje = new Date();
    return Array.from({ length: 12 }, (_, i) => {
      const d = new Date(hoje.getFullYear(), hoje.getMonth() - i, 1);
      return { valor: chaveDia(d), rotulo: `${MESES[d.getMonth()]} de ${d.getFullYear()}` };
    });
  }, []);

  const consultando = carregando || !!resposta?.carregando;
  const botaoNav = 'flex items-center justify-center w-8 h-8 rounded-full border border-neutral-200 bg-white text-neutral-600 hover:border-yellow-400 hover:text-yellow-600 transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-yellow-400';
  const selectClasse = 'appearance-none rounded-xl border border-neutral-200 bg-white py-2 pl-3.5 pr-8 text-xs font-bold text-neutral-800 shadow-sm cursor-pointer focus:border-yellow-400 focus:outline-none';

  return (
    <div className="space-y-6">
      <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-3">
        <div>
          <span className="text-xs font-bold uppercase tracking-widest text-yellow-600">Dashboard • Entregas</span>
          <h1 className="text-2xl font-black text-neutral-900 mt-1 flex items-center gap-2">
            <Truck className="w-6 h-6 text-yellow-600" aria-hidden="true" />
            Relatório de entregas
          </h1>
          <p className="text-neutral-500 text-sm mt-1">
            Entregas lançadas no apontamento de produção, ligadas ao pedido do Nomus: vendedor, loja, quanto foi recebido na entrega e se o prazo prometido foi cumprido.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <label className="relative block">
            <span className="sr-only">Buscar por pedido, cliente, vendedor ou motorista</span>
            <Search className="w-4 h-4 text-neutral-400 absolute left-3.5 top-1/2 -translate-y-1/2" aria-hidden="true" />
            <input
              type="search"
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder="Buscar pedido, cliente, motorista..."
              className="w-full sm:w-72 rounded-xl border border-neutral-200 bg-white pl-10 pr-4 py-2.5 text-sm outline-none focus:border-yellow-500"
            />
          </label>
          <button
            type="button"
            onClick={() => buscar(url, true, true)}
            disabled={consultando || atualizando || periodoInvalido}
            className="flex items-center gap-1.5 px-3.5 py-2.5 rounded-full border border-neutral-200 bg-white text-xs font-bold text-neutral-600 hover:border-yellow-400 hover:text-yellow-600 disabled:opacity-40 transition-all"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${atualizando || resposta?.atualizando ? 'animate-spin' : ''}`} aria-hidden="true" />
            Atualizar
          </button>
        </div>
      </div>

      <div className="flex items-center gap-3 flex-wrap">
        <div role="group" aria-label="Período" className="flex items-center gap-1 rounded-full bg-white border border-neutral-200 p-1">
          {MODOS.map((m) => {
            const selecionado = !personalizado && modo === m.id;
            return (
              <button
                key={m.id}
                type="button"
                aria-pressed={selecionado}
                onClick={() => escolherModo(m.id)}
                className={`px-3.5 py-1.5 rounded-full text-xs transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-yellow-400 ${selecionado ? 'bg-yellow-400 text-black font-bold' : 'text-neutral-500 font-medium hover:text-neutral-900'}`}
              >
                {m.rotulo}
              </button>
            );
          })}
        </div>

        {!personalizado && (
          <div className="flex items-center gap-2">
            <button type="button" onClick={() => mover(-1)} className={botaoNav} aria-label="Período anterior"><ChevronLeft className="w-4 h-4" aria-hidden="true" /></button>
            <span className="min-w-[150px] text-center text-sm font-bold text-neutral-900">{rotuloPeriodo(inicio, fim, modo)}</span>
            <button type="button" onClick={() => mover(1)} className={botaoNav} aria-label="Próximo período"><ChevronRight className="w-4 h-4" aria-hidden="true" /></button>
          </div>
        )}

        {!personalizado && modo === 'mes' && (
          <label className="relative">
            <span className="sr-only">Mês específico</span>
            <select
              value={chaveDia(primeiroDoMes(referencia))}
              onChange={(e) => { const [a, m] = e.target.value.split('-').map(Number); setReferencia(new Date(a, m - 1, 1)); }}
              className={selectClasse}
            >
              {!opcoesMes.some((o) => o.valor === chaveDia(primeiroDoMes(referencia))) && (
                <option value={chaveDia(primeiroDoMes(referencia))}>{rotuloPeriodo(inicio, fim, 'mes')}</option>
              )}
              {opcoesMes.map((o) => <option key={o.valor} value={o.valor}>{o.rotulo}</option>)}
            </select>
          </label>
        )}

        <div className={`flex flex-wrap items-center gap-1.5 rounded-xl border bg-white p-1 shadow-sm ${personalizado ? 'border-yellow-400' : 'border-neutral-200'}`}>
          <CalendarDays className="ml-1.5 h-3.5 w-3.5 text-yellow-600" aria-hidden="true" />
          <label className="flex items-center gap-1 text-[10px] font-bold text-neutral-500">
            De
            <input type="date" value={dataInicio} max={dataFim || undefined} onChange={(e) => setDataInicio(e.target.value)} className="rounded-lg border border-neutral-200 px-1.5 py-1 text-xs text-neutral-800 focus:border-yellow-400 focus:outline-none" />
          </label>
          <label className="flex items-center gap-1 text-[10px] font-bold text-neutral-500">
            Até
            <input type="date" value={dataFim} min={dataInicio || undefined} onChange={(e) => setDataFim(e.target.value)} className="rounded-lg border border-neutral-200 px-1.5 py-1 text-xs text-neutral-800 focus:border-yellow-400 focus:outline-none" />
          </label>
          {(dataInicio || dataFim) && (
            <button type="button" onClick={() => { setDataInicio(''); setDataFim(''); }} className="px-2 py-1 text-[10px] font-bold text-neutral-500 hover:text-neutral-900">Limpar</button>
          )}
        </div>

        <label className="relative">
          <span className="sr-only">Loja</span>
          <select value={loja} onChange={(e) => setLoja(e.target.value)} className={selectClasse}>
            <option value="todas">Todas as lojas</option>
            {lojas.map((nome) => <option key={nome} value={nome}>{nome}</option>)}
          </select>
        </label>
        <button
          type="button"
          aria-pressed={soSemBaixa}
          onClick={() => setSoSemBaixa((v) => !v)}
          title="Pedidos entregues que ainda estão com status Liberado no Nomus"
          className={`rounded-full border px-3.5 py-2 text-xs font-bold transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-yellow-400 ${soSemBaixa ? 'border-neutral-900 bg-neutral-900 text-white' : 'border-amber-300 bg-amber-50 text-amber-900 hover:border-amber-400'}`}
        >
          Aguardando baixa no Nomus ({semBaixa})
        </button>
        <label className="relative">
          <span className="sr-only">Motorista</span>
          <select value={motorista} onChange={(e) => setMotorista(e.target.value)} className={selectClasse}>
            <option value="todos">Todos os motoristas</option>
            {motoristas.map((nome) => <option key={nome} value={nome}>{nome}</option>)}
          </select>
        </label>
      </div>

      {resposta && !resposta.carregando && (
        <p className="text-[11px] text-neutral-500 -mt-3">
          Entregas do apontamento de {new Date(resposta.atualizadoEm).toLocaleString('pt-BR')}
          {resposta.atualizando ? ' · atualizando...' : ''}
          {(resposta.pendentes ?? 0) > 0 ? ` · lendo o Nomus de ${plural(resposta.pendentes ?? 0, 'entrega', 'entregas')}...` : ''}
        </p>
      )}

      {periodoInvalido && (
        <div role="alert" className="flex gap-2 p-3 rounded-xl bg-yellow-50 border border-yellow-200 text-xs text-yellow-900">
          <AlertTriangle className="w-4 h-4 shrink-0" aria-hidden="true" />
          A data inicial deve ser anterior ou igual à data final.
        </div>
      )}

      {resposta?.erroAtualizacao && !resposta.carregando && (
        <div role="alert" className="flex gap-2 p-3 rounded-xl bg-orange-50 border border-orange-200 text-xs text-orange-900 -mt-2">
          <AlertTriangle className="w-4 h-4 shrink-0" aria-hidden="true" />
          Não foi possível atualizar agora ({resposta.erroAtualizacao}). Mostrando a última leitura, de {new Date(resposta.atualizadoEm).toLocaleString('pt-BR')}; o sistema tenta de novo sozinho.
        </div>
      )}

      {erro && !periodoInvalido && (
        <div role="alert" className="flex gap-2 p-3 rounded-xl bg-red-50 border border-red-200 text-xs text-red-700">
          <AlertTriangle className="w-4 h-4 shrink-0" aria-hidden="true" />
          {erro}
        </div>
      )}

      {consultando && !periodoInvalido ? (
        <div className="rounded-2xl border border-neutral-200 bg-white px-5 py-16 text-center text-sm text-neutral-500">
          <Loader2 className="w-5 h-5 animate-spin inline-block mr-2 text-yellow-600" aria-hidden="true" />
          Lendo as entregas do apontamento... (na primeira vez pode levar alguns minutos; a tela atualiza sozinha)
        </div>
      ) : resposta && !periodoInvalido ? (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
            <Kpi titulo="Entregas" valor={formatInteiro(totais.entregas)} detalhe={plural(totais.pedidos, 'pedido entregue', 'pedidos entregues')} classe="border-yellow-100 bg-yellow-50/60" tituloClasse="text-yellow-800" />
            <Kpi titulo="Metragem" valor={formatMetrosQuadrados(totais.metragem)} detalhe="somando todas as entregas" classe="border-sky-100 bg-sky-50/60" tituloClasse="text-sky-700" />
            <Kpi titulo="Valor dos pedidos" valor={formatCurrency(totais.valorPedidos)} detalhe="cada pedido conta uma vez" classe="border-neutral-200 bg-neutral-50" tituloClasse="text-neutral-700" />
            <Kpi titulo="Recebido na entrega" valor={formatCurrency(totais.recebidoNaEntrega)} detalhe={financeiroIncompleto ? notaParcial : `${plural(totais.comRecebimentoNaEntrega, 'pedido', 'pedidos')} · falta ${formatCurrency(totais.aReceberNaEntrega)} da cobrança`} classe="border-emerald-100 bg-emerald-50/60" tituloClasse="text-emerald-700" />
            <Kpi titulo="Falta receber" valor={formatCurrency(totais.emAberto)} detalhe={financeiroIncompleto ? notaParcial : 'dos pedidos entregues'} classe="border-orange-100 bg-orange-50/60" tituloClasse="text-orange-700" />
            <Kpi titulo="No prazo" valor={formatPercentual(totais.pctNoPrazo)} detalhe={totais.comPrazo > 0 ? `${plural(totais.atrasados, 'atrasado', 'atrasados')} de ${plural(totais.comPrazo, 'pedido', 'pedidos')}` : 'sem prazo no Nomus'} classe="border-red-100 bg-red-50/60" tituloClasse="text-red-700" />
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
            <Resumo titulo="Por loja" grupos={porLoja} mostrarPontualidade />
            <Resumo titulo="Por motorista" grupos={porMotorista} mostrarPontualidade={false} />
          </div>

          <div className="rounded-2xl border border-neutral-200 bg-white shadow-sm overflow-hidden">
            <div className="px-4 pt-4 pb-2 flex items-baseline justify-between gap-3">
              <h2 className="text-sm font-black text-neutral-900">Entregas do período</h2>
              <span className="text-neutral-500 text-[11px]">{plural(selecionadas.length, 'entrega', 'entregas')}</span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[900px] text-[13px]">
                <thead className="bg-neutral-50 border-y border-neutral-200">
                  <tr>
                    <th scope="col" className="text-left px-3 py-3 font-extrabold text-neutral-900">Data</th>
                    <th scope="col" className="text-left px-3 py-3 font-extrabold text-neutral-900">Pedido / Cliente</th>
                    <th scope="col" className="text-left px-3 py-3 font-extrabold text-neutral-900">Motorista</th>
                    <th scope="col" className="text-left px-3 py-3 font-extrabold text-neutral-900">Vendedor / Loja</th>
                    <th scope="col" className="text-right px-3 py-3 font-extrabold text-neutral-900">Valor</th>
                    <th scope="col" className="text-left px-3 py-3 font-extrabold text-neutral-900">Recebimento</th>
                    <th scope="col" className="text-left px-3 py-3 font-extrabold text-neutral-900">Prazo</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-100">
                  {selecionadas.length === 0 ? (
                    <tr><td colSpan={7} className="px-5 py-12 text-center text-neutral-500">{entregas.length === 0 ? 'Nenhuma entrega lançada nesse período.' : 'Nenhuma entrega encontrada para esses filtros.'}</td></tr>
                  ) : selecionadas.map((entrega) => (
                    <tr key={entrega.id} className="hover:bg-neutral-50/60 align-top">
                      <td className="px-3 py-3 whitespace-nowrap tabular-nums text-neutral-700">{formatDataIsoParaBr(entrega.data)}</td>
                      <td className="px-3 py-3 max-w-[220px]">
                        <div className="font-bold text-neutral-900 whitespace-nowrap">{entrega.pedido}</div>
                        <div className="text-[11px] text-neutral-500 line-clamp-2" title={entrega.cliente ?? ''}>{entrega.cliente ?? '—'}</div>
                        {entrega.liberadoNoNomus && <span className="mt-1 inline-block rounded-full bg-amber-100 text-amber-800 px-2 py-0.5 text-[10px] font-bold whitespace-nowrap" title="Entregue, mas o pedido ainda está Liberado no Nomus: falta dar a baixa">Liberado no Nomus</span>}
                      </td>
                      <td className="px-3 py-3 text-neutral-700">
                        <div className="font-semibold">{entrega.motorista}</div>
                        <div className="text-[11px] text-neutral-500">{entrega.caminhao}{entrega.metragem != null ? ` · ${formatMetrosQuadrados(entrega.metragem)}` : ''}</div>
                      </td>
                      <td className="px-3 py-3 text-neutral-700 max-w-[170px]">
                        <div className="line-clamp-2" title={entrega.vendedor ?? ''}>{entrega.vendedor ?? (entrega.pedidoLido ? '—' : 'Lendo...')}</div>
                        <div className="text-[11px] text-neutral-500">{entrega.loja}</div>
                      </td>
                      <td className="px-3 py-3 text-right whitespace-nowrap tabular-nums text-neutral-900">{entrega.valorPedido != null ? formatarValor(entrega.valorPedido) : '—'}</td>
                      <td className="px-3 py-3"><Recebimento linha={entrega} /></td>
                      <td className="px-3 py-3"><Prazo linha={entrega} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      ) : null}
    </div>
  );
};

export const Entregas: React.FC = () => (
  <LimiteDeErro>
    <EntregasConteudo />
  </LimiteDeErro>
);
