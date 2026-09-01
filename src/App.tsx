import React, { useEffect, useState } from 'react';
import { 
  currentUser, 
  initialComunicados, 
  initialDocumentos, 
  colaboradoresList, 
  initialChannels,
  initialChatMessages,
  initialDepartments,
  notificationsList
} from './data/mockData';
import {
  TabType,
  Comunicado,
  ChatChannel,
  ChatMessage,
  Department,
  NotificationItem,
  User
} from './types';
import { Header } from './components/Header';
import { Sidebar } from './components/Sidebar';
import { Dashboard } from './components/Dashboard';
import { ComunicadosFeed } from './components/ComunicadosFeed';
import { DocumentosHub } from './components/DocumentosHub';
import { ServicosRH } from './components/ServicosRH';
import { DiretorioPessoas } from './components/DiretorioPessoas';
import { ChatInterno } from './components/ChatInterno';
import { DepartamentosApp } from './components/DepartamentosApp';
import { VendasDashboard } from './components/VendasDashboard';
import { ProgramacaoFinanceira } from './components/ProgramacaoFinanceira';
import { Producao } from './components/Producao';
import { AIAssistantModal } from './components/AIAssistantModal';
import { NovoComunicadoModal } from './components/NovoComunicadoModal';
import { NovoChamadoModal } from './components/NovoChamadoModal';
import { Login } from './components/Login';
import { GestaoUsuarios } from './components/GestaoUsuarios';
import { GestaoMetasMensais } from './components/GestaoMetasMensais';
import { nomeDoEmail } from './utils/format';
import type { ModuloId } from './modulos';

interface Sessao { email: string; nome?: string; administrador: boolean; modulos: ModuloId[] }

