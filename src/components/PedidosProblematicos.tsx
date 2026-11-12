import React, { useCallback, useEffect, useRef, useState } from 'react';
import { AlertTriangle, Check, CheckCircle2, Clock, Download, Filter, List, ListChecks, Loader2, MoreHorizontal, Plus, RefreshCw, RotateCcw, Search, Trash2, Users, X } from 'lucide-react';
import { formatDataIsoParaBr } from '../utils/format';
import { AcoesDevolucao, type EtapaResumo } from './AcoesDevolucao';

type Aba = 'urgentes' | 'devolucoes' | 'defeitos' | 'convertidos';
type AbaDoPcp = Exclude<Aba, 'convertidos'>;
type StatusRegistro = 'NAO_REALIZADA' | 'REALIZADA' | 'PERDIDO';
type Icone = React.FC<{ className?: string }>;

interface CampoDef {
  k: string;
  rotulo: string;
  tipo: 'date' | 'text' | 'number' | 'status';
  max?: number;
  obrigatorio?: boolean;
}

// Todo registro nasce "Não realizada"; ao marcar "Realizada" ele some da lista (continua gravado no PCP; o filtro Status traz de volta).
const NOMES_STATUS: Record<StatusRegistro, string> = { NAO_REALIZADA: 'Não realizada', REALIZADA: 'Realizada', PERDIDO: 'Perdido' };
const STATUS: CampoDef = { k: 'status', rotulo: 'Status', tipo: 'status' };

interface TabelaDef {
  aba: string;
  icone: Icone;
  cor: 'ouro' | 'verde';
  cardTitulo: string;
  cardSub: string;
  listaTitulo: string;
  listaSub: string;
  vazio: string;
  vazioSub: string;
  campos: CampoDef[];
  /** Filtro de data da lista: 'futura' (vencidas/hoje/próximos 7 dias/sem data) ou 'cadastro' (hoje/7/30 dias). */
  data: { campo: string; rotulo: string; tipo: 'futura' | 'cadastro' };
}

// As três tabelas do PCP. Os registros ficam no PCP: esta tela é a mesma lista, em outro lugar.
const TABELAS_DO_PCP: Record<AbaDoPcp, TabelaDef> = {
  urgentes: {
    aba: 'Pedidos Urgentes', icone: AlertTriangle, cor: 'ouro',
    cardTitulo: 'Cadastrar novo pedido urgente', cardSub: 'Inclua um pedido com prioridade de tratamento.',
    listaTitulo: 'Pedidos urgentes', listaSub: 'Fila de pedidos com prioridade de tratamento.',
    vazio: 'Nenhum pedido urgente cadastrado.', vazioSub: 'Não há pedidos urgentes para exibir no momento.',
    campos: [{ k: 'dataEntregaCombinada', rotulo: 'Data de entrega combinada', tipo: 'date', obrigatorio: true }, STATUS],
    data: { campo: 'dataEntregaCombinada', rotulo: 'Data de entrega', tipo: 'futura' },
  },
  devolucoes: {
    aba: 'Pedidos de Devolução', icone: RotateCcw, cor: 'verde',
    cardTitulo: 'Cadastrar nova devolução', cardSub: 'Forma de pagamento e valor vêm do pedido de venda do Nomus.',
    listaTitulo: 'Pedidos de devolução', listaSub: 'Pedidos devolvidos e o valor a devolver.',
    vazio: 'Nenhuma devolução cadastrada.', vazioSub: 'Não há devoluções para exibir no momento.',
    campos: [
      { k: 'formaPagamento', rotulo: 'Forma de pagamento', tipo: 'text', max: 300 },
      { k: 'valor', rotulo: 'Valor da devolução', tipo: 'number' },
      STATUS,
    ],
    data: { campo: 'criadoEm', rotulo: 'Data do cadastro', tipo: 'cadastro' },
  },
  defeitos: {
    aba: 'Clientes / Defeitos', icone: Users, cor: 'ouro',
    cardTitulo: 'Cadastrar cliente / defeito', cardSub: 'Registre o defeito, a causa e a ação para resolver.',
    listaTitulo: 'Clientes / defeitos', listaSub: 'Defeitos reclamados e o que será feito.',
    vazio: 'Nenhum registro de defeito cadastrado.', vazioSub: 'Não há defeitos para exibir no momento.',
    campos: [
      { k: 'causa', rotulo: 'Causa', tipo: 'text', max: 500, obrigatorio: true },
      { k: 'motorista', rotulo: 'Motorista', tipo: 'text', max: 100 },
      { k: 'acao', rotulo: 'Ação', tipo: 'text', max: 500 },
      { k: 'prazoAcao', rotulo: 'Prazo da ação', tipo: 'date' },
      STATUS,
    ],
    data: { campo: 'prazoAcao', rotulo: 'Prazo da ação', tipo: 'futura' },
  },
};

// "Pedidos Convertidos": as devoluções que chegaram ao status Realizada (a aba é feita dos mesmos registros).
const TABELAS: Record<Aba, TabelaDef> = {
  ...TABELAS_DO_PCP,
  convertidos: {
    ...TABELAS_DO_PCP.devolucoes,
    aba: 'Pedidos Convertidos', icone: CheckCircle2, cor: 'verde',
    listaTitulo: 'Pedidos convertidos', listaSub: 'Devoluções com status Realizada.',
    vazio: 'Nenhum pedido convertido ainda.', vazioSub: 'Os pedidos de devolução marcados como Realizada aparecem aqui.',
  },
};

interface Registro {
  id: number;
  numeroPedido: number;
  cliente: string;
  criadoEm?: string;
  status?: StatusRegistro;
  atualizadoEm?: string;
  atualizadoPor?: string;
  /** Só nas devoluções: situação das 5 etapas do atendimento (SAC, Vera, Dirceu, Decisão, Financeiro). */
  etapas?: EtapaResumo[];
  etapasFeitas?: number;
  [campo: string]: unknown;
}
type Dados = Record<Aba, Registro[]>;
interface Filtro { q: string; de: string; ate: string; status: 'pendentes' | 'realizadas' | 'perdidas' | 'todas'; ordem: 'recentes' | 'data' | 'pedido' }

interface PedidoEncontrado { numero: number; cliente: string; origem: 'pcp' | 'nomus' }
interface PedidoEscolhido { numero: number; cliente: string; carregando: boolean; aviso: string; prazoEntrega: string | null; preenchido: boolean; valor: number | null; valorTotal: number | null }

const VAZIO: Dados = { urgentes: [], devolucoes: [], defeitos: [], convertidos: [] };
type RespostaPcp = Record<AbaDoPcp, Registro[]>;
const ERRO_RESPOSTA_INVALIDA = 'O servidor não respondeu como esperado. Atualize a página; se continuar, o servidor ainda não foi atualizado com esta funcionalidade.';
const filtroInicial = (aba?: Aba): Filtro => ({ q: '', de: '', ate: '', status: aba === 'convertidos' ? 'todas' : 'pendentes', ordem: 'recentes' });

async function chamar<T = any>(url: string, init?: RequestInit): Promise<T> {
  const resposta = await fetch(url, init && init.body ? { ...init, headers: { 'Content-Type': 'application/json' } } : init);
  const corpo = await resposta.json().catch(() => null);
  if (!resposta.ok) throw new Error(corpo?.error || 'Não foi possível concluir a operação.');
  if (corpo === null) throw new Error(ERRO_RESPOSTA_INVALIDA);
  return corpo;
}

const statusDe = (registro: Registro): StatusRegistro => (registro.status === 'REALIZADA' ? 'REALIZADA' : registro.status === 'PERDIDO' ? 'PERDIDO' : 'NAO_REALIZADA');

/** Devoluções (e a aba Convertidos, que é feita delas) têm o status Perdido a mais. */
const ehDevolucao = (aba: Aba) => aba === 'devolucoes' || aba === 'convertidos';
const rota = (aba: Aba): AbaDoPcp => (aba === 'convertidos' ? 'devolucoes' : aba);
const opcoesStatus = (aba: Aba, atual: StatusRegistro) => (Object.keys(NOMES_STATUS) as StatusRegistro[]).filter((v) => v !== 'PERDIDO' || ehDevolucao(aba) || atual === 'PERDIDO');
const montar = (r: RespostaPcp): Dados => ({ urgentes: r.urgentes, devolucoes: r.devolucoes, defeitos: r.defeitos, convertidos: r.devolucoes.filter((d) => d.status === 'REALIZADA') });

