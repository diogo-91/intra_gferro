import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AlertTriangle, CalendarDays, ChevronLeft, ChevronRight, Loader2, Map as MapIcon, RefreshCw, X } from 'lucide-react';
import { agregarMapa, normalizarCidade, type AgregadoCidade, type PedidoDoMapa, type RespostaMapa } from '../mapaPedidos';
import { chaveDia, formatCurrency, formatDataIsoParaBr, formatInteiro } from '../utils/format';

interface FeicaoEstado { uf: string; nome: string; aneis: number[][][] }
type Coordenadas = Record<string, [number, number]>;

const MESES = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
const ERRO_RESPOSTA_INVALIDA = 'O servidor não respondeu como esperado. Atualize a página; se continuar, o servidor ainda não foi atualizado com esta funcionalidade.';

// Projeção simples (graus -> unidades do desenho): o Brasil fica entre -74° e -34° de longitude e 5,5° e -34° de latitude.
const ESCALA = 15;
const FATOR_LONGITUDE = Math.cos((15 * Math.PI) / 180);
const projetar = (lon: number, lat: number): [number, number] => [(lon + 74) * FATOR_LONGITUDE * ESCALA, (5.5 - lat) * ESCALA];
const LARGURA_BRASIL = 40 * FATOR_LONGITUDE * ESCALA;
const ALTURA_BRASIL = 39.5 * ESCALA;

const ultimasRespostas = new Map<string, RespostaMapa>();

const plural = (n: number, singular: string, pluralTexto: string) => `${formatInteiro(n)} ${n === 1 ? singular : pluralTexto}`;
const somarMeses = (data: Date, meses: number) => new Date(data.getFullYear(), data.getMonth() + meses, 1);
const primeiroDoMes = (data: Date) => new Date(data.getFullYear(), data.getMonth(), 1);
const ultimoDoMes = (data: Date) => new Date(data.getFullYear(), data.getMonth() + 1, 0);

function caminho(aneis: number[][][]): string {
  return aneis.map((anel) => anel.map(([lon, lat], i) => `${i === 0 ? 'M' : 'L'}${projetar(lon, lat).map((n) => n.toFixed(1)).join(' ')}`).join('') + 'Z').join('');
}

function limitesDoEstado(feicao: FeicaoEstado): { x: number; y: number; largura: number; altura: number } {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const anel of feicao.aneis) for (const [lon, lat] of anel) {
    const [x, y] = projetar(lon, lat);
    minX = Math.min(minX, x); maxX = Math.max(maxX, x); minY = Math.min(minY, y); maxY = Math.max(maxY, y);
  }
  const margem = Math.max(maxX - minX, maxY - minY) * 0.08;
  return { x: minX - margem, y: minY - margem, largura: maxX - minX + 2 * margem, altura: maxY - minY + 2 * margem };
}

const Kpi: React.FC<{ titulo: string; valor: string; detalhe: string }> = ({ titulo, valor, detalhe }) => (
  <div className="rounded-2xl border border-neutral-200 bg-white p-4 shadow-sm">
    <div className="text-[11px] font-bold uppercase tracking-wide text-yellow-700">{titulo}</div>
    <div className="text-2xl font-black text-neutral-900 tabular-nums mt-1">{valor}</div>
    <div className="text-[11px] text-neutral-500 mt-1">{detalhe}</div>
  </div>
);

type Modo = 'a-entregar' | 'periodo';

