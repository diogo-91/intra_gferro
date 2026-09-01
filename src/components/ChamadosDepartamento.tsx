import React, { useEffect, useState } from 'react';
import { Chamado, Department } from '../types';
import { Loader2 } from 'lucide-react';
import { ChamadoDetalhe } from './ChamadoDetalhe';
import { ChamadosKanban } from './ChamadosKanban';

interface Props { department: Department; refreshKey: number; onNewCountChange?: (count: number) => void; }
export const ChamadosDepartamento: React.FC<Props> = ({ department, refreshKey, onNewCountChange }) => {
  const [itens,setItens]=useState<Chamado[]>([]); const [selecionado,setSelecionado]=useState<Chamado|null>(null); const [carregando,setCarregando]=useState(true); const [erro,setErro]=useState('');
  const carregar=()=>{setCarregando(true);setErro('');fetch(`/api/chamados?escopo=departamento&departamentoId=${encodeURIComponent(department.id)}`).then(async r=>{const d=await r.json();if(!r.ok)throw new Error(d.error);setItens(d);onNewCountChange?.(d.filter((c:Chamado)=>c.status==='Aberto').length)}).catch(e=>setErro(e.message)).finally(()=>setCarregando(false));};
  useEffect(carregar,[department.id,refreshKey]);
  const atualizar=(c:Chamado)=>{setItens(v=>{const atualizados=v.map(i=>i.id===c.id?c:i);onNewCountChange?.(atualizados.filter(i=>i.status==='Aberto').length);return atualizados});setSelecionado(c)};
  return <div className="space-y-5">
    {erro&&<div className="p-4 bg-red-50 text-red-700 rounded-xl text-xs">{erro}</div>}{carregando?<div className="p-12 flex justify-center"><Loader2 className="animate-spin"/></div>:<ChamadosKanban chamados={itens} onSelect={setSelecionado} mostrarSolicitante/>}
    {selecionado&&<ChamadoDetalhe chamado={selecionado} podeAtender onClose={()=>setSelecionado(null)} onUpdated={atualizar}/>}</div>;
};
