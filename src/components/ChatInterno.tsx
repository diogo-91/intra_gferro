import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AlertTriangle, FileText, Hash, Loader2, MessageSquare, Paperclip, Search, Send, User as UserIcon, X } from 'lucide-react';
import type { ChatChannel, ChatContato, ChatMessage, User } from '../types';

interface ChatInternoProps {
  user: User;
  channels: ChatChannel[];
}

interface EstadoChat {
  contatos: ChatContato[];
  mensagens: ChatMessage[];
}

export const ChatInterno: React.FC<ChatInternoProps> = ({ user, channels }) => {
  const [activeType, setActiveType] = useState<'channel' | 'dm'>('channel');
  const [activeTargetId, setActiveTargetId] = useState(channels[0]?.id ?? 'chn-geral');
  const [inputText, setInputText] = useState('');
  const [searchFilter, setSearchFilter] = useState('');
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [contatos, setContatos] = useState<ChatContato[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState('');
  const [anexo, setAnexo] = useState<File | null>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const anexoInputRef = useRef<HTMLInputElement>(null);

  const carregar = useCallback(async (silencioso = false) => {
    if (!silencioso) setCarregando(true);
    try {
      const resposta = await fetch('/api/chat-interno/estado');
      const dados = await resposta.json();
      if (!resposta.ok) throw new Error(dados.error || 'Não foi possível carregar o chat.');
      const estado = dados as EstadoChat;
      setMessages(Array.isArray(estado.mensagens) ? estado.mensagens : []);
      setContatos(Array.isArray(estado.contatos) ? estado.contatos : []);
      setErro('');
    } catch (error: any) {
      if (!silencioso) setErro(error.message || 'Não foi possível carregar o chat.');
    } finally {
      if (!silencioso) setCarregando(false);
    }
  }, []);

  useEffect(() => {
    void carregar();
    const intervalo = window.setInterval(() => void carregar(true), 3000);
    return () => window.clearInterval(intervalo);
  }, [carregar]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, activeTargetId, activeType]);

  const activeChannel = channels.find((canal) => canal.id === activeTargetId);
  const activeContato = contatos.find((contato) => contato.id === activeTargetId);
  const contatosDisponiveis = contatos.filter((contato) => contato.id !== user.id);

  const filteredMessages = useMemo(() => messages.filter((mensagem) => {
    if (activeType === 'channel') return mensagem.channelId === activeTargetId;
    return (
      (mensagem.senderId === user.id && mensagem.receiverId === activeTargetId) ||
      (mensagem.senderId === activeTargetId && mensagem.receiverId === user.id)
    );
  }), [activeTargetId, activeType, messages, user.id]);

  const enviar = async (event: React.FormEvent) => {
    event.preventDefault();
    const content = inputText.trim();
    if ((!content && !anexo) || enviando) return;
    setEnviando(true); setErro('');
    try {
      const formulario = new FormData();
      formulario.append('content', content);
      formulario.append(activeType === 'channel' ? 'channelId' : 'receiverId', activeTargetId);
      if (anexo) formulario.append('anexo', anexo);
      const resposta = await fetch('/api/chat-interno/mensagens', { method: 'POST', body: formulario });
      const mensagem = await resposta.json();
      if (!resposta.ok) throw new Error(mensagem.error || 'Não foi possível enviar a mensagem.');
      setMessages((atuais) => atuais.some((item) => item.id === mensagem.id) ? atuais : [...atuais, mensagem]);
      setInputText('');
      setAnexo(null);
      if (anexoInputRef.current) anexoInputRef.current.value = '';
    } catch (error: any) {
      setErro(error.message || 'Não foi possível enviar a mensagem.');
    } finally {
      setEnviando(false);
    }
  };

  const selecionarAnexo = (arquivo?: File) => {
    if (!arquivo) return;
    if (arquivo.size > 10 * 1024 * 1024) {
      setErro('O anexo deve ter no máximo 10 MB.');
      if (anexoInputRef.current) anexoInputRef.current.value = '';
      return;
    }
    setAnexo(arquivo); setErro('');
  };

  const busca = searchFilter.trim().toLocaleLowerCase('pt-BR');

  return <div className="space-y-6 pb-12">
    <div className="flex flex-col justify-between gap-4 rounded-[2rem] border border-neutral-200 bg-white p-6 shadow-sm sm:flex-row sm:items-center">
      <div className="space-y-1">
        <div className="flex items-center gap-2 text-xs font-extrabold uppercase tracking-widest text-yellow-600"><MessageSquare className="h-4 w-4"/>Comunicação interna</div>
        <h1 className="text-xl font-black tracking-tight text-neutral-900 sm:text-2xl">Chat Interno GFERRO</h1>
        <p className="text-xs font-medium text-neutral-500">Mensagens persistentes em canais e conversas diretas entre usuários cadastrados.</p>
      </div>
      <div className="flex items-center gap-2 rounded-full border border-neutral-200 bg-neutral-50 px-4 py-2.5"><span className="h-2.5 w-2.5 animate-pulse rounded-full bg-emerald-400"/><span className="text-xs font-bold text-neutral-900">Sincronização ativa</span></div>
    </div>

    <div className="grid h-[720px] grid-cols-1 gap-6 lg:grid-cols-12">
      <aside className="flex flex-col overflow-hidden rounded-[2rem] border border-neutral-200 bg-white p-4 shadow-sm lg:col-span-4">
        <div className="relative mb-4"><Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-500"/><input value={searchFilter} onChange={(event) => setSearchFilter(event.target.value)} placeholder="Buscar canais ou pessoas..." className="w-full rounded-full border border-neutral-200 bg-neutral-50 py-2 pl-9 pr-3 text-xs outline-none focus:border-yellow-400"/></div>
        <div className="flex-1 space-y-5 overflow-y-auto pr-1">
          <section>
            <p className="mb-2 px-2 text-[11px] font-bold uppercase tracking-widest text-neutral-500">Canais corporativos</p>
            <div className="space-y-1">{channels.filter((canal) => canal.name.toLowerCase().includes(busca)).map((canal) => {
              const ativo = activeType === 'channel' && activeTargetId === canal.id;
              return <button key={canal.id} onClick={() => { setActiveType('channel'); setActiveTargetId(canal.id); }} className={`flex w-full items-center gap-2.5 rounded-2xl p-3 text-left text-xs transition ${ativo ? 'bg-yellow-400 font-extrabold text-black' : 'text-neutral-600 hover:bg-neutral-100'}`}><Hash className="h-4 w-4 shrink-0"/><span className="truncate">{canal.name}</span></button>;
            })}</div>
          </section>
          <section>
            <p className="mb-2 px-2 text-[11px] font-bold uppercase tracking-widest text-neutral-500">Mensagens diretas</p>
            <div className="space-y-1">{contatosDisponiveis.filter((contato) => `${contato.name} ${contato.email}`.toLowerCase().includes(busca)).map((contato) => {
              const ativo = activeType === 'dm' && activeTargetId === contato.id;
              return <button key={contato.id} onClick={() => { setActiveType('dm'); setActiveTargetId(contato.id); }} className={`flex w-full items-center gap-3 rounded-2xl p-3 text-left text-xs transition ${ativo ? 'bg-yellow-400 font-extrabold text-black' : 'text-neutral-600 hover:bg-neutral-100'}`}><span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full border ${ativo ? 'border-black/30 bg-black/10' : 'border-yellow-300 bg-yellow-50'}`}><UserIcon className="h-4 w-4"/></span><span className="min-w-0"><span className="block truncate font-semibold">{contato.name}</span><span className={`block truncate text-[10px] ${ativo ? 'text-black/70' : 'text-neutral-400'}`}>{contato.email}</span></span></button>;
            })}{!carregando && contatosDisponiveis.length === 0 && <p className="px-3 py-4 text-xs text-neutral-400">Nenhum outro usuário cadastrado.</p>}</div>
          </section>
        </div>
      </aside>

      <section className="flex flex-col overflow-hidden rounded-[2rem] border border-neutral-200 bg-white shadow-sm lg:col-span-8">
        <header className="flex min-h-20 items-center gap-3 border-b border-neutral-200 bg-neutral-50 p-4">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border border-yellow-200 bg-yellow-50 text-yellow-700">{activeType === 'channel' ? <Hash className="h-5 w-5"/> : <UserIcon className="h-5 w-5"/>}</span>
          <div className="min-w-0"><h3 className="truncate text-sm font-extrabold text-neutral-900">{activeType === 'channel' ? `#${activeChannel?.name ?? 'canal'}` : activeContato?.name ?? 'Selecione um usuário'}</h3><p className="mt-0.5 truncate text-[11px] text-neutral-500">{activeType === 'channel' ? activeChannel?.description : activeContato?.email}</p></div>
        </header>

        {erro && <div className="flex items-center gap-2 border-b border-red-200 bg-red-50 px-4 py-3 text-xs text-red-700"><AlertTriangle className="h-4 w-4 shrink-0"/>{erro}</div>}
        <div className="flex-1 space-y-4 overflow-y-auto p-4 sm:p-6">
          {carregando ? <div className="flex h-full items-center justify-center gap-2 text-xs text-neutral-500"><Loader2 className="h-5 w-5 animate-spin text-yellow-600"/>Carregando mensagens...</div> : filteredMessages.length === 0 ? <div className="flex h-full flex-col items-center justify-center gap-3 p-6 text-center"><span className="rounded-full border border-yellow-200 bg-yellow-50 p-4 text-yellow-700"><MessageSquare className="h-8 w-8"/></span><h4 className="text-sm font-extrabold uppercase tracking-wider">Nenhuma mensagem ainda</h4><p className="max-w-sm text-xs text-neutral-500">Envie a primeira mensagem para iniciar a conversa.</p></div> : filteredMessages.map((mensagem) => {
            const minha = mensagem.senderId === user.id;
            return <div key={mensagem.id} className={`flex items-start gap-3 ${minha ? 'flex-row-reverse' : ''}`}><span className="mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-yellow-300 bg-yellow-50"><UserIcon className="h-4 w-4 text-yellow-700"/></span><div className={`max-w-[80%] space-y-1 ${minha ? 'text-right' : ''}`}><div className="flex items-center gap-2 text-[11px]"><span className="font-extrabold text-neutral-900">{mensagem.senderName}</span><span className="font-mono text-[10px] text-neutral-400">{mensagem.createdAt ? new Date(mensagem.createdAt).toLocaleString('pt-BR') : mensagem.timestamp}</span></div><div className={`rounded-2xl p-3.5 text-left text-xs leading-relaxed ${minha ? 'rounded-tr-none bg-yellow-400 font-medium text-black' : 'rounded-tl-none border border-neutral-200 bg-neutral-50 text-neutral-800'}`}>{mensagem.content && <p className="whitespace-pre-wrap break-words">{mensagem.content}</p>}{mensagem.attachments?.map((arquivo) => <a key={arquivo.url} href={arquivo.url} target="_blank" rel="noreferrer" className={`mt-2 flex items-center gap-2 rounded-xl border p-2.5 font-bold underline-offset-2 hover:underline ${minha ? 'border-black/15 bg-black/10' : 'border-neutral-200 bg-white text-yellow-700'}`}><FileText className="h-4 w-4 shrink-0"/><span className="min-w-0 flex-1 truncate">{arquivo.name}</span><span className="shrink-0 text-[10px] font-normal opacity-70">{arquivo.size}</span></a>)}</div></div></div>;
          })}<div ref={chatEndRef}/>
        </div>

        {anexo && <div className="flex items-center gap-2 border-t border-yellow-200 bg-yellow-50 px-4 py-2.5 text-xs text-yellow-900"><FileText className="h-4 w-4 shrink-0"/><span className="min-w-0 flex-1 truncate font-bold">{anexo.name}</span><span className="shrink-0 text-[10px]">{(anexo.size / 1024 / 1024).toFixed(1)} MB</span><button type="button" onClick={() => { setAnexo(null); if (anexoInputRef.current) anexoInputRef.current.value = ''; }} aria-label="Remover anexo" className="rounded-full p-1 hover:bg-yellow-100"><X className="h-4 w-4"/></button></div>}
        <form onSubmit={enviar} className="flex items-center gap-3 border-t border-neutral-200 bg-neutral-50 p-4"><input ref={anexoInputRef} type="file" className="hidden" accept=".pdf,.png,.jpg,.jpeg,.webp,.doc,.docx,.xls,.xlsx,.csv,.txt,.zip,.dwg" onChange={(event) => selecionarAnexo(event.target.files?.[0])}/><button type="button" onClick={() => anexoInputRef.current?.click()} disabled={enviando || (activeType === 'dm' && !activeContato)} title="Anexar arquivo (máximo 10 MB)" className="rounded-full border border-neutral-200 bg-white p-3 text-neutral-500 transition hover:border-yellow-400 hover:text-yellow-700 disabled:opacity-40"><Paperclip className="h-4 w-4"/></button><input value={inputText} onChange={(event) => setInputText(event.target.value)} disabled={activeType === 'dm' && !activeContato} maxLength={4000} placeholder={activeType === 'channel' ? `Enviar mensagem no #${activeChannel?.name ?? 'canal'}...` : activeContato ? `Conversar com ${activeContato.name}...` : 'Selecione um usuário...'} className="flex-1 rounded-full border border-neutral-200 bg-white px-5 py-3 text-xs outline-none focus:border-yellow-400 disabled:bg-neutral-100"/><button type="submit" disabled={(!inputText.trim() && !anexo) || enviando || (activeType === 'dm' && !activeContato)} className="rounded-full bg-yellow-400 p-3 text-black shadow-lg shadow-yellow-400/20 transition hover:bg-yellow-300 disabled:opacity-40">{enviando ? <Loader2 className="h-4 w-4 animate-spin"/> : <Send className="h-4 w-4"/>}</button></form>
      </section>
    </div>
  </div>;
};
