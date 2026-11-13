import React, { useCallback, useEffect, useState } from 'react';
import { AlertTriangle, Handshake, Loader2, Search } from 'lucide-react';
import { formatDataIsoParaBr } from '../utils/format';

// Pedidos combinados: os pedidos liberados no Nomus cuja observação cita o Dirceu (a equipe marca assim os pedidos
// liberados por ele). A lista é montada sozinha pelo servidor; aqui se busca e se filtra.

type Situacao = 'atrasado' | 'vence-em-breve' | 'no-prazo' | 'sem-prazo' | 'entregue-pcp' | 'cancelado-pcp';

interface PedidoCombinado {
  id: number;
  codigo: string;
  cliente: string;
  vendedor: string;
  loja: string;
  dataEmissao: string;
  valorTotal: number;
  prazo: string | null;
  fontePrazo: 'gferro' | 'nomus' | null;
  situacao: Situacao;
  diasAtraso: number;
  diasParaPrazo: number | null;
  observacao: string;
}

interface Resposta {
  atualizadoEm: string;
  carregando?: boolean;
  atualizando?: boolean;
  observacoesPendentes?: boolean;
  erroAtualizacao?: string;
  pedidos: PedidoCombinado[];
}

// Última resposta guardada na memória do navegador: ao voltar para a tela ela já aparece cheia e é atualizada em segundo plano.
let ultimaResposta: Resposta | null = null;

const brl = (n: number) => n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const semAcento = (t: string) => t.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase();
const plural = (n: number, um: string, varios: string) => `${n} ${n === 1 ? um : varios}`;
const fontePrazo = (f: PedidoCombinado['fontePrazo']) => (f === 'gferro' ? 'prazo PCP' : f === 'nomus' ? 'prazo Nomus' : '');

const SITUACOES: Array<{ valor: 'todos' | Situacao; nome: string }> = [
  { valor: 'todos', nome: 'Todos' },
  { valor: 'atrasado', nome: 'Atrasados' },
  { valor: 'vence-em-breve', nome: 'Vence em breve' },
  { valor: 'no-prazo', nome: 'Dentro do prazo' },
  { valor: 'entregue-pcp', nome: 'Entregues no PCP' },
];

function badge(p: PedidoCombinado): { texto: string; classe: string } {
  switch (p.situacao) {
    case 'atrasado': return { texto: `Atrasado há ${plural(p.diasAtraso, 'dia', 'dias')}`, classe: 'bg-red-100 text-red-700' };
    case 'vence-em-breve': return { texto: p.diasParaPrazo === 0 ? 'Vence hoje' : `Vence em ${plural(p.diasParaPrazo ?? 0, 'dia', 'dias')}`, classe: 'bg-yellow-100 text-yellow-800' };
    case 'no-prazo': return { texto: 'Dentro do prazo', classe: 'bg-emerald-100 text-emerald-700' };
    case 'entregue-pcp': return { texto: 'Entregue no PCP', classe: 'bg-sky-100 text-sky-700' };
    case 'cancelado-pcp': return { texto: 'Cancelado no PCP', classe: 'bg-slate-200 text-slate-600' };
    default: return { texto: 'Sem prazo', classe: 'bg-slate-100 text-slate-600' };
  }
}

/** Mostra o texto da observação com o nome do Dirceu em destaque. */
function comDestaque(texto: string): React.ReactNode {
  return texto.split(/(dirceu)/i).map((parte, i) => (/^dirceu$/i.test(parte) ? <mark key={i} className="rounded bg-yellow-200 px-0.5 font-bold text-neutral-900">{parte}</mark> : <React.Fragment key={i}>{parte}</React.Fragment>));
}

const cabecalho = 'sticky top-0 z-[1] whitespace-nowrap border-b border-neutral-100 bg-neutral-50 px-3 py-2.5 text-left text-[11px] font-extrabold text-neutral-600';
const celula = 'border-b border-neutral-100 px-3 py-2.5 align-top';