// Janela com todos os pedidos de uma cidade: número, cliente, cidade, vendedor, loja, datas e valor.
const PedidosDaCidade: React.FC<{ cidade: string; uf: string; pedidos: PedidoDoMapa[]; mostrarPrazo: boolean; aoFechar: () => void }> = ({ cidade, uf, pedidos, mostrarPrazo, aoFechar }) => {
  useEffect(() => {
    const aoTeclar = (e: KeyboardEvent) => { if (e.key === 'Escape') aoFechar(); };
    window.addEventListener('keydown', aoTeclar);
    return () => window.removeEventListener('keydown', aoTeclar);
  }, [aoFechar]);
  const total = pedidos.reduce((soma, p) => soma + p.valor, 0);
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-3 sm:p-6" onClick={aoFechar}>
      <div role="dialog" aria-modal="true" aria-label={`Pedidos de ${cidade}`} className="flex max-h-full w-full max-w-5xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between gap-3 border-b border-neutral-200 px-5 py-4">
          <div>
            <h2 className="text-lg font-black text-neutral-900">{cidade} — {uf}</h2>
            <p className="text-xs text-neutral-500">{plural(pedidos.length, 'pedido', 'pedidos')} · {formatCurrency(total)}</p>
          </div>
          <button type="button" autoFocus onClick={aoFechar} aria-label="Fechar" className="flex h-8 w-8 items-center justify-center rounded-full border border-neutral-200 text-neutral-600 hover:border-yellow-400 hover:text-yellow-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-yellow-400">
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>
        <div className="overflow-auto">
          <table className="w-full text-[12px]">
            <thead className="sticky top-0 bg-neutral-50 text-neutral-600">
              <tr>
                <th scope="col" className="px-3 py-2 text-left font-bold">Pedido</th>
                <th scope="col" className="px-3 py-2 text-left font-bold">Cliente</th>
                <th scope="col" className="px-3 py-2 text-left font-bold">Cidade</th>
                <th scope="col" className="px-3 py-2 text-left font-bold">Vendedor</th>
                <th scope="col" className="px-3 py-2 text-left font-bold">Loja</th>
                <th scope="col" className="px-3 py-2 text-left font-bold">Emissão</th>
                {mostrarPrazo && <th scope="col" className="px-3 py-2 text-left font-bold">Prazo</th>}
                <th scope="col" className="px-3 py-2 text-right font-bold">Valor</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100">
              {pedidos.map((p) => (
                <tr key={p.codigo}>
                  <td className="whitespace-nowrap px-3 py-2 font-bold text-neutral-900">{p.codigo}</td>
                  <td className="px-3 py-2 text-neutral-800">{p.cliente}</td>
                  <td className="whitespace-nowrap px-3 py-2 text-neutral-700">{p.cidade} — {p.uf}</td>
                  <td className="px-3 py-2 text-neutral-700">{p.vendedor}</td>
                  <td className="whitespace-nowrap px-3 py-2 text-neutral-700">{p.loja}</td>
                  <td className="whitespace-nowrap px-3 py-2 tabular-nums text-neutral-700">{p.dataEmissao ? formatDataIsoParaBr(p.dataEmissao) : '—'}</td>
                  {mostrarPrazo && <td className="whitespace-nowrap px-3 py-2 tabular-nums text-neutral-700">{p.prazo ? formatDataIsoParaBr(p.prazo) : '—'}</td>}
                  <td className="whitespace-nowrap px-3 py-2 text-right font-semibold tabular-nums text-neutral-900">{formatCurrency(p.valor)}</td>
                </tr>
              ))}
              {pedidos.length === 0 && <tr><td colSpan={mostrarPrazo ? 8 : 7} className="px-3 py-8 text-center text-neutral-500">Nenhum pedido.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export const MapaPedidos: React.FC = () => {
  const [modo, setModo] = useState<Modo>('a-entregar');
  const [referencia, setReferencia] = useState<Date>(() => new Date());
  const [dataInicio, setDataInicio] = useState('');
  const [dataFim, setDataFim] = useState('');
  const [resposta, setResposta] = useState<RespostaMapa | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [atualizando, setAtualizando] = useState(false);
  const [erro, setErro] = useState('');
  const [loja, setLoja] = useState('todas');
  const [estados, setEstados] = useState<FeicaoEstado[]>([]);
  const [coordenadas, setCoordenadas] = useState<Coordenadas>({});
  const [ufSelecionada, setUfSelecionada] = useState<string | null>(null);
  const [foco, setFoco] = useState<{ titulo: string; pedidos: number; valor: number; x: number; y: number } | null>(null);
  const [cidadeAberta, setCidadeAberta] = useState<{ cidade: string; uf: string } | null>(null);
  const areaDoMapa = useRef<HTMLDivElement>(null);

  // O desenho do Brasil e as coordenadas das cidades são pesados: só são baixados quando a tela é aberta.
  useEffect(() => {
    let ativo = true;
    import('../data/mapa/estados.json').then((m) => ativo && setEstados((m.default ?? m) as unknown as FeicaoEstado[])).catch(() => undefined);
    import('../data/mapa/municipios.json').then((m) => ativo && setCoordenadas((m.default ?? m) as unknown as Coordenadas)).catch(() => undefined);
    return () => { ativo = false; };
  }, []);

  const personalizado = !!dataInicio && !!dataFim;
  const periodoInvalido = personalizado && dataInicio > dataFim;
  const inicio = personalizado ? dataInicio : chaveDia(primeiroDoMes(referencia));
  const fim = personalizado ? dataFim : chaveDia(ultimoDoMes(referencia));
  const aEntregar = modo === 'a-entregar';
  const url = aEntregar ? '/api/dashboard/mapa?modo=a-entregar' : `/api/dashboard/mapa?inicio=${inicio}&fim=${fim}`;
  const urlExibida = useRef(url);
  urlExibida.current = url;

  const buscar = useCallback(async (urlBuscada: string, silencioso: boolean, forcar = false) => {
    if (silencioso) setAtualizando(true); else setCarregando(true);
    try {
      const res = await fetch(forcar ? `${urlBuscada}${urlBuscada.includes('?') ? '&' : '?'}atualizar=1` : urlBuscada);
      const corpo = await res.json().catch(() => null);
      if (!res.ok) throw new Error(corpo?.error || 'Não foi possível carregar o mapa.');
      if (!corpo || !Array.isArray(corpo.linhas)) throw new Error(ERRO_RESPOSTA_INVALIDA);
      const dados = corpo as RespostaMapa;
      if (!dados.carregando) ultimasRespostas.set(urlBuscada, dados);
      if (urlExibida.current !== urlBuscada) return;
      setResposta(dados);
      setErro('');
    } catch (e: any) {
      if (urlExibida.current === urlBuscada) setErro(e.message);
    } finally {
      if (urlExibida.current === urlBuscada) { setCarregando(false); setAtualizando(false); }
    }
  }, []);

  useEffect(() => {
    if (periodoInvalido) return;
    const guardada = ultimasRespostas.get(url) ?? null;
    setResposta(guardada);
    setErro('');
    setCarregando(guardada === null);
    setUfSelecionada(null);
    setCidadeAberta(null);
    buscar(url, guardada !== null);
  }, [url, periodoInvalido, buscar]);

  // Enquanto o servidor lê pedidos e cidades no Nomus, pergunta de novo em poucos segundos; fora disso, a cada minuto.
  const lendo = !!(resposta?.carregando || resposta?.atualizando || (resposta?.mesesPendentes ?? 0) > 0 || (resposta?.pedidosPendentes ?? 0) > 0);
  useEffect(() => {
    if (periodoInvalido) return;
    // Em "A entregar" a tela é um painel ao vivo: confere o servidor a cada 15 segundos.
    const espera = setTimeout(() => buscar(urlExibida.current, true), lendo ? 8_000 : aEntregar ? 15_000 : 60_000);
    return () => clearTimeout(espera);
  }, [resposta, lendo, aEntregar, periodoInvalido, buscar]);

  const lojas = resposta?.lojas ?? [];
  useEffect(() => { if (loja !== 'todas' && resposta && !lojas.includes(loja)) setLoja('todas'); }, [lojas, loja, resposta]);

  const agregado = useMemo(() => agregarMapa(resposta?.linhas ?? [], loja === 'todas' ? null : loja), [resposta, loja]);
  const porUf = useMemo(() => new Map(agregado.estados.map((e) => [e.uf, e])), [agregado]);
  const maxEstado = agregado.estados[0]?.pedidos ?? 0;
  const feicaoSelecionada = estados.find((e) => e.uf === ufSelecionada) ?? null;
  const caixa = useMemo(() => (feicaoSelecionada ? limitesDoEstado(feicaoSelecionada) : { x: 0, y: 0, largura: LARGURA_BRASIL, altura: ALTURA_BRASIL }), [feicaoSelecionada]);

  const cidadesVisiveis = useMemo(() => (ufSelecionada ? agregado.cidades.filter((c) => c.uf === ufSelecionada) : agregado.cidades), [agregado, ufSelecionada]);
  const maxCidade = cidadesVisiveis[0]?.pedidos ?? 0;
  const bolhas = useMemo(() => {
    const pontos: Array<{ cidade: AgregadoCidade; x: number; y: number }> = [];
    for (const cidade of cidadesVisiveis) {
      const coordenada = coordenadas[`${cidade.uf}|${normalizarCidade(cidade.cidade)}`];
      if (!coordenada) continue;
      const [x, y] = projetar(coordenada[1], coordenada[0]);
      pontos.push({ cidade, x, y });
    }
    return pontos; // já vem da maior para a menor: as pequenas são desenhadas por cima
  }, [cidadesVisiveis, coordenadas]);
  const semCoordenada = cidadesVisiveis.length - bolhas.length;

  const unidade = caixa.largura / 600; // 1 pixel na tela, em unidades do desenho
  const raioDaBolha = (pedidos: number) => (4 + 18 * Math.sqrt(pedidos / Math.max(maxCidade, 1))) * unidade;

  const mostrarFoco = (evento: React.MouseEvent, titulo: string, pedidos: number, valor: number) => {
    const area = areaDoMapa.current?.getBoundingClientRect();
    if (!area) return;
    setFoco({ titulo, pedidos, valor, x: evento.clientX - area.left, y: evento.clientY - area.top });
  };

  const opcoesMes = useMemo(() => {
    const hoje = new Date();
    return Array.from({ length: 13 }, (_, i) => {
      const d = new Date(hoje.getFullYear(), hoje.getMonth() - i, 1);
      return { valor: chaveDia(d), rotulo: `${MESES[d.getMonth()]} de ${d.getFullYear()}` };
    });
  }, []);
  const mesAtual = chaveDia(primeiroDoMes(referencia));

  const consultando = carregando || !!resposta?.carregando;
  const botaoNav = 'flex items-center justify-center w-8 h-8 rounded-full border border-neutral-200 bg-white text-neutral-600 hover:border-yellow-400 hover:text-yellow-600 transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-yellow-400';
  const selectClasse = 'appearance-none rounded-xl border border-neutral-200 bg-white py-2 pl-3.5 pr-8 text-xs font-bold text-neutral-800 shadow-sm cursor-pointer focus:border-yellow-400 focus:outline-none';
  const nomeDoEstado = (uf: string) => estados.find((e) => e.uf === uf)?.nome ?? uf;
  const totalLocalizado = agregado.pedidos;
  const semLocalizacao = resposta?.semLocalizacao.pedidos ?? 0;

  return (
    <div className="space-y-6">
      <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-3">
        <div>
          <span className="text-xs font-bold uppercase tracking-widest text-yellow-600">Dashboard • Mapa</span>
          <h1 className="text-2xl font-black text-neutral-900 mt-1 flex items-center gap-2">
            <MapIcon className="w-6 h-6 text-yellow-600" aria-hidden="true" />
            Pedidos por cidade e estado
          </h1>
          <p className="text-neutral-500 text-sm mt-1">
            {aEntregar
              ? 'Todos os pedidos liberados que ainda não foram entregues (sem entrega nem cancelamento dados no PCP), pela cidade do cliente no cadastro do Nomus, ao vivo. Clique em um estado para ver as cidades.'
              : 'Todos os pedidos emitidos no período (exceto cancelados), pela cidade do cliente no cadastro do Nomus. Clique em um estado para ver as cidades.'}
          </p>
        </div>
        <button
          type="button"
          onClick={() => buscar(url, true, aEntregar)}
          disabled={consultando || atualizando || periodoInvalido}
          className="flex items-center gap-1.5 px-3.5 py-2.5 rounded-full border border-neutral-200 bg-white text-xs font-bold text-neutral-600 hover:border-yellow-400 hover:text-yellow-600 disabled:opacity-40 transition-all self-start lg:self-auto"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${atualizando || resposta?.atualizando ? 'animate-spin' : ''}`} aria-hidden="true" />
          Atualizar
        </button>
      </div>

      <div className="flex items-center gap-3 flex-wrap">
        <div role="group" aria-label="O que mostrar" className="flex items-center gap-1 rounded-full bg-white border border-neutral-200 p-1">
          {([['a-entregar', 'A entregar (ao vivo)'], ['periodo', 'Pedidos do período']] as const).map(([id, rotulo]) => (
            <button
              key={id}
              type="button"
              aria-pressed={modo === id}
              onClick={() => setModo(id)}
              className={`px-3.5 py-1.5 rounded-full text-xs transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-yellow-400 ${modo === id ? 'bg-yellow-400 text-black font-bold' : 'text-neutral-500 font-medium hover:text-neutral-900'}`}
            >
              {rotulo}
            </button>
          ))}
        </div>

        {!aEntregar && !personalizado && (
          <div className="flex items-center gap-2">
            <button type="button" onClick={() => setReferencia((a) => somarMeses(a, -1))} className={botaoNav} aria-label="Mês anterior"><ChevronLeft className="w-4 h-4" aria-hidden="true" /></button>
            <label className="relative">
              <span className="sr-only">Mês</span>
              <select value={mesAtual} onChange={(e) => { const [a, m] = e.target.value.split('-').map(Number); setReferencia(new Date(a, m - 1, 1)); }} className={selectClasse}>
                {!opcoesMes.some((o) => o.valor === mesAtual) && <option value={mesAtual}>{MESES[referencia.getMonth()]} de {referencia.getFullYear()}</option>}
                {opcoesMes.map((o) => <option key={o.valor} value={o.valor}>{o.rotulo}</option>)}
              </select>
            </label>
            <button type="button" onClick={() => setReferencia((a) => somarMeses(a, 1))} className={botaoNav} aria-label="Próximo mês"><ChevronRight className="w-4 h-4" aria-hidden="true" /></button>
          </div>
        )}

        {!aEntregar && <div className={`flex flex-wrap items-center gap-1.5 rounded-xl border bg-white p-1 shadow-sm ${personalizado ? 'border-yellow-400' : 'border-neutral-200'}`}>
          <CalendarDays className="ml-1.5 h-3.5 w-3.5 text-yellow-600" aria-hidden="true" />
          <label className="flex items-center gap-1 text-[10px] font-bold text-neutral-500">
            De
            <input type="date" value={dataInicio} max={dataFim || undefined} onChange={(e) => setDataInicio(e.target.value)} className="rounded-lg border border-neutral-200 px-1.5 py-1 text-xs text-neutral-800 focus:border-yellow-400 focus:outline-none" />
          </label>
          <label className="flex items-center gap-1 text-[10px] font-bold text-neutral-500">
            Até
            <input type="date" value={dataFim} min={dataInicio || undefined} onChange={(e) => setDataFim(e.target.value)} className="rounded-lg border border-neutral-200 px-1.5 py-1 text-xs text-neutral-800 focus:border-yellow-400 focus:outline-none" />
          </label>
          {(dataInicio || dataFim) && (
            <button type="button" onClick={() => { setDataInicio(''); setDataFim(''); }} className="px-2 py-1 text-[10px] font-bold text-neutral-500 hover:text-neutral-900">Limpar</button>
          )}
        </div>}

        <label className="relative">
          <span className="sr-only">Loja</span>
          <select value={loja} onChange={(e) => setLoja(e.target.value)} className={selectClasse}>
            <option value="todas">Todas as lojas</option>
            {lojas.map((nome) => <option key={nome} value={nome}>{nome}</option>)}
          </select>
        </label>
      </div>

      {periodoInvalido && (
        <div role="alert" className="flex gap-2 p-3 rounded-xl bg-yellow-50 border border-yellow-200 text-xs text-yellow-900">
          <AlertTriangle className="w-4 h-4 shrink-0" aria-hidden="true" />
          A data inicial deve ser anterior ou igual à data final.
        </div>
      )}
      {erro && (
        <div role="alert" className="flex gap-2 p-3 rounded-xl bg-red-50 border border-red-200 text-xs text-red-700">
          <AlertTriangle className="w-4 h-4 shrink-0" aria-hidden="true" />
          {erro}
        </div>
      )}

      {consultando && !erro ? (
        <div role="status" className="flex flex-col items-center gap-2 rounded-2xl border border-neutral-200 bg-white p-10 text-center text-sm text-neutral-600">
          <Loader2 className="w-6 h-6 animate-spin text-yellow-600" aria-hidden="true" />
          Lendo os pedidos no Nomus. Na primeira vez isso leva alguns minutos; a tela atualiza sozinha.
        </div>
      ) : resposta && (
        <>
          <p className="text-[11px] text-neutral-500 -mt-3">
            {aEntregar && <span className="mr-1.5 inline-flex items-center gap-1 font-bold text-emerald-700"><span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" aria-hidden="true" />Ao vivo</span>}
            Pedidos do Nomus lidos às {new Date(resposta.atualizadoEm).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
            {aEntregar ? ' (o servidor confere o Nomus a cada 10 minutos; o botão Atualizar confere agora)' : ''}
            {resposta.historicoParcial ? ' · lendo os pedidos mais antigos...' : ''}
          </p>
          {lendo && (
            <p role="status" className="flex items-center gap-2 text-[11px] text-neutral-500 -mt-3">
              <Loader2 className="w-3.5 h-3.5 animate-spin" aria-hidden="true" />
              Números parciais
              {(resposta.mesesPendentes ?? 0) > 0 ? ` · lendo ${plural(resposta.mesesPendentes ?? 0, 'mês', 'meses')} de pedidos` : ''}
              {(resposta.pedidosPendentes ?? 0) > 0 ? ` · buscando a cidade de clientes de ${plural(resposta.pedidosPendentes ?? 0, 'pedido', 'pedidos')}` : ''}
            </p>
          )}
          {resposta.erroAtualizacao && <p className="text-[11px] text-amber-700 -mt-3">Não foi possível ler algumas cidades no Nomus agora; tentando de novo. ({resposta.erroAtualizacao})</p>}

          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <Kpi titulo="Pedidos" valor={formatInteiro(totalLocalizado + (loja === 'todas' ? semLocalizacao : 0))} detalhe={loja === 'todas' ? (aEntregar ? 'ainda não entregues' : 'emitidos no período') : loja} />
            <Kpi titulo="Estados" valor={formatInteiro(agregado.estados.length)} detalhe={agregado.estados[0] ? `mais pedidos: ${agregado.estados[0].uf} (${formatInteiro(agregado.estados[0].pedidos)})` : 'sem pedidos'} />
            <Kpi titulo="Cidades" valor={formatInteiro(agregado.cidades.length)} detalhe={agregado.cidades[0] ? `mais pedidos: ${agregado.cidades[0].cidade} (${formatInteiro(agregado.cidades[0].pedidos)})` : 'sem pedidos'} />
            <Kpi titulo="Valor dos pedidos" valor={formatCurrency(agregado.valor)} detalhe="nas cidades localizadas" />
          </div>

          <div className="grid lg:grid-cols-[minmax(0,1fr)_340px] gap-4">
            <section className="rounded-2xl border border-neutral-200 bg-white shadow-sm p-3" aria-label="Mapa do Brasil">
              <div className="flex items-center justify-between gap-2 px-1 pb-2 min-h-[28px]">
                <h2 className="text-sm font-black text-neutral-900">{feicaoSelecionada ? `${feicaoSelecionada.nome} (${feicaoSelecionada.uf})` : 'Brasil'}</h2>
                {feicaoSelecionada && (
                  <button type="button" onClick={() => setUfSelecionada(null)} className="rounded-full border border-neutral-200 px-3 py-1 text-[11px] font-bold text-neutral-600 hover:border-yellow-400 hover:text-yellow-700">
                    Voltar ao Brasil
                  </button>
                )}
              </div>
              <div ref={areaDoMapa} className="relative">
                <svg
                  viewBox={`${caixa.x} ${caixa.y} ${caixa.largura} ${caixa.altura}`}
                  className="w-full h-auto max-h-[640px]"
                  role="img"
                  aria-label={`Mapa de pedidos por ${ufSelecionada ? 'cidade' : 'estado'}`}
                  onMouseLeave={() => setFoco(null)}
                >
                  {estados.map((estado) => {
                    const dados = porUf.get(estado.uf);
                    const selecionado = estado.uf === ufSelecionada;
                    // De perto o estado fica claro, para os círculos das cidades aparecerem; no Brasil, a cor mostra o volume.
                    const intensidade = dados && maxEstado > 0 ? (ufSelecionada ? 0.14 : 0.18 + 0.72 * Math.sqrt(dados.pedidos / maxEstado)) : 0;
                    return (
                      <path
                        key={estado.uf}
                        d={caminho(estado.aneis)}
                        fill={dados ? `rgba(234, 179, 8, ${intensidade.toFixed(2)})` : '#f5f5f5'}
                        stroke={selecionado ? '#171717' : '#a3a3a3'}
                        strokeWidth={(selecionado ? 1.6 : 0.8) * unidade}
                        strokeLinejoin="round"
                        className="cursor-pointer outline-none hover:brightness-95"
                        tabIndex={0}
                        role="button"
                        aria-label={`${estado.nome}: ${dados ? plural(dados.pedidos, 'pedido', 'pedidos') : 'sem pedidos'}`}
                        onClick={() => setUfSelecionada(selecionado ? null : estado.uf)}
                        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setUfSelecionada(selecionado ? null : estado.uf); } }}
                        onMouseMove={(e) => mostrarFoco(e, estado.nome, dados?.pedidos ?? 0, dados?.valor ?? 0)}
                      />
                    );
                  })}
                  {bolhas.map(({ cidade, x, y }) => (
                    <circle
                      key={`${cidade.uf}|${cidade.cidade}`}
                      cx={x}
                      cy={y}
                      r={raioDaBolha(cidade.pedidos)}
                      fill="rgba(23, 23, 23, 0.55)"
                      stroke="#ffffff"
                      strokeWidth={0.8 * unidade}
                      className="cursor-pointer outline-none hover:fill-neutral-900/80 focus-visible:stroke-yellow-400"
                      tabIndex={0}
                      role="button"
                      aria-label={`${cidade.cidade}: ${plural(cidade.pedidos, 'pedido', 'pedidos')}. Abrir a lista`}
                      onClick={() => setCidadeAberta({ cidade: cidade.cidade, uf: cidade.uf })}
                      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setCidadeAberta({ cidade: cidade.cidade, uf: cidade.uf }); } }}
                      onMouseMove={(e) => mostrarFoco(e, `${cidade.cidade} — ${cidade.uf}`, cidade.pedidos, cidade.valor)}
                    />
                  ))}
                </svg>
                {foco && (
                  <div
                    className="pointer-events-none absolute z-10 rounded-lg bg-neutral-900 px-3 py-2 text-[11px] text-white shadow-lg"
                    style={{ left: Math.min(foco.x + 12, (areaDoMapa.current?.clientWidth ?? 400) - 190), top: foco.y + 12 }}
                  >
                    <div className="font-bold">{foco.titulo}</div>
                    <div className="tabular-nums">{plural(foco.pedidos, 'pedido', 'pedidos')} · {formatCurrency(foco.valor)}</div>
                  </div>
                )}
              </div>
              <p className="px-1 pt-2 text-[11px] text-neutral-500">
                Cor do estado e tamanho do círculo = quantidade de pedidos. Passe o mouse para ver o valor e clique no círculo para ver os pedidos da cidade.
                {semCoordenada > 0 ? ` ${plural(semCoordenada, 'cidade', 'cidades')} sem posição no mapa (aparecem na lista).` : ''}
              </p>
            </section>

            <aside className="rounded-2xl border border-neutral-200 bg-white shadow-sm overflow-hidden" aria-label={ufSelecionada ? `Cidades de ${nomeDoEstado(ufSelecionada)}` : 'Estados'}>
              <h2 className="text-sm font-black text-neutral-900 px-4 pt-4 pb-2">{ufSelecionada ? `Cidades de ${nomeDoEstado(ufSelecionada)}` : 'Estados'}</h2>
              <ol className="max-h-[600px] overflow-y-auto divide-y divide-neutral-100 text-[12px]">
                {(ufSelecionada ? cidadesVisiveis.map((c) => ({ chave: c.cidade, nome: c.cidade, pedidos: c.pedidos, valor: c.valor, uf: '', cidade: c.cidade })) : agregado.estados.map((e) => ({ chave: e.uf, nome: nomeDoEstado(e.uf), pedidos: e.pedidos, valor: e.valor, uf: e.uf, cidade: '' }))).map((linha) => {
                  const maximo = ufSelecionada ? maxCidade : maxEstado;
                  const conteudo = (
                    <>
                      <div className="flex items-baseline justify-between gap-2">
                        <span className="font-semibold text-neutral-800 truncate">{linha.nome}</span>
                        <span className="tabular-nums font-bold text-neutral-900 whitespace-nowrap">{formatInteiro(linha.pedidos)}</span>
                      </div>
                      <div className="mt-1 h-1.5 rounded-full bg-neutral-100 overflow-hidden"><div className="h-full rounded-full bg-yellow-400" style={{ width: `${Math.max(3, (linha.pedidos / Math.max(maximo, 1)) * 100)}%` }} /></div>
                      <div className="mt-0.5 text-[10px] text-neutral-500 tabular-nums">{formatCurrency(linha.valor)}</div>
                    </>
                  );
                  return (
                    <li key={linha.chave}>
                      {linha.uf ? (
                        <button type="button" onClick={() => setUfSelecionada(linha.uf)} className="block w-full px-4 py-2 text-left hover:bg-yellow-50 focus:outline-none focus-visible:bg-yellow-50">{conteudo}</button>
                      ) : (
                        <button type="button" onClick={() => setCidadeAberta({ cidade: linha.cidade, uf: ufSelecionada ?? '' })} className="block w-full px-4 py-2 text-left hover:bg-yellow-50 focus:outline-none focus-visible:bg-yellow-50">{conteudo}</button>
                      )}
                    </li>
                  );
                })}
                {agregado.estados.length === 0 && <li className="px-4 py-6 text-center text-neutral-500">{aEntregar ? 'Nenhum pedido pendente de entrega.' : 'Sem pedidos no período.'}</li>}
              </ol>
              {loja === 'todas' && semLocalizacao > 0 && (
                <p className="border-t border-neutral-100 px-4 py-2 text-[11px] text-neutral-500">
                  {plural(semLocalizacao, 'pedido', 'pedidos')} de clientes sem cidade no cadastro ({formatCurrency(resposta.semLocalizacao.valor)}) não aparecem no mapa.
                </p>
              )}
            </aside>
          </div>
        </>
      )}
      {cidadeAberta && resposta && (
        <PedidosDaCidade
          cidade={cidadeAberta.cidade}
          uf={cidadeAberta.uf}
          mostrarPrazo={aEntregar}
          pedidos={resposta.pedidos.filter((p) => p.uf === cidadeAberta.uf && normalizarCidade(p.cidade) === normalizarCidade(cidadeAberta.cidade) && (loja === 'todas' || p.loja === loja))}
          aoFechar={() => setCidadeAberta(null)}
        />
      )}
    </div>
  );
};
