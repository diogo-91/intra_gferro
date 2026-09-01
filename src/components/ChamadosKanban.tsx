import React from 'react';
import {
  ArrowRight,
  CheckCircle2,
  CircleDot,
  Clock3,
  MessageCircleMore,
  UserRound,
} from 'lucide-react';
import { Chamado } from '../types';

interface Props {
  chamados: Chamado[];
  onSelect: (chamado: Chamado) => void;
  mostrarDepartamento?: boolean;
  mostrarSolicitante?: boolean;
}

const etapas = [
  {
    id: 'abertos',
    titulo: 'Novos',
    descricao: 'Aguardando atendimento',
    icon: CircleDot,
    faixa: 'bg-yellow-400',
    icone: 'bg-yellow-100 text-yellow-700',
    aceita: (chamado: Chamado) => chamado.status === 'Aberto',
  },
  {
    id: 'andamento',
    titulo: 'Em andamento',
    descricao: 'Em análise ou aguardando retorno',
    icon: Clock3,
    faixa: 'bg-sky-500',
    icone: 'bg-sky-100 text-sky-700',
    aceita: (chamado: Chamado) => ['Em atendimento', 'Aguardando solicitante'].includes(chamado.status),
  },
  {
    id: 'concluidos',
    titulo: 'Concluídos',
    descricao: 'Resolvidos ou finalizados',
    icon: CheckCircle2,
    faixa: 'bg-emerald-500',
    icone: 'bg-emerald-100 text-emerald-700',
    aceita: (chamado: Chamado) => ['Resolvido', 'Encerrado', 'Cancelado'].includes(chamado.status),
  },
] as const;

const prioridade: Record<Chamado['prioridade'], string> = {
  Baixa: 'bg-neutral-100 text-neutral-600',
  Média: 'bg-blue-50 text-blue-700',
  Alta: 'bg-orange-50 text-orange-700',
  Urgente: 'bg-red-100 text-red-700',
};

export const ChamadosKanban: React.FC<Props> = ({
  chamados,
  onSelect,
  mostrarDepartamento = false,
  mostrarSolicitante = false,
}) => (
  <div className="grid min-w-0 gap-3 sm:gap-4 lg:grid-cols-3 items-start">
    {etapas.map((etapa) => {
      const itens = chamados.filter(etapa.aceita);
      const Icon = etapa.icon;

      return (
        <section key={etapa.id} className="min-w-0 overflow-hidden rounded-2xl sm:rounded-3xl border border-neutral-200 bg-neutral-100/70 shadow-sm">
          <div className={`h-1.5 ${etapa.faixa}`} />
          <header className="flex items-center gap-3 px-3.5 py-3.5 sm:px-4 sm:py-4">
            <div className={`rounded-xl p-2 ${etapa.icone}`}>
              <Icon className="h-4 w-4" />
            </div>
            <div className="min-w-0 flex-1">
              <h3 className="text-sm font-black text-neutral-900">{etapa.titulo}</h3>
              <p className="truncate text-[10px] text-neutral-500">{etapa.descricao}</p>
            </div>
            <span className="flex h-7 min-w-7 items-center justify-center rounded-full bg-white px-2 text-xs font-black text-neutral-700 shadow-sm">
              {itens.length}
            </span>
          </header>

          <div className="space-y-3 px-2.5 pb-2.5 sm:px-3 sm:pb-3">
            {itens.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-neutral-300 bg-white/60 px-4 py-10 text-center">
                <p className="text-xs font-bold text-neutral-400">Nenhum chamado nesta etapa</p>
              </div>
            ) : itens.map((chamado) => (
              <button
                key={chamado.id}
                type="button"
                onClick={() => onSelect(chamado)}
                className="group w-full min-h-11 rounded-2xl border border-neutral-200 bg-white p-3.5 sm:p-4 text-left shadow-sm transition hover:-translate-y-0.5 hover:border-yellow-400 hover:shadow-md active:scale-[0.99]"
              >
                <div className="flex items-start justify-between gap-3">
                  <span className="font-mono text-[11px] font-black text-yellow-700">{chamado.protocolo}</span>
                  <span className={`rounded-full px-2 py-1 text-[9px] font-black uppercase ${prioridade[chamado.prioridade]}`}>
                    {chamado.prioridade}
                  </span>
                </div>

                <h4 className="mt-3 line-clamp-2 text-sm font-black leading-5 text-neutral-900">{chamado.assunto}</h4>
                <p className="mt-2 line-clamp-2 text-xs leading-5 text-neutral-500">{chamado.descricao}</p>

                <div className="mt-4 space-y-2 border-t border-neutral-100 pt-3 text-[10px] text-neutral-500">
                  {mostrarDepartamento && <p className="font-bold text-neutral-700">{chamado.departamentoNome}</p>}
                  {mostrarSolicitante && (
                    <p className="flex min-w-0 items-center gap-1.5">
                      <UserRound className="h-3.5 w-3.5 shrink-0" />
                      <span className="truncate">{chamado.solicitanteNome}</span>
                    </p>
                  )}
                  <div className="flex flex-wrap items-center justify-between gap-2 sm:gap-3">
                    <span className="flex items-center gap-1.5">
                      <MessageCircleMore className="h-3.5 w-3.5" />
                      {chamado.interacoes.length} atualizaç{chamado.interacoes.length === 1 ? 'ão' : 'ões'}
                    </span>
                    <span>{new Date(chamado.atualizadoEm).toLocaleDateString('pt-BR')}</span>
                  </div>
                </div>

                <span className="mt-3 flex items-center justify-end gap-1 text-[10px] font-black text-neutral-400 transition group-hover:text-yellow-700">
                  Ver detalhes <ArrowRight className="h-3 w-3" />
                </span>
              </button>
            ))}
          </div>
        </section>
      );
    })}
  </div>
);
