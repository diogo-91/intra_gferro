// Dashboard > Financeiro > Placas de EPS: confirmação de que o financeiro fez a transferência do Caixa 2 de cada
// lançamento (quem confirmou, quando e quanto era). Fica em data/eps-caixa2.json, indexado pelo id do lançamento no
// Apontamento de Produção. Só guarda as confirmações; os lançamentos continuam no Apontamento.

import { mkdir, readFile, rename, writeFile } from 'fs/promises';
import path from 'path';
import { buscarEps } from './epsFinanceiro';
import { compararEps, familiaDoTipoEps } from './src/data/precosEps';

const ARQUIVO = path.join(process.cwd(), 'data', 'eps-caixa2.json');

export interface Transferencia {
  valor: number; // Caixa 2 do lançamento no momento da confirmação (R$)
  por: string;
  em: string; // ISO
}

export class ErroCaixa2 extends Error {
  constructor(mensagem: string, public readonly status = 400) {
    super(mensagem);
  }
}

let estado: Record<string, Transferencia> | null = null;
let fila: Promise<unknown> = Promise.resolve();

async function carregar(): Promise<Record<string, Transferencia>> {
  if (estado) return estado;
  try {
    const lido = JSON.parse(await readFile(ARQUIVO, 'utf-8'));
    estado = lido && typeof lido === 'object' && !Array.isArray(lido) ? lido : {};
  } catch {
    estado = {};
  }
  return estado!;
}

/** Grava no disco (uma gravação por vez; arquivo temporário + troca, para um corte no meio não estragar o arquivo). */
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

/** Confirmações dos lançamentos informados (id -> confirmação). */
export async function transferenciasDe(ids: string[]): Promise<Record<string, Transferencia>> {
  const atual = await carregar();
  const resultado: Record<string, Transferencia> = {};
  for (const id of ids) if (atual[id]) resultado[id] = atual[id];
  return resultado;
}

/**
 * Marca (ou desmarca) a transferência do Caixa 2 dos lançamentos `ids` do período. Os ids precisam existir no Apontamento
 * nesse período, e o valor guardado é o Caixa 2 calculado agora para cada um (só entra quem tem diferença a transferir).
 */
export async function marcarTransferencia(inicio: string, fim: string, ids: unknown, transferido: unknown, usuario: string): Promise<{ alterados: number }> {
  if (!Array.isArray(ids) || ids.length === 0 || ids.length > 500 || ids.some((id) => typeof id !== 'string')) throw new ErroCaixa2('Informe os lançamentos.');
  if (typeof transferido !== 'boolean') throw new ErroCaixa2('Informe se o Caixa 2 foi transferido ou não.');
  const atual = await carregar();
  const lancamentos = new Map((await buscarEps(inicio, fim)).lancamentos.map((l) => [l.id, l]));

  let alterados = 0;
  for (const id of new Set(ids as string[])) {
    const lancamento = lancamentos.get(id);
    if (!lancamento) throw new ErroCaixa2('Lançamento não encontrado neste período. Atualize a tela.', 404);
    if (transferido) {
      const { diferenca } = compararEps(familiaDoTipoEps(lancamento.tipo), lancamento.blocos, lancamento.placas);
      if (diferenca <= 0 || atual[id]) continue; // sem Caixa 2 a transferir, ou já confirmado: nada a fazer
      atual[id] = { valor: diferenca, por: usuario, em: new Date().toISOString() };
      alterados++;
    } else if (atual[id]) {
      delete atual[id];
      alterados++;
    }
  }
  if (alterados > 0) await gravar();
  return { alterados };
}
