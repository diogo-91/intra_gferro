import React, { useEffect, useMemo, useState } from 'react';
import { Chamado, User } from '../types';
import { LifeBuoy, Plus, Search, Loader2, Inbox, Clock3, CheckCircle2, AlertCircle } from 'lucide-react';
import { ChamadoDetalhe } from './ChamadoDetalhe';
import { ChamadosKanban } from './ChamadosKanban';

interface Props { user: User; onOpenNewChamado: () => void; refreshKey: number; }
export const ServicosRH: React.FC<Props> = ({ onOpenNewChamado, refreshKey }) => {
  const [chamados,setChamados]=useState<Chamado[]>([]); const [selecionado,setSelecionado]=useState<Chamado|null>(null); const [busca,setBusca]=useState(''); const [carregando,setCarregando]=useState(true); const [erro,setErro]=useState('');
  useEffect(()=>{setCarregando(true);setErro('');fetch('/api/chamados').then(async r=>{const d=await r.json();if(!r.ok)throw new Error(d.error);setChamados(d)}).catch(e=>setErro(e.message)).finally(()=>setCarregando(false));},[refreshKey]);
  const filtrados=useMemo(()=>chamados.filter(c=>{const q=busca.toLowerCase();return !q||`${c.protocolo} ${c.assunto} ${c.departamentoNome} ${c.descricao}`.toLowerCase().includes(q);}),[chamados,busca]);
  const atualizar=(c:Chamado)=>{setChamados(v=>v.map(i=>i.id===c.id?c:i));setSelecionado(c)};
  return <div className="space-y-4 sm:space-y-6 pb-8 sm:pb-12"><div className="bg-neutral-900 text-white p-4 sm:p-6 rounded-2xl sm:rounded-[2rem] flex flex-col sm:flex-row sm:items-center justify-between gap-4"><div><h1 className="text-xl sm:text-2xl font-black flex items-center gap-2"><LifeBuoy className="text-yellow-400 shrink-0"/>Central de chamados</h1><p className="text-xs text-neutral-400 mt-2">Abra solicitações e acompanhe cada atualização até a conclusão.</p></div><button onClick={onOpenNewChamado} className="min-h-11 w-full sm:w-auto justify-center px-5 py-3 rounded-full bg-yellow-400 text-black font-black text-sm flex items-center gap-2"><Plus className="w-4 h-4"/>Abrir chamado</button></div>
    <div className="grid grid-cols-3 gap-2 sm:gap-3"><Resumo icon={Inbox} label="Total" valor={chamados.length}/><Resumo icon={Clock3} label="Em andamento" valor={chamados.filter(c=>!['Encerrado','Cancelado'].includes(c.status)).length}/><Resumo icon={CheckCircle2} label="Encerrados" valor={chamados.filter(c=>c.status==='Encerrado').length}/></div>
    <div className="bg-white border rounded-2xl p-3 sm:p-4"><div className="relative"><Search className="absolute left-3 top-3.5 w-4 h-4 text-neutral-400"/><input className="w-full min-h-11 border rounded-xl pl-9 pr-3 py-2.5 text-base sm:text-xs outline-none focus:border-yellow-400" value={busca} onChange={e=>setBusca(e.target.value)} placeholder="Buscar protocolo, assunto ou departamento"/></div></div>
    {erro&&<div className="p-4 bg-red-50 text-red-700 rounded-xl text-xs flex gap-2"><AlertCircle className="w-4 h-4"/>{erro}</div>}{carregando?<div className="p-16 flex justify-center"><Loader2 className="animate-spin"/></div>:<ChamadosKanban chamados={filtrados} onSelect={setSelecionado} mostrarDepartamento/>}
    {selecionado&&<ChamadoDetalhe chamado={selecionado} podeAtender={false} onClose={()=>setSelecionado(null)} onUpdated={atualizar}/>}</div>;
};
const Resumo=({icon:Icon,label,valor}:{icon:any;label:string;valor:number})=><div className="min-w-0 bg-white border rounded-xl sm:rounded-2xl p-2.5 sm:p-4 flex flex-col sm:flex-row gap-1.5 sm:gap-3 items-center text-center sm:text-left"><div className="p-1.5 sm:p-2 bg-yellow-50 rounded-xl"><Icon className="w-4 h-4 sm:w-5 sm:h-5 text-yellow-600"/></div><div className="min-w-0"><p className="text-lg sm:text-2xl font-black">{valor}</p><p className="truncate text-[8px] sm:text-[10px] uppercase font-bold text-neutral-400">{label}</p></div></div>;
