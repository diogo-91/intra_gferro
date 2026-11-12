import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Loader2, Paperclip, RotateCcw, X } from 'lucide-react';

// "Ações" de uma devolução: o atendimento em 5 etapas (SAC, Vera, Dirceu, Decisão, Financeiro), como no PCP.
// Tudo é gravado no PCP (a tela é a mesma), automaticamente, conforme a pessoa preenche.

export interface PrintInfo { id: number; nome: string; criadoEm: string }
export interface AcoesDados {
  sac: { quem: string; conversa: string; prints: PrintInfo[] };
  vera: { conversa: string; prints: PrintInfo[] };
  dirceu: { conversa: string; prints: PrintInfo[] };
  decisao: '' | 'MANTEM' | 'CANCELAR';
  financeiro: { realizada: '' | 'SIM' | 'NAO'; data: string | null };
  feitas: number;
  datas: Record<'sac' | 'vera' | 'dirceu' | 'decisao' | 'financeiro', string | null>;
}
export interface EtapaResumo { chave?: string; nome: string; feita: boolean; detalhe: string; em: string | null }

type Etapa = 'sac' | 'vera' | 'dirceu' | 'decisao' | 'financeiro';
type EtapaComPrint = 'sac' | 'vera' | 'dirceu';
const ORDEM: Etapa[] = ['sac', 'vera', 'dirceu', 'decisao', 'financeiro'];
const NOME_PROXIMA: Record<string, string> = { vera: 'Vera', dirceu: 'Dirceu', decisao: 'Decisão' };
const ETAPAS_TEXTO: Array<{ k: EtapaComPrint; n: number; titulo: string; quem?: boolean }> = [
  { k: 'sac', n: 1, titulo: 'SAC', quem: true },
  { k: 'vera', n: 2, titulo: 'Vera' },
  { k: 'dirceu', n: 3, titulo: 'Dirceu' },
];

interface Textos { sacQuem: string; sacConversa: string; veraConversa: string; dirceuConversa: string }

const dataBr = (iso: string | null) => (iso ? iso.split('-').reverse().join('/') : '');

/** Resumo das 5 etapas (o mesmo que o PCP manda na lista): usado para atualizar a fila na hora, sem esperar a próxima conferência. */
export function etapasDe(d: AcoesDados, textos?: Textos): EtapaResumo[] {
  const t = textos ?? { sacQuem: d.sac.quem, sacConversa: d.sac.conversa, veraConversa: d.vera.conversa, dirceuConversa: d.dirceu.conversa };
  const rot = (txt: string, n: number) => [txt ? (txt.length > 80 ? `${txt.slice(0, 80)}…` : txt) : '', n ? `${n} print${n > 1 ? 's' : ''}` : ''].filter(Boolean).join(' · ');
  const feita = (k: Etapa) => etapaFeita(k, d, t);
  return [
    { nome: 'SAC', em: d.datas.sac, feita: feita('sac'), detalhe: [t.sacQuem && `Atendeu: ${t.sacQuem}`, rot(t.sacConversa, d.sac.prints.length)].filter(Boolean).join(' · ') },
    { nome: 'Vera', em: d.datas.vera, feita: feita('vera'), detalhe: rot(t.veraConversa, d.vera.prints.length) },
    { nome: 'Dirceu', em: d.datas.dirceu, feita: feita('dirceu'), detalhe: rot(t.dirceuConversa, d.dirceu.prints.length) },
    { nome: 'Decisão', em: d.datas.decisao, feita: feita('decisao'), detalhe: d.decisao === 'MANTEM' ? 'Mantém o pedido' : d.decisao === 'CANCELAR' ? 'Cliente quer cancelar' : '' },
    { nome: 'Financeiro', em: d.datas.financeiro, feita: feita('financeiro'), detalhe: d.financeiro.realizada === 'SIM' ? `Devolução realizada${d.financeiro.data ? ` em ${dataBr(d.financeiro.data)}` : ''}` : d.financeiro.realizada === 'NAO' ? 'Devolução ainda não realizada' : '' },
  ];
}

