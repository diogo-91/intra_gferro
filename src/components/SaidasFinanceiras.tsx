import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AlertTriangle, BarChart3, CalendarDays, ChevronLeft, ChevronRight, Loader2, RefreshCw } from 'lucide-react';
import { GRUPO_SEM_CLASSIFICACAO, type RespostaSaidas, type SaidaGrupo, type SaidaItem } from '../saidasFinanceiras';
import { chaveDia, formatCurrency, formatDataIsoParaBr, formatInteiro } from '../utils/format';

type Modo = 'dia' | 'semana' | 'mes';

const MODOS: Array<{ id: Modo; rotulo: string }> = [
  { id: 'dia', rotulo: 'Dia' },
  { id: 'semana', rotulo: 'Semana' },
  { id: 'mes', rotulo: 'Mês' },
];

const MESES = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];

// Uma cor por posição no ranking; "Sem classificação" fica sempre cinza.
const CORES = ['#f59e0b', '#3b82f6', '#10b981', '#ef4444', '#8b5cf6', '#ec4899', '#14b8a6', '#f97316', '#6366f1', '#84cc16', '#06b6d4', '#a855f7', '#d97706', '#0ea5e9'];
const COR_SEM_CLASSIFICACAO = '#94a3b8';

const ERRO_RESPOSTA_INVALIDA = 'O servidor não respondeu como esperado. Atualize a página; se continuar, o servidor ainda não foi atualizado com esta funcionalidade.';

// Última resposta de cada período: ao voltar a uma tela já vista ela aparece na hora e atualiza por baixo.
const ultimasRespostas = new Map<string, RespostaSaidas>();

async function lerResposta(res: Response) {
  const corpo = await res.json().catch(() => null);
  if (!res.ok) throw new Error(corpo?.error || 'Não foi possível carregar as saídas.');
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

function rotuloPeriodo(inicio: string, fim: string, modo: Modo | 'periodo'): string {
  if (modo === 'mes') {
    const [ano, mes] = inicio.split('-').map(Number);
    return `${MESES[mes - 1]} de ${ano}`;
  }
  return inicio === fim ? formatDataIsoParaBr(inicio) : `${formatDataIsoParaBr(inicio)} a ${formatDataIsoParaBr(fim)}`;
}

const corDoGrupo = (grupo: SaidaGrupo, posicao: number) => (grupo.nome === GRUPO_SEM_CLASSIFICACAO ? COR_SEM_CLASSIFICACAO : CORES[posicao % CORES.length]);
const formatPercentual = (valor: number) => `${valor.toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%`;

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
        Não foi possível exibir as saídas. Atualize a página e tente novamente.
      </div>
    );
  }
}

// Rosca com uma fatia por título da DRE (decorativa: os mesmos números estão na lista ao lado).
const Rosca: React.FC<{ grupos: SaidaGrupo[]; total: number; selecionado: string | null }> = ({ grupos, total, selecionado }) => {
  const raio = 70;
  const circunferencia = 2 * Math.PI * raio;
  let acumulado = 0;
  return (
    <svg viewBox="0 0 200 200" className="w-full max-w-[240px] mx-auto" aria-hidden="true">
      <circle cx="100" cy="100" r={raio} fill="none" stroke="#f5f5f5" strokeWidth="26" />
      {grupos.map((grupo, i) => {
        const tamanho = total > 0 ? (grupo.total / total) * circunferencia : 0;
        const fatia = (
          <circle
            key={grupo.nome}
            cx="100"
            cy="100"
            r={raio}
            fill="none"
            stroke={corDoGrupo(grupo, i)}
            strokeWidth={grupo.nome === selecionado ? 32 : 26}
            strokeDasharray={`${Math.max(tamanho - 1, 0)} ${circunferencia}`}
            strokeDashoffset={-acumulado}
            transform="rotate(-90 100 100)"
            opacity={selecionado && grupo.nome !== selecionado ? 0.45 : 1}
          />
        );
        acumulado += tamanho;
        return fatia;
      })}
      <text x="100" y="94" textAnchor="middle" className="fill-neutral-500" style={{ fontSize: 10, fontWeight: 700 }}>TOTAL PAGO</text>
      <text x="100" y="114" textAnchor="middle" className="fill-neutral-900" style={{ fontSize: 15, fontWeight: 900 }}>{formatCurrency(total)}</text>
    </svg>
  );
};

