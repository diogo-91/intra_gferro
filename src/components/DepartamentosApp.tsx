import React, { useState } from 'react';
import {
  Building2,
  MessageSquare,
  Search,
  Layers,
  CheckCircle2,
} from 'lucide-react';
import { Department, Colaborador, TabType, User } from '../types';

interface DepartamentosAppProps {
  user: User;
  departments: Department[];
  colaboradores: Colaborador[];
  selectedDeptId: string;
  onSelectDept: (id: string) => void;
  setActiveTab: (tab: TabType) => void;
  onOpenNewChamado: () => void;
}

export const DepartamentosApp: React.FC<DepartamentosAppProps> = ({
  user,
  departments,
  colaboradores,
  selectedDeptId,
  onSelectDept,
  setActiveTab,
  onOpenNewChamado,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [viewMode, setViewMode] = useState<'modules' | 'overview'>('modules');

  const selectedDepartment = departments.find((d) => d.id === selectedDeptId) || departments[0];

  const filteredDepts = departments.filter((d) => {
    const q = searchQuery.toLowerCase();
    return (
      d.name.toLowerCase().includes(q) ||
      d.code.toLowerCase().includes(q) ||
      (d.manager?.name.toLowerCase().includes(q) ?? false) ||
      d.description.toLowerCase().includes(q)
    );
  });

  return (
    <div className="space-y-6 pb-12">

      {/* Header Banner */}
      <div className="relative overflow-hidden rounded-[2rem] bg-white border border-neutral-200 p-6 sm:p-8 shadow-sm space-y-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 relative z-10">
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-yellow-600 font-extrabold text-xs uppercase tracking-widest">
              <Building2 className="w-4 h-4 text-yellow-600" />
              <span>Siderurgia GFERRO • Módulos por Setor</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-black text-neutral-900 tracking-tight">
              Módulos Operacionais dos Departamentos
            </h1>
            <p className="text-xs sm:text-sm text-neutral-600 max-w-xl font-medium">
              Estrutura, gestores, projetos e responsabilidades de cada área da GFERRO.
            </p>
          </div>

          {/* Mode Selector Toggle */}
          <div className="flex items-center bg-neutral-50 p-1.5 rounded-full border border-neutral-200 shrink-0">
            <button
              onClick={() => setViewMode('modules')}
              className={`px-4 py-2 rounded-full text-xs font-bold transition-all ${
                viewMode === 'modules'
                  ? 'bg-yellow-400 text-black shadow-lg'
                  : 'text-neutral-500 hover:text-neutral-900'
              }`}
            >
              Módulos Operacionais
            </button>
            <button
              onClick={() => setViewMode('overview')}
              className={`px-4 py-2 rounded-full text-xs font-bold transition-all ${
                viewMode === 'overview'
                  ? 'bg-yellow-400 text-black shadow-lg'
                  : 'text-neutral-500 hover:text-neutral-900'
              }`}
            >
              Visão Organizacional ({departments.length})
            </button>
          </div>
        </div>

        {/* Department Switcher Tabs */}
        <div className="pt-2 border-t border-neutral-200 flex items-center gap-2 overflow-x-auto no-scrollbar pb-1">
          <span className="text-[10px] font-bold text-neutral-500 uppercase tracking-widest shrink-0 mr-1">
            Selecione o Setor:
          </span>
          {departments.map((dept) => {
            const isSelected = dept.id === selectedDeptId;
            return (
              <button
                key={dept.id}
                onClick={() => {
                  onSelectDept(dept.id);
                  setViewMode('modules');
                }}
                className={`px-3.5 py-2 rounded-full text-xs font-extrabold whitespace-nowrap transition-all flex items-center gap-2 ${
                  isSelected
                    ? 'bg-yellow-400 text-black shadow-lg shadow-yellow-400/20'
                    : 'bg-neutral-50 text-neutral-600 border border-neutral-200 hover:border-yellow-400/50 hover:text-neutral-900'
                }`}
              >
                <span className="font-mono text-[10px] opacity-80">{dept.code}</span>
                <span>{dept.name.split(' ')[0]}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* VIEW MODE 1: MODULES DEPARTAMENTAIS */}
      {viewMode === 'modules' && (
        <div className="space-y-6">

          {/* Active Department Header Banner */}
          <div className="p-6 rounded-[2rem] bg-white border border-yellow-400/30 flex flex-col md:flex-row md:items-center justify-between gap-6 shadow-sm">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 rounded-2xl bg-yellow-400 text-black font-black text-xl flex items-center justify-center shrink-0 shadow-lg shadow-yellow-400/20">
                {selectedDepartment.code.split('-')[1] || 'DEP'}
              </div>
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="px-2.5 py-0.5 rounded-full bg-yellow-50 text-yellow-700 border border-yellow-200 text-[10px] font-extrabold font-mono">
                    {selectedDepartment.code}
                  </span>
                  {selectedDepartment.location && (
                    <span className="text-xs text-neutral-500 font-semibold">
                      Local: {selectedDepartment.location}
                    </span>
                  )}
                </div>
                <h2 className="text-xl font-black text-neutral-900 tracking-tight">
                  Módulo de {selectedDepartment.name}
                </h2>
                {selectedDepartment.description && (
                  <p className="text-xs text-neutral-600">
                    {selectedDepartment.description}
                  </p>
                )}
              </div>
            </div>

            {selectedDepartment.manager && (
              <div className="flex items-center gap-3 shrink-0 bg-neutral-50 p-3 rounded-2xl border border-neutral-100">
                <img
                  src={selectedDepartment.manager.avatar}
                  alt={selectedDepartment.manager.name}
                  className="w-10 h-10 rounded-full object-cover border-2 border-yellow-400"
                />
                <div className="text-xs">
                  <span className="text-[10px] text-neutral-500 uppercase font-bold block">Gestor do Módulo</span>
                  <span className="font-bold text-neutral-900 block">{selectedDepartment.manager.name}</span>
                  <span className="text-[10px] font-mono text-yellow-600">Ramal {selectedDepartment.ramal}</span>
                </div>
              </div>
            )}
          </div>

          {/* Projetos-chave e responsabilidades do setor selecionado — dado
              real (mockData.ts), sem KPIs "ao vivo" fictícios. Setor sem dado
              cadastrado ainda não mostra os cards (nada de placeholder vazio). */}
          {(selectedDepartment.keyProjects.length > 0 || selectedDepartment.responsibilities.length > 0) && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {selectedDepartment.keyProjects.length > 0 && (
                <div className="p-6 rounded-[2rem] bg-white border border-neutral-200 space-y-4 shadow-sm">
                  <div className="flex items-center gap-2">
                    <Layers className="w-5 h-5 text-yellow-600" aria-hidden="true" />
                    <h3 className="text-sm font-extrabold text-neutral-900 uppercase tracking-wider">
                      Projetos em Destaque
                    </h3>
                  </div>
                  <ul className="space-y-2.5 text-xs text-neutral-600">
                    {selectedDepartment.keyProjects.map((projeto) => (
                      <li key={projeto} className="flex items-start gap-2.5">
                        <span className="w-1.5 h-1.5 rounded-full bg-yellow-400 mt-1.5 shrink-0" aria-hidden="true" />
                        <span>{projeto}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {selectedDepartment.responsibilities.length > 0 && (
                <div className="p-6 rounded-[2rem] bg-white border border-neutral-200 space-y-4 shadow-sm">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="w-5 h-5 text-yellow-600" aria-hidden="true" />
                    <h3 className="text-sm font-extrabold text-neutral-900 uppercase tracking-wider">
                      Responsabilidades do Setor
                    </h3>
                  </div>
                  <ul className="space-y-2.5 text-xs text-neutral-600">
                    {selectedDepartment.responsibilities.map((resp) => (
                      <li key={resp} className="flex items-start gap-2.5">
                        <span className="w-1.5 h-1.5 rounded-full bg-yellow-400 mt-1.5 shrink-0" aria-hidden="true" />
                        <span>{resp}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}

        </div>
      )}

      {/* VIEW MODE 2: VISÃO ORGANIZACIONAL COMPLETA */}
      {viewMode === 'overview' && (
        <div className="space-y-6">
          <div className="relative max-w-md">
            <Search className="w-4 h-4 absolute left-4 top-1/2 -translate-y-1/2 text-neutral-500" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Buscar por setor, responsável, ramal ou projeto..."
              className="w-full bg-neutral-50 border border-neutral-200 rounded-full py-2.5 pl-11 pr-4 text-xs text-neutral-900 placeholder-neutral-500 focus:outline-none focus:border-yellow-400 transition-all"
            />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {filteredDepts.map((dept) => (
              <div
                key={dept.id}
                className="p-6 rounded-[2rem] bg-white border border-neutral-200 space-y-5 shadow-sm hover:border-yellow-400/40 transition-all flex flex-col justify-between"
              >
                <div className="space-y-4">
                  <div className="flex items-center justify-between gap-2 border-b border-neutral-200 pb-4">
                    <div className="flex items-center gap-3 min-w-0">
                      <span className="px-3 py-1 rounded-full bg-yellow-400 text-black font-extrabold text-[10px] uppercase font-mono tracking-wider shrink-0">
                        {dept.code}
                      </span>
                      <h3 className="text-lg font-extrabold text-neutral-900 truncate">
                        {dept.name}
                      </h3>
                    </div>

                    <span className="px-3 py-1 rounded-full bg-neutral-50 border border-neutral-200 text-[10px] font-mono font-bold text-neutral-600 shrink-0">
                      {dept.memberCount} Integrantes
                    </span>
                  </div>

                  {dept.description && (
                    <p className="text-xs text-neutral-600 leading-relaxed font-medium">
                      {dept.description}
                    </p>
                  )}

                  {(dept.manager || dept.ramal) && (
                    <div className="p-4 rounded-2xl bg-neutral-50 border border-neutral-100 flex items-center justify-between gap-4">
                      {dept.manager && (
                        <div className="flex items-center gap-3 min-w-0">
                          <img
                            src={dept.manager.avatar}
                            alt={dept.manager.name}
                            className="w-10 h-10 rounded-full object-cover border-2 border-yellow-400 shrink-0"
                          />
                          <div className="min-w-0">
                            <span className="text-[10px] text-neutral-500 uppercase font-bold block">
                              Gestão do Setor
                            </span>
                            <span className="text-xs font-bold text-neutral-900 block truncate">
                              {dept.manager.name}
                            </span>
                            <span className="text-[10px] text-neutral-500 block truncate">
                              {dept.manager.role}
                            </span>
                          </div>
                        </div>
                      )}

                      {dept.ramal && (
                        <div className="text-right shrink-0">
                          <span className="text-[10px] text-neutral-500 uppercase font-bold block">
                            Ramal Direto
                          </span>
                          <span className="text-xs font-mono font-extrabold text-yellow-600 block">
                            {dept.ramal}
                          </span>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                <div className="pt-4 border-t border-neutral-200 flex flex-wrap items-center justify-between gap-2 text-xs">
                  <button
                    onClick={() => {
                      onSelectDept(dept.id);
                      setViewMode('modules');
                    }}
                    className="px-4 py-2 rounded-full bg-yellow-400 text-black font-extrabold text-xs hover:bg-yellow-300 flex items-center gap-2 transition-all active:scale-95"
                  >
                    <Layers className="w-3.5 h-3.5" />
                    <span>Ver Módulo do Setor</span>
                  </button>

                  <button
                    onClick={() => setActiveTab('chat')}
                    className="px-4 py-2 rounded-full bg-neutral-50 text-neutral-600 border border-neutral-200 hover:border-yellow-400 hover:text-yellow-600 font-bold text-xs flex items-center gap-1.5 transition-all"
                  >
                    <MessageSquare className="w-3.5 h-3.5 text-yellow-600" />
                    <span>Chat Interno</span>
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

    </div>
  );
};
