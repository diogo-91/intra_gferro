import React, { useEffect, useRef, useState } from 'react';
import { ArrowLeft, ArrowRight, CheckCircle2, ClipboardCheck, Plus, RefreshCw, Search, ShieldCheck } from 'lucide-react';
import { initialDepartments } from '../data/departamentos';
import { PRIORIDADES_NC, STATUS_NC, ncAtrasada, ncFinalizada, type NaoConformidade, type NovaNC, type TratamentoNC } from '../data/qualidade';

const API = '/api/qualidade/nao-conformidades';
const campo = 'w-full rounded-xl border border-neutral-300 bg-white px-3 py-2.5 text-sm outline-none focus:border-yellow-500 focus:ring-2 focus:ring-yellow-200 disabled:bg-neutral-100';
const botao = 'inline-flex min-h-11 items-center justify-center gap-2 rounded-xl px-4 py-2 text-sm font-bold disabled:opacity-50';
const nomeDepartamento = (id: string) => initialDepartments.find((dep) => dep.id === id)?.name || id;
const dataHora = (valor: string) => new Date(valor).toLocaleString('pt-BR');
const dataPrazo = (valor: string) => valor ? valor.split('-').reverse().join('/') : 'Sem prazo';

async function consultar<T>(url: string, opcoes?: RequestInit): Promise<T> {
  const resposta = await fetch(url, opcoes);
  const dados = await resposta.json().catch(() => null);
  if (!resposta.ok) throw new Error(dados?.error || 'Não foi possível completar a operação. Tente novamente.');
  if (dados === null) throw new Error('O servidor não retornou os dados. Tente novamente.');
  return dados as T;
}

