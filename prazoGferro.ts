// Prazo de entrega GFERRO: o prazo de entrega que aparece na tela "Controle de pedidos"
// do PCP (sistema Gferro-PCP), combinado com o cliente. Nasce do prazo do Nomus + margem
// de produção e o PCP pode ajustar, por isso difere do prazo dos itens do pedido no Nomus.
//
// Fonte principal: GET /api/pedidos do PCP, a mesma lista da tela, com todos os pedidos de
// uma vez. Se o PCP tiver ACCESS_TOKEN, defina PCP_TOKEN aqui com o código dele; se não
// tiver, não precisa de nada. A resposta traz nome e telefone de clientes: só o número e o
// prazo são guardados.
//
// Se a lista não responder, e para pedidos que ela não tem: a consulta pública do PCP
// (GET /api/publico/pedido?pedido=N), que devolve o mesmo prazo, um pedido por vez, com
// limite de 60 consultas por minuto por IP. Essas consultas rodam em segundo plano, uma a
// uma, e o resultado fica em memória e em disco (data/prazo-gferro.json).

import { mkdir, readFile, writeFile } from 'fs/promises';
import path from 'path';
import type { PedidoLojaLinha } from './src/pedidosLoja';

const PCP_URL = (process.env.PCP_URL || 'https://pcp-pcp.matojc.easypanel.host').replace(/\/+$/, '');
const PCP_TOKEN = (process.env.PCP_TOKEN || '').trim();
const ARQUIVO = path.join(process.cwd(), 'data', 'prazo-gferro.json');

const TTL_LISTA_MS = 5 * 60_000;
const TIMEOUT_LISTA_MS = 60_000;

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

// ---- Lista de pedidos do PCP (fonte principal) ----

let listaPcp: { prazos: Map<number, string | null>; carregadoEm: number } | null = null;
let carregandoLista: Promise<void> | null = null;

async function lerListaPcp(): Promise<void> {
  try {
    // finalizados=1 + antigos=1: sem isso o PCP esconde pedidos finalizados e muito atrasados.
    const resposta = await fetch(`${PCP_URL}/api/pedidos?finalizados=1&antigos=1`, {
      headers: PCP_TOKEN ? { 'x-pcp-token': PCP_TOKEN } : {}, // PCP sem ACCESS_TOKEN não pede código
      signal: AbortSignal.timeout(TIMEOUT_LISTA_MS),
    });
    if (!resposta.ok) throw new Error(`HTTP ${resposta.status}`);
    const dados: any = await resposta.json();
    if (!Array.isArray(dados?.pedidos)) throw new Error('resposta sem pedidos');
    const prazos = new Map<number, string | null>();
    for (const pedido of dados.pedidos) {
      const numero = Number(pedido?.numero);
      if (!numero) continue;
      prazos.set(numero, /^\d{4}-\d{2}-\d{2}$/.test(pedido.prazoEntrega ?? '') ? pedido.prazoEntrega : null);
    }
    listaPcp = { prazos, carregadoEm: Date.now() };
  } catch (e: any) {
    console.error('Não foi possível ler a lista de pedidos do PCP:', e.message);
    if (listaPcp) listaPcp.carregadoEm = Date.now() - TTL_LISTA_MS + REPETIR_APOS_FALHA_MS; // mantém a última leitura e tenta de novo em breve
  } finally {
    carregandoLista = null;
  }
}

// Espera a primeira leitura; depois serve a anterior e atualiza em segundo plano.
async function prazosDaLista(): Promise<Map<number, string | null> | null> {
  const vencida = !listaPcp || Date.now() - listaPcp.carregadoEm > TTL_LISTA_MS;
  if (vencida && !carregandoLista) carregandoLista = lerListaPcp();
  if (!listaPcp) await carregandoLista;
  return listaPcp?.prazos ?? null;
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
  const daLista = await prazosDaLista();
  const agora = Date.now();
  const resultado = linhas.map((linha): PedidoLojaLinha => {
    if (linha.situacao === 'cancelado') return { ...linha, prazoGferro: null, prazoGferroPendente: false };
    const numero = numeroDoPedido(linha.codigo);
    if (numero === null) return { ...linha, prazoGferro: null, prazoGferroPendente: false };
    if (daLista?.has(numero)) return { ...linha, prazoGferro: daLista.get(numero) ?? null, prazoGferroPendente: false };
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
