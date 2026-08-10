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
  ClipboardList,
  Cpu,
  ChevronDown
} from 'lucide-react';
import { TabType, Department } from '../types';

interface SidebarProps {
  activeTab: TabType;
  setActiveTab: (tab: TabType) => void;
  mobileMenuOpen: boolean;
  setMobileMenuOpen: (open: boolean) => void;
  onOpenAIAssistant: () => void;
  departments: Department[];
  selectedDeptId: string;
  onSelectDepartamento: (id: string) => void;
}

type NavLeaf = { id: TabType; label: string; icon: React.FC<{ className?: string }>; badge?: string };
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
}) => {
  const navItems: NavEntry[] = [
    { id: 'informativos', label: 'Informativos Internos', icon: Megaphone },
    { id: 'comunicados', label: 'Comunicados & Feed', icon: Newspaper },
    { id: 'documentos', label: 'Documentos & NRs', icon: FileText },
    { id: 'servicos', label: 'Serviços & Chamados', icon: LifeBuoy },
    { id: 'pessoas', label: 'Diretório de Pessoas', icon: Users },
    { id: 'chat', label: 'Chat Interno GFERRO', icon: MessageSquare },
    { id: 'ia-assistente', label: 'Ideias e Sugestões', icon: Lightbulb },
    {
      id: 'dashboard',
      label: 'Dashboard',
      icon: LayoutDashboard,
      children: [
        { id: 'vendas', label: 'Vendas', icon: TrendingUp },
        { id: 'financeiro', label: 'Financeiro', icon: Wallet },
        { id: 'producao', label: 'Produção', icon: Factory },
      ],
    },
  ];

  const dashboardGroup = navItems.find(isGroup)!;
  const isInDashboardGroup = dashboardGroup.children.some((c) => c.id === activeTab);
  const isInDepartamentosGroup = activeTab === 'departamentos';

  const [dashboardExpanded, setDashboardExpanded] = useState(isInDashboardGroup);
  const [departamentosExpanded, setDepartamentosExpanded] = useState(isInDepartamentosGroup);

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
        className={`fixed top-20 bottom-0 left-0 z-40 w-64 bg-[#111111] border-r border-white/10 flex flex-col justify-between transition-transform duration-300 ease-in-out ${
          mobileMenuOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        }`}
      >
        {/* Navigation Items */}
        <div className="p-4 space-y-1.5 overflow-y-auto">
          <div className="px-3 py-2 text-xs font-bold uppercase tracking-widest text-neutral-500">
            Menu Intranet
          </div>

          {navItems.slice(0, 6).map((item) => {
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

          {/* Departamentos & Áreas — grupo expansível com um submenu por área */}
          <div>
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
          </div>

          {navItems.slice(6).map((item) => {
            const Icon = item.icon;

            if (isGroup(item)) {
              const groupActive = item.children.some((c) => c.id === activeTab);

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
                      {item.children.map((child) => {
                        const ChildIcon = child.icon;
                        const isActive = activeTab === child.id;

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
