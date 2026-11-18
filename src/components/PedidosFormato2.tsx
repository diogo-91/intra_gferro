import React, { useCallback, useEffect, useState } from 'react';
import { AlertTriangle, ListChecks, Loader2, Search } from 'lucide-react';
import { formatDataIsoParaBr } from '../utils/format';
import { DATA_DE_CORTE_FORMATO2, REGRAS_FORMATO2, type RegraFormato2, type StatusFormato2 } from '../pedidosFormato2';

// Pedidos Formato 2: todos os pedidos liberados no Nomus, cada um com o prazo de entrega da regra da GFERRO
// (contrato: 60 dias úteis · 30% a 69% pago: 40 dias úteis · 70% a 100% pago: 7 a 10 dias úteis). O servidor classifica;
// aqui se busca e se filtra.

interface PedidoFormato2 {
  id: number;
  codigo: string;
  cliente: string;
  vendedor: string;
  loja: string;
  dataEmissao: string;
  valorTotal: number;
  pago: number | null;
  aReceber: number | null;
  contrato: boolean;
  regra: RegraFormato2;
  regraRotulo: string;
  percentualPago: number | null;
  diasUteis: number | null;
  prazoInicio: string | null;
  prazoFim: string | null;
  status: StatusFormato2;
  diasAtraso: number;
  diasParaPrazo: number | null;
}

interface Resposta {
  atualizadoEm: string;
  carregando?: boolean;
  atualizando?: boolean;
  financeiroPendente?: boolean;
  observacoesPendentes?: boolean;
  erroAtualizacao?: string;
  pedidos: PedidoFormato2[];
}

type FiltroRegra = 'todas' | Exclude<RegraFormato2, 'sem-financeiro' | 'abaixo-30'>;
type FiltroStatus = 'todos' | 'atrasado' | 'dentro-do-prazo';

// Última resposta guardada na memória do navegador: ao voltar para a tela ela já aparece cheia e atualiza por baixo.
let ultimaResposta: Resposta | null = null;

const brl = (n: number) => n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const pct = (n: number) => `${(n * 100).toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 1 })}%`;
const semAcento = (t: string) => t.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase();
const plural = (n: number, um: string, varios: string) => `${n} ${n === 1 ? um : varios}`;
const hora = (iso: string) => new Date(iso).toLocaleTimeString('pt-BR', { timeZone: 'America/Sao_Paulo', hour: '2-digit', minute: '2-digit' });

const statusEfetivo = (p: PedidoFormato2): FiltroStatus => (p.status === 'atrasado' || p.status === 'dentro-do-prazo' ? p.status : 'todos');

/** Status do prazo, contado em dias úteis. */
function selo(p: PedidoFormato2): { texto: string; classe: string; detalhe?: string } {
  if (p.status === 'atrasado') {
    return p.diasAtraso > 0
      ? { texto: `Atrasado há ${plural(p.diasAtraso, 'dia útil', 'dias úteis')}`, classe: 'bg-red-100 text-red-700' }
      : { texto: 'Atrasado', classe: 'bg-red-100 text-red-700', detalhe: 'venceu no último dia útil' };
  }
  if (p.status === 'dentro-do-prazo') return { texto: 'Dentro do prazo', classe: 'bg-emerald-100 text-emerald-700', detalhe: p.diasParaPrazo === 0 ? 'vence hoje' : `faltam ${plural(p.diasParaPrazo ?? 0, 'dia útil', 'dias úteis')}` };
  return { texto: 'Calculando…', classe: 'bg-neutral-100 text-neutral-500' };
}

const cabecalho = 'sticky top-0 z-[1] border-b border-neutral-100 bg-neutral-50 px-2 py-2.5 text-left text-[11px] font-extrabold text-neutral-600';
const celula = 'border-b border-neutral-100 px-2 py-2.5 align-top';
const chip = (ativo: boolean) => `rounded-full border px-3 py-1.5 text-[11.5px] font-bold ${ativo ? 'border-yellow-500 bg-yellow-300 text-neutral-900' : 'border-neutral-200 bg-white text-slate-600 hover:border-yellow-400'}`;