function etapaFeita(k: Etapa, d: AcoesDados, t: Textos): boolean {
  if (k === 'sac') return !!(t.sacQuem || t.sacConversa || d.sac.prints.length);
  if (k === 'vera') return !!(t.veraConversa || d.vera.prints.length);
  if (k === 'dirceu') return !!(t.dirceuConversa || d.dirceu.prints.length);
  if (k === 'decisao') return !!d.decisao;
  return !!d.financeiro.realizada;
}

const lerComoBase64 = (blob: Blob) => new Promise<string>((ok, falha) => {
  const leitor = new FileReader();
  leitor.onload = () => ok(String(leitor.result).split(',')[1] || '');
  leitor.onerror = () => falha(new Error('Não foi possível ler a imagem.'));
  leitor.readAsDataURL(blob);
});

/** Imagens grandes (foto de celular, tela cheia) são reduzidas antes de enviar: o print continua legível e o banco não incha. */
async function prepararImagem(arquivo: File): Promise<{ nome: string; tipo: string; dados: string }> {
  if (!['image/png', 'image/jpeg', 'image/webp', 'image/gif'].includes(arquivo.type)) throw new Error(`"${arquivo.name || 'arquivo'}" não é uma imagem PNG, JPG, WEBP ou GIF.`);
  const nome = arquivo.name && arquivo.name !== 'image.png' ? arquivo.name : `print-${new Date().toLocaleString('pt-BR').replace(/[/:]/g, '-').replace(', ', '_')}.png`;
  if (arquivo.type === 'image/gif' || arquivo.size <= 1_200_000) {
    if (arquivo.size > 4 * 1024 * 1024) throw new Error(`"${nome}" passa de 4 MB.`);
    return { nome, tipo: arquivo.type, dados: await lerComoBase64(arquivo) };
  }
  const bmp = await createImageBitmap(arquivo);
  const escala = Math.min(1, 1800 / Math.max(bmp.width, bmp.height));
  const tela = document.createElement('canvas');
  tela.width = Math.round(bmp.width * escala);
  tela.height = Math.round(bmp.height * escala);
  const ctx = tela.getContext('2d');
  if (!ctx) throw new Error('Não foi possível reduzir a imagem.');
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, tela.width, tela.height);
  ctx.drawImage(bmp, 0, 0, tela.width, tela.height);
  const blob = await new Promise<Blob | null>((ok) => tela.toBlob(ok, 'image/jpeg', 0.85));
  if (!blob) throw new Error('Não foi possível reduzir a imagem.');
  return { nome: nome.replace(/\.[^.]+$/, '') + '.jpg', tipo: 'image/jpeg', dados: await lerComoBase64(blob) };
}

async function chamar<T = any>(url: string, init?: RequestInit): Promise<T> {
  const resposta = await fetch(url, init && init.body ? { ...init, headers: { 'Content-Type': 'application/json' } } : init);
  const corpo = await resposta.json().catch(() => null);
  if (!resposta.ok) throw new Error(corpo?.error || 'Não foi possível concluir a operação.');
  if (corpo === null) throw new Error('O servidor não respondeu como esperado. Atualize a página.');
  return corpo;
}

interface Props {
  devolucao: { id: number; numeroPedido: number; cliente: string };
  onFechar: () => void;
  /** Avisa a tela que as etapas mudaram (a fila e o painel de detalhes se atualizam na hora). */
  onAtualizou: (id: number, etapas: EtapaResumo[], feitas: number) => void;
}

const campoEntrada = 'mt-1 block w-full rounded-[10px] border border-neutral-200 bg-white px-2.5 py-2 text-[13px] font-medium text-neutral-800 outline-none focus:border-yellow-400 focus:ring-2 focus:ring-yellow-300/40';

