import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AlertTriangle, ArrowDown, ArrowUp, ArrowUpDown, ChevronLeft, ChevronRight, ClipboardList, Loader2, Pencil, Plus, RefreshCw, Search, Trash2, X } from 'lucide-react';
import type { LinhaProgramacao, ProgramacaoConta, RespostaProgramacao } from '../types';
import { chaveDia, formatDataIsoParaBr } from '../utils/format';

type CampoOrdenacao = 'data' | 'nome' | 'criador' | 'valor' | 'autorizado' | 'pago';
type Direcao = 'asc' | 'desc';

interface FormularioConta {
  nome: string;
  data: string;
  autorizado: boolean;
  pago: boolean;
}

const MESES = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];

const normalizar = (texto: string) => texto.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase();

const formatarValor = (valor: number) => valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

const mesDe = (data: Date) => `${data.getFullYear()}-${String(data.getMonth() + 1).padStart(2, '0')}`;

function deslocarMes(mes: string, delta: number): string {
  const [ano, numero] = mes.split('-').map(Number);
  return mesDe(new Date(ano, numero - 1 + delta, 1));
}

function rotuloMes(mes: string): string {
  const [ano, numero] = mes.split('-').map(Number);
  return `${MESES[numero - 1]} ${ano}`;
}

const ERRO_RESPOSTA_INVALIDA = 'O servidor não respondeu como esperado. Atualize a página; se continuar, o servidor ainda não foi atualizado com esta funcionalidade.';

async function lerResposta(res: Response) {
  const corpo = res.status === 204 ? null : await res.json().catch(() => null);
  if (!res.ok) throw new Error(corpo?.error || 'Não foi possível concluir a operação.');
  if (res.status !== 204 && corpo === null) throw new Error(ERRO_RESPOSTA_INVALIDA);
  return corpo;
}

interface PropsLimite { children: React.ReactNode }
interface EstadoLimite { falhou: boolean }

class LimiteDeErro extends React.Component<PropsLimite, EstadoLimite> {
  // O projeto não tem @types/react, então props/state precisam ser declarados à mão.
  declare props: PropsLimite;
  state: EstadoLimite = { falhou: false };
  static getDerivedStateFromError(): EstadoLimite { return { falhou: true }; }
  render() {
    if (!this.state.falhou) return this.props.children;
    return (
      <div role="alert" className="flex gap-2 p-4 rounded-xl bg-red-50 border border-red-200 text-sm text-red-700">
        <AlertTriangle className="w-5 h-5 shrink-0" aria-hidden="true" />
        Não foi possível exibir a programação de contas. Atualize a página e tente novamente.
      </div>
    );
  }
}

const ESTILO_PAGAMENTO = {
  true: 'border-emerald-300 bg-emerald-50 text-emerald-700',
  false: 'border-red-300 bg-red-50 text-red-600',
} as const;

