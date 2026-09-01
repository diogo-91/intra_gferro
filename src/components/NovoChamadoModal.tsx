import React, { useEffect, useState } from 'react';
import { X, LifeBuoy, Send, Loader2 } from 'lucide-react';
import { Chamado, Department, User } from '../types';

interface Props { user: User; isOpen: boolean; onClose: () => void; departments: Department[]; initialDepartmentId?: string; onCreated: (chamado: Chamado) => void; }

export const NovoChamadoModal: React.FC<Props> = ({ user, isOpen, onClose, departments, initialDepartmentId, onCreated }) => {
  const [departamentoId, setDepartamentoId] = useState('');
  const [assunto, setAssunto] = useState('');
  const [descricao, setDescricao] = useState('');
  const [enviando, setEnviando] = useState(false); const [erro, setErro] = useState('');
  useEffect(() => { if (!isOpen) return; const id = initialDepartmentId && departments.some((d) => d.id === initialDepartmentId) ? initialDepartmentId : departments[0]?.id || ''; setDepartamentoId(id); }, [isOpen, initialDepartmentId, departments]);
  const departamento = departments.find((item) => item.id === departamentoId);
  if (!isOpen) return null;
  const input = 'w-full px-4 py-2.5 bg-white border border-neutral-200 rounded-xl text-neutral-900 placeholder-neutral-400 focus:outline-none focus:border-yellow-400';
  const enviar = async (e: React.FormEvent) => { e.preventDefault(); if (!departamento) return; setEnviando(true); setErro(''); try { const res = await fetch('/api/chamados', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ departamentoId, departamentoNome: departamento.name, categoria: 'Solicitação geral', assunto, descricao, prioridade: 'Média', solicitanteDepartamento: user.department }) }); const dados = await res.json(); if (!res.ok) throw new Error(dados.error || 'Não foi possível abrir o chamado.'); onCreated(dados); onClose(); setAssunto(''); setDescricao(''); } catch (error: any) { setErro(error.message); } finally { setEnviando(false); } };
  return <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4"><div className="bg-white rounded-[2rem] w-full max-w-lg max-h-[92vh] overflow-y-auto shadow-2xl">
    <div className="sticky top-0 z-10 bg-white flex items-center justify-between border-b border-neutral-200 px-6 py-5 rounded-t-[2rem]"><div><h2 className="font-black text-neutral-900 flex items-center gap-2"><LifeBuoy className="w-5 h-5 text-yellow-600"/>Abrir novo chamado</h2><p className="text-xs text-neutral-500 mt-1">Descreva a necessidade para encaminharmos ao departamento correto.</p></div><button onClick={onClose} className="p-2 rounded-full hover:bg-neutral-100"><X className="w-5 h-5"/></button></div>
    <form onSubmit={enviar} className="p-6 space-y-5 text-sm">{erro && <div className="rounded-xl bg-red-50 border border-red-200 text-red-700 p-3 text-xs font-semibold">{erro}</div>}
      <label className="block font-bold text-xs text-neutral-600">Departamento responsável *<select required className={`${input} mt-2`} value={departamentoId} onChange={(e)=>setDepartamentoId(e.target.value)}>{departments.map((d)=><option key={d.id} value={d.id}>{d.name}</option>)}</select></label>
      <label className="block font-bold text-xs text-neutral-600">Assunto *<input required maxLength={180} className={`${input} mt-2`} value={assunto} onChange={(e)=>setAssunto(e.target.value)} placeholder="Resumo objetivo da solicitação"/></label>
      <label className="block font-bold text-xs text-neutral-600">Descrição detalhada *<textarea required rows={5} className={`${input} mt-2 resize-y`} value={descricao} onChange={(e)=>setDescricao(e.target.value)} placeholder="O que aconteceu, desde quando e o que você precisa?"/></label>
      <div className="flex justify-end gap-3 pt-4 border-t"><button type="button" onClick={onClose} className="px-5 py-2.5 rounded-full bg-neutral-100 font-bold text-neutral-600">Cancelar</button><button disabled={enviando} className="px-6 py-2.5 rounded-full bg-yellow-400 text-black font-black flex items-center gap-2 disabled:opacity-60">{enviando?<Loader2 className="w-4 h-4 animate-spin"/>:<Send className="w-4 h-4"/>}Enviar chamado</button></div>
    </form>
  </div></div>;
};
