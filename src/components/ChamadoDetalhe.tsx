import React, { useState } from 'react';
import {
  CalendarDays,
  Clock3,
  FileText,
  Headphones,
  Loader2,
  LockKeyhole,
  Pause,
  Play,
  Send,
  Square,
  UserRound,
  X,
} from 'lucide-react';
import { Chamado } from '../types';

interface Props {
  chamado: Chamado;
  podeAtender: boolean;
  onClose: () => void;
  onUpdated: (chamado: Chamado) => void;
}

const formatarData = (valor?: string) => valor
  ? new Date(valor).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })
  : 'Não definido';

const iniciais = (nome: string) => nome
  .trim()
  .split(/\s+/)
  .slice(0, 2)
  .map((parte) => parte[0]?.toUpperCase())
  .join('') || 'GF';

const statusStyle: Record<Chamado['status'], string> = {
  Aberto: 'bg-amber-50 text-amber-800',
  'Em atendimento': 'bg-sky-50 text-sky-700',
  'Aguardando solicitante': 'bg-violet-50 text-violet-700',
  Resolvido: 'bg-emerald-50 text-emerald-700',
  Encerrado: 'bg-neutral-100 text-neutral-700',
  Cancelado: 'bg-red-50 text-red-700',
};

const prioridadeStyle: Record<Chamado['prioridade'], string> = {
  Baixa: 'bg-neutral-100 text-neutral-700',
  Média: 'bg-amber-50 text-amber-800',
  Alta: 'bg-orange-50 text-orange-700',
  Urgente: 'bg-red-50 text-red-700',
};