export default function App() {
  // Autenticação — verifica o cookie de sessão (ver auth.ts) antes de
  // renderizar qualquer coisa da intranet.
  const [authStatus, setAuthStatus] = useState<'checking' | 'authenticated' | 'unauthenticated'>('checking');
  // Nome exibido no cabeçalho vem do e-mail usado no login (login único
  // compartilhado, ver auth.ts) — não de um cadastro de usuário à parte.
  const [sessao, setSessao] = useState<Sessao | null>(null);

  const carregarSessao = () => fetch('/api/auth/me')
      .then((res) => res.json().then((data) => ({ ok: res.ok, data })))
      .then(({ ok, data }) => {
        setAuthStatus(ok ? 'authenticated' : 'unauthenticated');
        setSessao(ok ? data : null);
      })
      .catch(() => setAuthStatus('unauthenticated'));

  useEffect(() => {
    void carregarSessao();
  }, []);

  const usuarioAtual: User = sessao
    ? { ...currentUser, name: sessao.nome || nomeDoEmail(sessao.email), email: sessao.email, role: sessao.administrador ? 'Administrador' : 'Usuário' }
    : currentUser;

  const handleLogout = () => {
    fetch('/api/auth/logout', { method: 'POST' }).finally(() => { setSessao(null); setAuthStatus('unauthenticated'); });
  };

  const [activeTab, setActiveTab] = useState<TabType>('informativos');

  useEffect(() => {
    if (!sessao || sessao.administrador || sessao.modulos.includes(activeTab as ModuloId)) return;
    setActiveTab(sessao.modulos[0] || 'informativos');
  }, [sessao, activeTab]);
  const [searchQuery, setSearchQuery] = useState('');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // App Data State
  const [comunicados, setComunicados] = useState<Comunicado[]>(initialComunicados);
  const [documentos] = useState(initialDocumentos);
  const [chamadosVersion, setChamadosVersion] = useState(0);
  const [colaboradores] = useState(colaboradoresList);
  const [chatChannels] = useState<ChatChannel[]>(initialChannels);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>(initialChatMessages);
  const [departments] = useState<Department[]>(initialDepartments);
  const [selectedDeptId, setSelectedDeptId] = useState<string>(initialDepartments[0]?.id ?? '');
  const [notifications, setNotifications] = useState<NotificationItem[]>(notificationsList);
  const acessoAbaAtiva = !!sessao && (sessao.administrador || sessao.modulos.includes(activeTab as ModuloId));

  // Modals & Panels
  const [isAIAssistantOpen, setIsAIAssistantOpen] = useState(false);
  const [isNewComunicadoOpen, setIsNewComunicadoOpen] = useState(false);
  const [isNewChamadoOpen, setIsNewChamadoOpen] = useState(false);
  const [selectedComunicadoDetail, setSelectedComunicadoDetail] = useState<Comunicado | null>(null);

  // Action Handlers
  const handleLikeComunicado = (id: string) => {
    setComunicados((prev) =>
      prev.map((c) => {
        if (c.id === id) {
          const likedByMe = !c.likedByMe;
          return {
            ...c,
            likedByMe,
            likes: likedByMe ? c.likes + 1 : c.likes - 1,
          };
        }
        return c;
      })
    );
  };

  const handleAddComment = (comunicadoId: string, text: string) => {
    setComunicados((prev) =>
      prev.map((c) => {
        if (c.id === comunicadoId) {
          const newComment = {
            id: `cmt-${Date.now()}`,
            authorName: usuarioAtual.name,
            authorAvatar: usuarioAtual.avatar,
            content: text,
            createdAt: `${new Date().toLocaleDateString('pt-BR')} - ${new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`,
          };
          const updatedComments = [...(c.comments || []), newComment];
          return {
            ...c,
            comments: updatedComments,
            commentsCount: updatedComments.length,
          };
        }
        return c;
      })
    );
  };

  const handleAddComunicado = (newPost: Omit<Comunicado, 'id' | 'date' | 'likes' | 'commentsCount'>) => {
    const created: Comunicado = {
      ...newPost,
      id: `com-${Date.now()}`,
      date: `${new Date().getDate()} de Agosto de ${new Date().getFullYear()}`,
      likes: 1,
      likedByMe: true,
      commentsCount: 0,
      comments: [],
    };
    setComunicados((prev) => [created, ...prev]);
  };

  const handleSendMessage = (msg: Omit<ChatMessage, 'id' | 'timestamp'>) => {
    const createdMsg: ChatMessage = {
      ...msg,
      id: `msg-${Date.now()}`,
      timestamp: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
    };
    setChatMessages((prev) => [...prev, createdMsg]);
  };

  const handleMarkNotificationsRead = () => {
    setNotifications((prev) => prev.map((n) => ({ ...n, unread: false })));
  };

  if (authStatus === 'checking') {
    return (
      <div className="min-h-screen bg-[#0A0A0A] flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-yellow-400/30 border-t-yellow-400 rounded-full animate-spin" />
      </div>
    );
  }

  if (authStatus === 'unauthenticated') {
    return <Login onLoginSuccess={carregarSessao} />;
  }

  return (
    <div className="h-[100dvh] overflow-hidden bg-[#0A0A0A] text-white font-sans selection:bg-yellow-400 selection:text-black">
      
      {/* Top Header */}
      <Header
        user={usuarioAtual}
        onOpenNewChamado={() => setIsNewChamadoOpen(true)}
        notifications={notifications}
        onMarkNotificationsRead={handleMarkNotificationsRead}
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        searchQuery={searchQuery}
        setSearchQuery={setSearchQuery}
        mobileMenuOpen={mobileMenuOpen}
        setMobileMenuOpen={setMobileMenuOpen}
        onLogout={handleLogout}
        podeAbrirChamado={!!sessao && (sessao.administrador || sessao.modulos.some((modulo) => modulo === 'servicos' || modulo === 'departamentos'))}
      />

      {/* Main Layout Grid */}
      <div className="flex h-full min-h-0 pt-16 sm:pt-20 overflow-hidden">
        {/* Left Sidebar */}
        <Sidebar
          activeTab={activeTab}
          setActiveTab={setActiveTab}
          mobileMenuOpen={mobileMenuOpen}
          setMobileMenuOpen={setMobileMenuOpen}
          onOpenAIAssistant={() => setIsAIAssistantOpen(true)}
          departments={departments}
          selectedDeptId={selectedDeptId}
          onSelectDepartamento={setSelectedDeptId}
          modulos={sessao?.modulos || []}
          administrador={!!sessao?.administrador}
        />

        {/* Content View Container */}
        <main
          className="flex-1 min-w-0 h-full overscroll-y-contain overflow-y-auto overflow-x-hidden lg:ml-64 p-3 sm:p-6 lg:p-8 bg-white text-neutral-900 selection:bg-yellow-400 selection:text-black"
        >
          {!acessoAbaAtiva && (
            <div className="min-h-[60vh] flex items-center justify-center">
              <div className="max-w-md text-center p-8 rounded-2xl border border-neutral-200 bg-neutral-50">
                <h1 className="text-xl font-black">Nenhum módulo liberado</h1>
                <p className="text-sm text-neutral-500 mt-2">Solicite a um administrador a liberação dos módulos necessários para o seu acesso.</p>
              </div>
            </div>
          )}
          {acessoAbaAtiva && <>
          {activeTab === 'informativos' && (
            <Dashboard
              user={usuarioAtual}
              comunicados={comunicados}
              documentos={documentos}
              colaboradores={colaboradores}
              setActiveTab={setActiveTab}
              onOpenNewChamado={() => setIsNewChamadoOpen(true)}
              onOpenNewComunicado={() => setIsNewComunicadoOpen(true)}
              onOpenAIAssistant={() => setIsAIAssistantOpen(true)}
              onLikeComunicado={handleLikeComunicado}
              onSelectComunicadoDetail={(com) => {
                setSelectedComunicadoDetail(com);
                setActiveTab('comunicados');
              }}
            />
          )}

          {activeTab === 'comunicados' && (
            <ComunicadosFeed
              comunicados={comunicados}
              user={usuarioAtual}
              onOpenNewComunicado={() => setIsNewComunicadoOpen(true)}
              onLikeComunicado={handleLikeComunicado}
              onAddComment={handleAddComment}
              selectedComunicadoDetail={selectedComunicadoDetail}
              onCloseComunicadoDetail={() => setSelectedComunicadoDetail(null)}
            />
          )}

          {activeTab === 'documentos' && (
            <DocumentosHub documentos={documentos} />
          )}

          {activeTab === 'servicos' && (
            <ServicosRH
              user={usuarioAtual}
              onOpenNewChamado={() => setIsNewChamadoOpen(true)}
              refreshKey={chamadosVersion}
            />
          )}

          {activeTab === 'pessoas' && (
            <DiretorioPessoas colaboradores={colaboradores} />
          )}

          {activeTab === 'chat' && (
            <ChatInterno
              user={usuarioAtual}
              channels={chatChannels}
              messages={chatMessages}
              colaboradores={colaboradores}
              onSendMessage={handleSendMessage}
            />
          )}

          {activeTab === 'departamentos' && (
            <DepartamentosApp
              user={usuarioAtual}
              departments={departments}
              colaboradores={colaboradores}
              selectedDeptId={selectedDeptId}
              refreshKey={chamadosVersion}
            />
          )}

          {activeTab === 'vendas' && <VendasDashboard podeEditarGestao={!!sessao?.administrador} />}

          {activeTab === 'financeiro' && <ProgramacaoFinanceira />}

          {activeTab === 'producao' && <Producao />}

          {activeTab === 'gestao' && <GestaoMetasMensais podeEditar={!!sessao?.administrador} />}

          {activeTab === 'usuarios' && sessao?.administrador && <GestaoUsuarios />}
          </>}
        </main>
      </div>

      {/* AI Assistant Chat Modal */}
      <AIAssistantModal
        user={usuarioAtual}
        isOpen={isAIAssistantOpen}
        onClose={() => setIsAIAssistantOpen(false)}
      />

      {/* New Comunicado Modal */}
      <NovoComunicadoModal
        user={usuarioAtual}
        isOpen={isNewComunicadoOpen}
        onClose={() => setIsNewComunicadoOpen(false)}
        onAddComunicado={handleAddComunicado}
      />

      {/* New Chamado Service Desk Modal */}
      <NovoChamadoModal
        user={usuarioAtual}
        isOpen={isNewChamadoOpen}
        onClose={() => setIsNewChamadoOpen(false)}
        departments={departments}
        initialDepartmentId={activeTab === 'departamentos' ? selectedDeptId : undefined}
        onCreated={() => setChamadosVersion((valor) => valor + 1)}
      />

    </div>
  );
}
