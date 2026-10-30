import React, { useState } from 'react';
import {
  LayoutDashboard,
  Megaphone,
  Newspaper,
  FileText,
  LifeBuoy,
  Users,
  MessageSquare,
  Building2,
  Lightbulb,
  TrendingUp,
  Wallet,
  Factory,
  UserCog,
  Headphones,
  BarChart3,
  ClipboardList,
  Cpu,
  ChevronDown,
  ShieldCheck,
  Target
} from 'lucide-react';
import { TabType, Department } from '../types';
import type { ModuloId } from '../modulos';

interface SidebarProps {
  activeTab: TabType;
  setActiveTab: (tab: TabType) => void;
  mobileMenuOpen: boolean;
  setMobileMenuOpen: (open: boolean) => void;
  onOpenAIAssistant: () => void;
  departments: Department[];
  selectedDeptId: string;
  onSelectDepartamento: (id: string) => void;
  modulos: ModuloId[];
  administrador: boolean;
}

type NavLeaf = { id: TabType; label: string; icon: React.FC<{ className?: string }>; badge?: string; subitens?: NavLeaf[] };
type NavGroup = { id: 'dashboard'; label: string; icon: React.FC<{ className?: string }>; children: NavLeaf[] };
type NavEntry = NavLeaf | NavGroup;

const isGroup = (item: NavEntry): item is NavGroup => 'children' in item;

// Ícone por área — sem correspondência 1:1 com initialDepartments (a lista
// muda), então casa pelo nome; setor novo sem ícone mapeado cai no genérico.
const ICONE_POR_AREA: Record<string, React.FC<{ className?: string }>> = {
  Comercial: TrendingUp,
  RH: UserCog,
  SAC: Headphones,
  PCP: ClipboardList,
  'Produção': Factory,
  Tecnologia: Cpu,
};

