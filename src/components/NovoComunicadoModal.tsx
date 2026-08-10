import React, { useState } from 'react';
import { X, Newspaper, Sparkles, Send } from 'lucide-react';
import { Comunicado, User } from '../types';

interface NovoComunicadoModalProps {
  user: User;
  isOpen: boolean;
  onClose: () => void;
  onAddComunicado: (comunicado: Omit<Comunicado, 'id' | 'date' | 'likes' | 'commentsCount'>) => void;
}

export const NovoComunicadoModal: React.FC<NovoComunicadoModalProps> = ({
  user,
  isOpen,
  onClose,
  onAddComunicado,
}) => {
  const [title, setTitle] = useState('');
  const [summary, setSummary] = useState('');
  const [content, setContent] = useState('');
  const [category, setCategory] = useState<'Institucional' | 'Segurança' | 'Eventos' | 'Operações' | 'Recursos Humanos'>('Institucional');
  const [pinned, setPinned] = useState(false);
  const [image, setImage] = useState('https://images.unsplash.com/photo-1504307651254-35680f356dfd?auto=format&fit=crop&q=80&w=1200');
  const [tagsInput, setTagsInput] = useState('GFERRO, Comunicação, Notícias');
  const [aiDrafting, setAiDrafting] = useState(false);

  if (!isOpen) return null;

  const handleAIDraft = async () => {
    if (!title.trim()) {
      alert('Digite ao menos o título do comunicado para que a IA possa gerar o rascunho.');
      return;
    }

    setAiDrafting(true);
    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: `Redija um comunicado corporativo completo e profissional em português para a empresa GFERRO Siderurgia sobre o seguinte assunto/título: "${title}".
Por favor, forneça o texto dividido em duas seções claras:
1) Um resumo curto (1 frase)
2) O texto completo bem detalhado com tópicos e diretrizes.`,
        }),
      });

      const data = await res.json();
      if (data.reply) {
        setContent(data.reply);
        setSummary(title);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setAiDrafting(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !content.trim()) return;

    const tags = tagsInput.split(',').map((t) => t.trim()).filter(Boolean);

    onAddComunicado({
      title,
      summary: summary || title,
      content,
      category,
      pinned,
      image,
      author: {
        name: user.name,
        role: user.role,
        avatar: user.avatar,
      },
      tags,
    });

    setTitle('');
    setSummary('');
    setContent('');
    onClose();
    alert('Comunicado publicado no feed corporativo da GFERRO!');
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
      <div className="bg-white border border-neutral-200 rounded-[2rem] w-full max-w-xl p-6 sm:p-8 space-y-5 shadow-2xl overflow-y-auto max-h-[90vh]">
        <div className="flex items-center justify-between border-b border-neutral-200 pb-4">
          <h2 className="text-base font-extrabold text-neutral-900 uppercase tracking-wider flex items-center gap-2">
            <Newspaper className="w-5 h-5 text-yellow-600" />
            Publicar Novo Comunicado Interno
          </h2>
          <button onClick={onClose} className="p-2 rounded-full text-neutral-500 hover:text-yellow-600 hover:bg-neutral-100 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 text-xs">
          <div>
            <label className="block text-neutral-600 font-semibold mb-1.5">Título da Notícia *</label>
            <input
              type="text"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Ex: Treinamento Especial de Segurança NR-12 no Galpão 3"
              className="w-full px-4 py-2.5 bg-white border border-neutral-200 rounded-full text-neutral-900 placeholder-neutral-500 focus:outline-none focus:border-yellow-400 transition-all"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-neutral-600 font-semibold mb-1.5">Categoria *</label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value as any)}
                className="w-full px-4 py-2.5 bg-white border border-neutral-200 rounded-full text-neutral-900 focus:outline-none focus:border-yellow-400 transition-all"
              >
                <option value="Institucional">Institucional</option>
                <option value="Segurança">Segurança</option>
                <option value="Operações">Operações</option>
                <option value="Recursos Humanos">Recursos Humanos</option>
                <option value="Eventos">Eventos</option>
              </select>
            </div>

            <div className="flex items-end pb-1">
              <label className="flex items-center gap-2 text-neutral-600 font-semibold cursor-pointer">
                <input
                  type="checkbox"
                  checked={pinned}
                  onChange={(e) => setPinned(e.target.checked)}
                  className="w-4 h-4 rounded text-yellow-400 bg-white border-neutral-200 focus:ring-yellow-400"
                />
                <span>Fixar no topo do feed (Pinned)</span>
              </label>
            </div>
          </div>

          <div>
            <label className="block text-neutral-600 font-semibold mb-1.5">Resumo Executivo Curto</label>
            <input
              type="text"
              value={summary}
              onChange={(e) => setSummary(e.target.value)}
              placeholder="Breve resumo impresso nos cards do feed..."
              className="w-full px-4 py-2.5 bg-white border border-neutral-200 rounded-full text-neutral-900 placeholder-neutral-500 focus:outline-none focus:border-yellow-400 transition-all"
            />
          </div>

          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-neutral-600 font-semibold">Conteúdo Completo *</label>
              <button
                type="button"
                onClick={handleAIDraft}
                disabled={aiDrafting}
                className="text-xs font-bold text-yellow-600 hover:underline flex items-center gap-1 transition-colors"
              >
                <Sparkles className="w-3.5 h-3.5 text-yellow-600" />
                <span>{aiDrafting ? 'Gerando rascunho...' : 'Gerar Rascunho com IA'}</span>
              </button>
            </div>
            <textarea
              required
              rows={5}
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="Escreva a mensagem oficial..."
              className="w-full p-4 bg-white border border-neutral-200 rounded-2xl text-neutral-900 placeholder-neutral-500 focus:outline-none focus:border-yellow-400 transition-all"
            />
          </div>

          <div>
            <label className="block text-neutral-600 font-semibold mb-1.5">URL da Imagem de Capa</label>
            <input
              type="text"
              value={image}
              onChange={(e) => setImage(e.target.value)}
              className="w-full px-4 py-2.5 bg-white border border-neutral-200 rounded-full text-neutral-900 placeholder-neutral-500 focus:outline-none focus:border-yellow-400 font-mono text-[11px] transition-all"
            />
          </div>

          <div>
            <label className="block text-neutral-600 font-semibold mb-1.5">Tags (separadas por vírgula)</label>
            <input
              type="text"
              value={tagsInput}
              onChange={(e) => setTagsInput(e.target.value)}
              placeholder="Segurança, CIPA, Galpão A"
              className="w-full px-4 py-2.5 bg-white border border-neutral-200 rounded-full text-neutral-900 placeholder-neutral-500 focus:outline-none focus:border-yellow-400 transition-all"
            />
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-neutral-200">
            <button
              type="button"
              onClick={onClose}
              className="px-5 py-2.5 rounded-full bg-neutral-100 text-neutral-600 font-bold hover:bg-neutral-200 transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="px-6 py-2.5 rounded-full bg-yellow-400 text-black font-extrabold hover:bg-yellow-300 flex items-center gap-2 transition-all active:scale-95"
            >
              <Send className="w-3.5 h-3.5" />
              <span>Publicar Comunicado</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