/** O registro aparece na lista com este filtro? (Perdido só aparece quando pedido de propósito.) */
function passaNoFiltro(r: Registro, aba: Aba, f: Filtro): boolean {
  const st = statusDe(r);
  if (f.status === 'pendentes' && st !== 'NAO_REALIZADA') return false;
  if (f.status === 'realizadas' && st !== 'REALIZADA') return false;
  if (f.status === 'perdidas' && st !== 'PERDIDO') return false;
  if (f.status === 'todas' && st === 'PERDIDO') return false;
  const q = f.q.trim().toLowerCase();
  if (q && ![r.numeroPedido, r.cliente, r.causa, r.motorista, r.acao, r.formaPagamento].join(' ').toLowerCase().includes(q)) return false;
  if (f.de || f.ate) {
    const t = TABELAS[aba];
    const bruto = r[t.data.campo];
    const d = t.data.tipo === 'cadastro' ? diaSP(String(bruto ?? '')) : String(bruto ?? '');
    if (!d || (f.de && d < f.de) || (f.ate && d > f.ate)) return false;
  }
  return true;
}
const textoDoCampo = (registro: Registro, campo: CampoDef) => {
  if (campo.tipo === 'status') return statusDe(registro);
  const valor = registro[campo.k];
  return valor === null || valor === undefined ? '' : String(valor);
};

const brl = (n: number) => n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