export const AcoesDevolucao: React.FC<Props> = ({ devolucao, onFechar, onAtualizou }) => {
  const { id } = devolucao;
  const [dados, setDados] = useState<AcoesDados | null>(null);
  const [textos, setTextos] = useState<Textos>({ sacQuem: '', sacConversa: '', veraConversa: '', dirceuConversa: '' });
  const [revelar, setRevelar] = useState(0);
  const [enviando, setEnviando] = useState<Set<string>>(new Set());
  const [salvo, setSalvo] = useState<{ texto: string; erro: boolean }>({ texto: 'Salvo automaticamente', erro: false });
  const [erroCarga, setErroCarga] = useState('');

  const sujo = useRef(new Map<string, unknown>());
  const fila = useRef<Promise<unknown>>(Promise.resolve());
  const temporizador = useRef<ReturnType<typeof setTimeout>>();
  const dadosRef = useRef<AcoesDados | null>(null);
  const textosRef = useRef(textos);
  dadosRef.current = dados;
  textosRef.current = textos;

  const avisar = useCallback((d: AcoesDados) => {
    const e = etapasDe(d, textosRef.current);
    onAtualizou(id, e, e.filter((x) => x.feita).length);
  }, [id, onAtualizou]);

  useEffect(() => {
    let vivo = true;
    chamar<AcoesDados>(`/api/problematicos/devolucoes/${id}/acoes`)
      .then((d) => {
        if (!vivo) return;
        setDados(d);
        setTextos({ sacQuem: d.sac.quem, sacConversa: d.sac.conversa, veraConversa: d.vera.conversa, dirceuConversa: d.dirceu.conversa });
      })
      .catch((e: Error) => vivo && setErroCarga(`Não foi possível abrir as ações: ${e.message}`));
    return () => { vivo = false; };
  }, [id]);

  /** Envia o que foi digitado (uma gravação por vez, na ordem, para uma não passar por cima da outra). */
  const salvar = useCallback((): Promise<unknown> => {
    clearTimeout(temporizador.current);
    if (!sujo.current.size) return fila.current;
    const corpo = Object.fromEntries(sujo.current);
    sujo.current.clear();
    setSalvo({ texto: 'Salvando…', erro: false });
    fila.current = fila.current.then(async () => {
      try {
        const novo = await chamar<AcoesDados>(`/api/problematicos/devolucoes/${id}/acoes`, { method: 'PUT', body: JSON.stringify(corpo) });
        // Os textos continuam os que a pessoa está digitando; o resto (datas, contagem, decisão) vem do servidor.
        setDados(novo);
        avisar(novo);
        setSalvo({ texto: 'Salvo ✓', erro: false });
      } catch (e: any) {
        setSalvo({ texto: `Não salvou: ${e.message}`, erro: true });
      }
    });
    return fila.current;
  }, [id, avisar]);

  const salvarRef = useRef(salvar);
  salvarRef.current = salvar;
  const fechar = async () => { await salvar(); onFechar(); };
  useEffect(() => {
    const aoTeclar = (e: KeyboardEvent) => { if (e.key === 'Escape') void fechar(); };
    window.addEventListener('keydown', aoTeclar);
    return () => window.removeEventListener('keydown', aoTeclar);
  });
  useEffect(() => () => { void salvarRef.current(); }, []); // saiu com algo ainda sem enviar: envia agora

  const digitou = (campo: keyof Textos, valor: string) => {
    setTextos((t) => ({ ...t, [campo]: valor }));
    sujo.current.set(campo, valor);
    setSalvo({ texto: 'Digitando…', erro: false });
    clearTimeout(temporizador.current);
    temporizador.current = setTimeout(() => void salvar(), 900);
  };

  const marcar = (campo: 'decisao' | 'finRealizada' | 'finData', valor: string | null) => {
    if (!dados) return;
    sujo.current.set(campo, valor);
    if (campo === 'decisao') setDados({ ...dados, decisao: valor as AcoesDados['decisao'] });
    if (campo === 'finRealizada') setDados({ ...dados, financeiro: { realizada: valor as 'SIM' | 'NAO', data: valor === 'SIM' ? dados.financeiro.data : null } });
    void salvar();
  };

  // ---- prints ----

  const anexar = async (etapa: EtapaComPrint, arquivos: File[]) => {
    for (const arquivo of arquivos) {
      setEnviando((s) => new Set(s).add(etapa));
      try {
        const img = await prepararImagem(arquivo);
        const novo = await chamar<AcoesDados>(`/api/problematicos/devolucoes/${id}/acoes/prints`, { method: 'POST', body: JSON.stringify({ etapa, nome: img.nome, tipo: img.tipo, dados: img.dados }) });
        setDados(novo);
        avisar(novo);
      } catch (e: any) {
        setSalvo({ texto: e.message, erro: true });
      }
      setEnviando((s) => { const n = new Set(s); n.delete(etapa); return n; });
    }
  };

  const removerPrint = async (printId: number) => {
    if (!window.confirm('Remover este print?')) return;
    try {
      const novo = await chamar<AcoesDados>(`/api/problematicos/prints/${printId}`, { method: 'DELETE' });
      setDados(novo);
      avisar(novo);
    } catch (e: any) {
      setSalvo({ texto: e.message, erro: true });
    }
  };

  // Ctrl+V com uma imagem copiada cai na etapa onde o cursor está.
  const aoColar = (e: React.ClipboardEvent) => {
    const etapa = (e.target as HTMLElement).closest<HTMLElement>('[data-etapa]')?.dataset.etapa;
    if (etapa !== 'sac' && etapa !== 'vera' && etapa !== 'dirceu') return;
    const imagens = [...(e.clipboardData?.files ?? [])].filter((f) => f.type.startsWith('image/'));
    if (!imagens.length) return; // texto comum: segue o fluxo normal
    e.preventDefault();
    void anexar(etapa, imagens);
  };

  // ---- fluxo condicional: cada etapa aparece quando a anterior tem algo (ou em "Próxima etapa", para poder pular uma) ----

  const feita = (k: Etapa) => (dados ? etapaFeita(k, dados, textos) : false);
  const visivel = (k: Etapa) => {
    if (!dados) return false;
    const i = ORDEM.indexOf(k);
    if (i === 0 || feita(k)) return true;
    if (k === 'financeiro') return dados.decisao === 'CANCELAR';
    return feita(ORDEM[i - 1]) || revelar >= i;
  };
  let ultima: Etapa = 'sac';
  for (const k of ORDEM) if (visivel(k) && k !== 'financeiro') ultima = k;
  const proxima = ORDEM[ORDEM.indexOf(ultima) + 1];
  const falta = !!proxima && proxima !== 'financeiro' && !visivel(proxima);
  const totalFeitas = ORDEM.filter(feita).length;

  const miniaturas = (k: EtapaComPrint) => (
    <div className="mt-2 flex flex-wrap gap-2">
      {dados![k].prints.map((p) => (
        <figure key={p.id} className="relative m-0 h-[84px] w-[84px] overflow-hidden rounded-[10px] border border-neutral-200 bg-neutral-100">
          <img src={`/api/problematicos/prints/${p.id}`} alt={p.nome} title={`${p.nome} — clique para ampliar`} onClick={() => window.open(`/api/problematicos/prints/${p.id}`, '_blank', 'noopener')} className="block h-full w-full cursor-zoom-in object-cover" />
          <button type="button" onClick={() => removerPrint(p.id)} aria-label={`Remover print ${p.nome}`} className="absolute right-[3px] top-[3px] flex h-5 w-5 items-center justify-center rounded-full bg-slate-900/80 text-sm leading-none text-white">×</button>
        </figure>
      ))}
      {enviando.has(k) && <span className="self-center text-[11.5px] font-bold text-yellow-700">Enviando…</span>}
    </div>
  );

  const numero = (n: number, ok: boolean) => (
    <span className={`flex h-7 w-7 items-center justify-center rounded-full border border-yellow-400 text-[13px] font-extrabold ${ok ? 'bg-yellow-300 text-neutral-900' : 'bg-yellow-100 text-yellow-800'}`}>{n}</span>
  );
  const opcao = (nome: string, valor: string, texto: string, marcado: boolean, aoMarcar: () => void) => (
    <label key={valor} className="cursor-pointer">
      <input type="radio" name={`ac-${nome}`} value={valor} checked={marcado} onChange={aoMarcar} className="peer sr-only" />
      <span className="inline-block rounded-[10px] border border-neutral-200 bg-white px-3.5 py-2 text-[12.5px] font-bold text-slate-700 peer-checked:border-yellow-400 peer-checked:bg-yellow-300 peer-checked:text-neutral-900 peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-yellow-400">{texto}</span>
    </label>
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-3 backdrop-blur-[2px]" onClick={() => void fechar()}>
      <div role="dialog" aria-modal="true" aria-label="Ações da devolução" className="max-h-[92vh] w-full max-w-[640px] overflow-auto rounded-[20px] bg-white shadow-2xl" onClick={(e) => e.stopPropagation()} onPaste={aoColar}>
        <div className="flex items-center gap-3 px-5 pb-3 pt-4">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700"><RotateCcw className="h-5 w-5" aria-hidden="true" /></span>
          <div className="min-w-0">
            <h2 className="text-base font-extrabold tracking-tight text-neutral-900">Ações da devolução</h2>
            <p className="mt-0.5 truncate text-xs text-neutral-500">Pedido <b>{devolucao.numeroPedido}</b>{devolucao.cliente ? ` · ${devolucao.cliente}` : ''}</p>
          </div>
          <button type="button" onClick={() => void fechar()} aria-label="Fechar" className="ml-auto flex h-8 w-8 shrink-0 items-center justify-center self-start rounded-full bg-neutral-100 text-neutral-600 hover:bg-neutral-200"><X className="h-4 w-4" aria-hidden="true" /></button>
        </div>

        {erroCarga ? (
          <p role="alert" className="px-5 pb-6 text-xs font-semibold text-red-700">{erroCarga}</p>
        ) : !dados ? (
          <div className="flex justify-center py-12"><Loader2 className="h-5 w-5 animate-spin text-neutral-400" aria-label="Carregando" /></div>
        ) : (
          <>
            <div className="mx-5 mb-1 flex items-center gap-3 text-[11.5px] font-bold text-slate-500">
              <div className="flex max-w-[220px] flex-1 gap-1">{ORDEM.map((k) => <i key={k} className={`h-1.5 flex-1 rounded-[3px] ${feita(k) ? 'bg-yellow-400' : 'bg-slate-200'}`} />)}</div>
              <span>{totalFeitas} de 5 etapas preenchidas</span>
            </div>

            <div className="px-5 pb-1.5 pt-1">
              {ETAPAS_TEXTO.filter((e) => visivel(e.k)).map((e) => (
                <section key={e.k} data-etapa={e.k} className="grid grid-cols-[30px_minmax(0,1fr)] gap-3 border-t border-slate-100 py-3.5">
                  {numero(e.n, feita(e.k))}
                  <div>
                    <h3 className="mb-2 mt-[3px] text-[13.5px] font-extrabold text-neutral-900">Etapa {e.n} — {e.titulo}</h3>
                    {e.quem && (
                      <label className="mb-2 block text-[11.5px] font-bold text-slate-500">Quem falou com o cliente?
                        <input value={textos.sacQuem} maxLength={120} placeholder="Nome de quem atendeu" onChange={(ev) => digitou('sacQuem', ev.target.value)} onBlur={() => void salvar()} className={campoEntrada} />
                      </label>
                    )}
                    <label className="mb-2 block text-[11.5px] font-bold text-slate-500">O que foi conversado
                      <textarea value={textos[`${e.k}Conversa` as keyof Textos]} rows={3} maxLength={3000} placeholder="Resumo da conversa" onChange={(ev) => digitou(`${e.k}Conversa` as keyof Textos, ev.target.value)} onBlur={() => void salvar()} className={`${campoEntrada} resize-y`} />
                    </label>
                    <div className="mt-0.5 flex items-center gap-2.5">
                      <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-[10px] border border-dashed border-yellow-400 bg-yellow-50 px-3 py-1.5 text-xs font-extrabold text-yellow-900 hover:bg-yellow-100">
                        <Paperclip className="h-3.5 w-3.5" aria-hidden="true" /> Anexar print
                        <input type="file" accept="image/png,image/jpeg,image/webp,image/gif" multiple hidden onChange={(ev) => { const arquivos = [...(ev.target.files ?? [])]; ev.target.value = ''; void anexar(e.k, arquivos); }} />
                      </label>
                      <span className="text-[11px] text-slate-400">ou cole com Ctrl+V</span>
                    </div>
                    {miniaturas(e.k)}
                  </div>
                </section>
              ))}

              {visivel('decisao') && (
                <section data-etapa="decisao" className="grid grid-cols-[30px_minmax(0,1fr)] gap-3 border-t border-slate-100 py-3.5">
                  {numero(4, feita('decisao'))}
                  <div>
                    <h3 className="mb-2 mt-[3px] text-[13.5px] font-extrabold text-neutral-900">Etapa 4 — Decisão</h3>
                    <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Decisão">
                      {opcao('decisao', 'MANTEM', 'Mantém o pedido', dados.decisao === 'MANTEM', () => marcar('decisao', 'MANTEM'))}
                      {opcao('decisao', 'CANCELAR', 'Cliente quer cancelar mesmo', dados.decisao === 'CANCELAR', () => marcar('decisao', 'CANCELAR'))}
                    </div>
                  </div>
                </section>
              )}

              {visivel('financeiro') && (
                <section data-etapa="financeiro" className="grid grid-cols-[30px_minmax(0,1fr)] gap-3 border-t border-slate-100 py-3.5">
                  {numero(5, feita('financeiro'))}
                  <div>
                    <h3 className="mb-2 mt-[3px] text-[13.5px] font-extrabold text-neutral-900">Etapa 5 — Financeiro</h3>
                    <div className="mb-2 text-[11.5px] font-bold text-slate-500">Devolução realizada?
                      <div className="mt-1 flex flex-wrap gap-2" role="radiogroup" aria-label="Devolução realizada">
                        {opcao('finRealizada', 'SIM', 'Sim', dados.financeiro.realizada === 'SIM', () => marcar('finRealizada', 'SIM'))}
                        {opcao('finRealizada', 'NAO', 'Não', dados.financeiro.realizada === 'NAO', () => marcar('finRealizada', 'NAO'))}
                      </div>
                    </div>
                    {dados.financeiro.realizada === 'SIM' && (
                      <label className="block text-[11.5px] font-bold text-slate-500">Qual foi a data?
                        <input
                          type="date"
                          min="2000-01-01"
                          max="2100-12-31"
                          value={dados.financeiro.data || ''}
                          onChange={(ev) => {
                            const v = ev.target.value;
                            if (v && !/^(20\d\d)-\d\d-\d\d$/.test(v)) return; // ano ainda sendo digitado
                            setDados({ ...dados, financeiro: { ...dados.financeiro, data: v || null } });
                            marcar('finData', v || null);
                          }}
                          className={`${campoEntrada} !w-auto min-w-[170px]`}
                        />
                      </label>
                    )}
                  </div>
                </section>
              )}
            </div>

            <div className="px-5 pb-1">
              {falta && (
                <button type="button" onClick={() => setRevelar(ORDEM.indexOf(proxima))} className="h-9 rounded-[10px] border border-yellow-400 bg-yellow-100 px-3.5 text-[12.5px] font-extrabold text-yellow-900 hover:bg-yellow-200">
                  Próxima etapa: {NOME_PROXIMA[proxima]} ›
                </button>
              )}
              {visivel('decisao') && dados.decisao === 'MANTEM' && (
                <p className="mt-2 text-[11.5px] text-slate-500">Como o pedido foi mantido, não há devolução a fazer: a etapa Financeiro só aparece se o cliente quiser cancelar.</p>
              )}
            </div>

            <div className="flex items-center justify-between gap-2.5 border-t border-slate-100 px-5 pb-4 pt-3">
              <span role="status" className={`text-[11.5px] font-bold ${salvo.erro ? 'text-red-700' : 'text-slate-500'}`}>{salvo.texto}</span>
              <button type="button" onClick={() => void fechar()} className="inline-flex h-[38px] items-center rounded-[10px] border border-neutral-200 bg-white px-[18px] text-[13px] font-bold text-neutral-700 hover:border-yellow-400 hover:bg-yellow-50">Fechar</button>
            </div>
          </>
        )}
      </div>
    </div>
  );
};
