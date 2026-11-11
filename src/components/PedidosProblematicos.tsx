import React, { useCallback, useEffect, useRef, useState } from 'react';
import { AlertTriangle, Loader2, Search, Trash2, X } from 'lucide-react';
import { formatCurrency, formatDataIsoParaBr } from '../utils/format';

type Aba = 'urgentes' | 'devolucoes' | 'defeitos';

interface CampoDef {
  k: string;
  rotulo: string;
  tipo: 'date' | 'text' | 'number' | 'status';
  max?: number;
  obrigatorio?: boolean;
}

// Todo registro nasce "Não realizada"; ao marcar "Realizada" ele some da tela (continua gravado no PCP).
type StatusRegistro = 'NAO_REALIZADA' | 'REALIZADA';
const NOMES_STATUS: Record<StatusRegistro, string> = { NAO_REALIZADA: 'Não realizada', REALIZADA: 'Realizada' };
const STATUS: CampoDef = { k: 'status', rotulo: 'Status', tipo: 'status' };

// As três tabelas do PCP. Os registros ficam no PCP: esta tela é a mesma lista, em outro lugar.
const ABAS: Record<Aba, { titulo: string; vazio: string; campos: CampoDef[] }> = {
  urgentes: {
    titulo: 'Pedidos Urgentes',
    vazio: 'Nenhum pedido urgente cadastrado.',
    campos: [{ k: 'dataEntregaCombinada', rotulo: 'Data de entrega combinada', tipo: 'date', obrigatorio: true }, STATUS],
  },
  devolucoes: {
    titulo: 'Pedidos de Devolução',
    vazio: 'Nenhuma devolução cadastrada.',
    campos: [
      { k: 'formaPagamento', rotulo: 'Forma de pagamento', tipo: 'text', max: 300 },
      { k: 'valor', rotulo: 'Valor da devolução', tipo: 'number' },
      STATUS,
    ],
  },
  defeitos: {
    titulo: 'Clientes / Defeitos',
    vazio: 'Nenhum registro de defeito cadastrado.',
    campos: [
      { k: 'causa', rotulo: 'Causa', tipo: 'text', max: 500, obrigatorio: true },
      { k: 'motorista', rotulo: 'Motorista', tipo: 'text', max: 100 },
      STATUS,
    ],
  },
};

interface Registro {
  id: number;
  numeroPedido: number;
  cliente: string;
  status?: StatusRegistro;
  [campo: string]: unknown;
}
type Dados = Record<Aba, Registro[]>;

interface PedidoEncontrado { numero: number; cliente: string; origem: 'pcp' | 'nomus' }
interface PedidoEscolhido { numero: number; cliente: string; carregando: boolean; aviso: string; prazoEntrega: string | null; preenchido: boolean; valor: number | null; valorTotal: number | null }

const VAZIO: Dados = { urgentes: [], devolucoes: [], defeitos: [] };
const ERRO_RESPOSTA_INVALIDA = 'O servidor não respondeu como esperado. Atualize a página; se continuar, o servidor ainda não foi atualizado com esta funcionalidade.';

async function chamar<T = any>(url: string, init?: RequestInit): Promise<T> {
  const resposta = await fetch(url, init && init.body ? { ...init, headers: { 'Content-Type': 'application/json' } } : init);
  const corpo = await resposta.json().catch(() => null);
  if (!resposta.ok) throw new Error(corpo?.error || 'Não foi possível concluir a operação.');
  if (corpo === null) throw new Error(ERRO_RESPOSTA_INVALIDA);
  return corpo;
}

const statusDe = (registro: Registro): StatusRegistro => (registro.status === 'REALIZADA' ? 'REALIZADA' : 'NAO_REALIZADA');
const textoDoCampo = (registro: Registro, campo: CampoDef) => {
  if (campo.tipo === 'status') return statusDe(registro);
  const valor = registro[campo.k];
  return valor === null || valor === undefined ? '' : String(valor);
};

