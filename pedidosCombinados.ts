// Dashboard > Pedidos > Pedidos combinados: pedidos cuja entrega foi combinada com alguém (quem e até quando).
// Os dados do pedido (cliente, vendedor, valor, prazo) vêm dos pedidos liberados já guardados no servidor — a busca
// nunca espera o Nomus. O que é digitado aqui (com quem e o prazo combinado) fica em data/pedidos-combinados.json.

import { mkdir, readFile, rename, writeFile } from 'fs/promises';
import path from 'path';
import { montarRespostaPedidosAbertos } from './pedidosAbertos';
import type { PedidoAbertoLinha } from './src/pedidosAbertos';

const ARQUIVO = path.join(process.cwd(), 'data', 'pedidos-combinados.json');

export class ErroPedidosCombinados extends Error {
  constructor(mensagem: string, public readonly status = 400) {
    super(mensagem);
  }
}

/** Dados do pedido guardados no momento do cadastro (se o pedido deixar de estar liberado, a linha continua completa). */
interface Registro {
  id: number;
  codigo: string; // "PD 02208"
  cliente: string;
  vendedor: string;
  loja: string;
  valorTotal: number;
  combinadoCom: string;
  prazoCombinado: string; // aaaa-mm-dd
  criadoEm: string;
  criadoPor: string;
  atualizadoEm: string;
  atualizadoPor: string;
}

export interface LinhaPedidoCombinado extends Registro {
  /** Prazo atual do pedido (PCP, ou Nomus quando o PCP não tem) — null quando o pedido já não está liberado. */
  prazoAtual: string | null;
  fontePrazoAtual: 'gferro' | 'nomus' | null;
  /** O pedido ainda consta entre os liberados? */
  liberado: boolean;
}

export interface PedidoEncontrado {
  codigo: string;
  cliente: string;
  vendedor: string;
  loja: string;
  valorTotal: number;
  dataEmissao: string;
  prazoAtual: string | null;
  fontePrazoAtual: 'gferro' | 'nomus' | null;
  /** Já existe um combinado para este pedido (id do registro). */
  jaCombinadoId: number | null;
}

interface Estado { proximoId: number; registros: Registro[] }

let estado: Estado | null = null;
let fila: Promise<unknown> = Promise.resolve();

async function carregar(): Promise<Estado> {
  if (estado) return estado;
  try {
    const lido = JSON.parse(await readFile(ARQUIVO, 'utf-8'));
    estado = { proximoId: Number(lido.proximoId) || 1, registros: Array.isArray(lido.registros) ? lido.registros : [] };
  } catch {
    estado = { proximoId: 1, registros: [] };
  }
  return estado;
}

/** Grava no disco (um de cada vez; escreve num arquivo temporário e troca, para um corte no meio não estragar o arquivo). */
function gravar(): Promise<void> {
  const proxima = fila.then(async () => {
    await mkdir(path.dirname(ARQUIVO), { recursive: true });
    const temporario = `${ARQUIVO}.tmp`;
    await writeFile(temporario, JSON.stringify(estado), 'utf-8');
    await rename(temporario, ARQUIVO);
  });
  fila = proxima.catch(() => undefined);
  return proxima;
}

const semAcento = (t: string) => t.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase();
const numeroDoCodigo = (codigo: string) => Number(codigo.replace(/\D/g, '')) || 0;
const dataValida = (v: unknown): v is string => typeof v === 'string' && /^(20\d\d)-(\d\d)-(\d\d)$/.test(v) && !Number.isNaN(Date.parse(v));

function texto(valor: unknown, nome: string, max: number): string {
  const t = String(valor ?? '').replace(/\s+/g, ' ').trim();
  if (!t) throw new ErroPedidosCombinados(`Informe ${nome}.`);
  if (t.length > max) throw new ErroPedidosCombinados(`${nome[0].toUpperCase()}${nome.slice(1)} passa de ${max} caracteres.`);
  return t;
}

async function pedidosLiberados(): Promise<Map<string, PedidoAbertoLinha>> {
  const resposta = await montarRespostaPedidosAbertos(false);
  return new Map(resposta.pedidos.map((p) => [numeroDoCodigo(p.codigo).toString(), p]));
}

function linha(r: Registro, vivos: Map<string, PedidoAbertoLinha>): LinhaPedidoCombinado {
  const vivo = vivos.get(numeroDoCodigo(r.codigo).toString());
  return {
    ...r,
    // Enquanto o pedido está liberado, cliente/vendedor/valor acompanham o que o Nomus diz hoje.
    cliente: vivo?.cliente || r.cliente,
    vendedor: vivo?.vendedor || r.vendedor,
    loja: vivo?.loja || r.loja,
    valorTotal: vivo?.valorTotal ?? r.valorTotal,
    prazoAtual: vivo?.prazo ?? null,
    fontePrazoAtual: vivo?.fontePrazo ?? null,
    liberado: !!vivo,
  };
}

