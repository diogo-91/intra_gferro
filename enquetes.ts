// Enquete ativa mostrada no widget "Enquete da Semana" do Dashboard —
// cadastrada pelo RH (módulo RH > Adicionar Enquete). Só existe UMA enquete
// ativa por vez: criar uma nova substitui a anterior, zerando os votos.
//
// Persistência simples em arquivo JSON — este app não tem banco de dados.

import { readFile, writeFile, mkdir } from 'fs/promises';
import { randomUUID } from 'crypto';
import path from 'path';
import type { Enquete } from './src/types';

const ARQUIVO = path.join(process.cwd(), 'data', 'enquete-atual.json');

export interface NovaEnquete {
  pergunta: string;
  opcoes: string[];
}

let cache: Enquete | null | undefined;

async function carregar(): Promise<Enquete | null> {
  if (cache !== undefined) return cache;
  try {
    const conteudo = await readFile(ARQUIVO, 'utf-8');
    cache = JSON.parse(conteudo);
  } catch {
    cache = null;
  }
  return cache;
}

async function persistir(enquete: Enquete | null): Promise<void> {
  cache = enquete;
  await mkdir(path.dirname(ARQUIVO), { recursive: true });
  await writeFile(ARQUIVO, JSON.stringify(enquete, null, 2), 'utf-8');
}

export async function obterEnqueteAtual(): Promise<Enquete | null> {
  return carregar();
}

export async function criarEnquete(dados: NovaEnquete): Promise<Enquete> {
  const nova: Enquete = {
    id: randomUUID(),
    pergunta: dados.pergunta,
    opcoes: dados.opcoes,
    votos: dados.opcoes.map(() => 0),
    criadoEm: new Date().toISOString(),
  };
  await persistir(nova);
  return nova;
}

export async function registrarVoto(enqueteId: string, opcaoIndex: number): Promise<Enquete> {
  const atual = await carregar();
  if (!atual || atual.id !== enqueteId) {
    throw Object.assign(new Error('Essa enquete não está mais ativa.'), { status: 409 });
  }
  if (!Number.isInteger(opcaoIndex) || opcaoIndex < 0 || opcaoIndex >= atual.opcoes.length) {
    throw Object.assign(new Error('Opção inválida.'), { status: 400 });
  }
  atual.votos[opcaoIndex] += 1;
  await persistir(atual);
  return atual;
}
