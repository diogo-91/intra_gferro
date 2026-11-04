import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AlertTriangle, ArrowDown, ArrowUp, ArrowUpDown, Loader2, PackageSearch, RefreshCw, Search } from 'lucide-react';
import { DIAS_ALERTA_PRAZO } from '../pedidosLoja';
import type { PedidoAbertoLinha, RespostaPedidosAbertos, SituacaoPedidoAberto } from '../pedidosAbertos';
import { formatCurrency, formatDataIsoParaBr, formatInteiro } from '../utils/format';

type Campo = 'urgencia' | 'codigo' | 'cliente' | 'vendedor' | 'loja' | 'emissao' | 'prazo' | 'valor' | 'aReceber';
type Direcao = 'asc' | 'desc';
type FiltroRecebivel = 'todos' | 'com-saldo' | 'sem-saldo';

const ERRO_RESPOSTA_INVALIDA = 'O servidor não respondeu como esperado. Atualize a página; se continuar, o servidor ainda não foi atualizado com esta funcionalidade.';
const URL_PEDIDOS = '/api/dashboard/pedidos';

// Última resposta: ao voltar à tela (ou dar F5) ela aparece na hora e atualiza por baixo.
const CHAVE_ARMAZENAMENTO = 'gferro:pedidos-abertos:v1';

function lerGuardada(): RespostaPedidosAbertos | null {
  try {
    const dados = JSON.parse(sessionStorage.getItem(CHAVE_ARMAZENAMENTO) ?? 'null');
    return dados && Array.isArray(dados.pedidos) && !dados.carregando ? dados : null;
  } catch {
    return null;
  }
}

function guardar(dados: RespostaPedidosAbertos) {
  try {
    sessionStorage.setItem(CHAVE_ARMAZENAMENTO, JSON.stringify(dados));
  } catch {
    // sem armazenamento (modo privado, cota cheia): segue só com a memória
  }
}

async function lerResposta(res: Response) {
  const corpo = await res.json().catch(() => null);
  if (!res.ok) throw new Error(corpo?.error || 'Não foi possível carregar os pedidos em aberto.');
  if (corpo === null) throw new Error(ERRO_RESPOSTA_INVALIDA);
  return corpo;
}

const formatarValor = (valor: number) => valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const normalizar = (texto: string) => texto.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase();
const plural = (n: number, singular: string, pluralTexto: string) => `${n} ${n === 1 ? singular : pluralTexto}`;

const ESTILO: Record<SituacaoPedidoAberto, { borda: string; selo: string; ponto: string; rotuloFiltro: string }> = {
  'atrasado': { borda: 'border-l-red-500', selo: 'bg-red-100 text-red-700', ponto: 'bg-red-500', rotuloFiltro: 'Atrasados' },
  'vence-em-breve': { borda: 'border-l-yellow-400', selo: 'bg-yellow-100 text-yellow-800', ponto: 'bg-yellow-500', rotuloFiltro: 'Vence em breve' },
  'no-prazo': { borda: 'border-l-emerald-500', selo: 'bg-emerald-100 text-emerald-700', ponto: 'bg-emerald-500', rotuloFiltro: 'Dentro do prazo' },
  'sem-prazo': { borda: 'border-l-neutral-300', selo: 'bg-neutral-100 text-neutral-600', ponto: 'bg-neutral-400', rotuloFiltro: 'Sem prazo' },
  'entregue-pcp': { borda: 'border-l-sky-400', selo: 'bg-sky-100 text-sky-700', ponto: 'bg-sky-500', rotuloFiltro: 'Entregues no PCP' },
};
const ORDEM_FILTROS: SituacaoPedidoAberto[] = ['atrasado', 'vence-em-breve', 'no-prazo', 'sem-prazo', 'entregue-pcp'];

function textoSituacao(pedido: PedidoAbertoLinha): string {
  const dias = pedido.diasParaPrazo ?? 0;
  switch (pedido.situacao) {
    case 'atrasado': return `Atrasado há ${plural(pedido.diasAtraso, 'dia', 'dias')}`;
    case 'vence-em-breve': return dias === 0 ? 'Vence hoje' : dias === 1 ? 'Vence amanhã' : `Vence em ${dias} dias`;
    case 'no-prazo': return `Faltam ${plural(dias, 'dia', 'dias')}`;
    case 'sem-prazo': return 'Sem prazo';
    case 'entregue-pcp': return 'Entregue (PCP)';
  }
}

