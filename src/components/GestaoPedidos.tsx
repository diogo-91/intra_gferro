import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  CalendarClock,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock3,
  ExternalLink,
  Filter,
  Inbox,
  PackageCheck,
  RefreshCw,
  Search,
  X,
} from 'lucide-react';
import type { PainelPedidosGestao, PedidoGestao, StatusAtendimentoPedido, StatusPedidoGestao } from '../types';

const STATUS: StatusPedidoGestao[] = ['AGUARDANDO', 'PEDIDO LIBERADO', 'EM PRODUÇÃO', 'EXPEDIÇÃO', 'ROTA DE ENTREGA', 'ENCERRADO', 'CANCELADO'];
const ATENDIMENTOS: StatusAtendimentoPedido[] = ['Aguardando programação', 'Aguardando compras', 'Aguardando produção', 'Em análise', 'Aguardando retorno', 'Pronto para entrega', 'Concluído'];
const POR_PAGINA = 25;

type FiltroPrazo = 'todos' | 'atrasados' | 'proximos' | 'sem-prazo' | 'encerrados';

const COR_STATUS: Record<StatusPedidoGestao, string> = {
  AGUARDANDO: 'border-neutral-200 bg-neutral-100 text-neutral-700',
  'PEDIDO LIBERADO': 'border-lime-200 bg-lime-100 text-lime-800',
  'EM PRODUÇÃO': 'border-amber-200 bg-amber-100 text-amber-800',
  EXPEDIÇÃO: 'border-sky-200 bg-sky-100 text-sky-800',
  'ROTA DE ENTREGA': 'border-violet-200 bg-violet-100 text-violet-800',
  ENCERRADO: 'border-red-200 bg-red-700 text-white',
  CANCELADO: 'border-purple-200 bg-purple-700 text-white',
};

const COR_ATENDIMENTO: Record<StatusAtendimentoPedido, string> = {
  'Aguardando programação': 'border-yellow-200 bg-yellow-100 text-yellow-800',
  'Aguardando compras': 'border-emerald-200 bg-emerald-100 text-emerald-800',
  'Aguardando produção': 'border-sky-200 bg-sky-100 text-sky-800',
  'Em análise': 'border-violet-200 bg-violet-100 text-violet-800',
  'Aguardando retorno': 'border-cyan-200 bg-cyan-100 text-cyan-800',
  'Pronto para entrega': 'border-indigo-200 bg-indigo-100 text-indigo-800',
  Concluído: 'border-emerald-200 bg-emerald-700 text-white',
};

function inicioHoje(): Date {
  const data = new Date();
  data.setHours(0, 0, 0, 0);
  return data;
}

function diasAte(dataIso: string): number | null {
  if (!dataIso) return null;
  const alvo = new Date(`${dataIso}T00:00:00`);
  if (Number.isNaN(alvo.getTime())) return null;
  return Math.round((alvo.getTime() - inicioHoje().getTime()) / 86_400_000);
}

function formatarDataIso(dataIso: string): string {
  if (!dataIso) return 'Sem prazo';
  const [ano, mes, dia] = dataIso.split('-');
  return `${dia}/${mes}/${ano}`;
}

function formatarDataNomus(valor: string): string {
  if (!valor) return '-';
  return valor.split(' ')[0];
}

