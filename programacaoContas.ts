// Programação de contas (menu Financeiro > Programação): lista simples de
// contas a pagar cadastradas à mão, com autorização de pagamento e status.
//
// Persistência simples em arquivo JSON — este app não tem banco de dados.

import { mkdir, readFile, writeFile } from 'fs/promises';
import { randomUUID } from 'crypto';
import path from 'path';
import type { ProgramacaoConta } from './src/types';

const ARQUIVO = path.join(process.cwd(), 'data', 'programacao-contas.json');

let cache: ProgramacaoConta[] | null = null;

async function carregar(): Promise<ProgramacaoConta[]> {
  if (cache) return cache;
  try {
    const dados = JSON.parse(await readFile(ARQUIVO, 'utf-8'));
    cache = Array.isArray(dados) ? dados : [];
  } catch {
    cache = [];
  }
  return cache!;
}

async function persistir(contas: ProgramacaoConta[]): Promise<void> {
  cache = contas;
  await mkdir(path.dirname(ARQUIVO), { recursive: true });
  await writeFile(ARQUIVO, JSON.stringify(contas, null, 2), 'utf-8');
}

function erro(mensagem: string, status: number) {
  return Object.assign(new Error(mensagem), { status });
}

function validarNome(valor: unknown): string {
  const nome = typeof valor === 'string' ? valor.trim() : '';
  if (nome.length < 2) throw erro('Informe o nome da conta.', 400);
  if (nome.length > 120) throw erro('O nome da conta deve ter no máximo 120 caracteres.', 400);
  return nome;
}

function validarData(valor: unknown): string {
  if (typeof valor !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(valor)) throw erro('Informe uma data válida.', 400);
  const [ano, mes, dia] = valor.split('-').map(Number);
  const data = new Date(ano, mes - 1, dia);
  if (data.getFullYear() !== ano || data.getMonth() !== mes - 1 || data.getDate() !== dia) throw erro('Informe uma data válida.', 400);
  return valor;
}

function validarBooleano(valor: unknown, campo: string): boolean {
  if (typeof valor !== 'boolean') throw erro(`Valor inválido para ${campo}.`, 400);
  return valor;
}

export async function listarContasProgramacao(): Promise<ProgramacaoConta[]> {
  return [...(await carregar())].sort((a, b) => b.data.localeCompare(a.data) || b.criadoEm.localeCompare(a.criadoEm));
}

export async function criarContaProgramacao(
  dados: { nome: unknown; data: unknown; autorizado?: unknown; pago?: unknown },
  criador: string
): Promise<ProgramacaoConta> {
  const agora = new Date().toISOString();
  const nova: ProgramacaoConta = {
    id: randomUUID(),
    nome: validarNome(dados.nome),
    data: validarData(dados.data),
    criador,
    autorizado: dados.autorizado === undefined ? false : validarBooleano(dados.autorizado, 'pagamento'),
    pago: dados.pago === undefined ? false : validarBooleano(dados.pago, 'status'),
    criadoEm: agora,
    atualizadoEm: agora,
  };
  await persistir([...(await carregar()), nova]);
  return nova;
}

export async function atualizarContaProgramacao(
  id: string,
  dados: { nome?: unknown; data?: unknown; autorizado?: unknown; pago?: unknown }
): Promise<ProgramacaoConta> {
  const contas = await carregar();
  const atual = contas.find((conta) => conta.id === id);
  if (!atual) throw erro('Conta não encontrada.', 404);
  const atualizada: ProgramacaoConta = {
    ...atual,
    nome: dados.nome === undefined ? atual.nome : validarNome(dados.nome),
    data: dados.data === undefined ? atual.data : validarData(dados.data),
    autorizado: dados.autorizado === undefined ? atual.autorizado : validarBooleano(dados.autorizado, 'pagamento'),
    pago: dados.pago === undefined ? atual.pago : validarBooleano(dados.pago, 'status'),
    atualizadoEm: new Date().toISOString(),
  };
  await persistir(contas.map((conta) => (conta.id === id ? atualizada : conta)));
  return atualizada;
}

export async function removerContaProgramacao(id: string): Promise<void> {
  const contas = await carregar();
  if (!contas.some((conta) => conta.id === id)) throw erro('Conta não encontrada.', 404);
  await persistir(contas.filter((conta) => conta.id !== id));
}
