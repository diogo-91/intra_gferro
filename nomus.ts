// Integração com o Nomus ERP para o Ranking de Vendedores e pro Painel Financeiro.
// Segue a documentação oficial da API (Nomus ERP.postman_collection.json):
// - GET /pedidos: cada pedido já traz "valorTotal" pronto no cabeçalho
//   (string em formato BR, ex.: "32.468,04") — não precisa recalcular pelos itens.
// - Filtro por data server-side via query: ?query=dataEmissao>AAAA-MM-DDTHH:mm:ss
// - Paginação: parâmetro "pagina", 50 registros por página.
// - GET /vendedores: cada vendedor tem "id" e "nome".
// - GET /contasReceber e /contasPagar: mesmo formato de registro pros dois —
//   "saldoReceber"/"valorReceber" vêm negativos em contas a pagar, mas
//   "valorRecebido" já vem positivo dos dois lados. "status" é booleano
//   (true = já baixada/quitada); ?query=status=false filtra só as em aberto.
// - Fluxo de caixa real (quanto entrou/saiu de fato) usa "dataBaixa" +
//   "valorRecebido" DIRETO em /contasReceber e /contasPagar — NÃO os
//   endpoints /recebimentos e /pagamentos. Testando com dado real da GFERRO,
//   esses dois endpoints ficaram bem abaixo do valor realmente liquidado (o
//   Nomus baixa boleto/PIX por conciliação automática direto na conta, sem
//   sempre criar um registro de recebimento/pagamento avulso).
// - O Nomus NÃO expõe saldo de conta bancária (só o cadastro da conta) nem
//   um DRE/EBITDA pronto — por isso o Painel Financeiro deriva só o que dá
//   pra calcular com precisão a partir desses endpoints.

import type { ContaReceber, ContaPagar, ContaConcluida, DreConta, DreFinanceira, DreLinha, FluxoCaixaMes, ResumoFinanceiro } from './src/types';
import { aplicarReprogramacoes } from './reprogramacoes';
import { CLASSIFICACOES_FINANCEIRAS, GRUPOS_CLASSIFICACAO_FINANCEIRA, nomeClassificacaoFinanceira, grupoDaClassificacao, grupoDaClassificacaoPorNome } from './src/data/classificacoesFinanceiras';
import { lojaDoVendedor } from './src/data/vendedorLoja';
import { readFileSync, writeFileSync, mkdirSync } from 'fs';
import path from 'path';

// Cache em disco (além do cache em memória) — sem isso, todo restart do
// servidor (deploy, correção de código) apaga tudo e a tela fica sem
// nenhum dado até reaquecer de novo (10-15+ min nessa GFERRO). Com o
// arquivo, o servidor sobe já com o último dado bom conhecido e decide a
// "atualização em segundo plano" a partir do atualizadoEm salvo, do mesmo
// jeito que já faz em memória — só que sobrevive ao processo reiniciar.
const PASTA_CACHE_DISCO = path.join(process.cwd(), 'data');
const ARQUIVO_CACHE_RESUMOS = path.join(PASTA_CACHE_DISCO, 'financeiro-cache-resumos.json');
const ARQUIVO_CACHE_DRE = path.join(PASTA_CACHE_DISCO, 'financeiro-cache-dre.json');

function carregarCacheResumosDoDisco(): Map<string, CacheResumoFinanceiro> {
  try {
    const objeto = JSON.parse(readFileSync(ARQUIVO_CACHE_RESUMOS, 'utf-8')) as Record<string, CacheResumoFinanceiro>;
    return new Map(Object.entries(objeto));
  } catch {
    return new Map();
  }
}

function persistirCacheResumosNoDisco(mapa: Map<string, CacheResumoFinanceiro>): void {
  try {
    mkdirSync(PASTA_CACHE_DISCO, { recursive: true });
    writeFileSync(ARQUIVO_CACHE_RESUMOS, JSON.stringify(Object.fromEntries(mapa), null, 2), 'utf-8');
  } catch (err) {
    console.error('[nomus] falha ao persistir cache de resumos financeiros no disco:', err);
  }
}

interface CacheDreFinanceira {
  atualizadoEm: number;
  dre: DreFinanceira;
}

function carregarCacheDreDoDisco(): Map<string, CacheDreFinanceira> {
  try {
    const objeto = JSON.parse(readFileSync(ARQUIVO_CACHE_DRE, 'utf-8')) as Record<string, CacheDreFinanceira>;
    return new Map(Object.entries(objeto));
  } catch {
    return new Map();
  }
}

function persistirCacheDreNoDisco(mapa: Map<string, CacheDreFinanceira>): void {
  try {
    mkdirSync(PASTA_CACHE_DISCO, { recursive: true });
    writeFileSync(ARQUIVO_CACHE_DRE, JSON.stringify(Object.fromEntries(mapa), null, 2), 'utf-8');
  } catch (err) {
    console.error('[nomus] falha ao persistir cache da DRE no disco:', err);
  }
}

const PAGE_SIZE = 50;
const MAX_PAGES = 10_000;
const REQUEST_TIMEOUT_MS = 30_000;
const MAX_RETRIES = 5;
const CACHE_TTL_MS = 3 * 60 * 1000; // mesmo padrão dos projetos irmãos (Gferro/Apontamento)

// Unidade "METRO QUADRADO" (símbolo "M2") no cadastro de Unidades de Medida do Nomus.
const ID_UNIDADE_METRO_QUADRADO = 14;

// Essa instância do Nomus é COMPARTILHADA por mais de uma empresa (confirmado
// testando a API real: registros com idEmpresa=1/"Constelha" aparecem
// misturados com idEmpresa=3/"GFERRO" em contasReceber, contasPagar,
// recebimentos e pagamentos — até 67% de contaminação em contasReceber
// aberto). TODA consulta financeira precisa filtrar por essa empresa,
// senão os totais somam dinheiro de duas empresas diferentes.
const ID_EMPRESA_GFERRO = 3;

function comFiltroEmpresa(query?: string): string {
  const filtro = `idEmpresa=${ID_EMPRESA_GFERRO}`;
  return query ? `${query};${filtro}` : filtro;
}

export type Periodo = 'dia' | 'semana' | 'mes';

interface ItemPedido {
  idProduto?: number;
  quantidade?: string | number;
  valorUnitario?: string | number;
  valorDesconto?: string | number;
  percentualDesconto?: string | number;
  valorAcrescimo?: string | number;
  percentualAcrescimo?: string | number;
  idUnidadeMedida?: number;
}

interface Pedido {
  id: number;
  codigoPedido?: string;
  dataEmissao?: string;
  idPessoaVendedor?: number;
  valorTotal?: string | number;
  valorTotalFrete?: string | number;
  itensPedido?: ItemPedido[];
}

interface Vendedor {
  id: number;
  nome?: string;
}

interface Produto {
  id: number;
  descricao?: string;
}

interface UnidadeMedida {
  id: number;
  simbolo?: string;
}

export interface VendedorRanking {
  nome: string;
  pedidos: number;
  valorTotal: number;
  metrosQuadrados: number;
  pedidosParafusos: number;
  quantidadeParafusos: number;
  valorParafusos: number;
  pedidosComFrete: number;
  valorFrete: number;
  ticketMedio: number;
  valorRecebido: number;
}

export interface ProdutoRanking {
  nome: string;
  valorTotal: number;
  quantidade: number;
  unidade: string;
}

export interface ResumoVendas {
  totalVendas: number;
  valorRecebidoPedidos: number;
  valorPendentePedidos: number;
  financeiroPedidosCarregando: boolean;
  totalPedidos: number;
  totalMetrosQuadrados: number;
  vendedoresAtivos: number;
  /** Todos os produtos distintos vendidos no período, ordenados por valor desc. */
  produtos: ProdutoRanking[];
  atualizadoEm: string;
}