function Status({ nc }: { nc: NaoConformidade }) {
  const cor = nc.status === 'Concluída' ? 'bg-emerald-50 text-emerald-700' : nc.status === 'Cancelada' ? 'bg-neutral-100 text-neutral-500' : 'bg-yellow-50 text-yellow-800';
  return <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-bold ${cor}`}>{nc.status}</span>;
}

function Campo({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return <label className="block space-y-1.5 text-xs font-bold text-neutral-600"><span>{titulo}</span>{children}</label>;
}

function Departamentos({ value, onChange }: { value: string; onChange: (valor: string) => void }) {
  return <select required className={campo} value={value} onChange={(e) => onChange(e.target.value)}>
    <option value="">Selecione o departamento</option>
    {initialDepartments.map((dep) => <option key={dep.id} value={dep.id}>{dep.name}</option>)}
  </select>;
}

function NovaNaoConformidade({ onCancelar, onSalva, departamentoInicial }: { onCancelar: () => void; onSalva: (nc: NaoConformidade) => void; departamentoInicial: string }) {
  const [dados, setDados] = useState<NovaNC>({ titulo: '', departamentoOrigemId: '', departamentoResponsavelId: departamentoInicial, descricao: '', evidencia: '', prioridade: 'Média', responsavel: '', prazo: '' });
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState('');
  const alterar = <K extends keyof NovaNC>(chave: K, valor: NovaNC[K]) => setDados((atual) => ({ ...atual, [chave]: valor }));
  async function salvar(event: React.FormEvent) {
    event.preventDefault();
    if (salvando) return;
    setSalvando(true); setErro('');
    try {
      const nc = await consultar<NaoConformidade>(API, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(dados) });
      onSalva(nc);
    } catch (error: any) { setErro(error.message); } finally { setSalvando(false); }
  }
  return <form onSubmit={salvar} className="max-w-4xl space-y-5 rounded-2xl border border-neutral-200 bg-white p-4 sm:p-6">
    <div><h2 className="text-lg font-black">Nova não conformidade</h2><p className="mt-1 text-sm text-neutral-500">Descreva o desvio e indique o departamento que deverá tratar a ocorrência.</p></div>
    {erro && <p role="alert" className="rounded-xl bg-red-50 p-3 text-sm text-red-700">{erro}</p>}
    <fieldset disabled={salvando} className="space-y-4">
      <Campo titulo="Título *"><input autoFocus required maxLength={180} value={dados.titulo} onChange={(e) => alterar('titulo', e.target.value)} className={campo} placeholder="Ex.: divergência entre pedido e material produzido" /></Campo>
      <div className="grid gap-4 sm:grid-cols-2">
        <Campo titulo="Departamento de origem *"><Departamentos value={dados.departamentoOrigemId} onChange={(valor) => alterar('departamentoOrigemId', valor)} /></Campo>
        <Campo titulo="Departamento responsável *"><Departamentos value={dados.departamentoResponsavelId} onChange={(valor) => alterar('departamentoResponsavelId', valor)} /></Campo>
      </div>
      <Campo titulo="Descrição da não conformidade *"><textarea required rows={5} maxLength={5000} value={dados.descricao} onChange={(e) => alterar('descricao', e.target.value)} className={campo} placeholder="O que aconteceu, o que era esperado e qual foi o impacto?" /></Campo>
      <Campo titulo="Evidências e referências"><textarea rows={3} maxLength={5000} value={dados.evidencia} onChange={(e) => alterar('evidencia', e.target.value)} className={campo} placeholder="Informe pedido, lote, documento ou descreva a evidência observada." /></Campo>
      <div className="grid gap-4 sm:grid-cols-3">
        <Campo titulo="Prioridade *"><select className={campo} value={dados.prioridade} onChange={(e) => alterar('prioridade', e.target.value as NovaNC['prioridade'])}>{PRIORIDADES_NC.map((p) => <option key={p}>{p}</option>)}</select></Campo>
        <Campo titulo="Responsável pelo tratamento"><input className={campo} maxLength={120} value={dados.responsavel} onChange={(e) => alterar('responsavel', e.target.value)} placeholder="Nome do responsável" /></Campo>
        <Campo titulo="Prazo"><input type="date" className={campo} value={dados.prazo} onChange={(e) => alterar('prazo', e.target.value)} /></Campo>
      </div>
    </fieldset>
    <div className="flex flex-wrap justify-end gap-2 border-t border-neutral-100 pt-4">
      <button type="button" disabled={salvando} onClick={onCancelar} className={`${botao} bg-neutral-100`}>Cancelar</button>
      <button disabled={salvando} className={`${botao} bg-yellow-400 text-black hover:bg-yellow-500`}><Plus className="h-4 w-4" />{salvando ? 'Registrando...' : 'Abrir não conformidade'}</button>
    </div>
  </form>;
}

const DetalheNaoConformidade: React.FC<{ nc: NaoConformidade; onSalva: (nc: NaoConformidade) => void }> = ({ nc, onSalva }) => {
  const [dados, setDados] = useState<TratamentoNC>({ status: nc.status, prioridade: nc.prioridade, departamentoResponsavelId: nc.departamentoResponsavelId, responsavel: nc.responsavel, prazo: nc.prazo, causa: nc.causa, acaoCorretiva: nc.acaoCorretiva, verificacao: nc.verificacao });
  const [comentario, setComentario] = useState('');
  const [erro, setErro] = useState('');
  const [salvando, setSalvando] = useState(false);
  const alterar = <K extends keyof TratamentoNC>(chave: K, valor: TratamentoNC[K]) => setDados((atual) => ({ ...atual, [chave]: valor }));
  const concluindo = dados.status === 'Concluída';
  async function salvar(event: React.FormEvent) {
    event.preventDefault();
    if (salvando) return;
    setSalvando(true); setErro('');
    try { onSalva(await consultar<NaoConformidade>(`${API}/${nc.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...dados, comentario, versao: nc.versao }) })); }
    catch (error: any) { setErro(error.message); } finally { setSalvando(false); }
  }
  return <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1fr)_320px]">
    <div className="min-w-0 space-y-5">
      <section className="space-y-4 rounded-2xl border border-neutral-200 p-4 sm:p-6">
        <div className="flex flex-wrap items-center gap-2"><span className="font-mono text-xs font-bold text-neutral-500">{nc.protocolo}</span><Status nc={nc} />{ncAtrasada(nc) && <span className="text-xs font-bold text-red-600">Prazo vencido</span>}</div>
        <h2 className="break-words text-xl font-black">{nc.titulo}</h2>
        <p className="flex flex-wrap items-center gap-2 text-sm font-semibold">{nomeDepartamento(nc.departamentoOrigemId)}<ArrowRight className="h-4 w-4 text-neutral-400" />{nomeDepartamento(nc.departamentoResponsavelId)}</p>
        <div><h3 className="text-xs font-bold text-neutral-500">Descrição</h3><p className="mt-1 whitespace-pre-wrap break-words text-sm">{nc.descricao}</p></div>
        {nc.evidencia && <div><h3 className="text-xs font-bold text-neutral-500">Evidências e referências</h3><p className="mt-1 whitespace-pre-wrap break-words text-sm">{nc.evidencia}</p></div>}
        <p className="text-xs text-neutral-500">Aberta por {nc.criadoPor} em {dataHora(nc.criadoEm)}{nc.concluidoEm && ` · Concluída em ${dataHora(nc.concluidoEm)}`}</p>
      </section>
      <form onSubmit={salvar} className="space-y-4 rounded-2xl border border-neutral-200 p-4 sm:p-6">
        <div><h3 className="font-black">Tratamento da não conformidade</h3><p className="mt-1 text-xs text-neutral-500">Para concluir, registre o responsável, a causa, a ação corretiva e a verificação do resultado.</p></div>
        {erro && <p role="alert" className="rounded-xl bg-red-50 p-3 text-sm text-red-700">{erro}</p>}
        <fieldset disabled={salvando} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <Campo titulo="Status"><select className={campo} value={dados.status} onChange={(e) => alterar('status', e.target.value as TratamentoNC['status'])}>{STATUS_NC.map((s) => <option key={s}>{s}</option>)}</select></Campo>
            <Campo titulo="Prioridade"><select className={campo} value={dados.prioridade} onChange={(e) => alterar('prioridade', e.target.value as TratamentoNC['prioridade'])}>{PRIORIDADES_NC.map((p) => <option key={p}>{p}</option>)}</select></Campo>
            <Campo titulo="Departamento responsável"><Departamentos value={dados.departamentoResponsavelId} onChange={(valor) => alterar('departamentoResponsavelId', valor)} /></Campo>
            <Campo titulo="Responsável pelo tratamento"><input required={concluindo} maxLength={120} className={campo} value={dados.responsavel} onChange={(e) => alterar('responsavel', e.target.value)} /></Campo>
            <Campo titulo="Prazo"><input type="date" className={campo} value={dados.prazo} onChange={(e) => alterar('prazo', e.target.value)} /></Campo>
          </div>
          <Campo titulo="Causa identificada"><textarea required={concluindo} rows={3} maxLength={5000} className={campo} value={dados.causa} onChange={(e) => alterar('causa', e.target.value)} /></Campo>
          <Campo titulo="Ação corretiva"><textarea required={concluindo} rows={3} maxLength={5000} className={campo} value={dados.acaoCorretiva} onChange={(e) => alterar('acaoCorretiva', e.target.value)} /></Campo>
          <Campo titulo="Verificação do resultado"><textarea required={concluindo} rows={3} maxLength={5000} className={campo} value={dados.verificacao} onChange={(e) => alterar('verificacao', e.target.value)} placeholder="Como foi confirmado que o desvio foi corrigido?" /></Campo>
          <Campo titulo={dados.status === 'Cancelada' && nc.status !== 'Cancelada' ? 'Motivo do cancelamento *' : 'Comentário para o histórico'}><textarea required={dados.status === 'Cancelada' && nc.status !== 'Cancelada'} rows={3} maxLength={5000} className={campo} value={comentario} onChange={(e) => setComentario(e.target.value)} /></Campo>
        </fieldset>
        <div className="flex justify-end"><button disabled={salvando} className={`${botao} bg-yellow-400 text-black hover:bg-yellow-500`}><CheckCircle2 className="h-4 w-4" />{salvando ? 'Salvando...' : 'Salvar tratamento'}</button></div>
      </form>
    </div>
    <aside className="min-w-0 rounded-2xl border border-neutral-200 p-4 sm:p-5"><h3 className="mb-4 flex items-center gap-2 font-black"><ClipboardCheck className="h-4 w-4 text-yellow-600" />Histórico</h3>
      <ol className="max-h-[800px] space-y-4 overflow-y-auto">{[...nc.historico].reverse().map((evento) => <li key={evento.id} className="border-l-2 border-yellow-300 pl-3"><p className="whitespace-pre-wrap break-words text-sm">{evento.descricao}</p><p className="mt-1 text-xs font-semibold text-neutral-500">{evento.autorNome}</p><time className="text-[11px] text-neutral-400" dateTime={evento.criadoEm}>{dataHora(evento.criadoEm)}</time></li>)}</ol>
    </aside>
  </div>;
}

