import React, { useEffect, useMemo, useState } from 'react';
import {
  UserPlus,
  X,
  Send,
  Trash2,
  Users,
  CheckCircle2,
  TrendingUp,
  Cake,
  Search,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Grid,
  List,
  MoreHorizontal,
  AlertTriangle,
  Mail,
  Phone,
} from 'lucide-react';
import { Funcionario } from '../types';
import { formatDataIsoParaBr } from '../utils/format';

interface CadastroFuncionariosRHProps {
  setores: string[];
}

const CAMPOS_INICIAIS = {
  nome: '',
  cargo: '',
  email: '',
  telefone: '',
  dataAdmissao: '',
  dataNascimento: '',
};

const ITENS_POR_PAGINA = 8;

const STATUS_BADGE: Record<Funcionario['status'], string> = {
  Ativo: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  'Férias': 'bg-amber-50 text-amber-700 border-amber-200',
  Inativo: 'bg-neutral-100 text-neutral-500 border-neutral-200',
};

const STATUS_DOT: Record<Funcionario['status'], string> = {
  Ativo: 'bg-emerald-500',
  'Férias': 'bg-amber-500',
  Inativo: 'bg-neutral-400',
};

const CORES_AVATAR = [
  'bg-yellow-400 text-black',
  'bg-sky-500 text-white',
  'bg-emerald-500 text-white',
  'bg-purple-500 text-white',
  'bg-orange-500 text-white',
  'bg-pink-500 text-white',
];

function iniciais(nome: string): string {
  const partes = nome.trim().split(/\s+/);
  const primeira = partes[0]?.[0] || '';
  const ultima = partes.length > 1 ? partes[partes.length - 1][0] : '';
  return (primeira + ultima).toUpperCase();
}

function corAvatar(nome: string): string {
  let hash = 0;
  for (let i = 0; i < nome.length; i++) hash = (hash * 31 + nome.charCodeAt(i)) >>> 0;
  return CORES_AVATAR[hash % CORES_AVATAR.length];
}

function mesmoMesAno(dataIso: string, ano: number, mes: number): boolean {
  const [anoStr, mesStr] = dataIso.split('-');
  return Number(anoStr) === ano && Number(mesStr) - 1 === mes;
}

// Próxima ocorrência do dia/mês de nascimento a partir de hoje, dentro de 30 dias.
function aniversarioNosProximos30Dias(dataIso: string, hoje: Date): boolean {
  const [, mesStr, diaStr] = dataIso.split('-');
  const mes = Number(mesStr) - 1;
  const dia = Number(diaStr);
  let proximo = new Date(hoje.getFullYear(), mes, dia);
  if (proximo < hoje) proximo = new Date(hoje.getFullYear() + 1, mes, dia);
  const diffDias = Math.round((proximo.getTime() - hoje.getTime()) / 86_400_000);
  return diffDias >= 0 && diffDias <= 30;
}

