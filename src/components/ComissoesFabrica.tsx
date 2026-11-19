import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AlertTriangle, ChevronLeft, ChevronRight, Download, HandCoins, Loader2, RefreshCw } from 'lucide-react';
import {
  FAIXAS_COMISSAO_FRETE, agruparPorLoja, MES_INICIAL_COMISSOES, NUMERO_DE_SEMANAS, TAXA_COMISSAO_PADRAO, calcularComissoes, somarResumos,
  type AjusteVendedor, type PedidoComissao, type ResumoVendedor, type TermoAceite, type VendedorDaLoja,
} from '../comissoesFabrica';
import { LOJAS } from '../data/vendedorLoja';
import { chaveDia, formatDataIsoParaBr } from '../utils/format';

// Comissões (Dashboard Financeiro): o fechamento mensal da planilha "03 FABRICA", calculado direto dos pedidos do
// Nomus. Os valores vêm do Nomus; o termo de aceite (por pedido) e o ajuste (por vendedor) são digitados aqui.

interface Resposta {
  mes: string;
  atualizadoEm: string;
  carregando?: boolean;
  financeiroCarregando?: boolean;
  pedidos: PedidoComissao[];
  vendedores: VendedorDaLoja[];
  termos: Record<string, TermoAceite>;
  ajustes: Record<string, AjusteVendedor>;
}

const brl = (n: number) => n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const pct = (n: number | null) => (n === null ? '—' : `${(n * 100).toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%`);
const inteiro = (n: number) => n.toLocaleString('pt-BR');
/** Valor em reais sem o símbolo (nas tabelas, que dizem "(R$)" no cabeçalho): cabe mais coluna na tela. */
const dec = (n: number) => n.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const hora = (iso: string) => new Date(iso).toLocaleTimeString('pt-BR', { timeZone: 'America/Sao_Paulo', hour: '2-digit', minute: '2-digit' });
const dinheiroComSinal = (n: number) => `${n > 0 ? '+' : n < 0 ? '−' : ''}${brl(Math.abs(n))}`;

const MINUSCULAS = new Set(['da', 'de', 'do', 'das', 'dos', 'e']);
const nomeBonito = (nome: string) => nome.toLocaleLowerCase('pt-BR').split(' ').map((p, i) => (i > 0 && MINUSCULAS.has(p) ? p : p.charAt(0).toLocaleUpperCase('pt-BR') + p.slice(1))).join(' ');
const primeiroNome = (nome: string) => nomeBonito(nome).split(' ')[0];

const nomeDaLoja = (id: string) => LOJAS.find((l) => l.id === id)?.nome ?? 'Sem loja definida';

