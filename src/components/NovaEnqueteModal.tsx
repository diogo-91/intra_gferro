import React, { useState } from 'react';
import { X, Vote, Send, Plus, Trash2, AlertTriangle } from 'lucide-react';
import { Enquete } from '../types';

interface NovaEnqueteModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCriada: (enquete: Enquete) => void;
}

const MAX_OPCOES = 6;

export const NovaEnqueteModal: React.FC<NovaEnqueteModalProps> = ({ isOpen, onClose, onCriada }) => {
  const [pergunta, setPergunta] = useState('');
  const [opcoes, setOpcoes] = useState(['', '']);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  if (!isOpen) return null;

  function resetar() {
    setPergunta('');
    setOpcoes(['', '']);
    setErro(null);
  }

  function fechar() {
    resetar();
    onClose();
  }

  function atualizarOpcao(indice: number, valor: string) {
    setOpcoes((prev) => prev.map((o, i) => (i === indice ? valor : o)));
  }

  function adicionarOpcao() {
    setOpcoes((prev) => (prev.length < MAX_OPCOES ? [...prev, ''] : prev));
  }

  function removerOpcao(indice: number) {
    setOpcoes((prev) => (prev.length > 2 ? prev.filter((_, i) => i !== indice) : prev));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const opcoesValidas = opcoes.map((o) => o.trim()).filter(Boolean);
    if (opcoesValidas.length < 2) {
      setErro('Informe pelo menos 2 opções.');
      return;
    }
    setSalvando(true);
    setErro(null);
    try {
      const res = await fetch('/api/enquetes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pergunta, opcoes: opcoesValidas }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || 'Falha ao publicar enquete.');
      onCriada(data);
      resetar();
      onClose();
    } catch (err: any) {
      setErro(err.message || 'Falha ao publicar enquete.');
    } finally {
      setSalvando(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4" onClick={fechar}>
      <div
        className="bg-white border border-neutral-200 rounded-[2rem] w-full max-w-lg p-6 sm:p-8 space-y-5 shadow-2xl max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-neutral-200 pb-4">
          <h2 className="text-base font-extrabold text-neutral-900 uppercase tracking-wider flex items-center gap-2">
            <Vote className="w-5 h-5 text-yellow-600" aria-hidden="true" />
            Nova Enquete
          </h2>
          <button
            type="button"
            onClick={fechar}
            className="p-2 rounded-full text-neutral-500 hover:text-yellow-600 hover:bg-neutral-100 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <p className="text-xs text-neutral-500">
          Publicar uma nova enquete substitui a "Enquete da Semana" atual no Dashboard e zera os votos.
        </p>

        <form onSubmit={handleSubmit} className="space-y-4 text-xs">
          <div>
            <label className="block text-neutral-600 font-semibold mb-1.5">Pergunta *</label>
            <input
              type="text"
              required
              value={pergunta}
              onChange={(e) => setPergunta(e.target.value)}
              placeholder="Ex: Qual tema você prefere para o próximo treinamento?"
              className="w-full px-4 py-2.5 bg-white border border-neutral-200 rounded-full text-neutral-900 placeholder-neutral-500 focus:outline-none focus:border-yellow-400 transition-all"
            />
          </div>

          <div className="space-y-2.5">
            <label className="block text-neutral-600 font-semibold">Opções * (mínimo 2)</label>
            {opcoes.map((opcao, indice) => (
              <div key={indice} className="flex items-center gap-2">
                <input
                  type="text"
                  value={opcao}
                  onChange={(e) => atualizarOpcao(indice, e.target.value)}
                  placeholder={`Opção ${indice + 1}`}
                  className="flex-1 px-4 py-2.5 bg-white border border-neutral-200 rounded-full text-neutral-900 placeholder-neutral-500 focus:outline-none focus:border-yellow-400 transition-all"
                />
                <button
                  type="button"
                  onClick={() => removerOpcao(indice)}
                  disabled={opcoes.length <= 2}
                  title="Remover opção"
                  className="w-9 h-9 shrink-0 flex items-center justify-center rounded-full bg-neutral-50 border border-neutral-200 text-neutral-400 hover:text-red-600 hover:bg-red-50 disabled:opacity-30 disabled:hover:text-neutral-400 disabled:hover:bg-neutral-50 transition-colors"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}

            {opcoes.length < MAX_OPCOES && (
              <button
                type="button"
                onClick={adicionarOpcao}
                className="flex items-center gap-1.5 px-3.5 py-2 rounded-full border border-neutral-200 bg-white text-xs font-bold text-neutral-600 hover:border-yellow-400 hover:text-yellow-600 transition-all"
              >
                <Plus className="w-3.5 h-3.5" aria-hidden="true" />
                Adicionar opção
              </button>
            )}
          </div>

          {erro && (
            <div className="flex items-center gap-2 text-xs text-red-600 bg-red-50 border border-red-200 rounded-2xl p-3">
              <AlertTriangle className="w-4 h-4 shrink-0" aria-hidden="true" />
              <span>{erro}</span>
            </div>
          )}

          <div className="flex justify-end gap-3 pt-4 border-t border-neutral-200">
            <button
              type="button"
              onClick={fechar}
              className="px-5 py-2.5 rounded-full bg-neutral-100 text-neutral-600 font-bold hover:bg-neutral-200 transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={salvando}
              className="px-6 py-2.5 rounded-full bg-yellow-400 text-black font-extrabold hover:bg-yellow-300 flex items-center gap-2 transition-all active:scale-95 disabled:opacity-50"
            >
              <Send className="w-3.5 h-3.5" aria-hidden="true" />
              <span>{salvando ? 'Publicando...' : 'Publicar Enquete'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