export const Sidebar: React.FC<SidebarProps> = ({
  activeTab,
  setActiveTab,
  mobileMenuOpen,
  setMobileMenuOpen,
  onOpenAIAssistant,
  departments,
  selectedDeptId,
  onSelectDepartamento,
  modulos,
  administrador,
}) => {
  // "Programação" e "Saídas" são telas do Financeiro: usam a permissão desse módulo.
  const permitido = (id: TabType) => administrador || modulos.includes((id === 'programacao' || id === 'saidas' ? 'financeiro' : id) as ModuloId);
  const navItems: NavEntry[] = [
    { id: 'informativos', label: 'Informativos Internos', icon: Megaphone },
    { id: 'comunicados', label: 'Comunicados & Feed', icon: Newspaper },
    { id: 'documentos', label: 'Documentos & NRs', icon: FileText },
    { id: 'servicos', label: 'Meus Chamados', icon: LifeBuoy },
    { id: 'pessoas', label: 'Diretório de Pessoas', icon: Users },
    { id: 'chat', label: 'Chat Interno GFERRO', icon: MessageSquare },
    { id: 'ia-assistente', label: 'Ideias e Sugestões', icon: Lightbulb },
    { id: 'qualidade', label: 'Qualidade', icon: ShieldCheck },
    {
      id: 'dashboard',
      label: 'Dashboard',
      icon: LayoutDashboard,
      children: [
        { id: 'vendas', label: 'Vendas', icon: TrendingUp },
        { id: 'financeiro', label: 'Financeiro', icon: Wallet, subitens: [{ id: 'programacao', label: 'Programação', icon: ClipboardList }, { id: 'saidas', label: 'Saídas', icon: BarChart3 }] },
        { id: 'producao', label: 'Produção', icon: Factory },
        { id: 'gestao', label: 'Gestão', icon: Target },
      ],
    },
  ];

  const dashboardGroup = navItems.find(isGroup)!;
  const contemAba = (item: NavLeaf) => item.id === activeTab || !!item.subitens?.some((sub) => sub.id === activeTab);
  const isInDashboardGroup = dashboardGroup.children.some(contemAba);
  const isInDepartamentosGroup = activeTab === 'departamentos';

  const [dashboardExpanded, setDashboardExpanded] = useState(isInDashboardGroup);
  const [departamentosExpanded, setDepartamentosExpanded] = useState(isInDepartamentosGroup);
  // Itens do Dashboard com submenu (hoje só o Financeiro): recolhidos à mão pelo usuário.
  const [subitensRecolhidos, setSubitensRecolhidos] = useState<Set<string>>(() => new Set());

  const handleSelectTab = (tab: TabType) => {
    if (tab === 'ia-assistente') {
      onOpenAIAssistant();
    } else {
      setActiveTab(tab);
    }
    setMobileMenuOpen(false);
  };

  const handleSelectDepartamento = (deptId: string) => {
    onSelectDepartamento(deptId);
    handleSelectTab('departamentos');
  };

  return (
    <>
      {/* Mobile Backdrop */}
      {mobileMenuOpen && (
        <div
          onClick={() => setMobileMenuOpen(false)}
          className="fixed inset-0 bg-black/80 backdrop-blur-sm z-40 lg:hidden"
        />
      )}

      {/* Sidebar Container */}
      <aside
        className={`fixed top-16 sm:top-20 bottom-0 left-0 z-40 w-[min(18rem,calc(100vw-3rem))] lg:w-64 bg-[#111111] border-r border-white/10 flex flex-col justify-between transition-transform duration-300 ease-in-out ${
          mobileMenuOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        }`}
      >
        {/* Navigation Items */}
        <div className="p-3 sm:p-4 pb-[max(1rem,env(safe-area-inset-bottom))] space-y-1.5 overflow-y-auto overscroll-contain sidebar-scroll">
          <div className="px-3 py-2 text-xs font-bold uppercase tracking-widest text-neutral-500">
            Menu Intranet
          </div>

          {navItems.slice(0, 6).filter((item) => !isGroup(item) && permitido(item.id)).map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;

            return (
              <button
                key={item.id}
                id={`sidebar-tab-${item.id}`}
                onClick={() => handleSelectTab(item.id)}
                className={`w-full flex items-center justify-between px-3.5 py-3 rounded-xl font-medium text-xs transition-all ${
                  isActive
                    ? 'bg-yellow-400 text-black font-bold shadow-lg shadow-yellow-400/20'
                    : 'text-neutral-400 hover:text-yellow-400 hover:bg-white/5'
                }`}
              >
                <div className="flex items-center gap-3 min-w-0">
                  <Icon className={`w-4 h-4 shrink-0 ${isActive ? 'text-black' : 'text-neutral-500'}`} />
                  <span className="truncate">{item.label}</span>
                </div>
              </button>
            );
          })}

          {administrador && (
            <div className="pt-3 mt-3 border-t border-white/10">
              <div className="px-3 py-2 text-xs font-bold uppercase tracking-widest text-neutral-500">
                Administração
              </div>
              <button
                id="sidebar-tab-usuarios"
                onClick={() => handleSelectTab('usuarios')}
                className={`w-full flex items-center gap-3 px-3.5 py-3 rounded-xl font-medium text-xs transition-all ${
                  activeTab === 'usuarios'
                    ? 'bg-yellow-400 text-black font-bold shadow-lg shadow-yellow-400/20'
                    : 'text-neutral-400 hover:text-yellow-400 hover:bg-white/5'
                }`}
              >
                <ShieldCheck className={`w-4 h-4 shrink-0 ${activeTab === 'usuarios' ? 'text-black' : 'text-neutral-500'}`} />
                <span>Cadastro de usuários</span>
              </button>
            </div>
          )}

          {/* Departamentos & Áreas — grupo expansível com um submenu por área */}
          {permitido('departamentos') && <div>
            <button
              id="sidebar-group-departamentos"
              onClick={() => setDepartamentosExpanded((prev) => !prev)}
              className={`w-full flex items-center justify-between px-3.5 py-3 rounded-xl font-medium text-xs transition-all ${
                isInDepartamentosGroup && !departamentosExpanded
                  ? 'bg-yellow-400 text-black font-bold shadow-lg shadow-yellow-400/20'
                  : 'text-neutral-400 hover:text-yellow-400 hover:bg-white/5'
              }`}
            >
              <div className="flex items-center gap-3 min-w-0">
                <Building2 className={`w-4 h-4 shrink-0 ${isInDepartamentosGroup && !departamentosExpanded ? 'text-black' : 'text-neutral-500'}`} />
                <span className="truncate">Departamentos & Áreas</span>
              </div>
              <ChevronDown
                className={`w-3.5 h-3.5 shrink-0 transition-transform ${departamentosExpanded ? 'rotate-180' : ''} ${
                  isInDepartamentosGroup && !departamentosExpanded ? 'text-black' : 'text-neutral-500'
                }`}
              />
            </button>

            {departamentosExpanded && (
              <div className="mt-1 ml-3 pl-3 border-l border-white/10 space-y-1">
                {departments.map((dept) => {
                  const ChildIcon = ICONE_POR_AREA[dept.name] || Building2;
                  const isActive = activeTab === 'departamentos' && selectedDeptId === dept.id;

                  return (
                    <button
                      key={dept.id}
                      id={`sidebar-departamento-${dept.id}`}
                      onClick={() => handleSelectDepartamento(dept.id)}
                      className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl font-medium text-xs transition-all ${
                        isActive
                          ? 'bg-yellow-400 text-black font-bold shadow-lg shadow-yellow-400/20'
                          : 'text-neutral-400 hover:text-yellow-400 hover:bg-white/5'
                      }`}
                    >
                      <ChildIcon className={`w-4 h-4 shrink-0 ${isActive ? 'text-black' : 'text-neutral-500'}`} />
                      <span className="truncate">{dept.name}</span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>}

          {navItems.slice(6).map((item) => {
            const Icon = item.icon;

            if (isGroup(item)) {
              const filhosPermitidos = item.children.filter((child) => permitido(child.id));
              if (filhosPermitidos.length === 0) return null;
              const groupActive = filhosPermitidos.some(contemAba);

              return (
                <div key={item.id}>
                  <button
                    id={`sidebar-group-${item.id}`}
                    onClick={() => setDashboardExpanded((prev) => !prev)}
                    className={`w-full flex items-center justify-between px-3.5 py-3 rounded-xl font-medium text-xs transition-all ${
                      groupActive && !dashboardExpanded
                        ? 'bg-yellow-400 text-black font-bold shadow-lg shadow-yellow-400/20'
                        : 'text-neutral-400 hover:text-yellow-400 hover:bg-white/5'
                    }`}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <Icon className={`w-4 h-4 shrink-0 ${groupActive && !dashboardExpanded ? 'text-black' : 'text-neutral-500'}`} />
                      <span className="truncate">{item.label}</span>
                    </div>
                    <ChevronDown
                      className={`w-3.5 h-3.5 shrink-0 transition-transform ${dashboardExpanded ? 'rotate-180' : ''} ${
                        groupActive && !dashboardExpanded ? 'text-black' : 'text-neutral-500'
                      }`}
                    />
                  </button>

                  {dashboardExpanded && (
                    <div className="mt-1 ml-3 pl-3 border-l border-white/10 space-y-1">
                      {filhosPermitidos.map((child) => {
                        const ChildIcon = child.icon;
                        const isActive = activeTab === child.id;

                        if (child.subitens) {
                          const noSubitem = child.subitens.some((sub) => sub.id === activeTab);
                          const subitensVisiveis = noSubitem || !subitensRecolhidos.has(child.id);
                          const pintado = isActive && !subitensVisiveis;

                          return (
                            <div key={child.id}>
                              <div className="flex items-center gap-1">
                                <button
                                  id={`sidebar-tab-${child.id}`}
                                  onClick={() => {
                                    handleSelectTab(child.id);
                                    setSubitensRecolhidos((prev) => { const novo = new Set(prev); novo.delete(child.id); return novo; });
                                  }}
                                  className={`flex-1 min-w-0 flex items-center gap-3 px-3 py-2.5 rounded-xl font-medium text-xs transition-all ${
                                    isActive
                                      ? 'bg-yellow-400 text-black font-bold shadow-lg shadow-yellow-400/20'
                                      : 'text-neutral-400 hover:text-yellow-400 hover:bg-white/5'
                                  }`}
                                >
                                  <ChildIcon className={`w-4 h-4 shrink-0 ${isActive ? 'text-black' : 'text-neutral-500'}`} />
                                  <span className="truncate">{child.label}</span>
                                </button>
                                <button
                                  type="button"
                                  id={`sidebar-toggle-${child.id}`}
                                  aria-label={subitensVisiveis ? `Recolher submenu de ${child.label}` : `Expandir submenu de ${child.label}`}
                                  aria-expanded={subitensVisiveis}
                                  onClick={() => setSubitensRecolhidos((prev) => { const novo = new Set(prev); if (novo.has(child.id)) novo.delete(child.id); else novo.add(child.id); return novo; })}
                                  className="p-2 rounded-lg text-neutral-500 hover:text-yellow-400 hover:bg-white/5 transition-all"
                                >
                                  <ChevronDown className={`w-3.5 h-3.5 transition-transform ${subitensVisiveis ? 'rotate-180' : ''} ${pintado ? 'text-black' : ''}`} />
                                </button>
                              </div>

                              {subitensVisiveis && (
                                <div className="mt-1 ml-4 pl-3 border-l border-white/10 space-y-1">
                                  {child.subitens.filter((sub) => permitido(sub.id)).map((sub) => {
                                    const SubIcon = sub.icon;
                                    const subAtivo = activeTab === sub.id;

                                    return (
                                      <button
                                        key={sub.id}
                                        id={`sidebar-tab-${sub.id}`}
                                        onClick={() => handleSelectTab(sub.id)}
                                        className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl font-medium text-xs transition-all ${
                                          subAtivo
                                            ? 'bg-yellow-400 text-black font-bold shadow-lg shadow-yellow-400/20'
                                            : 'text-neutral-400 hover:text-yellow-400 hover:bg-white/5'
                                        }`}
                                      >
                                        <SubIcon className={`w-4 h-4 shrink-0 ${subAtivo ? 'text-black' : 'text-neutral-500'}`} />
                                        <span className="truncate">{sub.label}</span>
                                      </button>
                                    );
                                  })}
                                </div>
                              )}
                            </div>
                          );
                        }

                        return (
                          <button
                            key={child.id}
                            id={`sidebar-tab-${child.id}`}
                            onClick={() => handleSelectTab(child.id)}
                            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl font-medium text-xs transition-all ${
                              isActive
                                ? 'bg-yellow-400 text-black font-bold shadow-lg shadow-yellow-400/20'
                                : 'text-neutral-400 hover:text-yellow-400 hover:bg-white/5'
                            }`}
                          >
                            <ChildIcon className={`w-4 h-4 shrink-0 ${isActive ? 'text-black' : 'text-neutral-500'}`} />
                            <span className="truncate">{child.label}</span>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            }

            if (!permitido(item.id)) return null;

            const isActive = activeTab === item.id;

            return (
              <button
                key={item.id}
                id={`sidebar-tab-${item.id}`}
                onClick={() => handleSelectTab(item.id)}
                className={`w-full flex items-center justify-between px-3.5 py-3 rounded-xl font-medium text-xs transition-all ${
                  isActive
                    ? 'bg-yellow-400 text-black font-bold shadow-lg shadow-yellow-400/20'
                    : 'text-neutral-400 hover:text-yellow-400 hover:bg-white/5'
                }`}
              >
                <div className="flex items-center gap-3 min-w-0">
                  <Icon className={`w-4 h-4 shrink-0 ${isActive ? 'text-black' : 'text-neutral-500'}`} />
                  <span className="truncate">{item.label}</span>
                </div>

                {item.badge && (
                  <span
                    className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wider ${
                      isActive
                        ? 'bg-black text-yellow-400'
                        : item.id === 'chat'
                        ? 'bg-yellow-400/10 text-yellow-400 border border-yellow-400/30'
                        : 'bg-neutral-800 text-neutral-300'
                    }`}
                  >
                    {item.badge}
                  </span>
                )}
              </button>
            );
          })}

          {/* End Navigation List */}
        </div>
      </aside>
    </>
  );
};
