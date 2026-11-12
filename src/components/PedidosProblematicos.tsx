import React, { useCallback, useEffect, useRef, useState } from 'react';
import { AlertTriangle, CalendarDays, Check, Download, Filter, Layers, List, Loader2, MoreHorizontal, Plus, RefreshCw, RotateCcw, Search, Trash2, Users, X } from 'lucide-react';
import { formatCurrency, formatDataIsoParaBr } from '../utils/format';

type Aba = 'urgentes' | 'devolucoes' | 'defeitos';
type StatusRegistro = 'NAO_REALIZADA' | 'REALIZADA';
type Icone = React.FC<{ className?: string }>;

interface CampoDef {
  k: string;
  rotulo: string;
  tipo: 'date' | 'text' | 'number' | 'status';
  max?: number;
  obrigatorio?: boolean;
}

// Todo registro nasce "Não realizada"; ao marcar "Realizada" ele some da lista (continua gravado no PCP; o filtro Status traz de volta).
const NOMES_STATUS: Record<StatusRegistro, string> = { NAO_REALIZADA: 'Não realizada', REALIZADA: 'Realizada' };
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
const TABELAS: Record<Aba, TabelaDef> = {
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

const OPCOES_DATA: Record<'futura' | 'cadastro', Array<[string, string]>> = {
  futura: [['', 'Todas as datas'], ['vencidas', 'Vencidas'], ['hoje', 'Hoje'], ['semana', 'Próximos 7 dias'], ['sem', 'Sem data']],
  cadastro: [['', 'Todas as datas'], ['hoje', 'Cadastradas hoje'], ['7', 'Últimos 7 dias'], ['30', 'Últimos 30 dias']],
};

interface Registro {
  id: number;
  numeroPedido: number;
  cliente: string;
  criadoEm?: string;
  status?: StatusRegistro;
  [campo: string]: unknown;
}
type Dados = Record<Aba, Registro[]>;
interface Filtro { q: string; data: string; status: 'pendentes' | 'realizadas' | 'todas' }
interface Resumo { pendentes: number; ultimos7: number; anteriores7: number; serie: number[] }

interface PedidoEncontrado { numero: number; cliente: string; origem: 'pcp' | 'nomus' }
interface PedidoEscolhido { numero: number; cliente: string; carregando: boolean; aviso: string; prazoEntrega: string | null; preenchido: boolean; valor: number | null; valorTotal: number | null }

const VAZIO: Dados = { urgentes: [], devolucoes: [], defeitos: [] };
const ERRO_RESPOSTA_INVALIDA = 'O servidor não respondeu como esperado. Atualize a página; se continuar, o servidor ainda não foi atualizado com esta funcionalidade.';
const filtroInicial = (): Filtro => ({ q: '', data: '', status: 'pendentes' });

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

// ---- datas (sempre no fuso de São Paulo, como no PCP) ----
const diaSP = (iso?: string) => (iso ? new Date(iso).toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' }) : '');
const hojeSP = () => new Date().toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' });
const somarDias = (iso: string, n: number) => {
  const [a, m, d] = iso.split('-').map(Number);
  return new Date(Date.UTC(a, m - 1, d + n)).toISOString().slice(0, 10);
};
const diasEntre = (de: string, ate: string) => Math.round((Date.parse(ate) - Date.parse(de)) / 86_400_000);

/** Indicadores do cartão: pendentes e ritmo de novos cadastros (últimos 7 dias contra os 7 anteriores). */
function resumir(registros: Registro[], hoje: string): Resumo {
  const serie = new Array<number>(14).fill(0);
  for (const r of registros) {
    if (!r.criadoEm || Number.isNaN(new Date(r.criadoEm).getTime())) continue;
    const atras = diasEntre(diaSP(r.criadoEm), hoje);
    if (atras >= 0 && atras <= 13) serie[13 - atras]++;
  }
  const soma = (de: number, ate: number) => serie.slice(de, ate).reduce((s, n) => s + n, 0);
  return { pendentes: registros.filter((r) => statusDe(r) !== 'REALIZADA').length, ultimos7: soma(7, 14), anteriores7: soma(0, 7), serie };
}

function tendencia(r: Resumo): { classe: string; texto: string } {
  if (r.anteriores7 === 0 && r.ultimos7 === 0) return { classe: 'bg-neutral-100 text-neutral-500', texto: 'sem novos' };
  if (r.anteriores7 === 0) return { classe: 'bg-yellow-100 text-neutral-700', texto: `+${r.ultimos7} novos` };
  const pct = Math.round(((r.ultimos7 - r.anteriores7) / r.anteriores7) * 100);
  if (pct === 0) return { classe: 'bg-neutral-100 text-neutral-500', texto: '= igual' };
  return pct > 0 ? { classe: 'bg-yellow-100 text-neutral-700', texto: `↑ +${pct}%` } : { classe: 'bg-emerald-100 text-emerald-700', texto: `↓ −${Math.abs(pct)}%` };
}

const Minigrafico: React.FC<{ serie: number[]; cor: 'ouro' | 'verde' }> = ({ serie, cor }) => {
  const max = Math.max(1, ...serie);
  const w = 130, h = 46, pad = 5;
  const pontos = serie.map((v, i): [number, number] => [pad + (i * (w - 2 * pad)) / (serie.length - 1), h - pad - (v / max) * (h - 2 * pad)]);
  const linha = pontos.map(([x, y], i) => `${i ? 'L' : 'M'}${x.toFixed(1)} ${y.toFixed(1)}`).join(' ');
  const [ux, uy] = pontos[pontos.length - 1];
  const traco = cor === 'verde' ? '#2fa56f' : '#f5c000';
  const id = `pp-grad-${cor}`;
  return (
    <svg className="ml-auto h-6 w-20 shrink-0" viewBox={`0 0 ${w} ${h}`} aria-hidden="true">
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={traco} stopOpacity=".28" />
          <stop offset="1" stopColor={traco} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={`${linha} L${ux.toFixed(1)} ${h} L${pontos[0][0].toFixed(1)} ${h} Z`} fill={`url(#${id})`} />
      <path d={linha} fill="none" stroke={traco} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx={ux.toFixed(1)} cy={uy.toFixed(1)} r="3.2" fill={traco} />
    </svg>
  );
};

const classeStatus = (status: StatusRegistro) => (status === 'REALIZADA' ? 'bg-emerald-50 text-emerald-700' : 'bg-yellow-100 text-neutral-800');

export const PedidosProblematicos: React.FC = () => {
  const [aba, setAba] = useState<Aba>('urgentes');
  const [dados, setDados] = useState<Dados>(VAZIO);
  const [carregando, setCarregando] = useState(true);
  const [erroGeral, setErroGeral] = useState('');
  const [aviso, setAviso] = useState('');
  const [filtros, setFiltros] = useState<Record<Aba, Filtro>>({ urgentes: filtroInicial(), devolucoes: filtroInicial(), defeitos: filtroInicial() });
  const [desfazer, setDesfazer] = useState<{ aba: Aba; id: number; numero: number } | null>(null);
  const [menuAberto, setMenuAberto] = useState(false);
  const [atualizadoEm, setAtualizadoEm] = useState<Date | null>(null);
  const [semConexao, setSemConexao] = useState(false);
  const [atualizando, setAtualizando] = useState(false);

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

  const guardar = (resposta: Dados) => setDados({ urgentes: resposta.urgentes, devolucoes: resposta.devolucoes, defeitos: resposta.defeitos });
  const respostaValida = (r: any): r is Dados => Array.isArray(r?.urgentes) && Array.isArray(r?.devolucoes) && Array.isArray(r?.defeitos);

  const carregar = useCallback(async (manual = false) => {
    if (manual) setAtualizando(true);
    try {
      const resposta = await chamar<Dados>('/api/problematicos');
      if (!respostaValida(resposta)) throw new Error(ERRO_RESPOSTA_INVALIDA);
      setDados({ urgentes: resposta.urgentes, devolucoes: resposta.devolucoes, defeitos: resposta.defeitos });
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
    const digitando = (ativo instanceof HTMLInputElement || ativo instanceof HTMLSelectElement) && !!ativo.closest('tbody');
    try {
      const resposta = await chamar<Dados>('/api/problematicos');
      if (!respostaValida(resposta)) return;
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

  // ---- lista filtrada ----

  const todos = dados[aba];
  const lista = todos.filter((r) => {
    const q = filtro.q.trim().toLowerCase();
    if (filtro.status === 'pendentes' && statusDe(r) === 'REALIZADA') return false;
    if (filtro.status === 'realizadas' && statusDe(r) !== 'REALIZADA') return false;
    if (q && ![r.numeroPedido, r.cliente, r.causa, r.motorista, r.acao, r.formaPagamento].join(' ').toLowerCase().includes(q)) return false;
    if (filtro.data) {
      const bruto = r[def.data.campo];
      const d = def.data.tipo === 'cadastro' ? diaSP(String(bruto ?? '')) : String(bruto ?? '');
      if (def.data.tipo === 'futura') {
        if (filtro.data === 'vencidas' && !(d && d < hoje)) return false;
        if (filtro.data === 'hoje' && d !== hoje) return false;
        if (filtro.data === 'semana' && !(d && d >= hoje && d <= somarDias(hoje, 7))) return false;
        if (filtro.data === 'sem' && d) return false;
      } else {
        if (filtro.data === 'hoje' && d !== hoje) return false;
        if (filtro.data === '7' && !(d && d >= somarDias(hoje, -6))) return false;
        if (filtro.data === '30' && !(d && d >= somarDias(hoje, -29))) return false;
      }
    }
    return true;
  });

  const resumos: Record<Aba, Resumo> = { urgentes: resumir(dados.urgentes, hoje), devolucoes: resumir(dados.devolucoes, hoje), defeitos: resumir(dados.defeitos, hoje) };

  const mudarFiltro = (parcial: Partial<Filtro>) => setFiltros((atual) => ({ ...atual, [aba]: { ...atual[aba], ...parcial } }));

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
      guardar(await chamar<Dados>(`/api/problematicos/${aba}`, { method: 'POST', body: JSON.stringify(corpo) }));
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
      guardar(await chamar<Dados>(`/api/problematicos/${aba}/${registro.id}`, { method: 'PATCH', body: JSON.stringify({ [campo.k]: novo }) }));
      setErroGeral('');
      if (campo.tipo === 'status' && novo === 'REALIZADA' && filtro.status === 'pendentes') setDesfazer({ aba, id: registro.id, numero: registro.numeroPedido });
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
      guardar(await chamar<Dados>(`/api/problematicos/${abaDoRegistro}/${id}`, { method: 'PATCH', body: JSON.stringify({ status: 'NAO_REALIZADA' }) }));
    } catch (e: any) {
      setErroGeral(e.message);
    }
  };

  const remover = async (registro: Registro) => {
    if (!window.confirm(`Excluir o registro do pedido ${registro.numeroPedido}?`)) return;
    try {
      guardar(await chamar<Dados>(`/api/problematicos/${aba}/${registro.id}`, { method: 'DELETE' }));
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
        ? <>Forma de pagamento preenchida pelo pedido de venda. O valor é o da <b>entrada</b> ({formatCurrency(s.valor ?? 0)}); o total do pedido é {formatCurrency(s.valorTotal ?? 0)}.</>
        : 'Forma de pagamento e valor (pago de uma vez) preenchidos com os dados do pedido de venda do Nomus.';
    }
    return '';
  })();

  const entradaModal = 'h-10 w-full rounded-[10px] border border-neutral-200 bg-white px-3 text-[13px] text-neutral-800 outline-none focus:border-yellow-400 focus:ring-2 focus:ring-yellow-300/40';
  const entradaFiltro = 'h-9 rounded-[10px] border border-neutral-200 bg-white text-xs text-neutral-800 outline-none focus:border-yellow-400 focus:ring-2 focus:ring-yellow-300/40';
  const botao = 'inline-flex items-center gap-1.5 rounded-[10px] border border-neutral-200 bg-white px-3 py-1.5 text-xs font-bold text-neutral-700 hover:border-yellow-400 hover:bg-yellow-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-yellow-400';
  const botaoAmarelo = 'inline-flex items-center justify-center gap-1.5 rounded-[10px] bg-gradient-to-b from-yellow-300 to-yellow-400 px-4 py-1.5 text-xs font-extrabold text-neutral-900 shadow-md shadow-yellow-400/30 hover:brightness-105 focus:outline-none focus-visible:ring-2 focus-visible:ring-yellow-600 disabled:opacity-50';
  const Icone = def.icone;

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
          Pedido {desfazer.numero} marcado como realizada e ocultado.
          <button type="button" onClick={desfazerRealizada} className="rounded-full border border-emerald-300 bg-white px-3 py-1 text-[11px] font-bold text-emerald-800 hover:bg-emerald-100">Desfazer</button>
        </div>
      )}
      {aviso && <div role="status" className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-xs font-semibold text-emerald-800">{aviso}</div>}

      {/* Indicadores: um por tabela, em uma linha */}
      <section className="grid gap-2.5 lg:grid-cols-3" aria-label="Indicadores">
        {(Object.keys(TABELAS) as Aba[]).map((chave) => {
          const t = TABELAS[chave];
          const r = resumos[chave];
          const tr = tendencia(r);
          const IconeKpi = t.icone;
          return (
            <button
              key={chave}
              type="button"
              onClick={() => setAba(chave)}
              title="vs. últimos 7 dias"
              aria-label={`${t.aba}: ${r.pendentes} pendentes`}
              className={`flex items-center gap-2.5 rounded-xl border bg-white px-3 py-2 text-left shadow-sm transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-yellow-400 ${chave === aba ? 'border-yellow-400 ring-[3px] ring-yellow-300/30' : 'border-yellow-100 hover:border-yellow-300'}`}
            >
              <span className={`flex h-[30px] w-[30px] shrink-0 items-center justify-center rounded-[9px] ${t.cor === 'verde' ? 'bg-emerald-50 text-emerald-700' : 'bg-yellow-100 text-yellow-600'}`}>
                <IconeKpi className="h-4 w-4" aria-hidden="true" />
              </span>
              <div className="flex min-w-0 flex-1 flex-wrap items-center gap-x-2.5">
                <b className="text-xs font-bold text-neutral-600">{t.aba.replace('Pedidos ', '').replace('de ', '')}</b>
                <div className="flex items-center gap-1.5">
                  <strong className="text-[21px] font-black leading-none tabular-nums tracking-tight text-neutral-900">{r.pendentes}</strong>
                  <span className={`whitespace-nowrap rounded-xl px-1.5 py-0.5 text-[9.5px] font-extrabold ${tr.classe}`} title="Novos cadastros: últimos 7 dias contra os 7 anteriores">{tr.texto}</span>
                </div>
              </div>
              <Minigrafico serie={r.serie} cor={t.cor} />
            </button>
          );
        })}
      </section>

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
              <i className={`inline-grid h-5 min-w-5 place-items-center rounded-full px-1.5 text-[11px] font-extrabold not-italic ${selecionada ? 'bg-white text-neutral-900' : 'bg-neutral-100 text-neutral-600'}`}>{resumos[chave].pendentes}</i>
            </button>
          );
        })}
      </div>

      {/* Lista */}
      <section className="rounded-2xl border border-neutral-200 bg-white p-4 shadow-sm" aria-label={def.listaTitulo}>
        <div className="mb-3 flex flex-wrap items-center gap-2.5">
          <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-[11px] ${def.cor === 'verde' ? 'bg-emerald-50 text-emerald-700' : 'bg-yellow-100 text-yellow-600'}`}>
            <List className="h-4 w-4" aria-hidden="true" />
          </span>
          <div className="min-w-0">
            <h2 className="text-[15px] font-extrabold tracking-tight text-neutral-900">{def.listaTitulo}</h2>
            <p className="text-[11.5px] text-neutral-500">{def.listaSub}</p>
          </div>
          <div className="ml-auto flex items-center gap-2">
            <button type="button" onClick={() => carregar(true)} className={botao}>
              <RefreshCw className={`h-3.5 w-3.5 ${atualizando ? 'animate-spin' : ''}`} aria-hidden="true" /> Atualizar
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
            <button type="button" onClick={abrirModal} className={botaoAmarelo}>
              <Plus className="h-4 w-4" aria-hidden="true" /> Adicionar
            </button>
          </div>
        </div>

        <div className="mb-3 flex flex-wrap items-center gap-2">
          <span className="mr-1 inline-flex items-center gap-1.5 text-xs font-bold text-neutral-700"><Filter className="h-4 w-4" aria-hidden="true" /> Filtros rápidos</span>
          <label className="relative block min-w-[200px] max-w-xs flex-1">
            <span className="sr-only">Filtrar por pedido ou cliente</span>
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-400" aria-hidden="true" />
            <input type="search" value={filtro.q} onChange={(e) => mudarFiltro({ q: e.target.value })} placeholder="Pedido ou cliente" className={`${entradaFiltro} w-full pl-9 pr-3`} />
          </label>
          <label className="relative block">
            <span className="sr-only">Filtrar por {def.data.rotulo}</span>
            <CalendarDays className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-400" aria-hidden="true" />
            <select value={filtro.data} onChange={(e) => mudarFiltro({ data: e.target.value })} className={`${entradaFiltro} min-w-[160px] cursor-pointer pl-9 pr-3`}>
              {OPCOES_DATA[def.data.tipo].map(([valor, nome]) => <option key={valor} value={valor}>{valor === '' ? def.data.rotulo : nome}</option>)}
            </select>
          </label>
          <label className="relative block">
            <span className="sr-only">Filtrar por status</span>
            <Layers className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-400" aria-hidden="true" />
            <select value={filtro.status} onChange={(e) => mudarFiltro({ status: e.target.value as Filtro['status'] })} className={`${entradaFiltro} min-w-[160px] cursor-pointer pl-9 pr-3`}>
              <option value="pendentes">Não realizadas</option>
              <option value="realizadas">Realizadas</option>
              <option value="todas">Todas</option>
            </select>
          </label>
        </div>

        {carregando ? (
          <div className="flex justify-center py-10"><Loader2 className="h-5 w-5 animate-spin text-neutral-400" aria-label="Carregando" /></div>
        ) : lista.length === 0 ? (
          <div className="flex flex-col items-center rounded-2xl bg-gradient-to-b from-yellow-50 to-white px-4 py-8 text-center">
            <span className="flex h-14 w-14 items-center justify-center rounded-full bg-yellow-100 text-yellow-500"><Icone className="h-7 w-7" aria-hidden="true" /></span>
            <h3 className="mt-3 text-base font-extrabold text-neutral-900">{todos.length > 0 ? 'Nenhum registro com esses filtros.' : def.vazio}</h3>
            <p className="mt-1 text-xs text-neutral-500">{todos.length > 0 ? 'Ajuste os filtros acima para ver outros registros.' : def.vazioSub}</p>
          </div>
        ) : (
          <>
            <div className="max-h-[480px] overflow-auto rounded-xl border border-neutral-100">
              <table className="w-full min-w-[560px] border-separate border-spacing-0 text-xs">
                <thead>
                  <tr>
                    <th scope="col" className="sticky top-0 z-[1] border-b border-neutral-100 bg-neutral-50 px-3 py-2.5 text-left text-[11px] font-extrabold text-neutral-600">Número do pedido</th>
                    {def.campos.map((campo) => <th key={campo.k} scope="col" className="sticky top-0 z-[1] whitespace-nowrap border-b border-neutral-100 bg-neutral-50 px-3 py-2.5 text-left text-[11px] font-extrabold text-neutral-600">{campo.rotulo}</th>)}
                    <th scope="col" className="sticky top-0 z-[1] border-b border-neutral-100 bg-neutral-50 px-3 py-2.5"><span className="sr-only">Ações</span></th>
                  </tr>
                </thead>
                <tbody>
                  {lista.map((registro) => (
                    <tr key={registro.id} className="group">
                      <td className="border-b border-neutral-100 bg-white px-3 py-2 group-hover:bg-yellow-50/60">
                        <b className="text-neutral-900">{registro.numeroPedido}</b>
                        {registro.cliente && <span className="block text-[11px] font-semibold text-neutral-400">{registro.cliente}</span>}
                      </td>
                      {def.campos.map((campo) => (
                        <td key={campo.k} className="border-b border-neutral-100 bg-white px-3 py-2 group-hover:bg-yellow-50/60">
                          {campo.tipo === 'status' ? (
                            <select
                              key={`${registro.id}-status-${statusDe(registro)}`}
                              defaultValue={statusDe(registro)}
                              aria-label={`Status do pedido ${registro.numeroPedido}`}
                              onChange={(e) => salvarCampo(registro, campo, e.target.value)}
                              className={`h-[30px] min-w-[125px] cursor-pointer rounded-[10px] border border-transparent px-2.5 text-[11.5px] font-bold focus:border-yellow-400 focus:outline-none ${classeStatus(statusDe(registro))}`}
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
                              className={`h-8 w-full rounded-[10px] border border-transparent bg-transparent px-2.5 text-xs text-neutral-800 hover:border-neutral-200 hover:bg-white focus:border-yellow-400 focus:bg-yellow-50/40 focus:outline-none focus:ring-2 focus:ring-yellow-300/40 ${campo.k === 'formaPagamento' ? 'min-w-[340px]' : campo.k === 'acao' ? 'min-w-[260px]' : 'min-w-[130px]'}`}
                            />
                          )}
                        </td>
                      ))}
                      <td className="w-[110px] border-b border-neutral-100 bg-white px-3 py-2 text-right group-hover:bg-yellow-50/60">
                        <button type="button" onClick={() => remover(registro)} aria-label={`Excluir registro do pedido ${registro.numeroPedido}`} title="Excluir este registro" className="inline-flex items-center gap-1.5 rounded-[10px] border border-neutral-200 bg-white px-2.5 py-1 text-[11px] font-bold text-neutral-600 hover:border-red-300 hover:bg-red-50 hover:text-red-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-red-400">
                          <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                          Excluir
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="mt-2 text-[11px] text-neutral-400">{lista.length} {lista.length === 1 ? 'registro' : 'registros'}{lista.length !== todos.length ? ` de ${todos.length}` : ''}</p>
          </>
        )}
      </section>

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
                    {(Object.keys(NOMES_STATUS) as StatusRegistro[]).map((v) => <option key={v} value={v}>{NOMES_STATUS[v]}</option>)}
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
    </div>
  );
};
