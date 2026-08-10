import React, { useState, useRef, useEffect } from 'react';
import {
  MessageSquare,
  Hash,
  Send,
  Paperclip,
  Search,
  User as UserIcon,
  FileText,
  Smile,
  Phone,
  Mail,
  Sparkles,
  X,
  CheckCheck,
  Building2,
  Lock,
  Plus
} from 'lucide-react';
import { User, ChatChannel, ChatMessage, Colaborador } from '../types';

interface ChatInternoProps {
  user: User;
  channels: ChatChannel[];
  messages: ChatMessage[];
  colaboradores: Colaborador[];
  onSendMessage: (newMessage: Omit<ChatMessage, 'id' | 'timestamp'>) => void;
}

export const ChatInterno: React.FC<ChatInternoProps> = ({
  user,
  channels,
  messages,
  colaboradores,
  onSendMessage,
}) => {
  const [activeType, setActiveType] = useState<'channel' | 'dm'>('channel');
  const [activeTargetId, setActiveTargetId] = useState<string>('chn-geral');
  const [inputText, setInputText] = useState('');
  const [searchFilter, setSearchFilter] = useState('');
  const [selectedAttachment, setSelectedAttachment] = useState<{ name: string; url: string; size: string } | null>(null);
  const [showQuickAttachModal, setShowQuickAttachModal] = useState(false);

  const chatEndRef = useRef<HTMLDivElement>(null);

  // Auto scroll to latest message
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, activeTargetId, activeType]);

  // Current active target details
  const activeChannel = channels.find((c) => c.id === activeTargetId);
  const activeColaborador = colaboradores.find((col) => col.id === activeTargetId);

  // Filtered messages
  const filteredMessages = messages.filter((msg) => {
    if (activeType === 'channel') {
      return msg.channelId === activeTargetId;
    } else {
      // DM: between currentUser and activeColaborador
      return (
        (msg.senderId === user.id && msg.receiverId === activeTargetId) ||
        (msg.senderId === activeTargetId && msg.receiverId === user.id)
      );
    }
  });

  // Handle Send
  const handleSend = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim() && !selectedAttachment) return;

    const newMsg: Omit<ChatMessage, 'id' | 'timestamp'> = {
      senderId: user.id,
      senderName: user.name,
      senderAvatar: user.avatar,
      senderRole: user.role,
      content: inputText.trim(),
      channelId: activeType === 'channel' ? activeTargetId : undefined,
      receiverId: activeType === 'dm' ? activeTargetId : undefined,
      attachments: selectedAttachment ? [selectedAttachment] : undefined,
    };

    onSendMessage(newMsg);
    setInputText('');
    setSelectedAttachment(null);

    // Auto-reply simulation for DM
    if (activeType === 'dm' && activeColaborador) {
      setTimeout(() => {
        const autoReplies = [
          `Olá ${user.name.split(' ')[0]}! Recebi sua mensagem. Estou analisando a solicitação e já te retorno.`,
          `Perfeito! Já passei a informação para a equipe do turno. Qualquer novidade te aviso por aqui.`,
          `Obrigado pelo contato! Estou em reunião no momento, mas já salvei sua mensagem.`
        ];
        const randomReply = autoReplies[Math.floor(Math.random() * autoReplies.length)];

        onSendMessage({
          senderId: activeColaborador.id,
          senderName: activeColaborador.name,
          senderAvatar: activeColaborador.avatar,
          senderRole: activeColaborador.role,
          content: randomReply,
          receiverId: user.id,
        });
      }, 1200);
    }
  };

  // Quick Preset Attachments
  const presetAttachments = [
    { name: 'Relatorio_Tecnico_Aco_Inox_2026.pdf', url: '#', size: '2.4 MB' },
    { name: 'Desenho_CAD_Dobra_CNC_V2.dwg', url: '#', size: '5.1 MB' },
    { name: 'Certificado_Qualidade_ISO9001.pdf', url: '#', size: '1.1 MB' },
  ];

  return (
    <div className="space-y-6 pb-12">

      {/* Top Banner */}
      <div className="bg-white p-6 rounded-[2rem] border border-neutral-200 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-yellow-600 font-extrabold text-xs uppercase tracking-widest">
            <MessageSquare className="w-4 h-4 text-yellow-600" />
            <span>Comunicação Interna em Tempo Real</span>
          </div>
          <h1 className="text-xl sm:text-2xl font-black text-neutral-900 tracking-tight">
            Chat Interno GFERRO
          </h1>
          <p className="text-xs text-neutral-500 font-medium">
            Conecte-se instantaneamente com canais corporativos por setor e conversas diretas com colegas.
          </p>
        </div>

        <div className="flex items-center gap-2 bg-neutral-50 px-4 py-2.5 rounded-full border border-neutral-200 shrink-0">
          <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
          <span className="text-xs font-bold text-neutral-900">Rede Interna Online</span>
        </div>
      </div>

      {/* Main Chat Layout Container */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 h-[720px]">

        {/* Left Column: Channels & DMs Navigation (4 cols) */}
        <div className="lg:col-span-4 bg-white border border-neutral-200 rounded-[2rem] p-4 flex flex-col shadow-sm overflow-hidden">

          {/* Search Box */}
          <div className="relative mb-4">
            <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-neutral-500" />
            <input
              type="text"
              value={searchFilter}
              onChange={(e) => setSearchFilter(e.target.value)}
              placeholder="Buscar canais ou pessoas..."
              className="w-full bg-neutral-50 border border-neutral-200 rounded-full py-2 pl-9 pr-3 text-xs text-neutral-900 placeholder-neutral-500 focus:outline-none focus:border-yellow-400 transition-all"
            />
          </div>

          {/* Navigation Items List */}
          <div className="flex-1 overflow-y-auto space-y-5 pr-1">

            {/* Channels Section */}
            <div>
              <div className="flex items-center justify-between px-2 mb-2 text-[11px] font-bold uppercase tracking-widest text-neutral-500">
                <span>Canais Corporativos</span>
                <span className="text-[10px] bg-neutral-100 px-2 py-0.5 rounded-full text-neutral-500">
                  {channels.length}
                </span>
              </div>

              <div className="space-y-1">
                {channels
                  .filter((c) => c.name.toLowerCase().includes(searchFilter.toLowerCase()))
                  .map((chn) => {
                    const isActive = activeType === 'channel' && activeTargetId === chn.id;
                    return (
                      <button
                        key={chn.id}
                        onClick={() => {
                          setActiveType('channel');
                          setActiveTargetId(chn.id);
                        }}
                        className={`w-full flex items-center justify-between p-3 rounded-2xl text-xs transition-all text-left ${
                          isActive
                            ? 'bg-yellow-400 text-black font-extrabold shadow-lg shadow-yellow-400/20'
                            : 'text-neutral-600 hover:bg-neutral-100 hover:text-neutral-900'
                        }`}
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <Hash className={`w-4 h-4 shrink-0 ${isActive ? 'text-black' : 'text-yellow-600'}`} />
                          <span className="truncate">{chn.name}</span>
                        </div>
                        {chn.unreadCount && chn.unreadCount > 0 && !isActive && (
                          <span className="px-2 py-0.5 rounded-full bg-yellow-400 text-black text-[10px] font-extrabold">
                            {chn.unreadCount}
                          </span>
                        )}
                      </button>
                    );
                  })}
              </div>
            </div>

            {/* Direct Messages Section */}
            <div>
              <div className="flex items-center justify-between px-2 mb-2 text-[11px] font-bold uppercase tracking-widest text-neutral-500">
                <span>Mensagens Diretas</span>
                <span className="text-[10px] bg-neutral-100 px-2 py-0.5 rounded-full text-neutral-500">
                  {colaboradores.length}
                </span>
              </div>

              <div className="space-y-1">
                {colaboradores
                  .filter((col) => col.id !== user.id && col.name.toLowerCase().includes(searchFilter.toLowerCase()))
                  .map((col) => {
                    const isActive = activeType === 'dm' && activeTargetId === col.id;
                    return (
                      <button
                        key={col.id}
                        onClick={() => {
                          setActiveType('dm');
                          setActiveTargetId(col.id);
                        }}
                        className={`w-full flex items-center gap-3 p-3 rounded-2xl text-xs transition-all text-left ${
                          isActive
                            ? 'bg-yellow-400 text-black font-extrabold shadow-lg shadow-yellow-400/20'
                            : 'text-neutral-600 hover:bg-neutral-100 hover:text-neutral-900'
                        }`}
                      >
                        <div className="relative shrink-0">
                          <img
                            src={col.avatar}
                            alt={col.name}
                            className={`w-8 h-8 rounded-full object-cover border ${
                              isActive ? 'border-black' : 'border-yellow-400'
                            }`}
                          />
                          <span className="absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full bg-emerald-400 border-2 border-neutral-900" />
                        </div>

                        <div className="flex-1 min-w-0">
                          <span className="block truncate font-semibold">{col.name}</span>
                          <span className={`block truncate text-[10px] ${isActive ? 'text-black/80' : 'text-neutral-500'}`}>
                            {col.role}
                          </span>
                        </div>
                      </button>
                    );
                  })}
              </div>
            </div>

          </div>

        </div>

        {/* Right Column: Chat Main Feed (8 cols) */}
        <div className="lg:col-span-8 bg-white border border-neutral-200 rounded-[2rem] flex flex-col shadow-sm overflow-hidden">

          {/* Chat Header Bar */}
          <div className="p-4 bg-neutral-50 border-b border-neutral-200 flex items-center justify-between gap-4 shrink-0">
            {activeType === 'channel' && activeChannel ? (
              <div className="flex items-center gap-3 min-w-0">
                <div className="p-2.5 rounded-2xl bg-yellow-50 text-yellow-700 border border-yellow-200">
                  <Hash className="w-5 h-5" />
                </div>
                <div className="min-w-0">
                  <h3 className="text-sm font-extrabold text-neutral-900 truncate flex items-center gap-2">
                    <span>#{activeChannel.name}</span>
                    <span className="px-2 py-0.5 rounded-full bg-neutral-100 text-[10px] font-mono text-neutral-600 font-normal">
                      {activeChannel.category}
                    </span>
                  </h3>
                  <p className="text-[11px] text-neutral-500 truncate mt-0.5 font-medium">
                    {activeChannel.description}
                  </p>
                </div>
              </div>
            ) : activeType === 'dm' && activeColaborador ? (
              <div className="flex items-center gap-3 min-w-0">
                <div className="relative shrink-0">
                  <img
                    src={activeColaborador.avatar}
                    alt={activeColaborador.name}
                    className="w-10 h-10 rounded-full object-cover border-2 border-yellow-400"
                  />
                  <span className="absolute bottom-0 right-0 w-3 h-3 rounded-full bg-emerald-400 border-2 border-neutral-900" />
                </div>
                <div className="min-w-0">
                  <h3 className="text-sm font-extrabold text-neutral-900 truncate">
                    {activeColaborador.name}
                  </h3>
                  <p className="text-[11px] text-neutral-500 truncate mt-0.5 font-medium">
                    {activeColaborador.role} • Ramal: <strong className="text-yellow-600">{activeColaborador.ramal}</strong>
                  </p>
                </div>
              </div>
            ) : null}

            {/* Quick Actions */}
            <div className="flex items-center gap-2 shrink-0">
              {activeColaborador && (
                <a
                  href={`tel:${activeColaborador.ramal}`}
                  onClick={(e) => {
                    e.preventDefault();
                    alert(`Ligando para Ramal ${activeColaborador.ramal} (${activeColaborador.name})`);
                  }}
                  className="p-2.5 rounded-full bg-neutral-100 text-neutral-600 hover:text-yellow-600 hover:bg-neutral-100 transition-colors"
                  title="Chamar Ramal IP"
                >
                  <Phone className="w-4 h-4" />
                </a>
              )}
            </div>
          </div>

          {/* Chat Messages Feed Area */}
          <div className="flex-1 p-4 sm:p-6 overflow-y-auto space-y-4">
            {filteredMessages.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-center p-6 space-y-3">
                <div className="p-4 rounded-full bg-yellow-50 text-yellow-700 border border-yellow-200">
                  <MessageSquare className="w-8 h-8" />
                </div>
                <h4 className="text-sm font-extrabold text-neutral-900 uppercase tracking-wider">
                  Nenhuma mensagem por aqui ainda
                </h4>
                <p className="text-xs text-neutral-500 max-w-sm leading-relaxed">
                  Envie a primeira mensagem para iniciar a conversa corporativa com sua equipe.
                </p>
              </div>
            ) : (
              filteredMessages.map((msg) => {
                const isMe = msg.senderId === user.id;

                return (
                  <div
                    key={msg.id}
                    className={`flex items-start gap-3 ${isMe ? 'flex-row-reverse' : ''}`}
                  >
                    <img
                      src={msg.senderAvatar}
                      alt={msg.senderName}
                      className="w-8 h-8 rounded-full object-cover border border-yellow-400 shrink-0 mt-1"
                    />

                    <div className={`space-y-1 max-w-[80%] ${isMe ? 'items-end text-right' : ''}`}>
                      <div className="flex items-center gap-2 text-[11px]">
                        <span className="font-extrabold text-neutral-900">{msg.senderName}</span>
                        {msg.senderRole && (
                          <span className="text-[10px] text-neutral-500 hidden sm:inline">
                            • {msg.senderRole}
                          </span>
                        )}
                        <span className="text-[10px] text-neutral-500 font-mono">{msg.timestamp}</span>
                      </div>

                      <div
                        className={`p-3.5 rounded-2xl text-xs leading-relaxed ${
                          isMe
                            ? 'bg-yellow-400 text-black font-medium shadow-md rounded-tr-none'
                            : 'bg-neutral-50 text-neutral-800 border border-neutral-200 rounded-tl-none'
                        }`}
                      >
                        <p className="whitespace-pre-wrap">{msg.content}</p>

                        {/* Attachments */}
                        {msg.attachments && msg.attachments.length > 0 && (
                          <div className="mt-2 space-y-1 pt-2 border-t border-black/10">
                            {msg.attachments.map((att, idx) => (
                              <div
                                key={idx}
                                className={`p-2 rounded-xl flex items-center justify-between gap-3 text-xs ${
                                  isMe ? 'bg-black/10 text-black' : 'bg-white text-yellow-600 border border-neutral-200'
                                }`}
                              >
                                <div className="flex items-center gap-2 min-w-0">
                                  <FileText className="w-4 h-4 shrink-0" />
                                  <span className="font-bold truncate">{att.name}</span>
                                </div>
                                <span className="text-[10px] font-mono opacity-80 shrink-0">{att.size}</span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })
            )}
            <div ref={chatEndRef} />
          </div>

          {/* Attached File Preview Bar */}
          {selectedAttachment && (
            <div className="px-4 py-2 bg-yellow-50 border-t border-yellow-200 flex items-center justify-between text-xs text-yellow-700">
              <div className="flex items-center gap-2">
                <FileText className="w-4 h-4" />
                <span className="font-bold">Anexo selecionado: {selectedAttachment.name}</span>
                <span className="text-[10px] font-mono opacity-80">({selectedAttachment.size})</span>
              </div>
              <button
                type="button"
                onClick={() => setSelectedAttachment(null)}
                className="text-neutral-500 hover:text-neutral-900"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          )}

          {/* Quick Presets Strip */}
          <div className="px-4 py-2 bg-neutral-50 border-t border-neutral-100 flex items-center gap-2 overflow-x-auto text-[11px] no-scrollbar">
            <span className="text-neutral-500 font-bold uppercase shrink-0 text-[10px]">
              Atalhos Rápidos:
            </span>
            <button
              type="button"
              onClick={() => setInputText('👍 Recebido e aprovado!')}
              className="px-2.5 py-1 rounded-full bg-neutral-100 text-neutral-600 hover:text-yellow-600 hover:bg-neutral-100 whitespace-nowrap transition-colors"
            >
              👍 Recebido e Aprovado
            </button>
            <button
              type="button"
              onClick={() => setInputText('📄 Segue o laudo técnico da ordem de produção.')}
              className="px-2.5 py-1 rounded-full bg-neutral-100 text-neutral-600 hover:text-yellow-600 hover:bg-neutral-100 whitespace-nowrap transition-colors"
            >
              📄 Laudo Técnico
            </button>
            <button
              type="button"
              onClick={() => setInputText('⚠️ Favor verificar no pátio de bobinas.')}
              className="px-2.5 py-1 rounded-full bg-neutral-100 text-neutral-600 hover:text-yellow-600 hover:bg-neutral-100 whitespace-nowrap transition-colors"
            >
              ⚠️ Aviso de Pátio
            </button>
          </div>

          {/* Message Input Form */}
          <form onSubmit={handleSend} className="p-4 bg-neutral-50 border-t border-neutral-200 flex items-center gap-3 shrink-0">
            <button
              type="button"
              onClick={() => setShowQuickAttachModal(true)}
              className="p-3 rounded-full bg-neutral-100 text-neutral-500 hover:text-yellow-600 hover:bg-neutral-100 transition-colors"
              title="Anexar Documento"
            >
              <Paperclip className="w-4 h-4" />
            </button>

            <input
              type="text"
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              placeholder={
                activeType === 'channel' && activeChannel
                  ? `Enviar mensagem no #${activeChannel.name}...`
                  : `Conversar com ${activeColaborador?.name || 'colega'}...`
              }
              className="flex-1 bg-white border border-neutral-200 rounded-full py-3 px-5 text-xs text-neutral-900 placeholder-neutral-500 focus:outline-none focus:border-yellow-400 transition-all"
            />

            <button
              type="submit"
              disabled={!inputText.trim() && !selectedAttachment}
              className="p-3 rounded-full bg-yellow-400 text-black hover:bg-yellow-300 disabled:opacity-40 shadow-lg shadow-yellow-400/20 transition-all active:scale-95"
            >
              <Send className="w-4 h-4" />
            </button>
          </form>

        </div>

      </div>

      {/* Attach Modal */}
      {showQuickAttachModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-50 flex items-center justify-center p-4">
          <div className="bg-white border border-neutral-200 rounded-[2rem] max-w-sm w-full p-6 space-y-4 shadow-sm">
            <div className="flex items-center justify-between border-b border-neutral-200 pb-3">
              <h3 className="text-xs font-extrabold text-neutral-900 uppercase tracking-wider flex items-center gap-2">
                <FileText className="w-4 h-4 text-yellow-600" />
                Anexar Documento Corporativo
              </h3>
              <button onClick={() => setShowQuickAttachModal(false)} className="text-neutral-500 hover:text-neutral-900">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-2 text-xs">
              {presetAttachments.map((att, idx) => (
                <button
                  key={idx}
                  onClick={() => {
                    setSelectedAttachment(att);
                    setShowQuickAttachModal(false);
                  }}
                  className="w-full p-3 rounded-2xl bg-white border border-neutral-200 hover:border-yellow-400 text-left flex items-center justify-between group transition-all"
                >
                  <div className="min-w-0">
                    <span className="font-bold text-neutral-900 group-hover:text-yellow-600 block truncate">
                      {att.name}
                    </span>
                    <span className="text-[10px] text-neutral-500 font-mono">{att.size}</span>
                  </div>
                  <Plus className="w-4 h-4 text-neutral-500 group-hover:text-yellow-600 shrink-0" />
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