function getConfig() {
  const baseUrl = (process.env.NOMUS_BASE_URL || '').replace(/\/+$/, '');
  const apiKey = process.env.NOMUS_API_KEY || '';
  return { baseUrl, apiKey };
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Números vêm da API em formato BR (ex.: "32.468,04" ou "1,2").
function parseNum(valor: unknown): number {
  if (valor === null || valor === undefined || valor === '') return 0;
  if (typeof valor === 'number') return valor;
  let s = String(valor).trim();
  if (s.includes(',') && s.includes('.')) {
    s = s.replace(/\./g, '').replace(',', '.');
  } else if (s.includes(',')) {
    s = s.replace(',', '.');
  }
  const n = parseFloat(s);
  return Number.isNaN(n) ? 0 : n;
}

// O cabeçalho do pedido já tem "valorTotal" pronto (usado no ranking de
// vendedores), mas isso não é aberto por produto — pra "vendas por produto"
// é preciso calcular o valor de cada item (quantidade x valorUnitario, com
// desconto antes do acréscimo), igual ao script pedidos_abertos_por_vendedor.py.
function valorEstimadoItem(it: ItemPedido): number {
  let bruto = parseNum(it.quantidade) * parseNum(it.valorUnitario);

  if (it.valorDesconto !== undefined && it.valorDesconto !== null && it.valorDesconto !== '') {
    bruto -= parseNum(it.valorDesconto);
  } else if (it.percentualDesconto !== undefined && it.percentualDesconto !== null && it.percentualDesconto !== '') {
    bruto -= (bruto * parseNum(it.percentualDesconto)) / 100;
  }

  if (it.valorAcrescimo !== undefined && it.valorAcrescimo !== null && it.valorAcrescimo !== '') {
    bruto += parseNum(it.valorAcrescimo);
  } else if (it.percentualAcrescimo !== undefined && it.percentualAcrescimo !== null && it.percentualAcrescimo !== '') {
    bruto += (bruto * parseNum(it.percentualAcrescimo)) / 100;
  }

  return bruto;
}

function metrosQuadradosPedido(pedido: Pedido): number {
  return (pedido.itensPedido || [])
    .filter((it) => it.idUnidadeMedida === ID_UNIDADE_METRO_QUADRADO)
    .reduce((soma, it) => soma + parseNum(it.quantidade), 0);
}

// Serializa TODA chamada HTTP ao Nomus feita por este app — mesmo entre
// buscas de meses/dicionário diferentes rodando "ao mesmo tempo" (ex.: duas
// abas pedindo meses distintos). Confirmado na prática: essa instância
// (compartilhada com outros apps da GFERRO, ver .env) devolve 400 esporádico
// sob QUALQUER carga concorrente vinda daqui, não só dentro da mesma
// varredura — por isso a fila é global, não por-requisição.
let filaNomus: Promise<unknown> = Promise.resolve();

function serializarNomus<T>(tarefa: () => Promise<T>): Promise<T> {
  const resultado = filaNomus.then(tarefa, tarefa);
  filaNomus = resultado.then(
    () => undefined,
    () => undefined
  );
  return resultado;
}

async function fetchComRetry(url: string, apiKey: string): Promise<any> {
  return serializarNomus(() => fetchComRetryInterno(url, apiKey));
}

async function fetchComRetryInterno(url: string, apiKey: string): Promise<any> {
  let tentativa = 0;
  // eslint-disable-next-line no-constant-condition
  while (true) {
    let resp: Response;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
    try {
      resp = await fetch(url, {
        headers: { Authorization: `Basic ${apiKey}`, Accept: 'application/json' },
        signal: controller.signal,
      });
    } catch (err) {
      tentativa += 1;
      if (tentativa > MAX_RETRIES) throw err;
      await sleep(Math.min(2 ** tentativa, 30) * 1000);
      continue;
    } finally {
      clearTimeout(timeoutId);
    }

    if (resp.status === 429) {
      let espera = 5;
      try {
        const body = await resp.json();
        espera = Number(body?.tempoAteLiberar) || 5;
      } catch {
        // sem corpo JSON, usa o padrão
      }
      console.log(`[nomus] 429 em ${url} — aguardando ${espera + 1}s`);
      await sleep((espera + 1) * 1000);
      continue;
    }

    if (resp.status === 401) {
      throw new Error('Credencial Nomus inválida (401). Confira NOMUS_API_KEY no .env.');
    }

    if (!resp.ok) {
      // Erros diferentes de 429/401 às vezes são só a instância engasgando sob
      // carga concorrente (visto na prática: 400 esporádico em paginação
      // pesada) — vale uma tentativa extra antes de desistir de vez.
      tentativa += 1;
      if (tentativa > MAX_RETRIES) {
        throw new Error(`Nomus respondeu ${resp.status} em ${url}`);
      }
      await sleep(Math.min(2 ** tentativa, 30) * 1000);
      continue;
    }

    return resp.json();
  }
}

async function coletarTudo<T>(endpoint: string, baseUrl: string, apiKey: string, query?: string): Promise<T[]> {
  return coletarPaginas<T>(endpoint, baseUrl, apiKey, query, MAX_PAGES);
}

// Só as primeiras `maxPaginas` — pra usos de AMOSTRA (ex.: dicionário de
// classificações), onde uma amostra representativa já basta e não vale a
// pena pagar o custo de esgotar todas as páginas do período inteiro.
async function coletarPaginas<T>(
  endpoint: string,
  baseUrl: string,
  apiKey: string,
  query: string | undefined,
  maxPaginas: number
): Promise<T[]> {
  const inicio = Date.now();
  const registros: T[] = [];
  let pagina = 1;
  while (pagina <= maxPaginas) {
    const params = new URLSearchParams({ pagina: String(pagina) });
    if (query) params.set('query', query);
    const url = `${baseUrl}/${endpoint}?${params.toString()}`;
    const lote = await fetchComRetry(url, apiKey);
    console.log(
      `[nomus] ${endpoint} pagina ${pagina}: +${Array.isArray(lote) ? lote.length : 0} (total ${registros.length + (Array.isArray(lote) ? lote.length : 0)}) — ${((Date.now() - inicio) / 1000).toFixed(1)}s decorridos`
    );
    if (!Array.isArray(lote) || lote.length === 0) break;
    registros.push(...(lote as T[]));
    if (lote.length < PAGE_SIZE) break;
    pagina += 1;
  }
  return registros;
}

// Formato exigido pela API para filtro de data: yyyy-mm-ddTHH:mm:ss (sem timezone).
function formatarDataNomus(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(
    d.getMinutes()
  )}:${pad(d.getSeconds())}`;
}

// "AAAA-MM" -> Date do dia 1 daquele mês (hora local). undefined se formato inválido.
function parseMesReferencia(mes: string): Date | undefined {
  const [anoStr, mesStr] = mes.split('-');
  const ano = Number(anoStr);
  const mesIndex = Number(mesStr) - 1;
  if (Number.isInteger(ano) && Number.isInteger(mesIndex) && mesIndex >= 0 && mesIndex <= 11) {
    return new Date(ano, mesIndex, 1);
  }
  return undefined;
}

// dataEmissao vem sempre à meia-noite (ex.: "29/07/2026 00:00:00"), então os
// limites usam ">"/"<" estritos um dia fora do intervalo pra incluir as bordas.
// mesReferencia (só usado quando periodo === 'mes') seleciona um mês específico
// no passado (ex.: Julho) em vez do mês corrente.
function periodoParaQuery(periodo: Periodo, mesReferencia?: Date): string {
  const hoje = new Date();
  const hojeInicioDoDia = new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate());

  let inicioDoPeriodo: Date;
  let fimDoPeriodo = hojeInicioDoDia;

  if (periodo === 'dia') {
    inicioDoPeriodo = hojeInicioDoDia;
  } else if (periodo === 'semana') {
    inicioDoPeriodo = new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate() - hoje.getDay());
  } else if (mesReferencia) {
    inicioDoPeriodo = new Date(mesReferencia.getFullYear(), mesReferencia.getMonth(), 1);
    const fimDoMesSelecionado = new Date(mesReferencia.getFullYear(), mesReferencia.getMonth() + 1, 0);
    fimDoPeriodo = fimDoMesSelecionado > hojeInicioDoDia ? hojeInicioDoDia : fimDoMesSelecionado;
  } else {
    inicioDoPeriodo = new Date(hoje.getFullYear(), hoje.getMonth(), 1);
  }

  const antesDoInicio = new Date(inicioDoPeriodo);
  antesDoInicio.setDate(antesDoInicio.getDate() - 1);
  antesDoInicio.setHours(23, 59, 59, 0);

  const depoisDoFim = new Date(fimDoPeriodo);
  depoisDoFim.setDate(depoisDoFim.getDate() + 1);
  depoisDoFim.setHours(0, 0, 0, 0);

  return `dataEmissao>${formatarDataNomus(antesDoInicio)};dataEmissao<${formatarDataNomus(depoisDoFim)}`;
}

interface CacheVendedores {
  atualizadoEm: number;
  vendedores: Vendedor[];
}

interface CachePedidos {
  atualizadoEm: number;
  pedidos: Pedido[];
}

// Cache em disco pro mesmo padrão do financeiro (ver ARQUIVO_CACHE_RESUMOS
// acima): sem isso, todo restart do servidor apagava vendedores/unidades/
// pedidos e o painel de vendas ficava sem NENHUM dado até reaquecer de novo
// (minutos, essa instância do Nomus é lenta/rate-limitada). Com o arquivo, o
// servidor sobe já servindo o último dado bom conhecido (na hora, sem esperar
// o Nomus) e decide sozinho, pelo atualizadoEm salvo, se dispara ou não uma
// atualização em segundo plano — mesma lógica de "stale-while-revalidate" que
// já existia em memória (ver `cacheado ?? await emAndamento` abaixo), só que
// agora ela sobrevive ao processo reiniciar.
const ARQUIVO_CACHE_VENDEDORES = path.join(PASTA_CACHE_DISCO, 'vendas-cache-vendedores.json');
const ARQUIVO_CACHE_UNIDADES = path.join(PASTA_CACHE_DISCO, 'vendas-cache-unidades.json');
const ARQUIVO_CACHE_PEDIDOS = path.join(PASTA_CACHE_DISCO, 'vendas-cache-pedidos.json');
const ARQUIVO_CACHE_FINANCEIRO_PEDIDOS = path.join(PASTA_CACHE_DISCO, 'vendas-cache-financeiro-pedidos.json');

// "dia"/"semana"/"mes" (mês corrente) são períodos RELATIVOS a hoje — um cache
// salvo ontem (ou na semana/mês passado) mostraria dado errado rotulado como
// "hoje" se o servidor ficou fora do ar até virar o dia/semana/mês. Só
// "mes:AAAA-MM" (mês específico, ex.: Julho) é um período absoluto e fixo no
// passado, então esse pode ficar em cache pra sempre até uma atualização real.
function chaveAindaRelevante(chave: string, atualizadoEm: number): boolean {
  if (chave.startsWith('mes:')) return true;

  const dataCache = new Date(atualizadoEm);
  const hoje = new Date();
  if (chave === 'dia') {
    return dataCache.toDateString() === hoje.toDateString();
  }
  if (chave === 'semana') {
    const inicioSemana = new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate() - hoje.getDay());
    return dataCache >= inicioSemana;
  }
  if (chave === 'mes') {
    return dataCache.getFullYear() === hoje.getFullYear() && dataCache.getMonth() === hoje.getMonth();
  }
  return true;
}

function carregarCacheVendedoresDoDisco(): CacheVendedores | null {
  try {
    return JSON.parse(readFileSync(ARQUIVO_CACHE_VENDEDORES, 'utf-8')) as CacheVendedores;
  } catch {
    return null;
  }
}

function persistirCacheVendedoresNoDisco(cache: CacheVendedores): void {
  try {
    mkdirSync(PASTA_CACHE_DISCO, { recursive: true });
    writeFileSync(ARQUIVO_CACHE_VENDEDORES, JSON.stringify(cache, null, 2), 'utf-8');
  } catch (err) {
    console.error('[nomus] falha ao persistir cache de vendedores no disco:', err);
  }
}

function carregarCacheUnidadesDoDisco(): { atualizadoEm: number; mapa: Map<number, string> } | null {
  try {
    const objeto = JSON.parse(readFileSync(ARQUIVO_CACHE_UNIDADES, 'utf-8')) as {
      atualizadoEm: number;
      entradas: [number, string][];
    };
    return { atualizadoEm: objeto.atualizadoEm, mapa: new Map(objeto.entradas) };
  } catch {
    return null;
  }
}

function persistirCacheUnidadesNoDisco(atualizadoEm: number, mapa: Map<number, string>): void {
  try {
    mkdirSync(PASTA_CACHE_DISCO, { recursive: true });
    writeFileSync(
      ARQUIVO_CACHE_UNIDADES,
      JSON.stringify({ atualizadoEm, entradas: Array.from(mapa.entries()) }, null, 2),
      'utf-8'
    );
  } catch (err) {
    console.error('[nomus] falha ao persistir cache de unidades de medida no disco:', err);
  }
}

function carregarCachePedidosDoDisco(): Map<string, CachePedidos> {
  try {
    const objeto = JSON.parse(readFileSync(ARQUIVO_CACHE_PEDIDOS, 'utf-8')) as Record<string, CachePedidos>;
    const mapa = new Map(Object.entries(objeto));

    // Migração do formato antigo: até agosto/2026 o mês corrente era salvo
    // apenas como "mes". Ao adotar a chave canônica "mes:AAAA-MM", preserve
    // esse último dado bom para que o primeiro acesso após o deploy responda
    // imediatamente e faça a atualização do Nomus em segundo plano.
    const legadoMesAtual = mapa.get('mes');
    if (legadoMesAtual) {
      const data = new Date(legadoMesAtual.atualizadoEm);
      const chaveCanonica = `mes:${data.getFullYear()}-${String(data.getMonth() + 1).padStart(2, '0')}`;
      const canonico = mapa.get(chaveCanonica);
      if (!canonico || canonico.atualizadoEm < legadoMesAtual.atualizadoEm) {
        mapa.set(chaveCanonica, legadoMesAtual);
      }
      mapa.delete('mes');
    }

    for (const [chave, valor] of mapa) {
      if (!chaveAindaRelevante(chave, valor.atualizadoEm)) mapa.delete(chave);
    }
    return mapa;
  } catch {
    return new Map();
  }
}

function persistirCachePedidosNoDisco(mapa: Map<string, CachePedidos>): void {
  try {
    mkdirSync(PASTA_CACHE_DISCO, { recursive: true });
    writeFileSync(ARQUIVO_CACHE_PEDIDOS, JSON.stringify(Object.fromEntries(mapa), null, 2), 'utf-8');
  } catch (err) {
    console.error('[nomus] falha ao persistir cache de pedidos de vendas no disco:', err);
  }
}

let cacheVendedores: CacheVendedores | null = carregarCacheVendedoresDoDisco();
let cacheVendedoresEmAndamento: Promise<CacheVendedores> | null = null;

// Chave inclui o mês quando um mês específico é selecionado (ex.: "mes:2026-07"),
// senão cai no período relativo puro ("dia"/"semana"/"mes" = mês corrente) —
// cada combinação fica em cache separado.
const cachePedidosPorPeriodo = carregarCachePedidosDoDisco();
const cachePedidosEmAndamento = new Map<string, Promise<CachePedidos>>();

interface FinanceiroPedidoRaw {
  id: number;
  descricaoLancamento?: string;
  saldoReceber?: string | number;
  valorReceber?: string | number;
  valorRecebido?: string | number;
}

interface CacheFinanceiroPedidos {
  atualizadoEm: number;
  contas: FinanceiroPedidoRaw[];
}

function carregarCacheFinanceiroPedidosDoDisco(): Map<string, CacheFinanceiroPedidos> {
  try {
    const objeto = JSON.parse(readFileSync(ARQUIVO_CACHE_FINANCEIRO_PEDIDOS, 'utf-8')) as Record<string, CacheFinanceiroPedidos>;
    const mapa = new Map(Object.entries(objeto));
    const legadoMesAtual = mapa.get('mes');
    if (legadoMesAtual) {
      const data = new Date(legadoMesAtual.atualizadoEm);
      const chaveCanonica = `mes:${data.getFullYear()}-${String(data.getMonth() + 1).padStart(2, '0')}`;
      const canonico = mapa.get(chaveCanonica);
      if (!canonico || canonico.atualizadoEm < legadoMesAtual.atualizadoEm) {
        mapa.set(chaveCanonica, legadoMesAtual);
      }
      mapa.delete('mes');
    }
    return mapa;
  } catch {
    return new Map();
  }
}

function persistirCacheFinanceiroPedidosNoDisco(mapa: Map<string, CacheFinanceiroPedidos>): void {
  try {
    mkdirSync(PASTA_CACHE_DISCO, { recursive: true });
    writeFileSync(ARQUIVO_CACHE_FINANCEIRO_PEDIDOS, JSON.stringify(Object.fromEntries(mapa), null, 2), 'utf-8');
  } catch (err) {
    console.error('[nomus] falha ao persistir cache financeiro dos pedidos:', err);
  }
}

const cacheFinanceiroPedidosPorPeriodo = carregarCacheFinanceiroPedidosDoDisco();
const cacheFinanceiroPedidosEmAndamento = new Map<string, Promise<CacheFinanceiroPedidos>>();

function chavePedidos(periodo: Periodo, mes?: string): string {
  if (periodo !== 'mes') return periodo;

  // O mês corrente chegava por dois caminhos diferentes:
  // - seletor "Mês atual": chave "mes"
  // - seletor explícito de agosto: chave "mes:2026-08"
  // Isso criava dois caches para o mesmo intervalo e permitia que a tela
  // continuasse exibindo o registro antigo enquanto o outro era atualizado.
  // Canonicaliza ambos para uma única chave mensal.
  const hoje = new Date();
  const mesAtual = `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, '0')}`;
  return `mes:${mes || mesAtual}`;
}

async function getVendedores(): Promise<Vendedor[]> {
  const agora = Date.now();
  if (cacheVendedores && agora - cacheVendedores.atualizadoEm < CACHE_TTL_MS) {
    return cacheVendedores.vendedores;
  }

  if (!cacheVendedoresEmAndamento) {
    const { baseUrl, apiKey } = getConfig();
    if (!baseUrl || !apiKey) {
      throw new Error('NOMUS_BASE_URL / NOMUS_API_KEY não configurados no .env');
    }
    cacheVendedoresEmAndamento = coletarTudo<Vendedor>('vendedores', baseUrl, apiKey)
      .then((vendedores) => {
        const novo = { atualizadoEm: Date.now(), vendedores };
        cacheVendedores = novo;
        persistirCacheVendedoresNoDisco(novo);
        return novo;
      })
      .finally(() => {
        cacheVendedoresEmAndamento = null;
      });
  }

  const resultado = cacheVendedores ?? (await cacheVendedoresEmAndamento);
  return resultado.vendedores;
}

let cacheUnidades: { atualizadoEm: number; mapa: Map<number, string> } | null = carregarCacheUnidadesDoDisco();
let cacheUnidadesEmAndamento: Promise<Map<number, string>> | null = null;

async function getUnidadesMedida(): Promise<Map<number, string>> {
  const agora = Date.now();
  if (cacheUnidades && agora - cacheUnidades.atualizadoEm < CACHE_TTL_MS) {
    return cacheUnidades.mapa;
  }

  if (!cacheUnidadesEmAndamento) {
    const { baseUrl, apiKey } = getConfig();
    if (!baseUrl || !apiKey) {
      throw new Error('NOMUS_BASE_URL / NOMUS_API_KEY não configurados no .env');
    }
    cacheUnidadesEmAndamento = coletarTudo<UnidadeMedida>('unidadesMedida', baseUrl, apiKey)
      .then((lista) => {
        const mapa = new Map(lista.map((u) => [u.id, u.simbolo || '']));
        const agoraAtualizado = Date.now();
        cacheUnidades = { atualizadoEm: agoraAtualizado, mapa };
        persistirCacheUnidadesNoDisco(agoraAtualizado, mapa);
        return mapa;
      })
      .finally(() => {
        cacheUnidadesEmAndamento = null;
      });
  }

  return cacheUnidades?.mapa ?? (await cacheUnidadesEmAndamento);
}

const ARQUIVO_CACHE_PRODUTOS = path.join(PASTA_CACHE_DISCO, 'vendas-cache-produtos.json');

function carregarCacheProdutosDoDisco(): Map<number, Produto | null> {
  try {
    const objeto = JSON.parse(readFileSync(ARQUIVO_CACHE_PRODUTOS, 'utf-8')) as Record<string, Produto>;
    return new Map(Object.entries(objeto).map(([id, produto]) => [Number(id), produto]));
  } catch {
    return new Map();
  }
}

// Só persiste os produtos resolvidos com sucesso — nunca os "null" (não
// encontrado/erro transitório), pra uma falha passageira do Nomus não virar
// um "produto inexistente" permanente sobrevivendo a um restart.
function persistirCacheProdutosNoDisco(mapa: Map<number, Produto | null>): void {
  try {
    mkdirSync(PASTA_CACHE_DISCO, { recursive: true });
    const soValidos = Object.fromEntries(Array.from(mapa.entries()).filter((entrada) => entrada[1] !== null));
    writeFileSync(ARQUIVO_CACHE_PRODUTOS, JSON.stringify(soValidos, null, 2), 'utf-8');
  } catch (err) {
    console.error('[nomus] falha ao persistir cache de produtos no disco:', err);
  }
}

// Catálogo de produtos pode ser grande — em vez de baixar tudo (como
// vendedores), resolve só os produtos que aparecem nos pedidos do período,
// um por vez, com cache (mesmo padrão de nome_do_vendedor no script Python).
// Nome de produto praticamente nunca muda, então fica em cache PRA SEMPRE e
// persiste em disco: sem isso, cada restart custava uma chamada individual
// ao Nomus por produto distinto do período (dezenas), cada uma sujeita a 429
// com esperas de 30-50s — no pior caso, minutos só pra montar "Vendas por Produto".
const cacheProdutoPorId = carregarCacheProdutosDoDisco();

async function getProdutoPorId(id: number): Promise<Produto | null> {
  if (cacheProdutoPorId.has(id)) return cacheProdutoPorId.get(id) ?? null;

  const { baseUrl, apiKey } = getConfig();
  if (!baseUrl || !apiKey) {
    throw new Error('NOMUS_BASE_URL / NOMUS_API_KEY não configurados no .env');
  }

  try {
    const produto = await fetchComRetry(`${baseUrl}/produtos/${id}`, apiKey);
    cacheProdutoPorId.set(id, produto);
    persistirCacheProdutosNoDisco(cacheProdutoPorId);
    return produto;
  } catch {
    cacheProdutoPorId.set(id, null);
    return null;
  }
}

// Um mês específico ("mes:AAAA-MM") só é "fechado" quando já não é mais o mês
// corrente — nesse caso o dado não muda mais, então fica FIXO em cache pra
// sempre (nunca mais dispara nem atualização em segundo plano). O mês
// corrente (seja via periodo="mes" puro ou um "mes:" igual ao de hoje)
// continua com o TTL normal, porque pedidos novos ainda podem entrar nele.
function periodoEhFechado(chave: string): boolean {
  if (!chave.startsWith('mes:')) return false;
  const hoje = new Date();
  const mesAtual = `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, '0')}`;
  return chave.slice(4) < mesAtual;
}

async function getPedidosDoPeriodo(periodo: Periodo, mes?: string): Promise<Pedido[]> {
  const chave = chavePedidos(periodo, mes);
  const agora = Date.now();
  const cacheado = cachePedidosPorPeriodo.get(chave);
  if (cacheado && (periodoEhFechado(chave) || agora - cacheado.atualizadoEm < CACHE_TTL_MS)) {
    return cacheado.pedidos;
  }

  let emAndamento = cachePedidosEmAndamento.get(chave);
  if (!emAndamento) {
    const { baseUrl, apiKey } = getConfig();
    if (!baseUrl || !apiKey) {
      throw new Error('NOMUS_BASE_URL / NOMUS_API_KEY não configurados no .env');
    }
    const mesReferencia = periodo === 'mes' && mes ? parseMesReferencia(mes) : undefined;
    const query = periodoParaQuery(periodo, mesReferencia);
    emAndamento = coletarTudo<Pedido>('pedidos', baseUrl, apiKey, query)
      .then((pedidos) => {
        const novo = { atualizadoEm: Date.now(), pedidos };
        cachePedidosPorPeriodo.set(chave, novo);
        persistirCachePedidosNoDisco(cachePedidosPorPeriodo);
        return novo;
      })
      .finally(() => {
        cachePedidosEmAndamento.delete(chave);
      });
    cachePedidosEmAndamento.set(chave, emAndamento);
  }

  const resultado = cacheado ?? (await emAndamento);
  return resultado.pedidos;
}

function dataEmissaoPedido(data?: string): Date | null {
  if (!data) return null;
  const [parteData] = data.split(' ');
  const [dia, mes, ano] = parteData.split('/').map(Number);
  return dia && mes && ano ? new Date(ano, mes - 1, dia) : null;
}

async function getFinanceiroDosPedidos(
  periodo: Periodo,
  mes: string | undefined,
  pedidos: Pedido[],
  aguardarPrimeiraConsulta = false
): Promise<{ contas: FinanceiroPedidoRaw[]; carregando: boolean }> {
  if (pedidos.length === 0) return { contas: [], carregando: false };
  const chave = chavePedidos(periodo, mes);
  const agora = Date.now();
  const cacheado = cacheFinanceiroPedidosPorPeriodo.get(chave);
  if (cacheado && agora - cacheado.atualizadoEm < CACHE_TTL_MS) {
    return { contas: cacheado.contas, carregando: false };
  }

  let emAndamento = cacheFinanceiroPedidosEmAndamento.get(chave);
  if (!emAndamento) {
    const { baseUrl, apiKey } = getConfig();
    if (!baseUrl || !apiKey) throw new Error('NOMUS_BASE_URL / NOMUS_API_KEY não configurados no .env');

    const datas = pedidos.map((pedido) => dataEmissaoPedido(pedido.dataEmissao)).filter((data): data is Date => data != null);
    if (datas.length === 0) return { contas: [], carregando: false };
    const inicio = new Date(Math.min(...datas.map((data) => data.getTime())));
    const fim = new Date(Math.max(...datas.map((data) => data.getTime())));
    const query = comFiltroEmpresa(intervaloQuery('dataCompetencia', inicio, fim));

    emAndamento = coletarTudo<FinanceiroPedidoRaw>('contasReceber', baseUrl, apiKey, query)
      .then((contas) => {
        const novo = { atualizadoEm: Date.now(), contas };
        cacheFinanceiroPedidosPorPeriodo.set(chave, novo);
        persistirCacheFinanceiroPedidosNoDisco(cacheFinanceiroPedidosPorPeriodo);
        return novo;
      })
      .catch((err) => {
        if (!cacheado) throw err;
        console.error(`[nomus] falha ao atualizar financeiro dos pedidos de ${chave}; mantendo cache anterior:`, err);
        return cacheado;
      })
      .finally(() => cacheFinanceiroPedidosEmAndamento.delete(chave));
    cacheFinanceiroPedidosEmAndamento.set(chave, emAndamento);
  }

  // A consulta de contas pode levar minutos por causa do rate limit do Nomus.
  // No carregamento normal, devolve imediatamente o cache disponível (ou
  // vazio na primeira vez) e deixa a varredura seguir em segundo plano.
  if (!aguardarPrimeiraConsulta) {
    if (!cacheado) {
      void emAndamento.catch((err) => console.error(`[nomus] falha ao carregar financeiro dos pedidos de ${chave}:`, err));
    }
    return { contas: cacheado?.contas ?? [], carregando: true };
  }

  const atualizado = cacheado ?? (await emAndamento);
  return { contas: atualizado.contas, carregando: false };
}

function chaveCodigoPedido(codigo?: string): string | null {
  const numero = codigo?.match(/\bPD\s*0*(\d+)\b/i)?.[1];
  return numero ? String(Number(numero)) : null;
}

function calcularRecebimentoDosPedidos(pedidos: Pedido[], contas: FinanceiroPedidoRaw[]): number {
  const codigos = new Set(pedidos.map((pedido) => chaveCodigoPedido(pedido.codigoPedido)).filter((codigo): codigo is string => codigo != null));
  return contas.reduce((total, conta) => {
    const codigo = chaveCodigoPedido(conta.descricaoLancamento);
    return codigo && codigos.has(codigo) ? total + Math.max(0, parseNum(conta.valorRecebido)) : total;
  }, 0);
}

export async function getRankingVendedores(
  periodo: Periodo,
  mes?: string
): Promise<{ ranking: VendedorRanking[]; atualizadoEm: string }> {
  const [vendedores, pedidos] = await Promise.all([getVendedores(), getPedidosDoPeriodo(periodo, mes)]);
  // O financeiro segue o mesmo padrão stale-while-revalidate: usa o último
  // cache disponível imediatamente e atualiza contas a receber em segundo
  // plano, sem segurar a renderização do ranking.
  const financeiro = await getFinanceiroDosPedidos(periodo, mes, pedidos);
  const mapaVendedor = new Map(vendedores.map((v) => [v.id, v.nome || `Vendedor #${v.id}`]));

  const grupos = new Map<string, Pedido[]>();
  for (const pedido of pedidos) {
    const nome =
      pedido.idPessoaVendedor != null
        ? mapaVendedor.get(pedido.idPessoaVendedor) || `Vendedor #${pedido.idPessoaVendedor}`
        : '(sem vendedor)';
    if (!grupos.has(nome)) grupos.set(nome, []);
    grupos.get(nome)!.push(pedido);
  }

  // Resolve uma única vez os produtos do período e identifica parafusos pela
  // descrição oficial do cadastro no Nomus. A busca não diferencia maiúsculas
  // e aceita singular/plural ("parafuso"/"parafusos").
  const idsProdutos = new Set<number>();
  for (const pedido of pedidos) {
    for (const item of pedido.itensPedido || []) {
      if (item.idProduto != null) idsProdutos.add(item.idProduto);
    }
  }
  const produtos = await Promise.all(
    Array.from(idsProdutos).map(async (id) => [id, await getProdutoPorId(id)] as const)
  );
  const idsParafusos = new Set(
    produtos
      .filter(([, produto]) => produto?.descricao?.toLocaleLowerCase('pt-BR').includes('parafuso'))
      .map(([id]) => id)
  );

  // Soma direto o "valorTotal" de cada pedido (campo pronto da API), sem
  // recalcular pelos itens — inclui TODOS os pedidos do período, não só os
  // que têm itens em aberto. Metros quadrados somam só os itens vendidos
  // na unidade M2 (chapas/placas); itens em outras unidades (kg, peça, etc.)
  // não entram nessa soma.
  const ranking: VendedorRanking[] = Array.from(grupos.entries()).map(([nome, peds]) => ({
    nome,
    pedidos: peds.length,
    valorTotal: peds.reduce((soma, p) => soma + parseNum(p.valorTotal), 0),
    metrosQuadrados: peds.reduce((soma, p) => soma + metrosQuadradosPedido(p), 0),
    pedidosParafusos: peds.filter((pedido) =>
      (pedido.itensPedido || []).some((item) => item.idProduto != null && idsParafusos.has(item.idProduto))
    ).length,
    quantidadeParafusos: peds.reduce(
      (total, pedido) => total + (pedido.itensPedido || [])
        .filter((item) => item.idProduto != null && idsParafusos.has(item.idProduto))
        .reduce((soma, item) => soma + parseNum(item.quantidade), 0),
      0
    ),
    valorParafusos: peds.reduce(
      (total, pedido) => total + (pedido.itensPedido || [])
        .filter((item) => item.idProduto != null && idsParafusos.has(item.idProduto))
        .reduce((soma, item) => soma + valorEstimadoItem(item), 0),
      0
    ),
    pedidosComFrete: peds.filter((pedido) => parseNum(pedido.valorTotalFrete) > 0).length,
    valorFrete: peds.reduce((soma, pedido) => soma + parseNum(pedido.valorTotalFrete), 0),
    ticketMedio: peds.length > 0
      ? peds.reduce((soma, pedido) => soma + parseNum(pedido.valorTotal), 0) / peds.length
      : 0,
    valorRecebido: calcularRecebimentoDosPedidos(peds, financeiro.contas),
  }));

  // Ordena por valor total desc, empate por nome asc.
  ranking.sort((a, b) => b.valorTotal - a.valorTotal || a.nome.localeCompare(b.nome));

  const atualizadoEm = Math.max(
    cacheVendedores?.atualizadoEm ?? 0,
    cachePedidosPorPeriodo.get(chavePedidos(periodo, mes))?.atualizadoEm ?? Date.now()
  );

  return { ranking, atualizadoEm: new Date(atualizadoEm).toISOString() };
}

