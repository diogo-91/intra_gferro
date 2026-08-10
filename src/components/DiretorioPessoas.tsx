import React, { useState } from 'react';
import { Colaborador } from '../types';
import {
  Users,
  Search,
  PhoneCall,
  Mail,
  MessageSquare,
  MapPin,
  Building2,
  Grid,
  List,
  Cake,
  CheckCircle2
} from 'lucide-react';

interface DiretorioPessoasProps {
  colaboradores: Colaborador[];
}

export const DiretorioPessoas: React.FC<DiretorioPessoasProps> = ({ colaboradores }) => {
  const [selectedDept, setSelectedDept] = useState<string>('Todos');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');

  const departments = [
    'Todos',
    'Operações & Siderurgia',
    'Engenharia & Qualidade',
    'Recursos Humanos',
    'Financeiro',
    'Comercial & Vendas',
    'TI & Sistemas',
  ];

  const filtered = colaboradores.filter((col) => {
    const matchesDept = selectedDept === 'Todos' || col.department === selectedDept;
    const matchesSearch =
      col.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      col.role.toLowerCase().includes(searchQuery.toLowerCase()) ||
      col.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
      col.ramal.includes(searchQuery);
    return matchesDept && matchesSearch;
  });

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'Disponível':
        return <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" title="Disponível" />;
      case 'Em Turno de Fábrica':
        return <span className="w-2.5 h-2.5 rounded-full bg-amber-400" title="Em Turno de Fábrica" />;
      case 'Em Reunião':
        return <span className="w-2.5 h-2.5 rounded-full bg-red-400" title="Em Reunião" />;
      default:
        return <span className="w-2.5 h-2.5 rounded-full bg-zinc-500" title="Ausente" />;
    }
  };

  return (
    <div className="space-y-6 pb-12">

      {/* Header */}
      <div className="bg-white p-6 rounded-[2rem] border border-neutral-200 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-black text-neutral-900 flex items-center gap-2 tracking-tight">
            <Users className="w-6 h-6 text-yellow-600" />
            <span>Diretório de Colaboradores GFERRO</span>
          </h1>
          <p className="text-xs text-neutral-500 mt-1 font-medium">
            Encontre contatos, ramais internos, e-mails e localização das equipes de operações, engenharia e corporativo.
          </p>
        </div>

        <div className="flex items-center gap-1 bg-neutral-50 p-1.5 rounded-full border border-neutral-200 shrink-0">
          <button
            onClick={() => setViewMode('grid')}
            className={`p-2 rounded-full text-xs font-extrabold transition-all ${
              viewMode === 'grid' ? 'bg-yellow-400 text-black shadow-md' : 'text-neutral-500 hover:text-neutral-900'
            }`}
            title="Visualização em Grade"
          >
            <Grid className="w-4 h-4" />
          </button>
          <button
            onClick={() => setViewMode('list')}
            className={`p-2 rounded-full text-xs font-extrabold transition-all ${
              viewMode === 'list' ? 'bg-yellow-400 text-black shadow-md' : 'text-neutral-500 hover:text-neutral-900'
            }`}
            title="Visualização em Lista"
          >
            <List className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Filters & Search */}
      <div className="flex flex-col md:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-2 overflow-x-auto w-full md:w-auto pb-1 no-scrollbar">
          {departments.map((dept) => (
            <button
              key={dept}
              onClick={() => setSelectedDept(dept)}
              className={`px-4 py-2 rounded-full text-xs font-extrabold whitespace-nowrap transition-all ${
                selectedDept === dept
                  ? 'bg-yellow-400 text-black shadow-lg shadow-yellow-400/20'
                  : 'bg-white text-neutral-500 hover:text-neutral-900 border border-neutral-200'
              }`}
            >
              {dept}
            </button>
          ))}
        </div>

        <div className="relative w-full md:w-72">
          <Search className="w-4 h-4 absolute left-4 top-1/2 -translate-y-1/2 text-neutral-500" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Buscar por nome, ramal, e-mail..."
            className="w-full pl-10 pr-4 py-2 text-xs bg-white border border-neutral-200 rounded-full text-neutral-900 placeholder-neutral-500 focus:outline-none focus:border-yellow-400 transition-all"
          />
        </div>
      </div>

      {/* View: Grid Mode */}
      {viewMode === 'grid' ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
          {filtered.map((col) => (
            <div
              key={col.id}
              className="p-6 rounded-[2rem] bg-white border border-neutral-200 hover:border-yellow-400/60 transition-all flex flex-col justify-between space-y-4 shadow-sm group"
            >
              <div className="space-y-3">
                <div className="flex items-start justify-between">
                  <div className="relative">
                    <img
                      src={col.avatar}
                      alt={col.name}
                      className="w-16 h-16 rounded-2xl object-cover border-2 border-yellow-400 group-hover:scale-105 transition-all shadow-md"
                    />
                    <div className="absolute -bottom-1 -right-1 p-0.5 rounded-full bg-white ring-2 ring-neutral-900">
                      {getStatusBadge(col.status)}
                    </div>
                  </div>

                  <span className="px-3 py-1 rounded-full bg-yellow-50 text-yellow-700 font-mono text-[10px] font-extrabold border border-yellow-200">
                    Ramal {col.ramal}
                  </span>
                </div>

                <div>
                  <h3 className="text-base font-extrabold text-neutral-900 group-hover:text-yellow-600 transition-colors leading-tight">
                    {col.name}
                  </h3>
                  <p className="text-xs text-neutral-500 mt-1 leading-snug">
                    {col.role}
                  </p>
                  <span className="inline-block mt-2 px-3 py-1 rounded-full bg-neutral-50 text-neutral-500 text-[10px] font-bold border border-neutral-100">
                    {col.department}
                  </span>
                </div>
              </div>

              <div className="space-y-2.5 pt-3 border-t border-neutral-200 text-xs">
                <div className="flex items-center gap-2 text-neutral-500 truncate">
                  <MapPin className="w-3.5 h-3.5 text-yellow-600 shrink-0" />
                  <span className="truncate text-[11px]">{col.location}</span>
                </div>

                <div className="flex items-center gap-2 text-neutral-500 truncate">
                  <Mail className="w-3.5 h-3.5 text-neutral-500 shrink-0" />
                  <span className="truncate text-[11px] font-mono">{col.email}</span>
                </div>

                <div className="pt-2 flex items-center gap-2">
                  <a
                    href={`https://wa.me/55${col.whatsapp}`}
                    target="_blank"
                    rel="noreferrer"
                    className="flex-1 py-2 rounded-full bg-emerald-50 text-emerald-700 hover:bg-emerald-100 text-xs font-extrabold flex items-center justify-center gap-1.5 transition-colors border border-emerald-200"
                  >
                    <MessageSquare className="w-3.5 h-3.5" />
                    <span>WhatsApp</span>
                  </a>

                  <a
                    href={`mailto:${col.email}`}
                    className="p-2 rounded-full bg-neutral-50 text-neutral-600 hover:text-yellow-600 hover:bg-neutral-100 transition-colors border border-neutral-200"
                    title="Enviar E-mail"
                  >
                    <Mail className="w-4 h-4" />
                  </a>
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        /* View: List Mode */
        <div className="bg-white rounded-[2rem] border border-neutral-200 overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-neutral-600">
              <thead className="bg-neutral-50 border-b border-neutral-200 text-neutral-500 uppercase font-mono text-[10px] tracking-wider">
                <tr>
                  <th className="p-4">Colaborador</th>
                  <th className="p-4">Cargo & Departamento</th>
                  <th className="p-4">Ramal</th>
                  <th className="p-4">Localização</th>
                  <th className="p-4 text-right">Contato Direct</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100">
                {filtered.map((col) => (
                  <tr key={col.id} className="hover:bg-neutral-100 transition-colors">
                    <td className="p-4">
                      <div className="flex items-center gap-3">
                        <img src={col.avatar} alt={col.name} className="w-10 h-10 rounded-xl object-cover border-2 border-yellow-400" />
                        <div>
                          <span className="font-bold text-neutral-900 block">{col.name}</span>
                          <span className="text-[10px] text-neutral-500">{col.email}</span>
                        </div>
                      </div>
                    </td>
                    <td className="p-4">
                      <span className="font-semibold text-neutral-900 block">{col.role}</span>
                      <span className="text-[10px] text-yellow-600 font-extrabold">{col.department}</span>
                    </td>
                    <td className="p-4 font-mono font-bold text-yellow-600">
                      {col.ramal}
                    </td>
                    <td className="p-4 text-neutral-500">
                      {col.location}
                    </td>
                    <td className="p-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <a
                          href={`https://wa.me/55${col.whatsapp}`}
                          target="_blank"
                          rel="noreferrer"
                          className="px-3 py-1.5 rounded-full bg-emerald-50 text-emerald-700 font-extrabold text-[11px] border border-emerald-200 hover:bg-emerald-100"
                        >
                          WhatsApp
                        </a>
                        <a
                          href={`mailto:${col.email}`}
                          className="p-2 rounded-full bg-neutral-50 text-neutral-500 hover:text-neutral-900 border border-neutral-200"
                        >
                          <Mail className="w-4 h-4" />
                        </a>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

    </div>
  );
};
