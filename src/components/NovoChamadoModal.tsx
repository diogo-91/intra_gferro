import React, { useEffect, useMemo, useState } from 'react';
import { X, LifeBuoy, Send, Loader2 } from 'lucide-react';
import { Chamado, Department, User } from '../types';

interface Props { user: User; isOpen: boolean; onClose: () => void; departments: Department[]; initialDepartmentId?: string; onCreated: (chamado: Chamado) => void; }
const CATEGORIAS: Record<string, string[]> = {
  'dep-com': ['Apoio comercial', 'Cadastro / proposta', 'Pedido', 'Outro'],
  'dep-rh': ['Holerite / ponto', 'Férias', 'Benefícios', 'Documento / declaração', 'EPI / segurança', 'Outro'],
  'dep-sac': ['Atendimento ao cliente', 'Troca / devolução', 'Pós-venda', 'Outro'],
  'dep-pcp': ['Programação de produção', 'Ordem de produção', 'Prazo', 'Outro'],
  'dep-producao': ['Manutenção', 'Material / insumo', 'Qualidade', 'Segurança', 'Outro'],
  'dep-tecnologia': ['Sistema / ERP', 'Computador / periférico', 'Rede / internet', 'Acesso / senha', 'Telefonia', 'Outro'],
};

export const NovoChamadoModal: React.FC<Props> = ({ user, isOpen, onClose, departments, initialDepartmentId, onCreated }) => {
  const [departamentoId, setDepartamentoId] = useState('');
  const [categoria, setCategoria] = useState('');
  const [assunto, setAssunto] = useState('');
  const [descricao, setDescricao] = useState('');
  const [prioridade, setPrioridade] = useState<Chamado['prioridade']>('Média');
  const [contato, setContato] = useState(''); const [local, setLocal] = useState(''); const [patrimonio, setPatrimonio] = useState('');
  const [impacto, setImpacto] = useState(''); const [dataDesejada, setDataDesejada] = useState('');
  const [enviando, setEnviando] = useState(false); const [erro, setErro] = useState('');
  useEffect(() => { if (!isOpen) return; const id = initialDepartmentId && departments.some((d) => d.id === initialDepartmentId) ? initialDepartmentId : departments[0]?.id || ''; setDepartamentoId(id); setCategoria(CATEGORIAS[id]?.[0] || 'Solicitação geral'); }, [isOpen, initialDepartmentId, departments]);
  const departamento = departments.find((item) => item.id === departamentoId);
  const categorias = useMemo(() => CATEGORIAS[departamentoId] || ['Solicitação geral', 'Outro'], [departamentoId]);
  if (!isOpen) return null;
  const input = 'w-full px-4 py-2.5 bg-white border border-neutral-200 rounded-xl text-neutral-900 placeholder-neutral-400 focus:outline-none focus:border-yellow-400';
  const enviar = async (e: React.FormEvent) => { e.preventDefault(); if (!departamento) return; setEnviando(true); setErro(''); try { const res = await fetch('/api/chamados', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ departamentoId, departamentoNome: departamento.name, categoria, assunto, descricao, prioridade, contato, local, patrimonio, impacto, dataDesejada, solicitanteDepartamento: user.department }) }); const dados = await res.json(); if (!res.ok) throw new Error(dados.error || 'Não foi possível abrir o chamado.'); onCreated(dados); onClose(); setAssunto(''); setDescricao(''); setContato(''); setLocal(''); setPatrimonio(''); setImpacto(''); setDataDesejada(''); } catch (error: any) { setErro(error.message); } finally { setEnviando(false); } };
  return <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4"><div className="bg-white rounded-[2rem] w-full max-w-3xl max-h-[92vh] overflow-y-auto shadow-2xl">
    <div className="sticky top-0 z-10 bg-white flex items-center justify-between border-b border-neutral-200 px-6 py-5 rounded-t-[2rem]"><div><h2 className="font-black text-neutral-900 flex items-center gap-2"><LifeBuoy className="w-5 h-5 text-yellow-600"/>Abrir novo chamado</h2><p className="text-xs text-neutral-500 mt-1">Descreva a necessidade para encaminharmos ao departamento correto.</p></div><button onClick={onClose} className="p-2 rounded-full hover:bg-neutral-100"><X className="w-5 h-5"/></button></div>
    <form onSubmit={enviar} className="p-6 space-y-5 text-sm">{erro && <div className="rounded-xl bg-red-50 border border-red-200 text-red-700 p-3 text-xs font-semibold">{erro}</div>}
      <div className="grid sm:grid-cols-2 gap-4"><label className="font-bold text-xs text-neutral-600">Departamento responsável *<select required className={`${input} mt-2`} value={departamentoId} onChange={(e)=>{setDepartamentoId(e.target.value); setCategoria(CATEGORIAS[e.target.value]?.[0] || 'Solicitação geral');}}>{departments.map((d)=><option key={d.id} value={d.id}>{d.name}</option>)}</select></label><label className="font-bold text-xs text-neutral-600">Categoria *<select required className={`${input} mt-2`} value={categoria} onChange={(e)=>setCategoria(e.target.value)}>{categorias.map((c)=><option key={c}>{c}</option>)}</select></label></div>
      <label className="block font-bold text-xs text-neutral-600">Assunto *<input required maxLength={180} className={`${input} mt-2`} value={assunto} onChange={(e)=>setAssunto(e.target.value)} placeholder="Resumo objetivo da solicitação"/></label>
      <label className="block font-bold text-xs text-neutral-600">Descrição detalhada *<textarea required rows={5} className={`${input} mt-2 resize-y`} value={descricao} onChange={(e)=>setDescricao(e.target.value)} placeholder="O que aconteceu, desde quando e o que você precisa?"/></label>
      <div><span className="font-bold text-xs text-neutral-600">Prioridade *</span><div className="grid grid-cols-4 gap-2 mt-2">{(['Baixa','Média','Alta','Urgente'] as const).map((p)=><button type="button" key={p} onClick={()=>setPrioridade(p)} className={`py-2 rounded-xl border text-xs font-bold ${prioridade===p?'bg-yellow-400 border-yellow-400 text-black':'border-neutral-200 text-neutral-500'}`}>{p}</button>)}</div></div>
      <div className="grid sm:grid-cols-2 gap-4"><label className="font-bold text-xs text-neutral-600">Local / unidade<input className={`${input} mt-2`} value={local} onChange={(e)=>setLocal(e.target.value)} placeholder="Ex.: Administrativo, fábrica"/></label><label className="font-bold text-xs text-neutral-600">Patrimônio / equipamento<input className={`${input} mt-2`} value={patrimonio} onChange={(e)=>setPatrimonio(e.target.value)} placeholder="Código, máquina ou computador"/></label><label className="font-bold text-xs text-neutral-600">Contato<input className={`${input} mt-2`} value={contato} onChange={(e)=>setContato(e.target.value)} placeholder="Ramal ou WhatsApp"/></label><label className="font-bold text-xs text-neutral-600">Data desejada<input type="date" className={`${input} mt-2`} value={dataDesejada} onChange={(e)=>setDataDesejada(e.target.value)}/></label></div>
      <label className="block font-bold text-xs text-neutral-600">Impacto no trabalho<textarea rows={2} className={`${input} mt-2 resize-y`} value={impacto} onChange={(e)=>setImpacto(e.target.value)} placeholder="Quantas pessoas ou atividades estão afetadas?"/></label>
      <div className="flex justify-end gap-3 pt-4 border-t"><button type="button" onClick={onClose} className="px-5 py-2.5 rounded-full bg-neutral-100 font-bold text-neutral-600">Cancelar</button><button disabled={enviando} className="px-6 py-2.5 rounded-full bg-yellow-400 text-black font-black flex items-center gap-2 disabled:opacity-60">{enviando?<Loader2 className="w-4 h-4 animate-spin"/>:<Send className="w-4 h-4"/>}Enviar chamado</button></div>
    </form>
  </div></div>;
};