// Agregação compartilhada por getResumoVendas (todos os pedidos do período)
// e getResumoVendasPorLoja (só os pedidos dos vendedores daquela loja) —
// mesmo cálculo, o que muda é só o subconjunto de pedidos recebido.
async function montarResumoDePedidos(
  pedidos: Pedido[],
  unidades: Map<number, string>,
  atualizadoEm: number,
  contasFinanceiras: FinanceiroPedidoRaw[] = [],
  financeiroPedidosCarregando = false
): Promise<ResumoVendas> {
  const totalVendas = pedidos.reduce((soma, p) => soma + parseNum(p.valorTotal), 0);
  const valorRecebidoPedidos = calcularRecebimentoDosPedidos(pedidos, contasFinanceiras);
  const valorPendentePedidos = Math.max(0, totalVendas - valorRecebidoPedidos);
  const totalPedidos = pedidos.length;
  const totalMetrosQuadrados = pedidos.reduce((soma, p) => soma + metrosQuadradosPedido(p), 0);
  const vendedoresAtivos = new Set(
    pedidos.map((p) => p.idPessoaVendedor).filter((id): id is number => id != null)
  ).size;

  // Agrupa por produto (não dá pra usar o valorTotal do pedido aqui, já que
  // um pedido pode ter vários produtos) — calcula o valor de cada item.
  const gruposProduto = new Map<number, { valor: number; quantidade: number; idUnidadeMedida?: number }>();
  for (const pedido of pedidos) {
    for (const item of pedido.itensPedido || []) {
      if (item.idProduto == null) continue;
      const atual = gruposProduto.get(item.idProduto) ?? {
        valor: 0,
        quantidade: 0,
        idUnidadeMedida: item.idUnidadeMedida,
      };
      atual.valor += valorEstimadoItem(item);
      atual.quantidade += parseNum(item.quantidade);
      gruposProduto.set(item.idProduto, atual);
    }
  }

  const todosOrdenados = Array.from(gruposProduto.entries()).sort((a, b) => b[1].valor - a[1].valor);

  // Resolve os nomes em paralelo (cada um já cacheado por id — ver
  // getProdutoPorId) em vez de um por vez, pra não somar a latência de rede
  // de dezenas de produtos distintos.
  const produtos: ProdutoRanking[] = await Promise.all(
    todosOrdenados.map(async ([idProduto, dados]) => {
      const produto = await getProdutoPorId(idProduto);
      return {
        nome: produto?.descricao || `Produto #${idProduto}`,
        valorTotal: dados.valor,
        quantidade: dados.quantidade,
        unidade: dados.idUnidadeMedida != null ? unidades.get(dados.idUnidadeMedida) || '' : '',
      };
    })
  );

  return {
    totalVendas,
    valorRecebidoPedidos,
    valorPendentePedidos,
    financeiroPedidosCarregando,
    totalPedidos,
    totalMetrosQuadrados,
    vendedoresAtivos,
    produtos,
    atualizadoEm: new Date(atualizadoEm).toISOString(),
  };
}