function formatarMoeda(valor: number): string {
  return valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function encerrado(pedido: PedidoGestao): boolean {
  return pedido.status === 'ENCERRADO' || pedido.status === 'CANCELADO';
}

function rotuloPrazo(pedido: PedidoGestao): { texto: string; classe: string } {
  if (!pedido.prazo) return { texto: 'Sem prazo', classe: 'text-neutral-500' };
  const dias = diasAte(pedido.prazo);
  if (dias == null) return { texto: formatarDataIso(pedido.prazo), classe: 'text-neutral-700' };
  if (dias < 0) return { texto: `${formatarDataIso(pedido.prazo)} · ${Math.abs(dias)}d atrasado`, classe: 'text-red-700' };
  if (dias === 0) return { texto: `${formatarDataIso(pedido.prazo)} · vence hoje`, classe: 'text-amber-700' };
  if (dias <= 2) return { texto: `${formatarDataIso(pedido.prazo)} · ${dias}d`, classe: 'text-amber-700' };
  return { texto: formatarDataIso(pedido.prazo), classe: 'text-neutral-700' };
}

interface EditorProps {
  pedido: PedidoGestao;
  onClose: () => void;
  onSave: (id: number, alteracoes: Partial<PedidoGestao>) => Promise<void>;
}

const EditorPedido: React.FC<EditorProps> = ({ pedido, onClose, onSave }) => {
  const [form, setForm] = useState(pedido);
  const [salvando, setSalvando] = useState(false);

  useEffect(() => setForm(pedido), [pedido]);

  const salvar = async (event: React.FormEvent) => {
    event.preventDefault();
    setSalvando(true);
    try {
      await onSave(pedido.id, {
        status: form.status,
        atendimento: form.atendimento,
        prazo: form.prazo,
        observacao: form.observacao,
        cliente: form.cliente,
        telefone: form.telefone,
        responsavel: form.responsavel,
      });
      onClose();
    } finally {
      setSalvando(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex justify-end" role="dialog" aria-modal="true" aria-label={`Pedido ${pedido.codigoPedido}`}>
      <button type="button" className="absolute inset-0 bg-black/35" onClick={onClose} aria-label="Fechar detalhes" />
      <form onSubmit={salvar} className="relative flex h-full w-full max-w-xl flex-col bg-white shadow-2xl">
        <header className="flex items-start justify-between border-b border-neutral-200 px-5 py-4 sm:px-6">
          <div className="min-w-0">
            <p className="text-[10px] font-bold uppercase text-neutral-500">Gestão de pedidos</p>
            <h2 className="mt-1 text-xl font-black text-neutral-950">{pedido.codigoPedido}</h2>
            <p className="truncate text-xs text-neutral-500">{pedido.cliente} · {formatarMoeda(pedido.valorTotal)}</p>
          </div>
          <button type="button" onClick={onClose} className="flex h-9 w-9 items-center justify-center rounded-md text-neutral-500 hover:bg-neutral-100" title="Fechar">
            <X className="h-5 w-5" />
          </button>
        </header>

        <div className="flex-1 space-y-6 overflow-y-auto px-5 py-5 sm:px-6">
          <section className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <label className="space-y-1.5 text-xs font-bold text-neutral-700">
              Status
              <select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value as StatusPedidoGestao })} className="w-full rounded-md border border-neutral-300 bg-white px-3 py-2.5 text-sm outline-none focus:border-yellow-500">
                {STATUS.map((item) => <option key={item}>{item}</option>)}
              </select>
            </label>
            <label className="space-y-1.5 text-xs font-bold text-neutral-700">
              Atendimento
              <select value={form.atendimento} onChange={(e) => setForm({ ...form, atendimento: e.target.value as StatusAtendimentoPedido })} className="w-full rounded-md border border-neutral-300 bg-white px-3 py-2.5 text-sm outline-none focus:border-yellow-500">
                {ATENDIMENTOS.map((item) => <option key={item}>{item}</option>)}
              </select>
            </label>
            <label className="space-y-1.5 text-xs font-bold text-neutral-700">
              Prazo de entrega
              <input type="date" value={form.prazo} onChange={(e) => setForm({ ...form, prazo: e.target.value })} className="w-full rounded-md border border-neutral-300 px-3 py-2.5 text-sm outline-none focus:border-yellow-500" />
            </label>
            <label className="space-y-1.5 text-xs font-bold text-neutral-700">
              Responsável
              <input value={form.responsavel} onChange={(e) => setForm({ ...form, responsavel: e.target.value })} placeholder="Quem está acompanhando" className="w-full rounded-md border border-neutral-300 px-3 py-2.5 text-sm outline-none focus:border-yellow-500" />
            </label>
            <label className="space-y-1.5 text-xs font-bold text-neutral-700 sm:col-span-2">
              Nome do cliente
              <input value={form.cliente} onChange={(e) => setForm({ ...form, cliente: e.target.value })} className="w-full rounded-md border border-neutral-300 px-3 py-2.5 text-sm outline-none focus:border-yellow-500" />
            </label>
            <label className="space-y-1.5 text-xs font-bold text-neutral-700 sm:col-span-2">
              Telefone
              <input value={form.telefone} onChange={(e) => setForm({ ...form, telefone: e.target.value })} placeholder="Telefone ou WhatsApp" className="w-full rounded-md border border-neutral-300 px-3 py-2.5 text-sm outline-none focus:border-yellow-500" />
            </label>
          </section>

          <label className="block space-y-1.5 text-xs font-bold text-neutral-700">
            Observação de atendimento
            <textarea value={form.observacao} onChange={(e) => setForm({ ...form, observacao: e.target.value })} rows={5} placeholder="Registre retornos, combinados e pendências deste atendimento" className="w-full resize-y rounded-md border border-neutral-300 px-3 py-2.5 text-sm font-normal leading-relaxed outline-none focus:border-yellow-500" />
          </label>

          <section className="border-t border-neutral-200 pt-5">
            <h3 className="text-xs font-black uppercase text-neutral-700">Dados do Nomus</h3>
            <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-3 text-xs">
              <div><dt className="text-neutral-400">Emissão</dt><dd className="mt-0.5 font-semibold">{formatarDataNomus(pedido.dataEmissao)}</dd></div>
              <div><dt className="text-neutral-400">Vendedor</dt><dd className="mt-0.5 font-semibold">{pedido.vendedor}</dd></div>
              <div><dt className="text-neutral-400">Prazo original</dt><dd className="mt-0.5 font-semibold">{formatarDataIso(pedido.prazoOriginal)}</dd></div>
              <div><dt className="text-neutral-400">Localidade</dt><dd className="mt-0.5 font-semibold">{pedido.cidade || '-'}</dd></div>
            </dl>
            <div className="mt-4 space-y-2">
              {pedido.produtos.map((produto, index) => <p key={`${produto}-${index}`} className="border-l-2 border-yellow-400 pl-3 text-xs leading-relaxed text-neutral-600">{produto}</p>)}
            </div>
            {pedido.observacoesNomus && <p className="mt-4 whitespace-pre-wrap rounded-md bg-neutral-50 p-3 text-xs leading-relaxed text-neutral-600">{pedido.observacoesNomus}</p>}
          </section>

          <section className="border-t border-neutral-200 pt-5">
            <h3 className="text-xs font-black uppercase text-neutral-700">Histórico</h3>
            {pedido.historico.length === 0 ? <p className="mt-3 text-xs text-neutral-400">Nenhuma alteração registrada.</p> : (
              <div className="mt-3 space-y-3">
                {pedido.historico.map((evento) => (
                  <div key={evento.id} className="border-l border-neutral-300 pl-3 text-xs">
                    <p className="font-semibold text-neutral-700">{evento.usuario} · {new Date(evento.criadoEm).toLocaleString('pt-BR')}</p>
                    <p className="mt-0.5 leading-relaxed text-neutral-500">{evento.acao}</p>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>

        <footer className="flex items-center justify-end gap-2 border-t border-neutral-200 bg-neutral-50 px-5 py-4 sm:px-6">
          <button type="button" onClick={onClose} className="rounded-md px-4 py-2.5 text-xs font-bold text-neutral-600 hover:bg-neutral-200">Cancelar</button>
          <button type="submit" disabled={salvando} className="rounded-md bg-yellow-400 px-5 py-2.5 text-xs font-black text-black hover:bg-yellow-300 disabled:opacity-50">{salvando ? 'Salvando...' : 'Salvar alterações'}</button>
        </footer>
      </form>
    </div>
  );
};

export const GestaoPedidos: React.FC = () => {
  const [dados, setDados] = useState<PainelPedidosGestao | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [atualizando, setAtualizando] = useState(false);
  const [erro, setErro] = useState('');
  const [mensagem, setMensagem] = useState('');
  const [busca, setBusca] = useState('');
  const [filtro, setFiltro] = useState<FiltroPrazo>('todos');
  const [status, setStatus] = useState<StatusPedidoGestao | ''>('');
  const [pagina, setPagina] = useState(1);
  const [selecionado, setSelecionado] = useState<PedidoGestao | null>(null);

  const carregar = async (forcar = false) => {
    if (forcar) setAtualizando(true);
    try {
      const resposta = await fetch(`/api/pedidos-gestao${forcar ? '?atualizar=1' : ''}`);
      const corpo = await resposta.json();
      if (!resposta.ok) throw new Error(corpo.error || 'Não foi possível carregar os pedidos.');
      setDados(corpo);
      setErro('');
    } catch (error: any) {
      setErro(error.message || 'Não foi possível carregar os pedidos.');
    } finally {
      setCarregando(false);
      setAtualizando(false);
    }
  };

  useEffect(() => {
    void carregar();
    const intervalo = window.setInterval(() => void carregar(), 30_000);
    return () => window.clearInterval(intervalo);
  }, []);

  const salvar = async (id: number, alteracoes: Partial<PedidoGestao>) => {
    const resposta = await fetch(`/api/pedidos-gestao/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(alteracoes) });
    const corpo = await resposta.json();
    if (!resposta.ok) throw new Error(corpo.error || 'Não foi possível salvar.');
    setDados((atual) => atual ? { ...atual, pedidos: atual.pedidos.map((pedido) => pedido.id === id ? corpo : pedido) } : atual);
    setSelecionado((atual) => atual?.id === id ? corpo : atual);
    setMensagem('Pedido atualizado com sucesso.');
    window.setTimeout(() => setMensagem(''), 3000);
  };

  const salvarRapido = async (pedido: PedidoGestao, alteracoes: Partial<PedidoGestao>) => {
    try { await salvar(pedido.id, alteracoes); } catch (error: any) { setErro(error.message); }
  };

  const pedidosAtivos = useMemo(() => (dados?.pedidos || []).filter((pedido) => !encerrado(pedido)), [dados]);
  const totais = useMemo(() => ({
    todos: pedidosAtivos.length,
    atrasados: pedidosAtivos.filter((pedido) => (diasAte(pedido.prazo) ?? 0) < 0 && !!pedido.prazo).length,
    proximos: pedidosAtivos.filter((pedido) => { const dias = diasAte(pedido.prazo); return dias != null && dias >= 0 && dias <= 2; }).length,
    semPrazo: pedidosAtivos.filter((pedido) => !pedido.prazo).length,
    encerrados: (dados?.pedidos || []).filter(encerrado).length,
  }), [dados, pedidosAtivos]);

  const filtrados = useMemo(() => {
    const alvo = busca.trim().toLocaleLowerCase('pt-BR');
    return (dados?.pedidos || []).filter((pedido) => {
      const dias = diasAte(pedido.prazo);
      if (filtro === 'todos' && encerrado(pedido)) return false;
      if (filtro === 'atrasados' && (encerrado(pedido) || dias == null || dias >= 0)) return false;
      if (filtro === 'proximos' && (encerrado(pedido) || dias == null || dias < 0 || dias > 2)) return false;
      if (filtro === 'sem-prazo' && (encerrado(pedido) || pedido.prazo)) return false;
      if (filtro === 'encerrados' && !encerrado(pedido)) return false;
      if (status && pedido.status !== status) return false;
      if (!alvo) return true;
      return [pedido.codigoPedido, pedido.cliente, pedido.telefone, pedido.vendedor, pedido.responsavel, pedido.observacao, ...pedido.produtos].some((valor) => String(valor || '').toLocaleLowerCase('pt-BR').includes(alvo));
    }).sort((a, b) => {
      const da = diasAte(a.prazo);
      const db = diasAte(b.prazo);
      if (da == null && db != null) return 1;
      if (da != null && db == null) return -1;
      return (da ?? 0) - (db ?? 0) || b.id - a.id;
    });
  }, [dados, busca, filtro, status]);

  const totalPaginas = Math.max(1, Math.ceil(filtrados.length / POR_PAGINA));
  const paginaAtual = Math.min(pagina, totalPaginas);
  const exibidos = filtrados.slice((paginaAtual - 1) * POR_PAGINA, paginaAtual * POR_PAGINA);

  const filtrosKpi: Array<{ id: FiltroPrazo; titulo: string; valor: number; Icon: React.FC<{ className?: string }>; classe: string }> = [
    { id: 'todos', titulo: 'Pedidos ativos', valor: totais.todos, Icon: Inbox, classe: 'text-neutral-900 bg-neutral-100' },
    { id: 'atrasados', titulo: 'Atrasados', valor: totais.atrasados, Icon: AlertCircle, classe: 'text-red-700 bg-red-50' },
    { id: 'proximos', titulo: 'Vencem em até 2 dias', valor: totais.proximos, Icon: CalendarClock, classe: 'text-amber-800 bg-amber-50' },
    { id: 'sem-prazo', titulo: 'Sem prazo', valor: totais.semPrazo, Icon: Clock3, classe: 'text-sky-800 bg-sky-50' },
    { id: 'encerrados', titulo: 'Encerrados', valor: totais.encerrados, Icon: CheckCircle2, classe: 'text-emerald-800 bg-emerald-50' },
  ];

  return (
    <div className="mx-auto max-w-[1600px] space-y-5 pb-10">
      <header className="flex flex-col gap-4 border-b border-neutral-200 pb-5 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-[11px] font-bold uppercase text-neutral-500">PCP / Atendimento</p>
          <h1 className="mt-1 text-2xl font-black text-neutral-950 sm:text-3xl">Gestão de pedidos</h1>
          <p className="mt-1 text-sm text-neutral-500">Pedidos liberados e ainda não finalizados no Nomus.</p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          {dados?.atualizadoEm && <span className="text-[10px] font-medium text-neutral-400">Nomus: {new Date(dados.atualizadoEm).toLocaleString('pt-BR')}{dados.sincronizando ? ' · sincronizando' : ''}</span>}
          <button type="button" onClick={() => void carregar(true)} disabled={atualizando} className="inline-flex h-10 items-center gap-2 rounded-md border border-neutral-300 bg-white px-4 text-xs font-bold text-neutral-700 hover:border-yellow-500 disabled:opacity-50">
            <RefreshCw className={`h-4 w-4 ${atualizando ? 'animate-spin' : ''}`} />
            {atualizando ? 'Sincronizando...' : 'Atualizar Nomus'}
          </button>
        </div>
      </header>

      {erro && <div className="flex items-center gap-2 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-xs font-semibold text-red-700"><AlertCircle className="h-4 w-4" />{erro}</div>}
      {mensagem && <div className="fixed right-5 top-24 z-50 rounded-md bg-neutral-950 px-4 py-3 text-xs font-bold text-white shadow-xl">{mensagem}</div>}

      <section className="grid grid-cols-2 border border-neutral-200 bg-white sm:grid-cols-3 xl:grid-cols-5">
        {filtrosKpi.map(({ id, titulo, valor, Icon, classe }) => (
          <button key={id} type="button" onClick={() => { setFiltro(id); setPagina(1); }} className={`min-w-0 border-b border-r border-neutral-200 p-4 text-left transition-colors hover:bg-neutral-50 ${filtro === id ? 'shadow-[inset_0_-3px_0_#facc15]' : ''}`}>
            <span className={`mb-3 flex h-8 w-8 items-center justify-center rounded-md ${classe}`}><Icon className="h-4 w-4" /></span>
            <span className="block text-2xl font-black tabular-nums text-neutral-950">{valor}</span>
            <span className="mt-0.5 block text-[10px] font-bold uppercase text-neutral-500">{titulo}</span>
          </button>
        ))}
      </section>

      <section className="border border-neutral-200 bg-white">
        <div className="flex flex-col gap-3 border-b border-neutral-200 p-4 xl:flex-row xl:items-center">
          <div className="relative min-w-0 flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-400" />
            <input value={busca} onChange={(e) => { setBusca(e.target.value); setPagina(1); }} placeholder="Buscar pedido, cliente, telefone, vendedor ou produto" className="h-10 w-full rounded-md border border-neutral-300 bg-neutral-50 pl-10 pr-3 text-xs outline-none focus:border-yellow-500" />
          </div>
          <div className="flex min-w-0 items-center gap-2">
            <Filter className="h-4 w-4 shrink-0 text-neutral-400" />
            <select value={status} onChange={(e) => { setStatus(e.target.value as StatusPedidoGestao | ''); setPagina(1); }} className="h-10 min-w-0 flex-1 rounded-md border border-neutral-300 bg-white px-3 text-xs font-semibold text-neutral-700 outline-none focus:border-yellow-500 xl:w-52">
              <option value="">Todos os status</option>
              {STATUS.map((item) => <option key={item}>{item}</option>)}
            </select>
          </div>
          <p className="shrink-0 text-xs font-semibold text-neutral-500">{filtrados.length} pedidos</p>
        </div>

        {carregando ? <div className="flex items-center justify-center gap-2 py-20 text-xs font-semibold text-neutral-500"><RefreshCw className="h-5 w-5 animate-spin text-yellow-600" />Carregando pedidos...</div> : (
          <>
            <div className="hidden overflow-x-auto lg:block">
              <table className="w-full min-w-[1180px] table-fixed text-left">
                <thead className="bg-neutral-50 text-[10px] font-black uppercase text-neutral-500">
                  <tr><th className="w-[25%] px-4 py-3">Cliente / pedido</th><th className="w-[14%] px-3 py-3">Contato</th><th className="w-[16%] px-3 py-3">Status</th><th className="w-[17%] px-3 py-3">Atendimento</th><th className="w-[14%] px-3 py-3">Prazo</th><th className="w-[10%] px-3 py-3">Responsável</th><th className="w-[4%] px-2 py-3"><span className="sr-only">Detalhes</span></th></tr>
                </thead>
                <tbody className="divide-y divide-neutral-100">
                  {exibidos.map((pedido) => {
                    const prazo = rotuloPrazo(pedido);
                    return <tr key={pedido.id} className="group hover:bg-neutral-50/80">
                      <td className="px-4 py-3"><button type="button" onClick={() => setSelecionado(pedido)} className="block w-full text-left"><span className="block truncate text-xs font-black text-neutral-900">{pedido.cliente}</span><span className="mt-0.5 block truncate text-[10px] font-semibold text-neutral-500">{pedido.codigoPedido} · {pedido.vendedor} · {formatarMoeda(pedido.valorTotal)}</span></button></td>
                      <td className="px-3 py-3"><span className="block truncate text-xs font-medium text-neutral-700">{pedido.telefone || 'Não informado'}</span><span className="block truncate text-[10px] text-neutral-400">{pedido.cidade || `Cliente #${pedido.idPessoaCliente || '-'}`}</span></td>
                      <td className="px-3 py-3"><select value={pedido.status} onChange={(e) => void salvarRapido(pedido, { status: e.target.value as StatusPedidoGestao })} className={`h-8 w-full rounded-md border px-2 text-[10px] font-bold outline-none ${COR_STATUS[pedido.status]}`}>{STATUS.map((item) => <option key={item}>{item}</option>)}</select></td>
                      <td className="px-3 py-3"><select value={pedido.atendimento} onChange={(e) => void salvarRapido(pedido, { atendimento: e.target.value as StatusAtendimentoPedido })} className={`h-8 w-full rounded-md border px-2 text-[10px] font-bold outline-none ${COR_ATENDIMENTO[pedido.atendimento]}`}>{ATENDIMENTOS.map((item) => <option key={item}>{item}</option>)}</select></td>
                      <td className="px-3 py-3"><button type="button" onClick={() => setSelecionado(pedido)} className={`text-left text-[11px] font-bold ${prazo.classe}`}>{prazo.texto}</button></td>
                      <td className="px-3 py-3"><span className="block truncate text-[11px] font-semibold text-neutral-600">{pedido.responsavel || '-'}</span></td>
                      <td className="px-2 py-3"><button type="button" onClick={() => setSelecionado(pedido)} className="flex h-8 w-8 items-center justify-center rounded-md text-neutral-400 hover:bg-neutral-200 hover:text-neutral-800" title="Abrir detalhes"><ExternalLink className="h-4 w-4" /></button></td>
                    </tr>;
                  })}
                </tbody>
              </table>
            </div>

            <div className="divide-y divide-neutral-200 lg:hidden">
              {exibidos.map((pedido) => {
                const prazo = rotuloPrazo(pedido);
                return <button key={pedido.id} type="button" onClick={() => setSelecionado(pedido)} className="w-full space-y-3 p-4 text-left hover:bg-neutral-50">
                  <div className="flex items-start justify-between gap-3"><div className="min-w-0"><span className="block truncate text-sm font-black text-neutral-900">{pedido.cliente}</span><span className="text-[10px] font-semibold text-neutral-500">{pedido.codigoPedido} · {formatarMoeda(pedido.valorTotal)}</span></div><span className={`shrink-0 rounded-md border px-2 py-1 text-[9px] font-black ${COR_STATUS[pedido.status]}`}>{pedido.status}</span></div>
                  <div className="grid grid-cols-2 gap-3 text-[11px]"><div><span className="block text-neutral-400">Prazo</span><span className={`font-bold ${prazo.classe}`}>{prazo.texto}</span></div><div><span className="block text-neutral-400">Atendimento</span><span className="font-semibold text-neutral-700">{pedido.atendimento}</span></div></div>
                </button>;
              })}
            </div>

            {exibidos.length === 0 && <div className="flex flex-col items-center py-16 text-center"><PackageCheck className="h-8 w-8 text-neutral-300" /><p className="mt-3 text-sm font-bold text-neutral-700">Nenhum pedido encontrado</p><p className="mt-1 text-xs text-neutral-400">Ajuste os filtros para ampliar a busca.</p></div>}
          </>
        )}

        <footer className="flex items-center justify-between border-t border-neutral-200 bg-neutral-50 px-4 py-3">
          <span className="text-[10px] font-semibold text-neutral-500">Página {paginaAtual} de {totalPaginas}</span>
          <div className="flex gap-1">
            <button type="button" onClick={() => setPagina((valor) => Math.max(1, valor - 1))} disabled={paginaAtual === 1} className="flex h-8 w-8 items-center justify-center rounded-md border border-neutral-300 bg-white text-neutral-600 disabled:opacity-30" title="Página anterior"><ChevronLeft className="h-4 w-4" /></button>
            <button type="button" onClick={() => setPagina((valor) => Math.min(totalPaginas, valor + 1))} disabled={paginaAtual === totalPaginas} className="flex h-8 w-8 items-center justify-center rounded-md border border-neutral-300 bg-white text-neutral-600 disabled:opacity-30" title="Próxima página"><ChevronRight className="h-4 w-4" /></button>
          </div>
        </footer>
      </section>

      {selecionado && <EditorPedido pedido={selecionado} onClose={() => setSelecionado(null)} onSave={salvar} />}
    </div>
  );
};
