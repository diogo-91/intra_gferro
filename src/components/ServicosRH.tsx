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
  return <div className="space-y-6 pb-12"><div className="bg-neutral-900 text-white p-6 rounded-[2rem] flex flex-col sm:flex-row sm:items-center justify-between gap-4"><div><h1 className="text-2xl font-black flex items-center gap-2"><LifeBuoy className="text-yellow-400"/>Central de chamados</h1><p className="text-xs text-neutral-400 mt-2">Abra solicitações e acompanhe cada atualização até a conclusão.</p></div><button onClick={onOpenNewChamado} className="px-5 py-3 rounded-full bg-yellow-400 text-black font-black text-sm flex items-center gap-2"><Plus className="w-4 h-4"/>Abrir chamado</button></div>
    <div className="grid sm:grid-cols-3 gap-3"><Resumo icon={Inbox} label="Total" valor={chamados.length}/><Resumo icon={Clock3} label="Em andamento" valor={chamados.filter(c=>!['Encerrado','Cancelado'].includes(c.status)).length}/><Resumo icon={CheckCircle2} label="Encerrados" valor={chamados.filter(c=>c.status==='Encerrado').length}/></div>
    <div className="bg-white border rounded-2xl p-4"><div className="relative"><Search className="absolute left-3 top-3 w-4 h-4 text-neutral-400"/><input className="w-full border rounded-xl pl-9 pr-3 py-2.5 text-xs outline-none focus:border-yellow-400" value={busca} onChange={e=>setBusca(e.target.value)} placeholder="Buscar protocolo, assunto ou departamento"/></div></div>
    {erro&&<div className="p-4 bg-red-50 text-red-700 rounded-xl text-xs flex gap-2"><AlertCircle className="w-4 h-4"/>{erro}</div>}{carregando?<div className="p-16 flex justify-center"><Loader2 className="animate-spin"/></div>:<ChamadosKanban chamados={filtrados} onSelect={setSelecionado} mostrarDepartamento/>}
    {selecionado&&<ChamadoDetalhe chamado={selecionado} podeAtender={false} onClose={()=>setSelecionado(null)} onUpdated={atualizar}/>}</div>;
};
const Resumo=({icon:Icon,label,valor}:{icon:any;label:string;valor:number})=><div className="bg-white border rounded-2xl p-4 flex gap-3 items-center"><div className="p-2 bg-yellow-50 rounded-xl"><Icon className="w-5 h-5 text-yellow-600"/></div><div><p className="text-2xl font-black">{valor}</p><p className="text-[10px] uppercase font-bold text-neutral-400">{label}</p></div></div>;
