// Prazo de entrega GFERRO: a data que o PCP (sistema Gferro-PCP) combinou com o
// cliente. Nasce do prazo do Nomus + margem de produção e pode ser negociado pelo PCP,
// por isso é diferente do prazo que vem dos itens do pedido no Nomus.
//
// Fonte principal: a Programação do PCP, GET /api/programacao, que traz o prazo vigente
// (negociado, ou o original quando não há negociação) de todos os pedidos de uma vez — o
// mesmo que a tela do PCP mostra. Se o PCP tiver ACCESS_TOKEN, defina PCP_TOKEN aqui com
// o código de perfil "consulta" (somente leitura) dele; se não tiver, não precisa de nada.
//
// Se a Programação não responder, e para pedidos que ela não tem: a consulta pública do PCP
// (GET /api/publico/pedido?pedido=N), que não exige código e devolve só o prazo. Ela
// aceita 60 consultas por minuto por IP e um pedido por vez, então as consultas rodam em
// segundo plano, uma a uma, e o resultado fica guardado em memória e em disco
// (data/prazo-gferro.json).

import { mkdir, readFile, writeFile } from 'fs/promises';
import path from 'path';
import type { PedidoLojaLinha } from './src/pedidosLoja';

const PCP_URL = (process.env.PCP_URL || 'https://pcp-pcp.matojc.easypanel.host').replace(/\/+$/, '');
const PCP_TOKEN = (process.env.PCP_TOKEN || '').trim();
const ARQUIVO = path.join(process.cwd(), 'data', 'prazo-gferro.json');

const TTL_PROGRAMACAO_MS = 5 * 60_000;
const TIMEOUT_PROGRAMACAO_MS = 60_000;

const TTL_COM_PRAZO_MS = 30 * 60_000; // prazo mudou no PCP? relê a cada 30 min
const TTL_SEM_PRAZO_MS = 10 * 60_000; // pedido ainda não entrou no PCP: tenta de novo logo
const REPETIR_APOS_FALHA_MS = 2 * 60_000;
const INTERVALO_ENTRE_CONSULTAS_MS = 1300; // ~46 por minuto, abaixo do limite de 60
const ESPERA_AO_LIMITAR_MS = 61_000;
const TIMEOUT_CONSULTA_MS = 15_000;

interface Entrada {
  prazo: string | null; // aaaa-mm-dd; null = o PCP não tem esse pedido ou ele está sem prazo
  consultadoEm: number;
}

let cache: Map<number, Entrada> | null = null;
const fila: number[] = [];
const naFila = new Set<number>();
const falhouAte = new Map<number, number>();
let processando = false;

async function carregar(): Promise<Map<number, Entrada>> {
  if (cache) return cache;
  cache = new Map();
  try {
    const dados = JSON.parse(await readFile(ARQUIVO, 'utf-8'));
    for (const [numero, entrada] of Object.entries(dados ?? {}) as Array<[string, Entrada]>) {
      if (entrada && typeof entrada.consultadoEm === 'number') cache.set(Number(numero), { prazo: entrada.prazo ?? null, consultadoEm: entrada.consultadoEm });
    }
  } catch {
    // sem arquivo ainda: começa vazio
  }
  return cache;
}

async function persistir(): Promise<void> {
  try {
    await mkdir(path.dirname(ARQUIVO), { recursive: true });
    await writeFile(ARQUIVO, JSON.stringify(Object.fromEntries(cache ?? [])), 'utf-8');
  } catch (e: any) {
    console.error('Não foi possível salvar o cache do prazo Gferro:', e.message);
  }
}

// "PD 02208" -> 2208
export function numeroDoPedido(codigo: string): number | null {
  const digitos = codigo.replace(/\D/g, '');
  if (!digitos || digitos.length > 9) return null;
  const numero = Number(digitos);
  return numero > 0 ? numero : null;
}

function brParaIso(texto: unknown): string | null {
  const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(typeof texto === 'string' ? texto.trim() : '');
  return m ? `${m[3]}-${m[2]}-${m[1]}` : null;
}

type Resultado = { tipo: 'ok'; prazo: string | null } | { tipo: 'limitado' } | { tipo: 'falha' };

async function consultar(numero: number): Promise<Resultado> {
  try {
    const resposta = await fetch(`${PCP_URL}/api/publico/pedido?pedido=${numero}`, { signal: AbortSignal.timeout(TIMEOUT_CONSULTA_MS) });
    if (resposta.status === 429) return { tipo: 'limitado' };
    if (!resposta.ok) return { tipo: 'falha' };
    const dados: any = await resposta.json();
    if (dados?.success === true) return { tipo: 'ok', prazo: brParaIso(dados.prazo) };
    if (typeof dados?.message === 'string' && /muitas consultas/i.test(dados.message)) return { tipo: 'limitado' };
    return { tipo: 'ok', prazo: null }; // "Confira o número do pedido": o PCP não conhece o pedido
  } catch {
    return { tipo: 'falha' };
  }
}

