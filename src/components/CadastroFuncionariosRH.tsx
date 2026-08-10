import React, { useEffect, useState } from 'react';
import { UserPlus, X, Send, Trash2, Users, AlertTriangle } from 'lucide-react';
import { Funcionario } from '../types';

interface CadastroFuncionariosRHProps {
  setores: string[];
}

const CAMPOS_INICIAIS = {
  nome: '',
  cargo: '',
  email: '',
  telefone: '',
  dataAdmissao: '',
};

export const CadastroFuncionariosRH: React.FC<CadastroFuncionariosRHProps> = ({ setores }) => {
  const [funcionarios, setFuncionarios] = useState<Funcionario[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erroLista, setErroLista] = useState<string | null>(null);

  const [formAberto, setFormAberto] = useState(false);
  const [campos, setCampos] = useState(CAMPOS_INICIAIS);
  const [setor, setSetor] = useState(setores[0] || '');
  const [status, setStatus] = useState<'Ativo' | 'Inativo'>('Ativo');
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
      setFuncionarios((prev) => [...prev, data].sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR')));
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
    try {
      const res = await fetch(`/api/rh/funcionarios/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error();
    } catch {
      setFuncionarios(anteriores);
      setErroLista('Falha ao remover funcionário — tente novamente.');
    }
  }

  return (
    <div className="rounded-[2rem] bg-white border border-neutral-200 p-6 space-y-5 shadow-sm">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <h3 className="text-sm font-extrabold text-neutral-900 uppercase tracking-wider flex items-center gap-2">
          <Users className="w-5 h-5 text-yellow-600" aria-hidden="true" />
          Funcionários Cadastrados
          <span className="px-2 py-0.5 rounded-full bg-neutral-50 border border-neutral-200 text-[10px] font-mono font-bold text-neutral-500">
            {funcionarios.length}
          </span>
        </h3>
        <button
          type="button"
          onClick={abrirForm}
          className="flex items-center gap-2 px-4 py-2 rounded-full bg-yellow-400 text-black font-extrabold text-xs hover:bg-yellow-300 shadow-sm active:scale-95 transition-all"
        >
          <UserPlus className="w-3.5 h-3.5" aria-hidden="true" />
          Cadastrar Funcionário
        </button>
      </div>

      {carregando ? (
        <p className="text-xs text-neutral-500 py-6 text-center">Carregando...</p>
      ) : erroLista ? (
        <p className="text-xs text-red-600 py-6 text-center">{erroLista}</p>
      ) : funcionarios.length === 0 ? (
        <p className="text-xs text-neutral-500 py-6 text-center">Nenhum funcionário cadastrado ainda.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-neutral-600">
            <thead className="bg-neutral-50 border-b border-neutral-200 text-neutral-500 uppercase font-mono text-[10px] tracking-wider">
              <tr>
                <th className="p-3">Nome</th>
                <th className="p-3">Cargo</th>
                <th className="p-3">Setor</th>
                <th className="p-3">Contato</th>
                <th className="p-3">Admissão</th>
                <th className="p-3">Status</th>
                <th className="p-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100">
              {funcionarios.map((f) => (
                <tr key={f.id} className="hover:bg-neutral-50 transition-colors">
                  <td className="p-3 font-bold text-neutral-900">{f.nome}</td>
                  <td className="p-3">{f.cargo}</td>
                  <td className="p-3">{f.setor}</td>
                  <td className="p-3">
                    {f.email && <span className="block truncate max-w-[160px]">{f.email}</span>}
                    {f.telefone && <span className="block text-neutral-400">{f.telefone}</span>}
                    {!f.email && !f.telefone && <span className="text-neutral-300">—</span>}
                  </td>
                  <td className="p-3">{f.dataAdmissao || <span className="text-neutral-300">—</span>}</td>
                  <td className="p-3">
                    <span
                      className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${
                        f.status === 'Ativo'
                          ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                          : 'bg-neutral-100 text-neutral-500 border-neutral-200'
                      }`}
                    >
                      {f.status}
                    </span>
                  </td>
                  <td className="p-3 text-right">
                    <button
                      type="button"
                      title="Remover funcionário"
                      onClick={() => handleRemover(f.id)}
                      className="w-7 h-7 flex items-center justify-center rounded-full bg-neutral-50 text-neutral-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {formAberto && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4" onClick={() => setFormAberto(false)}>
          <div
            className="bg-white border border-neutral-200 rounded-[2rem] w-full max-w-lg p-6 sm:p-8 space-y-5 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-neutral-200 pb-4">
              <h2 className="text-base font-extrabold text-neutral-900 uppercase tracking-wider flex items-center gap-2">
                <UserPlus className="w-5 h-5 text-yellow-600" aria-hidden="true" />
                Cadastrar Funcionário
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
                  <label className="block text-neutral-600 font-semibold mb-1.5">Status</label>
                  <div className="flex gap-2">
                    {(['Ativo', 'Inativo'] as const).map((s) => (
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
