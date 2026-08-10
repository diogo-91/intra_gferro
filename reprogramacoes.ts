// Replanejamento LOCAL de datas de vencimento pro Painel/Calendário Financeiro.
//
// O Nomus não permite mudar dataVencimento via API — /contasReceber só edita
// statusProtestoCartorio/statusNegativacao, e /contasPagar não tem serviço de
// edição nenhum. Isso aqui é só uma camada de planejamento por cima do dado
// real: guarda "quero pagar/receber isso no dia X" sem alterar o vencimento
// oficial no Nomus (multa, juros e inadimplência de lá continuam pela data
// original de lá).
//
// Persistência simples em arquivo JSON — este app não tem banco de dados, e
// o volume (poucas dezenas de replanejamentos por vez) não justifica um.

import { readFile, writeFile, mkdir } from 'fs/promises';
import path from 'path';

const ARQUIVO = path.join(process.cwd(), 'data', 'reprogramacoes-financeiro.json');

export type TipoConta = 'receber' | 'pagar';

export interface Reprogramacao {
  id: string;
  tipo: TipoConta;
  vencimentoOriginal: string; // dd/mm/aaaa
  novaData: string; // dd/mm/aaaa
  criadoEm: string; // ISO
}

let cache: Reprogramacao[] | null = null;

async function carregar(): Promise<Reprogramacao[]> {
  if (cache) return cache;
  try {
    const conteudo = await readFile(ARQUIVO, 'utf-8');
    cache = JSON.parse(conteudo);
  } catch {
    cache = [];
  }
  return cache!;
}

async function persistir(lista: Reprogramacao[]): Promise<void> {
  cache = lista;
  await mkdir(path.dirname(ARQUIVO), { recursive: true });
  await writeFile(ARQUIVO, JSON.stringify(lista, null, 2), 'utf-8');
}

function chave(id: string, tipo: TipoConta): string {
  return `${tipo}:${id}`;
}

export async function listarReprogramacoes(): Promise<Reprogramacao[]> {
  return carregar();
}

// Cria ou substitui o replanejamento de uma conta. Se `novaData` bater com o
// vencimento original, remove o replanejamento (não faz sentido "mover pro
// mesmo dia").
export async function salvarReprogramacao(
  id: string,
  tipo: TipoConta,
  vencimentoOriginal: string,
  novaData: string
): Promise<void> {
  const lista = await carregar();
  const semEsta = lista.filter((r) => chave(r.id, r.tipo) !== chave(id, tipo));

  if (novaData === vencimentoOriginal) {
    await persistir(semEsta);
    return;
  }

  semEsta.push({ id, tipo, vencimentoOriginal, novaData, criadoEm: new Date().toISOString() });
  await persistir(semEsta);
}

export async function removerReprogramacao(id: string, tipo: TipoConta): Promise<void> {
  const lista = await carregar();
  await persistir(lista.filter((r) => chave(r.id, r.tipo) !== chave(id, tipo)));
}

// Aplica os replanejamentos em cima de uma lista de contas já montada —
// troca `vencimento` pela `novaData` e marca `vencimentoOriginal` pra
// transparência na tela. Não mexe em `status` (esse continua refletindo o
// vencimento REAL do Nomus, que é o que importa pra multa/juros).
export async function aplicarReprogramacoes<T extends { id: string; vencimento: string; vencimentoOriginal?: string }>(
  contas: T[],
  tipo: TipoConta
): Promise<T[]> {
  const lista = await carregar();
  if (lista.length === 0) return contas;

  const porId = new Map(lista.filter((r) => r.tipo === tipo).map((r) => [r.id, r]));
  if (porId.size === 0) return contas;

  return contas.map((conta) => {
    const reprogramacao = porId.get(conta.id);
    if (!reprogramacao) return conta;
    return { ...conta, vencimento: reprogramacao.novaData, vencimentoOriginal: reprogramacao.vencimentoOriginal };
  });
}
