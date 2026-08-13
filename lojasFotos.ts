// Foto de fachada de cada loja/unidade (ver src/data/vendedorLoja.ts pro
// catálogo de lojas). Persistência simples em arquivo JSON — mesmo padrão
// de sac.ts/enquetes.ts, este app não tem banco de dados.

import { readFile, writeFile, mkdir } from 'fs/promises';
import path from 'path';

const ARQUIVO = path.join(process.cwd(), 'data', 'lojas-fotos.json');
export const PASTA_UPLOADS_LOJAS = path.join(process.cwd(), 'data', 'uploads', 'lojas');

let cache: Record<string, string> | null = null;

async function carregar(): Promise<Record<string, string>> {
  if (cache) return cache;
  try {
    const conteudo = await readFile(ARQUIVO, 'utf-8');
    cache = JSON.parse(conteudo);
  } catch {
    cache = {};
  }
  return cache!;
}

export async function listarFotosLojas(): Promise<Record<string, string>> {
  return { ...(await carregar()) };
}

export async function definirFotoLoja(lojaId: string, url: string): Promise<void> {
  const mapa = await carregar();
  mapa[lojaId] = url;
  cache = mapa;
  await mkdir(path.dirname(ARQUIVO), { recursive: true });
  await writeFile(ARQUIVO, JSON.stringify(mapa, null, 2), 'utf-8');
}
