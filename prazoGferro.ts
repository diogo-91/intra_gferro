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

/** O que o PCP sabe de um pedido (tela "Controle de pedidos"). */
export interface DadosPcp {
  prazo: string | null; // aaaa-mm-dd
  cliente: string;
  status: string; // status do PCP, ex.: "PEDIDO LIBERADO"
}

let listaPcp: { pedidos: Map<number, DadosPcp>; carregadoEm: number } | null = null;
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
    const pedidos = new Map<number, DadosPcp>();
    for (const pedido of dados.pedidos) {
      const numero = Number(pedido?.numero);
      if (!numero) continue;
      pedidos.set(numero, {
        prazo: /^\d{4}-\d{2}-\d{2}$/.test(pedido.prazoEntrega ?? '') ? pedido.prazoEntrega : null,
        cliente: typeof pedido.clienteNome === 'string' ? pedido.clienteNome.trim() : '',
        status: typeof pedido.statusPcp === 'string' ? pedido.statusPcp.trim() : '',
      });
    }
    listaPcp = { pedidos, carregadoEm: Date.now() };
  } catch (e: any) {
    console.error('Não foi possível ler a lista de pedidos do PCP:', e.message);
    if (listaPcp) listaPcp.carregadoEm = Date.now() - TTL_LISTA_MS + REPETIR_APOS_FALHA_MS; // mantém a última leitura e tenta de novo em breve
  } finally {
    carregandoLista = null;
  }
}

// Espera a primeira leitura; depois serve a anterior e atualiza em segundo plano.
export async function obterDadosPcp(): Promise<Map<number, DadosPcp> | null> {
  const vencida = !listaPcp || Date.now() - listaPcp.carregadoEm > TTL_LISTA_MS;
  if (vencida && !carregandoLista) carregandoLista = lerListaPcp();
  if (!listaPcp) await carregandoLista;
  return listaPcp?.pedidos ?? null;
}

// ---- Entregas na Programação do PCP ----

/** Itens de um pedido na Programação do PCP (onde a equipe marca Entregue/Cancelado). */
export interface ItensPcp {
  total: number;
  abertos: number; // ainda não entregues nem cancelados
  entregues: number;
}

let programacaoPcp: { pedidos: Map<number, ItensPcp>; carregadoEm: number } | null = null;
let carregandoProgramacao: Promise<void> | null = null;

async function lerProgramacaoPcp(): Promise<void> {
  try {
    const resposta = await fetch(`${PCP_URL}/api/programacao?visao=todos&antigos=1`, {
      headers: PCP_TOKEN ? { 'x-pcp-token': PCP_TOKEN } : {},
      signal: AbortSignal.timeout(TIMEOUT_LISTA_MS * 4),
    });
    if (!resposta.ok) throw new Error(`HTTP ${resposta.status}`);
    const dados: any = await resposta.json();
    if (!Array.isArray(dados?.itens)) throw new Error('resposta sem itens');
    const pedidos = new Map<number, ItensPcp>();
    for (const item of dados.itens) {
      const numero = Number(item?.numeroPedido);
      if (!numero) continue;
      const atual = pedidos.get(numero) ?? { total: 0, abertos: 0, entregues: 0 };
      atual.total += 1;
      if (item.situacao === 'ENTREGUE') atual.entregues += 1;
      else if (item.situacao !== 'CANCELADO' && item.situacao !== 'DEVOLUCAO') atual.abertos += 1;
      pedidos.set(numero, atual);
    }
    programacaoPcp = { pedidos, carregadoEm: Date.now() };
  } catch (e: any) {
    console.error('Não foi possível ler a Programação do PCP:', e.message);
    if (programacaoPcp) programacaoPcp.carregadoEm = Date.now() - TTL_LISTA_MS + REPETIR_APOS_FALHA_MS;
  } finally {
    carregandoProgramacao = null;
  }
}

/** Situação de entrega de cada pedido na Programação do PCP, ou null se o PCP não responder. */
export async function obterItensPcp(): Promise<Map<number, ItensPcp> | null> {
  const vencida = !programacaoPcp || Date.now() - programacaoPcp.carregadoEm > TTL_LISTA_MS;
  if (vencida && !carregandoProgramacao) carregandoProgramacao = lerProgramacaoPcp();
  if (!programacaoPcp) await carregandoProgramacao;
  return programacaoPcp?.pedidos ?? null;
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
  const daLista = await obterDadosPcp();
  const agora = Date.now();
  const resultado = linhas.map((linha): PedidoLojaLinha => {
    if (linha.situacao === 'cancelado') return { ...linha, prazoGferro: null, prazoGferroPendente: false };
    const numero = numeroDoPedido(linha.codigo);
    if (numero === null) return { ...linha, prazoGferro: null, prazoGferroPendente: false };
    if (daLista?.has(numero)) return { ...linha, prazoGferro: daLista.get(numero)?.prazo ?? null, prazoGferroPendente: false };
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