export async function getResumoVendas(periodo: Periodo, mes?: string, aguardarFinanceiro = false): Promise<ResumoVendas> {
  const [pedidos, unidades] = await Promise.all([getPedidosDoPeriodo(periodo, mes), getUnidadesMedida()]);
  const financeiro = await getFinanceiroDosPedidos(periodo, mes, pedidos, aguardarFinanceiro);
  const atualizadoEm = cachePedidosPorPeriodo.get(chavePedidos(periodo, mes))?.atualizadoEm ?? Date.now();
  return montarResumoDePedidos(pedidos, unidades, atualizadoEm, financeiro.contas, financeiro.carregando);
}

// Mesmo resumo de getResumoVendas, mas só com os pedidos dos vendedores
// vinculados a uma loja (ver src/data/vendedorLoja.ts) — pedido explícito
// da GFERRO pra ver as vendas de cada unidade separadamente.
export async function getResumoVendasPorLoja(periodo: Periodo, lojaId: string, mes?: string): Promise<ResumoVendas> {
  const [pedidos, unidades, vendedores] = await Promise.all([
    getPedidosDoPeriodo(periodo, mes),
    getUnidadesMedida(),
    getVendedores(),
  ]);
  const mapaVendedor = new Map(vendedores.map((v) => [v.id, v.nome || `Vendedor #${v.id}`]));
  const pedidosDaLoja = pedidos.filter((p) => {
    if (p.idPessoaVendedor == null) return false;
    const nome = mapaVendedor.get(p.idPessoaVendedor);
    return nome != null && lojaDoVendedor(nome) === lojaId;
  });
  const financeiro = await getFinanceiroDosPedidos(periodo, mes, pedidos);
  const atualizadoEm = cachePedidosPorPeriodo.get(chavePedidos(periodo, mes))?.atualizadoEm ?? Date.now();
  return montarResumoDePedidos(pedidosDaLoja, unidades, atualizadoEm, financeiro.contas, financeiro.carregando);
}

