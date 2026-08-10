import React, { useState } from 'react';
import { X, LifeBuoy, Send } from 'lucide-react';
import { Chamado, User } from '../types';

interface NovoChamadoModalProps {
  user: User;
  isOpen: boolean;
  onClose: () => void;
  onAddChamado: (chamado: Omit<Chamado, 'id' | 'protocol' | 'status' | 'createdAt' | 'updatedAt'>) => void;
}

export const NovoChamadoModal: React.FC<NovoChamadoModalProps> = ({
  user,
  isOpen,
  onClose,
  onAddChamado,
}) => {
  const [type, setType] = useState<Chamado['type']>('EPI / Segurança');
  const [subject, setSubject] = useState('');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState<Chamado['priority']>('Média');

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!subject.trim() || !description.trim()) return;

    onAddChamado({
      type,
      subject,
      description,
      priority,
      requesterName: user.name,
      requesterDepartment: user.department,
    });

    setSubject('');
    setDescription('');
    onClose();
    alert('Chamado aberto com sucesso no Portal de Serviços GFERRO!');
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
      <div className="bg-white border border-neutral-200 rounded-[2rem] w-full max-w-lg p-6 sm:p-8 space-y-5 shadow-2xl">
        <div className="flex items-center justify-between border-b border-neutral-200 pb-4">
          <h2 className="text-base font-extrabold text-neutral-900 uppercase tracking-wider flex items-center gap-2">
            <LifeBuoy className="w-5 h-5 text-yellow-600" />
            Abrir Chamado / Solicitação
          </h2>
          <button onClick={onClose} className="p-2 rounded-full text-neutral-500 hover:text-yellow-600 hover:bg-neutral-100 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 text-xs">
          <div>
            <label className="block text-neutral-600 font-semibold mb-1.5">Tipo de Serviço *</label>
            <select
              value={type}
              onChange={(e) => setType(e.target.value as any)}
              className="w-full px-4 py-2.5 bg-white border border-neutral-200 rounded-full text-neutral-900 focus:outline-none focus:border-yellow-400 transition-all"
            >
              <option value="EPI / Segurança">EPI / Substituição de Segurança</option>
              <option value="RH / Holerite">RH / Holerite / Declarações</option>
              <option value="Suporte TI">Suporte TI / Sistemas / Ramal</option>
              <option value="Manutenção Predial">Manutenção Predial / Fábrica</option>
              <option value="Reembolso">Reembolso de Despesas</option>
              <option value="Férias">Requerimento de Férias</option>
            </select>
          </div>

          <div>
            <label className="block text-neutral-600 font-semibold mb-1.5">Assunto / Resumo *</label>
            <input
              type="text"
              required
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="Ex: Troca de bota com biqueira de aço tamanho 42"
              className="w-full px-4 py-2.5 bg-white border border-neutral-200 rounded-full text-neutral-900 placeholder-neutral-500 focus:outline-none focus:border-yellow-400 transition-all"
            />
          </div>

          <div>
            <label className="block text-neutral-600 font-semibold mb-1.5">Prioridade *</label>
            <div className="flex gap-2">
              {(['Baixa', 'Média', 'Alta', 'Urgente'] as const).map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => setPriority(p)}
                  className={`flex-1 py-2 rounded-full border font-bold text-xs transition-all ${
                    priority === p
                      ? 'bg-yellow-400 text-black border-yellow-400 shadow-md shadow-yellow-400/20'
                      : 'bg-white text-neutral-500 border-neutral-200 hover:text-neutral-900'
                  }`}
                >
                  {p}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-neutral-600 font-semibold mb-1.5">Descrição Detalhada *</label>
            <textarea
              required
              rows={4}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Forneça os detalhes necessários (ex: código do item, ramal, setor, data desejada)..."
              className="w-full p-4 bg-white border border-neutral-200 rounded-2xl text-neutral-900 placeholder-neutral-500 focus:outline-none focus:border-yellow-400 transition-all"
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
              <span>Enviar Chamado</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
