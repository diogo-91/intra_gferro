import React, { useCallback, useEffect, useRef, useState } from 'react';
import { AlertTriangle, Handshake, Loader2, Plus, Search, Trash2, X } from 'lucide-react';
import { formatDataIsoParaBr } from '../utils/format';

// Pedidos combinados: pedidos cuja entrega foi combinada com alguém. Busca o pedido (entre os liberados no Nomus), mostra os
// dados dele numa linha da tabela e pede só duas coisas: com quem foi combinado e o prazo combinado.

interface Combinado {
  id: number;
  codigo: string;
  cliente: string;
  vendedor: string;
  loja: string;
  valorTotal: number;
  combinadoCom: string;
  prazoCombinado: string;
  criadoEm: string;
  criadoPor: string;
  atualizadoEm: string;
  atualizadoPor: string;
  prazoAtual: string | null;
  fontePrazoAtual: 'gferro' | 'nomus' | null;
  liberado: boolean;
}

interface PedidoEncontrado {
  codigo: string;
  cliente: string;
  vendedor: string;
  loja: string;
  valorTotal: number;
  dataEmissao: string;
  prazoAtual: string | null;
  fontePrazoAtual: 'gferro' | 'nomus' | null;
  jaCombinadoId: number | null;
}

const BASE = '/api/dashboard/pedidos-combinados';
const hojeSP = () => new Date().toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' });
const quando = (iso: string) => new Date(iso).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo', day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
const semAcento = (t: string) => t.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase();
const brl = (n: number) => n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

async function chamar<T = any>(url: string, init?: RequestInit): Promise<T> {
  const resposta = await fetch(url, init && init.body ? { ...init, headers: { 'Content-Type': 'application/json' } } : init);
  const corpo = await resposta.json().catch(() => null);
  if (!resposta.ok) throw new Error(corpo?.error || 'Não foi possível concluir a operação.');
  if (corpo === null) throw new Error('O servidor não respondeu como esperado. Atualize a página.');
  return corpo;
}

const cabecalho = 'sticky top-0 z-[1] whitespace-nowrap border-b border-neutral-100 bg-neutral-50 px-3 py-2.5 text-left text-[11px] font-extrabold text-neutral-600';
const celula = 'border-b border-neutral-100 px-3 py-2.5 align-middle';
const entrada = 'h-9 w-full rounded-[10px] border border-neutral-200 bg-white px-2.5 text-xs font-medium text-neutral-900 outline-none focus:border-yellow-400 focus:ring-2 focus:ring-yellow-300/40';
const fontePrazo = (f: 'gferro' | 'nomus' | null) => (f === 'gferro' ? 'prazo PCP' : f === 'nomus' ? 'prazo Nomus' : '');