export const ChamadoDetalhe: React.FC<Props> = ({ chamado, podeAtender, onClose, onUpdated }) => {
  const [conteudo, setConteudo] = useState('');
  const [ocupado, setOcupado] = useState(false);
  const [erro, setErro] = useState('');

  const requisicao = async (url: string, method: string, body: unknown) => {
    setOcupado(true);
    setErro('');
    try {
      const resposta = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const dados = await resposta.json();
      if (!resposta.ok) throw new Error(dados.error || 'Não foi possível concluir a ação.');
      onUpdated(dados);
      return true;
    } catch (error: any) {
      setErro(error.message);
      return false;
    } finally {
      setOcupado(false);
    }
  };

  const alterarStatus = (status: Chamado['status']) =>
    requisicao(`/api/chamados/${chamado.id}`, 'PATCH', { status });

  const enviarAtualizacao = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!conteudo.trim()) return;
    const enviado = await requisicao(`/api/chamados/${chamado.id}/interacoes`, 'POST', {
      conteudo,
      tipo: podeAtender ? 'nota_interna' : 'mensagem',
    });
    if (enviado) setConteudo('');
  };

  const concluido = ['Resolvido', 'Encerrado', 'Cancelado'].includes(chamado.status);
  const emAtendimento = chamado.status === 'Em atendimento';

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/80 p-0 backdrop-blur-md sm:items-center sm:p-5">
      <div className="flex h-[100dvh] w-full max-w-5xl flex-col overflow-hidden bg-white shadow-2xl sm:h-auto sm:max-h-[92vh] sm:rounded-[1.75rem]">
        <header className="flex shrink-0 items-start gap-3 border-b border-neutral-200 bg-white px-4 py-5 sm:px-8 sm:py-7">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-mono text-xs font-medium text-neutral-800 sm:text-sm">{chamado.protocolo}</span>
              <span className={`rounded-full px-3 py-1 text-[10px] font-black uppercase ${statusStyle[chamado.status]}`}>
                {chamado.status}
              </span>
              <span className={`rounded-full px-3 py-1 text-[10px] font-black uppercase ${prioridadeStyle[chamado.prioridade]}`}>
                {chamado.prioridade}
              </span>
            </div>
            <h2 className="mt-4 break-words text-xl font-black leading-tight text-neutral-950 sm:text-3xl">{chamado.assunto}</h2>
            <p className="mt-2 text-sm text-neutral-500">{chamado.departamentoNome} • {chamado.categoria}</p>
          </div>
          <button type="button" onClick={onClose} className="flex min-h-11 min-w-11 shrink-0 items-center justify-center rounded-full text-neutral-900 transition hover:bg-neutral-100" aria-label="Fechar detalhes do chamado">
            <X className="h-6 w-6" />
          </button>
        </header>

        <div className="grid min-h-0 flex-1 gap-4 overflow-y-auto overscroll-contain bg-neutral-50/60 p-3 pb-[max(1rem,env(safe-area-inset-bottom))] sm:gap-5 sm:p-7 lg:grid-cols-[minmax(0,1fr)_320px]">
          <main className="min-w-0 space-y-4 sm:space-y-5">
            <section className="rounded-2xl border border-neutral-200 bg-white p-4 sm:p-6">
              <TituloSecao icon={FileText}>Solicitação</TituloSecao>
              <p className="mt-6 whitespace-pre-wrap break-words text-sm leading-7 text-neutral-800 sm:text-base">{chamado.descricao}</p>
            </section>

            <section className="rounded-2xl border border-neutral-200 bg-white p-4 sm:p-6">
              <TituloSecao icon={Clock3}>Histórico</TituloSecao>
              <div className="relative mt-6 space-y-3 before:absolute before:bottom-2 before:left-[14px] before:top-2 before:w-px before:bg-neutral-200">
                {chamado.interacoes.map((item) => (
                  <div key={item.id} className="relative flex min-w-0 gap-3 pl-8">
                    <span className="absolute left-[9px] top-5 z-[1] h-3 w-3 rounded-full border-2 border-white bg-yellow-400" />
                    <div className={`flex min-w-0 flex-1 gap-3 rounded-2xl p-3 sm:items-center sm:p-4 ${item.tipo === 'nota_interna' ? 'bg-amber-50/70' : 'bg-neutral-50'}`}>
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-yellow-100 text-xs font-black text-neutral-900">{iniciais(item.autorNome)}</div>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                          <strong className="truncate text-xs text-neutral-900 sm:text-sm">{item.autorNome}</strong>
                          <span className="shrink-0 text-[10px] text-neutral-500 sm:text-xs">{formatarData(item.criadoEm)}</span>
                        </div>
                        <p className="mt-1 whitespace-pre-wrap break-words text-xs leading-5 text-neutral-700 sm:text-sm">{item.conteudo}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              <form onSubmit={enviarAtualizacao} className="mt-6 border-t border-neutral-200 pt-5">
                <label className="text-xs font-medium text-neutral-600">Escreva uma atualização ou resposta...</label>
                <textarea rows={5} value={conteudo} onChange={(event) => setConteudo(event.target.value)} className="mt-3 w-full resize-y rounded-2xl border border-neutral-200 p-4 text-base text-neutral-900 outline-none transition placeholder:text-neutral-400 focus:border-yellow-400 sm:text-sm" placeholder="Digite sua atualização aqui..." />
                <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <p className="flex items-center gap-2 text-[11px] text-neutral-500">
                    <LockKeyhole className="h-4 w-4 shrink-0" />
                    {podeAtender ? 'Visível apenas para a equipe interna' : 'Visível para a equipe responsável'}
                  </p>
                  <button disabled={ocupado || !conteudo.trim()} className="flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-neutral-900 px-5 py-2.5 text-xs font-black text-white disabled:opacity-40 sm:w-auto">
                    {ocupado ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                    Enviar atualização
                  </button>
                </div>
              </form>
            </section>
          </main>

          <aside className="min-w-0 space-y-4 sm:space-y-5">
            <section className="rounded-2xl border border-neutral-200 bg-white p-5">
              <TituloSecao icon={UserRound}>Solicitante</TituloSecao>
              <div className="mt-6 min-w-0">
                <p className="break-words text-sm font-black text-neutral-900">{chamado.solicitanteNome}</p>
                <p className="mt-1 break-all text-xs text-neutral-600">{chamado.solicitanteEmail}</p>
              </div>
              <div className="mt-6 border-t border-neutral-200 pt-5">
                <p className="text-xs text-neutral-500">Aberto em</p>
                <p className="mt-1 text-sm font-medium text-neutral-800">{formatarData(chamado.criadoEm)}</p>
              </div>
            </section>

            <section className="rounded-2xl border border-neutral-200 bg-white p-5">
              <TituloSecao icon={Headphones}>Atendimento</TituloSecao>
              <div className="mt-6 divide-y divide-neutral-200">
                <InfoAtendimento label="Responsável" icon={UserRound} valor={chamado.responsavel || 'Não atribuído'} />
                <InfoAtendimento label="Prazo" icon={CalendarDays} valor={chamado.prazo ? formatarData(chamado.prazo) : 'Não definido'} />
                <div className="py-4 first:pt-0 last:pb-0">
                  <p className="text-xs text-neutral-500">Prioridade</p>
                  <span className={`mt-2 inline-flex rounded-lg px-3 py-1.5 text-[10px] font-black uppercase ${prioridadeStyle[chamado.prioridade]}`}>{chamado.prioridade}</span>
                </div>
              </div>
            </section>

            {podeAtender && (
              <div className="space-y-3">
                <button type="button" disabled={ocupado || emAtendimento} onClick={() => alterarStatus('Em atendimento')} className="flex min-h-14 w-full items-center justify-center gap-3 rounded-xl bg-yellow-400 px-5 py-3 text-sm font-black text-black shadow-lg shadow-yellow-400/20 transition hover:bg-yellow-300 disabled:cursor-not-allowed disabled:opacity-60">
                  {ocupado ? <Loader2 className="h-5 w-5 animate-spin" /> : <Play className="h-5 w-5 fill-black" />}
                  {concluido ? 'Reabrir atendimento' : emAtendimento ? 'Atendimento iniciado' : 'Iniciar atendimento'}
                </button>
                <button type="button" disabled={ocupado || !emAtendimento} onClick={() => alterarStatus('Aguardando solicitante')} className="flex min-h-14 w-full items-center justify-center gap-3 rounded-xl border border-neutral-300 bg-white px-5 py-3 text-sm font-black text-neutral-900 transition hover:border-yellow-400 disabled:cursor-not-allowed disabled:opacity-40">
                  <Pause className="h-5 w-5 fill-black" />
                  Pausar
                </button>
                <button type="button" disabled={ocupado || concluido} onClick={() => alterarStatus('Encerrado')} className="flex min-h-14 w-full items-center justify-center gap-3 rounded-xl border border-neutral-300 bg-white px-5 py-3 text-sm font-black text-neutral-900 transition hover:border-yellow-400 disabled:cursor-not-allowed disabled:opacity-40">
                  <Square className="h-4 w-4 fill-black" />
                  Finalizar
                </button>
              </div>
            )}

            {erro && <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-xs text-red-700">{erro}</div>}
          </aside>
        </div>
      </div>
    </div>
  );
};

const TituloSecao = ({ icon: Icon, children }: { icon: React.FC<{ className?: string }>; children: React.ReactNode }) => (
  <h3 className="flex items-center gap-3 text-base font-black text-neutral-900">
    <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-yellow-50 text-yellow-500"><Icon className="h-5 w-5" /></span>
    {children}
  </h3>
);

const InfoAtendimento = ({ label, icon: Icon, valor }: { label: string; icon: React.FC<{ className?: string }>; valor: string }) => (
  <div className="py-4 first:pt-0 last:pb-0">
    <p className="text-xs text-neutral-500">{label}</p>
    <p className="mt-2 flex min-w-0 items-center gap-2 text-sm text-neutral-700">
      <Icon className="h-4 w-4 shrink-0 text-neutral-500" />
      <span className="break-words">{valor}</span>
    </p>
  </div>
);