/** Atualização rápida usada pela tela de ranking: não espera produtos, unidades nem financeiro. */
export async function atualizarRankingVendas(
  periodo: Periodo,
  mes?: string
): Promise<{ ranking: VendedorRanking[]; atualizadoEm: string }> {
  const chave = chavePedidos(periodo, mes);
  const atualizacoesEmAndamento: Promise<unknown>[] = [];
  const pedidosEmAndamento = cachePedidosEmAndamento.get(chave);
  if (pedidosEmAndamento) atualizacoesEmAndamento.push(pedidosEmAndamento);
  if (cacheVendedoresEmAndamento) atualizacoesEmAndamento.push(cacheVendedoresEmAndamento);
  await Promise.allSettled(atualizacoesEmAndamento);

  cachePedidosPorPeriodo.delete(chave);
  cacheVendedores = null;
  return getRankingVendedores(periodo, mes);
}

/**
 * Descarta os caches compartilhados do módulo e só conclui depois de buscar
 * novamente os dados no Nomus. Diferentemente de recarregar a página, esta
 * operação ignora o TTL e também funciona para meses já encerrados.
 */
export async function atualizarDadosVendas(periodo: Periodo, mes?: string): Promise<{
  ranking: VendedorRanking[];
  resumo: ResumoVendas;
  atualizadoEm: string;
}> {
  const chave = chavePedidos(periodo, mes);

  // Se já houver uma consulta antiga em andamento, deixe-a terminar antes de
  // iniciar a atualização forçada para não reaproveitar aquela Promise.
  const atualizacoesEmAndamento: Promise<unknown>[] = [];
  const pedidosEmAndamento = cachePedidosEmAndamento.get(chave);
  if (pedidosEmAndamento) atualizacoesEmAndamento.push(pedidosEmAndamento);
  if (cacheVendedoresEmAndamento) atualizacoesEmAndamento.push(cacheVendedoresEmAndamento);
  if (cacheUnidadesEmAndamento) atualizacoesEmAndamento.push(cacheUnidadesEmAndamento);
  await Promise.allSettled(atualizacoesEmAndamento);

  cachePedidosPorPeriodo.delete(chave);
  cacheFinanceiroPedidosPorPeriodo.delete(chave);
  cacheVendedores = null;
  cacheUnidades = null;

  const [{ ranking, atualizadoEm }, resumo] = await Promise.all([
    getRankingVendedores(periodo, mes),
    getResumoVendas(periodo, mes, true),
  ]);

  return { ranking, resumo, atualizadoEm };
}

