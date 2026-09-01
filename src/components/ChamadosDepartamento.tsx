import React, { useEffect, useMemo, useState } from 'react';
import { Chamado, Department } from '../types';
import { Search, Clock3, AlertTriangle, CheckCircle2, Loader2 } from 'lucide-react';
import { ChamadoDetalhe } from './ChamadoDetalhe';
import { ChamadosKanban } from './ChamadosKanban';

interface Props { department: Department; refreshKey: number; onOpenNewChamado: () => void; }
export const ChamadosDepartamento: React.FC<Props> = ({ department, refreshKey, onOpenNewChamado }) => {
  const [itens,setItens]=useState<Chamado[]>([]); const [selecionado,setSelecionado]=useState<Chamado|null>(null); const [busca,setBusca]=useState(''); const [carregando,setCarregando]=useState(true); const [erro,setErro]=useState('');
  const carregar=()=>{setCarregando(true);setErro('');fetch(`/api/chamados?escopo=departamento&departamentoId=${encodeURIComponent(department.id)}`).then(async r=>{const d=await r.json();if(!r.ok)throw new Error(d.error);setItens(d)}).catch(e=>setErro(e.message)).finally(()=>setCarregando(false));};
  useEffect(carregar,[department.id,refreshKey]);
  const filtrados=useMemo(()=>itens.filter(c=>{const q=busca.toLowerCase();return !q||`${c.protocolo} ${c.assunto} ${c.solicitanteNome} ${c.responsavel||''} ${c.descricao}`.toLowerCase().includes(q);}),[itens,busca]);
  const atualizar=(c:Chamado)=>{setItens(v=>v.map(i=>i.id===c.id?c:i));setSelecionado(c)};
  const ativos=itens.filter(c=>!['Encerrado','Cancelado'].includes(c.status));
  return <div className="space-y-5"><div className="grid sm:grid-cols-3 gap-3"><Kpi icon={Clock3} label="Em aberto" value={ativos.filter(c=>c.status==='Aberto').length}/><Kpi icon={AlertTriangle} label="Em andamento" value={ativos.filter(c=>c.status!=='Aberto').length}/><Kpi icon={CheckCircle2} label="Encerrados" value={itens.filter(c=>c.status==='Encerrado').length}/></div>
    <div className="bg-white border rounded-2xl p-4 flex flex-col md:flex-row gap-3 md:items-center"><div className="relative flex-1"><Search className="absolute w-4 h-4 left-3 top-3 text-neutral-400"/><input className="w-full border rounded-xl pl-9 pr-3 py-2.5 text-xs outline-none focus:border-yellow-400" value={busca} onChange={e=>setBusca(e.target.value)} placeholder="Protocolo, assunto, solicitante ou responsável"/></div><button onClick={onOpenNewChamado} className="bg-yellow-400 rounded-xl px-4 py-2.5 text-xs font-black">+ Abrir chamado</button></div>
    {erro&&<div className="p-4 bg-red-50 text-red-700 rounded-xl text-xs">{erro}</div>}{carregando?<div className="p-12 flex justify-center"><Loader2 className="animate-spin"/></div>:<ChamadosKanban chamados={filtrados} onSelect={setSelecionado} mostrarSolicitante/>}
    {selecionado&&<ChamadoDetalhe chamado={selecionado} podeAtender onClose={()=>setSelecionado(null)} onUpdated={atualizar}/>}</div>;
};
const Kpi=({icon:Icon,label,value}:{icon:any;label:string;value:number})=><div className="bg-white border rounded-2xl p-4 flex items-center gap-3"><div className="p-2 rounded-xl bg-yellow-50"><Icon className="w-5 h-5 text-yellow-600"/></div><div><p className="text-2xl font-black">{value}</p><p className="text-[10px] uppercase font-bold text-neutral-400">{label}</p></div></div>;
