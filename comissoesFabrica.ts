// Dashboard > Financeiro > Comissões Fábrica (servidor): pedidos dos vendedores da fábrica no mês, vindos do Nomus, e os
// campos digitados à mão (termo de aceite de cada pedido e ajuste de cada vendedor), guardados em
// data/comissoes-fabrica.json por mês. As regras de cálculo ficam em src/comissoesFabrica.ts (a tela calcula com elas).

import { mkdir, readFile, rename, writeFile } from 'fs/promises';
import path from 'path';
import { getPedidosParaComissao } from './nomus';
import { LOJA_FABRICA, MES_INICIAL_COMISSOES, type AjusteVendedor, type PedidoComissao, type TermoAceite } from './src/comissoesFabrica';

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
  /** Os pedidos do mês ainda estão sendo lidos do Nomus: a tela pergunta de novo. */
  carregando?: boolean;
  /** O financeiro (valor recebido) ainda está sendo lido/atualizado: o recebido pode mudar nos próximos minutos. */
  financeiroCarregando?: boolean;
  pedidos: PedidoComissao[];
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

export async function montarComissoesFabrica(mes: string): Promise<RespostaComissoesFabrica> {
  const [{ pedidos, atualizadoEm, carregando, financeiroCarregando }, todos] = await Promise.all([getPedidosParaComissao(LOJA_FABRICA, mes), carregar()]);
  const guardado = todos[mes];
  return {
    mes,
    atualizadoEm,
    ...(carregando ? { carregando: true } : {}),
    ...(financeiroCarregando ? { financeiroCarregando: true } : {}),
    pedidos,
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
