import React, { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, Grid, List, Loader2, Mail, MessageSquare, Phone, Search, UserRound, Users } from 'lucide-react';
import type { Funcionario } from '../types';

const normalizar = (texto: string) => texto.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase();

export const DiretorioPessoas: React.FC = () => {
  const [funcionarios, setFuncionarios] = useState<Funcionario[]>([]);
  const [selectedDept, setSelectedDept] = useState('Todos');
  const [searchQuery, setSearchQuery] = useState('');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState('');

  useEffect(() => {
    let cancelado = false;
    fetch('/api/rh/funcionarios')
      .then(async (resposta) => {
        const dados = await resposta.json();
        if (!resposta.ok) throw new Error(dados.error || 'Não foi possível carregar os funcionários.');
        return dados as Funcionario[];
      })
      .then((dados) => { if (!cancelado) setFuncionarios(Array.isArray(dados) ? dados : []); })
      .catch((error) => { if (!cancelado) setErro(error.message || 'Não foi possível carregar os funcionários.'); })
      .finally(() => { if (!cancelado) setCarregando(false); });
    return () => { cancelado = true; };
  }, []);

  const departments = useMemo(() => [
    'Todos',
    ...Array.from(new Set<string>(funcionarios.map((funcionario) => funcionario.setor.trim()).filter(Boolean)))
      .sort((a, b) => a.localeCompare(b, 'pt-BR')),
  ], [funcionarios]);

  useEffect(() => {
    if (!departments.includes(selectedDept)) setSelectedDept('Todos');
  }, [departments, selectedDept]);

  const filtered = useMemo(() => {
    const busca = normalizar(searchQuery.trim());
    return funcionarios.filter((funcionario) => {
      const matchesDept = selectedDept === 'Todos' || funcionario.setor === selectedDept;
      const conteudo = normalizar(`${funcionario.nome} ${funcionario.cargo} ${funcionario.setor} ${funcionario.email ?? ''} ${funcionario.telefone ?? ''}`);
      return matchesDept && (!busca || conteudo.includes(busca));
    });
  }, [funcionarios, searchQuery, selectedDept]);

  const contatoWhatsapp = (telefone?: string) => {
    const numeros = telefone?.replace(/\D/g, '') ?? '';
    if (numeros.length < 10) return null;
    return `https://wa.me/${numeros.startsWith('55') ? numeros : `55${numeros}`}`;
  };

  const statusStyle: Record<Funcionario['status'], string> = {
    Ativo: 'border-emerald-200 bg-emerald-50 text-emerald-700',
    Inativo: 'border-neutral-200 bg-neutral-100 text-neutral-600',
    Férias: 'border-sky-200 bg-sky-50 text-sky-700',
  };

  return <div className="space-y-6 pb-12">
    <div className="flex flex-col justify-between gap-4 rounded-[2rem] border border-neutral-200 bg-white p-6 shadow-sm sm:flex-row sm:items-center">
      <div>
        <h1 className="flex items-center gap-2 text-xl font-black tracking-tight text-neutral-900 sm:text-2xl"><Users className="h-6 w-6 text-yellow-600"/>Diretório de Colaboradores GFERRO</h1>
        <p className="mt-1 text-xs font-medium text-neutral-500">Consulte os funcionários cadastrados no RH por nome, cargo, departamento e contato.</p>
      </div>
      <div className="flex shrink-0 items-center gap-1 rounded-full border border-neutral-200 bg-neutral-50 p-1.5">
        <button onClick={() => setViewMode('grid')} className={`rounded-full p-2 transition ${viewMode === 'grid' ? 'bg-yellow-400 text-black shadow-md' : 'text-neutral-500 hover:text-neutral-900'}`} title="Visualização em grade"><Grid className="h-4 w-4"/></button>
        <button onClick={() => setViewMode('list')} className={`rounded-full p-2 transition ${viewMode === 'list' ? 'bg-yellow-400 text-black shadow-md' : 'text-neutral-500 hover:text-neutral-900'}`} title="Visualização em lista"><List className="h-4 w-4"/></button>
      </div>
    </div>

    <div className="flex flex-col items-center justify-between gap-4 md:flex-row">
      <div className="flex w-full items-center gap-2 overflow-x-auto pb-1 md:w-auto">{departments.map((dept) => <button key={dept} onClick={() => setSelectedDept(dept)} className={`whitespace-nowrap rounded-full px-4 py-2 text-xs font-extrabold transition ${selectedDept === dept ? 'bg-yellow-400 text-black shadow-lg shadow-yellow-400/20' : 'border border-neutral-200 bg-white text-neutral-500 hover:text-neutral-900'}`}>{dept}</button>)}</div>
      <div className="relative w-full md:w-80"><Search className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-500"/><input value={searchQuery} onChange={(event) => setSearchQuery(event.target.value)} placeholder="Buscar nome, cargo, setor ou contato..." className="w-full rounded-full border border-neutral-200 bg-white py-2 pl-10 pr-4 text-xs outline-none focus:border-yellow-400"/></div>
    </div>

    {carregando ? <div className="flex min-h-64 items-center justify-center gap-2 text-sm text-neutral-500"><Loader2 className="h-5 w-5 animate-spin text-yellow-600"/>Carregando funcionários...</div> : erro ? <div className="flex items-center gap-2 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700"><AlertTriangle className="h-5 w-5 shrink-0"/>{erro}</div> : filtered.length === 0 ? <div className="rounded-2xl border border-neutral-200 bg-neutral-50 p-10 text-center text-sm text-neutral-500">Nenhum funcionário encontrado.</div> : viewMode === 'grid' ? (
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">{filtered.map((funcionario) => {
        const whatsapp = contatoWhatsapp(funcionario.telefone);
        return <article key={funcionario.id} className="flex flex-col justify-between space-y-4 rounded-[2rem] border border-neutral-200 bg-white p-6 shadow-sm transition hover:border-yellow-400/60">
          <div className="space-y-3"><div className="flex items-start justify-between gap-3"><span className="flex h-14 w-14 items-center justify-center rounded-2xl border border-yellow-200 bg-yellow-50 text-yellow-700"><UserRound className="h-7 w-7"/></span><span className={`rounded-full border px-3 py-1 text-[10px] font-extrabold ${statusStyle[funcionario.status]}`}>{funcionario.status}</span></div><div><h3 className="text-base font-extrabold leading-tight text-neutral-900">{funcionario.nome}</h3><p className="mt-1 text-xs text-neutral-500">{funcionario.cargo || 'Cargo não informado'}</p><span className="mt-2 inline-block rounded-full border border-neutral-100 bg-neutral-50 px-3 py-1 text-[10px] font-bold text-neutral-600">{funcionario.setor || 'Sem departamento'}</span></div></div>
          <div className="space-y-2 border-t border-neutral-200 pt-3 text-xs">{funcionario.telefone && <div className="flex items-center gap-2 text-neutral-500"><Phone className="h-3.5 w-3.5 shrink-0 text-yellow-600"/><span className="truncate">{funcionario.telefone}</span></div>}{funcionario.email && <div className="flex items-center gap-2 text-neutral-500"><Mail className="h-3.5 w-3.5 shrink-0"/><span className="truncate">{funcionario.email}</span></div>}<div className="flex items-center gap-2 pt-2">{whatsapp && <a href={whatsapp} target="_blank" rel="noreferrer" className="flex flex-1 items-center justify-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 py-2 font-extrabold text-emerald-700 hover:bg-emerald-100"><MessageSquare className="h-3.5 w-3.5"/>WhatsApp</a>}{funcionario.email && <a href={`mailto:${funcionario.email}`} className="rounded-full border border-neutral-200 bg-neutral-50 p-2 text-neutral-600 hover:text-yellow-600" title="Enviar e-mail"><Mail className="h-4 w-4"/></a>}</div></div>
        </article>;
      })}</div>
    ) : (
      <div className="overflow-hidden rounded-[2rem] border border-neutral-200 bg-white shadow-sm"><div className="overflow-x-auto"><table className="w-full text-left text-xs text-neutral-600"><thead className="border-b border-neutral-200 bg-neutral-50 text-[10px] font-bold uppercase tracking-wider text-neutral-500"><tr><th className="p-4">Colaborador</th><th className="p-4">Cargo e departamento</th><th className="p-4">Telefone</th><th className="p-4">Status</th><th className="p-4 text-right">Contato</th></tr></thead><tbody className="divide-y divide-neutral-100">{filtered.map((funcionario) => { const whatsapp = contatoWhatsapp(funcionario.telefone); return <tr key={funcionario.id} className="hover:bg-neutral-50"><td className="p-4"><div className="flex items-center gap-3"><span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-yellow-200 bg-yellow-50"><UserRound className="h-5 w-5 text-yellow-700"/></span><div><span className="block font-bold text-neutral-900">{funcionario.nome}</span><span className="text-[10px] text-neutral-500">{funcionario.email || 'E-mail não informado'}</span></div></div></td><td className="p-4"><span className="block font-semibold text-neutral-900">{funcionario.cargo || 'Não informado'}</span><span className="text-[10px] font-extrabold text-yellow-700">{funcionario.setor || 'Sem departamento'}</span></td><td className="p-4">{funcionario.telefone || '—'}</td><td className="p-4"><span className={`rounded-full border px-2.5 py-1 text-[10px] font-bold ${statusStyle[funcionario.status]}`}>{funcionario.status}</span></td><td className="p-4"><div className="flex justify-end gap-2">{whatsapp && <a href={whatsapp} target="_blank" rel="noreferrer" className="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-[11px] font-extrabold text-emerald-700">WhatsApp</a>}{funcionario.email && <a href={`mailto:${funcionario.email}`} className="rounded-full border border-neutral-200 bg-neutral-50 p-2 text-neutral-500"><Mail className="h-4 w-4"/></a>}</div></td></tr>; })}</tbody></table></div></div>
    )}
  </div>;
};