const ProgramacaoContasConteudo: React.FC = () => {
  const [mes, setMes] = useState(() => mesDe(new Date()));
  const [linhas, setLinhas] = useState<LinhaProgramacao[]>([]);
  const [atualizadoEm, setAtualizadoEm] = useState<string | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [atualizando, setAtualizando] = useState(false);
  const [erro, setErro] = useState('');
  const [busca, setBusca] = useState('');
  const [ordenacao, setOrdenacao] = useState<{ campo: CampoOrdenacao; direcao: Direcao }>({ campo: 'data', direcao: 'desc' });
  const [modal, setModal] = useState<{ conta: ProgramacaoConta | null } | null>(null);
  const [formulario, setFormulario] = useState<FormularioConta>({ nome: '', data: '', autorizado: false, pago: false });
  const [salvando, setSalvando] = useState(false);
  const [erroModal, setErroModal] = useState('');
  const [contasManuais, setContasManuais] = useState<Record<string, ProgramacaoConta>>({});

  // Resposta de um mês que já deixou de ser o exibido (usuário navegou) é descartada.
  const mesExibido = useRef(mes);
  mesExibido.current = mes;

  const buscar = useCallback(async (mesBuscado: string, silencioso: boolean) => {
    if (silencioso) setAtualizando(true); else setCarregando(true);
    try {
      const dados: RespostaProgramacao = await lerResposta(await fetch(`/api/programacao?mes=${mesBuscado}`));
      if (!Array.isArray(dados?.contas)) throw new Error(ERRO_RESPOSTA_INVALIDA);
      if (mesExibido.current !== mesBuscado) return;
      setLinhas(dados.contas);
      setAtualizadoEm(dados.atualizadoEm);
      setErro('');
    } catch (e: any) {
      if (mesExibido.current === mesBuscado) setErro(e.message);
    } finally {
      if (mesExibido.current === mesBuscado) {
        setCarregando(false);
        setAtualizando(false);
      }
    }
  }, []);

  // Carrega ao trocar de mês e acompanha o Nomus a cada minuto, sem piscar a tela.
  useEffect(() => {
    let ativo = true;
    setLinhas([]);
    buscar(mes, false);
    const intervalo = setInterval(() => { if (ativo) buscar(mes, true); }, 60_000);
    return () => { ativo = false; clearInterval(intervalo); };
  }, [mes, buscar]);

  const linhasVisiveis = useMemo(() => {
    const termo = normalizar(busca.trim());
    const filtradas = termo ? linhas.filter((linha) => normalizar(linha.nome).includes(termo)) : linhas;
    const fator = ordenacao.direcao === 'asc' ? 1 : -1;
    return [...filtradas].sort((a, b) => {
      switch (ordenacao.campo) {
        case 'data': return fator * a.data.localeCompare(b.data);
        case 'nome': return fator * a.nome.localeCompare(b.nome, 'pt-BR');
        case 'criador': return fator * (a.criador ?? '').localeCompare(b.criador ?? '', 'pt-BR');
        case 'valor': return fator * ((a.valor ?? -1) - (b.valor ?? -1));
        case 'autorizado': return fator * (Number(a.autorizado) - Number(b.autorizado));
        case 'pago': return fator * (Number(a.pago) - Number(b.pago));
      }
    });
  }, [linhas, busca, ordenacao]);

  const resumo = useMemo(() => {
    const abertas = linhasVisiveis.filter((linha) => !linha.pago);
    return {
      total: linhasVisiveis.length,
      emAberto: abertas.reduce((soma, linha) => soma + (linha.valor ?? 0), 0),
      naoAutorizado: abertas.filter((linha) => !linha.autorizado).reduce((soma, linha) => soma + (linha.valor ?? 0), 0),
    };
  }, [linhasVisiveis]);

  const alternarOrdenacao = (campo: CampoOrdenacao) =>
    setOrdenacao((atual) => atual.campo === campo
      ? { campo, direcao: atual.direcao === 'asc' ? 'desc' : 'asc' }
      : { campo, direcao: campo === 'data' || campo === 'valor' ? 'desc' : 'asc' });

  const abrirNova = () => {
    setFormulario({ nome: '', data: chaveDia(new Date()), autorizado: false, pago: false });
    setErroModal('');
    setModal({ conta: null });
  };

  // Só contas manuais são editáveis; os dados completos delas vêm da própria linha.
  const abrirEdicao = (linha: LinhaProgramacao) => {
    const conta: ProgramacaoConta = contasManuais[linha.chave] ?? {
      id: linha.id!, data: linha.data, nome: linha.nome, criador: linha.criador ?? '',
      autorizado: linha.autorizado, pago: linha.pago, criadoEm: '', atualizadoEm: '',
    };
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
      setContasManuais((atuais) => ({ ...atuais, [`manual-${salva.id}`]: salva }));
      setModal(null);
      const mesDaConta = salva.data.slice(0, 7);
      if (mesDaConta !== mes) setMes(mesDaConta); else await buscar(mes, true);
    } catch (e: any) {
      setErroModal(e.message);
    } finally {
      setSalvando(false);
    }
  };

  // Seletor "Pagamento" direto na tabela: atualiza na hora e volta atrás se o servidor recusar.
  const alterarAutorizacao = async (linha: LinhaProgramacao, autorizado: boolean) => {
    setErro('');
    const aplicar = (alvo: LinhaProgramacao, valores: Partial<LinhaProgramacao>) =>
      setLinhas((atuais) => atuais.map((item) => (item.chave === alvo.chave ? { ...item, ...valores } : item)));
    aplicar(linha, { autorizado });
    try {
      if (linha.origem === 'nomus') {
        const resposta = await lerResposta(await fetch(`/api/programacao/nomus/${linha.contaNomusId}/autorizacao`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ autorizado }),
        }));
        aplicar(linha, { autorizado: resposta.autorizado, autorizadoPor: resposta.autorizadoPor });
      } else {
        await lerResposta(await fetch(`/api/programacao/${linha.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ autorizado }),
        }));
      }
    } catch (e: any) {
      aplicar(linha, { autorizado: linha.autorizado, autorizadoPor: linha.autorizadoPor });
      setErro(e.message);
    }
  };

  const remover = async (linha: LinhaProgramacao) => {
    if (!window.confirm(`Remover a conta "${linha.nome}"?`)) return;
    setErro('');
    try {
      await lerResposta(await fetch(`/api/programacao/${linha.id}`, { method: 'DELETE' }));
      setLinhas((atuais) => atuais.filter((item) => item.chave !== linha.chave));
    } catch (e: any) {
      setErro(e.message);
    }
  };

  const colunas: Array<{ campo: CampoOrdenacao; titulo: string; alinhar?: 'right' }> = [
    { campo: 'data', titulo: 'Data' },
    { campo: 'nome', titulo: 'Nome da conta' },
    { campo: 'criador', titulo: 'Criador da conta' },
    { campo: 'valor', titulo: 'Valor', alinhar: 'right' },
    { campo: 'autorizado', titulo: 'Pagamento' },
    { campo: 'pago', titulo: 'Status' },
  ];

  const mesAtual = mesDe(new Date());

  return (
    <div className="space-y-6">
      <div className="flex flex-col lg:flex-row lg:items-center gap-4">
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

        <div className="flex flex-col sm:flex-row flex-wrap gap-3 lg:ml-auto sm:items-center">
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

      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-1.5 bg-neutral-50 p-1 rounded-full border border-neutral-200">
          <button type="button" onClick={() => setMes(deslocarMes(mes, -1))} aria-label="Mês anterior" className="w-8 h-8 flex items-center justify-center rounded-full text-neutral-500 hover:text-yellow-600 hover:bg-neutral-100 transition-all">
            <ChevronLeft className="w-4 h-4" aria-hidden="true" />
          </button>
          <span className="px-2 text-xs font-black text-neutral-900 min-w-[120px] text-center">{rotuloMes(mes)}</span>
          <button type="button" onClick={() => setMes(deslocarMes(mes, 1))} aria-label="Próximo mês" className="w-8 h-8 flex items-center justify-center rounded-full text-neutral-500 hover:text-yellow-600 hover:bg-neutral-100 transition-all">
            <ChevronRight className="w-4 h-4" aria-hidden="true" />
          </button>
        </div>
        <button type="button" onClick={() => setMes(mesAtual)} disabled={mes === mesAtual} className="px-3.5 py-2 rounded-full border border-neutral-200 bg-white text-xs font-bold text-neutral-600 hover:border-yellow-400 hover:text-yellow-600 disabled:opacity-40 transition-all">Hoje</button>
        <button type="button" onClick={() => buscar(mes, true)} disabled={carregando || atualizando} className="flex items-center gap-1.5 px-3.5 py-2 rounded-full border border-neutral-200 bg-white text-xs font-bold text-neutral-600 hover:border-yellow-400 hover:text-yellow-600 disabled:opacity-40 transition-all">
          <RefreshCw className={`w-3.5 h-3.5 ${atualizando ? 'animate-spin' : ''}`} aria-hidden="true" />
          Atualizar
        </button>
        {!carregando && (
          <p className="text-xs text-neutral-500 sm:ml-auto">
            {resumo.total} {resumo.total === 1 ? 'conta' : 'contas'} · Em aberto <strong className="text-neutral-800">{formatarValor(resumo.emAberto)}</strong> · Aguardando autorização <strong className="text-red-600">{formatarValor(resumo.naoAutorizado)}</strong>
            {atualizadoEm && <span className="text-neutral-400"> · Nomus atualizado às {new Date(atualizadoEm).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</span>}
          </p>
        )}
      </div>

      {erro && (
        <div role="alert" className="flex gap-2 p-3 rounded-xl bg-red-50 border border-red-200 text-xs text-red-700">
          <AlertTriangle className="w-4 h-4 shrink-0" aria-hidden="true" />
          {erro}
        </div>
      )}

      <div className="rounded-2xl border border-neutral-200 bg-white shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[960px] text-sm">
            <thead className="bg-neutral-50 border-b border-neutral-200">
              <tr>
                {colunas.map(({ campo, titulo, alinhar }) => {
                  const ativa = ordenacao.campo === campo;
                  const Icone = !ativa ? ArrowUpDown : ordenacao.direcao === 'asc' ? ArrowUp : ArrowDown;
                  return (
                    <th
                      key={campo}
                      scope="col"
                      aria-sort={ativa ? (ordenacao.direcao === 'asc' ? 'ascending' : 'descending') : 'none'}
                      className={`px-5 py-4 font-extrabold text-neutral-900 ${alinhar === 'right' ? 'text-right' : 'text-left'}`}
                    >
                      <button type="button" onClick={() => alternarOrdenacao(campo)} className={`flex items-center gap-2 hover:text-yellow-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-yellow-500 rounded ${alinhar === 'right' ? 'ml-auto' : ''}`}>
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
                <tr><td colSpan={7} className="px-5 py-12 text-center text-neutral-500"><Loader2 className="w-5 h-5 animate-spin inline-block mr-2 text-yellow-600" aria-hidden="true" />Consultando as contas no Nomus... (na primeira vez do mês pode levar alguns minutos)</td></tr>
              ) : linhasVisiveis.length === 0 ? (
                <tr><td colSpan={7} className="px-5 py-12 text-center text-neutral-500">{linhas.length === 0 ? `Nenhuma conta encontrada em ${rotuloMes(mes)}.` : 'Nenhuma conta encontrada para essa busca.'}</td></tr>
              ) : linhasVisiveis.map((linha) => (
                <tr key={linha.chave} className="hover:bg-neutral-50/60">
                  <td className="px-5 py-3.5 whitespace-nowrap tabular-nums text-neutral-700">{formatDataIsoParaBr(linha.data)}</td>
                  <td className="px-5 py-3.5 text-neutral-900 min-w-[200px]">
                    {linha.nome}
                    {linha.origem === 'manual' && <span className="ml-2 align-middle rounded-full bg-neutral-100 px-2 py-0.5 text-[10px] font-bold uppercase text-neutral-500">Manual</span>}
                  </td>
                  <td className="px-5 py-3.5 text-neutral-700" title={linha.criador ? undefined : 'O Nomus não informa quem criou a conta a pagar'}>{linha.criador ?? '—'}</td>
                  <td className="px-5 py-3.5 text-right tabular-nums text-neutral-900 whitespace-nowrap">{linha.valor !== null ? formatarValor(linha.valor) : '—'}</td>
                  <td className="px-5 py-3.5">
                    <select
                      aria-label={`Pagamento da conta ${linha.nome}`}
                      value={linha.autorizado ? 'sim' : 'nao'}
                      disabled={!linha.autorizacaoEditavel}
                      onChange={(e) => alterarAutorizacao(linha, e.target.value === 'sim')}
                      className={`w-44 rounded-lg border px-3 py-2 text-sm font-medium outline-none focus:ring-2 focus:ring-yellow-400 disabled:opacity-70 ${ESTILO_PAGAMENTO[String(linha.autorizado) as 'true' | 'false']}`}
                    >
                      <option value="sim">Autorizado</option>
                      <option value="nao">Não autorizado</option>
                    </select>
                    {linha.autorizadoPor && <span className="block mt-1 text-[11px] text-neutral-400">por {linha.autorizadoPor}</span>}
                  </td>
                  <td className="px-5 py-3.5">
                    <span className={`inline-flex items-center gap-2 whitespace-nowrap rounded-full px-3.5 py-1.5 text-sm font-medium ${linha.pago ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-600'}`}>
                      <span className={`w-2.5 h-2.5 rounded-full ${linha.pago ? 'bg-emerald-500' : 'bg-red-500'}`} aria-hidden="true" />
                      {linha.pago ? 'Pago' : 'Não pago'}
                    </span>
                  </td>
                  <td className="px-5 py-3.5">
                    {linha.origem === 'manual' ? (
                      <div className="flex gap-2">
                        <button type="button" onClick={() => abrirEdicao(linha)} title="Editar conta" aria-label={`Editar conta ${linha.nome}`} className="w-10 h-10 rounded-lg border border-blue-200 bg-blue-50 text-blue-600 hover:bg-blue-100 flex items-center justify-center focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400">
                          <Pencil className="w-4 h-4" aria-hidden="true" />
                        </button>
                        <button type="button" onClick={() => remover(linha)} title="Remover conta" aria-label={`Remover conta ${linha.nome}`} className="w-10 h-10 rounded-lg border border-red-200 bg-red-50 text-red-600 hover:bg-red-100 flex items-center justify-center focus:outline-none focus-visible:ring-2 focus-visible:ring-red-400">
                          <Trash2 className="w-4 h-4" aria-hidden="true" />
                        </button>
                      </div>
                    ) : (
                      <span className="text-xs text-neutral-400" title="Conta vinda do Nomus — só é alterada no próprio Nomus">Nomus</span>
                    )}
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
            <p className="text-xs text-neutral-500">Use para contas que ainda não estão no Nomus. As contas do Nomus aparecem na lista automaticamente.</p>

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

export const ProgramacaoContas: React.FC = () => (
  <LimiteDeErro>
    <ProgramacaoContasConteudo />
  </LimiteDeErro>
);
