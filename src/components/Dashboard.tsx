import React, { useEffect, useState } from 'react';
import {
  User,
  Comunicado,
  Documento,
  Colaborador,
  Enquete,
  TabType
} from '../types';
import { 
  Sparkles, 
  FileCheck, 
  Clock, 
  HardHat, 
  Calendar, 
  LifeBuoy, 
  Car, 
  Award, 
  Vote, 
  Cake, 
  ChevronRight, 
  ArrowUpRight, 
  Download, 
  Heart, 
  MessageSquare, 
  Building2,
  ShieldCheck, 
  Flame,
  CheckCircle2,
  BellRing
} from 'lucide-react';

interface DashboardProps {
  user: User;
  comunicados: Comunicado[];
  documentos: Documento[];
  colaboradores: Colaborador[];
  setActiveTab: (tab: TabType) => void;
  onOpenNewChamado: () => void;
  onOpenNewComunicado: () => void;
  onOpenAIAssistant: () => void;
  onLikeComunicado: (id: string) => void;
  onSelectComunicadoDetail: (comunicado: Comunicado) => void;
}

export const Dashboard: React.FC<DashboardProps> = ({
  user,
  comunicados,
  documentos,
  colaboradores,
  setActiveTab,
  onOpenNewChamado,
  onOpenNewComunicado,
  onOpenAIAssistant,
  onLikeComunicado,
  onSelectComunicadoDetail,
}) => {
  // Enquete da Semana — cadastrada pelo RH (módulo RH > Adicionar Enquete),
  // busca a enquete ativa real do servidor. Voto fica marcado no
  // localStorage (chave por id da enquete) pra não deixar votar de novo
  // nesse navegador, mesmo depois de recarregar a página.
  const [enqueteAtual, setEnqueteAtual] = useState<Enquete | null>(null);
  const [carregandoEnquete, setCarregandoEnquete] = useState(true);
  const [opcaoVotada, setOpcaoVotada] = useState<number | null>(null);
  const [votando, setVotando] = useState(false);

  useEffect(() => {
    fetch('/api/enquetes/atual')
      .then((res) => res.json())
      .then((data: Enquete | null) => {
        setEnqueteAtual(data);
        if (data) {
          const votoSalvo = localStorage.getItem(`enquete-voto-${data.id}`);
          if (votoSalvo !== null) setOpcaoVotada(Number(votoSalvo));
        }
      })
      .catch(() => setEnqueteAtual(null))
      .finally(() => setCarregandoEnquete(false));
  }, []);

  const totalVotosEnquete = enqueteAtual ? enqueteAtual.votos.reduce((soma, v) => soma + v, 0) : 0;

  const handleVote = async (opcaoIndex: number) => {
    if (!enqueteAtual || opcaoVotada !== null || votando) return;
    setVotando(true);
    try {
      const res = await fetch(`/api/enquetes/${enqueteAtual.id}/votar`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ opcaoIndex }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error);
      setEnqueteAtual(data);
      setOpcaoVotada(opcaoIndex);
      localStorage.setItem(`enquete-voto-${data.id}`, String(opcaoIndex));
    } catch {
      // Enquete pode ter sido substituída por uma nova enquanto votava —
      // recarrega o estado atual em vez de deixar a tela travada.
      fetch('/api/enquetes/atual')
        .then((res) => res.json())
        .then(setEnqueteAtual)
        .catch(() => setEnqueteAtual(null));
    } finally {
      setVotando(false);
    }
  };

  // Filter August birthdays
  const augustBirthdays = colaboradores.filter((c) => c.birthMonthDay.endsWith('/08'));

  // Congratulate popup state
  const [congratulatedId, setCongratulatedId] = useState<string | null>(null);

  const pinnedPosts = comunicados.filter((c) => c.pinned);
  const recentPosts = comunicados.slice(0, 3);

  return (
    <div className="space-y-6 pb-12">
      
      {/* Main Grid: Feed & Sidebar Widgets */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Left 2 Cols: Pinned & Latest Comunicados */}
        <div className="lg:col-span-2 space-y-6">
          
          {/* Header section */}
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-extrabold text-neutral-900 tracking-wider uppercase flex items-center gap-2">
              <BellRing className="w-4 h-4 text-amber-400" />
              Últimos Comunicados Internos
            </h2>
            <button
              onClick={() => setActiveTab('comunicados')}
              className="text-xs font-bold text-yellow-600 hover:text-yellow-300 flex items-center gap-1 transition-colors"
            >
              <span>Ver Feed Completo</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Pinned Posts Banner */}
          {pinnedPosts.map((post) => (
            <div 
              key={post.id}
              className="rounded-[2rem] bg-white border border-yellow-400/40 overflow-hidden shadow-sm hover:border-yellow-400 transition-all group"
            >
              {post.image && (
                <div className="relative h-48 sm:h-64 overflow-hidden bg-neutral-950">
                  <img
                    src={post.image}
                    alt={post.title}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500 opacity-90"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-neutral-900 via-neutral-900/40 to-transparent" />
                  <div className="absolute top-4 left-4 flex items-center gap-2">
                    <span className="px-3 py-1 rounded-full bg-yellow-400 text-black font-extrabold text-[10px] uppercase tracking-widest shadow-lg">
                      📌 Destaque Pinned
                    </span>
                    <span className="px-3 py-1 rounded-full bg-black/80 backdrop-blur-md text-yellow-600 font-bold text-[10px] uppercase border border-yellow-400/30">
                      {post.category}
                    </span>
                  </div>
                </div>
              )}

              <div className="p-6 space-y-3">
                <div className="flex items-center justify-between text-xs text-neutral-500">
                  <div className="flex items-center gap-2">
                    <img src={post.author.avatar} alt={post.author.name} className="w-7 h-7 rounded-full object-cover border-2 border-yellow-400" />
                    <span className="font-bold text-neutral-900">{post.author.name}</span>
                    <span className="text-neutral-600">•</span>
                    <span className="text-neutral-500">{post.author.role}</span>
                  </div>
                  <span className="font-mono text-neutral-500">{post.date}</span>
                </div>

                <h3
                  onClick={() => onSelectComunicadoDetail(post)}
                  className="text-xl sm:text-2xl font-bold text-neutral-900 group-hover:text-yellow-600 cursor-pointer transition-colors leading-tight"
                >
                  {post.title}
                </h3>

                <p className="text-xs sm:text-sm text-neutral-600 leading-relaxed line-clamp-2 font-medium">
                  {post.summary}
                </p>

                <div className="pt-3 flex items-center justify-between border-t border-neutral-200">
                  <div className="flex items-center gap-4 text-xs font-semibold">
                    <button
                      onClick={() => onLikeComunicado(post.id)}
                      className={`flex items-center gap-2 px-3 py-1.5 rounded-full border transition-all ${
                        post.likedByMe 
                          ? 'bg-yellow-400 text-black border-yellow-400 font-bold' 
                          : 'bg-black text-neutral-500 border-neutral-200 hover:text-yellow-600'
                      }`}
                    >
                      <Heart className={`w-3.5 h-3.5 ${post.likedByMe ? 'fill-black text-black' : ''}`} />
                      <span>{post.likes}</span>
                    </button>

                    <button 
                      onClick={() => onSelectComunicadoDetail(post)}
                      className="flex items-center gap-1.5 text-neutral-500 hover:text-neutral-900 transition-colors"
                    >
                      <MessageSquare className="w-3.5 h-3.5" />
                      <span>{post.commentsCount} comentários</span>
                    </button>
                  </div>

                  <button
                    onClick={() => onSelectComunicadoDetail(post)}
                    className="text-xs font-bold text-yellow-600 hover:underline flex items-center gap-1"
                  >
                    <span>Ler matéria completa</span>
                    <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </div>
          ))}

          {/* Empty state — sem comunicados publicados ainda */}
          {comunicados.length === 0 && (
            <div className="p-10 rounded-[2rem] bg-white border border-neutral-200 flex flex-col items-center justify-center gap-2 text-center">
              <BellRing className="w-6 h-6 text-neutral-300" aria-hidden="true" />
              <span className="text-neutral-500 text-sm font-semibold">Nenhum comunicado publicado ainda</span>
              <button
                onClick={onOpenNewComunicado}
                className="mt-2 text-xs font-bold text-yellow-600 hover:underline"
              >
                Publicar o primeiro comunicado
              </button>
            </div>
          )}

          {/* Other Recent News Cards */}
          <div className="space-y-4">
            {recentPosts.filter(p => !p.pinned).map((post) => (
              <div
                key={post.id}
                onClick={() => onSelectComunicadoDetail(post)}
                className="p-5 rounded-2xl bg-white border border-neutral-200 hover:border-yellow-400/60 transition-all cursor-pointer flex flex-col sm:flex-row gap-4 group shadow-lg"
              >
                {post.image && (
                  <div className="w-full sm:w-40 h-32 rounded-xl overflow-hidden shrink-0 bg-neutral-950 relative">
                    <img src={post.image} alt={post.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform" />
                  </div>
                )}
                <div className="flex-1 space-y-2 min-w-0">
                  <div className="flex items-center justify-between text-[11px] text-neutral-500">
                    <span className="font-bold text-yellow-600 uppercase tracking-wider">{post.category}</span>
                    <span className="font-mono">{post.date}</span>
                  </div>
                  <h4 className="text-base font-bold text-neutral-900 group-hover:text-yellow-600 transition-colors line-clamp-1">
                    {post.title}
                  </h4>
                  <p className="text-xs text-neutral-500 line-clamp-2 leading-relaxed">
                    {post.summary}
                  </p>
                  <div className="pt-1 flex items-center gap-3 text-[11px] text-neutral-500 font-medium">
                    <span>Por: {post.author.name}</span>
                    <span>•</span>
                    <span>{post.likes} curtidas</span>
                  </div>
                </div>
              </div>
            ))}
          </div>

        </div>

        {/* Right 1 Col: Widgets (Poll, Birthdays, Employee Spotlight, Top Docs) */}
        <div className="space-y-6">
          
          {/* Widget 1: Interactive Employee Poll */}
          <div className="p-6 rounded-[2rem] bg-white border border-neutral-200 shadow-sm space-y-4">
            <div className="flex items-center gap-2 text-xs font-bold text-yellow-600 uppercase tracking-widest">
              <Vote className="w-4 h-4 text-yellow-600" />
              <span>Enquete da Semana</span>
            </div>

            {carregandoEnquete ? (
              <p className="text-xs text-neutral-500 py-4 text-center">Carregando...</p>
            ) : !enqueteAtual ? (
              <p className="text-xs text-neutral-500 py-4 text-center">Nenhuma enquete ativa no momento.</p>
            ) : (
              <>
                <h3 className="text-sm font-bold text-neutral-900 leading-snug">
                  {enqueteAtual.pergunta}
                </h3>

                <div className="space-y-2.5 text-xs">
                  {enqueteAtual.opcoes.map((label, idx) => {
                    const votes = enqueteAtual.votos[idx] || 0;
                    const pct = totalVotosEnquete > 0 ? Math.round((votes / totalVotosEnquete) * 100) : 0;
                    const isSelected = opcaoVotada === idx;

                    return (
                      <button
                        key={idx}
                        onClick={() => handleVote(idx)}
                        disabled={opcaoVotada !== null || votando}
                        className={`w-full p-3 rounded-xl border text-left relative overflow-hidden transition-all ${
                          isSelected
                            ? 'border-yellow-400 bg-yellow-400/10 text-neutral-900 font-bold'
                            : 'border-neutral-200 bg-neutral-50 hover:border-yellow-400/50 text-neutral-600'
                        }`}
                      >
                        {/* Progress Bar Background */}
                        {opcaoVotada !== null && (
                          <div
                            className="absolute left-0 top-0 bottom-0 bg-yellow-400/20 transition-all duration-700 pointer-events-none"
                            style={{ width: `${pct}%` }}
                          />
                        )}

                        <div className="relative z-10 flex items-center justify-between">
                          <span className="font-semibold">{label}</span>
                          {opcaoVotada !== null && (
                            <span className="font-mono text-[11px] font-bold text-yellow-600 shrink-0 ml-2">
                              {pct}%
                            </span>
                          )}
                        </div>
                      </button>
                    );
                  })}
                </div>

                <div className="text-[10px] text-neutral-500 text-right font-mono font-medium">
                  Total de votos: {totalVotosEnquete} colaboradores
                </div>
              </>
            )}
          </div>

          {/* Widget 2: Birthdays of the Month */}
          <div className="p-6 rounded-[2rem] bg-white border border-neutral-200 shadow-sm space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-xs font-bold text-yellow-600 uppercase tracking-widest">
                <Cake className="w-4 h-4 text-yellow-600" />
                <span>Aniversariantes de Agosto</span>
              </div>
              <span className="text-[10px] font-mono font-bold bg-yellow-50 text-yellow-700 px-2.5 py-1 rounded-full border border-yellow-200">
                {augustBirthdays.length} Celebrações
              </span>
            </div>

            <div className="space-y-2.5 max-h-60 overflow-y-auto">
              {augustBirthdays.map((person) => {
                const isCongratulated = congratulatedId === person.id;

                return (
                  <div key={person.id} className="p-3 rounded-2xl bg-neutral-50 border border-neutral-100 flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <img src={person.avatar} alt={person.name} className="w-9 h-9 rounded-full object-cover border-2 border-yellow-400 shrink-0" />
                      <div className="min-w-0">
                        <span className="text-xs font-bold text-neutral-900 block truncate">{person.name}</span>
                        <span className="text-[10px] text-neutral-500 block truncate">{person.role}</span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <span className="text-[11px] font-mono font-bold text-yellow-600 bg-white px-2.5 py-1 rounded-lg border border-neutral-200">
                        {person.birthMonthDay}
                      </span>
                      <button
                        onClick={() => setCongratulatedId(person.id)}
                        className={`p-2 rounded-xl text-xs font-bold transition-all ${
                          isCongratulated
                            ? 'bg-emerald-500 text-black'
                            : 'bg-yellow-400 text-black hover:bg-yellow-300'
                        }`}
                        title="Enviar Parabéns!"
                      >
                        {isCongratulated ? <CheckCircle2 className="w-4 h-4" /> : '🎉'}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Widget 3: Employee Spotlight (Colaborador Destaque) */}
          <div className="p-6 rounded-[2rem] bg-gradient-to-br from-yellow-400/10 via-neutral-900 to-neutral-900 border border-yellow-400/30 shadow-sm space-y-4">
            <div className="flex items-center gap-2 text-xs font-bold text-yellow-600 uppercase tracking-widest">
              <Award className="w-4 h-4 text-yellow-600" />
              <span>Destaque Operacional do Mês</span>
            </div>

            <p className="text-xs text-neutral-400 text-center py-4">Nenhum destaque definido ainda.</p>
          </div>

          {/* Widget 4: Quick Download Documents */}
          <div className="p-6 rounded-[2rem] bg-white border border-neutral-200 shadow-sm space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-xs font-bold text-yellow-600 uppercase tracking-widest">
                <Download className="w-4 h-4 text-yellow-600" />
                <span>Normas & Documentos</span>
              </div>
              <button
                onClick={() => setActiveTab('documentos')}
                className="text-xs text-yellow-600 hover:underline font-bold"
              >
                Ver todos
              </button>
            </div>

            <div className="space-y-2.5">
              {documentos.length === 0 && (
                <p className="text-xs text-neutral-400 text-center py-4">Nenhum documento cadastrado ainda.</p>
              )}
              {documentos.slice(0, 3).map((doc) => (
                <a
                  key={doc.id}
                  href={`#download-${doc.id}`}
                  onClick={(e) => {
                    e.preventDefault();
                    alert(`Iniciando download de: ${doc.title} (${doc.fileSize})`);
                  }}
                  className="p-3 rounded-2xl bg-neutral-50 border border-neutral-100 hover:border-yellow-400/50 flex items-center justify-between text-xs group transition-all"
                >
                  <div className="min-w-0 pr-2">
                    <span className="font-bold text-neutral-900 group-hover:text-yellow-600 truncate block">
                      {doc.title}
                    </span>
                    <span className="text-[10px] text-neutral-500 font-mono mt-0.5 block">
                      {doc.fileType} • {doc.fileSize}
                    </span>
                  </div>
                  <Download className="w-4 h-4 text-neutral-500 group-hover:text-yellow-600 shrink-0" />
                </a>
              ))}
            </div>
          </div>

        </div>

      </div>

    </div>
  );
};
