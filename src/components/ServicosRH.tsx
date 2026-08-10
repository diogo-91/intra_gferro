import React, { useState } from 'react';
import { Chamado, User } from '../types';
import { 
  LifeBuoy, 
  Plus, 
  Clock, 
  CheckCircle2, 
  AlertCircle, 
  Search, 
  Filter, 
  FileCheck, 
  HardHat, 
  Laptop, 
  Wrench, 
  DollarSign, 
  Calendar,
  UserCheck
} from 'lucide-react';

interface ServicosRHProps {
  chamados: Chamado[];
  user: User;
  onOpenNewChamado: () => void;
}

export const ServicosRH: React.FC<ServicosRHProps> = ({
  chamados,
  user,
  onOpenNewChamado,
}) => {
  const [filterStatus, setFilterStatus] = useState<string>('Todos');
  const [searchQuery, setSearchQuery] = useState<string>('');

  const filtered = chamados.filter((c) => {
    const matchesStatus = filterStatus === 'Todos' || c.status === filterStatus;
    const matchesQuery = 
      c.protocol.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.subject.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.type.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesStatus && matchesQuery;
  });

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'Aberto':
        return (
          <span className="px-2.5 py-1 rounded bg-amber-50 text-amber-700 border border-amber-200 text-[10px] font-black uppercase flex items-center gap-1">
            <Clock className="w-3 h-3" />
            Aberto
          </span>
        );
      case 'Em Atendimento':
        return (
          <span className="px-2.5 py-1 rounded bg-sky-50 text-sky-700 border border-sky-200 text-[10px] font-black uppercase flex items-center gap-1">
            <AlertCircle className="w-3 h-3 animate-spin" />
            Em Atendimento
          </span>
        );
      case 'Concluído':
        return (
          <span className="px-2.5 py-1 rounded bg-emerald-50 text-emerald-700 border border-emerald-200 text-[10px] font-black uppercase flex items-center gap-1">
            <CheckCircle2 className="w-3 h-3" />
            Concluído
          </span>
        );
      default:
        return null;
    }
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'EPI / Segurança':
        return <HardHat className="w-4 h-4 text-amber-400" />;
      case 'RH / Holerite':
        return <FileCheck className="w-4 h-4 text-sky-600" />;
      case 'Suporte TI':
        return <Laptop className="w-4 h-4 text-purple-600" />;
      case 'Manutenção Predial':
        return <Wrench className="w-4 h-4 text-emerald-600" />;
      case 'Reembolso':
        return <DollarSign className="w-4 h-4 text-amber-400" />;
      case 'Férias':
        return <Calendar className="w-4 h-4 text-orange-400" />;
      default:
        return <LifeBuoy className="w-4 h-4 text-zinc-400" />;
    }
  };

  return (
    <div className="space-y-6 pb-12">
      
      {/* Header Banner */}
      <div className="bg-white p-6 rounded-[2rem] border border-neutral-200 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-black text-neutral-900 flex items-center gap-2 tracking-tight">
            <LifeBuoy className="w-6 h-6 text-yellow-600" />
            <span>Portal de Serviços & Chamados</span>
          </h1>
          <p className="text-xs text-neutral-500 mt-1 font-medium">
            Abra e acompanhe solicitações de EPIs, segunda via de holerite, suporte TI, requisições de férias e reembolso.
          </p>
        </div>

        <button
          id="servicos-new-ticket-btn"
          onClick={onOpenNewChamado}
          className="px-5 py-2.5 rounded-full bg-yellow-400 text-black font-extrabold text-xs sm:text-sm hover:bg-yellow-300 shadow-lg shadow-yellow-400/20 flex items-center gap-2 transition-all shrink-0 active:scale-95"
        >
          <Plus className="w-4 h-4 text-black" />
          <span>Abrir Novo Chamado</span>
        </button>
      </div>

      {/* Quick Category Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-4">
        {[
          { label: 'EPI / Segurança', icon: HardHat, desc: 'Botas, Luvas' },
          { label: 'RH / Holerite', icon: FileCheck, desc: 'Folha e Ponto' },
          { label: 'Suporte TI', icon: Laptop, desc: 'Sistemas e Ramal' },
          { label: 'Manutenção', icon: Wrench, desc: 'Eletricidade e Galpão' },
          { label: 'Férias', icon: Calendar, desc: 'Agendamento' },
          { label: 'Reembolso', icon: DollarSign, desc: 'Despesas' },
        ].map((item) => {
          const Icon = item.icon;
          return (
            <button
              key={item.label}
              onClick={onOpenNewChamado}
              className="p-4 rounded-2xl bg-white border border-neutral-200 hover:border-yellow-400/60 transition-all text-left flex flex-col justify-between h-28 group shadow-lg"
            >
              <Icon className="w-5 h-5 text-yellow-600 group-hover:scale-110 transition-transform" />
              <div>
                <span className="text-xs font-bold text-neutral-900 group-hover:text-yellow-600 block truncate">
                  {item.label}
                </span>
                <span className="text-[10px] text-neutral-500 block truncate mt-0.5">
                  {item.desc}
                </span>
              </div>
            </button>
          );
        })}
      </div>

      {/* Filters */}
      <div className="flex flex-col md:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold text-neutral-500 flex items-center gap-1.5">
            <Filter className="w-4 h-4 text-yellow-600" />
            Status:
          </span>
          {['Todos', 'Aberto', 'Em Atendimento', 'Concluído'].map((st) => (
            <button
              key={st}
              onClick={() => setFilterStatus(st)}
              className={`px-4 py-1.5 rounded-full text-xs font-extrabold transition-all ${
                filterStatus === st
                  ? 'bg-yellow-400 text-black shadow-md shadow-yellow-400/20'
                  : 'bg-white text-neutral-500 border border-neutral-200 hover:text-neutral-900'
              }`}
            >
              {st}
            </button>
          ))}
        </div>

        <div className="relative w-full md:w-72">
          <Search className="w-4 h-4 absolute left-4 top-1/2 -translate-y-1/2 text-neutral-500" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Protocolo ou assunto..."
            className="w-full pl-10 pr-4 py-2 text-xs bg-white border border-neutral-200 rounded-full text-neutral-900 placeholder-neutral-500 focus:outline-none focus:border-yellow-400 transition-all"
          />
        </div>
      </div>

      {/* Ticket List */}
      <div className="space-y-4">
        {filtered.length === 0 ? (
          <div className="p-12 text-center rounded-[2rem] bg-white border border-neutral-200 space-y-2">
            <LifeBuoy className="w-8 h-8 text-neutral-600 mx-auto" />
            <h3 className="text-sm font-bold text-neutral-600">Nenhum chamado encontrado</h3>
            <p className="text-xs text-neutral-500 font-medium">
              Você não possui chamados nessa categoria no momento.
            </p>
          </div>
        ) : (
          filtered.map((ticket) => (
            <div
              key={ticket.id}
              className="p-6 rounded-[2rem] bg-white border border-neutral-200 hover:border-white/20 transition-all space-y-4 shadow-sm"
            >
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-neutral-200 pb-4">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 rounded-2xl bg-neutral-50 border border-neutral-100">
                    {getTypeIcon(ticket.type)}
                  </div>
                  <div>
                    <span className="text-xs font-mono text-yellow-600 font-bold block">
                      {ticket.protocol}
                    </span>
                    <span className="text-xs font-bold text-neutral-900">
                      {ticket.type}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <span className={`px-3 py-1 rounded-full text-[10px] font-extrabold uppercase ${
                    ticket.priority === 'Alta' || ticket.priority === 'Urgente'
                      ? 'bg-red-50 text-red-700 border border-red-200'
                      : 'bg-neutral-50 text-neutral-500 border border-neutral-100'
                  }`}>
                    Prioridade: {ticket.priority}
                  </span>
                  {getStatusBadge(ticket.status)}
                </div>
              </div>

              <div>
                <h3 className="text-base font-bold text-neutral-900 leading-snug">
                  {ticket.subject}
                </h3>
                <p className="text-xs text-neutral-500 mt-1.5 leading-relaxed">
                  {ticket.description}
                </p>
              </div>

              <div className="pt-3 flex flex-wrap items-center justify-between gap-2 text-[11px] text-neutral-500 font-mono border-t border-neutral-200">
                <div className="flex items-center gap-2">
                  <UserCheck className="w-3.5 h-3.5 text-neutral-500" />
                  <span>Responsável: <strong className="text-neutral-800 font-sans">{ticket.assignedTo || 'Fila Geral GFERRO'}</strong></span>
                </div>
                <span>Criado em: {ticket.createdAt}</span>
              </div>
            </div>
          ))
        )}
      </div>

    </div>
  );
};
