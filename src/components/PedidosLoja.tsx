import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AlertTriangle, ArrowDown, ArrowLeft, ArrowUp, ArrowUpDown, Loader2, PackageSearch, RefreshCw, Search } from 'lucide-react';
import { DIAS_ALERTA_PRAZO, type PedidoLojaLinha, type RespostaPedidosLoja, type SituacaoPrazo } from '../pedidosLoja';
import { formatDataIsoParaBr } from '../utils/format';

interface PedidosLojaProps {
  lojaId: string;
  lojaNome: string;
  /** Parâmetros do período da loja, no mesmo formato da tela (ex.: "periodo=mes&mes=2026-10"). */
  consulta: string;
  rotuloPeriodo: string;
  /** Controles de período (mês, dia, semana, De/Até), renderizados abaixo do título. */
  filtrosPeriodo?: React.ReactNode;
  onVoltar: () => void;
}

type CampoOrdenacao = 'urgencia' | 'codigo' | 'vendedor' | 'emissao' | 'prazo' | 'prazoGferro' | 'valor';
type Direcao = 'asc' | 'desc';

const ERRO_RESPOSTA_INVALIDA = 'O servidor não respondeu como esperado. Atualize a página; se continuar, o servidor ainda não foi atualizado com esta funcionalidade.';

async function lerResposta(res: Response) {
  const corpo = await res.json().catch(() => null);
  if (!res.ok) throw new Error(corpo?.error || 'Não foi possível carregar os pedidos.');
  if (corpo === null) throw new Error(ERRO_RESPOSTA_INVALIDA);
  return corpo;
}

// Última relação carregada de cada consulta (loja + período): ao voltar a uma tela já vista ela aparece na
// hora e o servidor só atualiza por baixo, sem a tela de "Consultando...".
const ultimasRelacoes = new Map<string, RespostaPedidosLoja>();

const formatarValor = (valor: number) => valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const normalizar = (texto: string) => texto.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase();

const ESTILO: Record<SituacaoPrazo, { borda: string; selo: string; ponto: string; rotuloFiltro: string }> = {
  'atrasado': { borda: 'border-l-red-500', selo: 'bg-red-100 text-red-700', ponto: 'bg-red-500', rotuloFiltro: 'Atrasados' },
  'vence-em-breve': { borda: 'border-l-yellow-400', selo: 'bg-yellow-100 text-yellow-800', ponto: 'bg-yellow-500', rotuloFiltro: 'Vence em breve' },
  'no-prazo': { borda: 'border-l-emerald-500', selo: 'bg-emerald-100 text-emerald-700', ponto: 'bg-emerald-500', rotuloFiltro: 'Dentro do prazo' },
  'concluido': { borda: 'border-l-sky-400', selo: 'bg-sky-100 text-sky-700', ponto: 'bg-sky-500', rotuloFiltro: 'Concluídos' },
  'cancelado': { borda: 'border-l-neutral-300', selo: 'bg-neutral-100 text-neutral-600', ponto: 'bg-neutral-400', rotuloFiltro: 'Cancelados' },
  'sem-prazo': { borda: 'border-l-neutral-300', selo: 'bg-neutral-100 text-neutral-600', ponto: 'bg-neutral-400', rotuloFiltro: 'Sem prazo' },
};

const ORDEM_FILTROS: SituacaoPrazo[] = ['atrasado', 'vence-em-breve', 'no-prazo', 'concluido', 'cancelado', 'sem-prazo'];

function textoSituacao(pedido: PedidoLojaLinha): string {
  const dias = pedido.diasParaPrazo;
  switch (pedido.situacao) {
    case 'atrasado': return `Atrasado há ${Math.abs(dias ?? 0)} ${Math.abs(dias ?? 0) === 1 ? 'dia' : 'dias'}`;
    case 'vence-em-breve': return dias === 0 ? 'Vence hoje' : dias === 1 ? 'Vence amanhã' : `Vence em ${dias} dias`;
    case 'no-prazo': return 'Dentro do prazo';
    case 'concluido': return 'Concluído';
    case 'cancelado': return 'Cancelado';
    case 'sem-prazo': return 'Sem prazo';
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
        Não foi possível exibir a relação de pedidos. Atualize a página e tente novamente.
      </div>
    );
  }
}

