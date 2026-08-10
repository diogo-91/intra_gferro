import React, { useState, useRef, useEffect } from 'react';
import {
  Lightbulb,
  Send,
  X,
  Bot,
  User as UserIcon,
  RefreshCw,
  Sparkles,
  CheckCircle2,
  FileText,
  EyeOff,
  HelpCircle,
  MessageSquare,
  ThumbsUp,
  Award,
  Layers,
  Building2
} from 'lucide-react';
import { User } from '../types';

interface AIAssistantModalProps {
  user: User;
  isOpen: boolean;
  onClose: () => void;
}

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  time: string;
}

interface IdeaSubmission {
  id: string;
  title: string;
  department: string;
  category: string;
  description: string;
  impact: string;
  isAnonymous: boolean;
  authorName: string;
  createdAt: string;
  status: 'Em Análise' | 'Aprovada' | 'Em Estudo de Viabilidade';
  likes: number;
}

export const AIAssistantModal: React.FC<AIAssistantModalProps> = ({ user, isOpen, onClose }) => {
  const [activeTab, setActiveTab] = useState<'form' | 'ideas' | 'chat'>('form');

  // Form State
  const [title, setTitle] = useState('');
  const [department, setDepartment] = useState('Operações e Fábrica');
  const [category, setCategory] = useState('Melhoria de Processo / Produtividade');
  const [description, setDescription] = useState('');
  const [impact, setImpact] = useState('');
  const [isAnonymous, setIsAnonymous] = useState(false);
  const [isPolishing, setIsPolishing] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [protocol, setProtocol] = useState('');

  // Sample Submitted Ideas list
  const [submittedIdeas, setSubmittedIdeas] = useState<IdeaSubmission[]>([
    {
      id: 'IDEIA-102',
      title: 'Instalação de sensores de presença nos exaustores do Galpão B',
      department: 'Operações e Fábrica',
      category: 'Sustentabilidade & Economia',
      description: 'Automatizar o desligamento dos exaustores quando não houver operação na linha de corte para economizar energia elétrica.',
      impact: 'Redução estimada de 8% no consumo de energia dos galpões fabris.',
      isAnonymous: false,
      authorName: 'Eng. Carlos Ferreira',
      createdAt: '28/07/2026',
      status: 'Aprovada',
      likes: 14,
    },
    {
      id: 'IDEIA-103',
      title: 'Dispensers de protetores auriculares moldáveis na entrada da fábrica',
      department: 'Segurança SST',
      category: 'Segurança & Saúde',
      description: 'Facilitar a retirada de novos protetores auriculares descartáveis antes de acessar as linhas de dobradeiras CNC.',
      impact: 'Maior adesão ao uso correto de EPIs e agilidade na entrada do turno.',
      isAnonymous: true,
      authorName: 'Colaborador Anônimo',
      createdAt: '29/07/2026',
      status: 'Em Análise',
      likes: 9,
    },
  ]);

  // Chat State
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'msg-1',
      role: 'assistant',
      content: `Olá, **${user.name.split(' ')[0]}**! Este é o assistente inteligente do **Canal de Ideias e Sugestões GFERRO**.

Tire dúvidas sobre como submeter sua proposta, como funciona a premiação de ideias inovadoras ou solicite auxílio para estruturar sua sugestão!`,
      time: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
    },
  ]);
  const [chatInput, setChatInput] = useState('');
  const [chatLoading, setChatLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    if (isOpen && activeTab === 'chat') {
      scrollToBottom();
    }
  }, [messages, isOpen, activeTab]);

  if (!isOpen) return null;

  // AI Text Enhancement for Form
  const handlePolishText = async () => {
    if (!description.trim()) return;
    setIsPolishing(true);

    try {
      const prompt = `Atue como um especialista em melhoria contínua e engenharia industrial siderúrgica. Aprimore e reescreva a seguinte sugestão enviada por um colaborador para que fique formal, clara e técnica:
Título: ${title}
Descrição: ${description}
Impacto: ${impact}

Forneça um texto reestruturado mantendo a essência original, porém com linguagem profissional e termos adequados.`;

      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: prompt, history: [] }),
      });

      const data = await res.json();
      if (data.reply) {
        setDescription(data.reply);
      }
    } catch (err) {
      console.error('Error polishing text:', err);
    } finally {
      setIsPolishing(false);
    }
  };

  // Submit Form
  const handleSubmitIdea = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !description.trim()) return;

    const newProtocol = `IDEIA-${Math.floor(1000 + Math.random() * 9000)}`;
    const newIdea: IdeaSubmission = {
      id: newProtocol,
      title: title.trim(),
      department,
      category,
      description: description.trim(),
      impact: impact.trim() || 'Melhoria na eficiência geral do setor.',
      isAnonymous,
      authorName: isAnonymous ? 'Colaborador Anônimo' : user.name,
      createdAt: new Date().toLocaleDateString('pt-BR'),
      status: 'Em Análise',
      likes: 1,
    };

    setSubmittedIdeas((prev) => [newIdea, ...prev]);
    setProtocol(newProtocol);
    setIsSubmitted(true);
  };

  const handleResetForm = () => {
    setTitle('');
    setDescription('');
    setImpact('');
    setIsSubmitted(false);
    setProtocol('');
  };

  // Chat Send Handler
  const handleSendChat = async (textToSend?: string) => {
    const query = textToSend || chatInput;
    if (!query.trim() || chatLoading) return;

    const userMsg: ChatMessage = {
      id: `usr-${Date.now()}`,
      role: 'user',
      content: query.trim(),
      time: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
    };

    setMessages((prev) => [...prev, userMsg]);
    if (!textToSend) setChatInput('');
    setChatLoading(true);

    try {
      const historyPayload = messages.map((m) => ({
        role: m.role === 'user' ? 'user' : 'model',
        content: m.content,
      }));

      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: query.trim(),
          history: historyPayload,
        }),
      });

      const data = await res.json();
      const botReply = data.reply || 'Desculpe, ocorreu uma instabilidade. Tente novamente.';

      const botMsg: ChatMessage = {
        id: `bot-${Date.now()}`,
        role: 'assistant',
        content: botReply,
        time: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
      };

      setMessages((prev) => [...prev, botMsg]);
    } catch (error) {
      console.error('Chat error:', error);
      setMessages((prev) => [
        ...prev,
        {
          id: `err-${Date.now()}`,
          role: 'assistant',
          content: 'Ocorreu um erro ao conectar à IA Assistente GFERRO.',
          time: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
        },
      ]);
    } finally {
      setChatLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-2 sm:p-4">
      <div className="bg-white border border-yellow-400/50 rounded-[2rem] w-full max-w-3xl h-[85vh] flex flex-col shadow-2xl overflow-hidden">

        {/* Header Bar */}
        <div className="p-5 bg-white border-b border-neutral-200 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-yellow-400 text-black flex items-center justify-center font-extrabold shadow-lg shadow-yellow-400/20">
              <Lightbulb className="w-5 h-5 fill-black" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-extrabold text-neutral-900">Canal de Ideias e Sugestões GFERRO</h2>
                <span className="px-2 py-0.5 rounded-full bg-yellow-50 text-yellow-700 border border-yellow-200 text-[10px] font-mono font-bold">
                  Melhoria Contínua
                </span>
              </div>
              <p className="text-[11px] text-neutral-500 font-medium">Proponha inovações e melhorias para a fábrica e processos corporativos</p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-full text-neutral-500 hover:text-yellow-600 hover:bg-neutral-100 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Navigation Controls */}
        <div className="px-5 py-2.5 bg-white border-b border-neutral-200 flex items-center gap-2 shrink-0">
          <button
            onClick={() => setActiveTab('form')}
            className={`px-4 py-2 rounded-full text-xs font-extrabold flex items-center gap-2 transition-all ${
              activeTab === 'form'
                ? 'bg-yellow-400 text-black shadow-lg'
                : 'text-neutral-500 hover:text-neutral-900 hover:bg-neutral-100'
            }`}
          >
            <FileText className="w-4 h-4" />
            <span>Formulário de Sugestão</span>
          </button>

          <button
            onClick={() => setActiveTab('ideas')}
            className={`px-4 py-2 rounded-full text-xs font-extrabold flex items-center gap-2 transition-all ${
              activeTab === 'ideas'
                ? 'bg-yellow-400 text-black shadow-lg'
                : 'text-neutral-500 hover:text-neutral-900 hover:bg-neutral-100'
            }`}
          >
            <Award className="w-4 h-4" />
            <span>Ideias Enviadas ({submittedIdeas.length})</span>
          </button>

          <button
            onClick={() => setActiveTab('chat')}
            className={`px-4 py-2 rounded-full text-xs font-extrabold flex items-center gap-2 transition-all ${
              activeTab === 'chat'
                ? 'bg-yellow-400 text-black shadow-lg'
                : 'text-neutral-500 hover:text-neutral-900 hover:bg-neutral-100'
            }`}
          >
            <Bot className="w-4 h-4" />
            <span>Assistente IA GFERRO</span>
          </button>
        </div>

        {/* TAB 1: FORMULÁRIO DE SUGESTÃO */}
        {activeTab === 'form' && (
          <div className="flex-1 p-6 overflow-y-auto space-y-5 text-xs">
            {isSubmitted ? (
              <div className="p-8 rounded-3xl bg-white border border-yellow-400/40 text-center space-y-4 shadow-sm my-auto">
                <div className="w-16 h-16 rounded-full bg-yellow-400 text-black flex items-center justify-center mx-auto shadow-xl">
                  <CheckCircle2 className="w-8 h-8" />
                </div>
                <div className="space-y-1">
                  <h3 className="text-xl font-black text-neutral-900">Ideia Enviada com Sucesso!</h3>
                  <p className="text-xs text-neutral-600">
                    Sua proposta foi registrada no Comitê de Melhoria Contínua da GFERRO.
                  </p>
                </div>

                <div className="p-4 rounded-2xl bg-neutral-50 border border-neutral-200 max-w-sm mx-auto space-y-1 font-mono">
                  <span className="text-[10px] text-neutral-500 uppercase font-bold block">Código do Protocolo</span>
                  <span className="text-xl font-black text-yellow-600">{protocol}</span>
                </div>

                <div className="flex items-center justify-center gap-3 pt-2">
                  <button
                    onClick={handleResetForm}
                    className="px-5 py-2.5 rounded-full bg-yellow-400 text-black font-extrabold text-xs hover:bg-yellow-300 transition-all"
                  >
                    Enviar Outra Ideia
                  </button>
                  <button
                    onClick={() => setActiveTab('ideas')}
                    className="px-5 py-2.5 rounded-full bg-neutral-100 text-neutral-800 font-bold text-xs hover:bg-neutral-200 transition-all"
                  >
                    Ver Ideias Enviadas
                  </button>
                </div>
              </div>
            ) : (
              <form onSubmit={handleSubmitIdea} className="space-y-5">

                {/* Title Input */}
                <div className="space-y-1.5">
                  <label className="text-xs font-extrabold text-neutral-900 flex items-center justify-between">
                    <span>Título da Ideia ou Sugestão <span className="text-yellow-600">*</span></span>
                    <span className="text-[10px] text-neutral-500">Seja claro e objetivo</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="Ex: Instalação de exaustores automáticos na linha de corte CNC..."
                    className="w-full bg-white border border-neutral-200 rounded-xl p-3 text-xs text-neutral-900 placeholder-neutral-500 focus:outline-none focus:border-yellow-400 transition-all"
                  />
                </div>

                {/* Department & Category Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-xs font-extrabold text-neutral-900 block">Setor / Área Relacionada</label>
                    <select
                      value={department}
                      onChange={(e) => setDepartment(e.target.value)}
                      className="w-full bg-white border border-neutral-200 rounded-xl p-3 text-xs text-neutral-900 focus:outline-none focus:border-yellow-400 transition-all"
                    >
                      <option value="Operações e Fábrica">Operações e Fábrica</option>
                      <option value="Segurança SST & Meio Ambiente">Segurança SST & Meio Ambiente</option>
                      <option value="Engenharia & Qualidade">Engenharia & Qualidade</option>
                      <option value="Recursos Humanos">Recursos Humanos</option>
                      <option value="TI e Sistemas">TI e Sistemas</option>
                      <option value="Comercial & Vendas">Comercial & Vendas</option>
                      <option value="Logística & Expedição">Logística & Expedição</option>
                    </select>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-extrabold text-neutral-900 block">Categoria da Ideia</label>
                    <select
                      value={category}
                      onChange={(e) => setCategory(e.target.value)}
                      className="w-full bg-white border border-neutral-200 rounded-xl p-3 text-xs text-neutral-900 focus:outline-none focus:border-yellow-400 transition-all"
                    >
                      <option value="Melhoria de Processo / Produtividade">Melhoria de Processo / Produtividade</option>
                      <option value="Segurança & Saúde">Segurança & Saúde</option>
                      <option value="Sustentabilidade & Economia">Sustentabilidade & Economia</option>
                      <option value="Bem-Estar & Convivência">Bem-Estar & Convivência</option>
                      <option value="Inovação Tecnológica">Inovação Tecnológica</option>
                    </select>
                  </div>
                </div>

                {/* Description Input & AI Polish Button */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-extrabold text-neutral-900">
                      Descrição Detalhada da Proposta <span className="text-yellow-600">*</span>
                    </label>
                    <button
                      type="button"
                      onClick={handlePolishText}
                      disabled={!description.trim() || isPolishing}
                      className="px-3 py-1 rounded-full bg-yellow-50 text-yellow-700 border border-yellow-200 text-[10px] font-extrabold hover:bg-yellow-400 hover:text-black disabled:opacity-40 transition-all flex items-center gap-1.5"
                    >
                      <Sparkles className={`w-3 h-3 ${isPolishing ? 'animate-spin' : ''}`} />
                      <span>{isPolishing ? 'Aprimorando...' : 'Melhorar texto com IA'}</span>
                    </button>
                  </div>
                  <textarea
                    rows={4}
                    required
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Explique o problema atual e qual a sua solução proposta..."
                    className="w-full bg-white border border-neutral-200 rounded-xl p-3 text-xs text-neutral-900 placeholder-neutral-500 focus:outline-none focus:border-yellow-400 transition-all leading-relaxed"
                  />
                </div>

                {/* Expected Impact */}
                <div className="space-y-1.5">
                  <label className="text-xs font-extrabold text-neutral-900 block">Benefício / Impacto Esperado</label>
                  <input
                    type="text"
                    value={impact}
                    onChange={(e) => setImpact(e.target.value)}
                    placeholder="Ex: Redução de tempo de setup, economia de energia, prevenção de riscos..."
                    className="w-full bg-white border border-neutral-200 rounded-xl p-3 text-xs text-neutral-900 placeholder-neutral-500 focus:outline-none focus:border-yellow-400 transition-all"
                  />
                </div>

                {/* Anonymous Checkbox Toggle */}
                <div className="p-4 rounded-2xl bg-neutral-50 border border-neutral-200 flex items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <EyeOff className="w-5 h-5 text-yellow-600 shrink-0" />
                    <div>
                      <span className="text-xs font-extrabold text-neutral-900 block">Envio Confidencial / Anônimo</span>
                      <span className="text-[10px] text-neutral-500 block">
                        Oculta seu nome e foto no registro público da ideia.
                      </span>
                    </div>
                  </div>

                  <input
                    type="checkbox"
                    checked={isAnonymous}
                    onChange={(e) => setIsAnonymous(e.target.checked)}
                    className="w-5 h-5 rounded accent-yellow-400 cursor-pointer"
                  />
                </div>

                {/* Submit Action Bar */}
                <div className="pt-3 border-t border-neutral-200 flex items-center justify-end gap-3">
                  <button
                    type="button"
                    onClick={onClose}
                    className="px-5 py-2.5 rounded-full bg-white text-neutral-600 font-bold text-xs hover:bg-neutral-100 transition-all"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={!title.trim() || !description.trim()}
                    className="px-6 py-2.5 rounded-full bg-yellow-400 text-black font-extrabold text-xs hover:bg-yellow-300 disabled:opacity-50 transition-all flex items-center gap-2 shadow-lg active:scale-95"
                  >
                    <Send className="w-4 h-4" />
                    <span>Submeter Ideia para o Comitê</span>
                  </button>
                </div>

              </form>
            )}
          </div>
        )}

        {/* TAB 2: IDEIAS ENVIADAS (COMMUNITY & RECOGNITION) */}
        {activeTab === 'ideas' && (
          <div className="flex-1 p-6 overflow-y-auto space-y-4 text-xs">
            <div className="flex items-center justify-between border-b border-neutral-200 pb-3">
              <h3 className="text-xs font-bold uppercase text-neutral-500 tracking-wider">
                Mural de Ideias & Melhorias Registradas
              </h3>
              <span className="text-[10px] text-yellow-600 font-mono font-bold">
                Programa Inova GFERRO
              </span>
            </div>

            <div className="space-y-4">
              {submittedIdeas.map((idea) => (
                <div
                  key={idea.id}
                  className="p-5 rounded-2xl bg-white border border-neutral-200 hover:border-yellow-400/40 space-y-3 transition-all"
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className="px-2.5 py-0.5 rounded-full bg-yellow-50 text-yellow-700 font-mono font-extrabold text-[10px] border border-yellow-200">
                        {idea.id}
                      </span>
                      <span className="px-2.5 py-0.5 rounded-full bg-neutral-100 text-neutral-600 font-semibold text-[10px] border border-neutral-200">
                        {idea.category}
                      </span>
                    </div>

                    <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-extrabold ${
                      idea.status === 'Aprovada'
                        ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                        : 'bg-sky-50 text-sky-700 border border-sky-200'
                    }`}>
                      {idea.status}
                    </span>
                  </div>

                  <div>
                    <h4 className="text-sm font-extrabold text-neutral-900 block mb-1">{idea.title}</h4>
                    <p className="text-neutral-600 leading-relaxed font-medium">{idea.description}</p>
                  </div>

                  {idea.impact && (
                    <div className="p-3 rounded-xl bg-neutral-50 border border-neutral-100 text-[11px] font-mono text-yellow-600/90">
                      💡 <strong>Impacto:</strong> {idea.impact}
                    </div>
                  )}

                  <div className="pt-2 border-t border-neutral-100 flex items-center justify-between text-[10px] text-neutral-500">
                    <div className="flex items-center gap-2">
                      <UserIcon className="w-3.5 h-3.5 text-neutral-500" />
                      <span>{idea.authorName} • {idea.department}</span>
                    </div>

                    <div className="flex items-center gap-3">
                      <button
                        onClick={() => {
                          setSubmittedIdeas(prev => prev.map(i => i.id === idea.id ? { ...i, likes: i.likes + 1 } : i));
                        }}
                        className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-neutral-100 border border-neutral-200 hover:border-yellow-400 hover:text-yellow-600 transition-colors"
                      >
                        <ThumbsUp className="w-3 h-3 text-yellow-600" />
                        <span className="font-bold">{idea.likes} Apoios</span>
                      </button>
                      <span className="font-mono">{idea.createdAt}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* TAB 3: ASSISTENTE IA CHAT */}
        {activeTab === 'chat' && (
          <div className="flex-1 flex flex-col min-h-0">
            {/* Chat Messages */}
            <div className="flex-1 p-5 overflow-y-auto space-y-4 text-xs">
              {messages.map((msg) => (
                <div
                  key={msg.id}
                  className={`flex gap-3 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  {msg.role === 'assistant' && (
                    <div className="w-8 h-8 rounded-full bg-yellow-400 text-black flex items-center justify-center font-bold shrink-0 mt-0.5 shadow-md">
                      <Bot className="w-4 h-4" />
                    </div>
                  )}

                  <div
                    className={`max-w-[85%] sm:max-w-[75%] p-4 rounded-2xl space-y-1.5 ${
                      msg.role === 'user'
                        ? 'bg-yellow-400 text-black font-semibold rounded-tr-none shadow-md'
                        : 'bg-white text-neutral-800 border border-neutral-200 rounded-tl-none shadow-md'
                    }`}
                  >
                    <div className="whitespace-pre-line leading-relaxed">{msg.content}</div>
                    <span className={`text-[9px] font-mono block text-right ${msg.role === 'user' ? 'text-black/70 font-bold' : 'text-neutral-500'}`}>
                      {msg.time}
                    </span>
                  </div>

                  {msg.role === 'user' && (
                    <img src={user.avatar} alt={user.name} className="w-8 h-8 rounded-full object-cover border-2 border-yellow-400 shrink-0 mt-0.5" />
                  )}
                </div>
              ))}

              {chatLoading && (
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-yellow-400 text-black flex items-center justify-center font-bold shrink-0 animate-bounce">
                    <Sparkles className="w-4 h-4" />
                  </div>
                  <div className="p-3.5 rounded-2xl bg-white border border-neutral-200 text-neutral-600 text-xs flex items-center gap-2">
                    <RefreshCw className="w-3.5 h-3.5 animate-spin text-yellow-600" />
                    <span>IA GFERRO analisando sua pergunta...</span>
                  </div>
                </div>
              )}

              <div ref={messagesEndRef} />
            </div>

            {/* Chat Input Bar */}
            <div className="p-4 bg-white border-t border-neutral-200 shrink-0">
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  handleSendChat();
                }}
                className="flex items-center gap-3"
              >
                <input
                  type="text"
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  placeholder="Pergunte sobre como estruturar sua sugestão ou processo..."
                  className="flex-1 px-4 py-2.5 text-xs bg-white border border-neutral-200 rounded-full text-neutral-900 placeholder-neutral-500 focus:outline-none focus:border-yellow-400 transition-all"
                />
                <button
                  type="submit"
                  disabled={!chatInput.trim() || chatLoading}
                  className="px-5 py-2.5 rounded-full bg-yellow-400 text-black font-extrabold text-xs hover:bg-yellow-300 disabled:opacity-50 transition-all flex items-center gap-2 shrink-0 active:scale-95"
                >
                  <span>Enviar</span>
                  <Send className="w-3.5 h-3.5" />
                </button>
              </form>
            </div>
          </div>
        )}

      </div>
    </div>
  );
};

