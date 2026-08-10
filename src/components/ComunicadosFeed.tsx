import React, { useState } from 'react';
import { Comunicado, Comment, User } from '../types';
import { 
  Newspaper, 
  Search, 
  Plus, 
  Heart, 
  MessageSquare, 
  Sparkles, 
  Pin, 
  Share2, 
  Tag, 
  Send, 
  Calendar, 
  User as UserIcon,
  Check
} from 'lucide-react';

interface ComunicadosFeedProps {
  comunicados: Comunicado[];
  user: User;
  onOpenNewComunicado: () => void;
  onLikeComunicado: (id: string) => void;
  onAddComment: (comunicadoId: string, text: string) => void;
  selectedComunicadoDetail: Comunicado | null;
  onCloseComunicadoDetail: () => void;
}

export const ComunicadosFeed: React.FC<ComunicadosFeedProps> = ({
  comunicados,
  user,
  onOpenNewComunicado,
  onLikeComunicado,
  onAddComment,
  selectedComunicadoDetail,
  onCloseComunicadoDetail,
}) => {
  const [selectedCategory, setSelectedCategory] = useState<string>('Todos');
  const [searchQuery, setSearchQuery] = useState('');
  const [commentInputMap, setCommentInputMap] = useState<Record<string, string>>({});
  
  // AI Summary Map
  const [summariesMap, setSummariesMap] = useState<Record<string, string>>({});
  const [loadingSummaryId, setLoadingSummaryId] = useState<string | null>(null);
  
  // Share feedback
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const categories = ['Todos', 'Institucional', 'Segurança', 'Operações', 'Recursos Humanos', 'Eventos'];

  const filtered = comunicados.filter((item) => {
    const matchesCat = selectedCategory === 'Todos' || item.category === selectedCategory;
    const matchesSearch = 
      item.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.summary.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.content.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCat && matchesSearch;
  });

  const handleAISummarize = async (comunicado: Comunicado) => {
    if (summariesMap[comunicado.id]) return;
    setLoadingSummaryId(comunicado.id);

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: `Por favor faça um resumo executivo muito curto e objetivo (no máximo 2 tópicos curtos em português) para o seguinte comunicado interno da empresa GFERRO:
Título: ${comunicado.title}
Conteúdo: ${comunicado.content}`,
        }),
      });

      const data = await res.json();
      if (data.reply) {
        setSummariesMap((prev) => ({ ...prev, [comunicado.id]: data.reply }));
      }
    } catch (err) {
      console.error(err);
      setSummariesMap((prev) => ({
        ...prev,
        [comunicado.id]: '• Comunicado de destaque relativo a diretrizes operacionais e de segurança da GFERRO.',
      }));
    } finally {
      setLoadingSummaryId(null);
    }
  };

  const handleSendComment = (id: string) => {
    const text = commentInputMap[id];
    if (!text || !text.trim()) return;
    onAddComment(id, text.trim());
    setCommentInputMap((prev) => ({ ...prev, [id]: '' }));
  };

  const handleCopyShareLink = (id: string) => {
    navigator.clipboard.writeText(`${window.location.origin}/#comunicado-${id}`);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  return (
    <div className="space-y-6 pb-12">
      
      {/* Top Bar Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-[2rem] border border-neutral-200 shadow-sm">
        <div>
          <h1 className="text-xl sm:text-2xl font-black text-neutral-900 flex items-center gap-2 tracking-tight">
            <Newspaper className="w-6 h-6 text-yellow-600" />
            <span>Comunicados & Feed Interno</span>
          </h1>
          <p className="text-xs text-neutral-500 mt-1 font-medium">
            Fique por dentro das últimas notícias, diretrizes de segurança e eventos da GFERRO Siderurgia.
          </p>
        </div>

        <button
          id="comunicados-create-btn"
          onClick={onOpenNewComunicado}
          className="px-5 py-2.5 rounded-full bg-yellow-400 text-black font-extrabold text-xs sm:text-sm hover:bg-yellow-300 shadow-lg shadow-yellow-400/20 flex items-center gap-2 transition-all shrink-0 active:scale-95"
        >
          <Plus className="w-4 h-4 text-black" />
          <span>Novo Comunicado</span>
        </button>
      </div>

      {/* Category Pills & Search */}
      <div className="flex flex-col md:flex-row items-center justify-between gap-4">
        
        {/* Category Pills */}
        <div className="flex items-center gap-2 overflow-x-auto w-full md:w-auto pb-1 no-scrollbar">
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className={`px-4 py-2 rounded-full text-xs font-extrabold whitespace-nowrap transition-all ${
                selectedCategory === cat
                  ? 'bg-yellow-400 text-black shadow-lg shadow-yellow-400/20'
                  : 'bg-white text-neutral-500 hover:text-neutral-900 border border-neutral-200'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>

        {/* Local Feed Search */}
        <div className="relative w-full md:w-72">
          <Search className="w-4 h-4 absolute left-4 top-1/2 -translate-y-1/2 text-neutral-500" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Buscar notícias..."
            className="w-full pl-10 pr-4 py-2 text-xs bg-white border border-neutral-200 rounded-full text-neutral-900 placeholder-neutral-500 focus:outline-none focus:border-yellow-400 transition-all"
          />
        </div>
      </div>

      {/* Feed List */}
      <div className="space-y-6">
        {filtered.length === 0 ? (
          <div className="p-12 text-center rounded-[2rem] bg-white border border-neutral-200 space-y-3">
            <Newspaper className="w-10 h-10 text-neutral-600 mx-auto" />
            <h3 className="text-sm font-bold text-neutral-600">Nenhum comunicado encontrado</h3>
            <p className="text-xs text-neutral-500 max-w-sm mx-auto font-medium">
              Tente mudar a categoria selecionada ou limpe os termos de pesquisa.
            </p>
          </div>
        ) : (
          filtered.map((item) => {
            const hasSummary = !!summariesMap[item.id];
            const isLoadingSummary = loadingSummaryId === item.id;
            const comments = item.comments || [];

            return (
              <article
                key={item.id}
                id={`comunicado-${item.id}`}
                className={`rounded-[2rem] bg-white border transition-all shadow-sm ${
                  item.pinned ? 'border-yellow-400/60 shadow-yellow-400/5' : 'border-neutral-200 hover:border-white/20'
                }`}
              >
                {/* Image Banner */}
                {item.image && (
                  <div className="relative h-56 sm:h-80 overflow-hidden rounded-t-[2rem] bg-neutral-950">
                    <img src={item.image} alt={item.title} className="w-full h-full object-cover" />
                    <div className="absolute inset-0 bg-gradient-to-t from-neutral-900 via-neutral-900/20 to-transparent" />
                  </div>
                )}

                <div className="p-6 sm:p-8 space-y-4">
                  
                  {/* Category & Pinned Badges */}
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className="px-3 py-1 rounded-full bg-yellow-50 text-yellow-700 border border-yellow-200 text-[10px] font-extrabold uppercase tracking-widest">
                        {item.category}
                      </span>
                      {item.pinned && (
                        <span className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-yellow-400 text-black text-[10px] font-extrabold uppercase tracking-widest">
                          <Pin className="w-3 h-3 fill-black" />
                          Fixado
                        </span>
                      )}
                    </div>
                    <span className="text-xs font-mono text-neutral-500 font-medium">{item.date}</span>
                  </div>

                  {/* Title & Author */}
                  <div>
                    <h2 className="text-xl sm:text-2xl font-black text-neutral-900 leading-tight">
                      {item.title}
                    </h2>
                    <div className="flex items-center gap-3 mt-3">
                      <img src={item.author.avatar} alt={item.author.name} className="w-8 h-8 rounded-full object-cover border-2 border-yellow-400" />
                      <div>
                        <span className="text-xs font-bold text-neutral-900 block leading-tight">{item.author.name}</span>
                        <span className="text-[10px] text-neutral-500 block leading-tight mt-0.5">{item.author.role}</span>
                      </div>
                    </div>
                  </div>

                  {/* Content Body */}
                  <div className="text-xs sm:text-sm text-neutral-600 leading-relaxed whitespace-pre-line space-y-2">
                    {item.content}
                  </div>

                  {/* AI Executive Summary Widget */}
                  <div className="p-4 rounded-xl bg-gradient-to-r from-amber-400/10 via-white to-white border border-amber-400/30 space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 text-xs font-bold text-amber-400 uppercase tracking-wider">
                        <Sparkles className="w-4 h-4 text-amber-400 animate-pulse" />
                        <span>Resumo Executivo com IA</span>
                      </div>
                      {!hasSummary && (
                        <button
                          onClick={() => handleAISummarize(item)}
                          disabled={isLoadingSummary}
                          className="px-2.5 py-1 rounded bg-amber-400 text-zinc-950 font-bold text-[11px] hover:bg-yellow-300 transition-colors disabled:opacity-50"
                        >
                          {isLoadingSummary ? 'Gerando...' : 'Gerar Resumo'}
                        </button>
                      )}
                    </div>

                    {hasSummary ? (
                      <div className="text-xs text-neutral-800 font-medium leading-relaxed bg-neutral-50 p-3 rounded-lg border border-neutral-200">
                        {summariesMap[item.id]}
                      </div>
                    ) : (
                      <p className="text-[11px] text-neutral-500 italic">
                        Clique em "Gerar Resumo" para obter uma síntese por inteligência artificial em segundos.
                      </p>
                    )}
                  </div>

                  {/* Tags */}
                  {item.tags.length > 0 && (
                    <div className="flex flex-wrap items-center gap-1.5 pt-1">
                      {item.tags.map((tag) => (
                        <span key={tag} className="px-2 py-0.5 rounded bg-neutral-100 text-neutral-500 text-[10px] font-semibold border border-neutral-200 flex items-center gap-1">
                          <Tag className="w-2.5 h-2.5 text-amber-400" />
                          #{tag}
                        </span>
                      ))}
                    </div>
                  )}

                  {/* Social Footer: Like, Comment Count, Share */}
                  <div className="pt-4 border-t border-neutral-200 flex items-center justify-between text-xs">
                    <div className="flex items-center gap-3">
                      <button
                        onClick={() => onLikeComunicado(item.id)}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border font-bold transition-all ${
                          item.likedByMe
                            ? 'bg-amber-400/20 text-amber-400 border-amber-400/40'
                            : 'bg-neutral-100 text-neutral-500 border-neutral-200 hover:text-amber-600'
                        }`}
                      >
                        <Heart className={`w-4 h-4 ${item.likedByMe ? 'fill-amber-400 text-amber-400' : ''}`} />
                        <span>{item.likes} Curtidas</span>
                      </button>

                      <div className="flex items-center gap-1.5 text-neutral-500 px-3 py-1.5 bg-neutral-100 rounded-lg border border-neutral-100 font-semibold">
                        <MessageSquare className="w-4 h-4 text-amber-600" />
                        <span>{comments.length} Comentários</span>
                      </div>
                    </div>

                    <button
                      onClick={() => handleCopyShareLink(item.id)}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-neutral-100 text-neutral-500 hover:text-amber-600 border border-neutral-200 hover:border-neutral-300 transition-colors"
                      title="Copiar Link do Comunicado"
                    >
                      {copiedId === item.id ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Share2 className="w-3.5 h-3.5" />}
                      <span>{copiedId === item.id ? 'Copiado!' : 'Compartilhar'}</span>
                    </button>
                  </div>

                  {/* Comments Section */}
                  <div className="pt-3 border-t border-neutral-100 space-y-3 bg-neutral-50 p-4 rounded-xl">
                    <h4 className="text-xs font-bold text-neutral-600 uppercase tracking-wider">
                      Comentários dos Colaboradores ({comments.length})
                    </h4>

                    {comments.length > 0 && (
                      <div className="space-y-2.5 max-h-48 overflow-y-auto pr-1">
                        {comments.map((c) => (
                          <div key={c.id} className="p-2.5 rounded-lg bg-white border border-neutral-200 flex items-start gap-2.5">
                            <img src={c.authorAvatar} alt={c.authorName} className="w-6 h-6 rounded-full object-cover ring-1 ring-amber-400/50 mt-0.5" />
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center justify-between">
                                <span className="text-xs font-bold text-neutral-800">{c.authorName}</span>
                                <span className="text-[10px] font-mono text-neutral-500">{c.createdAt}</span>
                              </div>
                              <p className="text-xs text-neutral-600 mt-0.5 leading-relaxed">{c.content}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Add Comment Input */}
                    <div className="flex items-center gap-2 pt-2">
                      <img src={user.avatar} alt={user.name} className="w-7 h-7 rounded-full object-cover ring-1 ring-amber-400 shrink-0" />
                      <input
                        type="text"
                        value={commentInputMap[item.id] || ''}
                        onChange={(e) => setCommentInputMap((prev) => ({ ...prev, [item.id]: e.target.value }))}
                        onKeyDown={(e) => e.key === 'Enter' && handleSendComment(item.id)}
                        placeholder="Escreva um comentário respeitoso..."
                        className="flex-1 px-3 py-1.5 text-xs bg-white border border-neutral-200 rounded-lg text-neutral-800 placeholder-neutral-400 focus:outline-none focus:border-amber-400"
                      />
                      <button
                        onClick={() => handleSendComment(item.id)}
                        className="p-1.5 rounded-lg bg-amber-400 text-black font-bold hover:bg-yellow-300 transition-colors shrink-0"
                        title="Enviar Comentário"
                      >
                        <Send className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                </div>
              </article>
            );
          })
        )}
      </div>

    </div>
  );
};