const PedidosLojaConteudo: React.FC<PedidosLojaProps> = ({ lojaId, lojaNome, consulta, rotuloPeriodo, filtrosPeriodo, onVoltar }) => {
  const [resposta, setResposta] = useState<RespostaPedidosLoja | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [atualizando, setAtualizando] = useState(false);
  const [erro, setErro] = useState('');
  const [filtro, setFiltro] = useState<SituacaoPrazo | 'todos'>('todos');
  const [busca, setBusca] = useState('');
  const [ordenacao, setOrdenacao] = useState<{ campo: CampoOrdenacao; direcao: Direcao }>({ campo: 'urgencia', direcao: 'asc' });

  const url = `/api/vendas/lojas/${lojaId}/pedidos?${consulta}`;
  const urlExibida = useRef(url);
  urlExibida.current = url;

  const buscar = useCallback(async (urlBuscada: string, silencioso: boolean) => {
    if (silencioso) setAtualizando(true); else setCarregando(true);
    try {
      const dados: RespostaPedidosLoja = await lerResposta(await fetch(urlBuscada));
      if (!Array.isArray(dados?.pedidos)) throw new Error(ERRO_RESPOSTA_INVALIDA);
      if (!dados.carregando) ultimasRelacoes.set(urlBuscada, dados);
      if (urlExibida.current !== urlBuscada) return;
      setResposta(dados);
      setErro('');
    } catch (e: any) {
      if (urlExibida.current === urlBuscada) setErro(e.message);
    } finally {
      if (urlExibida.current === urlBuscada) {
        setCarregando(false);
        setAtualizando(false);
      }
    }
  }, []);

  // Carrega ao abrir e acompanha o Nomus a cada minuto, sem piscar a tela.
  useEffect(() => {
    let ativo = true;
    const guardada = ultimasRelacoes.get(url) ?? null;
    setResposta(guardada);
    if (guardada) setCarregando(false);
    buscar(url, guardada !== null);
    const intervalo = setInterval(() => { if (ativo) buscar(url, true); }, 60_000);
    return () => { ativo = false; clearInterval(intervalo); };
  }, [url, buscar]);

  const pedidos = resposta?.pedidos ?? [];

  // O servidor consulta o PCP em segundo plano: enquanto faltar prazo Gferro, pergunta de novo em poucos segundos.
  // Também repete enquanto o servidor lê um período novo no Nomus (resposta "carregando").
  const consultandoNomus = carregando || resposta?.carregando === true;
  const aguardandoPrazoGferro = resposta?.carregando === true || pedidos.some((pedido) => pedido.prazoGferroPendente);
  useEffect(() => {
    if (!aguardandoPrazoGferro) return;
    const espera = setTimeout(() => buscar(urlExibida.current, true), 8_000);
    return () => clearTimeout(espera);
  }, [aguardandoPrazoGferro, resposta, buscar]);

  const contagem = useMemo(() => {
    const total: Record<SituacaoPrazo, number> = { 'atrasado': 0, 'vence-em-breve': 0, 'no-prazo': 0, 'concluido': 0, 'cancelado': 0, 'sem-prazo': 0 };
    for (const pedido of pedidos) total[pedido.situacao] += 1;
    return total;
  }, [pedidos]);

  const visiveis = useMemo(() => {
    const termo = normalizar(busca.trim());
    const filtrados = pedidos.filter((pedido) =>
      (filtro === 'todos' || pedido.situacao === filtro)
      && (!termo || normalizar(`${pedido.codigo} ${pedido.vendedor}`).includes(termo))
    );
    if (ordenacao.campo === 'urgencia') return filtrados; // já vem ordenado pelo servidor
    const fator = ordenacao.direcao === 'asc' ? 1 : -1;
    return [...filtrados].sort((a, b) => {
      switch (ordenacao.campo) {
        case 'codigo': return fator * a.codigo.localeCompare(b.codigo, 'pt-BR');
        case 'vendedor': return fator * a.vendedor.localeCompare(b.vendedor, 'pt-BR');
        case 'emissao': return fator * a.dataEmissao.localeCompare(b.dataEmissao);
        case 'prazo': return fator * ((a.prazo ?? '9999-12-31').localeCompare(b.prazo ?? '9999-12-31'));
        case 'prazoGferro': return fator * ((a.prazoGferro ?? '9999-12-31').localeCompare(b.prazoGferro ?? '9999-12-31'));
        case 'valor': return fator * (a.valorTotal - b.valorTotal);
        default: return 0;
      }
    });
  }, [pedidos, filtro, busca, ordenacao]);

  const totalValor = useMemo(() => visiveis.reduce((soma, pedido) => soma + pedido.valorTotal, 0), [visiveis]);

  const alternarOrdenacao = (campo: CampoOrdenacao) =>
    setOrdenacao((atual) => campo === 'urgencia'
      ? { campo: 'urgencia', direcao: 'asc' }
      : atual.campo === campo
        ? { campo, direcao: atual.direcao === 'asc' ? 'desc' : 'asc' }
        : { campo, direcao: campo === 'emissao' || campo === 'valor' ? 'desc' : 'asc' });

  const colunas: Array<{ campo: CampoOrdenacao; titulo: string; alinhar?: 'right' }> = [
    { campo: 'codigo', titulo: 'Pedido' },
    { campo: 'vendedor', titulo: 'Vendedor' },
    { campo: 'emissao', titulo: 'Emissão' },
    { campo: 'prazo', titulo: 'Prazo de entrega' },
    { campo: 'prazoGferro', titulo: 'Prazo de entrega Gferro' },
    { campo: 'valor', titulo: 'Valor', alinhar: 'right' },
    { campo: 'urgencia', titulo: 'Situação' },
  ];

  return (
    <div className="space-y-6">
      <button
        type="button"
        onClick={onVoltar}
        className="flex items-center gap-2 px-3 py-2 rounded-full bg-white border border-neutral-200 text-neutral-600 hover:text-yellow-600 hover:border-yellow-400 text-xs font-semibold transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-yellow-400"
      >
        <ArrowLeft className="w-3.5 h-3.5" aria-hidden="true" />
        <span>Voltar à loja</span>
      </button>

      <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-3">
        <div>
          <span className="text-xs font-bold uppercase tracking-widest text-yellow-600">Dashboard • Vendas</span>
          <h1 className="text-2xl font-black text-neutral-900 mt-1 flex items-center gap-2">
            <PackageSearch className="w-6 h-6 text-yellow-600" aria-hidden="true" />
            Pedidos — {lojaNome}
          </h1>
          <p className="text-neutral-500 text-sm mt-1">
            Pedidos do período ({rotuloPeriodo}) e a situação de prazo de cada um, pela data de entrega dos itens. Vence em breve = até {DIAS_ALERTA_PRAZO} dias.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <label className="relative block">
            <span className="sr-only">Buscar por pedido ou vendedor</span>
            <Search className="w-4 h-4 text-neutral-400 absolute left-3.5 top-1/2 -translate-y-1/2" aria-hidden="true" />
            <input
              type="search"
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder="Buscar por pedido ou vendedor..."
              className="w-full sm:w-72 rounded-xl border border-neutral-200 bg-white pl-10 pr-4 py-2.5 text-sm outline-none focus:border-yellow-500"
            />
          </label>
          <button type="button" onClick={() => buscar(url, true)} disabled={consultandoNomus || atualizando} className="flex items-center gap-1.5 px-3.5 py-2.5 rounded-full border border-neutral-200 bg-white text-xs font-bold text-neutral-600 hover:border-yellow-400 hover:text-yellow-600 disabled:opacity-40 transition-all">
            <RefreshCw className={`w-3.5 h-3.5 ${atualizando ? 'animate-spin' : ''}`} aria-hidden="true" />
            Atualizar
          </button>
        </div>
      </div>

      {filtrosPeriodo}

      {erro && (
        <div role="alert" className="flex gap-2 p-3 rounded-xl bg-red-50 border border-red-200 text-xs text-red-700">
          <AlertTriangle className="w-4 h-4 shrink-0" aria-hidden="true" />
          {erro}
        </div>
      )}

      {resposta?.fechamentoOficial && (
        <div className="p-4 rounded-xl bg-yellow-50 border border-yellow-200 text-sm text-yellow-900">
          Este período é um fechamento oficial lançado à mão: não há pedidos individuais para listar. Escolha outro período.
        </div>
      )}

      {!consultandoNomus && resposta && !resposta.fechamentoOficial && (
        <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Filtrar por situação">
          <button
            type="button"
            aria-pressed={filtro === 'todos'}
            onClick={() => setFiltro('todos')}
            className={`rounded-full border px-3.5 py-1.5 text-xs font-bold transition-all ${filtro === 'todos' ? 'border-neutral-900 bg-neutral-900 text-white' : 'border-neutral-200 bg-white text-neutral-600 hover:border-neutral-400'}`}
          >
            Todos ({pedidos.length})
          </button>
          {ORDEM_FILTROS.filter((situacao) => contagem[situacao] > 0 || situacao === 'atrasado' || situacao === 'vence-em-breve' || situacao === 'no-prazo').map((situacao) => {
            const estilo = ESTILO[situacao];
            const ativo = filtro === situacao;
            return (
              <button
                key={situacao}
                type="button"
                aria-pressed={ativo}
                onClick={() => setFiltro(ativo ? 'todos' : situacao)}
                className={`inline-flex items-center gap-2 rounded-full border px-3.5 py-1.5 text-xs font-bold transition-all ${ativo ? `${estilo.selo} border-transparent ring-2 ring-offset-1 ring-neutral-300` : 'border-neutral-200 bg-white text-neutral-600 hover:border-neutral-400'}`}
              >
                <span className={`w-2.5 h-2.5 rounded-full ${estilo.ponto}`} aria-hidden="true" />
                {estilo.rotuloFiltro} ({contagem[situacao]})
              </button>
            );
          })}
          <span className="text-xs text-neutral-500 sm:ml-auto">
            {visiveis.length} {visiveis.length === 1 ? 'pedido' : 'pedidos'} · {formatarValor(totalValor)}
            {resposta.atualizadoEm && <span className="text-neutral-400"> · Nomus às {new Date(resposta.atualizadoEm).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</span>}
          </span>
        </div>
      )}

      <div className="rounded-2xl border border-neutral-200 bg-white shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1080px] text-sm">
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
                <th scope="col" className="text-left px-5 py-4 font-extrabold text-neutral-900">Etapa</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100">
              {consultandoNomus ? (
                <tr><td colSpan={8} className="px-5 py-12 text-center text-neutral-500"><Loader2 className="w-5 h-5 animate-spin inline-block mr-2 text-yellow-600" aria-hidden="true" />Consultando os pedidos no Nomus... (na primeira vez do período pode levar alguns minutos)</td></tr>
              ) : visiveis.length === 0 ? (
                <tr><td colSpan={8} className="px-5 py-12 text-center text-neutral-500">{pedidos.length === 0 ? 'Nenhum pedido encontrado nesse período.' : 'Nenhum pedido encontrado para esse filtro.'}</td></tr>
              ) : visiveis.map((pedido) => {
                const estilo = ESTILO[pedido.situacao];
                return (
                  <tr key={pedido.id} className="hover:bg-neutral-50/60">
                    <td className={`px-5 py-3.5 whitespace-nowrap font-bold text-neutral-900 border-l-4 ${estilo.borda}`}>{pedido.codigo}</td>
                    <td className="px-5 py-3.5 text-neutral-700">{pedido.vendedor}</td>
                    <td className="px-5 py-3.5 whitespace-nowrap tabular-nums text-neutral-700">{pedido.dataEmissao ? formatDataIsoParaBr(pedido.dataEmissao) : '—'}</td>
                    <td className="px-5 py-3.5 whitespace-nowrap tabular-nums text-neutral-700">{pedido.prazo ? formatDataIsoParaBr(pedido.prazo) : '—'}</td>
                    <td className="px-5 py-3.5 whitespace-nowrap tabular-nums text-neutral-700">
                      {pedido.prazoGferro
                        ? formatDataIsoParaBr(pedido.prazoGferro)
                        : pedido.prazoGferroPendente
                          ? <span className="text-neutral-400" title="Consultando o PCP...">Consultando...</span>
                          : '—'}
                    </td>
                    <td className="px-5 py-3.5 text-right whitespace-nowrap tabular-nums text-neutral-900">{formatarValor(pedido.valorTotal)}</td>
                    <td className="px-5 py-3.5">
                      <span className={`inline-flex items-center gap-2 whitespace-nowrap rounded-full px-3.5 py-1.5 text-xs font-bold ${estilo.selo}`}>
                        <span className={`w-2.5 h-2.5 rounded-full ${estilo.ponto}`} aria-hidden="true" />
                        {textoSituacao(pedido)}
                      </span>
                    </td>
                    <td className="px-5 py-3.5 text-neutral-600 whitespace-nowrap">{pedido.etapa}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export const PedidosLoja: React.FC<PedidosLojaProps> = (props) => (
  <LimiteDeErro>
    <PedidosLojaConteudo {...props} />
  </LimiteDeErro>
);
