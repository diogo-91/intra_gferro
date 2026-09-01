import React, { useState } from 'react';
import { 
  Search, 
  Bell, 
  HardHat, 
  Menu, 
  X, 
  User as UserIcon,
  CheckCircle2,
  AlertTriangle,
  LifeBuoy,
  LogOut
} from 'lucide-react';
import { User, NotificationItem, TabType } from '../types';

interface HeaderProps {
  user: User;
  onOpenNewChamado: () => void;
  notifications: NotificationItem[];
  onMarkNotificationsRead: () => void;
  activeTab: TabType;
  setActiveTab: (tab: TabType) => void;
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  mobileMenuOpen: boolean;
  setMobileMenuOpen: (open: boolean) => void;
  onLogout: () => void;
  podeAbrirChamado: boolean;
}

export const Header: React.FC<HeaderProps> = ({
  user,
  onOpenNewChamado,
  notifications,
  onMarkNotificationsRead,
  setActiveTab,
  searchQuery,
  setSearchQuery,
  mobileMenuOpen,
  setMobileMenuOpen,
  onLogout,
  podeAbrirChamado,
}) => {
  const [showNotifications, setShowNotifications] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);

  const unreadCount = notifications.filter((n) => n.unread).length;

  return (
    <header className="fixed inset-x-0 top-0 z-50 bg-[#0A0A0A]/95 backdrop-blur-md border-b border-white/10 text-white shadow-xl">
      <div className="w-full px-2.5 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16 sm:h-20 gap-1.5 sm:gap-4">

          {/* Left: Mobile Toggle & Brand Logo */}
          <div className="flex items-center gap-1.5 sm:gap-4 min-w-0">
            <button
              id="header-mobile-menu-toggle"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="lg:hidden min-h-11 min-w-11 p-2 rounded-xl text-neutral-400 hover:text-yellow-400 hover:bg-white/5 transition-colors shrink-0"
              aria-label="Abrir Menu"
            >
              {mobileMenuOpen ? <X className="w-5 h-5 mx-auto" /> : <Menu className="w-5 h-5 mx-auto" />}
            </button>

            {/* GFERRO Brand Logo */}
            <div
              onClick={() => setActiveTab('informativos')}
              className="flex items-center gap-2 sm:gap-3 cursor-pointer group select-none min-w-0"
            >
              <div className="w-8 h-8 sm:w-10 sm:h-10 bg-yellow-400 rounded-lg flex items-center justify-center font-black text-black text-sm sm:text-xl shadow-lg shadow-yellow-400/20 group-hover:scale-105 transition-transform shrink-0">
                GF
              </div>
              <div className="hidden min-[430px]:flex flex-col min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-extrabold text-2xl tracking-tighter text-white group-hover:text-yellow-400 transition-colors">
                    GFERRO
                  </span>
                  <span className="text-[10px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-full bg-yellow-400/10 text-yellow-400 border border-yellow-400/20 hidden sm:inline-block">
                    Intranet
                  </span>
                </div>
                <span className="text-[10px] font-medium text-neutral-500 tracking-wide hidden sm:inline">
                  Soluções em Aço & Siderurgia
                </span>
              </div>
            </div>
          </div>

          {/* Center: Sleek Rounded-Full Search Input */}
          <div className="hidden md:flex flex-1 max-w-md mx-4 relative">
            <div className="relative w-full">
              <Search className="w-4 h-4 absolute left-4 top-1/2 -translate-y-1/2 text-neutral-500" />
              <input
                id="header-global-search"
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Pesquisar politicas, pessoas ou comunicados..."
                className="w-full bg-neutral-900 border border-white/10 rounded-full py-2 pl-10 pr-10 text-sm text-white placeholder-neutral-500 focus:border-yellow-400 focus:outline-none transition-all"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-xs text-neutral-500 hover:text-neutral-300"
                >
                  Limpar
                </button>
              )}
            </div>
          </div>

          {/* Right Action Controls */}
          <div className="flex items-center gap-1 sm:gap-3 shrink-0">

            {podeAbrirChamado && <button
              id="header-new-chamado-btn"
              onClick={onOpenNewChamado}
              className="flex min-h-11 min-w-11 items-center justify-center gap-2 px-2.5 sm:px-4 py-2 rounded-full bg-yellow-400 text-black font-bold text-xs sm:text-sm hover:bg-yellow-300 shadow-lg shadow-yellow-400/20 active:scale-95 transition-all"
              title="Abrir Chamado"
            >
              <LifeBuoy className="w-4 h-4 text-black" />
              <span className="hidden sm:inline">Abrir Chamado</span>
            </button>}

            {/* Notifications Popover Toggle */}
            <div className="relative">
              <button
                id="header-notifications-toggle"
                onClick={() => {
                  setShowNotifications(!showNotifications);
                  if (unreadCount > 0) onMarkNotificationsRead();
                }}
                className="min-h-11 min-w-11 p-2 rounded-full bg-neutral-900 border border-white/10 hover:border-yellow-400 text-neutral-400 hover:text-yellow-400 transition-colors relative"
                aria-label="Notificações"
              >
                <Bell className="w-5 h-5" />
                {unreadCount > 0 && (
                  <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-yellow-400 text-black text-[10px] font-bold flex items-center justify-center animate-bounce">
                    {unreadCount}
                  </span>
                )}
              </button>

              {/* Notifications Dropdown */}
              {showNotifications && (
                <div className="fixed left-3 right-3 top-16 mt-2 bg-[#111111] border border-white/10 rounded-2xl shadow-2xl z-50 overflow-hidden sm:absolute sm:left-auto sm:right-0 sm:top-auto sm:mt-3 sm:w-80">
                  <div className="p-4 bg-[#0A0A0A] border-b border-white/10 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Bell className="w-4 h-4 text-yellow-400" />
                      <span className="font-bold text-xs text-white">Notificações Corporativas</span>
                    </div>
                    <span className="text-[10px] font-semibold text-neutral-500">
                      {notifications.length} itens
                    </span>
                  </div>

                  <div className="max-h-72 overflow-y-auto divide-y divide-white/5">
                    {notifications.length === 0 ? (
                      <div className="p-4 text-center text-xs text-neutral-500">
                        Nenhuma notificação recente.
                      </div>
                    ) : (
                      notifications.map((item) => (
                        <div key={item.id} className={`p-3.5 hover:bg-white/5 transition-colors ${item.unread ? 'bg-yellow-400/5' : ''}`}>
                          <div className="flex items-start gap-2.5">
                            {item.type === 'seguranca' && <HardHat className="w-4 h-4 text-yellow-400 shrink-0 mt-0.5" />}
                            {item.type === 'chamado' && <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />}
                            {item.type === 'rh' && <AlertTriangle className="w-4 h-4 text-sky-400 shrink-0 mt-0.5" />}
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center justify-between">
                                <h4 className="text-xs font-semibold text-neutral-200 truncate">{item.title}</h4>
                                <span className="text-[10px] text-neutral-500">{item.time}</span>
                              </div>
                              <p className="text-[11px] text-neutral-400 mt-0.5 line-clamp-2">{item.message}</p>
                            </div>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* User Profile Chip */}
            <div className="relative border-l border-white/10 pl-1.5 sm:pl-3">
              <button
                id="header-user-menu-toggle"
                onClick={() => setShowUserMenu(!showUserMenu)}
                className="flex min-h-11 min-w-11 items-center justify-center gap-3 p-1 rounded-full hover:bg-white/5 transition-colors group"
              >
                <div className="text-right hidden xl:block">
                  <p className="text-sm font-bold text-white group-hover:text-yellow-400 transition-colors leading-none">
                    {user.name}
                  </p>
                  <p className="text-xs text-neutral-500 leading-tight mt-0.5">
                    {user.role}
                  </p>
                </div>
                <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-full bg-neutral-800 border-2 border-yellow-400 overflow-hidden shrink-0">
                  <img
                    src={user.avatar}
                    alt={user.name}
                    className="w-full h-full object-cover"
                  />
                </div>
              </button>

              {/* User Dropdown */}
              {showUserMenu && (
                <div className="fixed left-3 right-3 top-16 mt-2 bg-[#111111] border border-white/10 rounded-2xl shadow-2xl p-4 z-50 sm:absolute sm:left-auto sm:right-0 sm:top-auto sm:mt-3 sm:w-64">
                  <div className="flex items-center gap-3 pb-3 border-b border-white/10">
                    <img src={user.avatar} alt={user.name} className="w-10 h-10 rounded-full object-cover border-2 border-yellow-400" />
                    <div className="flex flex-col min-w-0">
                      <span className="text-xs font-bold text-white truncate">{user.name}</span>
                      <span className="text-[10px] text-neutral-400 truncate">{user.department}</span>
                      <span className="text-[10px] font-mono text-yellow-400 mt-0.5">Ramal: {user.ramal}</span>
                    </div>
                  </div>

                  <div className="py-2 text-xs space-y-1.5 border-b border-white/10 text-neutral-300">
                    <div className="flex items-center justify-between text-[11px] text-neutral-400">
                      <span>Turno:</span>
                      <span className="font-semibold text-neutral-200">{user.shift}</span>
                    </div>
                    <div className="flex items-center justify-between text-[11px] text-neutral-400">
                      <span>Admissão:</span>
                      <span className="font-semibold text-neutral-200">{user.hireDate}</span>
                    </div>
                    {user.isCipaMember && (
                      <div className="flex items-center gap-1.5 text-[11px] font-bold text-yellow-400 bg-yellow-400/10 p-2 rounded-xl border border-yellow-400/20 mt-1">
                        <HardHat className="w-3.5 h-3.5 text-yellow-400" />
                        <span>Membro Integrante CIPA</span>
                      </div>
                    )}
                  </div>

                  <button
                    onClick={() => {
                      setActiveTab('pessoas');
                      setShowUserMenu(false);
                    }}
                    className="w-full mt-3 py-2 text-center text-xs font-bold text-yellow-400 hover:bg-yellow-400/10 rounded-xl transition-colors border border-yellow-400/20"
                  >
                    Ver meu perfil completo
                  </button>

                  <button
                    onClick={() => {
                      setShowUserMenu(false);
                      onLogout();
                    }}
                    className="w-full mt-2 py-2 flex items-center justify-center gap-1.5 text-center text-xs font-bold text-neutral-400 hover:bg-red-500/10 hover:text-red-400 rounded-xl transition-colors border border-white/10"
                  >
                    <LogOut className="w-3.5 h-3.5" />
                    Sair
                  </button>
                </div>
              )}
            </div>

          </div>
        </div>
      </div>
    </header>
  );
};