const rotuloMes = (mes: string) => {
  const [ano, m] = mes.split('-').map(Number);
  const texto = new Date(ano, m - 1, 1).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
  return texto.charAt(0).toLocaleUpperCase('pt-BR') + texto.slice(1);
};
const somarMes = (mes: string, n: number) => {
  const [ano, m] = mes.split('-').map(Number);
  const d = new Date(ano, m - 1 + n, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
};

/** "8,50", "-8,5", "1.200,00" ou "8.5" -> número; vazio -> 0; texto inválido -> null. */
function lerValor(texto: string): number | null {
  let s = texto.trim().replace(/\s/g, '').replace(/^R\$/i, '');
  if (!s) return 0;
  if (s.includes(',')) s = s.replace(/\./g, '').replace(',', '.');
  else if (/^-?\d{1,3}(\.\d{3})+$/.test(s)) s = s.replace(/\./g, '');
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

// Última resposta de cada mês: ao voltar para a tela ela aparece na hora e atualiza por baixo.
const ultimas = new Map<string, Resposta>();

const cabecalho = 'border-b border-neutral-200 px-2 py-2 text-left align-bottom text-[10px] font-extrabold uppercase leading-tight tracking-wide text-neutral-500';
const celula = 'border-b border-neutral-100 px-2 py-2 text-[11.5px] text-neutral-800';
const cartao = 'rounded-2xl border border-neutral-200 bg-white p-4 shadow-sm';
const campo = 'h-8 rounded-lg border border-neutral-200 bg-white px-2 text-xs text-neutral-800 focus:border-yellow-400 focus:outline-none';

/** Ajuste do vendedor (valor e observação): grava ao sair do campo. */
const EditorAjuste: React.FC<{ ajuste: AjusteVendedor | null; onSalvar: (valor: number, observacao: string) => void }> = ({ ajuste, onSalvar }) => {
  const [valor, setValor] = useState(ajuste ? String(ajuste.valor).replace('.', ',') : '');
  const [observacao, setObservacao] = useState(ajuste?.observacao ?? '');
  const [invalido, setInvalido] = useState(false);
  const raiz = useRef<HTMLDivElement>(null);
  // Mudou por fora (outra pessoa, ou a leitura periódica): atualiza os campos, menos enquanto se digita neles.
  useEffect(() => {
    if (raiz.current?.contains(document.activeElement)) return;
    setValor(ajuste ? String(ajuste.valor).replace('.', ',') : '');
    setObservacao(ajuste?.observacao ?? '');
    setInvalido(false);
  }, [ajuste?.valor, ajuste?.observacao]);
  const salvar = () => {
    const n = lerValor(valor);
    if (n === null) { setInvalido(true); return; }
    setInvalido(false);
    if (n === (ajuste?.valor ?? 0) && observacao.trim() === (ajuste?.observacao ?? '')) return;
    onSalvar(n, observacao);
  };
  const aoTeclar = (e: React.KeyboardEvent<HTMLInputElement>) => { if (e.key === 'Enter') e.currentTarget.blur(); };
  return (
    <div ref={raiz} className="flex flex-wrap items-center gap-2">
      <label className="text-[10.5px] font-extrabold uppercase tracking-wide text-neutral-500" htmlFor="ajuste-valor">Ajuste (R$)</label>
      <input id="ajuste-valor" inputMode="decimal" value={valor} onChange={(e) => setValor(e.target.value)} onBlur={salvar} onKeyDown={aoTeclar} placeholder="0,00 (use − para descontar)" aria-invalid={invalido} className={`${campo} w-44 text-right tabular-nums ${invalido ? 'border-red-400' : ''}`} />
      <input value={observacao} onChange={(e) => setObservacao(e.target.value)} onBlur={salvar} onKeyDown={aoTeclar} maxLength={200} placeholder="Observação (ex.: descontar R$ 8)" aria-label="Observação do ajuste" className={`${campo} w-64`} />
    </div>
  );
};

export const ComissoesFabrica: React.FC = () => {
  const mesAtual = chaveDia(new Date()).slice(0, 7);
  const [mes, setMes] = useState(mesAtual);
  const [dados, setDados] = useState<Resposta | null>(ultimas.get(mes) ?? null);
  const [carregando, setCarregando] = useState(!ultimas.has(mes));
  const [atualizando, setAtualizando] = useState(false);
  const [erro, setErro] = useState('');
  const [selecionado, setSelecionado] = useState<string | null>(null);

  const carregar = useCallback(async (manual = false) => {
    if (manual) setAtualizando(true);
    try {
      const resposta = await fetch(`/api/financeiro/comissoes-fabrica?mes=${mes}`);
      const corpo = await resposta.json().catch(() => null);
      if (!resposta.ok || !corpo || !Array.isArray(corpo.pedidos)) throw new Error(corpo?.error || 'Não foi possível carregar as comissões.');
      // O Nomus está sendo relido (leva minutos): mantém na tela o último fechamento lido em vez de esvaziá-la.
      const anterior = ultimas.get(corpo.mes);
      if (corpo.carregando && anterior && !anterior.carregando) { setErro(''); return; }
      ultimas.set(corpo.mes, corpo);
      if (corpo.mes === mes) setDados(corpo);
      setErro('');
    } catch (e: any) {
      setErro(e.message);
    } finally {
      setCarregando(false);
      setAtualizando(false);
    }
  }, [mes]);

  useEffect(() => {
    setDados(ultimas.get(mes) ?? null);
    setCarregando(!ultimas.has(mes));
    void carregar();
  }, [mes, carregar]);
  // Enquanto o Nomus ainda está sendo lido pergunta de novo a cada 15 s; depois, a cada minuto.
  const lendo = !!dados?.carregando || !!dados?.financeiroCarregando;
  useEffect(() => {
    const t = setInterval(() => { if (!document.hidden) void carregar(); }, lendo ? 15_000 : 60_000);
    return () => clearInterval(t);
  }, [carregar, lendo]);

  const resumos = useMemo(() => calcularComissoes(dados?.pedidos ?? [], { termos: dados?.termos ?? {}, ajustes: dados?.ajustes ?? {} }, dados?.vendedores ?? []), [dados]);
  const grupos = useMemo(() => agruparPorLoja(resumos), [resumos]);
  const total = useMemo(() => somarResumos(resumos), [resumos]);
  const vendedorAtual: ResumoVendedor | undefined = resumos.find((r) => r.vendedor === selecionado) ?? resumos[0];

  const gravar = async (url: string, corpo: unknown) => {
    const resposta = await fetch(url, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(corpo) });
    const resultado = await resposta.json().catch(() => null);
    if (!resposta.ok) throw new Error(resultado?.error || 'Não foi possível salvar.');
  };
  const alterarDados = (f: (d: Resposta) => Resposta) => setDados((d) => { if (!d) return d; const novo = f(d); ultimas.set(novo.mes, novo); return novo; });

  const salvarTermo = async (codigo: string, valor: TermoAceite | null) => {
    alterarDados((d) => {
      const termos = { ...d.termos };
      if (valor === null) delete termos[codigo]; else termos[codigo] = valor;
      return { ...d, termos };
    });
    try { await gravar('/api/financeiro/comissoes-fabrica/termo', { mes, codigo, valor }); setErro(''); } catch (e: any) { setErro(e.message); void carregar(); }
  };
  const salvarAjuste = async (vendedor: string, valor: number, observacao: string) => {
    alterarDados((d) => {
      const ajustes = { ...d.ajustes };
      if (valor === 0 && !observacao.trim()) delete ajustes[vendedor]; else ajustes[vendedor] = { valor, observacao: observacao.trim() };
      return { ...d, ajustes };
    });
    try { await gravar('/api/financeiro/comissoes-fabrica/ajuste', { mes, vendedor, valor, observacao }); setErro(''); } catch (e: any) { setErro(e.message); void carregar(); }
  };

  const baixarCsv = () => {
    const esc = (x: unknown) => { const s = String(x ?? ''); return /[;"\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
    const num = (n: number) => n.toFixed(2).replace('.', ',');
    const linhas: string[] = [];
    linhas.push(['Loja', 'Vendedor', 'Pedidos', 'Vendas (R$)', 'Recebido (R$)', '% médio recebido', 'Parafusos (un)', 'Parafusos (R$)', 'Frete (R$)', 'Comissão frete (R$)', 'Taxa', 'Comissão vendas (R$)', 'Ajuste (R$)', 'Obs. do ajuste', 'Total (R$)'].map(esc).join(';'));
    for (const r of resumos) linhas.push([nomeDaLoja(r.loja), nomeBonito(r.vendedor), r.pedidos.length, num(r.totalVendas), num(r.totalRecebido), r.mediaPercentual === null ? '' : (r.mediaPercentual * 100).toFixed(1).replace('.', ','), r.quantidadeParafusos, num(r.valorParafusos), num(r.totalFrete), num(r.comissaoFrete), `${(r.taxa * 100).toFixed(0)}%`, num(r.comissaoVendas), num(r.ajuste?.valor ?? 0), r.ajuste?.observacao ?? '', num(r.totalComissao)].map(esc).join(';'));
    linhas.push(['TOTAL', '', total.pedidos, num(total.totalVendas), num(total.totalRecebido), total.mediaPercentual === null ? '' : (total.mediaPercentual * 100).toFixed(1).replace('.', ','), total.quantidadeParafusos, num(total.valorParafusos), num(total.totalFrete), num(total.comissaoFrete), '', num(total.comissaoVendas), num(total.ajustes), '', num(total.totalComissao)].map(esc).join(';'));
    linhas.push('');
    linhas.push(['Loja', 'Vendedor', 'Data', 'Pedido', 'Valor vendas (R$)', 'Valor recebido (R$)', '%', 'Parafusos (un)', 'Parafusos (R$)', 'Frete (R$)', 'Comissão frete (R$)', 'Semana', 'Termo de aceite'].map(esc).join(';'));
    for (const r of resumos) for (const p of r.pedidos) linhas.push([nomeDaLoja(r.loja), nomeBonito(r.vendedor), formatDataIsoParaBr(p.dataEmissao), p.codigo, num(p.valorTotal), num(p.valorRecebido), p.percentual === null ? '' : (p.percentual * 100).toFixed(1).replace('.', ','), p.quantidadeParafusos, num(p.valorParafusos), num(p.valorFrete), num(p.comissaoFrete), p.semana, p.termoAceite === 'sim' ? 'Sim' : p.termoAceite === 'nao' ? 'Não' : ''].map(esc).join(';'));
    const url = URL.createObjectURL(new Blob(['﻿' + linhas.join('\r\n') + '\r\n'], { type: 'text/csv;charset=utf-8' }));
    const link = Object.assign(document.createElement('a'), { href: url, download: `comissoes-fabrica-${mes}.csv` });
    document.body.append(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 5000);
  };

  const botao = 'inline-flex items-center gap-2 rounded-xl border border-neutral-200 bg-white px-3.5 py-2 text-xs font-bold text-neutral-700 hover:border-yellow-400 hover:bg-yellow-50 disabled:opacity-50 disabled:hover:border-neutral-200 disabled:hover:bg-white';
  const num = 'text-right tabular-nums';

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[13px] bg-gradient-to-br from-yellow-200 to-yellow-100 shadow-md shadow-yellow-400/20"><HandCoins className="h-[22px] w-[22px] text-yellow-500" aria-hidden="true" /></span>
          <div>
            <span className="text-[10px] font-bold uppercase tracking-[0.12em] text-neutral-500">Dashboard › Financeiro › <b className="text-neutral-900">Comissões</b></span>
            <h1 className="text-[22px] font-black leading-tight tracking-tight text-neutral-900">Comissões</h1>
            <p className="mt-1 max-w-3xl text-xs leading-snug text-neutral-500">Fechamento mensal dos vendedores de todas as lojas, calculado dos pedidos do Nomus: vendas, recebido, parafusos, frete e comissões.</p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button type="button" onClick={() => void carregar(true)} className={botao}><RefreshCw className={`h-3.5 w-3.5 ${atualizando ? 'animate-spin' : ''}`} aria-hidden="true" /> Atualizar</button>
          <button type="button" onClick={baixarCsv} disabled={resumos.length === 0} className={botao}><Download className="h-3.5 w-3.5" aria-hidden="true" /> Baixar Excel (CSV)</button>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2.5">
        <button type="button" onClick={() => setMes(somarMes(mes, -1))} disabled={mes <= MES_INICIAL_COMISSOES} aria-label="Mês anterior" className="flex h-10 w-10 items-center justify-center rounded-xl border border-neutral-200 bg-white text-neutral-700 hover:border-yellow-400 disabled:opacity-40 disabled:hover:border-neutral-200"><ChevronLeft className="h-4 w-4" aria-hidden="true" /></button>
        <strong className="min-w-[10rem] rounded-xl border border-yellow-400 bg-yellow-300 px-5 py-2.5 text-center text-sm font-bold text-neutral-900">{rotuloMes(mes)}</strong>
        <button type="button" onClick={() => setMes(somarMes(mes, 1))} disabled={mes >= mesAtual} aria-label="Próximo mês" className="flex h-10 w-10 items-center justify-center rounded-xl border border-neutral-200 bg-white text-neutral-700 hover:border-yellow-400 disabled:opacity-40 disabled:hover:border-neutral-200"><ChevronRight className="h-4 w-4" aria-hidden="true" /></button>
        {dados && !dados.carregando && <span className="text-[11px] text-neutral-400">Nomus lido às {hora(dados.atualizadoEm)}</span>}
      </div>

      {erro && <div role="alert" className="flex gap-2 rounded-xl border border-red-200 bg-red-50 p-3 text-xs text-red-700"><AlertTriangle className="h-4 w-4 shrink-0" aria-hidden="true" /> {erro}</div>}
      {dados?.carregando && <div role="status" className="flex items-center gap-2 rounded-xl border border-yellow-200 bg-yellow-50 p-3 text-xs font-semibold text-yellow-800"><Loader2 className="h-4 w-4 shrink-0 animate-spin" aria-hidden="true" /> Lendo os pedidos do mês no Nomus. Isso pode levar alguns minutos; a tela atualiza sozinha.</div>}
      {!dados?.carregando && dados?.financeiroCarregando && <div role="status" className="flex items-center gap-2 rounded-xl border border-yellow-200 bg-yellow-50 p-3 text-xs font-semibold text-yellow-800"><Loader2 className="h-4 w-4 shrink-0 animate-spin" aria-hidden="true" /> Lendo os recebimentos no financeiro do Nomus; o recebido e as comissões de vendas podem mudar nos próximos minutos.</div>}

      {carregando ? (
        <div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-neutral-400" aria-label="Carregando" /></div>
      ) : dados?.carregando ? null : (
        <>
          {/* Indicadores */}
          <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5" aria-label="Indicadores">
            <div className={cartao}><span className="text-[10.5px] font-extrabold uppercase tracking-wide text-neutral-500">Vendas do mês</span><strong className="mt-1 block text-2xl font-black text-neutral-900">{brl(total.totalVendas)}</strong><small className="text-[11px] text-neutral-400">{inteiro(total.pedidos)} pedidos</small></div>
            <div className={cartao}><span className="text-[10.5px] font-extrabold uppercase tracking-wide text-neutral-500">Recebido</span><strong className="mt-1 block text-2xl font-black text-neutral-900">{brl(total.totalRecebido)}</strong><small className="text-[11px] text-neutral-400">média de {pct(total.mediaPercentual)} por pedido</small></div>
            <div className={cartao}><span className="text-[10.5px] font-extrabold uppercase tracking-wide text-neutral-500">Comissão de vendas</span><strong className="mt-1 block text-2xl font-black text-neutral-900">{brl(total.comissaoVendas)}</strong><small className="text-[11px] text-neutral-400">{pct(TAXA_COMISSAO_PADRAO)} do valor recebido</small></div>
            <div className={cartao}><span className="text-[10.5px] font-extrabold uppercase tracking-wide text-neutral-500">Comissão de frete</span><strong className="mt-1 block text-2xl font-black text-neutral-900">{brl(total.comissaoFrete)}</strong><small className="text-[11px] text-neutral-400">frete cobrado {brl(total.totalFrete)}</small></div>
            <div className={`${cartao} border-yellow-300 bg-yellow-50/60`}><span className="text-[10.5px] font-extrabold uppercase tracking-wide text-yellow-800">Total a pagar</span><strong className="mt-1 block text-2xl font-black text-neutral-900">{brl(total.totalComissao)}</strong><small className="text-[11px] text-neutral-500">vendas + frete{total.ajustes !== 0 ? ` ${total.ajustes > 0 ? '+' : '−'} ajustes ${brl(Math.abs(total.ajustes))}` : ''}</small></div>
          </section>

          {/* Resumo por loja e vendedor */}
          <section className="space-y-4" aria-label="Resumo por loja">
            {grupos.map((g) => {
              const t = somarResumos(g.resumos);
              return (
                <div key={g.id || 'sem-loja'} className={cartao} aria-label={g.nome}>
                  <div className="mb-2 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                    <h2 className="text-sm font-extrabold text-neutral-900">{g.nome}</h2>
                    <span className="text-[11px] text-neutral-500">{inteiro(g.resumos.length)} vendedor{g.resumos.length === 1 ? '' : 'es'} · vendas {brl(t.totalVendas)} · total a pagar <b className="text-neutral-900">{brl(t.totalComissao)}</b></span>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full border-collapse">
                      <thead><tr>
                        <th className={cabecalho}>Vendedor</th><th className={`${cabecalho} text-right`}>Pedidos</th><th className={`${cabecalho} text-right`}>Vendas (R$)</th><th className={`${cabecalho} text-right`}>Recebido (R$)</th><th className={`${cabecalho} text-right`} title="Média simples do % recebido de cada pedido">% médio</th><th className={`${cabecalho} text-right`}>Parafusos (un)</th><th className={`${cabecalho} text-right`}>Parafusos (R$)</th><th className={`${cabecalho} text-right`}>Frete (R$)</th><th className={`${cabecalho} text-right`}>Com. frete (R$)</th><th className={`${cabecalho} text-right`}>Com. vendas (R$)</th><th className={`${cabecalho} text-right`}>Ajuste (R$)</th><th className={`${cabecalho} text-right`}>Total a pagar (R$)</th>
                      </tr></thead>
                      <tbody>
                        {g.resumos.map((r) => (
                          <tr key={r.vendedor} className={`cursor-pointer hover:bg-yellow-50/50 ${r.pedidos.length === 0 && !r.ajuste ? 'text-neutral-400' : ''}`} onClick={() => setSelecionado(r.vendedor)}>
                            <td className={`${celula} font-semibold`}>{nomeBonito(r.vendedor)}</td>
                            <td className={`${celula} ${num}`}>{inteiro(r.pedidos.length)}</td>
                            <td className={`${celula} ${num}`}>{dec(r.totalVendas)}</td>
                            <td className={`${celula} ${num}`}>{dec(r.totalRecebido)}</td>
                            <td className={`${celula} ${num}`}>{pct(r.mediaPercentual)}</td>
                            <td className={`${celula} ${num}`}>{inteiro(r.quantidadeParafusos)}</td>
                            <td className={`${celula} ${num}`}>{dec(r.valorParafusos)}</td>
                            <td className={`${celula} ${num}`}>{dec(r.totalFrete)}</td>
                            <td className={`${celula} ${num}`}>{dec(r.comissaoFrete)}</td>
                            <td className={`${celula} ${num}`} title={`${pct(r.taxa)} do recebido`}>{dec(r.comissaoVendas)}</td>
                            <td className={`${celula} ${num} ${r.ajuste && r.ajuste.valor !== 0 ? (r.ajuste.valor > 0 ? 'text-emerald-700' : 'text-red-700') : 'text-neutral-400'}`} title={r.ajuste?.observacao || undefined}>{r.ajuste && r.ajuste.valor !== 0 ? dinheiroComSinal(r.ajuste.valor) : '—'}</td>
                            <td className={`${celula} ${num} font-extrabold`}>{dec(r.totalComissao)}</td>
                          </tr>
                        ))}
                        {g.resumos.length === 0 && <tr><td colSpan={12} className="px-3 py-5 text-center text-xs text-neutral-400">Nenhum vendedor cadastrado nesta loja.</td></tr>}
                        {g.resumos.length > 1 && (
                          <tr className="bg-neutral-50 font-extrabold">
                            <td className={celula}>Total da loja</td>
                            <td className={`${celula} ${num}`}>{inteiro(t.pedidos)}</td>
                            <td className={`${celula} ${num}`}>{dec(t.totalVendas)}</td>
                            <td className={`${celula} ${num}`}>{dec(t.totalRecebido)}</td>
                            <td className={`${celula} ${num}`}>{pct(t.mediaPercentual)}</td>
                            <td className={`${celula} ${num}`}>{inteiro(t.quantidadeParafusos)}</td>
                            <td className={`${celula} ${num}`}>{dec(t.valorParafusos)}</td>
                            <td className={`${celula} ${num}`}>{dec(t.totalFrete)}</td>
                            <td className={`${celula} ${num}`}>{dec(t.comissaoFrete)}</td>
                            <td className={`${celula} ${num}`}>{dec(t.comissaoVendas)}</td>
                            <td className={`${celula} ${num}`}>{t.ajustes !== 0 ? dinheiroComSinal(t.ajustes) : '—'}</td>
                            <td className={`${celula} ${num}`}>{dec(t.totalComissao)}</td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              );
            })}
          </section>

          {/* Por semana */}
          {resumos.length > 0 && (
            <section className="grid gap-4 lg:grid-cols-2" aria-label="Por semana">
              {([['Vendas por semana (R$)', 'vendasPorSemana'], ['Recebido por semana (R$)', 'recebidoPorSemana']] as const).map(([titulo, campoSemana]) => (
                <div key={campoSemana} className={cartao}>
                  <h2 className="mb-2 text-sm font-extrabold text-neutral-900">{titulo}</h2>
                  <div className="overflow-x-auto">
                    <table className="w-full border-collapse">
                      <thead><tr>
                        <th className={cabecalho}>Vendedor</th>
                        {Array.from({ length: NUMERO_DE_SEMANAS }, (_, i) => <th key={i} className={`${cabecalho} text-right`}>Sem. {i + 1}</th>)}
                      </tr></thead>
                      <tbody>
                        {grupos.filter((g) => g.resumos.length > 0).map((g) => (
                          <React.Fragment key={g.id || 'sem-loja'}>
                            <tr><td colSpan={NUMERO_DE_SEMANAS + 1} className="bg-yellow-50 px-2 py-1 text-[10.5px] font-extrabold uppercase tracking-wide text-yellow-800">{g.nome}</td></tr>
                            {g.resumos.map((r) => (
                              <tr key={r.vendedor}>
                                <td className={`${celula} font-semibold`}>{primeiroNome(r.vendedor)}</td>
                                {r[campoSemana].map((v, i) => <td key={i} className={`${celula} ${num} ${v === 0 ? 'text-neutral-300' : ''}`}>{v === 0 ? '—' : dec(v)}</td>)}
                              </tr>
                            ))}
                          </React.Fragment>
                        ))}
                        <tr className="bg-neutral-50 font-extrabold">
                          <td className={celula}>Total geral</td>
                          {total[campoSemana].map((v, i) => <td key={i} className={`${celula} ${num}`}>{dec(v)}</td>)}
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>
              ))}
            </section>
          )}

          {/* Detalhe do vendedor */}
          {vendedorAtual && (
            <section className={cartao} aria-label="Pedidos do vendedor">
              <div className="mb-3 flex flex-wrap items-center gap-2">
                <h2 className="mr-2 text-sm font-extrabold text-neutral-900">Pedidos de</h2>
                <span className="text-xs text-neutral-500">{nomeDaLoja(vendedorAtual.loja)} › <b className="text-neutral-900">{nomeBonito(vendedorAtual.vendedor)}</b></span>
              </div>
              <div className="mb-3 space-y-1.5">
                {grupos.filter((g) => g.resumos.length > 0).map((g) => (
                  <div key={g.id || 'sem-loja'} className="flex flex-wrap items-center gap-1.5">
                    <span className="w-44 shrink-0 text-[10.5px] font-extrabold uppercase tracking-wide text-neutral-500">{g.nome}</span>
                    {g.resumos.map((r) => (
                      <button key={r.vendedor} type="button" onClick={() => setSelecionado(r.vendedor)} aria-pressed={r.vendedor === vendedorAtual.vendedor} className={`rounded-xl border px-3 py-1 text-xs font-semibold transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-yellow-400 ${r.vendedor === vendedorAtual.vendedor ? 'border-yellow-400 bg-yellow-300 text-neutral-900' : 'border-neutral-200 bg-white text-neutral-700 hover:border-yellow-400'}`}>{primeiroNome(r.vendedor)}</button>
                    ))}
                  </div>
                ))}
              </div>

              <div className="mb-3 flex flex-wrap items-center justify-between gap-x-6 gap-y-2 rounded-xl border border-neutral-200 bg-neutral-50 px-3 py-2.5 text-xs text-neutral-700">
                <div className="flex flex-wrap gap-x-5 gap-y-1">
                  <span>Comissão de vendas ({pct(vendedorAtual.taxa)} de {brl(vendedorAtual.totalRecebido)}): <b>{brl(vendedorAtual.comissaoVendas)}</b></span>
                  <span>Comissão de frete: <b>{brl(vendedorAtual.comissaoFrete)}</b></span>
                  <span>Total a pagar: <b className="text-neutral-900">{brl(vendedorAtual.totalComissao)}</b></span>
                </div>
                <EditorAjuste key={`${mes}|${vendedorAtual.vendedor}`} ajuste={vendedorAtual.ajuste} onSalvar={(valor, observacao) => void salvarAjuste(vendedorAtual.vendedor, valor, observacao)} />
              </div>

              <div className="overflow-x-auto">
                <table className="w-full border-collapse">
                  <thead><tr>
                    <th className={cabecalho}>Data</th><th className={cabecalho}>Pedido</th><th className={`${cabecalho} text-right`}>Valor vendas (R$)</th><th className={`${cabecalho} text-right`}>Valor recebido (R$)</th><th className={`${cabecalho} text-right`}>%</th><th className={`${cabecalho} text-right`}>Parafusos (un)</th><th className={`${cabecalho} text-right`}>Parafusos (R$)</th><th className={`${cabecalho} text-right`}>Frete (R$)</th><th className={`${cabecalho} text-right`}>Com. frete (R$)</th><th className={`${cabecalho} text-center`}>Semana</th><th className={cabecalho}>Termo de aceite</th>
                  </tr></thead>
                  <tbody>
                    {vendedorAtual.pedidos.map((p) => (
                      <tr key={p.id}>
                        <td className={`${celula} whitespace-nowrap`}>{formatDataIsoParaBr(p.dataEmissao)}</td>
                        <td className={`${celula} whitespace-nowrap font-semibold`}>{p.codigo}</td>
                        <td className={`${celula} ${num}`}>{dec(p.valorTotal)}</td>
                        <td className={`${celula} ${num}`}>{dec(p.valorRecebido)}</td>
                        <td className={`${celula} ${num}`}>{pct(p.percentual)}</td>
                        <td className={`${celula} ${num} ${p.quantidadeParafusos === 0 ? 'text-neutral-300' : ''}`}>{p.quantidadeParafusos === 0 ? '—' : inteiro(p.quantidadeParafusos)}</td>
                        <td className={`${celula} ${num} ${p.valorParafusos === 0 ? 'text-neutral-300' : ''}`}>{p.valorParafusos === 0 ? '—' : dec(p.valorParafusos)}</td>
                        <td className={`${celula} ${num} ${p.valorFrete === 0 ? 'text-neutral-300' : ''}`}>{p.valorFrete === 0 ? '—' : dec(p.valorFrete)}</td>
                        <td className={`${celula} ${num} ${p.comissaoFrete === 0 ? 'text-neutral-300' : 'font-bold'}`}>{p.comissaoFrete === 0 ? '—' : dec(p.comissaoFrete)}</td>
                        <td className={`${celula} text-center tabular-nums`}>{p.semana}</td>
                        <td className={celula}>
                          <select
                            value={p.termoAceite ?? ''}
                            onChange={(e) => void salvarTermo(p.codigo, (e.target.value || null) as TermoAceite | null)}
                            aria-label={`Termo de aceite do ${p.codigo}`}
                            className={`${campo} w-24 ${p.termoAceite === 'sim' ? 'border-emerald-300 bg-emerald-50 text-emerald-800' : p.termoAceite === 'nao' ? 'border-red-300 bg-red-50 text-red-700' : ''}`}
                          >
                            <option value="">—</option>
                            <option value="sim">Sim</option>
                            <option value="nao">Não</option>
                          </select>
                        </td>
                      </tr>
                    ))}
                    <tr className="bg-neutral-50 font-extrabold">
                      <td className={celula} colSpan={2}>Total</td>
                      <td className={`${celula} ${num}`}>{dec(vendedorAtual.totalVendas)}</td>
                      <td className={`${celula} ${num}`}>{dec(vendedorAtual.totalRecebido)}</td>
                      <td className={`${celula} ${num}`}>{pct(vendedorAtual.mediaPercentual)}</td>
                      <td className={`${celula} ${num}`}>{inteiro(vendedorAtual.quantidadeParafusos)}</td>
                      <td className={`${celula} ${num}`}>{dec(vendedorAtual.valorParafusos)}</td>
                      <td className={`${celula} ${num}`}>{dec(vendedorAtual.totalFrete)}</td>
                      <td className={`${celula} ${num}`}>{dec(vendedorAtual.comissaoFrete)}</td>
                      <td className={celula} colSpan={2} />
                    </tr>
                  </tbody>
                </table>
              </div>
            </section>
          )}

          <details className={`${cartao} text-xs text-neutral-600`}>
            <summary className="cursor-pointer text-sm font-extrabold text-neutral-900">Como é calculado</summary>
            <ul className="mt-2 list-disc space-y-1 pl-5 leading-relaxed">
              <li><b>Pedidos:</b> emitidos no mês pelos vendedores de cada loja e já Liberados ou Atendidos no Nomus — a mesma regra do Ranking de Vendedores.</li>
              <li><b>Valor recebido:</b> soma dos recebimentos do pedido lançados no financeiro do Nomus (a tela Recebimentos); muda conforme entram os pagamentos.</li>
              <li><b>Comissão de vendas:</b> {pct(TAXA_COMISSAO_PADRAO)} do valor recebido. <b>% médio:</b> média simples do % recebido de cada pedido.</li>
              <li><b>Comissão de frete (por pedido):</b> {[...FAIXAS_COMISSAO_FRETE].reverse().map((f, i, todas) => `${brl(f.minimo)}${i < todas.length - 1 ? ` a ${brl(todas[i + 1].minimo - 0.01)}` : ' ou mais'} = ${brl(f.comissao)}`).join('; ')}. Abaixo de {brl(FAIXAS_COMISSAO_FRETE[FAIXAS_COMISSAO_FRETE.length - 1].minimo)} não há comissão. O frete é o campo “Fretes e Outros” do pedido.</li>
              <li><b>Semana:</b> semanas do mês começando no domingo (a semana 1 é a que tem o dia 1). <b>Termo de aceite</b> e <b>ajuste</b> são preenchidos à mão e ficam salvos.</li>
            </ul>
          </details>
        </>
      )}
    </div>
  );
};