// ================== Financeiro (Contas a Pagar/Receber) ==================

interface ContaFinanceiraRaw {
  id: number;
  idPessoa?: number;
  nomePessoa?: string;
  classificacao?: string;
  nomeClassificacao?: string;
  dataVencimento: string;
  // Data em que a empresa programou pagar de fato — normalmente igual à
  // dataVencimento, mas pode ser adiada (ex.: fornecedor combinou pagar
  // depois do vencimento contratual). Contas a pagar usam essa data pro
  // calendário, não a dataVencimento (pedido da GFERRO).
  dataAgendamento?: string;
  dataCompetencia?: string;
  dataBaixa?: string;
  saldoReceber?: string | number;
  valorReceber?: string | number;
  // Valor efetivamente liquidado dessa conta — já vem positivo dos dois lados
  // (contasReceber E contasPagar), mesmo com valorReceber negativo em contasPagar.
  valorRecebido?: string | number;
  status: boolean; // true = já baixada/quitada
}

// GET /recebimentos — registro ATÔMICO de cada entrada de dinheiro (uma
// parcela, um PIX, uma baixa parcial), diferente de contasReceber (que é a
// conta como um todo, podendo levar várias baixas até quitar). É a fonte
// oficial de "dinheiro recebido" pedida pela GFERRO — nomeClassificacaoFinanceira
// já vem resolvido, sem precisar do catálogo estático em classificacoesFinanceiras.ts.
interface RecebimentoRaw {
  id: number;
  idPessoa?: number;
  nomePessoa?: string;
  idClassificacaoFinanceira?: number;
  nomeClassificacaoFinanceira?: string;
  dataRecebimento: string; // "DD/MM/AAAA HH:mm:ss"
  valorRecebido?: string | number;
}

// GET /pagamentos — mesma ideia de /recebimentos, do lado de contas a pagar:
// registro ATÔMICO de cada saída de dinheiro (uma parcela, um PIX), em vez
// da conta como um todo. Fonte oficial de "dinheiro pago" (Saiu do Caixa).
interface PagamentoRaw {
  id: number;
  idPessoa?: number;
  nomePessoa?: string;
  idClassificacaoFinanceira?: number;
  nomeClassificacaoFinanceira?: string;
  dataPagamento: string; // "DD/MM/AAAA HH:mm:ss"
  valorPago?: string | number;
}

const MESES_ABREV = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];

// "dd/mm/aaaa" ou "dd/mm/aaaa HH:mm:ss" -> Date local (formato BR usado em
// dataVencimento/dataCompetencia/dataRecebimento/dataPagamento).
function parseDataBrApi(data: string): Date {
  const [dataParte] = data.split(' ');
  const [dia, mes, ano] = dataParte.split('/').map(Number);
  return new Date(ano, mes - 1, dia);
}

function mesmoMes(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth();
}

// Mesmo truque de ">"/"<" um dia fora do intervalo que periodoParaQuery usa
// pra pedidos, só que genérico pra qualquer campo de data.
function intervaloQuery(campo: string, inicio: Date, fim: Date): string {
  const antesDoInicio = new Date(inicio);
  antesDoInicio.setDate(antesDoInicio.getDate() - 1);
  antesDoInicio.setHours(23, 59, 59, 0);

  const depoisDoFim = new Date(fim);
  depoisDoFim.setDate(depoisDoFim.getDate() + 1);
  depoisDoFim.setHours(0, 0, 0, 0);

  return `${campo}>${formatarDataNomus(antesDoInicio)};${campo}<${formatarDataNomus(depoisDoFim)}`;
}

function classificarStatusReceber(dataVencimento: Date, hoje0h: Date): 'Em Dia' | 'A Vencer' | 'Vencida' {
  const diffDias = Math.round((dataVencimento.getTime() - hoje0h.getTime()) / 86_400_000);
  if (diffDias < 0) return 'Vencida';
  if (diffDias <= 7) return 'A Vencer';
  return 'Em Dia';
}

function classificarStatusPagar(dataVencimento: Date, hoje0h: Date): 'Agendada' | 'A Vencer' | 'Vencida' {
  const diffDias = Math.round((dataVencimento.getTime() - hoje0h.getTime()) / 86_400_000);
  if (diffDias < 0) return 'Vencida';
  if (diffDias <= 7) return 'A Vencer';
  return 'Agendada';
}

// Tradução de código de classificação -> nome/grupo vem da tabela estática em
// src/data/classificacoesFinanceiras.ts (catálogo oficial passado pelo
// usuário), não mais de um "dicionário aprendido" via buscas extras no
// Nomus — isso removeu 4 varreduras paginadas do carregamento de cada mês.

interface CacheResumoFinanceiro {
  atualizadoEm: number;
  resumo: ResumoFinanceiro;
}

// O resumo financeiro é caro (5 varreduras paginadas) e essa API é
// compartilhada com outros apps da GFERRO (ver comentário no .env) — cache
// mais longo que o de vendas pra não martelar a instância a cada refresh de tela.
const CACHE_TTL_FINANCEIRO_MS = 10 * 60 * 1000;

// Meses de histórico pro fluxo de caixa (recebimentos/pagamentos reais).
// 3 meses já dá volume alto o suficiente pra essa GFERRO (centenas de
// lançamentos/mês) — 6 meses chegava a estourar a paginação e demorar minutos.
const MESES_FLUXO_CAIXA = 3;

// Uma entrada de cache por mês selecionado no filtro — trocar de mês custa uma
// varredura nova completa (a API não permite "saldo como estava em tal data"),
// então cada mês fica em cache separado por CACHE_TTL_FINANCEIRO_MS.
const cacheResumoFinanceiroPorMes = carregarCacheResumosDoDisco();
const cacheResumoFinanceiroEmAndamentoPorMes = new Map<string, Promise<CacheResumoFinanceiro>>();

