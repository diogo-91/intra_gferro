import React from 'react';
import { Layers, CheckCircle2 } from 'lucide-react';
import { Department, Colaborador, User } from '../types';

interface DepartamentosAppProps {
  user: User;
  departments: Department[];
  colaboradores: Colaborador[];
  selectedDeptId: string;
  onOpenNewChamado: () => void;
}

export const DepartamentosApp: React.FC<DepartamentosAppProps> = ({
  user,
  departments,
  colaboradores,
  selectedDeptId,
  onOpenNewChamado,
}) => {
  const selectedDepartment = departments.find((d) => d.id === selectedDeptId) || departments[0];

  return (
    <div className="space-y-6 pb-12">

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
  );
};
