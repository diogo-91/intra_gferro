// Programação de contas (menu Financeiro > Programação): lista simples de
// contas a pagar cadastradas à mão, com autorização de pagamento e status.
//
// Persistência simples em arquivo JSON — este app não tem banco de dados.

import { mkdir, readFile, writeFile } from 'fs/promises';
import { randomUUID } from 'crypto';
import path from 'path';
import type { LinhaProgramacao, ProgramacaoConta, ResumoFinanceiro } from './src/types';

const ARQUIVO = path.join(process.cwd(), 'data', 'programacao-contas.json');
const ARQUIVO_AUTORIZACOES = path.join(process.cwd(), 'data', 'programacao-autorizacoes.json');

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

// ---- Contas a pagar do Nomus: autorização guardada na intranet ----
// O Nomus não tem o conceito de "pagamento autorizado", então a autorização de
// cada conta em aberto fica num arquivo próprio, indexada pelo id da conta.

export interface AutorizacaoConta {
  autorizado: boolean;
  por: string;
  em: string; // ISO
}

let cacheAutorizacoes: Record<string, AutorizacaoConta> | null = null;

async function carregarAutorizacoes(): Promise<Record<string, AutorizacaoConta>> {
  if (cacheAutorizacoes) return cacheAutorizacoes;
  try {
    const dados = JSON.parse(await readFile(ARQUIVO_AUTORIZACOES, 'utf-8'));
    cacheAutorizacoes = dados && typeof dados === 'object' && !Array.isArray(dados) ? dados : {};
  } catch {
    cacheAutorizacoes = {};
  }
  return cacheAutorizacoes!;
}

export async function definirAutorizacaoContaNomus(contaId: string, autorizado: boolean, por: string): Promise<AutorizacaoConta> {
  if (!/^\d+$/.test(contaId)) throw erro('Conta inválida.', 400);
  const autorizacao: AutorizacaoConta = { autorizado: validarBooleano(autorizado, 'pagamento'), por, em: new Date().toISOString() };
  const todas = { ...(await carregarAutorizacoes()), [contaId]: autorizacao };
  cacheAutorizacoes = todas;
  await mkdir(path.dirname(ARQUIVO_AUTORIZACOES), { recursive: true });
  await writeFile(ARQUIVO_AUTORIZACOES, JSON.stringify(todas, null, 2), 'utf-8');
  return autorizacao;
}

// "dd/mm/aaaa" (formato do resumo financeiro) -> "aaaa-mm-dd".
function dataBrParaIso(data: string): string {
  const [dia, mes, ano] = data.split(' ')[0].split('/');
  return `${ano}-${mes}-${dia}`;
}

// Junta, para o mês escolhido: contas a pagar em aberto do Nomus (Não pago),
// pagamentos já realizados no Nomus (Pago) e as contas cadastradas à mão.
export async function montarLinhasProgramacao(resumo: ResumoFinanceiro, mes: string): Promise<LinhaProgramacao[]> {
  const autorizacoes = await carregarAutorizacoes();
  const noMes = (dataIso: string) => dataIso.startsWith(`${mes}-`);

  const abertas: LinhaProgramacao[] = resumo.contasPagar
    .map((conta) => ({ conta, data: dataBrParaIso(conta.vencimento) }))
    .filter(({ data }) => noMes(data))
    .map(({ conta, data }) => {
      const aut = autorizacoes[conta.id];
      return {
        chave: `nomus-pagar-${conta.id}`,
        origem: 'nomus' as const,
        contaNomusId: conta.id,
        data,
        nome: conta.fornecedor,
        criador: null,
        valor: conta.valor,
        autorizado: aut?.autorizado ?? false,
        autorizadoPor: aut?.autorizado ? aut.por : null,
        autorizacaoEditavel: true,
        pago: false,
      };
    });

  const pagas: LinhaProgramacao[] = resumo.contasConcluidas
    .filter((conta) => conta.tipo === 'pagar')
    .map((conta) => ({ conta, data: dataBrParaIso(conta.dataBaixa) }))
    .filter(({ data }) => noMes(data))
    .map(({ conta, data }) => ({
      chave: `nomus-pago-${conta.id}`,
      origem: 'nomus' as const,
      data,
      nome: conta.pessoa,
      criador: null,
      valor: conta.valor,
      autorizado: true,
      autorizadoPor: null,
      autorizacaoEditavel: false,
      pago: true,
    }));

  const manuais: LinhaProgramacao[] = (await listarContasProgramacao())
    .filter((conta) => noMes(conta.data))
    .map((conta) => ({
      chave: `manual-${conta.id}`,
      origem: 'manual' as const,
      id: conta.id,
      data: conta.data,
      nome: conta.nome,
      criador: conta.criador,
      valor: null,
      autorizado: conta.autorizado,
      autorizadoPor: null,
      autorizacaoEditavel: true,
      pago: conta.pago,
    }));

  return [...abertas, ...pagas, ...manuais].sort((a, b) => b.data.localeCompare(a.data) || a.nome.localeCompare(b.nome, 'pt-BR'));
}
