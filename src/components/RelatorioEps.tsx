import React, { useCallback, useEffect, useState } from 'react';
import { AlertTriangle, Boxes, Download, Loader2, RefreshCw } from 'lucide-react';
import { PRECOS_EPS, compararEps, custoPlacaInterna, familiaDoTipoEps, somarComparativos, type ComparativoEps, type FamiliaEps } from '../data/precosEps';
import { chaveDia, formatDataIsoParaBr } from '../utils/format';

// Placas de EPS (Dashboard Financeiro): lê os lançamentos do Apontamento de Produção e compara o custo da produção
// interna (blocos usados x preço do bloco) com o que seria pago ao fornecedor pelas mesmas placas. A diferença é o "Caixa 2".

interface Lancamento {
  id: string;
  data: string;
  em: string;
  tipo: string;
  tipoRotulo: string;
  blocos: number;
  placas: number;
  esperado: number;
  diferenca: number;
  colaborador: { nome: string | null; matricula: string | null };
  observacao: string | null;
}
interface Resposta { atualizadoEm: string; desatualizado?: boolean; lancamentos: Lancamento[] }

type Modo = 'hoje' | '7dias' | 'mes' | 'periodo';
const MODOS: Array<{ id: Modo; rotulo: string }> = [
  { id: 'hoje', rotulo: 'Hoje' },
  { id: '7dias', rotulo: 'Últimos 7 dias' },
  { id: 'mes', rotulo: 'Mês' },
  { id: 'periodo', rotulo: 'Período' },
];

const brl = (n: number) => n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const pct = (n: number | null) => (n === null ? '—' : `${(n * 100).toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%`);
const inteiro = (n: number) => n.toLocaleString('pt-BR');
const hora = (iso: string) => new Date(iso).toLocaleTimeString('pt-BR', { timeZone: 'America/Sao_Paulo', hour: '2-digit', minute: '2-digit' });
const somarDias = (d: Date, n: number) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);

function intervalo(modo: Modo, de: string, ate: string): { inicio: string; fim: string } {
  const hoje = new Date();
  if (modo === 'hoje') return { inicio: chaveDia(hoje), fim: chaveDia(hoje) };
  if (modo === '7dias') return { inicio: chaveDia(somarDias(hoje, -6)), fim: chaveDia(hoje) };
  if (modo === 'mes') return { inicio: chaveDia(new Date(hoje.getFullYear(), hoje.getMonth(), 1)), fim: chaveDia(new Date(hoje.getFullYear(), hoje.getMonth() + 1, 0)) };
  return { inicio: de, fim: ate };
}

// Última resposta de cada período: ao voltar para a tela ela aparece na hora e atualiza por baixo.
const ultimas = new Map<string, Resposta>();

/** Positivo (produção interna mais barata) em verde, negativo em vermelho. */
const classeDiferenca = (n: number) => (n > 0 ? 'text-emerald-700' : n < 0 ? 'text-red-700' : 'text-neutral-500');
const sinal = (n: number) => (n > 0 ? '+' : n < 0 ? '−' : '');
const dinheiroComSinal = (n: number) => `${sinal(n)}${brl(Math.abs(n))}`;
const pctComSinal = (n: number | null) => (n === null ? '—' : `${sinal(n)}${pct(n === null ? null : Math.abs(n))}`);

const cabecalho = 'whitespace-nowrap border-b border-neutral-200 px-3 py-2 text-left text-[10.5px] font-extrabold uppercase tracking-wide text-neutral-500';
const celula = 'border-b border-neutral-100 px-3 py-2.5 text-xs text-neutral-800';