export const PedidosProblematicos: React.FC = () => {
  const [aba, setAba] = useState<Aba>('urgentes');
  const [dados, setDados] = useState<Dados>(VAZIO);
  const [carregando, setCarregando] = useState(true);
  const [erroGeral, setErroGeral] = useState('');
  const [erroForm, setErroForm] = useState('');
  const [aviso, setAviso] = useState('');
  const [selecionado, setSelecionado] = useState<Record<Aba, PedidoEscolhido | null>>({ urgentes: null, devolucoes: null, defeitos: null });
  const [valores, setValores] = useState<Record<Aba, Record<string, string>>>({ urgentes: {}, devolucoes: {}, defeitos: {} });
  const [busca, setBusca] = useState('');
  const [resultados, setResultados] = useState<PedidoEncontrado[] | null>(null);
  const [erroBusca, setErroBusca] = useState('');
  const [salvando, setSalvando] = useState(false);
  const [mostrarRealizadas, setMostrarRealizadas] = useState(false);
  const [desfazer, setDesfazer] = useState<{ aba: Aba; id: number; numero: number } | null>(null);
  const temporizador = useRef<ReturnType<typeof setTimeout>>();
  const buscaAtual = useRef('');
  const emGravacao = useRef(new Set<string>());
  const campoBusca = useRef<HTMLInputElement>(null);

  const def = ABAS[aba];
  const escolhido = selecionado[aba];

  const carregar = useCallback(async () => {
    try {
      const resposta = await chamar<Dados>('/api/problematicos');
      if (!Array.isArray(resposta?.urgentes) || !Array.isArray(resposta?.devolucoes) || !Array.isArray(resposta?.defeitos)) throw new Error(ERRO_RESPOSTA_INVALIDA);
      setDados({ urgentes: resposta.urgentes, devolucoes: resposta.devolucoes, defeitos: resposta.defeitos });
      setErroGeral('');
    } catch (e: any) {
      setErroGeral(e.message);
    } finally {
      setCarregando(false);
    }
  }, []);

  useEffect(() => { carregar(); }, [carregar]);

  // Acompanha o PCP: o que for cadastrado, editado ou excluído lá aparece aqui em poucos segundos. A conferência não
  // mexe na tela enquanto alguém está digitando numa célula ou enquanto uma gravação está em andamento.
  const [atualizadoEm, setAtualizadoEm] = useState<Date | null>(null);
  const [semConexao, setSemConexao] = useState(false);
  const dadosNaTela = useRef<Dados>(VAZIO);
  dadosNaTela.current = dados;
  const conferir = useCallback(async () => {
    if (document.hidden || emGravacao.current.size > 0) return;
    const digitando = (document.activeElement instanceof HTMLInputElement || document.activeElement instanceof HTMLSelectElement) && !!document.activeElement.closest('tbody');
    try {
      const resposta = await chamar<Dados>('/api/problematicos');
      if (!Array.isArray(resposta?.urgentes) || !Array.isArray(resposta?.devolucoes) || !Array.isArray(resposta?.defeitos)) return;
      setSemConexao(false);
      setAtualizadoEm(new Date());
      const mudou = JSON.stringify({ urgentes: resposta.urgentes, devolucoes: resposta.devolucoes, defeitos: resposta.defeitos }) !== JSON.stringify(dadosNaTela.current);
      if (!mudou || digitando || emGravacao.current.size > 0) return;
      setDados({ urgentes: resposta.urgentes, devolucoes: resposta.devolucoes, defeitos: resposta.defeitos });
    } catch {
      setSemConexao(true); // mantém o que já está na tela e tenta de novo no próximo ciclo
    }
  }, []);
  useEffect(() => {
    const intervalo = setInterval(conferir, 10_000);
    const aoVoltar = () => { if (!document.hidden) conferir(); };
    document.addEventListener('visibilitychange', aoVoltar);
    window.addEventListener('focus', aoVoltar);
    return () => { clearInterval(intervalo); document.removeEventListener('visibilitychange', aoVoltar); window.removeEventListener('focus', aoVoltar); };
  }, [conferir]);
  useEffect(() => { if (!aviso) return; const t = setTimeout(() => setAviso(''), 5000); return () => clearTimeout(t); }, [aviso]);
  useEffect(() => { if (!desfazer) return; const t = setTimeout(() => setDesfazer(null), 10000); return () => clearTimeout(t); }, [desfazer]);

  // ---- busca do pedido (por número ou nome do cliente) ----

  const pesquisar = (texto: string) => {
    setBusca(texto);
    clearTimeout(temporizador.current);
    buscaAtual.current = texto;
    if (!texto.trim()) { setResultados(null); setErroBusca(''); return; }
    temporizador.current = setTimeout(async () => {
      try {
        const lista = await chamar<PedidoEncontrado[]>(`/api/problematicos/pedidos?q=${encodeURIComponent(texto)}`);
        if (buscaAtual.current !== texto) return;
        setResultados(Array.isArray(lista) ? lista : []);
        setErroBusca('');
      } catch (e: any) {
        if (buscaAtual.current !== texto) return;
        setResultados([]);
        setErroBusca(e.message);
      }
    }, 250);
  };

  const escolher = async (numero: number, cliente: string) => {
    const abaAtual = aba;
    setResultados(null);
    setBusca('');
    setErroForm('');
    setSelecionado((atual) => ({ ...atual, [abaAtual]: { numero, cliente, carregando: true, aviso: '', prazoEntrega: null, preenchido: false, valor: null, valorTotal: null } }));
    try {
      const d = await chamar<any>(`/api/problematicos/pedidos/${numero}`);
      let preenchido = false;
      if (abaAtual === 'devolucoes') {
        // Devolução: forma de pagamento e valor saem do pedido de venda no Nomus, sem apagar o que já foi digitado.
        setValores((atual) => {
          const forma = atual.devolucoes.formaPagamento ? atual.devolucoes.formaPagamento : d.formaPagamento || '';
          const valor = atual.devolucoes.valor ? atual.devolucoes.valor : d.valor ?? '';
          return { ...atual, devolucoes: { ...atual.devolucoes, formaPagamento: String(forma), valor: String(valor) } };
        });
        preenchido = !!(d.formaPagamento || (d.valor !== null && d.valor !== undefined));
      }
      setSelecionado((atual) => (atual[abaAtual]?.numero === numero ? { ...atual, [abaAtual]: { numero, cliente: d.cliente || cliente, carregando: false, aviso: d.aviso || '', prazoEntrega: d.prazoEntrega ?? null, preenchido, valor: typeof d.valor === 'number' ? d.valor : null, valorTotal: typeof d.valorTotal === 'number' ? d.valorTotal : null } } : atual));
    } catch (e: any) {
      setSelecionado((atual) => ({ ...atual, [abaAtual]: null }));
      setErroForm(e.message);
    }
  };

  const limparSelecao = () => {
    setSelecionado((atual) => ({ ...atual, [aba]: null }));
    setTimeout(() => campoBusca.current?.focus(), 0);
  };

  // ---- ações ----

  const adicionar = async () => {
    setErroForm('');
    if (!escolhido) return setErroForm('Escolha o pedido na busca primeiro.');
    if (escolhido.carregando && aba === 'devolucoes') return setErroForm('Aguarde um instante: buscando a forma de pagamento e o valor do pedido no Nomus…');
    const corpo: Record<string, unknown> = { numeroPedido: escolhido.numero, cliente: escolhido.cliente };
    for (const campo of def.campos) {
      const texto = (valores[aba][campo.k] ?? '').trim();
      if (campo.tipo === 'status') corpo.status = texto || 'NAO_REALIZADA';
      else if (campo.tipo === 'number') { if (texto !== '') corpo[campo.k] = Number(texto.replace(',', '.')); }
      else if (texto !== '' || campo.obrigatorio) corpo[campo.k] = texto;
    }
    setSalvando(true);
    try {
      const resposta = await chamar<Dados>(`/api/problematicos/${aba}`, { method: 'POST', body: JSON.stringify(corpo) });
      setDados({ urgentes: resposta.urgentes, devolucoes: resposta.devolucoes, defeitos: resposta.defeitos });
      setSelecionado((atual) => ({ ...atual, [aba]: null }));
      setValores((atual) => ({ ...atual, [aba]: {} }));
      setAviso(corpo.status === 'REALIZADA' ? `Pedido ${escolhido.numero} cadastrado como realizada: oculto da tela.` : `Pedido ${escolhido.numero} cadastrado em ${def.titulo}.`);
    } catch (e: any) {
      setErroForm(e.message);
    } finally {
      setSalvando(false);
    }
  };

  const salvarCampo = async (registro: Registro, campo: CampoDef, bruto: string) => {
    let novo: string | number | null = bruto.trim();
    if (campo.tipo === 'date' && novo && !/^(20\d\d)-\d\d-\d\d$/.test(novo)) return; // ano ainda sendo digitado
    if (novo === (textoDoCampo(registro, campo))) return; // nada mudou
    if (campo.obrigatorio && novo === '') { setErroGeral(`Informe ${campo.rotulo.toLowerCase()}.`); return; }
    if (campo.tipo === 'number') novo = novo === '' ? null : Number(novo.replace(',', '.'));
    const chave = `${aba}:${registro.id}:${campo.k}:${novo}`;
    if (emGravacao.current.has(chave)) return;
    emGravacao.current.add(chave);
    try {
      const resposta = await chamar<Dados>(`/api/problematicos/${aba}/${registro.id}`, { method: 'PATCH', body: JSON.stringify({ [campo.k]: novo }) });
      setDados({ urgentes: resposta.urgentes, devolucoes: resposta.devolucoes, defeitos: resposta.defeitos });
      setErroGeral('');
      if (campo.tipo === 'status' && novo === 'REALIZADA' && !mostrarRealizadas) setDesfazer({ aba, id: registro.id, numero: registro.numeroPedido });
    } catch (e: any) {
      setErroGeral(e.message);
      carregar(); // volta o que estava gravado
    } finally {
      emGravacao.current.delete(chave);
    }
  };

  const desfazerRealizada = async () => {
    if (!desfazer) return;
    const { aba: abaDoRegistro, id } = desfazer;
    setDesfazer(null);
    try {
      const resposta = await chamar<Dados>(`/api/problematicos/${abaDoRegistro}/${id}`, { method: 'PATCH', body: JSON.stringify({ status: 'NAO_REALIZADA' }) });
      setDados({ urgentes: resposta.urgentes, devolucoes: resposta.devolucoes, defeitos: resposta.defeitos });
    } catch (e: any) {
      setErroGeral(e.message);
    }
  };

  const remover = async (registro: Registro) => {
    if (!window.confirm(`Excluir o registro do pedido ${registro.numeroPedido}?`)) return;
    try {
      const resposta = await chamar<Dados>(`/api/problematicos/${aba}/${registro.id}`, { method: 'DELETE' });
      setDados({ urgentes: resposta.urgentes, devolucoes: resposta.devolucoes, defeitos: resposta.defeitos });
      setErroGeral('');
    } catch (e: any) {
      setErroGeral(e.message);
    }
  };

  // ---- textos de apoio ----

  const dica: React.ReactNode = (() => {
    if (!escolhido) return aba === 'devolucoes' ? 'Escolha o pedido: forma de pagamento e valor são preenchidos sozinhos com os dados do pedido de venda (você pode ajustar).' : 'Digite o número ou o nome do cliente e escolha o pedido na lista.';
    if (escolhido.carregando) return 'Buscando os dados do pedido no Nomus… (pode levar alguns segundos)';
    if (escolhido.aviso) return (
      <>
        <span className="font-semibold text-amber-700">{escolhido.aviso}</span>{' '}
        <button type="button" onClick={() => escolher(escolhido.numero, escolhido.cliente)} className="rounded-full border border-neutral-200 px-2.5 py-0.5 text-[11px] font-bold text-neutral-600 hover:border-yellow-400 hover:text-yellow-700">Tentar de novo</button>
      </>
    );
    if (aba === 'urgentes' && escolhido.prazoEntrega) return `Prazo de entrega atual do pedido: ${formatDataIsoParaBr(escolhido.prazoEntrega)}.`;
    if (aba === 'devolucoes') {
      if (!escolhido.preenchido) return 'O Nomus não trouxe forma de pagamento/valor deste pedido: preencha à mão.';
      const dividido = escolhido.valorTotal !== null && escolhido.valor !== null && Math.abs(escolhido.valorTotal - escolhido.valor) > 0.005;
      return dividido
        ? <>Forma de pagamento preenchida pelo pedido de venda. O valor é o da <b>entrada</b> ({formatCurrency(escolhido.valor ?? 0)}); o total do pedido é {formatCurrency(escolhido.valorTotal ?? 0)}.</>
        : 'Forma de pagamento e valor (pago de uma vez) preenchidos com os dados do pedido de venda do Nomus.';
    }
    return '';
  })();

  const entrada = 'w-full rounded-xl border border-neutral-200 bg-white px-3.5 py-2.5 text-sm text-neutral-900 outline-none focus:border-yellow-500';
  const todos = dados[aba];
  const realizadas = todos.filter((r) => statusDe(r) === 'REALIZADA').length;
  const lista = mostrarRealizadas ? todos : todos.filter((r) => statusDe(r) !== 'REALIZADA'); // realizada some da tela
  const classeStatus = (status: StatusRegistro) => (status === 'REALIZADA' ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-800');

  return (
    <div className="space-y-6">
      <div>
        <span className="text-xs font-bold uppercase tracking-widest text-yellow-600">Dashboard • Pedidos • Controle operacional</span>
        <h1 className="mt-1 flex items-center gap-2 text-2xl font-black text-neutral-900">
          <AlertTriangle className="h-6 w-6 text-yellow-600" aria-hidden="true" />
          Pedidos problemáticos
        </h1>
        <p className="mt-1 text-sm text-neutral-500">
          Registre os pedidos urgentes, as devoluções e os clientes com defeito. Escolha o pedido pela busca: os dados dele são preenchidos sozinhos. Os registros são os mesmos do PCP.
        </p>
      </div>

      {atualizadoEm && (
        <p className="-mt-3 flex items-center gap-1.5 text-[11px] text-neutral-500" role="status">
          <span className={`h-1.5 w-1.5 rounded-full ${semConexao ? 'bg-amber-500' : 'animate-pulse bg-emerald-500'}`} aria-hidden="true" />
          {semConexao ? 'Sem conexão com o PCP agora; mostrando a última lista e tentando de novo…' : `Acompanhando o PCP · conferido às ${atualizadoEm.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}`}
        </p>
      )}

      {erroGeral && (
        <div role="alert" className="flex gap-2 rounded-xl border border-red-200 bg-red-50 p-3 text-xs text-red-700">
          <AlertTriangle className="h-4 w-4 shrink-0" aria-hidden="true" />
          {erroGeral}
        </div>
      )}
      {desfazer && (
        <div role="status" className="flex flex-wrap items-center gap-3 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-xs font-semibold text-emerald-800">
          Pedido {desfazer.numero} marcado como realizada e ocultado.
          <button type="button" onClick={desfazerRealizada} className="rounded-full border border-emerald-300 bg-white px-3 py-1 text-[11px] font-bold text-emerald-800 hover:bg-emerald-100">Desfazer</button>
        </div>
      )}
      {aviso && <div role="status" className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-xs font-semibold text-emerald-800">{aviso}</div>}

      <section className="rounded-2xl border border-neutral-200 bg-white p-4 shadow-sm sm:p-6">
        <div role="tablist" aria-label="Tabelas" className="mb-5 flex flex-wrap gap-1 border-b border-neutral-200">
          {(Object.keys(ABAS) as Aba[]).map((chave) => (
            <button
              key={chave}
              type="button"
              role="tab"
              aria-selected={aba === chave}
              onClick={() => { setAba(chave); setErroForm(''); setResultados(null); setBusca(''); }}
              className={`-mb-px flex items-center gap-2 border-b-2 px-4 py-2.5 text-sm transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-yellow-400 ${aba === chave ? 'border-yellow-500 font-bold text-neutral-900' : 'border-transparent font-medium text-neutral-500 hover:text-neutral-900'}`}
            >
              {ABAS[chave].titulo}
              {dados[chave].filter((r) => statusDe(r) !== 'REALIZADA').length > 0 && <span className="rounded-full bg-neutral-100 px-2 py-0.5 text-[11px] font-bold text-neutral-700">{dados[chave].filter((r) => statusDe(r) !== 'REALIZADA').length}</span>}
            </button>
          ))}
        </div>

        <form className="grid gap-4 md:grid-cols-2 xl:grid-cols-[minmax(0,1.4fr)_repeat(3,minmax(0,1fr))_auto] xl:items-end" onSubmit={(e) => { e.preventDefault(); adicionar(); }}>
          <div className="relative">
            <label className="mb-1 block text-[11px] font-bold uppercase tracking-wide text-neutral-600" htmlFor="pp-busca">Número do pedido *</label>
            {escolhido ? (
              <div className="flex items-center justify-between gap-2 rounded-xl border border-yellow-300 bg-yellow-50 px-3.5 py-2.5 text-sm">
                <span className="min-w-0 truncate"><b>Pedido {escolhido.numero}</b>{escolhido.cliente ? ` · ${escolhido.cliente}` : ''}</span>
                <button type="button" onClick={limparSelecao} aria-label="Trocar o pedido" className="shrink-0 rounded-full p-1 text-neutral-600 hover:bg-yellow-100"><X className="h-4 w-4" aria-hidden="true" /></button>
              </div>
            ) : (
              <>
                <Search className="pointer-events-none absolute left-3.5 top-[34px] h-4 w-4 text-neutral-400" aria-hidden="true" />
                <input
                  id="pp-busca"
                  ref={campoBusca}
                  type="search"
                  autoComplete="off"
                  value={busca}
                  onChange={(e) => pesquisar(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); const primeiro = resultados?.[0]; if (primeiro) escolher(primeiro.numero, primeiro.cliente); } }}
                  placeholder="Digite o número do pedido ou o nome do cliente…"
                  className={`${entrada} pl-10`}
                />
                {resultados && (
                  <ul className="absolute left-0 right-0 top-full z-20 mt-1 max-h-64 overflow-auto rounded-xl border border-neutral-200 bg-white py-1 shadow-lg">
                    {resultados.length === 0 ? (
                      <li className="px-3.5 py-2 text-xs text-neutral-500">{erroBusca || 'Nenhum pedido encontrado.'}</li>
                    ) : resultados.map((pedido) => (
                      <li key={pedido.numero}>
                        <button type="button" onClick={() => escolher(pedido.numero, pedido.cliente)} className="block w-full px-3.5 py-2 text-left text-sm hover:bg-yellow-50 focus:bg-yellow-50 focus:outline-none">
                          <b>{pedido.numero}</b> {pedido.cliente || 'sem nome'}{pedido.origem === 'nomus' && <em className="ml-1 text-[11px] text-neutral-500">(só no Nomus)</em>}
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </>
            )}
          </div>

          {def.campos.map((campo) => campo.tipo === 'status' ? (
            <div key={campo.k}>
              <label className="mb-1 block text-[11px] font-bold uppercase tracking-wide text-neutral-600" htmlFor="pp-status">{campo.rotulo}</label>
              <select
                id="pp-status"
                value={valores[aba].status || 'NAO_REALIZADA'}
                onChange={(e) => setValores((atual) => ({ ...atual, [aba]: { ...atual[aba], status: e.target.value } }))}
                className={`${entrada} font-bold ${classeStatus((valores[aba].status || 'NAO_REALIZADA') as StatusRegistro)}`}
              >
                {(Object.keys(NOMES_STATUS) as StatusRegistro[]).map((v) => <option key={v} value={v}>{NOMES_STATUS[v]}</option>)}
              </select>
            </div>
          ) : (
            <div key={campo.k}>
              <label className="mb-1 block text-[11px] font-bold uppercase tracking-wide text-neutral-600" htmlFor={`pp-${campo.k}`}>{campo.rotulo}{campo.obrigatorio ? ' *' : ''}</label>
              <input
                id={`pp-${campo.k}`}
                type={campo.tipo}
                value={valores[aba][campo.k] ?? ''}
                onChange={(e) => setValores((atual) => ({ ...atual, [aba]: { ...atual[aba], [campo.k]: e.target.value } }))}
                {...(campo.tipo === 'number' ? { min: 0, step: '0.01', placeholder: '0,00' } : {})}
                {...(campo.tipo === 'date' ? { min: '2000-01-01', max: '2100-12-31' } : {})}
                {...(campo.max ? { maxLength: campo.max } : {})}
                className={entrada}
              />
            </div>
          ))}

          <div>
            <button type="submit" disabled={salvando} className="flex w-full items-center justify-center gap-2 rounded-xl bg-yellow-400 px-6 py-2.5 text-sm font-bold text-black transition-all hover:bg-yellow-300 disabled:opacity-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-yellow-600">
              {salvando && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
              Adicionar
            </button>
          </div>
        </form>

        <p className="mt-3 text-[11px] text-neutral-500">{dica}</p>
        {erroForm && <p role="alert" className="mt-2 text-xs font-semibold text-red-700">{erroForm}</p>}

        <label className="mt-4 flex w-fit cursor-pointer items-center gap-2 text-xs font-semibold text-neutral-700">
          <input type="checkbox" checked={mostrarRealizadas} onChange={(e) => setMostrarRealizadas(e.target.checked)} className="h-4 w-4 accent-yellow-500" />
          Mostrar realizadas ({realizadas})
        </label>

        <div className="mt-5 overflow-x-auto rounded-xl border border-neutral-200">
          <table className="w-full text-[12px]">
            <thead className="border-b border-neutral-200 bg-neutral-50 text-neutral-600">
              <tr>
                <th scope="col" className="px-3 py-2 text-left font-bold">Número do pedido</th>
                {def.campos.map((campo) => <th key={campo.k} scope="col" className="px-3 py-2 text-left font-bold">{campo.rotulo}</th>)}
                <th scope="col" className="px-3 py-2"><span className="sr-only">Ações</span></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100">
              {carregando ? (
                <tr><td colSpan={def.campos.length + 2} className="px-3 py-8 text-center text-neutral-500"><Loader2 className="mx-auto h-5 w-5 animate-spin" aria-label="Carregando" /></td></tr>
              ) : lista.length === 0 ? (
                <tr><td colSpan={def.campos.length + 2} className="px-3 py-8 text-center text-neutral-500">{todos.length > 0 ? 'Nenhum pedido pendente: as realizadas estão ocultas (marque “Mostrar realizadas”).' : def.vazio}</td></tr>
              ) : lista.map((registro) => (
                <tr key={registro.id}>
                  <td className="px-3 py-2">
                    <b className="text-neutral-900">{registro.numeroPedido}</b>
                    {registro.cliente && <span className="block text-[11px] text-neutral-500">{registro.cliente}</span>}
                  </td>
                  {def.campos.map((campo) => (
                    <td key={campo.k} className="px-3 py-2">
                      {campo.tipo === 'status' ? (
                        <select
                          key={`${registro.id}-status-${statusDe(registro)}`}
                          defaultValue={statusDe(registro)}
                          aria-label={`Status do pedido ${registro.numeroPedido}`}
                          onChange={(e) => salvarCampo(registro, campo, e.target.value)}
                          className={`min-w-[130px] cursor-pointer rounded-lg border border-transparent px-2 py-1.5 text-[12px] font-bold focus:border-yellow-500 focus:outline-none ${classeStatus(statusDe(registro))}`}
                        >
                          {(Object.keys(NOMES_STATUS) as StatusRegistro[]).map((v) => <option key={v} value={v}>{NOMES_STATUS[v]}</option>)}
                        </select>
                      ) : (
                      <input
                        key={`${registro.id}-${campo.k}-${textoDoCampo(registro, campo)}`}
                        type={campo.tipo}
                        defaultValue={textoDoCampo(registro, campo)}
                        {...(campo.tipo === 'number' ? { min: 0, step: '0.01' } : {})}
                        {...(campo.tipo === 'date' ? { min: '2000-01-01', max: '2100-12-31' } : {})}
                        {...(campo.max ? { maxLength: campo.max } : {})}
                        aria-label={`${campo.rotulo} do pedido ${registro.numeroPedido}`}
                        onBlur={(e) => salvarCampo(registro, campo, e.target.value)}
                        onChange={campo.tipo === 'date' ? (e) => salvarCampo(registro, campo, e.target.value) : undefined}
                        onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }}
                        className={`w-full rounded-lg border border-transparent bg-transparent px-2 py-1.5 text-[12px] text-neutral-900 hover:border-neutral-200 focus:border-yellow-500 focus:bg-white focus:outline-none ${campo.k === 'formaPagamento' ? 'min-w-[340px]' : 'min-w-[140px]'}`}
                      />
                      )}
                    </td>
                  ))}
                  <td className="px-3 py-2 text-right">
                    <button type="button" onClick={() => remover(registro)} aria-label={`Excluir registro do pedido ${registro.numeroPedido}`} title="Excluir este registro" className="inline-flex items-center gap-1 rounded-full border border-neutral-200 px-3 py-1.5 text-[11px] font-bold text-neutral-600 hover:border-red-300 hover:text-red-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-red-400">
                      <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                      Excluir
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
};
