// Dashboard > Financeiro > Comissões (servidor): pedidos dos vendedores de todas as lojas no mês, vindos do Nomus, e os
// campos digitados à mão (termo de aceite de cada pedido e ajuste de cada vendedor), guardados em
// data/comissoes-fabrica.json por mês. As regras de cálculo ficam em src/comissoesFabrica.ts (a tela calcula com elas).
//
// A tela NUNCA espera o Nomus: o servidor guarda um "retrato" de cada mês (memória + data/comissoes-retratos.json), responde
// sempre com o último retrato e o atualiza em segundo plano — a cada 5 minutos no mês atual (já aquecido na subida do
// servidor) e a cada 6 horas em meses fechados. A leitura completa no Nomus leva minutos por causa do limite de requisições.

import { mkdir, readFile, rename, writeFile } from 'fs/promises';
import path from 'path';
import { lerPedidosParaComissao, type PedidosDasComissoes } from './nomus';
import { MES_INICIAL_COMISSOES, type AjusteVendedor, type PedidoComissao, type TermoAceite, type VendedorDaLoja } from './src/comissoesFabrica';
import { vendedoresMapeados } from './src/data/vendedorLoja';

const ARQUIVO = path.join(process.cwd(), 'data', 'comissoes-fabrica.json');

export class ErroComissoes extends Error {
  constructor(mensagem: string, public readonly status = 400) {
    super(mensagem);
  }
}

interface Auditoria { por: string; em: string }
interface MesGuardado {
  termos: Record<string, { valor: TermoAceite } & Auditoria>;
  ajustes: Record<string, { valor: number; observacao: string } & Auditoria>;
}

export interface RespostaComissoesFabrica {
  mes: string;
  atualizadoEm: string;
  /** Primeira leitura do mês (nada guardado ainda): a tela pergunta de novo até o retrato ficar pronto. */
  carregando?: boolean;
  /** Há uma atualização em andamento no Nomus; o que a tela mostra é o último retrato guardado. */
  atualizando?: boolean;
  pedidos: PedidoComissao[];
  /** Todos os vendedores de cada loja (também os que não venderam no mês). */
  vendedores: VendedorDaLoja[];
  termos: Record<string, TermoAceite>;
  ajustes: Record<string, AjusteVendedor>;
}

let estado: Record<string, MesGuardado> | null = null;
let fila: Promise<unknown> = Promise.resolve();

