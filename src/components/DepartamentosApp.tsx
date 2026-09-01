import React, { useEffect, useState } from 'react';
import { Layers, CheckCircle2, LayoutDashboard, TicketCheck } from 'lucide-react';
import { Department, Colaborador, User } from '../types';
import { CadastroFuncionariosRH } from './CadastroFuncionariosRH';
import { SacApp } from './SacApp';
import { PlanejamentoProducaoPCP } from './PlanejamentoProducaoPCP';
import { ChamadosDepartamento } from './ChamadosDepartamento';

interface DepartamentosAppProps {
  user: User;
  departments: Department[];
  colaboradores: Colaborador[];
  selectedDeptId: string;
  refreshKey: number;
}

export const DepartamentosApp: React.FC<DepartamentosAppProps> = ({
  user,
  departments,
  colaboradores,
  selectedDeptId,
  refreshKey,
}) => {
  const selectedDepartment = departments.find((d) => d.id === selectedDeptId) || departments[0];
  const [visao, setVisao] = useState<'area' | 'chamados'>('area');
  const [novosChamados, setNovosChamados] = useState(0);
  useEffect(() => setVisao('area'), [selectedDeptId]);
  useEffect(() => {
    let ativo = true;
    const atualizarContagem = async () => {
      try {
        const resposta = await fetch(`/api/chamados?escopo=departamento&departamentoId=${encodeURIComponent(selectedDepartment.id)}`);
        const chamados = await resposta.json();
        if (ativo && resposta.ok && Array.isArray(chamados)) {
          setNovosChamados(chamados.filter((chamado) => chamado.status === 'Aberto').length);
        }
      } catch {
        // Mantém a última contagem durante falhas temporárias de conexão.
      }
    };
    setNovosChamados(0);
    atualizarContagem();
    const intervalo = window.setInterval(atualizarContagem, 30000);
    return () => { ativo = false; window.clearInterval(intervalo); };
  }, [selectedDepartment.id, refreshKey]);
  const navegacao = <div className="flex gap-2 p-1 bg-neutral-100 rounded-2xl w-fit">
    <button onClick={()=>setVisao('area')} className={`px-4 py-2 rounded-xl text-xs font-black flex gap-2 items-center ${visao==='area'?'bg-white shadow-sm':'text-neutral-500'}`}><LayoutDashboard className="w-4 h-4"/>Visão da área</button>
    <button onClick={()=>setVisao('chamados')} className={`relative px-4 py-2 rounded-xl text-xs font-black flex gap-2 items-center ${visao==='chamados'?'bg-yellow-400 shadow-sm':'text-neutral-500'}`}><TicketCheck className="w-4 h-4"/>Chamados do departamento{novosChamados>0&&<span className="absolute -right-2 -top-2 flex h-5 min-w-5 items-center justify-center rounded-full bg-red-600 px-1.5 text-[10px] font-black text-white ring-2 ring-white">{novosChamados>99?'99+':novosChamados}</span>}</button>
  </div>;

  if (visao === 'chamados') return <div className="space-y-5 pb-12">{navegacao}<div><h1 className="text-2xl font-black">Atendimento · {selectedDepartment.name}</h1><p className="text-xs text-neutral-500 mt-1">Fila completa de solicitações encaminhadas a este departamento.</p></div><ChamadosDepartamento department={selectedDepartment} refreshKey={refreshKey} onNewCountChange={setNovosChamados}/></div>;

  // O módulo RH tem sua própria página completa (cabeçalho, KPIs e cadastro
  // de funcionários) — não faz sentido empilhar o banner genérico de setor
  // em cima disso.
  if (selectedDepartment.id === 'dep-rh') {
    return <div className="space-y-5 pb-12">{navegacao}<CadastroFuncionariosRH setores={departments.map((d) => d.name)} /></div>;
  }

  if (selectedDepartment.id === 'dep-sac') {
    return <div className="space-y-5 pb-12">{navegacao}<SacApp user={user} /></div>;
  }

  if (selectedDepartment.id === 'dep-pcp') {
    return <div className="space-y-5 pb-12">{navegacao}<PlanejamentoProducaoPCP /></div>;
  }

  return (
    <div className="space-y-6 pb-12">

      {navegacao}

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