export const PedidosCombinados: React.FC = () => {
  const [registros, setRegistros] = useState<Combinado[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [pedidosCarregando, setPedidosCarregando] = useState(false);
  const [erro, setErro] = useState('');
  const [aviso, setAviso] = useState('');
  const [filtro, setFiltro] = useState('');

  // busca e linha nova
  const [busca, setBusca] = useState('');
  const [resultados, setResultados] = useState<PedidoEncontrado[] | null>(null);
  const [buscando, setBuscando] = useState(false);
  const [erroBusca, setErroBusca] = useState('');
  const [escolhido, setEscolhido] = useState<PedidoEncontrado | null>(null);
  const [combinadoCom, setCombinadoCom] = useState('');
  const [prazo, setPrazo] = useState('');
  const [erroForm, setErroForm] = useState('');
  const [salvando, setSalvando] = useState(false);

  const temporizador = useRef<ReturnType<typeof setTimeout>>();
  const buscaAtual = useRef('');
  const campoBusca = useRef<HTMLInputElement>(null);
  const campoComQuem = useRef<HTMLInputElement>(null);
  const hoje = hojeSP();

  const carregar = useCallback(async () => {
    try {
      const r = await chamar<{ registros: Combinado[]; pedidosCarregando: boolean }>(BASE);
      setRegistros(r.registros);
      setPedidosCarregando(r.pedidosCarregando);
      setErro('');
    } catch (e: any) {
      setErro(e.message);
    } finally {
      setCarregando(false);
    }
  }, []);
  useEffect(() => { carregar(); }, [carregar]);
  useEffect(() => { if (escolhido) campoComQuem.current?.focus(); }, [escolhido]); // o cursor vai para "com quem foi combinado"
  useEffect(() => { if (!aviso) return; const t = setTimeout(() => setAviso(''), 5000); return () => clearTimeout(t); }, [aviso]);

  const pesquisar = (texto: string) => {
    setBusca(texto);
    buscaAtual.current = texto;
    clearTimeout(temporizador.current);
    if (!texto.trim()) { setResultados(null); setErroBusca(''); setBuscando(false); return; }
    setBuscando(true);
    temporizador.current = setTimeout(async () => {
      try {
        const achados = await chamar<PedidoEncontrado[]>(`${BASE}/buscar?q=${encodeURIComponent(texto)}`);
        if (buscaAtual.current !== texto) return;
        setResultados(achados);
        setErroBusca('');
      } catch (e: any) {
        if (buscaAtual.current !== texto) return;
        setResultados([]);
        setErroBusca(e.message);
      } finally {
        if (buscaAtual.current === texto) setBuscando(false);
      }
    }, 250);
  };

  const escolher = (pedido: PedidoEncontrado) => {
    setResultados(null);
    setBusca('');
    setErroForm('');
    if (pedido.jaCombinadoId !== null) {
      setEscolhido(null);
      setAviso(`O pedido ${pedido.codigo} já está na lista: edite o combinado dele na tabela.`);
      return;
    }
    setEscolhido(pedido);
    setCombinadoCom('');
    setPrazo('');
  };

  const cancelarNovo = () => { setEscolhido(null); setErroForm(''); setTimeout(() => campoBusca.current?.focus(), 0); };

  const salvarNovo = async () => {
    if (!escolhido) return;
    setErroForm('');
    if (!combinadoCom.trim()) return setErroForm('Informe com quem foi combinado.');
    if (!prazo) return setErroForm('Informe o prazo combinado.');
    setSalvando(true);
    try {
      await chamar<Combinado>(BASE, { method: 'POST', body: JSON.stringify({ codigo: escolhido.codigo, combinadoCom, prazoCombinado: prazo }) });
      setAviso(`Pedido ${escolhido.codigo} adicionado aos combinados.`);
      setEscolhido(null);
      await carregar();
      setTimeout(() => campoBusca.current?.focus(), 0);
    } catch (e: any) {
      setErroForm(e.message);
    } finally {
      setSalvando(false);
    }
  };

  const editar = async (registro: Combinado, campo: 'combinadoCom' | 'prazoCombinado', valor: string) => {
    const novo = valor.trim();
    if (novo === registro[campo]) return;
    if (campo === 'prazoCombinado' && !/^(20\d\d)-\d\d-\d\d$/.test(novo)) return; // ano ainda sendo digitado
    if (!novo) { setErro(campo === 'combinadoCom' ? 'Informe com quem foi combinado.' : 'Informe o prazo combinado.'); await carregar(); return; }
    try {
      const atualizado = await chamar<Combinado>(`${BASE}/${registro.id}`, { method: 'PATCH', body: JSON.stringify({ [campo]: novo }) });
      setRegistros((atual) => atual.map((r) => (r.id === registro.id ? atualizado : r)));
      setErro('');
    } catch (e: any) {
      setErro(e.message);
      carregar(); // volta o que estava gravado
    }
  };

  const remover = async (registro: Combinado) => {
    if (!window.confirm(`Remover o pedido ${registro.codigo} dos combinados?`)) return;
    try {
      await chamar(`${BASE}/${registro.id}`, { method: 'DELETE' });
      setRegistros((atual) => atual.filter((r) => r.id !== registro.id));
      setErro('');
    } catch (e: any) {
      setErro(e.message);
    }
  };

  const q = semAcento(filtro.trim());
  const lista = q ? registros.filter((r) => semAcento(`${r.codigo} ${r.cliente} ${r.vendedor} ${r.loja} ${r.combinadoCom}`).includes(q)) : registros;

  return (
    <div className="space-y-4">
      {/* Cabeçalho */}
      <div className="flex items-start gap-3">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[13px] bg-gradient-to-br from-yellow-200 to-yellow-100 shadow-md shadow-yellow-400/20">
          <Handshake className="h-[22px] w-[22px] text-yellow-500" aria-hidden="true" />
        </span>
        <div>
          <span className="text-[10px] font-bold uppercase tracking-[0.12em] text-neutral-500">Dashboard › Pedidos › <b className="text-neutral-900">Combinados</b></span>
          <h1 className="text-[22px] font-black leading-tight tracking-tight text-neutral-900">Pedidos combinados</h1>
          <p className="mt-1 max-w-3xl text-xs leading-snug text-neutral-500">
            Busque o pedido pelo número ou pelo cliente: os dados dele aparecem na tabela. Informe com quem a entrega foi combinada e o prazo combinado.
          </p>
        </div>
      </div>

      {erro && (
        <div role="alert" className="flex gap-2 rounded-xl border border-red-200 bg-red-50 p-3 text-xs text-red-700">
          <AlertTriangle className="h-4 w-4 shrink-0" aria-hidden="true" /> {erro}
        </div>
      )}
      {aviso && <div role="status" className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-xs font-semibold text-emerald-800">{aviso}</div>}

      {/* Busca do pedido */}
      <section className="rounded-2xl border border-neutral-200 bg-white p-4 shadow-sm" aria-label="Buscar pedido">
        <label className="block text-xs font-bold text-neutral-700" htmlFor="pc-busca">Buscar pedido</label>
        <div className="relative mt-1.5 max-w-xl">
          <div className="flex h-10 items-center gap-2 rounded-[10px] border border-neutral-200 bg-white px-3 focus-within:border-yellow-400 focus-within:ring-2 focus-within:ring-yellow-300/40">
            <Search className="h-[18px] w-[18px] shrink-0 text-neutral-400" aria-hidden="true" />
            <input
              id="pc-busca"
              ref={campoBusca}
              type="search"
              autoComplete="off"
              value={busca}
              onChange={(e) => pesquisar(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); if (resultados?.[0]) escolher(resultados[0]); } if (e.key === 'Escape') setResultados(null); }}
              placeholder="Nº do pedido, cliente ou vendedor"
              className="h-full min-w-0 flex-1 bg-transparent text-[13px] outline-none"
            />
            {buscando && <Loader2 className="h-4 w-4 animate-spin text-neutral-400" aria-label="Buscando" />}
          </div>
          {resultados && (
            <ul className="absolute left-0 right-0 top-full z-20 mt-1 max-h-72 overflow-auto rounded-xl border border-neutral-200 bg-white p-1 shadow-lg">
              {resultados.length === 0 ? (
                <li className="px-3 py-2 text-xs text-neutral-500">{erroBusca || (pedidosCarregando ? 'Os pedidos ainda estão sendo lidos do Nomus. Tente de novo em instantes.' : 'Nenhum pedido liberado encontrado.')}</li>
              ) : resultados.map((p) => (
                <li key={p.codigo}>
                  <button type="button" onClick={() => escolher(p)} className="grid w-full grid-cols-[88px_minmax(0,1fr)_auto] items-center gap-2 rounded-lg px-3 py-2 text-left text-[13px] text-neutral-700 hover:bg-yellow-50 focus:bg-yellow-50 focus:outline-none">
                    <b>{p.codigo}</b>
                    <span className="truncate">{p.cliente}<small className="ml-1.5 text-[11px] text-neutral-400">{p.vendedor}</small></span>
                    {p.jaCombinadoId !== null && <em className="rounded bg-yellow-100 px-1.5 text-[10px] not-italic font-bold text-yellow-800">já combinado</em>}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
        {pedidosCarregando && <p className="mt-2 text-[11px] text-neutral-400">Lendo os pedidos do Nomus pela primeira vez… a busca funciona assim que terminar.</p>}
      </section>

      {/* Tabela: linha nova (pedido escolhido) + combinados cadastrados */}
      <section className="rounded-2xl border border-neutral-200 bg-white p-4 shadow-sm" aria-label="Pedidos combinados">
        <div className="mb-3 flex flex-wrap items-center gap-2.5">
          <h2 className="text-[15px] font-extrabold tracking-tight text-neutral-900">Combinados <span className="text-[13px] font-semibold text-slate-400">({lista.length})</span></h2>
          <label className="relative ml-auto block w-full max-w-[260px]">
            <span className="sr-only">Filtrar a lista</span>
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-400" aria-hidden="true" />
            <input type="search" value={filtro} onChange={(e) => setFiltro(e.target.value)} placeholder="Filtrar a lista" className={`${entrada} pl-9`} />
          </label>
        </div>

        {carregando ? (
          <div className="flex justify-center py-10"><Loader2 className="h-5 w-5 animate-spin text-neutral-400" aria-label="Carregando" /></div>
        ) : (
          <div className="overflow-auto rounded-xl border border-neutral-100">
            <table className="w-full min-w-[980px] border-separate border-spacing-0 text-xs">
              <thead>
                <tr>
                  <th scope="col" className={cabecalho}>Pedido</th>
                  <th scope="col" className={cabecalho}>Cliente</th>
                  <th scope="col" className={cabecalho}>Vendedor / Loja</th>
                  <th scope="col" className={`${cabecalho} text-right`}>Valor</th>
                  <th scope="col" className={cabecalho}>Prazo atual</th>
                  <th scope="col" className={cabecalho}>Combinado com</th>
                  <th scope="col" className={cabecalho}>Prazo combinado</th>
                  <th scope="col" className={cabecalho}><span className="sr-only">Ações</span></th>
                </tr>
              </thead>
              <tbody>
                {escolhido && (
                  <tr className="bg-yellow-50">
                    <td className={celula}><b className="text-neutral-900">{escolhido.codigo}</b><span className="block text-[11px] text-neutral-400">emitido em {formatDataIsoParaBr(escolhido.dataEmissao)}</span></td>
                    <td className={`${celula} max-w-[200px]`}>{escolhido.cliente}</td>
                    <td className={celula}>{escolhido.vendedor}<span className="block text-[11px] text-neutral-400">{escolhido.loja}</span></td>
                    <td className={`${celula} text-right tabular-nums`}>{brl(escolhido.valorTotal)}</td>
                    <td className={celula}>{escolhido.prazoAtual ? <>{formatDataIsoParaBr(escolhido.prazoAtual)}<span className="block text-[11px] text-neutral-400">{fontePrazo(escolhido.fontePrazoAtual)}</span></> : <span className="text-slate-300">—</span>}</td>
                    <td className={celula}>
                      <input ref={campoComQuem} value={combinadoCom} maxLength={120} onChange={(e) => setCombinadoCom(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); void salvarNovo(); } }} placeholder="Com quem foi combinado" aria-label="Com quem foi combinado" className={`${entrada} min-w-[170px]`} />
                    </td>
                    <td className={celula}>
                      <input type="date" value={prazo} min="2000-01-01" max="2100-12-31" onChange={(e) => setPrazo(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); void salvarNovo(); } }} aria-label="Prazo combinado" className={`${entrada} min-w-[140px]`} />
                    </td>
                    <td className={`${celula} whitespace-nowrap text-right`}>
                      <button type="button" onClick={() => void salvarNovo()} disabled={salvando} className="inline-flex items-center gap-1 rounded-[10px] bg-gradient-to-b from-yellow-300 to-yellow-400 px-3 py-1.5 text-xs font-extrabold text-neutral-900 shadow-sm hover:brightness-105 disabled:opacity-50">
                        {salvando ? <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" /> : <Plus className="h-3.5 w-3.5" aria-hidden="true" />} Adicionar
                      </button>
                      <button type="button" onClick={cancelarNovo} aria-label="Cancelar" title="Cancelar" className="ml-1.5 inline-flex h-8 w-8 items-center justify-center rounded-full text-neutral-500 hover:bg-neutral-100"><X className="h-4 w-4" aria-hidden="true" /></button>
                    </td>
                  </tr>
                )}
                {escolhido && erroForm && (
                  <tr><td colSpan={8} role="alert" className="bg-yellow-50 px-3 pb-2 text-xs font-semibold text-red-700">{erroForm}</td></tr>
                )}

                {lista.map((r) => {
                  const vencido = r.prazoCombinado < hoje;
                  return (
                    <tr key={r.id} className="group hover:bg-yellow-50/50">
                      <td className={celula}><b className="text-neutral-900">{r.codigo}</b>{!r.liberado && <span className="block text-[10.5px] font-semibold text-slate-400">fora dos liberados</span>}</td>
                      <td className={`${celula} max-w-[200px]`}>{r.cliente}</td>
                      <td className={celula}>{r.vendedor}<span className="block text-[11px] text-neutral-400">{r.loja}</span></td>
                      <td className={`${celula} text-right tabular-nums`}>{brl(r.valorTotal)}</td>
                      <td className={celula}>{r.prazoAtual ? <>{formatDataIsoParaBr(r.prazoAtual)}<span className="block text-[11px] text-neutral-400">{fontePrazo(r.fontePrazoAtual)}</span></> : <span className="text-slate-300">—</span>}</td>
                      <td className={celula}>
                        <input
                          key={`${r.id}-com-${r.combinadoCom}`}
                          defaultValue={r.combinadoCom}
                          maxLength={120}
                          aria-label={`Combinado com, pedido ${r.codigo}`}
                          onBlur={(e) => void editar(r, 'combinadoCom', e.target.value)}
                          onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }}
                          className="h-8 w-full min-w-[170px] rounded-[10px] border border-transparent bg-transparent px-2 text-xs text-neutral-800 hover:border-neutral-200 hover:bg-white focus:border-yellow-400 focus:bg-yellow-50/40 focus:outline-none focus:ring-2 focus:ring-yellow-300/40"
                        />
                        <span className="block px-2 text-[10.5px] text-neutral-400" title={`Atualizado ${quando(r.atualizadoEm)} por ${r.atualizadoPor}`}>por {r.criadoPor} · {quando(r.criadoEm)}</span>
                      </td>
                      <td className={celula}>
                        <input
                          key={`${r.id}-prazo-${r.prazoCombinado}`}
                          type="date"
                          defaultValue={r.prazoCombinado}
                          min="2000-01-01"
                          max="2100-12-31"
                          aria-label={`Prazo combinado, pedido ${r.codigo}`}
                          onChange={(e) => void editar(r, 'prazoCombinado', e.target.value)}
                          className={`h-8 min-w-[140px] rounded-[10px] border border-transparent bg-transparent px-2 text-xs hover:border-neutral-200 hover:bg-white focus:border-yellow-400 focus:bg-yellow-50/40 focus:outline-none focus:ring-2 focus:ring-yellow-300/40 ${vencido ? 'font-bold text-red-700' : 'text-neutral-800'}`}
                        />
                        {vencido && <span className="block px-2 text-[10.5px] font-semibold text-red-700">prazo combinado vencido</span>}
                      </td>
                      <td className={`${celula} text-right`}>
                        <button type="button" onClick={() => void remover(r)} aria-label={`Remover o pedido ${r.codigo}`} title="Remover dos combinados" className="inline-flex items-center gap-1.5 rounded-[10px] border border-neutral-200 bg-white px-2.5 py-1 text-[11px] font-bold text-neutral-600 hover:border-red-300 hover:bg-red-50 hover:text-red-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-red-400">
                          <Trash2 className="h-3.5 w-3.5" aria-hidden="true" /> Remover
                        </button>
                      </td>
                    </tr>
                  );
                })}

                {lista.length === 0 && !escolhido && (
                  <tr>
                    <td colSpan={8} className="px-3 py-10 text-center">
                      <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-yellow-100 text-yellow-500"><Handshake className="h-6 w-6" aria-hidden="true" /></span>
                      <p className="mt-2 text-sm font-extrabold text-neutral-900">{registros.length > 0 ? 'Nenhum combinado com esse filtro.' : 'Nenhum pedido combinado ainda.'}</p>
                      <p className="mt-0.5 text-xs text-neutral-500">{registros.length > 0 ? 'Limpe o filtro para ver todos.' : 'Busque um pedido acima para adicionar o primeiro.'}</p>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
        <p className="mt-2 text-[11px] text-neutral-400">Cliente, vendedor, valor e prazo atual acompanham o Nomus e o PCP enquanto o pedido está liberado.</p>
      </section>
    </div>
  );
};