export const QualidadeApp: React.FC<{ departamentoInicial?: string }> = ({ departamentoInicial = '' }) => {
  const [registros, setRegistros] = useState<NaoConformidade[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState('');
  const [mensagem, setMensagem] = useState('');
  const [busca, setBusca] = useState('');
  const [departamento, setDepartamento] = useState(departamentoInicial);
  const [status, setStatus] = useState('');
  const [direcao, setDirecao] = useState('responsavel');
  const [apenasAtrasadas, setApenasAtrasadas] = useState(false);
  const [selecionada, setSelecionada] = useState<NaoConformidade | null>(null);
  const [nova, setNova] = useState(false);
  const [atualizacao, setAtualizacao] = useState(0);
  const tituloRef = useRef<HTMLHeadingElement>(null);

  useEffect(() => { tituloRef.current?.focus(); }, [nova, selecionada?.id]);
  useEffect(() => {
    const controller = new AbortController();
    let consultando = false;
    async function carregar() {
      if (consultando) return;
      consultando = true; setCarregando(true);
      try {
        const dados = await consultar<NaoConformidade[]>(API, { signal: controller.signal });
        if (!controller.signal.aborted) { setRegistros(dados); setErro(''); }
      } catch (error: any) { if (!controller.signal.aborted) setErro(error.message); }
      finally { consultando = false; if (!controller.signal.aborted) setCarregando(false); }
    }
    void carregar();
    const timer = window.setInterval(carregar, 30000);
    return () => { controller.abort(); window.clearInterval(timer); };
  }, [atualizacao]);

  function salva(nc: NaoConformidade) {
    setRegistros((atuais) => [nc, ...atuais.filter((item) => item.id !== nc.id)]);
    setSelecionada(nc); setNova(false);
    setMensagem(`Não conformidade ${nc.protocolo} ${nova ? 'aberta' : 'atualizada'} com sucesso.`);
  }
  const base = registros.filter((nc) => !departamento || (direcao === 'origem' ? nc.departamentoOrigemId : nc.departamentoResponsavelId) === departamento);
  const normalizar = (texto: string) => texto.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('pt-BR');
  const filtradas = base.filter((nc) => (!status || nc.status === status) && (!apenasAtrasadas || ncAtrasada(nc)) && normalizar([nc.protocolo, nc.titulo, nc.descricao, nc.responsavel, nomeDepartamento(nc.departamentoOrigemId), nomeDepartamento(nc.departamentoResponsavelId)].join(' ')).includes(normalizar(busca.trim())));
  const voltar = () => { setSelecionada(null); setNova(false); setMensagem(''); setAtualizacao((n) => n + 1); };

  return <div className="space-y-5 pb-8">
    <header className="flex flex-wrap items-start justify-between gap-4">
      <div>{(nova || selecionada) && <button type="button" onClick={voltar} className="mb-3 flex min-h-10 items-center gap-1 text-xs font-bold text-neutral-500"><ArrowLeft className="h-4 w-4" />Voltar às não conformidades</button>}
        <span className="text-xs font-bold uppercase tracking-widest text-yellow-600">Gestão da qualidade</span>
        <h1 ref={tituloRef} tabIndex={-1} className="mt-1 flex items-center gap-2 text-2xl font-black outline-none sm:text-3xl"><ShieldCheck className="h-7 w-7 shrink-0 text-yellow-500" />Não conformidades</h1>
        <p className="mt-1 text-sm text-neutral-500">Registre desvios entre departamentos e acompanhe as ações corretivas.</p>
      </div>
      {!nova && !selecionada && <button onClick={() => { setNova(true); setMensagem(''); }} className={`${botao} bg-yellow-400 text-black hover:bg-yellow-500`}><Plus className="h-4 w-4" />Nova não conformidade</button>}
    </header>
    {mensagem && <p role="status" className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">{mensagem}</p>}
    {nova ? <NovaNaoConformidade departamentoInicial={departamentoInicial} onCancelar={voltar} onSalva={salva} /> : selecionada ? <DetalheNaoConformidade key={`${selecionada.id}:${selecionada.versao}`} nc={selecionada} onSalva={salva} /> : <>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">{[
        ['Em aberto', base.filter((nc) => nc.status === 'Aberta').length],
        ['Em análise / tratamento', base.filter((nc) => !ncFinalizada(nc) && nc.status !== 'Aberta').length],
        ['Prazo vencido', base.filter((nc) => ncAtrasada(nc)).length],
        ['Concluídas', base.filter((nc) => nc.status === 'Concluída').length],
      ].map(([rotulo, quantidade]) => <div key={rotulo} className="rounded-2xl border border-neutral-200 p-4"><span className="text-xs font-bold text-neutral-500">{rotulo}</span><strong className={`mt-2 block text-2xl ${rotulo === 'Prazo vencido' && quantidade ? 'text-red-600' : 'text-neutral-900'}`}>{carregando && !registros.length ? '—' : quantidade}</strong></div>)}</div>
      <section className="overflow-hidden rounded-2xl border border-neutral-200 bg-white">
        <div className="space-y-3 border-b border-neutral-200 bg-neutral-50 p-4">
          <div className="grid items-end gap-3 sm:grid-cols-2 xl:grid-cols-[minmax(180px,1fr)_180px_160px_180px]">
            <Campo titulo="Buscar não conformidade"><div className="relative"><Search className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-neutral-400" /><input className={`${campo} pl-9`} value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Protocolo, título ou responsável" /></div></Campo>
            <Campo titulo="Departamento"><select className={campo} value={departamento} onChange={(e) => setDepartamento(e.target.value)}><option value="">Todos os departamentos</option>{initialDepartments.map((dep) => <option key={dep.id} value={dep.id}>{dep.name}</option>)}</select></Campo>
            <Campo titulo="Participação"><select className={campo} value={direcao} onChange={(e) => setDirecao(e.target.value)}><option value="responsavel">Responsável</option><option value="origem">Origem</option></select></Campo>
            <Campo titulo="Status"><select className={campo} value={status} onChange={(e) => setStatus(e.target.value)}><option value="">Todos os status</option>{STATUS_NC.map((s) => <option key={s}>{s}</option>)}</select></Campo>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-2"><label className="flex min-h-10 items-center gap-2 text-xs font-semibold"><input type="checkbox" className="h-4 w-4 accent-yellow-500" checked={apenasAtrasadas} onChange={(e) => setApenasAtrasadas(e.target.checked)} />Somente com prazo vencido</label><button disabled={carregando} onClick={() => setAtualizacao((n) => n + 1)} className={`${botao} text-neutral-600`}><RefreshCw className={`h-4 w-4 ${carregando ? 'animate-spin motion-reduce:animate-none' : ''}`} />{carregando ? 'Atualizando...' : 'Atualizar'}</button></div>
        </div>
        {erro && <p role="alert" className="bg-red-50 p-4 text-sm text-red-700">{erro}</p>}
        <div className="overflow-x-auto"><table className="w-full min-w-[850px] text-left text-sm"><thead className="bg-neutral-950 text-xs text-white"><tr>{['Não conformidade', 'Origem → Responsável', 'Prioridade', 'Prazo', 'Status', ''].map((nome, i) => <th key={i} className="px-4 py-3">{nome || <span className="sr-only">Ações</span>}</th>)}</tr></thead>
          <tbody className="divide-y divide-neutral-100">{filtradas.map((nc) => <tr key={nc.id} className="hover:bg-yellow-50/50">
            <td className="max-w-[300px] px-4 py-4"><span className="font-mono text-[11px] text-neutral-500">{nc.protocolo}</span><button className="mt-1 block text-left font-bold text-neutral-900 hover:underline" onClick={() => { setSelecionada(nc); setMensagem(''); }}>{nc.titulo}</button><span className="mt-1 block text-xs text-neutral-500">{nc.responsavel || 'Responsável a definir'}</span></td>
            <td className="px-4 py-4 text-xs"><span className="block text-neutral-500">{nomeDepartamento(nc.departamentoOrigemId)}</span><span className="mt-1 block font-bold">→ {nomeDepartamento(nc.departamentoResponsavelId)}</span></td>
            <td className={`px-4 py-4 text-xs font-bold ${['Alta', 'Urgente'].includes(nc.prioridade) ? 'text-red-600' : 'text-neutral-600'}`}>{nc.prioridade}</td>
            <td className={`whitespace-nowrap px-4 py-4 text-xs ${ncAtrasada(nc) ? 'font-bold text-red-600' : 'text-neutral-600'}`}>{dataPrazo(nc.prazo)}{ncAtrasada(nc) && <span className="mt-1 block">Vencido</span>}</td>
            <td className="whitespace-nowrap px-4 py-4"><Status nc={nc} /></td>
            <td className="px-4 py-4"><button onClick={() => { setSelecionada(nc); setMensagem(''); }} aria-label={`Abrir ${nc.protocolo}`} className={`${botao} bg-neutral-100 hover:bg-yellow-400`}>Abrir</button></td>
          </tr>)}</tbody>
        </table></div>
        {!filtradas.length && <div className="p-10 text-center"><ClipboardCheck className="mx-auto mb-3 h-8 w-8 text-neutral-300" /><p className="font-bold">{carregando ? 'Carregando não conformidades...' : erro ? 'Não foi possível carregar os registros.' : registros.length ? 'Nenhuma não conformidade corresponde aos filtros.' : 'Nenhuma não conformidade registrada.'}</p><p className="mt-1 text-sm text-neutral-500">{!carregando && !erro && (registros.length ? 'Ajuste os filtros para encontrar outros registros.' : 'Use “Nova não conformidade” para registrar a primeira ocorrência.')}</p></div>}
        <p className="border-t border-neutral-100 px-4 py-3 text-xs text-neutral-500">{filtradas.length} registro(s) · Atualização automática a cada 30 segundos</p>
      </section>
    </>}
  </div>;
}