function chaveMes(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

async function montarResumoFinanceiro(mesReferencia: Date): Promise<ResumoFinanceiro> {
  const { baseUrl, apiKey } = getConfig();
  if (!baseUrl || !apiKey) {
    throw new Error('NOMUS_BASE_URL / NOMUS_API_KEY não configurados no .env');
  }

  console.log(`[nomus] montando resumo financeiro de ${chaveMes(mesReferencia)}...`);
  const inicioResumo = Date.now();
  const hoje = new Date();
  const hoje0h = new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate());
  const inicioMesAtual = new Date(mesReferencia.getFullYear(), mesReferencia.getMonth(), 1);
  const inicioMesAnterior = new Date(mesReferencia.getFullYear(), mesReferencia.getMonth() - 1, 1);
  const inicioJanelaFluxoCaixa = new Date(
    mesReferencia.getFullYear(),
    mesReferencia.getMonth() - (MESES_FLUXO_CAIXA - 1),
    1
  );
  // Não faz sentido pedir além de hoje (mês selecionado pode ser o corrente,
  // parcial) nem além do último dia do mês selecionado (mês passado, fechado).
  const fimDoMesSelecionado = new Date(mesReferencia.getFullYear(), mesReferencia.getMonth() + 1, 0);
  const fimJanela = fimDoMesSelecionado > hoje ? hoje : fimDoMesSelecionado;

  // Sequencial, NÃO em paralelo: a instância do Nomus (compartilhada com
  // outros apps da GFERRO) esporadicamente devolve 400 em vez de 429 quando
  // recebe várias varreduras paginadas pesadas ao mesmo tempo — confirmado
  // testando isoladamente (cada request sozinho funciona, só falha sob carga
  // concorrente). Mais lento, mas confiável.
  const abertoReceber = await coletarTudo<ContaFinanceiraRaw>('contasReceber', baseUrl, apiKey, comFiltroEmpresa('status=false'));
  const abertoPagar = await coletarTudo<ContaFinanceiraRaw>('contasPagar', baseUrl, apiKey, comFiltroEmpresa('status=false'));
  const competenciaReceber = await coletarTudo<ContaFinanceiraRaw>(
    'contasReceber',
    baseUrl,
    apiKey,
    comFiltroEmpresa(intervaloQuery('dataCompetencia', inicioMesAnterior, fimJanela))
  );
  // Dinheiro RECEBIDO e PAGO (Entrou/Saiu do Caixa, fluxo de caixa): usa
  // /recebimentos e /pagamentos, não "dataBaixa" em contasReceber/contasPagar
  // — pedido explícito da GFERRO. São os registros ATÔMICOS de cada
  // movimentação (uma parcela, um PIX), então uma conta paga em 3 vezes
  // aparece como 3 lançamentos datados corretamente, em vez de uma baixa só
  // na conta inteira. TODA consulta filtra idEmpresa — essa instância do
  // Nomus é compartilhada com outra empresa ("Constelha").
  const recebimentos = await coletarTudo<RecebimentoRaw>(
    'recebimentos',
    baseUrl,
    apiKey,
    comFiltroEmpresa(intervaloQuery('dataRecebimento', inicioJanelaFluxoCaixa, fimJanela))
  );
  const pagamentos = await coletarTudo<PagamentoRaw>(
    'pagamentos',
    baseUrl,
    apiKey,
    comFiltroEmpresa(intervaloQuery('dataPagamento', inicioJanelaFluxoCaixa, fimJanela))
  );

  const contasReceber: ContaReceber[] = abertoReceber.map((c) => ({
    id: String(c.id),
    cliente: c.nomePessoa || `Cliente #${c.idPessoa ?? c.id}`,
    categoria:
      (c.classificacao && nomeClassificacaoFinanceira(c.classificacao)) ||
      c.nomeClassificacao ||
      c.classificacao ||
      'Sem classificação',
    grupo: c.classificacao ? grupoDaClassificacao(c.classificacao) : undefined,
    valor: parseNum(c.saldoReceber),
    vencimento: c.dataVencimento.split(' ')[0],
    status: classificarStatusReceber(parseDataBrApi(c.dataVencimento), hoje0h),
  }));

  const contasPagar: ContaPagar[] = abertoPagar.map((c) => {
    // Contas a pagar usam a data de AGENDAMENTO (quando a empresa programou
    // pagar de fato), não a de vencimento contratual — pedido explícito da
    // GFERRO. Cai pra dataVencimento só se a Nomus não trouxer agendamento.
    const dataBase = c.dataAgendamento || c.dataVencimento;
    return {
      id: String(c.id),
      fornecedor: c.nomePessoa || `Fornecedor #${c.idPessoa ?? c.id}`,
      categoria:
        (c.classificacao && nomeClassificacaoFinanceira(c.classificacao)) ||
        c.nomeClassificacao ||
        c.classificacao ||
        'Sem classificação',
      grupo: c.classificacao ? grupoDaClassificacao(c.classificacao) : undefined,
      // saldoReceber vem negativo em contas a pagar (é o mesmo campo da API pros dois tipos).
      valor: Math.abs(parseNum(c.saldoReceber)),
      vencimento: dataBase.split(' ')[0],
      status: classificarStatusPagar(parseDataBrApi(dataBase), hoje0h),
    };
  });

  // Reaproveita recebimentos/pagamentos (já buscados pra montar o fluxoCaixa
  // abaixo) filtrando só o mês selecionado — nenhuma chamada extra ao Nomus.
  const contasConcluidas: ContaConcluida[] = [
    ...recebimentos
      .filter((r) => mesmoMes(parseDataBrApi(r.dataRecebimento), inicioMesAtual))
      .map((r): ContaConcluida => ({
        id: String(r.id),
        tipo: 'receber',
        pessoa: r.nomePessoa || `Cliente #${r.idPessoa ?? r.id}`,
        categoria: r.nomeClassificacaoFinanceira || 'Sem classificação',
        grupo: r.nomeClassificacaoFinanceira ? grupoDaClassificacaoPorNome(r.nomeClassificacaoFinanceira) : undefined,
        valor: parseNum(r.valorRecebido),
        dataBaixa: r.dataRecebimento.split(' ')[0],
      })),
    ...pagamentos
      .filter((p) => mesmoMes(parseDataBrApi(p.dataPagamento), inicioMesAtual))
      .map((p): ContaConcluida => ({
        id: String(p.id),
        tipo: 'pagar',
        pessoa: p.nomePessoa || `Fornecedor #${p.idPessoa ?? p.id}`,
        categoria: p.nomeClassificacaoFinanceira || 'Sem classificação',
        grupo: p.nomeClassificacaoFinanceira ? grupoDaClassificacaoPorNome(p.nomeClassificacaoFinanceira) : undefined,
        valor: parseNum(p.valorPago),
        dataBaixa: p.dataPagamento.split(' ')[0],
      })),
  ];

  const totalReceber = contasReceber.reduce((soma, c) => soma + c.valor, 0);
  const totalPagar = contasPagar.reduce((soma, c) => soma + c.valor, 0);
  const valorVencidoReceber = contasReceber
    .filter((c) => c.status === 'Vencida')
    .reduce((soma, c) => soma + c.valor, 0);
  const inadimplencia = totalReceber > 0 ? (valorVencidoReceber / totalReceber) * 100 : 0;

  // Faturamento = valorReceber (não o saldo em aberto) de tudo que foi gerado
  // na competência do mês, recebido ou não — reconhecimento contábil da
  // receita, diferente do "totalReceber" acima (que é só o saldo pendente).
  let faturamentoMesAtual = 0;
  let faturamentoMesAnterior = 0;
  for (const c of competenciaReceber) {
    if (!c.dataCompetencia) continue;
    const competencia = parseDataBrApi(c.dataCompetencia);
    const valor = parseNum(c.valorReceber);
    if (mesmoMes(competencia, inicioMesAtual)) faturamentoMesAtual += valor;
    else if (mesmoMes(competencia, inicioMesAnterior)) faturamentoMesAnterior += valor;
  }
  const variacaoFaturamento =
    faturamentoMesAnterior > 0 ? ((faturamentoMesAtual - faturamentoMesAnterior) / faturamentoMesAnterior) * 100 : 0;

  const fluxoCaixa: FluxoCaixaMes[] = [];
  for (let i = MESES_FLUXO_CAIXA - 1; i >= 0; i--) {
    const refMes = new Date(mesReferencia.getFullYear(), mesReferencia.getMonth() - i, 1);
    const receitas = recebimentos
      .filter((r) => mesmoMes(parseDataBrApi(r.dataRecebimento), refMes))
      .reduce((soma, r) => soma + parseNum(r.valorRecebido), 0);
    const despesas = pagamentos
      .filter((p) => mesmoMes(parseDataBrApi(p.dataPagamento), refMes))
      .reduce((soma, p) => soma + parseNum(p.valorPago), 0);
    fluxoCaixa.push({ mes: MESES_ABREV[refMes.getMonth()], receitas, despesas });
  }

  // Recebido - Pago do mês corrente (último item do fluxoCaixa) — movimentação
  // de caixa real, NÃO o saldo bancário (o Nomus não expõe saldo de conta
  // bancária via API, só o cadastro da conta em /contasBancarias).
  const mesCorrente = fluxoCaixa[fluxoCaixa.length - 1];
  const saldoMes = mesCorrente.receitas - mesCorrente.despesas;

  console.log(`[nomus] resumo de ${chaveMes(mesReferencia)} pronto em ${((Date.now() - inicioResumo) / 1000).toFixed(1)}s`);
  return {
    mesReferencia: chaveMes(mesReferencia),
    faturamentoMes: faturamentoMesAtual,
    variacaoFaturamento,
    totalReceber,
    totalPagar,
    saldoMes,
    valorVencidoReceber,
    inadimplencia,
    fluxoCaixa,
    contasReceber,
    contasPagar,
    contasConcluidas,
    atualizadoEm: new Date().toISOString(),
  };
}