export const PedidosCombinados: React.FC = () => {
  const [dados, setDados] = useState<Resposta | null>(ultimaResposta);
  const [erro, setErro] = useState('');
  const [busca, setBusca] = useState('');
  const [situacao, setSituacao] = useState<'todos' | Situacao>('todos');

  const carregar = useCallback(async () => {
    try {
      const resposta = await fetch('/api/dashboard/pedidos-combinados');
      const corpo = await resposta.json().catch(() => null);
      if (!resposta.ok || !corpo || !Array.isArray(corpo.pedidos)) throw new Error(corpo?.error || 'Não foi possível carregar os pedidos combinados.');
      ultimaResposta = corpo;
      setDados(corpo);
      setErro('');
    } catch (e: any) {
      setErro(e.message);
    }
  }, []);

  // Enquanto o servidor ainda lê o Nomus a tela pergunta de novo logo; depois, a cada minuto.
  const lendo = !!dados && (!!dados.carregando || !!dados.observacoesPendentes);
  useEffect(() => { carregar(); }, [carregar]);
  useEffect(() => {
    const t = setInterval(() => { if (!document.hidden) carregar(); }, lendo ? 15_000 : 60_000);
    return () => clearInterval(t);
  }, [carregar, lendo]);

  const todos = dados?.pedidos ?? [];
  const q = semAcento(busca.trim());
  const lista = todos.filter((p) => (situacao === 'todos' || p.situacao === situacao) && (!q || semAcento(`${p.codigo} ${p.cliente} ${p.vendedor} ${p.loja} ${p.observacao}`).includes(q)));
  const contagem = (s: 'todos' | Situacao) => (s === 'todos' ? todos.length : todos.filter((p) => p.situacao === s).length);
  const valorTotal = lista.reduce((soma, p) => soma + p.valorTotal, 0);

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
            Pedidos liberados no Nomus cuja observação cita o <b>Dirceu</b>. Para um pedido entrar aqui, escreva o nome do Dirceu na observação do pedido no Nomus: ele aparece sozinho em poucos minutos, com o prazo combinado.
          </p>
        </div>
      </div>

      {erro && (
        <div role="alert" className="flex gap-2 rounded-xl border border-red-200 bg-red-50 p-3 text-xs text-red-700">
          <AlertTriangle className="h-4 w-4 shrink-0" aria-hidden="true" /> {erro}
        </div>
      )}
      {dados?.erroAtualizacao && (
        <div role="status" className="rounded-xl border border-yellow-200 bg-yellow-50 p-3 text-xs font-semibold text-yellow-800">A última atualização com o Nomus falhou; a lista é a da última leitura. ({dados.erroAtualizacao})</div>
      )}
      {lendo && (
        <div role="status" className="flex items-center gap-2 rounded-xl border border-yellow-200 bg-yellow-50 p-3 text-xs font-semibold text-yellow-800">
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
          {dados?.carregando ? 'Lendo os pedidos do Nomus pela primeira vez…' : 'Lendo as observações dos pedidos no Nomus (leva alguns minutos): a lista pode crescer.'}
        </div>
      )}

      <section className="rounded-2xl border border-neutral-200 bg-white p-4 shadow-sm" aria-label="Pedidos combinados">
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <label className="relative block min-w-[240px] max-w-sm flex-1">
            <span className="sr-only">Buscar pedido</span>
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-400" aria-hidden="true" />
            <input type="search" value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar pedido, cliente, vendedor ou observação" className="h-9 w-full rounded-[10px] border border-neutral-200 bg-white pl-9 pr-3 text-xs text-neutral-800 outline-none focus:border-yellow-400 focus:ring-2 focus:ring-yellow-300/40" />
          </label>
          <div className="flex flex-wrap gap-1.5" role="group" aria-label="Situação">
            {SITUACOES.map((s) => (
              <button key={s.valor} type="button" onClick={() => setSituacao(s.valor)} aria-pressed={situacao === s.valor} className={`rounded-full border px-3 py-1.5 text-[11.5px] font-bold ${situacao === s.valor ? 'border-yellow-500 bg-yellow-300 text-neutral-900' : 'border-neutral-200 bg-white text-slate-600 hover:border-yellow-400'}`}>
                {s.nome} ({contagem(s.valor)})
              </button>
            ))}
          </div>
          <span className="ml-auto inline-flex items-center gap-1.5 text-[11px] text-neutral-400">
            {plural(lista.length, 'pedido', 'pedidos')} · {brl(valorTotal)}
            {dados && <span title="Hora da última leitura do Nomus">· Nomus às {new Date(dados.atualizadoEm).toLocaleTimeString('pt-BR', { timeZone: 'America/Sao_Paulo', hour: '2-digit', minute: '2-digit' })}</span>}
            {dados?.atualizando && <Loader2 className="h-3 w-3 animate-spin" aria-label="Atualizando em segundo plano" />}
          </span>
        </div>

        {!dados && !erro ? (
          <div className="flex justify-center py-10"><Loader2 className="h-5 w-5 animate-spin text-neutral-400" aria-label="Carregando" /></div>
        ) : (
          <div className="max-h-[640px] overflow-auto rounded-xl border border-neutral-100">
            <table className="w-full min-w-[980px] border-separate border-spacing-0 text-xs">
              <thead>
                <tr>
                  <th scope="col" className={cabecalho}>Pedido</th>
                  <th scope="col" className={cabecalho}>Cliente</th>
                  <th scope="col" className={cabecalho}>Vendedor / Loja</th>
                  <th scope="col" className={`${cabecalho} text-right`}>Valor</th>
                  <th scope="col" className={cabecalho}>Prazo combinado</th>
                  <th scope="col" className={cabecalho}>Situação</th>
                  <th scope="col" className={cabecalho}>Combinado (observação do pedido)</th>
                </tr>
              </thead>
              <tbody>
                {lista.map((p) => {
                  const b = badge(p);
                  return (
                    <tr key={p.id} className="hover:bg-yellow-50/50">
                      <td className={celula}><b className="text-neutral-900">{p.codigo}</b><span className="block text-[11px] text-neutral-400">emitido em {formatDataIsoParaBr(p.dataEmissao)}</span></td>
                      <td className={`${celula} max-w-[200px]`}>{p.cliente}</td>
                      <td className={celula}>{p.vendedor}<span className="block text-[11px] text-neutral-400">{p.loja}</span></td>
                      <td className={`${celula} text-right tabular-nums`}>{brl(p.valorTotal)}</td>
                      <td className={celula}>{p.prazo ? <>{formatDataIsoParaBr(p.prazo)}<span className="block text-[11px] text-neutral-400">{fontePrazo(p.fontePrazo)}</span></> : <span className="text-slate-300">—</span>}</td>
                      <td className={celula}><span className={`inline-block whitespace-nowrap rounded-full px-2.5 py-1 text-[11px] font-bold ${b.classe}`}>{b.texto}</span></td>
                      <td className={`${celula} max-w-[340px] break-words text-neutral-700`}>{comDestaque(p.observacao)}</td>
                    </tr>
                  );
                })}
                {lista.length === 0 && (
                  <tr>
                    <td colSpan={7} className="px-3 py-10 text-center">
                      <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-yellow-100 text-yellow-500"><Handshake className="h-6 w-6" aria-hidden="true" /></span>
                      <p className="mt-2 text-sm font-extrabold text-neutral-900">{todos.length > 0 ? 'Nenhum pedido com esse filtro.' : lendo ? 'Ainda lendo os pedidos…' : 'Nenhum pedido combinado ainda.'}</p>
                      <p className="mt-0.5 text-xs text-neutral-500">{todos.length > 0 ? 'Limpe a busca ou escolha outra situação.' : 'Escreva o nome do Dirceu na observação de um pedido liberado no Nomus e ele aparece aqui.'}</p>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
        <p className="mt-2 text-[11px] text-neutral-400">O prazo combinado é o do PCP (ou o do Nomus, quando o PCP não tem). Pedidos que saem de “Liberado” no Nomus saem desta lista.</p>
      </section>
    </div>
  );
};