class LimiteDeErro extends React.Component<{ children: React.ReactNode }, { falhou: boolean }> {
  // O projeto não tem @types/react, então props/state precisam ser declarados à mão.
  declare props: { children: React.ReactNode };
  state = { falhou: false };
  static getDerivedStateFromError() { return { falhou: true }; }
  render() {
    if (!this.state.falhou) return this.props.children;
    return (
      <div role="alert" className="flex gap-2 p-4 rounded-xl bg-red-50 border border-red-200 text-sm text-red-700">
        <AlertTriangle className="w-5 h-5 shrink-0" aria-hidden="true" />
        Não foi possível exibir os pedidos liberados. Atualize a página e tente novamente.
      </div>
    );
  }
}

const Kpi: React.FC<{ titulo: string; valor: string; detalhe: string; classe: string; tituloClasse: string }> = ({ titulo, valor, detalhe, classe, tituloClasse }) => (
  <div className={`rounded-2xl border p-4 ${classe}`}>
    <div className={`text-[11px] font-bold uppercase tracking-wide ${tituloClasse}`}>{titulo}</div>
    <div className="text-2xl font-black text-neutral-900 tabular-nums mt-1">{valor}</div>
    <div className="text-[11px] text-neutral-500 mt-1">{detalhe}</div>
  </div>
);