// ---- datas (sempre no fuso de São Paulo, como no PCP) ----
const diaSP = (iso?: string) => (iso ? new Date(iso).toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' }) : '');
const hojeSP = () => new Date().toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' });
const quando = (iso?: string) => (iso ? new Date(iso).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo', day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '');

/** Colunas extras de cada fila (depois de Pedido e Cliente, antes de Status). */
type ColunaFila = { k: string; rot: string; tipo?: 'data' | 'brl' | 'etapas' };
const COLUNAS_DO_PCP: Record<AbaDoPcp, ColunaFila[]> = {
  urgentes: [{ k: 'dataEntregaCombinada', rot: 'Data de entrega', tipo: 'data' }],
  devolucoes: [{ k: 'formaPagamento', rot: 'Forma de pagamento' }, { k: 'valor', rot: 'Valor (R$)', tipo: 'brl' }, { k: 'etapas', rot: 'Etapas', tipo: 'etapas' }],
  defeitos: [{ k: 'causa', rot: 'Causa' }, { k: 'motorista', rot: 'Motorista' }, { k: 'prazoAcao', rot: 'Prazo da ação', tipo: 'data' }],
};
const COLUNAS: Record<Aba, ColunaFila[]> = { ...COLUNAS_DO_PCP, convertidos: COLUNAS_DO_PCP.devolucoes };

const classeStatus = (status: StatusRegistro) => (status === 'REALIZADA' ? 'bg-emerald-50 text-emerald-700' : status === 'PERDIDO' ? 'bg-slate-200 text-slate-600' : 'bg-yellow-100 text-neutral-800');

export const PedidosProblematicos: React.FC = () => {
  const [aba, setAba] = useState<Aba>('urgentes');
  const [dados, setDados] = useState<Dados>(VAZIO);
  const [carregando, setCarregando] = useState(true);
  const [erroGeral, setErroGeral] = useState('');
  const [aviso, setAviso] = useState('');
  const [filtros, setFiltros] = useState<Record<Aba, Filtro>>({ urgentes: filtroInicial(), devolucoes: filtroInicial(), defeitos: filtroInicial(), convertidos: filtroInicial('convertidos') });
  const [desfazer, setDesfazer] = useState<{ aba: Aba; id: number; numero: number; mensagem: string; anterior: StatusRegistro } | null>(null);
  const [menuAberto, setMenuAberto] = useState(false);
  const [atualizadoEm, setAtualizadoEm] = useState<Date | null>(null);
  const [semConexao, setSemConexao] = useState(false);
  const [atualizando, setAtualizando] = useState(false);
  const [selecionados, setSelecionados] = useState<Record<Aba, number | null>>({ urgentes: null, devolucoes: null, defeitos: null, convertidos: null }); // registro aberto no painel da direita
  const [acoesDe, setAcoesDe] = useState<number | null>(null); // devolução cujas Ações estão abertas
  const [escolhaAberta, setEscolhaAberta] = useState(false);
  const [escolhaQ, setEscolhaQ] = useState('');

  // modal de cadastro
  const [modalAberto, setModalAberto] = useState(false);
  const [selecionado, setSelecionado] = useState<PedidoEscolhido | null>(null);
  const [valores, setValores] = useState<Record<string, string>>({});
  const [busca, setBusca] = useState('');
  const [resultados, setResultados] = useState<PedidoEncontrado[] | null>(null);
  const [erroBusca, setErroBusca] = useState('');
  const [erroForm, setErroForm] = useState('');
  const [salvando, setSalvando] = useState(false);

  const temporizador = useRef<ReturnType<typeof setTimeout>>();
  const buscaAtual = useRef('');
  const emGravacao = useRef(new Set<string>());
  const campoBusca = useRef<HTMLInputElement>(null);
  const dadosNaTela = useRef<Dados>(VAZIO);
  dadosNaTela.current = dados;

  const def = TABELAS[aba];
  const filtro = filtros[aba];
  const hoje = hojeSP();

  const guardar = (resposta: RespostaPcp) => setDados(montar(resposta));
  const respostaValida = (r: any): r is RespostaPcp => Array.isArray(r?.urgentes) && Array.isArray(r?.devolucoes) && Array.isArray(r?.defeitos);

  const carregar = useCallback(async (manual = false) => {
    if (manual) setAtualizando(true);
    try {
      const resposta = await chamar<RespostaPcp>('/api/problematicos');
      if (!respostaValida(resposta)) throw new Error(ERRO_RESPOSTA_INVALIDA);
      setDados(montar(resposta));
      setErroGeral('');
      setSemConexao(false);
      setAtualizadoEm(new Date());
    } catch (e: any) {
      setErroGeral(e.message);
    } finally {
      setCarregando(false);
      setAtualizando(false);
    }
  }, []);

  useEffect(() => { carregar(); }, [carregar]);
  useEffect(() => { if (!aviso) return; const t = setTimeout(() => setAviso(''), 5000); return () => clearTimeout(t); }, [aviso]);
  useEffect(() => { if (!desfazer) return; const t = setTimeout(() => setDesfazer(null), 10000); return () => clearTimeout(t); }, [desfazer]);

  // Acompanha o PCP: o que for cadastrado, editado ou excluído lá aparece aqui em poucos segundos. A conferência não
  // mexe na tela enquanto alguém está digitando numa célula ou enquanto uma gravação está em andamento.
  const conferir = useCallback(async () => {
    if (document.hidden || emGravacao.current.size > 0) return;
    const ativo = document.activeElement;
    const digitando = (ativo instanceof HTMLInputElement || ativo instanceof HTMLSelectElement || ativo instanceof HTMLTextAreaElement) && !!ativo.closest('[data-edicao]');
    try {
      const resposta = await chamar<RespostaPcp>('/api/problematicos');
      if (!respostaValida(resposta)) return;
      setSemConexao(false);
      setAtualizadoEm(new Date());
      const novos = montar(resposta);
      const mudou = JSON.stringify(novos) !== JSON.stringify(dadosNaTela.current);
      if (!mudou || digitando || emGravacao.current.size > 0) return;
      setDados(novos);
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

  // ---- lista filtrada ----

  const todos = dados[aba];
  const filtrados = todos.filter((r) => passaNoFiltro(r, aba, filtro));
  const chaveData = (r: Registro) => (def.data.tipo === 'cadastro' ? diaSP(r.criadoEm) : String(r[def.data.campo] ?? '')) || '';
  const lista = [...filtrados].sort((a, b) => {
    if (filtro.ordem === 'pedido') return b.numeroPedido - a.numeroPedido;
    if (filtro.ordem === 'data') return chaveData(a) === '' ? 1 : chaveData(b) === '' ? -1 : chaveData(a).localeCompare(chaveData(b));
    return b.id - a.id;
  });
  const idSelecionado = lista.some((r) => r.id === selecionados[aba]) ? selecionados[aba] : lista[0]?.id ?? null;
  const registroAberto = lista.find((r) => r.id === idSelecionado) ?? null;
  const feitas = todos.filter((r) => statusDe(r) === 'REALIZADA').length;
  const perdidas = todos.filter((r) => statusDe(r) === 'PERDIDO').length;
  const abertas = todos.length - feitas - perdidas;
  const pendentesDe = (chave: Aba) => (chave === 'convertidos' ? dados.convertidos.length : dados[chave].filter((r) => statusDe(r) === 'NAO_REALIZADA').length);

  const mudarFiltro = (parcial: Partial<Filtro>) => setFiltros((atual) => ({ ...atual, [aba]: { ...atual[aba], ...parcial } }));
  const escolherRegistro = (id: number) => setSelecionados((atual) => ({ ...atual, [aba]: id }));
  const atualizouEtapas = useCallback((id: number, etapas: EtapaResumo[], etapasFeitas: number) => {
    const atualizar = (lista: Registro[]) => lista.map((r) => (r.id === id ? { ...r, etapas, etapasFeitas } : r));
    setDados((atual) => ({ ...atual, devolucoes: atualizar(atual.devolucoes), convertidos: atualizar(atual.convertidos) }));
  }, []);
  const abrirAcoes = (id: number) => { setEscolhaAberta(false); setAcoesDe(id); };
  const devolucaoAberta = acoesDe === null ? null : dados.devolucoes.find((r) => r.id === acoesDe) ?? null;

  // ---- modal de cadastro ----

  const abrirModal = () => {
    setSelecionado(null);
    setValores({});
    setBusca('');
    setResultados(null);
    setErroBusca('');
    setErroForm('');
    setModalAberto(true);
    setTimeout(() => campoBusca.current?.focus(), 0);
  };
  const fecharModal = useCallback(() => setModalAberto(false), []);
  useEffect(() => {
    if (!modalAberto) return;
    const aoTeclar = (e: KeyboardEvent) => { if (e.key === 'Escape') fecharModal(); };
    window.addEventListener('keydown', aoTeclar);
    return () => window.removeEventListener('keydown', aoTeclar);
  }, [modalAberto, fecharModal]);

  const pesquisar = (texto: string) => {
    setBusca(texto);
    clearTimeout(temporizador.current);
    buscaAtual.current = texto;
    if (!texto.trim()) { setResultados(null); setErroBusca(''); return; }
    temporizador.current = setTimeout(async () => {
      try {
        const encontrados = await chamar<PedidoEncontrado[]>(`/api/problematicos/pedidos?q=${encodeURIComponent(texto)}`);
        if (buscaAtual.current !== texto) return;
        setResultados(Array.isArray(encontrados) ? encontrados : []);
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
    setSelecionado({ numero, cliente, carregando: true, aviso: '', prazoEntrega: null, preenchido: false, valor: null, valorTotal: null });
    try {
      const d = await chamar<any>(`/api/problematicos/pedidos/${numero}`);
      let preenchido = false;
      if (abaAtual === 'devolucoes') {
        // Devolução: forma de pagamento e valor saem do pedido de venda no Nomus, sem apagar o que já foi digitado.
        setValores((atual) => ({
          ...atual,
          formaPagamento: atual.formaPagamento ? atual.formaPagamento : String(d.formaPagamento || ''),
          valor: atual.valor ? atual.valor : String(d.valor ?? ''),
        }));
        preenchido = !!(d.formaPagamento || (d.valor !== null && d.valor !== undefined));
      }
      setSelecionado((atual) => (atual?.numero === numero ? { numero, cliente: d.cliente || cliente, carregando: false, aviso: d.aviso || '', prazoEntrega: d.prazoEntrega ?? null, preenchido, valor: typeof d.valor === 'number' ? d.valor : null, valorTotal: typeof d.valorTotal === 'number' ? d.valorTotal : null } : atual));
    } catch (e: any) {
      setSelecionado(null);
      setErroForm(e.message);
    }
  };

  const adicionar = async () => {
    setErroForm('');
    if (!selecionado) return setErroForm('Escolha o pedido na busca primeiro.');
    if (selecionado.carregando && aba === 'devolucoes') return setErroForm('Aguarde um instante: buscando a forma de pagamento e o valor do pedido no Nomus…');
    const corpo: Record<string, unknown> = { numeroPedido: selecionado.numero, cliente: selecionado.cliente };
    for (const campo of def.campos) {
      const texto = (valores[campo.k] ?? '').trim();
      if (campo.tipo === 'status') corpo.status = texto || 'NAO_REALIZADA';
      else if (campo.tipo === 'number') { if (texto !== '') corpo[campo.k] = Number(texto.replace(',', '.')); }
      else if (texto !== '' || campo.obrigatorio) corpo[campo.k] = texto;
    }
    setSalvando(true);
    try {
      guardar(await chamar<RespostaPcp>(`/api/problematicos/${rota(aba)}`, { method: 'POST', body: JSON.stringify(corpo) }));
      setModalAberto(false); // o cadastro fecha ao concluir
      setAviso(corpo.status === 'REALIZADA' ? `Pedido ${selecionado.numero} cadastrado como realizada: oculto da lista.` : `Pedido ${selecionado.numero} cadastrado em ${def.aba}.`);
    } catch (e: any) {
      setErroForm(e.message);
    } finally {
      setSalvando(false);
    }
  };

  // ---- edição na tabela ----

  const salvarCampo = async (registro: Registro, campo: CampoDef, bruto: string) => {
    let novo: string | number | null = bruto.trim();
    if (campo.tipo === 'date' && novo && !/^(20\d\d)-\d\d-\d\d$/.test(novo)) return; // ano ainda sendo digitado
    if (novo === textoDoCampo(registro, campo)) return; // nada mudou
    if (campo.obrigatorio && novo === '') { setErroGeral(`Informe ${campo.rotulo.toLowerCase()}.`); return; }
    if (campo.tipo === 'number') novo = novo === '' ? null : Number(novo.replace(',', '.'));
    if (campo.tipo === 'date' && novo === '') novo = null; // data opcional (ex.: prazo da ação) pode ser limpa
    const chave = `${aba}:${registro.id}:${campo.k}:${novo}`;
    if (emGravacao.current.has(chave)) return;
    emGravacao.current.add(chave);
    try {
      const anterior = statusDe(registro);
      const resposta = await chamar<RespostaPcp>(`/api/problematicos/${rota(aba)}/${registro.id}`, { method: 'PATCH', body: JSON.stringify({ [campo.k]: novo }) });
      guardar(resposta);
      setErroGeral('');
      if (campo.tipo === 'status' && novo !== anterior) {
        // O registro saiu da lista com o filtro atual? Avisa e oferece desfazer.
        const atualizado = montar(resposta)[aba].find((x) => x.id === registro.id);
        if (!atualizado || !passaNoFiltro(atualizado, aba, filtro)) {
          const numero = registro.numeroPedido;
          const mensagem = novo === 'PERDIDO' ? `Pedido ${numero} marcado como perdido e removido da tela.`
            : novo === 'REALIZADA' && aba === 'devolucoes' ? `Pedido ${numero} realizado: agora está em Pedidos Convertidos.`
            : `Pedido ${numero} marcado como ${NOMES_STATUS[novo as StatusRegistro].toLowerCase()} e ocultado.`;
          setDesfazer({ aba, id: registro.id, numero, mensagem, anterior });
        }
      }
    } catch (e: any) {
      setErroGeral(e.message);
      carregar(); // volta o que estava gravado
    } finally {
      emGravacao.current.delete(chave);
    }
  };

  const desfazerRealizada = async () => {
    if (!desfazer) return;
    const { aba: abaDoRegistro, id, anterior } = desfazer;
    setDesfazer(null);
    try {
      guardar(await chamar<RespostaPcp>(`/api/problematicos/${rota(abaDoRegistro)}/${id}`, { method: 'PATCH', body: JSON.stringify({ status: anterior }) }));
    } catch (e: any) {
      setErroGeral(e.message);
    }
  };

  const remover = async (registro: Registro) => {
    if (!window.confirm(`Excluir o registro do pedido ${registro.numeroPedido}?`)) return;
    try {
      guardar(await chamar<RespostaPcp>(`/api/problematicos/${rota(aba)}/${registro.id}`, { method: 'DELETE' }));
      setErroGeral('');
    } catch (e: any) {
      setErroGeral(e.message);
    }
  };

  const exportarCsv = () => {
    setMenuAberto(false);
    const celula = (c: CampoDef, r: Registro) => {
      const v = r[c.k];
      if (c.tipo === 'status') return NOMES_STATUS[statusDe(r)];
      if (c.tipo === 'date') return v ? formatDataIsoParaBr(String(v)) : '';
      if (c.tipo === 'number') return v === null || v === undefined ? '' : String(v).replace('.', ',');
      return String(v ?? '');
    };
    const escapar = (x: unknown) => {
      let s = String(x ?? '');
      if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`; // não deixa o Excel tratar texto como fórmula
      return /[;"\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    };
    const cabecalho = ['Número do pedido', 'Cliente', ...def.campos.map((c) => c.rotulo)];
    const linhas = lista.map((r) => [r.numeroPedido, r.cliente, ...def.campos.map((c) => celula(c, r))].map(escapar).join(';'));
    const url = URL.createObjectURL(new Blob(['﻿' + [cabecalho.join(';'), ...linhas].join('\r\n') + '\r\n'], { type: 'text/csv;charset=utf-8' }));
    const link = Object.assign(document.createElement('a'), { href: url, download: `${aba}-${hoje}.csv` });
    document.body.append(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 5000);
  };

  // ---- textos de apoio do cadastro ----

  const dica: React.ReactNode = (() => {
    const s = selecionado;
    if (!s) return aba === 'devolucoes' ? 'Escolha o pedido: forma de pagamento e valor são preenchidos sozinhos com os dados do pedido de venda (você pode ajustar).' : 'Digite o número ou o nome do cliente e escolha o pedido na lista.';
    if (s.carregando) return 'Buscando os dados do pedido no Nomus… (pode levar alguns segundos)';
    if (s.aviso) return (
      <>
        <span className="font-semibold text-yellow-800">{s.aviso}</span>{' '}
        <button type="button" onClick={() => escolher(s.numero, s.cliente)} className="font-bold text-blue-700 underline">Tentar de novo</button>
      </>
    );
    if (aba === 'urgentes' && s.prazoEntrega) return `Prazo de entrega atual do pedido: ${formatDataIsoParaBr(s.prazoEntrega)}.`;
    if (aba === 'devolucoes') {
      if (!s.preenchido) return 'O Nomus não trouxe forma de pagamento/valor deste pedido: preencha à mão.';
      const dividido = s.valorTotal !== null && s.valor !== null && Math.abs(s.valorTotal - s.valor) > 0.005;
      return dividido
        ? <>Forma de pagamento preenchida pelo pedido de venda. O valor é o da <b>entrada</b> ({brl(s.valor ?? 0)}); o total do pedido é {brl(s.valorTotal ?? 0)}.</>
        : 'Forma de pagamento e valor (pago de uma vez) preenchidos com os dados do pedido de venda do Nomus.';
    }
    return '';
  })();

  const entradaModal = 'h-10 w-full rounded-[10px] border border-neutral-200 bg-white px-3 text-[13px] text-neutral-800 outline-none focus:border-yellow-400 focus:ring-2 focus:ring-yellow-300/40';
  const entradaFiltro = 'h-9 rounded-[10px] border border-neutral-200 bg-white text-xs text-neutral-800 outline-none focus:border-yellow-400 focus:ring-2 focus:ring-yellow-300/40';
  const botao = 'inline-flex items-center gap-1.5 rounded-[10px] border border-neutral-200 bg-white px-3 py-1.5 text-xs font-bold text-neutral-700 hover:border-yellow-400 hover:bg-yellow-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-yellow-400';
  const botaoAmarelo = 'inline-flex items-center justify-center gap-1.5 rounded-[10px] bg-gradient-to-b from-yellow-300 to-yellow-400 px-4 py-1.5 text-xs font-extrabold text-neutral-900 shadow-md shadow-yellow-400/30 hover:brightness-105 focus:outline-none focus-visible:ring-2 focus-visible:ring-yellow-600 disabled:opacity-50';
  const Icone = def.icone;
  const cartao = 'rounded-2xl border border-neutral-200 bg-white shadow-sm';
  const celulaCabecalho = 'sticky top-0 z-[1] border-b border-neutral-100 bg-neutral-50 px-2 py-2.5 text-left text-[11px] font-extrabold text-neutral-600';
  const colunas = COLUNAS[aba];
  const periodo = def.data.tipo === 'cadastro' ? 'do cadastro' : def.data.rotulo === 'Data de entrega' ? 'da data de entrega' : 'do prazo da ação';
  const celulaDaFila = (c: ColunaFila, r: Registro): React.ReactNode => {
    if (c.tipo === 'etapas') {
      const etapas = r.etapas || [];
      return (
        <button type="button" onClick={() => abrirAcoes(r.id)} aria-label={`Ações do pedido ${r.numeroPedido}: ${r.etapasFeitas || 0} de 5 etapas`} title={etapas.map((e) => `${e.nome}: ${e.feita ? 'feita' : 'pendente'}`).join(' · ')} className="inline-flex items-center gap-[3px] rounded-lg px-1.5 py-[3px] hover:bg-yellow-50">
          {etapas.map((e) => <i key={e.nome} className={`h-[9px] w-[9px] rounded-full ${e.feita ? 'bg-yellow-400' : 'bg-slate-200'}`} />)}
          <b className="ml-1 text-[10.5px] text-slate-500">{r.etapasFeitas || 0}/5</b>
        </button>
      );
    }
    const v = r[c.k];
    if (c.tipo === 'data') {
      const atraso = !!v && String(v) < hoje && statusDe(r) !== 'REALIZADA' && def.data.tipo === 'futura';
      return v ? <span className={atraso ? 'font-bold text-red-700' : ''}>{formatDataIsoParaBr(String(v))}</span> : <span className="text-slate-300">—</span>;
    }
    if (c.tipo === 'brl') return v === null || v === undefined ? <span className="text-slate-300">—</span> : brl(Number(v));
    return v ? <span className="line-clamp-2 max-w-[170px]" title={String(v)}>{String(v)}</span> : <span className="text-slate-300">—</span>;
  };

  return (
    <div className="space-y-4">
      {/* Cabeçalho */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex min-w-0 flex-1 basis-[420px] items-start gap-3">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[13px] bg-gradient-to-br from-yellow-200 to-yellow-100 shadow-md shadow-yellow-400/20">
            <AlertTriangle className="h-[22px] w-[22px] text-yellow-500" aria-hidden="true" />
          </span>
          <div>
            <span className="text-[10px] font-bold uppercase tracking-[0.12em] text-neutral-500">Dashboard › Pedidos › <b className="text-neutral-900">Controle operacional</b></span>
            <h1 className="text-[22px] font-black leading-tight tracking-tight text-neutral-900">Pedidos problemáticos</h1>
            <p className="mt-1 max-w-3xl text-xs leading-snug text-neutral-500">
              Registre os pedidos urgentes, as devoluções e os clientes com defeito. Escolha o pedido pela busca: os dados dele são preenchidos sozinhos. Os registros são os mesmos do PCP.
            </p>
          </div>
        </div>
        <div className={`flex min-w-[240px] items-center gap-2.5 rounded-[13px] border bg-white px-3 py-2 shadow-sm ${semConexao ? 'border-yellow-300' : 'border-emerald-100'}`} role="status">
          <span className={`flex h-[26px] w-[26px] shrink-0 items-center justify-center rounded-full ${semConexao ? 'bg-yellow-400' : 'bg-emerald-500'}`}>
            {semConexao ? <AlertTriangle className="h-3.5 w-3.5 text-neutral-900" aria-hidden="true" /> : <Check className="h-3.5 w-3.5 text-white" aria-hidden="true" />}
          </span>
          <div className="min-w-0">
            <b className="block text-xs text-neutral-900">{semConexao ? 'Sem conexão com o PCP' : 'Sincronizado com o PCP'}</b>
            <small className="block text-[10.5px] text-neutral-500">
              {semConexao ? 'Mostrando a última lista; tentando de novo…' : atualizadoEm ? `Registros do PCP · atualizados às ${atualizadoEm.toLocaleTimeString('pt-BR', { timeZone: 'America/Sao_Paulo', hour: '2-digit', minute: '2-digit' })}` : 'Carregando…'}
            </small>
          </div>
          <button type="button" onClick={() => carregar(true)} aria-label="Atualizar agora" title="Atualizar agora" className="ml-auto flex h-[30px] w-[30px] shrink-0 items-center justify-center rounded-full bg-emerald-50 text-emerald-600 hover:bg-emerald-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400">
            <RefreshCw className={`h-[15px] w-[15px] ${atualizando ? 'animate-spin' : ''}`} aria-hidden="true" />
          </button>
        </div>
      </div>

      {erroGeral && (
        <div role="alert" className="flex gap-2 rounded-xl border border-red-200 bg-red-50 p-3 text-xs text-red-700">
          <AlertTriangle className="h-4 w-4 shrink-0" aria-hidden="true" />
          {erroGeral}
        </div>
      )}
      {desfazer && (
        <div role="status" className="flex flex-wrap items-center gap-3 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-xs font-semibold text-emerald-800">
          {desfazer.mensagem}
          <button type="button" onClick={desfazerRealizada} className="rounded-full border border-emerald-300 bg-white px-3 py-1 text-[11px] font-bold text-emerald-800 hover:bg-emerald-100">Desfazer</button>
        </div>
      )}
      {aviso && <div role="status" className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-xs font-semibold text-emerald-800">{aviso}</div>}

      {/* Abas em pílula */}
      <div role="tablist" aria-label="Tabelas" className="flex flex-wrap gap-2">
        {(Object.keys(TABELAS) as Aba[]).map((chave) => {
          const t = TABELAS[chave];
          const IconeAba = t.icone;
          const selecionada = aba === chave;
          return (
            <button
              key={chave}
              type="button"
              role="tab"
              aria-selected={selecionada}
              onClick={() => setAba(chave)}
              className={`inline-flex items-center gap-1.5 rounded-full border px-4 py-2 text-xs font-bold transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-yellow-400 ${selecionada ? 'border-yellow-500 bg-gradient-to-b from-yellow-300 to-yellow-400 text-neutral-900 shadow-md shadow-yellow-400/25' : 'border-neutral-200 bg-white text-neutral-600 hover:border-yellow-400 hover:bg-yellow-50'}`}
            >
              <IconeAba className="h-[15px] w-[15px]" aria-hidden="true" />
              <span>{t.aba}</span>
              <i className={`inline-grid h-5 min-w-5 place-items-center rounded-full px-1.5 text-[11px] font-extrabold not-italic ${selecionada ? 'bg-white text-neutral-900' : 'bg-neutral-100 text-neutral-600'}`}>{pendentesDe(chave)}</i>
            </button>
          );
        })}
      </div>

      {/* Filtros | fila | detalhes */}
      <div className="grid items-start gap-3 md:grid-cols-[210px_minmax(0,1fr)] xl:grid-cols-[210px_minmax(0,1fr)_300px]">
        <aside className={`${cartao} p-4 md:sticky md:top-2`} aria-label="Filtros">
          <div className="mb-3.5 flex items-center justify-between text-sm text-neutral-900">
            <b className="inline-flex items-center gap-1.5 font-extrabold"><Filter className="h-4 w-4" aria-hidden="true" /> Filtros</b>
            <button type="button" onClick={() => setFiltros((atual) => ({ ...atual, [aba]: { ...filtroInicial(aba), ordem: atual[aba].ordem } }))} className="text-[11.5px] font-bold text-yellow-800 underline">Limpar filtros</button>
          </div>
          <label className="mb-3.5 block text-[11.5px] font-bold text-slate-500">Buscar por pedido ou cliente
            <span className="mt-1.5 flex h-9 items-center gap-2 rounded-[10px] border border-neutral-200 bg-white px-2.5 focus-within:border-yellow-400 focus-within:ring-2 focus-within:ring-yellow-300/40">
              <Search className="h-4 w-4 shrink-0 text-neutral-400" aria-hidden="true" />
              <input type="search" value={filtro.q} onChange={(e) => mudarFiltro({ q: e.target.value })} placeholder="Nº do pedido ou nome do cliente" className="min-w-0 flex-1 bg-transparent text-xs font-medium text-neutral-800 outline-none" />
            </span>
          </label>
          <div className="mb-3.5 text-[11.5px] font-bold text-slate-500">Período {periodo}
            <div className="mt-1.5 grid grid-cols-[1fr_auto_1fr] items-center gap-1.5">
              <input type="date" value={filtro.de} onChange={(e) => mudarFiltro({ de: e.target.value })} aria-label="Data inicial" className={`${entradaFiltro} min-w-0 px-1.5 !text-[11px]`} />
              <span className="text-[11px] font-medium text-slate-400">até</span>
              <input type="date" value={filtro.ate} onChange={(e) => mudarFiltro({ ate: e.target.value })} aria-label="Data final" className={`${entradaFiltro} min-w-0 px-1.5 !text-[11px]`} />
            </div>
          </div>
          {aba !== 'convertidos' && (<>
          <label className="mb-3.5 block text-[11.5px] font-bold text-slate-500">Status
            <select value={filtro.status} onChange={(e) => mudarFiltro({ status: e.target.value as Filtro['status'] })} className={`${entradaFiltro} mt-1.5 block w-full cursor-pointer px-2`}>
              <option value="pendentes">Não realizadas</option>
              <option value="realizadas">Realizadas</option>
              {ehDevolucao(aba) && <option value="perdidas">Perdidas</option>}
              <option value="todas">Todas</option>
            </select>
          </label>
          <label className="mb-3.5 flex items-center gap-2 text-xs font-semibold text-slate-600">
            <input type="checkbox" checked={filtro.status !== 'pendentes'} onChange={(e) => mudarFiltro({ status: e.target.checked ? 'todas' : 'pendentes' })} className="accent-yellow-400" />
            Mostrar realizadas ({feitas})
          </label>
          <div className="text-[11.5px] font-bold text-slate-500">Atalhos
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              {([['todas', 'Todos', todos.length - perdidas], ['pendentes', 'Não realizada', abertas], ['realizadas', 'Realizada', feitas], ...(ehDevolucao(aba) ? [['perdidas', 'Perdido', perdidas]] : [])] as Array<[Filtro['status'], string, number]>).map(([valor, nome, n]) => (
                <button key={valor} type="button" onClick={() => mudarFiltro({ status: valor })} className={`rounded-full border px-2.5 py-1 text-[11px] font-bold ${filtro.status === valor ? 'border-yellow-400 bg-yellow-300 text-neutral-900' : 'border-neutral-200 bg-white text-slate-600 hover:border-yellow-400'}`}>{nome} ({n})</button>
              ))}
            </div>
          </div>
          </>)}
        </aside>

        <section className={`${cartao} min-w-0 p-4`} aria-label={def.listaTitulo}>
          <div className="mb-3 flex flex-wrap items-center gap-2.5">
            <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-[11px] ${def.cor === 'verde' ? 'bg-emerald-50 text-emerald-700' : 'bg-yellow-100 text-yellow-600'}`}>
              <List className="h-4 w-4" aria-hidden="true" />
            </span>
            <div className="min-w-0">
              <h2 className="text-[15px] font-extrabold tracking-tight text-neutral-900">{def.listaTitulo} <span className="text-[13px] font-semibold text-slate-400">({lista.length})</span></h2>
              <p className="text-[11.5px] text-neutral-500">{def.listaSub}</p>
            </div>
            <div className="ml-auto flex flex-wrap items-center gap-2">
              <label className="inline-flex items-center gap-1.5 whitespace-nowrap text-[11px] text-slate-500">Ordenar por
                <select value={filtro.ordem} onChange={(e) => mudarFiltro({ ordem: e.target.value as Filtro['ordem'] })} aria-label="Ordenar" className={`${entradaFiltro} h-8 cursor-pointer px-2`}>
                  <option value="recentes">Mais recentes</option>
                  <option value="data">{def.data.tipo === 'futura' ? `${def.data.rotulo} (mais próxima)` : 'Data do cadastro (mais antiga)'}</option>
                  <option value="pedido">Número do pedido</option>
                </select>
              </label>
              <button type="button" onClick={() => carregar(true)} aria-label="Atualizar" title="Atualizar" className={`${botao} px-2.5`}>
                <RefreshCw className={`h-3.5 w-3.5 ${atualizando ? 'animate-spin' : ''}`} aria-hidden="true" />
              </button>
              <div className="relative">
                <button type="button" onClick={() => setMenuAberto((v) => !v)} aria-label="Mais opções" aria-expanded={menuAberto} className={`${botao} px-2.5`}>
                  <MoreHorizontal className="h-3.5 w-3.5" aria-hidden="true" />
                </button>
                {menuAberto && (
                  <div className="absolute right-0 top-[calc(100%+6px)] z-20 min-w-[200px] rounded-xl border border-neutral-200 bg-white p-1.5 shadow-lg">
                    <button type="button" onClick={exportarCsv} className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-xs text-neutral-700 hover:bg-yellow-50">
                      <Download className="h-3.5 w-3.5" aria-hidden="true" /> Exportar CSV da lista
                    </button>
                  </div>
                )}
              </div>
              {aba === 'devolucoes' && (
                <button type="button" onClick={() => { setEscolhaQ(''); setEscolhaAberta(true); }} className={`${botao} border-yellow-400 bg-yellow-100 font-extrabold text-yellow-900 hover:bg-yellow-200`}>
                  <ListChecks className="h-[15px] w-[15px]" aria-hidden="true" /> Ações
                </button>
              )}
              {aba !== 'convertidos' && (
                <button type="button" onClick={abrirModal} className={botaoAmarelo}>
                  <Plus className="h-4 w-4" aria-hidden="true" /> Adicionar
                </button>
              )}
            </div>
          </div>

          {carregando ? (
            <div className="flex justify-center py-10"><Loader2 className="h-5 w-5 animate-spin text-neutral-400" aria-label="Carregando" /></div>
          ) : lista.length === 0 ? (
            <div className="flex flex-col items-center rounded-2xl bg-gradient-to-b from-yellow-50 to-white px-4 py-8 text-center">
              <span className="flex h-14 w-14 items-center justify-center rounded-full bg-yellow-100 text-yellow-500"><Icone className="h-7 w-7" aria-hidden="true" /></span>
              <h3 className="mt-3 text-base font-extrabold text-neutral-900">{todos.length > 0 ? 'Nenhum registro com esses filtros.' : def.vazio}</h3>
              <p className="mt-1 text-xs text-neutral-500">{todos.length > 0 ? 'Ajuste os filtros ao lado para ver outros registros.' : def.vazioSub}</p>
            </div>
          ) : (
            <>
              <div data-edicao className="max-h-[560px] overflow-auto rounded-xl border border-neutral-100">
                <table className="w-full border-separate border-spacing-0 text-xs">
                  <thead>
                    <tr>
                      <th scope="col" className={`${celulaCabecalho} w-[34px]`}><span className="sr-only">Tipo</span></th>
                      <th scope="col" className={celulaCabecalho}>Pedido</th>
                      <th scope="col" className={celulaCabecalho}>Cliente</th>
                      {colunas.map((c) => <th key={c.k} scope="col" className={`${celulaCabecalho} whitespace-nowrap`}>{c.rot}</th>)}
                      <th scope="col" className={celulaCabecalho}>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {lista.map((registro) => {
                      const aberto = registro.id === idSelecionado;
                      const fundo = aberto ? 'bg-yellow-100' : 'bg-white group-hover:bg-yellow-50/60';
                      return (
                        <tr
                          key={registro.id}
                          onClick={(e) => { if (!(e.target as HTMLElement).closest('select, button, input, textarea, a')) escolherRegistro(registro.id); }}
                          onKeyDown={(e) => { if ((e.key === 'Enter' || e.key === ' ') && e.target === e.currentTarget) { e.preventDefault(); escolherRegistro(registro.id); } }}
                          tabIndex={0}
                          aria-selected={aberto}
                          className="group cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-yellow-400"
                        >
                          <td className={`border-b border-neutral-100 py-2 pl-2 pr-0 ${fundo} ${aberto ? 'shadow-[inset_3px_0_0_#fbc41a]' : ''} ${def.cor === 'verde' ? 'text-emerald-600' : 'text-yellow-600'}`}><Icone className="h-[17px] w-[17px]" aria-hidden="true" /></td>
                          <td className={`border-b border-neutral-100 px-2 py-2 ${fundo}`}><b className="text-neutral-900">{registro.numeroPedido}</b></td>
                          <td className={`max-w-[130px] min-w-[90px] border-b border-neutral-100 px-2 py-2 text-neutral-700 ${fundo}`}>{registro.cliente || '—'}</td>
                          {colunas.map((c) => <td key={c.k} className={`border-b border-neutral-100 px-2 py-2 ${fundo}`}>{celulaDaFila(c, registro)}</td>)}
                          <td className={`border-b border-neutral-100 px-2 py-2 ${fundo}`}>
                            <select
                              key={`${registro.id}-status-${statusDe(registro)}`}
                              defaultValue={statusDe(registro)}
                              aria-label={`Status do pedido ${registro.numeroPedido}`}
                              onChange={(e) => salvarCampo(registro, STATUS, e.target.value)}
                              className={`h-[30px] min-w-[108px] cursor-pointer rounded-[10px] border border-transparent px-1.5 text-[11.5px] font-bold focus:border-yellow-400 focus:outline-none ${classeStatus(statusDe(registro))}`}
                            >
                              {opcoesStatus(aba, statusDe(registro)).map((v) => <option key={v} value={v}>{NOMES_STATUS[v]}</option>)}
                            </select>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              <p className="mt-2 text-[11px] text-neutral-400">Exibindo {lista.length} {lista.length === 1 ? 'registro' : 'registros'}{lista.length !== todos.length ? ` de ${todos.length}` : ''}</p>
            </>
          )}
        </section>

        {/* Detalhes do pedido selecionado */}
        <aside data-edicao className={`${cartao} p-4 md:col-span-2 xl:sticky xl:top-2 xl:col-span-1`} aria-label="Detalhes do pedido">
          <div className="mb-3.5 flex items-center gap-2.5">
            <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-[11px] ${def.cor === 'verde' ? 'bg-emerald-50 text-emerald-700' : 'bg-yellow-100 text-yellow-600'}`}><List className="h-4 w-4" aria-hidden="true" /></span>
            <h2 className="text-[15px] font-extrabold text-neutral-900">Detalhes do pedido</h2>
          </div>
          {!registroAberto ? (
            <p className="text-[12.5px] leading-normal text-slate-500">Selecione um registro na fila para ver os detalhes e editar.</p>
          ) : (
            <div key={`${aba}-${registroAberto.id}`}>
              <div className="mb-3 flex items-center justify-between gap-2">
                <h3 className="text-[17px] font-extrabold tracking-tight text-neutral-900">Pedido nº {registroAberto.numeroPedido}</h3>
                <select
                  key={`${registroAberto.id}-status-${statusDe(registroAberto)}`}
                  defaultValue={statusDe(registroAberto)}
                  aria-label={`Status do pedido ${registroAberto.numeroPedido}`}
                  onChange={(e) => salvarCampo(registroAberto, STATUS, e.target.value)}
                  className={`h-[30px] cursor-pointer rounded-[10px] border border-transparent px-1.5 text-[11.5px] font-bold focus:border-yellow-400 focus:outline-none ${classeStatus(statusDe(registroAberto))}`}
                >
                  {opcoesStatus(aba, statusDe(registroAberto)).map((v) => <option key={v} value={v}>{NOMES_STATUS[v]}</option>)}
                </select>
              </div>
              <div className="mb-3 grid grid-cols-2 gap-2.5 text-[11px] text-slate-400">
                <div><span className="mb-0.5 block">Cliente</span><b className="text-[12.5px] font-bold text-slate-700">{registroAberto.cliente || '—'}</b></div>
                <div><span className="mb-0.5 block">Categoria</span><b className="inline-block rounded-full bg-yellow-300 px-2.5 py-0.5 text-[11.5px] font-bold text-neutral-900">{def.aba.replace(/^Pedidos (de )?/, '')}</b></div>
              </div>
              <div className="mb-3 grid gap-2.5">
                {def.campos.filter((c) => c.tipo !== 'status').map((campo) => {
                  const valor = textoDoCampo(registroAberto, campo);
                  const classe = 'mt-1 block w-full min-w-0 rounded-[10px] border border-neutral-200 bg-white px-2.5 py-[7px] text-[12.5px] font-medium text-neutral-900 focus:border-yellow-400 focus:bg-yellow-50/40 focus:outline-none focus:ring-2 focus:ring-yellow-300/40';
                  const rotulo = `${campo.rotulo} do pedido ${registroAberto.numeroPedido}`;
                  return (
                    <label key={campo.k} className="block text-[11px] font-bold text-slate-500">
                      {campo.rotulo}
                      {campo.tipo === 'text' && (campo.max ?? 0) >= 300 ? (
                        <textarea
                          key={`${registroAberto.id}-${campo.k}-${valor}`}
                          defaultValue={valor}
                          rows={2}
                          maxLength={campo.max}
                          aria-label={rotulo}
                          onBlur={(e) => salvarCampo(registroAberto, campo, e.target.value)}
                          className={`${classe} resize-y`}
                        />
                      ) : (
                        <input
                          key={`${registroAberto.id}-${campo.k}-${valor}`}
                          type={campo.tipo}
                          defaultValue={valor}
                          aria-label={rotulo}
                          {...(campo.tipo === 'number' ? { min: 0, step: '0.01' } : {})}
                          {...(campo.tipo === 'date' ? { min: '2000-01-01', max: '2100-12-31', onChange: (e: React.ChangeEvent<HTMLInputElement>) => salvarCampo(registroAberto, campo, e.target.value) } : {})}
                          {...(campo.max ? { maxLength: campo.max } : {})}
                          onBlur={(e) => salvarCampo(registroAberto, campo, e.target.value)}
                          onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }}
                          className={classe}
                        />
                      )}
                    </label>
                  );
                })}
              </div>

              {ehDevolucao(aba) && (
                <div className="mt-1 border-t border-slate-100 pt-3">
                  <h4 className="mb-2 flex items-center gap-1.5 text-xs font-extrabold text-slate-700"><Clock className="h-3.5 w-3.5" aria-hidden="true" /> Etapas do atendimento <i className="ml-auto text-[11px] font-extrabold not-italic text-slate-500">{registroAberto.etapasFeitas || 0}/5</i></h4>
                  <ol className="m-0 list-none p-0">
                    {(registroAberto.etapas || []).map((e, i, todas) => (
                      <li key={e.nome} className="relative grid grid-cols-[14px_minmax(0,1fr)_auto] gap-2.5 pb-3 last:pb-0.5">
                        {i < todas.length - 1 && <span className={`absolute bottom-[-2px] left-[6px] top-[14px] w-0.5 ${e.feita ? 'bg-emerald-200' : 'bg-slate-200'}`} aria-hidden="true" />}
                        <i className={`z-[1] mt-[3px] h-3 w-3 rounded-full ring-[3px] ring-white ${e.feita ? 'bg-emerald-500' : 'bg-slate-300'}`} />
                        <div className="min-w-0">
                          <b className={`block text-[12.5px] ${e.feita ? 'font-extrabold text-neutral-900' : 'font-bold text-slate-400'}`}>{e.nome}</b>
                          <small className="mt-px block break-words text-[11.5px] leading-snug text-slate-500">{e.feita ? (e.detalhe || 'Preenchida.') : 'Ainda não preenchida.'}</small>
                        </div>
                        <time className="max-w-[92px] text-right text-[10.5px] text-slate-400">{e.em ? quando(e.em).replace(', ', ' às ') : ''}</time>
                      </li>
                    ))}
                  </ol>
                </div>
              )}

              <div className="mt-3 border-t border-slate-100 pt-3">
                <h4 className="mb-2 flex items-center gap-1.5 text-xs font-extrabold text-slate-700"><Clock className="h-3.5 w-3.5" aria-hidden="true" /> Histórico</h4>
                <ul className="m-0 list-none p-0 text-[11.5px]">
                  <li className="flex gap-2 py-[3px]"><i className="mt-1 h-[9px] w-[9px] shrink-0 rounded-full bg-yellow-400" /><div><b className="block font-bold text-slate-700">Cadastrado</b><small className="text-slate-400">{quando(registroAberto.criadoEm)}</small></div></li>
                  {registroAberto.atualizadoEm && registroAberto.atualizadoEm !== registroAberto.criadoEm && (
                    <li className="flex gap-2 py-[3px]"><i className="mt-1 h-[9px] w-[9px] shrink-0 rounded-full bg-slate-300" /><div><b className="block font-bold text-slate-700">Última alteração{registroAberto.atualizadoPor ? ` por ${registroAberto.atualizadoPor}` : ''}</b><small className="text-slate-400">{quando(registroAberto.atualizadoEm)}</small></div></li>
                  )}
                </ul>
              </div>

              <div className="mt-3 flex items-center justify-between gap-2 border-t border-slate-100 pt-3">
                {ehDevolucao(aba) && (
                  <button type="button" onClick={() => abrirAcoes(registroAberto.id)} className={`${botao} border-yellow-400 bg-yellow-100 font-extrabold text-yellow-900 hover:bg-yellow-200`}>
                    <ListChecks className="h-[15px] w-[15px]" aria-hidden="true" /> Abrir ações
                  </button>
                )}
                <button type="button" onClick={() => remover(registroAberto)} aria-label={`Excluir registro do pedido ${registroAberto.numeroPedido}`} title="Excluir este registro" className="ml-auto inline-flex items-center gap-1.5 rounded-[10px] border border-neutral-200 bg-white px-2.5 py-1 text-[11px] font-bold text-neutral-600 hover:border-red-300 hover:bg-red-50 hover:text-red-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-red-400">
                  <Trash2 className="h-3.5 w-3.5" aria-hidden="true" /> Excluir
                </button>
              </div>
            </div>
          )}
        </aside>
      </div>

      {/* Modal de cadastro */}
      {modalAberto && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-3 backdrop-blur-[2px]" onClick={fecharModal}>
          <form
            role="dialog"
            aria-modal="true"
            aria-label={def.cardTitulo}
            className="max-h-[92vh] w-full max-w-[440px] overflow-auto rounded-[20px] bg-white shadow-2xl"
            onClick={(e) => e.stopPropagation()}
            onSubmit={(e) => { e.preventDefault(); adicionar(); }}
          >
            <div className="flex items-center gap-3 px-5 pb-3 pt-4">
              <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${def.cor === 'verde' ? 'bg-emerald-50 text-emerald-700' : 'bg-yellow-100 text-yellow-600'}`}><Plus className="h-5 w-5" aria-hidden="true" /></span>
              <div>
                <h2 className="text-base font-extrabold tracking-tight text-neutral-900">{def.cardTitulo}</h2>
                <p className="mt-0.5 text-xs leading-snug text-neutral-500">{def.cardSub}</p>
              </div>
              <button type="button" onClick={fecharModal} aria-label="Fechar" className="ml-auto flex h-8 w-8 shrink-0 items-center justify-center self-start rounded-full bg-neutral-100 text-neutral-600 hover:bg-neutral-200"><X className="h-4 w-4" aria-hidden="true" /></button>
            </div>

            <div className="space-y-2.5 px-5 pb-5">
              <div className="relative">
                <label className="mb-1 block text-xs font-bold text-neutral-700" htmlFor="pp-busca">Número do pedido <i className="not-italic text-red-500">*</i></label>
                {selecionado ? (
                  <div className="inline-flex max-w-full items-center gap-1.5 rounded-[10px] border border-yellow-200 bg-yellow-50 py-2 pl-3 pr-2 text-xs text-neutral-700">
                    <span className="min-w-0 truncate"><b>Pedido {selecionado.numero}</b>{selecionado.cliente ? ` · ${selecionado.cliente}` : ''}</span>
                    <button type="button" onClick={() => { setSelecionado(null); setTimeout(() => campoBusca.current?.focus(), 0); }} aria-label="Trocar o pedido" className="flex h-[22px] w-[22px] shrink-0 items-center justify-center rounded-full text-neutral-600 hover:bg-yellow-200"><X className="h-3.5 w-3.5" aria-hidden="true" /></button>
                  </div>
                ) : (
                  <>
                    <div className="flex h-10 items-center gap-2 rounded-[10px] border border-neutral-200 bg-white px-3 focus-within:border-yellow-400 focus-within:ring-2 focus-within:ring-yellow-300/40">
                      <Search className="h-[18px] w-[18px] shrink-0 text-neutral-400" aria-hidden="true" />
                      <input
                        id="pp-busca"
                        ref={campoBusca}
                        type="search"
                        autoComplete="off"
                        value={busca}
                        onChange={(e) => pesquisar(e.target.value)}
                        onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); const primeiro = resultados?.[0]; if (primeiro) escolher(primeiro.numero, primeiro.cliente); } }}
                        placeholder="Número ou nome do cliente"
                        className="h-full min-w-0 flex-1 bg-transparent text-[13px] outline-none"
                      />
                    </div>
                    {resultados && (
                      <ul className="absolute left-0 right-0 top-full z-20 mt-1 max-h-64 overflow-auto rounded-xl border border-neutral-200 bg-white p-1 shadow-lg">
                        {resultados.length === 0 ? (
                          <li className="px-3 py-2 text-xs text-neutral-500">{erroBusca || 'Nenhum pedido encontrado.'}</li>
                        ) : resultados.map((pedido) => (
                          <li key={pedido.numero}>
                            <button type="button" onClick={() => escolher(pedido.numero, pedido.cliente)} className="block w-full rounded-lg px-3 py-2 text-left text-[13px] text-neutral-700 hover:bg-yellow-50 focus:bg-yellow-50 focus:outline-none">
                              <b>{pedido.numero}</b> {pedido.cliente || 'sem nome'}{pedido.origem === 'nomus' && <em className="ml-1 rounded bg-blue-50 px-1.5 text-[10px] not-italic text-blue-700">só no Nomus</em>}
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
                  <label className="mb-1 block text-xs font-bold text-neutral-700" htmlFor="pp-status">{campo.rotulo}</label>
                  <select
                    id="pp-status"
                    value={valores.status || 'NAO_REALIZADA'}
                    onChange={(e) => setValores((atual) => ({ ...atual, status: e.target.value }))}
                    className={`${entradaModal} cursor-pointer font-bold ${classeStatus((valores.status || 'NAO_REALIZADA') as StatusRegistro)}`}
                  >
                    {opcoesStatus(aba, (valores.status || 'NAO_REALIZADA') as StatusRegistro).map((v) => <option key={v} value={v}>{NOMES_STATUS[v]}</option>)}
                  </select>
                </div>
              ) : (
                <div key={campo.k}>
                  <label className="mb-1 block text-xs font-bold text-neutral-700" htmlFor={`pp-${campo.k}`}>{campo.rotulo}{campo.obrigatorio && <i className="not-italic text-red-500"> *</i>}</label>
                  <input
                    id={`pp-${campo.k}`}
                    type={campo.tipo}
                    value={valores[campo.k] ?? ''}
                    onChange={(e) => setValores((atual) => ({ ...atual, [campo.k]: e.target.value }))}
                    {...(campo.tipo === 'number' ? { min: 0, step: '0.01', placeholder: '0,00' } : {})}
                    {...(campo.tipo === 'date' ? { min: '2000-01-01', max: '2100-12-31' } : {})}
                    {...(campo.max ? { maxLength: campo.max } : {})}
                    className={entradaModal}
                  />
                </div>
              ))}

              <p className="pt-1 text-[11px] leading-snug text-neutral-500">{dica}</p>
              <p role="alert" className="min-h-4 text-xs font-semibold text-red-700">{erroForm}</p>

              <div className="flex items-center justify-end gap-2.5 pt-1">
                <button type="button" onClick={fecharModal} className={`${botao} h-10 px-5 text-[13px]`}>Cancelar</button>
                <button type="submit" disabled={salvando} className={`${botaoAmarelo} h-10 max-w-[210px] flex-1 text-sm`}>
                  {salvando ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <Plus className="h-4 w-4" aria-hidden="true" />}
                  Adicionar
                </button>
              </div>
            </div>
          </form>
        </div>
      )}

      {/* Escolher a devolução cujas Ações serão abertas */}
      {escolhaAberta && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-3 backdrop-blur-[2px]" onClick={() => setEscolhaAberta(false)}>
          <div role="dialog" aria-modal="true" aria-label="Escolher devolução" className="max-h-[92vh] w-full max-w-[440px] overflow-auto rounded-[20px] bg-white shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center gap-3 px-5 pb-3 pt-4">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700"><ListChecks className="h-5 w-5" aria-hidden="true" /></span>
              <div>
                <h2 className="text-base font-extrabold tracking-tight text-neutral-900">Ações da devolução</h2>
                <p className="mt-0.5 text-xs leading-snug text-neutral-500">Escolha a devolução para registrar as etapas do atendimento.</p>
              </div>
              <button type="button" onClick={() => setEscolhaAberta(false)} aria-label="Fechar" className="ml-auto flex h-8 w-8 shrink-0 items-center justify-center self-start rounded-full bg-neutral-100 text-neutral-600 hover:bg-neutral-200"><X className="h-4 w-4" aria-hidden="true" /></button>
            </div>
            <div className="px-5 pb-5">
              <div className="flex h-10 items-center gap-2 rounded-[10px] border border-neutral-200 bg-white px-3 focus-within:border-yellow-400 focus-within:ring-2 focus-within:ring-yellow-300/40">
                <Search className="h-[18px] w-[18px] shrink-0 text-neutral-400" aria-hidden="true" />
                <input autoFocus type="search" autoComplete="off" value={escolhaQ} onChange={(e) => setEscolhaQ(e.target.value)} placeholder="Pedido ou cliente" className="h-full min-w-0 flex-1 bg-transparent text-[13px] outline-none" />
              </div>
              <ul className="m-0 mt-2.5 max-h-[46vh] list-none overflow-auto p-0">
                {(() => {
                  const q = escolhaQ.trim().toLowerCase();
                  const opcoes = dados.devolucoes.filter((r) => statusDe(r) === 'NAO_REALIZADA' && (!q || `${r.numeroPedido} ${r.cliente}`.toLowerCase().includes(q)));
                  return opcoes.length ? opcoes.map((r) => (
                    <li key={r.id}>
                      <button type="button" onClick={() => abrirAcoes(r.id)} className="grid w-full grid-cols-[70px_1fr_auto] items-center gap-2.5 border-b border-slate-100 px-2.5 py-[9px] text-left text-[13px] hover:bg-yellow-50">
                        <b>{r.numeroPedido}</b><span className="truncate">{r.cliente || 'sem nome'}</span>
                        <i className="rounded-full bg-yellow-300 px-2 py-px text-[11px] font-extrabold not-italic text-neutral-900">{r.etapasFeitas || 0}/5</i>
                      </button>
                    </li>
                  )) : <li className="px-3 py-2 text-xs text-neutral-500">Nenhuma devolução em aberto. Use &quot;Adicionar&quot; para cadastrar.</li>;
                })()}
              </ul>
            </div>
          </div>
        </div>
      )}

      {/* Ações da devolução: etapas do atendimento */}
      {devolucaoAberta && (
        <AcoesDevolucao devolucao={{ id: devolucaoAberta.id, numeroPedido: devolucaoAberta.numeroPedido, cliente: devolucaoAberta.cliente }} onFechar={() => setAcoesDe(null)} onAtualizou={atualizouEtapas} />
      )}
    </div>
  );
};