export const CadastroFuncionariosRH: React.FC<CadastroFuncionariosRHProps> = ({ setores }) => {
  const [funcionarios, setFuncionarios] = useState<Funcionario[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erroLista, setErroLista] = useState<string | null>(null);

  const [busca, setBusca] = useState('');
  const [filtroSetor, setFiltroSetor] = useState('');
  const [filtroStatus, setFiltroStatus] = useState('');
  const [viewMode, setViewMode] = useState<'lista' | 'grade'>('lista');
  const [pagina, setPagina] = useState(1);
  const [menuAbertoId, setMenuAbertoId] = useState<string | null>(null);

  const [formAberto, setFormAberto] = useState(false);
  const [campos, setCampos] = useState(CAMPOS_INICIAIS);
  const [setor, setSetor] = useState(setores[0] || '');
  const [status, setStatus] = useState<Funcionario['status']>('Ativo');
  const [salvando, setSalvando] = useState(false);
  const [erroForm, setErroForm] = useState<string | null>(null);

  function carregarLista() {
    setCarregando(true);
    setErroLista(null);
    fetch('/api/rh/funcionarios')
      .then((res) => res.json())
      .then((data) => setFuncionarios(Array.isArray(data) ? data : []))
      .catch(() => setErroLista('Falha ao carregar funcionários cadastrados.'))
      .finally(() => setCarregando(false));
  }

  useEffect(() => {
    carregarLista();
  }, []);

  const hoje = useMemo(() => {
    const agora = new Date();
    return new Date(agora.getFullYear(), agora.getMonth(), agora.getDate());
  }, []);

  // ---- KPIs — sempre sobre a lista COMPLETA, não a filtrada pela busca/tabela ----
  const totalFuncionarios = funcionarios.length;
  const ativos = funcionarios.filter((f) => f.status === 'Ativo').length;
  const pctAtivos = totalFuncionarios > 0 ? Math.round((ativos / totalFuncionarios) * 1000) / 10 : 0;

  const admissoesEsteMes = funcionarios.filter(
    (f) => f.dataAdmissao && mesmoMesAno(f.dataAdmissao, hoje.getFullYear(), hoje.getMonth())
  ).length;
  const mesAnterior = new Date(hoje.getFullYear(), hoje.getMonth() - 1, 1);
  const admissoesMesAnterior = funcionarios.filter(
    (f) => f.dataAdmissao && mesmoMesAno(f.dataAdmissao, mesAnterior.getFullYear(), mesAnterior.getMonth())
  ).length;
  const deltaAdmissoes = admissoesEsteMes - admissoesMesAnterior;

  const aniversariantes = funcionarios.filter(
    (f) => f.dataNascimento && aniversarioNosProximos30Dias(f.dataNascimento, hoje)
  ).length;

  // ---- Lista filtrada (busca + setor + status) pra tabela/grade + paginação ----
  const filtrados = useMemo(() => {
    const alvo = busca.trim().toLowerCase();
    return funcionarios.filter((f) => {
      if (filtroSetor && f.setor !== filtroSetor) return false;
      if (filtroStatus && f.status !== filtroStatus) return false;
      if (!alvo) return true;
      return (
        f.nome.toLowerCase().includes(alvo) ||
        f.cargo.toLowerCase().includes(alvo) ||
        (f.email || '').toLowerCase().includes(alvo)
      );
    });
  }, [funcionarios, busca, filtroSetor, filtroStatus]);

  const totalPaginas = Math.max(1, Math.ceil(filtrados.length / ITENS_POR_PAGINA));
  const paginaAtual = Math.min(pagina, totalPaginas);
  const inicioPagina = (paginaAtual - 1) * ITENS_POR_PAGINA;
  const paginaDados = filtrados.slice(inicioPagina, inicioPagina + ITENS_POR_PAGINA);

  function atualizarFiltro(fn: () => void) {
    fn();
    setPagina(1);
  }

  function abrirForm() {
    setCampos(CAMPOS_INICIAIS);
    setSetor(setores[0] || '');
    setStatus('Ativo');
    setErroForm(null);
    setFormAberto(true);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSalvando(true);
    setErroForm(null);
    try {
      const res = await fetch('/api/rh/funcionarios', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...campos, setor, status }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || 'Falha ao cadastrar funcionário.');
      setFuncionarios((prev) => [...prev, data]);
      setFormAberto(false);
    } catch (err: any) {
      setErroForm(err.message || 'Falha ao cadastrar funcionário.');
    } finally {
      setSalvando(false);
    }
  }

  async function handleRemover(id: string) {
    const anteriores = funcionarios;
    setFuncionarios((prev) => prev.filter((f) => f.id !== id));
    setMenuAbertoId(null);
    try {
      const res = await fetch(`/api/rh/funcionarios/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error();
    } catch {
      setFuncionarios(anteriores);
      setErroLista('Falha ao remover funcionário — tente novamente.');
    }
  }

  const KPIS = [
    {
      titulo: 'Funcionários',
      valor: totalFuncionarios,
      legenda: admissoesEsteMes > 0 ? `+${admissoesEsteMes} este mês` : 'sem admissões este mês',
      Icon: Users,
    },
    {
      titulo: 'Ativos',
      valor: ativos,
      legenda: totalFuncionarios > 0 ? `${pctAtivos}% do quadro` : '—',
      Icon: CheckCircle2,
    },
    {
      titulo: 'Admissões',
      valor: admissoesEsteMes,
      legenda:
        deltaAdmissoes === 0 ? 'sem variação vs. mês anterior' : `${deltaAdmissoes > 0 ? '+' : ''}${deltaAdmissoes} vs. mês anterior`,
      Icon: TrendingUp,
    },
    {
      titulo: 'Aniversariantes',
      valor: aniversariantes,
      legenda: 'nos próximos 30 dias',
      Icon: Cake,
    },
  ];

  return (
    <div className="space-y-6 pb-12">
      {/* Cabeçalho */}
      <div>
        <p className="text-[11px] text-neutral-500 font-semibold mb-1">Departamentos / RH</p>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-black text-neutral-900 tracking-tight">Recursos Humanos</h1>
            <p className="text-sm text-neutral-500 mt-1">Gerencie colaboradores, admissões e informações da equipe.</p>
          </div>
          <button
            type="button"
            onClick={abrirForm}
            className="flex items-center justify-center gap-2 px-5 py-2.5 rounded-full bg-yellow-400 text-black font-extrabold text-xs hover:bg-yellow-300 shadow-sm active:scale-95 transition-all shrink-0"
          >
            <UserPlus className="w-4 h-4" aria-hidden="true" />
            Novo funcionário
          </button>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {KPIS.map((k) => (
          <div key={k.titulo} className="p-4 rounded-2xl bg-neutral-50 border border-neutral-200 space-y-2">
            <div className="w-8 h-8 rounded-lg bg-yellow-100 flex items-center justify-center">
              <k.Icon className="w-4 h-4 text-yellow-600" aria-hidden="true" />
            </div>
            <div>
              <span className="text-[9px] font-bold text-neutral-500 uppercase tracking-widest block">{k.titulo}</span>
              <span className="text-lg font-black text-neutral-900 block mt-0.5">{k.valor}</span>
              <span className="text-[10px] text-neutral-500 font-semibold">{k.legenda}</span>
            </div>
          </div>
        ))}
      </div>

      {/* Colaboradores */}
      <div className="rounded-[2rem] bg-white border border-neutral-200 p-6 shadow-sm space-y-5">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div>
            <h3 className="text-lg font-extrabold text-neutral-900 flex items-center gap-2">
              Colaboradores
              <span className="px-2.5 py-0.5 rounded-full bg-neutral-50 border border-neutral-200 text-[11px] font-mono font-bold text-neutral-500">
                {totalFuncionarios}
              </span>
            </h3>
            <p className="text-xs text-neutral-500 mt-0.5">Visualize e gerencie os dados dos funcionários.</p>
          </div>
          <div className="flex items-center gap-1 bg-neutral-50 p-1.5 rounded-full border border-neutral-200 shrink-0">
            <button
              type="button"
              onClick={() => setViewMode('lista')}
              title="Visualização em Lista"
              className={`p-2 rounded-full text-xs font-extrabold transition-all ${
                viewMode === 'lista' ? 'bg-yellow-400 text-black shadow-md' : 'text-neutral-500 hover:text-neutral-900'
              }`}
            >
              <List className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => setViewMode('grade')}
              title="Visualização em Grade"
              className={`p-2 rounded-full text-xs font-extrabold transition-all ${
                viewMode === 'grade' ? 'bg-yellow-400 text-black shadow-md' : 'text-neutral-500 hover:text-neutral-900'
              }`}
            >
              <Grid className="w-4 h-4" />
            </button>
          </div>
        </div>

        <div className="flex flex-col lg:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="w-4 h-4 absolute left-4 top-1/2 -translate-y-1/2 text-neutral-400" aria-hidden="true" />
            <input
              type="text"
              value={busca}
              onChange={(e) => atualizarFiltro(() => setBusca(e.target.value))}
              placeholder="Buscar por nome, cargo ou e-mail"
              className="w-full pl-10 pr-4 py-2.5 bg-neutral-50 border border-neutral-200 rounded-full text-xs text-neutral-900 placeholder-neutral-500 focus:outline-none focus:border-yellow-400 transition-all"
            />
          </div>
          <div className="relative">
            <select
              value={filtroSetor}
              onChange={(e) => atualizarFiltro(() => setFiltroSetor(e.target.value))}
              className="appearance-none w-full lg:w-44 pl-4 pr-9 py-2.5 bg-neutral-50 border border-neutral-200 rounded-full text-xs font-semibold text-neutral-700 focus:outline-none focus:border-yellow-400 cursor-pointer"
            >
              <option value="">Todos os setores</option>
              {setores.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
            <ChevronDown className="w-3.5 h-3.5 text-neutral-400 absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          </div>
          <div className="relative">
            <select
              value={filtroStatus}
              onChange={(e) => atualizarFiltro(() => setFiltroStatus(e.target.value))}
              className="appearance-none w-full lg:w-36 pl-4 pr-9 py-2.5 bg-neutral-50 border border-neutral-200 rounded-full text-xs font-semibold text-neutral-700 focus:outline-none focus:border-yellow-400 cursor-pointer"
            >
              <option value="">Status</option>
              <option value="Ativo">Ativo</option>
              <option value="Férias">Férias</option>
              <option value="Inativo">Inativo</option>
            </select>
            <ChevronDown className="w-3.5 h-3.5 text-neutral-400 absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          </div>
        </div>

        {carregando ? (
          <p className="text-xs text-neutral-500 py-10 text-center">Carregando...</p>
        ) : erroLista ? (
          <p className="text-xs text-red-600 py-10 text-center">{erroLista}</p>
        ) : filtrados.length === 0 ? (
          <p className="text-xs text-neutral-500 py-10 text-center">
            {totalFuncionarios === 0 ? 'Nenhum funcionário cadastrado ainda.' : 'Nenhum funcionário encontrado com esse filtro.'}
          </p>
        ) : viewMode === 'lista' ? (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-neutral-600">
              <thead className="bg-neutral-50 border-b border-neutral-200 text-neutral-500 uppercase font-mono text-[10px] tracking-wider">
                <tr>
                  <th className="p-3">Colaborador</th>
                  <th className="p-3">Cargo</th>
                  <th className="p-3">Setor</th>
                  <th className="p-3">Contato</th>
                  <th className="p-3">Admissão</th>
                  <th className="p-3">Status</th>
                  <th className="p-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100">
                {paginaDados.map((f) => (
                  <tr key={f.id} className="hover:bg-neutral-50 transition-colors">
                    <td className="p-3">
                      <div className="flex items-center gap-3">
                        <span className={`w-9 h-9 shrink-0 rounded-xl flex items-center justify-center font-extrabold text-xs ${corAvatar(f.nome)}`}>
                          {iniciais(f.nome)}
                        </span>
                        <div className="min-w-0">
                          <span className="font-bold text-neutral-900 block truncate">{f.nome}</span>
                          {f.email && <span className="text-[10px] text-neutral-500 block truncate">{f.email}</span>}
                        </div>
                      </div>
                    </td>
                    <td className="p-3">{f.cargo}</td>
                    <td className="p-3">
                      <span className="px-2.5 py-0.5 rounded-full bg-neutral-50 border border-neutral-200 text-[10px] font-bold text-neutral-600">
                        {f.setor}
                      </span>
                    </td>
                    <td className="p-3">{f.telefone || <span className="text-neutral-300">—</span>}</td>
                    <td className="p-3">{f.dataAdmissao ? formatDataIsoParaBr(f.dataAdmissao) : <span className="text-neutral-300">—</span>}</td>
                    <td className="p-3">
                      <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${STATUS_BADGE[f.status]}`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${STATUS_DOT[f.status]}`} />
                        {f.status}
                      </span>
                    </td>
                    <td className="p-3 text-right relative">
                      <button
                        type="button"
                        onClick={() => setMenuAbertoId((atual) => (atual === f.id ? null : f.id))}
                        className="w-7 h-7 flex items-center justify-center rounded-full bg-neutral-50 text-neutral-400 hover:text-neutral-700 hover:bg-neutral-100 transition-colors"
                      >
                        <MoreHorizontal className="w-4 h-4" />
                      </button>
                      {menuAbertoId === f.id && (
                        <div
                          className="absolute right-3 top-10 z-10 w-40 bg-white border border-neutral-200 rounded-2xl shadow-xl p-1.5"
                          onMouseLeave={() => setMenuAbertoId(null)}
                        >
                          <button
                            type="button"
                            onClick={() => handleRemover(f.id)}
                            className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-left text-xs font-semibold text-red-600 hover:bg-red-50 transition-colors"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                            Remover funcionário
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {paginaDados.map((f) => (
              <div key={f.id} className="p-5 rounded-[1.5rem] bg-white border border-neutral-200 hover:border-yellow-400/60 transition-all space-y-4 shadow-sm">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-3 min-w-0">
                    <span className={`w-11 h-11 shrink-0 rounded-2xl flex items-center justify-center font-extrabold text-sm ${corAvatar(f.nome)}`}>
                      {iniciais(f.nome)}
                    </span>
                    <div className="min-w-0">
                      <span className="font-bold text-neutral-900 text-sm block truncate">{f.nome}</span>
                      <span className="text-[11px] text-neutral-500 block truncate">{f.cargo}</span>
                    </div>
                  </div>
                  <button
                    type="button"
                    title="Remover funcionário"
                    onClick={() => handleRemover(f.id)}
                    className="w-7 h-7 shrink-0 flex items-center justify-center rounded-full bg-neutral-50 text-neutral-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>

                <div className="flex items-center gap-2 flex-wrap">
                  <span className="px-2.5 py-0.5 rounded-full bg-neutral-50 border border-neutral-200 text-[10px] font-bold text-neutral-600">
                    {f.setor}
                  </span>
                  <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${STATUS_BADGE[f.status]}`}>
                    <span className={`w-1.5 h-1.5 rounded-full ${STATUS_DOT[f.status]}`} />
                    {f.status}
                  </span>
                </div>

                <div className="space-y-1.5 pt-3 border-t border-neutral-100 text-[11px] text-neutral-500">
                  {f.email && (
                    <div className="flex items-center gap-2 truncate">
                      <Mail className="w-3.5 h-3.5 text-neutral-400 shrink-0" />
                      <span className="truncate">{f.email}</span>
                    </div>
                  )}
                  {f.telefone && (
                    <div className="flex items-center gap-2">
                      <Phone className="w-3.5 h-3.5 text-neutral-400 shrink-0" />
                      <span>{f.telefone}</span>
                    </div>
                  )}
                  {f.dataAdmissao && (
                    <div className="flex items-center gap-2">
                      <span className="text-neutral-400">Admissão:</span>
                      <span className="font-semibold text-neutral-600">{formatDataIsoParaBr(f.dataAdmissao)}</span>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {filtrados.length > 0 && (
          <div className="flex items-center justify-between gap-3 pt-2 flex-wrap">
            <span className="text-[11px] text-neutral-500">
              Mostrando {paginaDados.length} de {filtrados.length} colaboradores
            </span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setPagina((p) => Math.max(1, p - 1))}
                disabled={paginaAtual <= 1}
                className="w-8 h-8 flex items-center justify-center rounded-full bg-neutral-50 border border-neutral-200 text-neutral-500 hover:text-yellow-600 hover:border-yellow-400 disabled:opacity-40 disabled:hover:text-neutral-500 disabled:hover:border-neutral-200 transition-all"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <span className="w-8 h-8 flex items-center justify-center rounded-full bg-yellow-400 text-black text-xs font-extrabold">
                {paginaAtual}
              </span>
              <button
                type="button"
                onClick={() => setPagina((p) => Math.min(totalPaginas, p + 1))}
                disabled={paginaAtual >= totalPaginas}
                className="w-8 h-8 flex items-center justify-center rounded-full bg-neutral-50 border border-neutral-200 text-neutral-500 hover:text-yellow-600 hover:border-yellow-400 disabled:opacity-40 disabled:hover:text-neutral-500 disabled:hover:border-neutral-200 transition-all"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>

      {formAberto && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4" onClick={() => setFormAberto(false)}>
          <div
            className="bg-white border border-neutral-200 rounded-[2rem] w-full max-w-lg p-6 sm:p-8 space-y-5 shadow-2xl max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-neutral-200 pb-4">
              <h2 className="text-base font-extrabold text-neutral-900 uppercase tracking-wider flex items-center gap-2">
                <UserPlus className="w-5 h-5 text-yellow-600" aria-hidden="true" />
                Novo Funcionário
              </h2>
              <button
                type="button"
                onClick={() => setFormAberto(false)}
                className="p-2 rounded-full text-neutral-500 hover:text-yellow-600 hover:bg-neutral-100 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4 text-xs">
              <div>
                <label className="block text-neutral-600 font-semibold mb-1.5">Nome Completo *</label>
                <input
                  type="text"
                  required
                  value={campos.nome}
                  onChange={(e) => setCampos((c) => ({ ...c, nome: e.target.value }))}
                  placeholder="Ex: João da Silva"
                  className="w-full px-4 py-2.5 bg-white border border-neutral-200 rounded-full text-neutral-900 placeholder-neutral-500 focus:outline-none focus:border-yellow-400 transition-all"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-neutral-600 font-semibold mb-1.5">Cargo *</label>
                  <input
                    type="text"
                    required
                    value={campos.cargo}
                    onChange={(e) => setCampos((c) => ({ ...c, cargo: e.target.value }))}
                    placeholder="Ex: Analista de RH"
                    className="w-full px-4 py-2.5 bg-white border border-neutral-200 rounded-full text-neutral-900 placeholder-neutral-500 focus:outline-none focus:border-yellow-400 transition-all"
                  />
                </div>
                <div>
                  <label className="block text-neutral-600 font-semibold mb-1.5">Setor *</label>
                  <select
                    value={setor}
                    onChange={(e) => setSetor(e.target.value)}
                    className="w-full px-4 py-2.5 bg-white border border-neutral-200 rounded-full text-neutral-900 focus:outline-none focus:border-yellow-400 transition-all"
                  >
                    {setores.map((s) => (
                      <option key={s} value={s}>{s}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-neutral-600 font-semibold mb-1.5">E-mail</label>
                  <input
                    type="email"
                    value={campos.email}
                    onChange={(e) => setCampos((c) => ({ ...c, email: e.target.value }))}
                    placeholder="joao.silva@gferro.com.br"
                    className="w-full px-4 py-2.5 bg-white border border-neutral-200 rounded-full text-neutral-900 placeholder-neutral-500 focus:outline-none focus:border-yellow-400 transition-all"
                  />
                </div>
                <div>
                  <label className="block text-neutral-600 font-semibold mb-1.5">Telefone / Ramal</label>
                  <input
                    type="text"
                    value={campos.telefone}
                    onChange={(e) => setCampos((c) => ({ ...c, telefone: e.target.value }))}
                    placeholder="(11) 99999-9999"
                    className="w-full px-4 py-2.5 bg-white border border-neutral-200 rounded-full text-neutral-900 placeholder-neutral-500 focus:outline-none focus:border-yellow-400 transition-all"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-neutral-600 font-semibold mb-1.5">Data de Admissão</label>
                  <input
                    type="date"
                    value={campos.dataAdmissao}
                    onChange={(e) => setCampos((c) => ({ ...c, dataAdmissao: e.target.value }))}
                    className="w-full px-4 py-2.5 bg-white border border-neutral-200 rounded-full text-neutral-900 focus:outline-none focus:border-yellow-400 transition-all"
                  />
                </div>
                <div>
                  <label className="block text-neutral-600 font-semibold mb-1.5">Data de Nascimento</label>
                  <input
                    type="date"
                    value={campos.dataNascimento}
                    onChange={(e) => setCampos((c) => ({ ...c, dataNascimento: e.target.value }))}
                    className="w-full px-4 py-2.5 bg-white border border-neutral-200 rounded-full text-neutral-900 focus:outline-none focus:border-yellow-400 transition-all"
                  />
                </div>
              </div>

              <div>
                <label className="block text-neutral-600 font-semibold mb-1.5">Status</label>
                <div className="flex gap-2">
                  {(['Ativo', 'Férias', 'Inativo'] as const).map((s) => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => setStatus(s)}
                      className={`flex-1 py-2 rounded-full border font-bold text-xs transition-all ${
                        status === s
                          ? 'bg-yellow-400 text-black border-yellow-400 shadow-md shadow-yellow-400/20'
                          : 'bg-white text-neutral-500 border-neutral-200 hover:text-neutral-900'
                      }`}
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>

              {erroForm && (
                <div className="flex items-center gap-2 text-xs text-red-600 bg-red-50 border border-red-200 rounded-2xl p-3">
                  <AlertTriangle className="w-4 h-4 shrink-0" aria-hidden="true" />
                  <span>{erroForm}</span>
                </div>
              )}

              <div className="flex justify-end gap-3 pt-4 border-t border-neutral-200">
                <button
                  type="button"
                  onClick={() => setFormAberto(false)}
                  className="px-5 py-2.5 rounded-full bg-neutral-100 text-neutral-600 font-bold hover:bg-neutral-200 transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={salvando}
                  className="px-6 py-2.5 rounded-full bg-yellow-400 text-black font-extrabold hover:bg-yellow-300 flex items-center gap-2 transition-all active:scale-95 disabled:opacity-50"
                >
                  <Send className="w-3.5 h-3.5" aria-hidden="true" />
                  <span>{salvando ? 'Salvando...' : 'Cadastrar'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