const PedidosAbertosConteudo: React.FC = () => {
  const [resposta, setResposta] = useState<RespostaPedidosAbertos | null>(() => lerGuardada());
  const [carregando, setCarregando] = useState(() => lerGuardada() === null);
  const [atualizando, setAtualizando] = useState(false);
  const [erro, setErro] = useState('');
  const [filtro, setFiltro] = useState<SituacaoPedidoAberto | 'todos'>('todos');
  const [loja, setLoja] = useState('todas');
  const [recebivel, setRecebivel] = useState<FiltroRecebivel>('todos');
  const [busca, setBusca] = useState('');
  const [ordenacao, setOrdenacao] = useState<{ campo: Campo; direcao: Direcao }>({ campo: 'urgencia', direcao: 'asc' });
  const montado = useRef(true);

  const buscar = useCallback(async (silencioso: boolean, forcar = false) => {
    if (silencioso) setAtualizando(true); else setCarregando(true);
    try {
      const dados: RespostaPedidosAbertos = await lerResposta(await fetch(forcar ? `${URL_PEDIDOS}?atualizar=1` : URL_PEDIDOS));
      if (!Array.isArray(dados?.pedidos)) throw new Error(ERRO_RESPOSTA_INVALIDA);
      if (!montado.current) return;
      if (!dados.carregando) guardar(dados);
      setResposta(dados);
      setErro('');
    } catch (e: any) {
      if (montado.current) setErro(e.message);
    } finally {
      if (montado.current) {
        setCarregando(false);
        setAtualizando(false);
      }
    }
  }, []);

  useEffect(() => {
    montado.current = true;
    buscar(lerGuardada() !== null);
    return () => { montado.current = false; };
  }, [buscar]);

  // Enquanto o servidor lê o Nomus (primeira vez, atualização, financeiro), pergunta de novo em poucos segundos;
  // fora disso, acompanha a cada minuto.
  const lendo = !!(resposta?.carregando || resposta?.atualizando || resposta?.financeiroPendente || resposta?.historicoParcial);
  useEffect(() => {
    const espera = setTimeout(() => buscar(true), lendo ? 8_000 : 60_000);
    return () => clearTimeout(espera);
  }, [resposta, lendo, buscar]);

  const pedidos = resposta?.pedidos ?? [];
  const lojas = useMemo(() => [...new Set<string>(pedidos.map((p) => p.loja))].sort((a, b) => a.localeCompare(b, 'pt-BR')), [pedidos]);

  // Seleção atual (loja, recebíveis e busca). Os números dos botões de situação e os indicadores do topo contam só
  // esses pedidos; o botão de situação escolhido restringe apenas a tabela.
  const selecionados = useMemo(() => {
    const termo = normalizar(busca.trim());
    return pedidos.filter((p) =>
      (loja === 'todas' || p.loja === loja)
      && (recebivel === 'todos' || (recebivel === 'com-saldo' ? (p.aReceber ?? 0) > 0 : p.aReceber === 0))
      && (!termo || normalizar(`${p.codigo} ${p.cliente} ${p.vendedor} ${p.loja}`).includes(termo))
    );
  }, [pedidos, loja, recebivel, busca]);

  const contagem = useMemo(() => {
    const total: Record<SituacaoPedidoAberto, number> = { 'atrasado': 0, 'vence-em-breve': 0, 'no-prazo': 0, 'sem-prazo': 0, 'entregue-pcp': 0 };
    for (const pedido of selecionados) total[pedido.situacao] += 1;
    return total;
  }, [selecionados]);

  const visiveis = useMemo(() => {
    const filtrados = filtro === 'todos' ? selecionados : selecionados.filter((p) => p.situacao === filtro);
    if (ordenacao.campo === 'urgencia') return filtrados; // já vem ordenado pelo servidor
    const fator = ordenacao.direcao === 'asc' ? 1 : -1;
    return [...filtrados].sort((a, b) => {
      switch (ordenacao.campo) {
        case 'codigo': return fator * a.codigo.localeCompare(b.codigo, 'pt-BR');
        case 'cliente': return fator * a.cliente.localeCompare(b.cliente, 'pt-BR');
        case 'vendedor': return fator * a.vendedor.localeCompare(b.vendedor, 'pt-BR');
        case 'loja': return fator * a.loja.localeCompare(b.loja, 'pt-BR');
        case 'emissao': return fator * a.dataEmissao.localeCompare(b.dataEmissao);
        case 'prazo': return fator * (a.prazo ?? '9999-12-31').localeCompare(b.prazo ?? '9999-12-31');
        case 'valor': return fator * (a.valorTotal - b.valorTotal);
        case 'aReceber': return fator * ((a.aReceber ?? -1) - (b.aReceber ?? -1));
        default: return 0;
      }
    });
  }, [selecionados, filtro, ordenacao]);

  const totais = useMemo(() => {
    const atrasados = selecionados.filter((p) => p.situacao === 'atrasado');
    return {
      total: selecionados.length,
      valor: selecionados.reduce((s, p) => s + p.valorTotal, 0),
      atrasados: atrasados.length,
      valorAtrasado: atrasados.reduce((s, p) => s + p.valorTotal, 0),
      mediaAtraso: atrasados.length ? Math.round(atrasados.reduce((s, p) => s + p.diasAtraso, 0) / atrasados.length) : 0,
      aReceber: selecionados.reduce((s, p) => s + (p.aReceber ?? 0), 0),
      comSaldo: selecionados.filter((p) => (p.aReceber ?? 0) > 0).length,
      vencido: selecionados.reduce((s, p) => s + p.vencidoReceber, 0),
      comVencido: selecionados.filter((p) => p.vencidoReceber > 0).length,
    };
  }, [selecionados]);

  const valorVisiveis = useMemo(() => visiveis.reduce((s, p) => s + p.valorTotal, 0), [visiveis]);

  const alternar = (campo: Campo) =>
    setOrdenacao((atual) => campo === 'urgencia'
      ? { campo: 'urgencia', direcao: 'asc' }
      : atual.campo === campo
        ? { campo, direcao: atual.direcao === 'asc' ? 'desc' : 'asc' }
        : { campo, direcao: campo === 'emissao' || campo === 'valor' || campo === 'aReceber' ? 'desc' : 'asc' });

  const colunas: Array<{ campo: Campo; titulo: string; alinhar?: 'right' }> = [
    { campo: 'codigo', titulo: 'Pedido' },
    { campo: 'cliente', titulo: 'Cliente' },
    { campo: 'vendedor', titulo: 'Vendedor / Loja' },
    { campo: 'prazo', titulo: 'Prazo' },
    { campo: 'urgencia', titulo: 'Situação' },
    { campo: 'valor', titulo: 'Valor', alinhar: 'right' },
    { campo: 'aReceber', titulo: 'Falta receber', alinhar: 'right' },
  ];

  const consultando = carregando || !!resposta?.carregando;
  const chipBase = 'rounded-full border px-3.5 py-1.5 text-xs font-bold transition-all';

  return (
    <div className="space-y-6">
      <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-3">
        <div>
          <span className="text-xs font-bold uppercase tracking-widest text-yellow-600">Dashboard • Pedidos</span>
          <h1 className="text-2xl font-black text-neutral-900 mt-1 flex items-center gap-2">
            <PackageSearch className="w-6 h-6 text-yellow-600" aria-hidden="true" />
            Pedidos liberados
          </h1>
          <p className="text-neutral-500 text-sm mt-1">
            Somente pedidos com status Liberado no Nomus. O atraso conta pelo prazo combinado no PCP (ou o do Nomus, quando o PCP não tem). Vence em breve = até {DIAS_ALERTA_PRAZO} dias.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <label className="relative block">
            <span className="sr-only">Buscar por pedido, cliente, vendedor ou loja</span>
            <Search className="w-4 h-4 text-neutral-400 absolute left-3.5 top-1/2 -translate-y-1/2" aria-hidden="true" />
            <input
              type="search"
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder="Buscar pedido, cliente, vendedor..."
              className="w-full sm:w-72 rounded-xl border border-neutral-200 bg-white pl-10 pr-4 py-2.5 text-sm outline-none focus:border-yellow-500"
            />
          </label>
          <button
            type="button"
            onClick={() => buscar(true, true)}
            disabled={consultando || atualizando}
            className="flex items-center gap-1.5 px-3.5 py-2.5 rounded-full border border-neutral-200 bg-white text-xs font-bold text-neutral-600 hover:border-yellow-400 hover:text-yellow-600 disabled:opacity-40 transition-all"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${atualizando || resposta?.atualizando ? 'animate-spin' : ''}`} aria-hidden="true" />
            Atualizar
          </button>
        </div>
      </div>

      {resposta && !resposta.carregando && (
        <p className="text-[11px] text-neutral-500 -mt-3">
          Dados do Nomus de {new Date(resposta.atualizadoEm).toLocaleString('pt-BR')}
          {resposta.atualizando ? ' · atualizando...' : ''}
          {resposta.financeiroPendente ? ' · lendo o financeiro de alguns pedidos...' : ''}
        </p>
      )}

      {resposta?.historicoParcial && !resposta.carregando && (
        <div role="status" className="flex gap-2 p-3 rounded-xl bg-yellow-50 border border-yellow-200 text-xs text-yellow-900 -mt-2">
          <Loader2 className="w-4 h-4 shrink-0 animate-spin" aria-hidden="true" />
          Carregando os pedidos mais antigos do Nomus. A lista já mostra os mais recentes e vai completando sozinha.
        </div>
      )}

      {resposta?.erroAtualizacao && !resposta.carregando && (
        <div role="alert" className="flex gap-2 p-3 rounded-xl bg-orange-50 border border-orange-200 text-xs text-orange-900 -mt-2">
          <AlertTriangle className="w-4 h-4 shrink-0" aria-hidden="true" />
          Não foi possível atualizar agora ({resposta.erroAtualizacao}). Mostrando a última leitura, de {new Date(resposta.atualizadoEm).toLocaleString('pt-BR')}; o sistema tenta de novo sozinho.
        </div>
      )}

      {erro && (
        <div role="alert" className="flex gap-2 p-3 rounded-xl bg-red-50 border border-red-200 text-xs text-red-700">
          <AlertTriangle className="w-4 h-4 shrink-0" aria-hidden="true" />
          {erro}
        </div>
      )}

      {consultando ? (
        <div className="rounded-2xl border border-neutral-200 bg-white px-5 py-16 text-center text-sm text-neutral-500">
          <Loader2 className="w-5 h-5 animate-spin inline-block mr-2 text-yellow-600" aria-hidden="true" />
          Lendo os pedidos liberados no Nomus... (na primeira vez pode levar alguns minutos; a tela atualiza sozinha)
        </div>
      ) : resposta ? (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <Kpi titulo="Pedidos liberados" valor={formatInteiro(totais.total)} detalhe={`${formatCurrency(totais.valor)} em pedidos`} classe="border-yellow-100 bg-yellow-50/60" tituloClasse="text-yellow-800" />
            <Kpi titulo="Atrasados" valor={formatInteiro(totais.atrasados)} detalhe={totais.atrasados ? `${formatCurrency(totais.valorAtrasado)} · média de ${plural(totais.mediaAtraso, 'dia', 'dias')}` : 'Nenhum pedido atrasado'} classe="border-red-100 bg-red-50/60" tituloClasse="text-red-700" />
            <Kpi titulo="Falta receber" valor={formatCurrency(totais.aReceber)} detalhe={`em ${plural(totais.comSaldo, 'pedido', 'pedidos')}`} classe="border-emerald-100 bg-emerald-50/60" tituloClasse="text-emerald-700" />
            <Kpi titulo="Vencido a receber" valor={formatCurrency(totais.vencido)} detalhe={`parcelas vencidas em ${plural(totais.comVencido, 'pedido', 'pedidos')}`} classe="border-orange-100 bg-orange-50/60" tituloClasse="text-orange-700" />
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Filtrar por situação">
              <button type="button" aria-pressed={filtro === 'todos'} onClick={() => setFiltro('todos')} className={`${chipBase} ${filtro === 'todos' ? 'border-neutral-900 bg-neutral-900 text-white' : 'border-neutral-200 bg-white text-neutral-600 hover:border-neutral-400'}`}>
                Todos ({selecionados.length})
              </button>
              {ORDEM_FILTROS.filter((s) => contagem[s] > 0 || s === 'atrasado' || s === filtro).map((situacao) => {
                const estilo = ESTILO[situacao];
                const ativo = filtro === situacao;
                return (
                  <button key={situacao} type="button" aria-pressed={ativo} onClick={() => setFiltro(situacao)} className={`${chipBase} flex items-center gap-1.5 ${ativo ? 'border-neutral-900 bg-neutral-900 text-white' : 'border-neutral-200 bg-white text-neutral-600 hover:border-neutral-400'}`}>
                    <span className={`w-2 h-2 rounded-full ${estilo.ponto}`} aria-hidden="true" />
                    {estilo.rotuloFiltro} ({contagem[situacao]})
                  </button>
                );
              })}
            </div>
            <label className="relative">
              <span className="sr-only">Loja</span>
              <select value={loja} onChange={(e) => setLoja(e.target.value)} className="appearance-none rounded-xl border border-neutral-200 bg-white py-2 pl-3.5 pr-8 text-xs font-bold text-neutral-800 shadow-sm cursor-pointer focus:border-yellow-400 focus:outline-none">
                <option value="todas">Todas as lojas</option>
                {lojas.map((nome) => <option key={nome} value={nome}>{nome}</option>)}
              </select>
            </label>
            <label className="relative">
              <span className="sr-only">Recebíveis</span>
              <select value={recebivel} onChange={(e) => setRecebivel(e.target.value as FiltroRecebivel)} className="appearance-none rounded-xl border border-neutral-200 bg-white py-2 pl-3.5 pr-8 text-xs font-bold text-neutral-800 shadow-sm cursor-pointer focus:border-yellow-400 focus:outline-none">
                <option value="todos">Recebíveis: todos</option>
                <option value="com-saldo">Com saldo a receber</option>
                <option value="sem-saldo">Sem saldo a receber</option>
              </select>
            </label>
            <span className="text-neutral-500 text-[11px] sm:ml-auto">{plural(visiveis.length, 'pedido', 'pedidos')} · {formatarValor(valorVisiveis)}</span>
          </div>

          <div className="rounded-2xl border border-neutral-200 bg-white shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[860px] text-[13px]">
                <thead className="bg-neutral-50 border-b border-neutral-200">
                  <tr>
                    {colunas.map(({ campo, titulo, alinhar }) => {
                      const ativa = ordenacao.campo === campo;
                      const Icone = !ativa ? ArrowUpDown : ordenacao.direcao === 'asc' ? ArrowUp : ArrowDown;
                      return (
                        <th key={campo} scope="col" aria-sort={ativa ? (ordenacao.direcao === 'asc' ? 'ascending' : 'descending') : 'none'} className={`px-3 py-3.5 font-extrabold text-neutral-900 ${alinhar === 'right' ? 'text-right' : 'text-left'}`}>
                          <button type="button" onClick={() => alternar(campo)} className={`flex items-center gap-2 hover:text-yellow-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-yellow-500 rounded ${alinhar === 'right' ? 'ml-auto' : ''}`}>
                            {titulo}
                            <Icone className={`w-3.5 h-3.5 ${ativa ? 'text-yellow-600' : 'text-neutral-400'}`} aria-hidden="true" />
                          </button>
                        </th>
                      );
                    })}
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-100">
                  {visiveis.length === 0 ? (
                    <tr><td colSpan={colunas.length} className="px-5 py-12 text-center text-neutral-500">{pedidos.length === 0 ? 'Nenhum pedido liberado.' : 'Nenhum pedido encontrado para esses filtros.'}</td></tr>
                  ) : visiveis.map((pedido) => {
                    const estilo = ESTILO[pedido.situacao];
                    return (
                      <tr key={pedido.id} className="hover:bg-neutral-50/60 align-top">
                        <td className={`px-3 py-3 whitespace-nowrap border-l-4 ${estilo.borda}`}>
                          <div className="font-bold text-neutral-900">{pedido.codigo}</div>
                          <div className="text-[11px] text-neutral-500">{pedido.dataEmissao ? `emitido em ${formatDataIsoParaBr(pedido.dataEmissao)}` : (pedido.statusPcp || pedido.etapa)}</div>
                        </td>
                        <td className="px-3 py-3 text-neutral-800 max-w-[170px]"><span className="line-clamp-2" title={pedido.cliente}>{pedido.cliente}</span></td>
                        <td className="px-3 py-3 text-neutral-700 max-w-[150px]">
                          <div className="line-clamp-2" title={pedido.vendedor}>{pedido.vendedor}</div>
                          <div className="text-[11px] text-neutral-500">{pedido.loja}</div>
                        </td>
                        <td className="px-3 py-3 whitespace-nowrap tabular-nums text-neutral-700">
                          {pedido.prazo ? formatDataIsoParaBr(pedido.prazo) : '—'}
                          {pedido.fontePrazo && <div className="text-[10px] text-neutral-400">{pedido.fontePrazo === 'gferro' ? 'prazo Gferro' : 'prazo Nomus'}</div>}
                        </td>
                        <td className="px-3 py-3">
                          <span className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-3 py-1.5 text-xs font-bold ${estilo.selo}`}>
                            <span className={`w-2 h-2 rounded-full ${estilo.ponto}`} aria-hidden="true" />
                            {textoSituacao(pedido)}
                          </span>
                        </td>
                        <td className="px-3 py-3 text-right whitespace-nowrap tabular-nums text-neutral-900">{formatarValor(pedido.valorTotal)}</td>
                        <td className="px-3 py-3 text-right tabular-nums bg-emerald-50/40">
                          {pedido.aReceber === null ? (
                            <span className="text-neutral-400 text-xs">Lendo...</span>
                          ) : pedido.aReceber === 0 ? (
                            <span className="text-neutral-500 text-xs font-semibold">Nada a receber</span>
                          ) : (
                            <>
                              <div className="font-bold text-neutral-900 whitespace-nowrap">{formatarValor(pedido.aReceber)}</div>
                              <div className="text-[10px] text-neutral-500">
                                {pedido.titulosAbertos > 0
                                  ? `${plural(pedido.titulosAbertos, 'parcela', 'parcelas')} em aberto${pedido.proximoVencimento ? ` · ${formatDataIsoParaBr(pedido.proximoVencimento)}` : ''}`
                                  : 'sem parcela lançada'}
                              </div>
                              {pedido.vencidoReceber > 0 && <div className="text-[10px] font-bold text-red-600 whitespace-nowrap">{formatarValor(pedido.vencidoReceber)} vencido</div>}
                            </>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </>
      ) : null}
    </div>
  );
};

export const PedidosAbertos: React.FC = () => (
  <LimiteDeErro>
    <PedidosAbertosConteudo />
  </LimiteDeErro>
);