const BarraItem: React.FC<{ item: SaidaItem; maximo: number; cor: string }> = ({ item, maximo, cor }) => (
  <li className="space-y-1">
    <div className="flex items-baseline justify-between gap-3 text-xs">
      <span className="font-semibold text-neutral-800 truncate" title={item.nome}>{item.nome}</span>
      <span className="shrink-0 tabular-nums font-bold text-neutral-900">{formatCurrency(item.total)}</span>
    </div>
    <div className="h-2 rounded-full bg-neutral-100 overflow-hidden">
      <div className="h-full rounded-full" style={{ width: `${maximo > 0 ? Math.max((item.total / maximo) * 100, 2) : 0}%`, backgroundColor: cor }} />
    </div>
    <div className="text-[10px] text-neutral-400">{formatInteiro(item.quantidade)} {item.quantidade === 1 ? 'pagamento' : 'pagamentos'}</div>
  </li>
);

const SaidasConteudo: React.FC = () => {
  const [modo, setModo] = useState<Modo>('mes');
  const [referencia, setReferencia] = useState<Date>(() => new Date());
  const [dataInicio, setDataInicio] = useState('');
  const [dataFim, setDataFim] = useState('');
  const [resposta, setResposta] = useState<RespostaSaidas | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [atualizando, setAtualizando] = useState(false);
  const [erro, setErro] = useState('');
  const [grupoEscolhido, setGrupoEscolhido] = useState<string | null>(null);

  const personalizado = !!dataInicio && !!dataFim;
  const periodoInvalido = personalizado && dataInicio > dataFim;
  const { inicio, fim } = personalizado ? { inicio: dataInicio, fim: dataFim } : intervaloDoModo(modo, referencia);
  const url = `/api/financeiro/saidas?inicio=${inicio}&fim=${fim}`;
  const urlExibida = useRef(url);
  urlExibida.current = url;

  const buscar = useCallback(async (urlBuscada: string, silencioso: boolean) => {
    if (silencioso) setAtualizando(true); else setCarregando(true);
    try {
      const dados: RespostaSaidas = await lerResposta(await fetch(urlBuscada));
      if (!Array.isArray(dados?.grupos)) throw new Error(ERRO_RESPOSTA_INVALIDA);
      ultimasRespostas.set(urlBuscada, dados);
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

  // Carrega ao abrir/trocar o período e acompanha o Nomus a cada minuto, sem piscar a tela.
  useEffect(() => {
    if (periodoInvalido) return;
    let ativo = true;
    const guardada = ultimasRespostas.get(url) ?? null;
    setResposta(guardada);
    setErro('');
    if (guardada) setCarregando(false);
    buscar(url, guardada !== null);
    const intervalo = setInterval(() => { if (ativo) buscar(url, true); }, 60_000);
    return () => { ativo = false; clearInterval(intervalo); };
  }, [url, periodoInvalido, buscar]);

  const grupos = resposta?.grupos ?? [];
  const grupoAtual = useMemo(() => grupos.find((g) => g.nome === grupoEscolhido) ?? grupos[0] ?? null, [grupos, grupoEscolhido]);
  const posicaoDoAtual = grupoAtual ? grupos.indexOf(grupoAtual) : 0;
  const maiorTotal = grupos[0]?.total ?? 0;
  const ticketMedio = resposta && resposta.quantidade > 0 ? resposta.total / resposta.quantidade : 0;

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

  const botaoNav = 'flex items-center justify-center w-8 h-8 rounded-full border border-neutral-200 bg-white text-neutral-600 hover:border-yellow-400 hover:text-yellow-600 transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-yellow-400';

  return (
    <div className="space-y-6">
      <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-3">
        <div>
          <span className="text-xs font-bold uppercase tracking-widest text-yellow-600">Dashboard • Financeiro</span>
          <h1 className="text-2xl font-black text-neutral-900 mt-1 flex items-center gap-2">
            <BarChart3 className="w-6 h-6 text-yellow-600" aria-hidden="true" />
            Saídas do caixa
          </h1>
          <p className="text-neutral-500 text-sm mt-1">O que mais está sendo pago, agrupado pelos títulos da DRE. Só pagamentos já realizados (dinheiro que saiu).</p>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          {resposta && (
            <span className="text-neutral-500 text-[11px]">Atualizado em {new Date(resposta.atualizadoEm).toLocaleString('pt-BR')}</span>
          )}
          <button
            type="button"
            onClick={() => buscar(url, true)}
            disabled={carregando || atualizando || periodoInvalido}
            className="flex items-center gap-1.5 px-3.5 py-2.5 rounded-full border border-neutral-200 bg-white text-xs font-bold text-neutral-600 hover:border-yellow-400 hover:text-yellow-600 disabled:opacity-40 transition-all"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${atualizando ? 'animate-spin' : ''}`} aria-hidden="true" />
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
              className="appearance-none rounded-xl border border-neutral-200 bg-white py-2 pl-3.5 pr-8 text-xs font-bold text-neutral-800 shadow-sm cursor-pointer focus:border-yellow-400 focus:outline-none"
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
      </div>

      {periodoInvalido && (
        <div role="alert" className="flex gap-2 p-3 rounded-xl bg-yellow-50 border border-yellow-200 text-xs text-yellow-900">
          <AlertTriangle className="w-4 h-4 shrink-0" aria-hidden="true" />
          A data inicial deve ser anterior ou igual à data final.
        </div>
      )}

      {erro && !periodoInvalido && (
        <div role="alert" className="flex gap-2 p-3 rounded-xl bg-red-50 border border-red-200 text-xs text-red-700">
          <AlertTriangle className="w-4 h-4 shrink-0" aria-hidden="true" />
          {erro}
        </div>
      )}

      {carregando && !resposta && !periodoInvalido ? (
        <div className="rounded-2xl border border-neutral-200 bg-white px-5 py-16 text-center text-sm text-neutral-500">
          <Loader2 className="w-5 h-5 animate-spin inline-block mr-2 text-yellow-600" aria-hidden="true" />
          Consultando os pagamentos no Nomus... (na primeira vez de um mês pode levar alguns minutos)
        </div>
      ) : resposta && !periodoInvalido ? (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="rounded-2xl border border-red-100 bg-red-50/60 p-4">
              <div className="text-[11px] font-bold uppercase tracking-wide text-red-700">Total pago</div>
              <div className="text-2xl font-black text-red-800 tabular-nums mt-1">{formatCurrency(resposta.total)}</div>
              <div className="text-[11px] text-neutral-500 mt-1">{formatInteiro(resposta.quantidade)} {resposta.quantidade === 1 ? 'pagamento' : 'pagamentos'}</div>
            </div>
            <div className="rounded-2xl border border-yellow-100 bg-yellow-50/60 p-4">
              <div className="text-[11px] font-bold uppercase tracking-wide text-yellow-800">Maior saída</div>
              <div className="text-lg font-black text-neutral-900 mt-1 truncate" title={grupos[0]?.nome}>{grupos[0]?.nome ?? '—'}</div>
              <div className="text-[11px] text-neutral-500 mt-1">{grupos[0] ? `${formatCurrency(grupos[0].total)} · ${formatPercentual(grupos[0].percentual)} do total` : 'Sem pagamentos no período'}</div>
            </div>
            <div className="rounded-2xl border border-sky-100 bg-sky-50/60 p-4">
              <div className="text-[11px] font-bold uppercase tracking-wide text-sky-700">Valor médio por pagamento</div>
              <div className="text-2xl font-black text-sky-900 tabular-nums mt-1">{formatCurrency(ticketMedio)}</div>
              <div className="text-[11px] text-neutral-500 mt-1">{formatInteiro(grupos.length)} {grupos.length === 1 ? 'título da DRE' : 'títulos da DRE'}</div>
            </div>
          </div>

          {grupos.length === 0 ? (
            <div className="rounded-2xl border border-neutral-200 bg-white px-5 py-16 text-center text-sm text-neutral-500">Nenhum pagamento realizado nesse período.</div>
          ) : (
            <>
              <section className="rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm" aria-label="Saídas por título da DRE">
                <h2 className="text-sm font-black text-neutral-900 mb-4">Para onde foi o dinheiro — por título da DRE</h2>
                <div className="grid grid-cols-1 lg:grid-cols-[260px_1fr] gap-6 items-center">
                  <Rosca grupos={grupos} total={resposta.total} selecionado={grupoAtual?.nome ?? null} />
                  <ul className="space-y-2">
                    {grupos.map((grupo, i) => {
                      const escolhido = grupo.nome === grupoAtual?.nome;
                      return (
                        <li key={grupo.nome}>
                          <button
                            type="button"
                            aria-pressed={escolhido}
                            onClick={() => setGrupoEscolhido(grupo.nome)}
                            className={`w-full text-left rounded-xl border px-3.5 py-2.5 transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-yellow-400 ${escolhido ? 'border-neutral-900 bg-neutral-50' : 'border-neutral-200 bg-white hover:border-neutral-400'}`}
                          >
                            <div className="flex items-baseline justify-between gap-3 text-xs">
                              <span className="flex items-center gap-2 font-bold text-neutral-900 min-w-0">
                                <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: corDoGrupo(grupo, i) }} aria-hidden="true" />
                                <span className="truncate">{grupo.nome}</span>
                              </span>
                              <span className="shrink-0 tabular-nums font-black text-neutral-900">{formatCurrency(grupo.total)} <span className="font-semibold text-neutral-500">· {formatPercentual(grupo.percentual)}</span></span>
                            </div>
                            <div className="h-2 rounded-full bg-neutral-100 overflow-hidden mt-2">
                              <div className="h-full rounded-full" style={{ width: `${maiorTotal > 0 ? Math.max((grupo.total / maiorTotal) * 100, 2) : 0}%`, backgroundColor: corDoGrupo(grupo, i) }} />
                            </div>
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              </section>

              {grupoAtual && (
                <section className="grid grid-cols-1 lg:grid-cols-2 gap-6" aria-label={`Detalhes de ${grupoAtual.nome}`}>
                  <div className="rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm">
                    <h2 className="text-sm font-black text-neutral-900 mb-1">{grupoAtual.nome} — por classificação</h2>
                    <p className="text-[11px] text-neutral-500 mb-4">{formatCurrency(grupoAtual.total)} em {formatInteiro(grupoAtual.quantidade)} {grupoAtual.quantidade === 1 ? 'pagamento' : 'pagamentos'}</p>
                    <ul className="space-y-3">
                      {grupoAtual.categorias.map((categoria) => (
                        <BarraItem key={categoria.nome} item={categoria} maximo={grupoAtual.categorias[0]?.total ?? 0} cor={corDoGrupo(grupoAtual, posicaoDoAtual)} />
                      ))}
                    </ul>
                  </div>
                  <div className="rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm">
                    <h2 className="text-sm font-black text-neutral-900 mb-1">{grupoAtual.nome} — maiores fornecedores</h2>
                    <p className="text-[11px] text-neutral-500 mb-4">Até 10 fornecedores com mais pagamentos neste título</p>
                    <ul className="space-y-3">
                      {grupoAtual.fornecedores.map((fornecedor) => (
                        <BarraItem key={fornecedor.nome} item={fornecedor} maximo={grupoAtual.fornecedores[0]?.total ?? 0} cor={corDoGrupo(grupoAtual, posicaoDoAtual)} />
                      ))}
                    </ul>
                  </div>
                </section>
              )}
            </>
          )}
        </>
      ) : null}
    </div>
  );
};

export const SaidasFinanceiras: React.FC = () => (
  <LimiteDeErro>
    <SaidasConteudo />
  </LimiteDeErro>
);