export const PedidosFormato2: React.FC = () => {
  const [dados, setDados] = useState<Resposta | null>(ultimaResposta);
  const [erro, setErro] = useState('');
  const [busca, setBusca] = useState('');
  const [filtroRegra, setFiltroRegra] = useState<FiltroRegra>('todas');
  const [filtroStatus, setFiltroStatus] = useState<FiltroStatus>('todos');

  const carregar = useCallback(async () => {
    try {
      const resposta = await fetch('/api/dashboard/pedidos-formato2');
      const corpo = await resposta.json().catch(() => null);
      if (!resposta.ok || !corpo || !Array.isArray(corpo.pedidos)) throw new Error(corpo?.error || 'Não foi possível carregar os pedidos.');
      ultimaResposta = corpo;
      setDados(corpo);
      setErro('');
    } catch (e: any) {
      setErro(e.message);
    }
  }, []);

  // Enquanto o servidor ainda lê o Nomus a tela pergunta de novo logo; depois, a cada minuto.
  const lendo = !!dados && (!!dados.carregando || !!dados.financeiroPendente || !!dados.observacoesPendentes);
  useEffect(() => { carregar(); }, [carregar]);
  useEffect(() => {
    const t = setInterval(() => { if (!document.hidden) carregar(); }, lendo ? 15_000 : 60_000);
    return () => clearInterval(t);
  }, [carregar, lendo]);

  const todos = dados?.pedidos ?? [];
  const regraDe = (p: PedidoFormato2): FiltroRegra | null => (p.regra === 'sem-financeiro' || p.regra === 'abaixo-30' ? null : p.regra);
  const q = semAcento(busca.trim());
  const lista = todos.filter((p) =>
    (filtroRegra === 'todas' || regraDe(p) === filtroRegra) &&
    (filtroStatus === 'todos' || statusEfetivo(p) === filtroStatus) &&
    (!q || semAcento(`${p.codigo} ${p.cliente} ${p.vendedor} ${p.loja}`).includes(q)));
  const contarRegra = (r: FiltroRegra) => (r === 'todas' ? todos.length : todos.filter((p) => regraDe(p) === r).length);
  const contarStatus = (s: FiltroStatus) => (s === 'todos' ? todos.length : todos.filter((p) => statusEfetivo(p) === s).length);
  const somaAReceber = lista.reduce((s, p) => s + (p.aReceber ?? 0), 0);

  const REGRAS: Array<{ valor: FiltroRegra; nome: string }> = [
    { valor: 'todas', nome: 'Todas as regras' },
    { valor: 'contrato', nome: 'Contrato' },
    { valor: 'pago-30-69', nome: '30% a 69% pago' },
    { valor: 'pago-70-100', nome: '70% a 100% pago' },
  ];
  const STATUS: Array<{ valor: FiltroStatus; nome: string }> = [
    { valor: 'todos', nome: 'Todos' },
    { valor: 'atrasado', nome: 'Atrasados' },
    { valor: 'dentro-do-prazo', nome: 'Dentro do prazo' },
  ];

  return (
    <div className="space-y-4">
      <div className="flex items-start gap-3">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[13px] bg-gradient-to-br from-yellow-200 to-yellow-100 shadow-md shadow-yellow-400/20"><ListChecks className="h-[22px] w-[22px] text-yellow-500" aria-hidden="true" /></span>
        <div>
          <span className="text-[10px] font-bold uppercase tracking-[0.12em] text-neutral-500">Dashboard › Pedidos › <b className="text-neutral-900">Formato 2</b></span>
          <h1 className="text-[22px] font-black leading-tight tracking-tight text-neutral-900">Pedidos Formato 2</h1>
          <p className="mt-1 max-w-4xl text-xs leading-snug text-neutral-500">
            Todos os pedidos liberados no Nomus, com o prazo de entrega pela regra: <b>contrato</b> {REGRAS_FORMATO2.contrato.diasUteisMax} dias úteis · <b>30% a 69% pago</b> {REGRAS_FORMATO2['pago-30-69'].diasUteisMax} dias úteis · <b>70% a 100% pago</b> {REGRAS_FORMATO2['pago-70-100'].diasUteisMin} a {REGRAS_FORMATO2['pago-70-100'].diasUteisMax} dias úteis. O prazo conta a partir da data de emissão do pedido. Entram os pedidos emitidos a partir de {formatDataIsoParaBr(DATA_DE_CORTE_FORMATO2)} e com pelo menos 30% pago (os de contrato entram sempre); o que for entregue ou cancelado sai da lista.
          </p>
        </div>
      </div>

      {erro && <div role="alert" className="flex gap-2 rounded-xl border border-red-200 bg-red-50 p-3 text-xs text-red-700"><AlertTriangle className="h-4 w-4 shrink-0" aria-hidden="true" /> {erro}</div>}
      {dados?.erroAtualizacao && <div role="status" className="rounded-xl border border-yellow-200 bg-yellow-50 p-3 text-xs font-semibold text-yellow-800">A última atualização com o Nomus falhou; a lista é a da última leitura. ({dados.erroAtualizacao})</div>}
      {lendo && (
        <div role="status" className="flex items-center gap-2 rounded-xl border border-yellow-200 bg-yellow-50 p-3 text-xs font-semibold text-yellow-800">
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
          {dados?.carregando ? 'Lendo os pedidos do Nomus pela primeira vez…' : dados?.observacoesPendentes ? 'Lendo as observações dos pedidos no Nomus para identificar os contratos (leva alguns minutos): a classificação pode mudar.' : 'Lendo o financeiro de alguns pedidos: o pago e o percentual aparecem em instantes.'}
        </div>
      )}

      <section className="rounded-2xl border border-neutral-200 bg-white p-4 shadow-sm" aria-label="Pedidos">
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <label className="relative block min-w-[240px] max-w-sm flex-1">
            <span className="sr-only">Buscar pedido</span>
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-400" aria-hidden="true" />
            <input type="search" value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar pedido, cliente, vendedor ou loja" className="h-9 w-full rounded-[10px] border border-neutral-200 bg-white pl-9 pr-3 text-xs text-neutral-800 outline-none focus:border-yellow-400 focus:ring-2 focus:ring-yellow-300/40" />
          </label>
          <span className="ml-auto inline-flex items-center gap-1.5 text-[11px] text-neutral-400">
            {plural(lista.length, 'pedido', 'pedidos')} · a receber {brl(somaAReceber)}
            {dados && <span title="Hora da última leitura do Nomus">· Nomus às {hora(dados.atualizadoEm)}</span>}
            {dados?.atualizando && <Loader2 className="h-3 w-3 animate-spin" aria-label="Atualizando em segundo plano" />}
          </span>
        </div>
        <div className="mb-2 flex flex-wrap gap-1.5" role="group" aria-label="Regra de prazo">
          {REGRAS.map((r) => <button key={r.valor} type="button" onClick={() => setFiltroRegra(r.valor)} aria-pressed={filtroRegra === r.valor} className={chip(filtroRegra === r.valor)}>{r.nome} ({contarRegra(r.valor)})</button>)}
        </div>
        <div className="mb-3 flex flex-wrap gap-1.5" role="group" aria-label="Status">
          {STATUS.map((s) => <button key={s.valor} type="button" onClick={() => setFiltroStatus(s.valor)} aria-pressed={filtroStatus === s.valor} className={chip(filtroStatus === s.valor)}>{s.nome} ({contarStatus(s.valor)})</button>)}
        </div>

        {!dados && !erro ? (
          <div className="flex justify-center py-10"><Loader2 className="h-5 w-5 animate-spin text-neutral-400" aria-label="Carregando" /></div>
        ) : (
          <div className="max-h-[680px] overflow-y-auto overflow-x-hidden rounded-xl border border-neutral-100">
            <table className="w-full border-separate border-spacing-0 text-[11.5px]">
              <thead>
                <tr>
                  <th scope="col" className={cabecalho}>Pedido</th>
                  <th scope="col" className={cabecalho}>Cliente</th>
                  <th scope="col" className={cabecalho}>Vendedor</th>
                  <th scope="col" className={cabecalho}>Loja</th>
                  <th scope="col" className={`${cabecalho} text-right`}>Pago</th>
                  <th scope="col" className={`${cabecalho} text-right`}>A receber</th>
                  <th scope="col" className={cabecalho}>Prazo de entrega</th>
                  <th scope="col" className={cabecalho}>Status</th>
                </tr>
              </thead>
              <tbody>
                {lista.map((p) => {
                  const s = selo(p);
                  return (
                    <tr key={p.id} className="hover:bg-yellow-50/50">
                      <td className={celula}>
                        <b className="text-neutral-900">{p.codigo}</b>
                        {p.contrato && <span className="ml-1.5 rounded bg-yellow-200 px-1.5 py-px align-middle text-[9.5px] font-extrabold text-neutral-900">CONTRATO</span>}
                        <span className="block text-[11px] text-neutral-400">emitido em {formatDataIsoParaBr(p.dataEmissao)}</span>
                      </td>
                      <td className={celula}>{p.cliente}</td>
                      <td className={celula}>{p.vendedor}</td>
                      <td className={celula}>{p.loja}</td>
                      <td className={`${celula} text-right tabular-nums`}>
                        {p.pago === null ? <span className="text-slate-300">…</span> : <>{brl(p.pago)}<span className="block text-[11px] text-neutral-400" title={`de ${brl(p.valorTotal)}`}>{p.percentualPago !== null ? pct(p.percentualPago) : ''}</span></>}
                      </td>
                      <td className={`${celula} text-right tabular-nums`}>{p.aReceber === null ? <span className="text-slate-300">…</span> : brl(p.aReceber)}</td>
                      <td className={celula}>
                        {p.prazoFim ? (
                          <>
                            <b className="text-neutral-900">{p.prazoInicio ? <>{formatDataIsoParaBr(p.prazoInicio)}<span className="font-normal text-neutral-400"> a </span>{formatDataIsoParaBr(p.prazoFim)}</> : formatDataIsoParaBr(p.prazoFim)}</b>
                            <span className="block text-[11px] text-neutral-400">{p.regraRotulo} · {p.prazoInicio ? `7 a ${p.diasUteis}` : p.diasUteis} dias úteis</span>
                          </>
                        ) : (
                          <><span className="text-slate-300">—</span><span className="block text-[11px] text-neutral-400">{p.regraRotulo}</span></>
                        )}
                      </td>
                      <td className={celula}>
                        <span className={`inline-block rounded-full px-2.5 py-1 text-[11px] font-bold ${s.classe}`}>{s.texto}</span>
                        {s.detalhe && <span className="block pl-1 text-[10.5px] text-neutral-400">{s.detalhe}</span>}
                      </td>
                    </tr>
                  );
                })}
                {lista.length === 0 && (
                  <tr><td colSpan={8} className="px-3 py-10 text-center text-xs text-neutral-400">{todos.length === 0 ? (lendo ? 'Ainda lendo os pedidos…' : 'Nenhum pedido liberado.') : 'Nenhum pedido com esse filtro.'}</td></tr>
                )}
              </tbody>
            </table>
          </div>
        )}
        <p className="mt-2 text-[11px] leading-snug text-neutral-400">Pedido de contrato é o que tem a palavra “contrato” na observação no Nomus (vale qualquer que seja o pagamento). O percentual pago é calculado aqui: pago ÷ valor total do pedido. Dias úteis: segunda a sexta, sem feriados nacionais, Carnaval e Sexta-feira Santa; o atraso e o que falta para o prazo também são contados em dias úteis. A lista se atualiza sozinha: pedidos entregues ou cancelados saem em alguns minutos.</p>
      </section>
    </div>
  );
};