const esperar = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function processarFila(): Promise<void> {
  if (processando) return;
  processando = true;
  try {
    const entradas = await carregar();
    while (fila.length > 0) {
      const numero = fila[0];
      const resultado = await consultar(numero);
      if (resultado.tipo === 'limitado') {
        await esperar(ESPERA_AO_LIMITAR_MS); // mantém o pedido na frente da fila e tenta de novo
        continue;
      }
      fila.shift();
      naFila.delete(numero);
      if (resultado.tipo === 'ok') {
        entradas.set(numero, { prazo: resultado.prazo, consultadoEm: Date.now() });
        falhouAte.delete(numero);
      } else {
        falhouAte.set(numero, Date.now() + REPETIR_APOS_FALHA_MS);
      }
      if (fila.length > 0) await esperar(INTERVALO_ENTRE_CONSULTAS_MS);
    }
    await persistir();
  } finally {
    processando = false;
    if (fila.length > 0) void processarFila();
  }
}

// ---- Programação do PCP (fonte principal) ----

let programacao: { prazos: Map<number, string | null>; carregadoEm: number } | null = null;
let carregandoProgramacao: Promise<void> | null = null;

async function lerProgramacao(): Promise<void> {
  try {
    // visao=todos + antigos=1: sem isso o PCP esconde pedidos finalizados e muito atrasados.
    const resposta = await fetch(`${PCP_URL}/api/programacao?visao=todos&antigos=1`, {
      headers: PCP_TOKEN ? { 'x-pcp-token': PCP_TOKEN } : {}, // PCP sem ACCESS_TOKEN não pede código
      signal: AbortSignal.timeout(TIMEOUT_PROGRAMACAO_MS),
    });
    if (!resposta.ok) throw new Error(`HTTP ${resposta.status}`);
    const dados: any = await resposta.json();
    if (!Array.isArray(dados?.itens)) throw new Error('resposta sem itens');
    const prazos = new Map<number, string | null>();
    for (const item of dados.itens) {
      const numero = Number(item?.numeroPedido);
      if (!numero || prazos.has(numero)) continue; // o prazo é do pedido: todos os itens trazem o mesmo
      prazos.set(numero, /^\d{4}-\d{2}-\d{2}$/.test(item.prazoVigente ?? '') ? item.prazoVigente : null);
    }
    programacao = { prazos, carregadoEm: Date.now() };
  } catch (e: any) {
    console.error('Não foi possível ler a Programação do PCP:', e.message);
    if (programacao) programacao.carregadoEm = Date.now() - TTL_PROGRAMACAO_MS + REPETIR_APOS_FALHA_MS; // mantém a última leitura e tenta de novo em breve
  } finally {
    carregandoProgramacao = null;
  }
}

// Espera a primeira leitura; depois serve a anterior e atualiza em segundo plano.
async function prazosDaProgramacao(): Promise<Map<number, string | null> | null> {
  const vencida = !programacao || Date.now() - programacao.carregadoEm > TTL_PROGRAMACAO_MS;
  if (vencida && !carregandoProgramacao) carregandoProgramacao = lerProgramacao();
  if (!programacao) await carregandoProgramacao;
  return programacao?.prazos ?? null;
}

function precisaConsultar(numero: number, entrada: Entrada | undefined, agora: number): boolean {
  if (naFila.has(numero) || (falhouAte.get(numero) ?? 0) > agora) return false;
  if (!entrada) return true;
  return agora - entrada.consultadoEm > (entrada.prazo ? TTL_COM_PRAZO_MS : TTL_SEM_PRAZO_MS);
}

/**
 * Preenche o prazo Gferro de cada linha com o que já está guardado e agenda, em segundo
 * plano, a consulta do que falta ou venceu. Não espera o PCP: `prazoGferroPendente` marca
 * as linhas ainda sem resposta (a tela pergunta de novo em alguns segundos).
 */
export async function anexarPrazoGferro(linhas: PedidoLojaLinha[]): Promise<PedidoLojaLinha[]> {
  const entradas = await carregar();
  const daProgramacao = await prazosDaProgramacao();
  const agora = Date.now();
  const resultado = linhas.map((linha): PedidoLojaLinha => {
    if (linha.situacao === 'cancelado') return { ...linha, prazoGferro: null, prazoGferroPendente: false };
    const numero = numeroDoPedido(linha.codigo);
    if (numero === null) return { ...linha, prazoGferro: null, prazoGferroPendente: false };
    if (daProgramacao?.has(numero)) return { ...linha, prazoGferro: daProgramacao.get(numero) ?? null, prazoGferroPendente: false };
    const entrada = entradas.get(numero);
    if (precisaConsultar(numero, entrada, agora)) {
      fila.push(numero);
      naFila.add(numero);
    }
    return { ...linha, prazoGferro: entrada?.prazo ?? null, prazoGferroPendente: !entrada };
  });
  void processarFila();
  return resultado;
}