async function carregar(): Promise<Record<string, MesGuardado>> {
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

const mesAtual = () => new Date().toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' }).slice(0, 7);

/** O mês precisa estar no formato AAAA-MM, de novembro/2026 até o mês atual. */
export function validarMesComissoes(mes: unknown): string {
  if (typeof mes !== 'string' || !/^\d{4}-(0[1-9]|1[0-2])$/.test(mes)) throw new ErroComissoes('Informe o mês no formato AAAA-MM.');
  if (mes < MES_INICIAL_COMISSOES || mes > mesAtual()) throw new ErroComissoes('Mês fora do período disponível.');
  return mes;
}

// ---- Retrato do mês (o que veio do Nomus) ----

interface Retrato { atualizadoEm: number; dados: PedidosDasComissoes }
const ARQUIVO_RETRATOS = path.join(process.cwd(), 'data', 'comissoes-retratos.json');
const IDADE_MAXIMA_MES_ATUAL_MS = 5 * 60 * 1000;
const IDADE_MAXIMA_MES_FECHADO_MS = 6 * 60 * 60 * 1000;
let retratos: Record<string, Retrato> | null = null;
let filaRetratos: Promise<unknown> = Promise.resolve();
const leiturasEmAndamento = new Map<string, Promise<void>>();

async function carregarRetratos(): Promise<Record<string, Retrato>> {
  if (retratos) return retratos;
  try {
    const lido = JSON.parse(await readFile(ARQUIVO_RETRATOS, 'utf-8'));
    retratos = lido && typeof lido === 'object' && !Array.isArray(lido) ? lido : {};
  } catch {
    retratos = {};
  }
  return retratos!;
}

function gravarRetratos(): Promise<void> {
  const proxima = filaRetratos.then(async () => {
    await mkdir(path.dirname(ARQUIVO_RETRATOS), { recursive: true });
    const temporario = `${ARQUIVO_RETRATOS}.tmp`;
    await writeFile(temporario, JSON.stringify(retratos), 'utf-8');
    await rename(temporario, ARQUIVO_RETRATOS);
  });
  filaRetratos = proxima.catch(() => undefined);
  return proxima;
}

const idadeMaximaDoMes = (mes: string) => (mes < mesAtual() ? IDADE_MAXIMA_MES_FECHADO_MS : IDADE_MAXIMA_MES_ATUAL_MS);

/** Lê o mês no Nomus e guarda o novo retrato (uma leitura por vez por mês). Se falhar, o retrato anterior continua valendo. */
function atualizarRetrato(mes: string): Promise<void> {
  const emAndamento = leiturasEmAndamento.get(mes);
  if (emAndamento) return emAndamento;
  const leitura = (async () => {
    try {
      const dados = await lerPedidosParaComissao(mes);
      (await carregarRetratos())[mes] = { atualizadoEm: Date.now(), dados };
      await gravarRetratos();
    } catch (erro: any) {
      console.error(`[comissoes] não foi possível atualizar ${mes}; mantendo o retrato anterior:`, erro?.message ?? erro);
    }
  })().finally(() => leiturasEmAndamento.delete(mes));
  leiturasEmAndamento.set(mes, leitura);
  return leitura;
}

/** Abre o último retrato guardado no disco e mantém o mês atual atualizado em segundo plano. */
export function iniciarAtualizacaoComissoes(): void {
  const ciclo = async () => {
    const mes = mesAtual();
    if (mes >= MES_INICIAL_COMISSOES) await atualizarRetrato(mes);
    setTimeout(ciclo, IDADE_MAXIMA_MES_ATUAL_MS).unref();
  };
  // Pequeno atraso para não disputar a fila do Nomus com os demais jobs da subida do servidor.
  void carregarRetratos().then(() => setTimeout(ciclo, 20_000).unref());
}

export async function montarComissoesFabrica(mes: string): Promise<RespostaComissoesFabrica> {
  const [todosRetratos, todos] = await Promise.all([carregarRetratos(), carregar()]);
  const retrato = todosRetratos[mes];
  if (!retrato || Date.now() - retrato.atualizadoEm > idadeMaximaDoMes(mes)) void atualizarRetrato(mes);
  if (!retrato) {
    return { mes, atualizadoEm: new Date().toISOString(), carregando: true, atualizando: true, pedidos: [], vendedores: [], termos: {}, ajustes: {} };
  }
  const { pedidos, vendedores: doNomus } = retrato.dados;
  const atualizadoEm = new Date(retrato.atualizadoEm).toISOString();
  const atualizando = leiturasEmAndamento.has(mes);
  // Vendedores cadastrados no Nomus + os vinculados à mão a uma loja que o Nomus ainda não tem. O mesmo nome (sem acento e
  // sem diferença de maiúsculas) é a mesma pessoa — o Nomus tem cadastros antigo e novo — e um nome só de apelido
  // ("Alisson") some quando a loja já tem o cadastro completo ("Alisson Fernando Nunes").
  const chave = (nome: string) => nome.normalize('NFD').replace(/\p{Diacritic}/gu, '').replace(/\s+/g, ' ').trim().toUpperCase();
  const mapeados = vendedoresMapeados();
  const nomeFinal = new Map<string, string>(); // chave -> nome que vale (o do mapeamento, que é o cuidado à mão; senão o primeiro do Nomus)
  for (const v of mapeados) nomeFinal.set(chave(v.nome), v.nome);
  for (const v of doNomus) if (!nomeFinal.has(chave(v.nome))) nomeFinal.set(chave(v.nome), v.nome);
  const final = (nome: string) => nomeFinal.get(chave(nome)) ?? nome;
  const todosVendedores = new Map<string, VendedorDaLoja>();
  for (const v of [...doNomus, ...mapeados]) if (!todosVendedores.has(chave(v.nome))) todosVendedores.set(chave(v.nome), { nome: final(v.nome), loja: v.loja });
  const vendedores = [...todosVendedores.entries()]
    .filter(([c, v]) => ![...todosVendedores.entries()].some(([outro, o]) => o.loja === v.loja && outro.startsWith(`${c} `)))
    .map(([, v]) => v);
  const pedidosUnificados = pedidos.map((p) => ({ ...p, vendedor: final(p.vendedor) }));
  const guardado = todos[mes];
  return {
    mes,
    atualizadoEm,
    ...(atualizando ? { atualizando: true } : {}),
    pedidos: pedidosUnificados,
    vendedores,
    termos: Object.fromEntries(Object.entries(guardado?.termos ?? {}).map(([codigo, t]) => [codigo, t.valor])),
    ajustes: Object.fromEntries(Object.entries(guardado?.ajustes ?? {}).map(([vendedor, a]) => [vendedor, { valor: a.valor, observacao: a.observacao }])),
  };
}

const noMes = async (mes: string): Promise<MesGuardado> => {
  const todos = await carregar();
  return (todos[mes] ??= { termos: {}, ajustes: {} });
};

/** Termo de aceite de um pedido: 'sim', 'nao' ou null (limpa). */
export async function salvarTermoAceite(mes: unknown, codigo: unknown, valor: unknown, usuario: string): Promise<void> {
  const chaveMes = validarMesComissoes(mes);
  if (typeof codigo !== 'string' || !/^PD\s*\d{1,8}$/i.test(codigo.trim())) throw new ErroComissoes('Pedido inválido.');
  if (valor !== 'sim' && valor !== 'nao' && valor !== null) throw new ErroComissoes('O termo de aceite é Sim ou Não.');
  const guardado = await noMes(chaveMes);
  const chave = codigo.trim();
  if (valor === null) delete guardado.termos[chave];
  else guardado.termos[chave] = { valor: valor as TermoAceite, por: usuario, em: new Date().toISOString() };
  await gravar();
}

/** Ajuste de um vendedor no mês (valor positivo soma, negativo desconta); valor 0 e sem observação remove. */
export async function salvarAjuste(mes: unknown, vendedor: unknown, valor: unknown, observacao: unknown, usuario: string): Promise<void> {
  const chaveMes = validarMesComissoes(mes);
  if (typeof vendedor !== 'string' || !vendedor.trim() || vendedor.length > 120) throw new ErroComissoes('Vendedor inválido.');
  if (typeof valor !== 'number' || !Number.isFinite(valor) || Math.abs(valor) > 1_000_000) throw new ErroComissoes('Informe um valor válido para o ajuste.');
  if (observacao !== undefined && typeof observacao !== 'string') throw new ErroComissoes('Observação inválida.');
  const texto = ((observacao as string | undefined) ?? '').trim().slice(0, 200);
  const guardado = await noMes(chaveMes);
  const nome = vendedor.trim();
  if (valor === 0 && !texto) delete guardado.ajustes[nome];
  else guardado.ajustes[nome] = { valor: Math.round(valor * 100) / 100, observacao: texto, por: usuario, em: new Date().toISOString() };
  await gravar();
}
