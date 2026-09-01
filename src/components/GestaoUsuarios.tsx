import React, { useEffect, useState } from 'react';
import { AlertTriangle, Building2, Check, Loader2, Pencil, ShieldCheck, Trash2, UserPlus, Users, X } from 'lucide-react';
import { MODULOS, ModuloId, SubmoduloId, TODOS_SUBMODULOS } from '../modulos';

interface Usuario { id: string; nome: string; email: string; modulos: ModuloId[]; submodulos: SubmoduloId[]; criadoEm: string }

export const GestaoUsuarios: React.FC = () => {
  const [usuarios, setUsuarios] = useState<Usuario[]>([]);
  const [nome, setNome] = useState('');
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [modulos, setModulos] = useState<ModuloId[]>([]);
  const [submodulos, setSubmodulos] = useState<SubmoduloId[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState('');
  const [sucesso, setSucesso] = useState('');
  const [usuarioEditando, setUsuarioEditando] = useState<Usuario | null>(null);

  const carregar = async () => {
    const res = await fetch('/api/usuarios');
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Não foi possível carregar os usuários.');
    setUsuarios(data);
  };

  useEffect(() => { carregar().catch((e) => setErro(e.message)).finally(() => setCarregando(false)); }, []);

  const alternarModulo = (id: ModuloId) => {
    const selecionado = modulos.includes(id);
    setModulos((atuais) => selecionado ? atuais.filter((item) => item !== id) : [...atuais, id]);
    if (selecionado) {
      const modulo = MODULOS.find((item) => item.id === id);
      if (modulo && 'submodulos' in modulo) {
        const filhos = new Set(modulo.submodulos.map((item) => item.id));
        setSubmodulos((atuais) => atuais.filter((item) => !filhos.has(item)));
      }
    }
  };

  const alternarSubmodulo = (id: SubmoduloId) => setSubmodulos((atuais) =>
    atuais.includes(id) ? atuais.filter((item) => item !== id) : [...atuais, id]
  );

  const alternarTodos = () => {
    const todosSelecionados = modulos.length === MODULOS.length && submodulos.length === TODOS_SUBMODULOS.length;
    setModulos(todosSelecionados ? [] : MODULOS.map((modulo) => modulo.id));
    setSubmodulos(todosSelecionados ? [] : [...TODOS_SUBMODULOS]);
  };

  const limparFormulario = () => {
    setNome(''); setEmail(''); setSenha(''); setModulos([]); setSubmodulos([]); setUsuarioEditando(null);
  };

  const editar = (usuario: Usuario) => {
    setUsuarioEditando(usuario);
    setNome(usuario.nome);
    setEmail(usuario.email);
    setSenha('');
    setModulos([...usuario.modulos]);
    setSubmodulos([...(usuario.submodulos ?? [])]);
    setErro(''); setSucesso('');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const cadastrar = async (event: React.FormEvent) => {
    event.preventDefault(); setSalvando(true); setErro(''); setSucesso('');
    try {
      if (usuarioEditando) {
        const res = await fetch(`/api/usuarios/${usuarioEditando.id}/permissoes`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ modulos, submodulos }) });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Não foi possível atualizar os acessos.');
        setUsuarios((atuais) => atuais.map((usuario) => usuario.id === data.id ? data : usuario));
        limparFormulario(); setSucesso('Acessos atualizados com sucesso.');
        return;
      }
      const res = await fetch('/api/usuarios', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ nome, email, senha, modulos, submodulos }) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Não foi possível cadastrar.');
      setUsuarios((atuais) => [...atuais, data].sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR')));
      limparFormulario(); setSucesso('Usuário cadastrado com sucesso.');
    } catch (e: any) { setErro(e.message); } finally { setSalvando(false); }
  };

  const remover = async (usuario: Usuario) => {
    if (!window.confirm(`Remover o acesso de ${usuario.nome}?`)) return;
    const res = await fetch(`/api/usuarios/${usuario.id}`, { method: 'DELETE' });
    if (res.ok) setUsuarios((atuais) => atuais.filter((item) => item.id !== usuario.id));
    else setErro((await res.json()).error || 'Não foi possível remover.');
  };

  return <div className="max-w-6xl mx-auto space-y-6">
    <div><div className="flex items-center gap-3"><ShieldCheck className="w-7 h-7 text-yellow-500"/><h1 className="text-2xl font-black">Gestão de usuários</h1></div><p className="text-sm text-neutral-500 mt-1">Cadastre acessos e escolha exatamente quais módulos cada pessoa pode utilizar.</p></div>
    <div className="grid lg:grid-cols-[minmax(0,1fr)_minmax(340px,.8fr)] gap-6 items-start">
      <form onSubmit={cadastrar} className="bg-white border border-neutral-200 rounded-2xl p-6 shadow-sm space-y-5">
        <div className="flex items-center gap-2 font-bold">{usuarioEditando ? <Pencil className="w-5 h-5 text-yellow-500"/> : <UserPlus className="w-5 h-5 text-yellow-500"/>}{usuarioEditando ? `Editar acessos de ${usuarioEditando.nome}` : 'Novo usuário'}</div>
        <div className="grid sm:grid-cols-2 gap-4">
          <label className="text-xs font-bold text-neutral-600">Nome<input required minLength={2} disabled={!!usuarioEditando} value={nome} onChange={(e)=>setNome(e.target.value)} className="mt-2 w-full rounded-xl border border-neutral-200 px-4 py-3 text-sm outline-none focus:border-yellow-500 disabled:bg-neutral-100" placeholder="Nome completo"/></label>
          <label className="text-xs font-bold text-neutral-600">E-mail<input required type="email" disabled={!!usuarioEditando} value={email} onChange={(e)=>setEmail(e.target.value)} className="mt-2 w-full rounded-xl border border-neutral-200 px-4 py-3 text-sm outline-none focus:border-yellow-500 disabled:bg-neutral-100" placeholder="usuario@gferro.com.br"/></label>
        </div>
        {!usuarioEditando && <label className="text-xs font-bold text-neutral-600 block">Senha inicial<input required type="password" minLength={8} value={senha} onChange={(e)=>setSenha(e.target.value)} className="mt-2 w-full rounded-xl border border-neutral-200 px-4 py-3 text-sm outline-none focus:border-yellow-500" placeholder="Mínimo de 8 caracteres"/></label>}
        <fieldset><div className="flex items-center justify-between mb-3"><legend className="text-xs font-bold text-neutral-600">Módulos e submódulos liberados</legend><button type="button" onClick={alternarTodos} className="text-xs font-bold text-yellow-700 hover:underline">{modulos.length === MODULOS.length && submodulos.length === TODOS_SUBMODULOS.length ? 'Desmarcar todos' : 'Selecionar todos'}</button></div>
          <div className="grid sm:grid-cols-2 gap-2">{MODULOS.map((modulo) => {
            const selecionado = modulos.includes(modulo.id);
            const filhos = 'submodulos' in modulo ? modulo.submodulos : [];
            return <div key={modulo.id} className={`rounded-xl border transition ${selecionado?'border-yellow-400 bg-yellow-50':'border-neutral-200'}`}>
              <label className="flex cursor-pointer items-center gap-3 p-3 text-xs font-semibold"><input type="checkbox" checked={selecionado} onChange={()=>alternarModulo(modulo.id)} className="accent-yellow-500"/>{modulo.nome}</label>
              {selecionado && filhos.length > 0 && <div className="mx-3 mb-3 space-y-2 border-t border-yellow-200 pt-3">
                <p className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-wide text-yellow-800"><Building2 className="h-3.5 w-3.5"/>Escolha o acesso</p>
                {filhos.map((submodulo) => <label key={submodulo.id} className={`flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 text-[11px] transition ${submodulos.includes(submodulo.id)?'border-yellow-400 bg-white font-bold':'border-neutral-200 bg-white/70 text-neutral-600'}`}><input type="checkbox" checked={submodulos.includes(submodulo.id)} onChange={()=>alternarSubmodulo(submodulo.id)} className="accent-yellow-500"/>{submodulo.nome}</label>)}
              </div>}
            </div>;
          })}</div>
        </fieldset>
        {erro && <div className="flex gap-2 p-3 rounded-xl bg-red-50 text-red-700 text-xs"><AlertTriangle className="w-4 h-4 shrink-0"/>{erro}</div>}{sucesso && <div className="flex gap-2 p-3 rounded-xl bg-emerald-50 text-emerald-700 text-xs"><Check className="w-4 h-4"/>{sucesso}</div>}
        <div className="flex gap-2">{usuarioEditando && <button type="button" onClick={limparFormulario} className="flex items-center justify-center gap-2 rounded-xl border border-neutral-300 px-4 py-3 text-sm font-bold text-neutral-600"><X className="h-4 w-4"/>Cancelar</button>}<button disabled={salvando} className="flex flex-1 justify-center items-center gap-2 rounded-xl bg-yellow-400 hover:bg-yellow-300 py-3 font-black text-sm disabled:opacity-60">{salvando?<Loader2 className="w-4 h-4 animate-spin"/>:usuarioEditando?<Pencil className="w-4 h-4"/>:<UserPlus className="w-4 h-4"/>}{usuarioEditando ? 'Salvar acessos' : 'Cadastrar usuário'}</button></div>
      </form>
      <section className="bg-white border border-neutral-200 rounded-2xl shadow-sm overflow-hidden"><div className="p-5 border-b border-neutral-100 flex items-center gap-2 font-bold"><Users className="w-5 h-5 text-yellow-500"/>Usuários cadastrados <span className="ml-auto text-xs bg-neutral-100 rounded-full px-2 py-1">{usuarios.length}</span></div>
        {carregando?<div className="p-8 flex justify-center"><Loader2 className="animate-spin"/></div>:usuarios.length===0?<p className="p-8 text-center text-sm text-neutral-400">Nenhum usuário cadastrado ainda.</p>:<div className="divide-y divide-neutral-100">{usuarios.map((usuario)=><div key={usuario.id} className="p-4 flex gap-3"><div className="w-9 h-9 rounded-full bg-yellow-100 text-yellow-800 font-black flex items-center justify-center shrink-0">{usuario.nome.charAt(0).toUpperCase()}</div><div className="min-w-0 flex-1"><p className="text-sm font-bold truncate">{usuario.nome}</p><p className="text-xs text-neutral-500 truncate">{usuario.email}</p><p className="text-[11px] text-neutral-400 mt-1">{usuario.modulos.length} módulo(s) · {(usuario.submodulos ?? []).length} submódulo(s)</p></div><div className="flex shrink-0"><button onClick={()=>editar(usuario)} title="Editar acessos" className="p-2 text-neutral-400 hover:text-yellow-700"><Pencil className="w-4 h-4"/></button><button onClick={()=>remover(usuario)} title="Remover usuário" className="p-2 text-neutral-400 hover:text-red-600"><Trash2 className="w-4 h-4"/></button></div></div>)}</div>}
      </section>
    </div>
  </div>;
};