export const RelatorioEps: React.FC = () => {
  const hojeTexto = chaveDia(new Date());
  const [modo, setModo] = useState<Modo>('hoje');
  const [de, setDe] = useState(hojeTexto);
  const [ate, setAte] = useState(hojeTexto);
  const { inicio, fim } = intervalo(modo, de, ate);
  const chave = `${inicio}|${fim}`;
  const [dados, setDados] = useState<Resposta | null>(ultimas.get(chave) ?? null);
  const [carregando, setCarregando] = useState(!ultimas.has(chave));
  const [atualizando, setAtualizando] = useState(false);
  const [erro, setErro] = useState('');

  const carregar = useCallback(async (manual = false) => {
    if (!inicio || !fim || inicio > fim) { setErro(inicio > fim ? 'A data inicial passa da data final.' : ''); return; }
    if (manual) setAtualizando(true);
    try {
      const resposta = await fetch(`/api/financeiro/eps?inicio=${inicio}&fim=${fim}`);
      const corpo = await resposta.json().catch(() => null);
      if (!resposta.ok || !corpo || !Array.isArray(corpo.lancamentos)) throw new Error(corpo?.error || 'Não foi possível carregar as placas de EPS.');
      ultimas.set(`${inicio}|${fim}`, corpo);
      setDados(corpo);
      setErro('');
    } catch (e: any) {
      setErro(e.message);
    } finally {
      setCarregando(false);
      setAtualizando(false);
    }
  }, [inicio, fim]);

  useEffect(() => {
    setDados(ultimas.get(chave) ?? null);
    setCarregando(!ultimas.has(chave));
    void carregar();
  }, [chave, carregar]);
  useEffect(() => {
    const t = setInterval(() => { if (!document.hidden) void carregar(); }, 60_000);
    return () => clearInterval(t);
  }, [carregar]);

  const lancamentos = dados?.lancamentos ?? [];
  const comparar = (l: { tipo: string; blocos: number; placas: number }): ComparativoEps => compararEps(familiaDoTipoEps(l.tipo), l.blocos, l.placas);

  // por tipo de placa
  const tipos = new Map<string, { rotulo: string; familia: FamiliaEps; blocos: number; placas: number; esperado: number }>();
  for (const l of lancamentos) {
    const atual = tipos.get(l.tipo) ?? { rotulo: l.tipoRotulo, familia: familiaDoTipoEps(l.tipo), blocos: 0, placas: 0, esperado: 0 };
    atual.blocos += l.blocos; atual.placas += l.placas; atual.esperado += l.esperado;
    tipos.set(l.tipo, atual);
  }
  const linhasTipo = [...tipos.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([id, t]) => ({ id, ...t, ...compararEps(t.familia, t.blocos, t.placas) }));
  const total = somarComparativos(lancamentos.map(comparar));
  const esperadoTotal = lancamentos.reduce((s, l) => s + l.esperado, 0);
  const rendimento = esperadoTotal > 0 ? total.placas / esperadoTotal : null;

  const baixarCsv = () => {
    const esc = (x: unknown) => { const s = String(x ?? ''); return /[;"\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
    const num = (n: number) => n.toFixed(2).replace('.', ',');
    const cab = ['Data', 'Colaborador', 'Tipo', 'Blocos', 'Placas', 'Esperado', 'Custo interno (R$)', 'Valor fornecedor (R$)', 'Diferença - Caixa 2 (R$)', 'Diferença (%)', 'Observação'];
    const linhas = [...lancamentos].sort((a, b) => a.em.localeCompare(b.em)).map((l) => {
      const c = comparar(l);
      return [formatDataIsoParaBr(l.data), l.colaborador.nome ?? '', l.tipoRotulo, l.blocos, l.placas, l.esperado, num(c.custoInterno), num(c.valorFornecedor), num(c.diferenca), c.percentual === null ? '' : (c.percentual * 100).toFixed(1).replace('.', ','), l.observacao ?? ''].map(esc).join(';');
    });
    linhas.push(['TOTAL', '', '', total.blocos, total.placas, esperadoTotal, num(total.custoInterno), num(total.valorFornecedor), num(total.diferenca), total.percentual === null ? '' : (total.percentual * 100).toFixed(1).replace('.', ','), ''].map(esc).join(';'));
    const url = URL.createObjectURL(new Blob(['﻿' + [cab.join(';'), ...linhas].join('\r\n') + '\r\n'], { type: 'text/csv;charset=utf-8' }));
    const link = Object.assign(document.createElement('a'), { href: url, download: `placas-eps-${inicio}-a-${fim}.csv` });
    document.body.append(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 5000);
  };

  const botaoPeriodo = (ativo: boolean) => `rounded-xl border px-5 py-2.5 text-sm font-semibold transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-yellow-400 ${ativo ? 'border-yellow-400 bg-yellow-300 text-neutral-900' : 'border-neutral-200 bg-white text-neutral-700 hover:border-yellow-400'}`;
  const cartao = 'rounded-2xl border border-neutral-200 bg-white p-4 shadow-sm';

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[13px] bg-gradient-to-br from-yellow-200 to-yellow-100 shadow-md shadow-yellow-400/20"><Boxes className="h-[22px] w-[22px] text-yellow-500" aria-hidden="true" /></span>
          <div>
            <span className="text-[10px] font-bold uppercase tracking-[0.12em] text-neutral-500">Dashboard › Financeiro › <b className="text-neutral-900">Placas de EPS</b></span>
            <h1 className="text-[22px] font-black leading-tight tracking-tight text-neutral-900">Placas de EPS</h1>
            <p className="mt-1 max-w-3xl text-xs leading-snug text-neutral-500">Blocos usados e placas produzidas (lançadas no Apontamento de Produção), com o custo da produção interna contra o preço de compra no fornecedor.</p>
          </div>
        </div>
        <button type="button" onClick={() => void carregar(true)} className="inline-flex items-center gap-1.5 rounded-xl border border-neutral-200 bg-white px-3.5 py-2 text-xs font-bold text-neutral-700 hover:border-yellow-400 hover:bg-yellow-50">
          <RefreshCw className={`h-3.5 w-3.5 ${atualizando ? 'animate-spin' : ''}`} aria-hidden="true" /> Atualizar
        </button>
      </div>

      <div className="flex flex-wrap items-center gap-2.5">
        {MODOS.map((m) => <button key={m.id} type="button" onClick={() => setModo(m.id)} aria-pressed={modo === m.id} className={botaoPeriodo(modo === m.id)}>{m.rotulo}</button>)}
        {modo === 'periodo' && (
          <div className="flex items-center gap-2 text-xs text-neutral-500">
            <input type="date" value={de} max={ate} onChange={(e) => setDe(e.target.value)} aria-label="Data inicial" className="h-10 rounded-xl border border-neutral-200 bg-white px-2.5 text-xs text-neutral-800 focus:border-yellow-400 focus:outline-none" />
            até
            <input type="date" value={ate} min={de} onChange={(e) => setAte(e.target.value)} aria-label="Data final" className="h-10 rounded-xl border border-neutral-200 bg-white px-2.5 text-xs text-neutral-800 focus:border-yellow-400 focus:outline-none" />
          </div>
        )}
        <button type="button" onClick={baixarCsv} disabled={lancamentos.length === 0} className={`${botaoPeriodo(false)} inline-flex items-center gap-2 disabled:opacity-50`}><Download className="h-4 w-4" aria-hidden="true" /> Baixar Excel (CSV)</button>
      </div>

      {erro && <div role="alert" className="flex gap-2 rounded-xl border border-red-200 bg-red-50 p-3 text-xs text-red-700"><AlertTriangle className="h-4 w-4 shrink-0" aria-hidden="true" /> {erro}</div>}
      {dados?.desatualizado && <div role="status" className="rounded-xl border border-yellow-200 bg-yellow-50 p-3 text-xs font-semibold text-yellow-800">O Apontamento de Produção não respondeu agora; estes são os dados da última leitura ({hora(dados.atualizadoEm)}).</div>}

      {carregando ? (
        <div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-neutral-400" aria-label="Carregando" /></div>
      ) : (
        <>
          {/* Indicadores */}
          <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5" aria-label="Indicadores">
            <div className={cartao}><span className="text-[10.5px] font-extrabold uppercase tracking-wide text-neutral-500">Blocos usados</span><strong className="mt-1 block text-2xl font-black text-neutral-900">{inteiro(total.blocos)}</strong><small className="text-[11px] text-neutral-400">{inteiro(total.placas)} placas produzidas{rendimento !== null ? ` · rendimento ${pct(rendimento)}` : ''}</small></div>
            <div className={cartao}><span className="text-[10.5px] font-extrabold uppercase tracking-wide text-neutral-500">Custo da produção interna</span><strong className="mt-1 block text-2xl font-black text-neutral-900">{brl(total.custoInterno)}</strong><small className="text-[11px] text-neutral-400">blocos usados × preço do bloco</small></div>
            <div className={cartao}><span className="text-[10.5px] font-extrabold uppercase tracking-wide text-neutral-500">Se comprasse do fornecedor</span><strong className="mt-1 block text-2xl font-black text-neutral-900">{brl(total.valorFornecedor)}</strong><small className="text-[11px] text-neutral-400">placas produzidas × R$ {PRECOS_EPS.trapezio.precoFornecedor.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</small></div>
            <div className={`${cartao} border-yellow-300 bg-yellow-50/60 xl:col-span-2`}>
              <span className="text-[10.5px] font-extrabold uppercase tracking-wide text-yellow-800">Diferença — Caixa 2</span>
              <strong className={`mt-1 block text-2xl font-black ${classeDiferenca(total.diferenca)}`}>{dinheiroComSinal(total.diferenca)}</strong>
              <small className="text-[11px] text-neutral-500">{pctComSinal(total.percentual)} sobre o valor do fornecedor · {total.diferenca >= 0 ? 'a produção interna saiu mais barata' : 'a produção interna saiu mais cara'}</small>
            </div>
          </section>

          <div className="grid items-start gap-4 xl:grid-cols-[minmax(0,1fr)_340px]">
            {/* Por tipo de placa */}
            <section className={cartao} aria-label="Por tipo de placa">
              <h2 className="mb-2 text-sm font-extrabold text-neutral-900">Por tipo de placa</h2>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[680px] border-collapse">
                  <thead><tr>
                    <th className={cabecalho}>Tipo</th><th className={`${cabecalho} text-right`}>Blocos</th><th className={`${cabecalho} text-right`}>Placas</th><th className={`${cabecalho} text-right`}>Custo interno</th><th className={`${cabecalho} text-right`}>Fornecedor</th><th className={`${cabecalho} text-right`}>Caixa 2</th><th className={`${cabecalho} text-right`}>%</th>
                  </tr></thead>
                  <tbody>
                    {linhasTipo.map((t) => (
                      <tr key={t.id}>
                        <td className={`${celula} font-semibold`}>{t.rotulo}</td>
                        <td className={`${celula} text-right tabular-nums`}>{inteiro(t.blocos)}</td>
                        <td className={`${celula} text-right tabular-nums`}>{inteiro(t.placas)}</td>
                        <td className={`${celula} text-right tabular-nums`}>{brl(t.custoInterno)}</td>
                        <td className={`${celula} text-right tabular-nums`}>{brl(t.valorFornecedor)}</td>
                        <td className={`${celula} text-right font-bold tabular-nums ${classeDiferenca(t.diferenca)}`}>{dinheiroComSinal(t.diferenca)}</td>
                        <td className={`${celula} text-right tabular-nums ${classeDiferenca(t.diferenca)}`}>{pctComSinal(t.percentual)}</td>
                      </tr>
                    ))}
                    {linhasTipo.length === 0 && <tr><td colSpan={7} className="px-3 py-6 text-center text-xs text-neutral-400">Nenhum lançamento neste período.</td></tr>}
                    {linhasTipo.length > 0 && (
                      <tr className="bg-neutral-50 font-extrabold">
                        <td className={celula}>Total</td>
                        <td className={`${celula} text-right tabular-nums`}>{inteiro(total.blocos)}</td>
                        <td className={`${celula} text-right tabular-nums`}>{inteiro(total.placas)}</td>
                        <td className={`${celula} text-right tabular-nums`}>{brl(total.custoInterno)}</td>
                        <td className={`${celula} text-right tabular-nums`}>{brl(total.valorFornecedor)}</td>
                        <td className={`${celula} text-right tabular-nums ${classeDiferenca(total.diferenca)}`}>{dinheiroComSinal(total.diferenca)}</td>
                        <td className={`${celula} text-right tabular-nums ${classeDiferenca(total.diferenca)}`}>{pctComSinal(total.percentual)}</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </section>

            {/* Preços usados nas contas */}
            <section className={cartao} aria-label="Preços">
              <h2 className="mb-2 text-sm font-extrabold text-neutral-900">Preços usados</h2>
              <div className="space-y-3">
                {(Object.values(PRECOS_EPS)).map((p) => {
                  const interno = custoPlacaInterna(p);
                  const dif = p.precoFornecedor - interno;
                  return (
                    <div key={p.familia} className="rounded-xl border border-neutral-100 bg-neutral-50 p-3 text-xs text-neutral-700">
                      <b className="text-neutral-900">{p.nome}</b>
                      <dl className="mt-1.5 grid grid-cols-[1fr_auto] gap-x-3 gap-y-0.5">
                        <dt>Bloco</dt><dd className="text-right tabular-nums">{brl(p.precoBloco)} ({p.placasPorBloco} placas)</dd>
                        <dt>Placa na produção interna</dt><dd className="text-right tabular-nums">{brl(interno)}</dd>
                        <dt>Placa no fornecedor</dt><dd className="text-right tabular-nums">{brl(p.precoFornecedor)}</dd>
                        <dt className="font-bold">Diferença por placa</dt><dd className={`text-right font-bold tabular-nums ${classeDiferenca(dif)}`}>{dinheiroComSinal(dif)} ({pctComSinal(dif / p.precoFornecedor)})</dd>
                      </dl>
                    </div>
                  );
                })}
              </div>
              <p className="mt-2 text-[11px] leading-snug text-neutral-400">Custo interno = blocos usados × preço do bloco (a perda de produção já está no custo). Fornecedor = placas produzidas × preço da placa. Diferença = fornecedor − custo interno, apontada como Caixa 2; o percentual é sobre o valor do fornecedor.</p>
            </section>
          </div>

          {/* Lançamentos */}
          <section className={cartao} aria-label="Lançamentos">
            <h2 className="mb-2 text-sm font-extrabold text-neutral-900">Lançamentos <span className="text-xs font-semibold text-neutral-400">({lancamentos.length})</span></h2>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[980px] border-collapse">
                <thead><tr>
                  <th className={cabecalho}>Data</th><th className={cabecalho}>Colaborador</th><th className={cabecalho}>Tipo</th><th className={`${cabecalho} text-right`}>Blocos</th><th className={`${cabecalho} text-right`}>Placas</th><th className={`${cabecalho} text-right`}>Custo interno</th><th className={`${cabecalho} text-right`}>Fornecedor</th><th className={`${cabecalho} text-right`}>Caixa 2</th><th className={`${cabecalho} text-right`}>%</th><th className={cabecalho}>Observação</th>
                </tr></thead>
                <tbody>
                  {lancamentos.map((l) => {
                    const c = comparar(l);
                    return (
                      <tr key={l.id}>
                        <td className={`${celula} whitespace-nowrap`}>{formatDataIsoParaBr(l.data)} <small className="text-[10.5px] text-neutral-400">{hora(l.em)}</small></td>
                        <td className={celula}>{l.colaborador.nome ?? '—'}</td>
                        <td className={`${celula} whitespace-nowrap`}>{l.tipoRotulo}</td>
                        <td className={`${celula} text-right tabular-nums`}>{inteiro(l.blocos)}</td>
                        <td className={`${celula} text-right tabular-nums`}>{inteiro(l.placas)}</td>
                        <td className={`${celula} text-right tabular-nums`}>{brl(c.custoInterno)}</td>
                        <td className={`${celula} text-right tabular-nums`}>{brl(c.valorFornecedor)}</td>
                        <td className={`${celula} text-right font-bold tabular-nums ${classeDiferenca(c.diferenca)}`}>{dinheiroComSinal(c.diferenca)}</td>
                        <td className={`${celula} text-right tabular-nums ${classeDiferenca(c.diferenca)}`}>{pctComSinal(c.percentual)}</td>
                        <td className={`${celula} max-w-[220px] text-neutral-500`}>{l.observacao ?? ''}</td>
                      </tr>
                    );
                  })}
                  {lancamentos.length === 0 && <tr><td colSpan={10} className="px-3 py-8 text-center text-xs text-neutral-400">Nenhum lançamento neste período.</td></tr>}
                </tbody>
              </table>
            </div>
          </section>
        </>
      )}
    </div>
  );
};
