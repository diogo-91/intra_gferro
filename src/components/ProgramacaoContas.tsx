import React, { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, ArrowDown, ArrowUp, ArrowUpDown, ClipboardList, Loader2, Pencil, Plus, Search, Trash2, X } from 'lucide-react';
import type { ProgramacaoConta } from '../types';
import { chaveDia, formatDataIsoParaBr } from '../utils/format';

type CampoOrdenacao = 'data' | 'nome' | 'criador' | 'autorizado' | 'pago';
type Direcao = 'asc' | 'desc';

interface FormularioConta {
  nome: string;
  data: string;
  autorizado: boolean;
  pago: boolean;
}

const normalizar = (texto: string) => texto.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase();

async function lerResposta(res: Response) {
  const corpo = res.status === 204 ? null : await res.json().catch(() => null);
  if (!res.ok) throw new Error(corpo?.error || 'Não foi possível concluir a operação.');
  return corpo;
}

const ESTILO_PAGAMENTO = {
  true: 'border-emerald-300 bg-emerald-50 text-emerald-700',
  false: 'border-red-300 bg-red-50 text-red-600',
} as const;

export const ProgramacaoContas: React.FC = () => {
  const [contas, setContas] = useState<ProgramacaoConta[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState('');
  const [busca, setBusca] = useState('');
  const [ordenacao, setOrdenacao] = useState<{ campo: CampoOrdenacao; direcao: Direcao }>({ campo: 'data', direcao: 'desc' });
  const [modal, setModal] = useState<{ conta: ProgramacaoConta | null } | null>(null);
  const [formulario, setFormulario] = useState<FormularioConta>({ nome: '', data: '', autorizado: false, pago: false });
  const [salvando, setSalvando] = useState(false);
  const [erroModal, setErroModal] = useState('');

  useEffect(() => {
    fetch('/api/programacao')
      .then(lerResposta)
      .then(setContas)
      .catch((e) => setErro(e.message))
      .finally(() => setCarregando(false));
  }, []);

  const contasVisiveis = useMemo(() => {
    const termo = normalizar(busca.trim());
    const filtradas = termo ? contas.filter((conta) => normalizar(conta.nome).includes(termo)) : contas;
    const fator = ordenacao.direcao === 'asc' ? 1 : -1;
    return [...filtradas].sort((a, b) => {
      switch (ordenacao.campo) {
        case 'data': return fator * a.data.localeCompare(b.data);
        case 'nome': return fator * a.nome.localeCompare(b.nome, 'pt-BR');
        case 'criador': return fator * a.criador.localeCompare(b.criador, 'pt-BR');
        case 'autorizado': return fator * (Number(a.autorizado) - Number(b.autorizado));
        case 'pago': return fator * (Number(a.pago) - Number(b.pago));
      }
    });
  }, [contas, busca, ordenacao]);

  const alternarOrdenacao = (campo: CampoOrdenacao) =>
    setOrdenacao((atual) => atual.campo === campo
      ? { campo, direcao: atual.direcao === 'asc' ? 'desc' : 'asc' }
      : { campo, direcao: campo === 'data' ? 'desc' : 'asc' });

  const abrirNova = () => {
    setFormulario({ nome: '', data: chaveDia(new Date()), autorizado: false, pago: false });
    setErroModal('');
    setModal({ conta: null });
  };

  const abrirEdicao = (conta: ProgramacaoConta) => {
    setFormulario({ nome: conta.nome, data: conta.data, autorizado: conta.autorizado, pago: conta.pago });
    setErroModal('');
    setModal({ conta });
  };

  const salvar = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!modal) return;
    setSalvando(true); setErroModal('');
    try {
      const conta = modal.conta;
      const salva: ProgramacaoConta = await lerResposta(await fetch(conta ? `/api/programacao/${conta.id}` : '/api/programacao', {
        method: conta ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formulario),
      }));
      setContas((atuais) => conta ? atuais.map((item) => (item.id === salva.id ? salva : item)) : [...atuais, salva]);
      setModal(null);
    } catch (e: any) {
      setErroModal(e.message);
    } finally {
      setSalvando(false);
    }
  };

  // Seletor "Pagamento" direto na tabela: atualiza na hora e volta atrás se o servidor recusar.
  const alterarAutorizacao = async (conta: ProgramacaoConta, autorizado: boolean) => {
    setErro('');
    setContas((atuais) => atuais.map((item) => (item.id === conta.id ? { ...item, autorizado } : item)));
    try {
      const salva: ProgramacaoConta = await lerResposta(await fetch(`/api/programacao/${conta.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ autorizado }),
      }));
      setContas((atuais) => atuais.map((item) => (item.id === salva.id ? salva : item)));
    } catch (e: any) {
      setContas((atuais) => atuais.map((item) => (item.id === conta.id ? conta : item)));
      setErro(e.message);
    }
  };

  const remover = async (conta: ProgramacaoConta) => {
    if (!window.confirm(`Remover a conta "${conta.nome}"?`)) return;
    setErro('');
    try {
      await lerResposta(await fetch(`/api/programacao/${conta.id}`, { method: 'DELETE' }));
      setContas((atuais) => atuais.filter((item) => item.id !== conta.id));
    } catch (e: any) {
      setErro(e.message);
    }
  };

  const colunas: Array<{ campo: CampoOrdenacao; titulo: string }> = [
    { campo: 'data', titulo: 'Data' },
    { campo: 'nome', titulo: 'Nome da conta' },
    { campo: 'criador', titulo: 'Criador da conta' },
    { campo: 'autorizado', titulo: 'Pagamento' },
    { campo: 'pago', titulo: 'Status' },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center gap-4">
        <div className="flex items-center gap-4 min-w-0">
          <span className="w-12 h-12 shrink-0 rounded-2xl bg-yellow-100 text-yellow-700 flex items-center justify-center">
            <ClipboardList className="w-6 h-6" aria-hidden="true" />
          </span>
          <div className="min-w-0">
            <span className="text-xs font-bold uppercase tracking-widest text-yellow-600">Financeiro • Programação</span>
            <h1 className="text-2xl font-black text-neutral-900 leading-tight">Contas</h1>
            <p className="text-neutral-500 text-sm">Gerencie as contas e seus pagamentos</p>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row gap-3 sm:ml-auto sm:items-center">
          <label className="relative block">
            <span className="sr-only">Buscar por nome da conta</span>
            <Search className="w-4 h-4 text-neutral-400 absolute left-3.5 top-1/2 -translate-y-1/2" aria-hidden="true" />
            <input
              type="search"
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder="Buscar por nome da conta..."
              className="w-full sm:w-72 rounded-xl border border-neutral-200 bg-white pl-10 pr-4 py-2.5 text-sm outline-none focus:border-yellow-500"
            />
          </label>
          <button
            type="button"
            onClick={abrirNova}
            className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-yellow-400 text-black font-extrabold text-sm hover:bg-yellow-300 active:scale-95 transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-yellow-500"
          >
            <Plus className="w-4 h-4" aria-hidden="true" />
            Nova conta
          </button>
        </div>
      </div>

      {erro && (
        <div role="alert" className="flex gap-2 p-3 rounded-xl bg-red-50 border border-red-200 text-xs text-red-700">
          <AlertTriangle className="w-4 h-4 shrink-0" aria-hidden="true" />
          {erro}
        </div>
      )}

      <div className="rounded-2xl border border-neutral-200 bg-white shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[820px] text-sm">
            <thead className="bg-neutral-50 border-b border-neutral-200">
              <tr>
                {colunas.map(({ campo, titulo }) => {
                  const ativa = ordenacao.campo === campo;
                  const Icone = !ativa ? ArrowUpDown : ordenacao.direcao === 'asc' ? ArrowUp : ArrowDown;
                  return (
                    <th
                      key={campo}
                      scope="col"
                      aria-sort={ativa ? (ordenacao.direcao === 'asc' ? 'ascending' : 'descending') : 'none'}
                      className="text-left px-5 py-4 font-extrabold text-neutral-900"
                    >
                      <button type="button" onClick={() => alternarOrdenacao(campo)} className="flex items-center gap-2 hover:text-yellow-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-yellow-500 rounded">
                        {titulo}
                        <Icone className={`w-3.5 h-3.5 ${ativa ? 'text-yellow-600' : 'text-neutral-400'}`} aria-hidden="true" />
                      </button>
                    </th>
                  );
                })}
                <th scope="col" className="text-left px-5 py-4 font-extrabold text-neutral-900">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100">
              {carregando ? (
                <tr><td colSpan={6} className="px-5 py-12 text-center text-neutral-500"><Loader2 className="w-5 h-5 animate-spin inline-block mr-2 text-yellow-600" aria-hidden="true" />Carregando contas...</td></tr>
              ) : contasVisiveis.length === 0 ? (
                <tr><td colSpan={6} className="px-5 py-12 text-center text-neutral-500">{contas.length === 0 ? 'Nenhuma conta cadastrada ainda. Clique em "Nova conta" para começar.' : 'Nenhuma conta encontrada para essa busca.'}</td></tr>
              ) : contasVisiveis.map((conta) => (
                <tr key={conta.id} className="hover:bg-neutral-50/60">
                  <td className="px-5 py-3.5 whitespace-nowrap tabular-nums text-neutral-700">{formatDataIsoParaBr(conta.data)}</td>
                  <td className="px-5 py-3.5 text-neutral-900 min-w-[180px]">{conta.nome}</td>
                  <td className="px-5 py-3.5 text-neutral-700">{conta.criador}</td>
                  <td className="px-5 py-3.5">
                    <select
                      aria-label={`Pagamento da conta ${conta.nome}`}
                      value={conta.autorizado ? 'sim' : 'nao'}
                      onChange={(e) => alterarAutorizacao(conta, e.target.value === 'sim')}
                      className={`w-44 rounded-lg border px-3 py-2 text-sm font-medium outline-none focus:ring-2 focus:ring-yellow-400 ${ESTILO_PAGAMENTO[String(conta.autorizado) as 'true' | 'false']}`}
                    >
                      <option value="sim">Autorizado</option>
                      <option value="nao">Não autorizado</option>
                    </select>
                  </td>
                  <td className="px-5 py-3.5">
                    <span className={`inline-flex items-center gap-2 whitespace-nowrap rounded-full px-3.5 py-1.5 text-sm font-medium ${conta.pago ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-600'}`}>
                      <span className={`w-2.5 h-2.5 rounded-full ${conta.pago ? 'bg-emerald-500' : 'bg-red-500'}`} aria-hidden="true" />
                      {conta.pago ? 'Pago' : 'Não pago'}
                    </span>
                  </td>
                  <td className="px-5 py-3.5">
                    <div className="flex gap-2">
                      <button type="button" onClick={() => abrirEdicao(conta)} title="Editar conta" aria-label={`Editar conta ${conta.nome}`} className="w-10 h-10 rounded-lg border border-blue-200 bg-blue-50 text-blue-600 hover:bg-blue-100 flex items-center justify-center focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400">
                        <Pencil className="w-4 h-4" aria-hidden="true" />
                      </button>
                      <button type="button" onClick={() => remover(conta)} title="Remover conta" aria-label={`Remover conta ${conta.nome}`} className="w-10 h-10 rounded-lg border border-red-200 bg-red-50 text-red-600 hover:bg-red-100 flex items-center justify-center focus:outline-none focus-visible:ring-2 focus-visible:ring-red-400">
                        <Trash2 className="w-4 h-4" aria-hidden="true" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {modal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60" role="dialog" aria-modal="true" aria-labelledby="titulo-modal-conta" onMouseDown={(e) => { if (e.target === e.currentTarget && !salvando) setModal(null); }}>
          <form onSubmit={salvar} className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between">
              <h2 id="titulo-modal-conta" className="text-lg font-black text-neutral-900">{modal.conta ? 'Editar conta' : 'Nova conta'}</h2>
              <button type="button" onClick={() => setModal(null)} aria-label="Fechar" className="p-1.5 rounded-lg text-neutral-400 hover:text-neutral-700 hover:bg-neutral-100"><X className="w-5 h-5" /></button>
            </div>

            <label className="block text-xs font-bold text-neutral-600">Nome da conta
              <input required minLength={2} maxLength={120} autoFocus value={formulario.nome} onChange={(e) => setFormulario({ ...formulario, nome: e.target.value })} placeholder="Ex.: Fornecedor ABC" className="mt-2 w-full rounded-xl border border-neutral-200 px-4 py-3 text-sm font-normal outline-none focus:border-yellow-500" />
            </label>
            <label className="block text-xs font-bold text-neutral-600">Data
              <input required type="date" value={formulario.data} onChange={(e) => setFormulario({ ...formulario, data: e.target.value })} className="mt-2 w-full rounded-xl border border-neutral-200 px-4 py-3 text-sm font-normal outline-none focus:border-yellow-500" />
            </label>
            <div className="grid grid-cols-2 gap-3">
              <label className="block text-xs font-bold text-neutral-600">Pagamento
                <select value={formulario.autorizado ? 'sim' : 'nao'} onChange={(e) => setFormulario({ ...formulario, autorizado: e.target.value === 'sim' })} className="mt-2 w-full rounded-xl border border-neutral-200 px-3 py-3 text-sm font-normal outline-none focus:border-yellow-500">
                  <option value="nao">Não autorizado</option>
                  <option value="sim">Autorizado</option>
                </select>
              </label>
              <label className="block text-xs font-bold text-neutral-600">Status
                <select value={formulario.pago ? 'sim' : 'nao'} onChange={(e) => setFormulario({ ...formulario, pago: e.target.value === 'sim' })} className="mt-2 w-full rounded-xl border border-neutral-200 px-3 py-3 text-sm font-normal outline-none focus:border-yellow-500">
                  <option value="nao">Não pago</option>
                  <option value="sim">Pago</option>
                </select>
              </label>
            </div>

            {erroModal && <div role="alert" className="flex gap-2 p-3 rounded-xl bg-red-50 text-red-700 text-xs"><AlertTriangle className="w-4 h-4 shrink-0" aria-hidden="true" />{erroModal}</div>}

            <div className="flex gap-2 pt-1">
              <button type="button" onClick={() => setModal(null)} disabled={salvando} className="rounded-xl border border-neutral-300 px-4 py-3 text-sm font-bold text-neutral-600 hover:bg-neutral-50">Cancelar</button>
              <button type="submit" disabled={salvando} className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-yellow-400 hover:bg-yellow-300 py-3 text-sm font-black text-black disabled:opacity-60">
                {salvando && <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />}
                {modal.conta ? 'Salvar alterações' : 'Cadastrar conta'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