// mes: "AAAA-MM" — omitido cai no mês corrente.
//
// Stale-while-revalidate: uma vez que um mês foi buscado ao menos uma vez,
// o cache dele nunca mais é descartado — CACHE_TTL_FINANCEIRO_MS só decide
// quando ele vira "velho" e dispara uma atualização em SEGUNDO PLANO (sem
// bloquear quem pediu). Assim a tela sempre tem algum dado pra mostrar; só a
// toda primeira consulta de um mês nunca visto antes precisa esperar de
// verdade a varredura completa no Nomus.
async function getResumoFinanceiroCacheado(mes?: string): Promise<ResumoFinanceiro> {
  const hoje = new Date();
  let mesReferencia = new Date(hoje.getFullYear(), hoje.getMonth(), 1);
  if (mes) {
    mesReferencia = parseMesReferencia(mes) ?? mesReferencia;
  }
  const chave = chaveMes(mesReferencia);

  const cacheado = cacheResumoFinanceiroPorMes.get(chave);
  if (cacheado) {
    const desatualizado = Date.now() - cacheado.atualizadoEm >= CACHE_TTL_FINANCEIRO_MS;
    if (desatualizado && !cacheResumoFinanceiroEmAndamentoPorMes.has(chave)) {
      const atualizacao = montarResumoFinanceiro(mesReferencia)
        .then((resumo) => {
          const novo = { atualizadoEm: Date.now(), resumo };
          cacheResumoFinanceiroPorMes.set(chave, novo);
          persistirCacheResumosNoDisco(cacheResumoFinanceiroPorMes);
          return novo;
        })
        .catch((err) => {
          // Falhou a atualização em segundo plano — mantém o dado velho no
          // cache (é melhor que sumir da tela) e tenta de novo na próxima vez.
          console.error(`Erro ao atualizar resumo financeiro de ${chave} em segundo plano:`, err);
          return cacheado;
        })
        .finally(() => {
          cacheResumoFinanceiroEmAndamentoPorMes.delete(chave);
        });
      cacheResumoFinanceiroEmAndamentoPorMes.set(chave, atualizacao);
    }
    return cacheado.resumo;
  }

  // Nada em cache ainda pra esse mês — não tem o que devolver de imediato.
  let emAndamento = cacheResumoFinanceiroEmAndamentoPorMes.get(chave);
  if (!emAndamento) {
    emAndamento = montarResumoFinanceiro(mesReferencia)
      .then((resumo) => {
        const novo = { atualizadoEm: Date.now(), resumo };
        cacheResumoFinanceiroPorMes.set(chave, novo);
        persistirCacheResumosNoDisco(cacheResumoFinanceiroPorMes);
        return novo;
      })
      .finally(() => {
        cacheResumoFinanceiroEmAndamentoPorMes.delete(chave);
      });
    cacheResumoFinanceiroEmAndamentoPorMes.set(chave, emAndamento);
  }

  const resultado = cacheResumoFinanceiroPorMes.get(chave) ?? (await emAndamento);
  return resultado.resumo;
}

// Camada de replanejamento local é aplicada FORA do cache do Nomus, sempre na
// hora — assim mover uma conta pro calendário reflete no próximo GET, sem
// precisar esperar o cache do Nomus expirar (10 min) ou forçar uma nova
// varredura cara só por causa de um replanejamento (que é 100% local).
export async function getResumoFinanceiro(mes?: string): Promise<ResumoFinanceiro> {
  const resumo = await getResumoFinanceiroCacheado(mes);
  const [contasReceber, contasPagar] = await Promise.all([
    aplicarReprogramacoes(resumo.contasReceber, 'receber'),
    aplicarReprogramacoes(resumo.contasPagar, 'pagar'),
  ]);
  return { ...resumo, contasReceber, contasPagar };
}

const cacheDrePorMes = carregarCacheDreDoDisco();
const cacheDreEmAndamentoPorMes = new Map<string, Promise<CacheDreFinanceira>>();

async function montarDreFinanceira(referencia: Date): Promise<DreFinanceira> {
  const chave = chaveMes(referencia);
  const { baseUrl, apiKey } = getConfig();
  if (!baseUrl || !apiKey) throw new Error('NOMUS_BASE_URL / NOMUS_API_KEY não configurados no .env');

  const inicio = new Date(referencia.getFullYear(), referencia.getMonth(), 1);
  const fim = new Date(referencia.getFullYear(), referencia.getMonth() + 1, 0);
  const porCompetencia = comFiltroEmpresa(intervaloQuery('dataCompetencia', inicio, fim));

  // Duas varreduras por competência são suficientes: valorReceber é o total
  // programado e valorRecebido é quanto dessa mesma competência já foi
  // efetivamente liquidado. Além de conceitualmente mais próximo de uma DRE,
  // isso evita outras duas varreduras pesadas em recebimentos/pagamentos.
  const contasReceber = await coletarTudo<ContaFinanceiraRaw>('contasReceber', baseUrl, apiKey, porCompetencia);
  const contasPagar = await coletarTudo<ContaFinanceiraRaw>('contasPagar', baseUrl, apiKey, porCompetencia);

  const valores = new Map<string, { programado: number; realizado: number }>();
  const contas = new Map<string, DreConta>();
  const somar = (codigo: string | undefined, nome: string | undefined, campo: 'programado' | 'realizado', valor: number) => {
    const codigoGrupo = codigo?.split('.')[0];
    if (!codigo || !codigoGrupo || !GRUPOS_CLASSIFICACAO_FINANCEIRA[codigoGrupo]) return;
    const valorAbsoluto = Math.abs(valor);
    const atual = valores.get(codigoGrupo) || { programado: 0, realizado: 0 };
    atual[campo] += valorAbsoluto;
    valores.set(codigoGrupo, atual);

    const conta = contas.get(codigo) || {
      codigo,
      nome: nome || CLASSIFICACOES_FINANCEIRAS[codigo] || 'Sem classificação',
      programado: 0,
      realizado: 0,
    };
    conta[campo] += valorAbsoluto;
    contas.set(codigo, conta);
  };

  for (const conta of [...contasReceber, ...contasPagar]) {
    somar(conta.classificacao, conta.nomeClassificacao, 'programado', parseNum(conta.valorReceber));
    somar(conta.classificacao, conta.nomeClassificacao, 'realizado', parseNum(conta.valorRecebido));
  }

  const linhas: DreLinha[] = Object.entries(GRUPOS_CLASSIFICACAO_FINANCEIRA)
    .map(([codigoGrupo, grupo]) => ({
      codigoGrupo,
      grupo,
      ...(valores.get(codigoGrupo) || { programado: 0, realizado: 0 }),
      contas: [...contas.values()]
        .filter((conta) => conta.codigo.split('.')[0] === codigoGrupo)
        .sort((a, b) => a.codigo.localeCompare(b.codigo, 'pt-BR', { numeric: true })),
    }))
    .filter((linha) => linha.programado !== 0 || linha.realizado !== 0);
  return { versao: 2, mesReferencia: chave, linhas, atualizadoEm: new Date().toISOString() };
}

export async function getDreFinanceira(mes?: string): Promise<DreFinanceira> {
  const hoje = new Date();
  const referencia = (mes && parseMesReferencia(mes)) || new Date(hoje.getFullYear(), hoje.getMonth(), 1);
  const chave = chaveMes(referencia);
  const cacheado = cacheDrePorMes.get(chave);

  // Stale-while-revalidate: responde imediatamente com o último dado bom,
  // mesmo após reiniciar o servidor, e atualiza o Nomus sem bloquear a tela.
  if (cacheado) {
    const possuiDetalhamento = cacheado.dre.versao === 2 && cacheado.dre.linhas.every((linha) => Array.isArray(linha.contas));
    const desatualizado = !possuiDetalhamento || Date.now() - cacheado.atualizadoEm >= CACHE_TTL_FINANCEIRO_MS;
    if (desatualizado && !cacheDreEmAndamentoPorMes.has(chave)) {
      const atualizacao = montarDreFinanceira(referencia)
        .then((dre) => {
          const novo = { atualizadoEm: Date.now(), dre };
          cacheDrePorMes.set(chave, novo);
          persistirCacheDreNoDisco(cacheDrePorMes);
          return novo;
        })
        .catch((err) => {
          console.error(`Erro ao atualizar DRE de ${chave} em segundo plano:`, err);
          return cacheado;
        })
        .finally(() => cacheDreEmAndamentoPorMes.delete(chave));
      cacheDreEmAndamentoPorMes.set(chave, atualizacao);
    }
    return cacheado.dre;
  }

  // Só a primeira consulta de um mês ainda nunca armazenado precisa aguardar.
  let emAndamento = cacheDreEmAndamentoPorMes.get(chave);
  if (!emAndamento) {
    emAndamento = montarDreFinanceira(referencia)
      .then((dre) => {
        const novo = { atualizadoEm: Date.now(), dre };
        cacheDrePorMes.set(chave, novo);
        persistirCacheDreNoDisco(cacheDrePorMes);
        return novo;
      })
      .finally(() => cacheDreEmAndamentoPorMes.delete(chave));
    cacheDreEmAndamentoPorMes.set(chave, emAndamento);
  }
  return (await emAndamento).dre;
}
