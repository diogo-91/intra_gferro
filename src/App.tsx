import React, { useEffect, useState } from 'react';
import { 
  currentUser, 
  initialComunicados, 
  initialDocumentos, 
  initialChamados, 
  colaboradoresList, 
  initialChannels,
  initialChatMessages,
  initialDepartments,
  notificationsList
} from './data/mockData';
import { 
  TabType, 
  Comunicado, 
  Chamado, 
  ChatChannel,
  ChatMessage,
  Department,
  NotificationItem 
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

export default function App() {
  // Autenticação — verifica o cookie de sessão (ver auth.ts) antes de
  // renderizar qualquer coisa da intranet.
  const [authStatus, setAuthStatus] = useState<'checking' | 'authenticated' | 'unauthenticated'>('checking');

  useEffect(() => {
    fetch('/api/auth/me')
      .then((res) => setAuthStatus(res.ok ? 'authenticated' : 'unauthenticated'))
      .catch(() => setAuthStatus('unauthenticated'));
  }, []);

  const handleLogout = () => {
    fetch('/api/auth/logout', { method: 'POST' }).finally(() => setAuthStatus('unauthenticated'));
  };

  const [activeTab, setActiveTab] = useState<TabType>('informativos');
  const [searchQuery, setSearchQuery] = useState('');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // App Data State
  const [comunicados, setComunicados] = useState<Comunicado[]>(initialComunicados);
  const [documentos] = useState(initialDocumentos);
  const [chamados, setChamados] = useState<Chamado[]>(initialChamados);
  const [colaboradores] = useState(colaboradoresList);
  const [chatChannels] = useState<ChatChannel[]>(initialChannels);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>(initialChatMessages);
  const [departments] = useState<Department[]>(initialDepartments);
  const [selectedDeptId, setSelectedDeptId] = useState<string>(initialDepartments[0]?.id ?? '');
  const [notifications, setNotifications] = useState<NotificationItem[]>(notificationsList);

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
            authorName: currentUser.name,
            authorAvatar: currentUser.avatar,
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

  const handleAddChamado = (newTicket: Omit<Chamado, 'id' | 'protocol' | 'status' | 'createdAt' | 'updatedAt'>) => {
    const created: Chamado = {
      ...newTicket,
      id: `ch-${Date.now()}`,
      protocol: `GF-2026-${Math.floor(100 + Math.random() * 900)}`,
      status: 'Aberto',
      createdAt: `${new Date().toLocaleDateString('pt-BR')} - ${new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`,
      updatedAt: `${new Date().toLocaleDateString('pt-BR')} - ${new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`,
    };
    setChamados((prev) => [created, ...prev]);
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
    return <Login onLoginSuccess={() => setAuthStatus('authenticated')} />;
  }

  return (
    <div className="min-h-screen bg-[#0A0A0A] text-white font-sans selection:bg-yellow-400 selection:text-black">
      
      {/* Top Header */}
      <Header
        user={currentUser}
        onOpenNewComunicado={() => setIsNewComunicadoOpen(true)}
        onOpenNewChamado={() => setIsNewChamadoOpen(true)}
        onOpenAIAssistant={() => setIsAIAssistantOpen(true)}
        notifications={notifications}
        onMarkNotificationsRead={handleMarkNotificationsRead}
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        searchQuery={searchQuery}
        setSearchQuery={setSearchQuery}
        mobileMenuOpen={mobileMenuOpen}
        setMobileMenuOpen={setMobileMenuOpen}
        onLogout={handleLogout}
      />

      {/* Main Layout Grid */}
      <div className="flex">
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
        />

        {/* Content View Container */}
        <main
          className={`flex-1 lg:ml-64 p-4 sm:p-6 lg:p-8 mx-auto min-h-[calc(100vh-4rem)] bg-white text-neutral-900 selection:bg-yellow-400 selection:text-black ${
            activeTab === 'financeiro' ? 'max-w-full' : 'max-w-7xl'
          }`}
        >
          {activeTab === 'informativos' && (
            <Dashboard
              user={currentUser}
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
              user={currentUser}
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
              chamados={chamados}
              user={currentUser}
              onOpenNewChamado={() => setIsNewChamadoOpen(true)}
            />
          )}

          {activeTab === 'pessoas' && (
            <DiretorioPessoas colaboradores={colaboradores} />
          )}

          {activeTab === 'chat' && (
            <ChatInterno
              user={currentUser}
              channels={chatChannels}
              messages={chatMessages}
              colaboradores={colaboradores}
              onSendMessage={handleSendMessage}
            />
          )}

          {activeTab === 'departamentos' && (
            <DepartamentosApp
              user={currentUser}
              departments={departments}
              colaboradores={colaboradores}
              selectedDeptId={selectedDeptId}
              onSelectDept={setSelectedDeptId}
              setActiveTab={setActiveTab}
              onOpenNewChamado={() => setIsNewChamadoOpen(true)}
            />
          )}

          {activeTab === 'vendas' && <VendasDashboard />}

          {activeTab === 'financeiro' && <ProgramacaoFinanceira />}

          {activeTab === 'producao' && <Producao />}
        </main>
      </div>

      {/* AI Assistant Chat Modal */}
      <AIAssistantModal
        user={currentUser}
        isOpen={isAIAssistantOpen}
        onClose={() => setIsAIAssistantOpen(false)}
      />

      {/* New Comunicado Modal */}
      <NovoComunicadoModal
        user={currentUser}
        isOpen={isNewComunicadoOpen}
        onClose={() => setIsNewComunicadoOpen(false)}
        onAddComunicado={handleAddComunicado}
      />

      {/* New Chamado Service Desk Modal */}
      <NovoChamadoModal
        user={currentUser}
        isOpen={isNewChamadoOpen}
        onClose={() => setIsNewChamadoOpen(false)}
        onAddChamado={handleAddChamado}
      />

    </div>
  );
}