export async function listarCombinados(): Promise<{ registros: LinhaPedidoCombinado[]; pedidosCarregando: boolean }> {
  const atual = await carregar();
  const resposta = await montarRespostaPedidosAbertos(false);
  const vivos = new Map(resposta.pedidos.map((p) => [numeroDoCodigo(p.codigo).toString(), p]));
  return { registros: [...atual.registros].sort((a, b) => b.id - a.id).map((r) => linha(r, vivos)), pedidosCarregando: !!resposta.carregando };
}

/** Procura entre os pedidos liberados por número, cliente ou vendedor (no máximo 15, os mais recentes primeiro). */
export async function buscarPedidos(consulta: unknown): Promise<PedidoEncontrado[]> {
  const q = semAcento(String(consulta ?? '')).trim().slice(0, 80);
  if (!q) return [];
  const atual = await carregar();
  const combinados = new Map(atual.registros.map((r) => [numeroDoCodigo(r.codigo), r.id]));
  const soDigitos = /^\d+$/.test(q);
  const resposta = await montarRespostaPedidosAbertos(false);
  return resposta.pedidos
    .filter((p) => (soDigitos ? String(numeroDoCodigo(p.codigo)).includes(String(Number(q))) : semAcento(`${p.codigo} ${p.cliente} ${p.vendedor}`).includes(q)))
    .sort((a, b) => numeroDoCodigo(b.codigo) - numeroDoCodigo(a.codigo))
    .slice(0, 15)
    .map((p) => ({
      codigo: p.codigo, cliente: p.cliente, vendedor: p.vendedor, loja: p.loja, valorTotal: p.valorTotal, dataEmissao: p.dataEmissao,
      prazoAtual: p.prazo, fontePrazoAtual: p.fontePrazo, jaCombinadoId: combinados.get(numeroDoCodigo(p.codigo)) ?? null,
    }));
}

export async function criarCombinado(corpo: any, usuario: string): Promise<LinhaPedidoCombinado> {
  const atual = await carregar();
  const codigo = String(corpo?.codigo ?? '').trim();
  const vivos = await pedidosLiberados();
  const pedido = vivos.get(numeroDoCodigo(codigo).toString());
  if (!codigo || !pedido) throw new ErroPedidosCombinados('Pedido não encontrado entre os pedidos liberados. Busque de novo.', 404);
  const combinadoCom = texto(corpo?.combinadoCom, 'com quem foi combinado', 120);
  if (!dataValida(corpo?.prazoCombinado)) throw new ErroPedidosCombinados('Informe o prazo combinado (data válida).');
  if (atual.registros.some((r) => numeroDoCodigo(r.codigo) === numeroDoCodigo(pedido.codigo))) throw new ErroPedidosCombinados(`O pedido ${pedido.codigo} já está na lista: edite o combinado existente.`, 409);

  const agora = new Date().toISOString();
  const registro: Registro = {
    id: atual.proximoId++, codigo: pedido.codigo, cliente: pedido.cliente, vendedor: pedido.vendedor, loja: pedido.loja, valorTotal: pedido.valorTotal,
    combinadoCom, prazoCombinado: corpo.prazoCombinado, criadoEm: agora, criadoPor: usuario, atualizadoEm: agora, atualizadoPor: usuario,
  };
  atual.registros.push(registro);
  await gravar();
  return linha(registro, vivos);
}

export async function atualizarCombinado(id: number, corpo: any, usuario: string): Promise<LinhaPedidoCombinado> {
  const atual = await carregar();
  const registro = atual.registros.find((r) => r.id === id);
  if (!registro) throw new ErroPedidosCombinados('Registro não encontrado.', 404);
  const novo: Partial<Registro> = {};
  if ('combinadoCom' in (corpo ?? {})) novo.combinadoCom = texto(corpo.combinadoCom, 'com quem foi combinado', 120);
  if ('prazoCombinado' in (corpo ?? {})) {
    if (!dataValida(corpo.prazoCombinado)) throw new ErroPedidosCombinados('O prazo combinado deve ser uma data válida.');
    novo.prazoCombinado = corpo.prazoCombinado;
  }
  if (Object.keys(novo).length === 0) throw new ErroPedidosCombinados('Informe ao menos um campo para atualizar.');
  Object.assign(registro, novo, { atualizadoEm: new Date().toISOString(), atualizadoPor: usuario });
  await gravar();
  return linha(registro, await pedidosLiberados());
}

export async function removerCombinado(id: number): Promise<void> {
  const atual = await carregar();
  const i = atual.registros.findIndex((r) => r.id === id);
  if (i < 0) throw new ErroPedidosCombinados('Registro não encontrado.', 404);
  atual.registros.splice(i, 1);
  await gravar();
}
