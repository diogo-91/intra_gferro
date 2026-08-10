// Cadastro de funcionários do RH — cadastrado manualmente pela intranet.
//
// O Nomus tem um cadastro de "Pessoas" com categoria "Funcionário", mas só 7
// registros no total e sem cargo, e-mail, telefone ou data de admissão (só
// nome/código/CPF/status) — não dá pra alimentar um módulo de RH de verdade
// a partir de lá. Isso aqui é cadastro próprio da intranet.
//
// Persistência simples em arquivo JSON — este app não tem banco de dados.

import { readFile, writeFile, mkdir } from 'fs/promises';
import { randomUUID } from 'crypto';
import path from 'path';
import type { Funcionario } from './src/types';

const ARQUIVO = path.join(process.cwd(), 'data', 'funcionarios-rh.json');

export type NovoFuncionario = Omit<Funcionario, 'id' | 'criadoEm'>;

let cache: Funcionario[] | null = null;

async function carregar(): Promise<Funcionario[]> {
  if (cache) return cache;
  try {
    const conteudo = await readFile(ARQUIVO, 'utf-8');
    cache = JSON.parse(conteudo);
  } catch {
    cache = [];
  }
  return cache!;
}

async function persistir(lista: Funcionario[]): Promise<void> {
  cache = lista;
  await mkdir(path.dirname(ARQUIVO), { recursive: true });
  await writeFile(ARQUIVO, JSON.stringify(lista, null, 2), 'utf-8');
}

export async function listarFuncionarios(): Promise<Funcionario[]> {
  const lista = await carregar();
  return [...lista].sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
}

export async function cadastrarFuncionario(dados: NovoFuncionario): Promise<Funcionario> {
  const lista = await carregar();
  const novo: Funcionario = { ...dados, id: randomUUID(), criadoEm: new Date().toISOString() };
  await persistir([...lista, novo]);
  return novo;
}

export async function removerFuncionario(id: string): Promise<void> {
  const lista = await carregar();
  await persistir(lista.filter((f) => f.id !== id));
}
