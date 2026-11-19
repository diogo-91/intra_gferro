// Pedidos Formato 2: regra de prazo de entrega dos pedidos liberados, definida pela GFERRO:
//  - pedido de contrato (observação cita "contrato"): 60 dias úteis;
//  - 30% a 69% pago: 40 dias úteis;
//  - 70% a 100% pago: 7 a 10 dias úteis;
//  - menos de 30% pago: sem regra definida (não entra em atraso).
// O prazo conta a partir da data de emissão do pedido (a data de liberação não vem pela API do Nomus). Pedido não contratual
// com menos de 30% pago não entra na lista; pedidos emitidos antes da data de corte também não.
// O status (atrasado / dentro do prazo) é contado em dias úteis.
// Sem dependências de servidor/navegador.

import { diasUteisEntre, somarDiasUteis } from './data/diasUteis';

/** Divisão do valor total do pedido: 70% é o custo de produção e 30% é o lucro (que precisa ser transferido). */
export const PERCENTUAL_CUSTO_PRODUCAO = 0.7;
export const PERCENTUAL_LUCRO = 0.3;

/** Custo de produção e lucro de um pedido, em centavos exatos: o lucro é arredondado e o custo é o que sobra (a soma sempre fecha). */
export function dividirValorDoPedido(valorTotal: number): { custoProducao: number; lucro: number } {
  const lucro = Math.round(valorTotal * PERCENTUAL_LUCRO * 100) / 100;
  return { custoProducao: Math.round((valorTotal - lucro) * 100) / 100, lucro };
}

/** Data de corte: só entram pedidos emitidos nesta data ou depois (pedidos antigos não entram). */
export const DATA_DE_CORTE_FORMATO2 = '2026-11-18';

export type RegraFormato2 = 'contrato' | 'pago-30-69' | 'pago-70-100' | 'abaixo-30' | 'sem-financeiro';
export type StatusFormato2 = 'atrasado' | 'dentro-do-prazo' | 'sem-regra' | 'calculando';

/** O pedido entra na lista? (a regra de menos de 30% pago e a data de corte) */
export const entraNoFormato2 = (c: Pick<ClassificacaoFormato2, 'regra'>, dataEmissao: string) => c.regra !== 'abaixo-30' && dataEmissao >= DATA_DE_CORTE_FORMATO2;

export const REGRAS_FORMATO2: Record<Exclude<RegraFormato2, 'sem-financeiro'>, { rotulo: string; diasUteisMin: number | null; diasUteisMax: number | null }> = {
  contrato: { rotulo: 'Contrato', diasUteisMin: null, diasUteisMax: 60 },
  'pago-30-69': { rotulo: '30% a 69% pago', diasUteisMin: null, diasUteisMax: 40 },
  'pago-70-100': { rotulo: '70% a 100% pago', diasUteisMin: 7, diasUteisMax: 10 },
  'abaixo-30': { rotulo: 'Menos de 30% pago', diasUteisMin: null, diasUteisMax: null },
};

export interface EntradaFormato2 {
  contrato: boolean;
  valorTotal: number;
  /** Quanto já foi recebido do pedido; null enquanto o financeiro ainda não foi lido. */
  recebido: number | null;
  dataEmissao: string; // aaaa-mm-dd
}

export interface ClassificacaoFormato2 {
  regra: RegraFormato2;
  regraRotulo: string;
  /** Pago ÷ valor total (0 a 1), calculado aqui; null enquanto o financeiro não foi lido. */
  percentualPago: number | null;
  /** Dias úteis da regra (o limite; no 70% a 100% é o maior do intervalo "7 a 10"). */
  diasUteis: number | null;
  /** Início do intervalo de entrega (só na faixa de 70% a 100%: 7 dias úteis). */
  prazoInicio: string | null;
  /** Data limite de entrega. */
  prazoFim: string | null;
  status: StatusFormato2;
  /** Dias úteis de atraso (0 se não está atrasado, ou se venceu há menos de um dia útil). */
  diasAtraso: number;
  /** Dias úteis até o limite (negativo = atraso); null sem prazo. */
  diasParaPrazo: number | null;
}

export function classificarFormato2(entrada: EntradaFormato2, hoje: string): ClassificacaoFormato2 {
  const percentualPago = entrada.recebido !== null && entrada.valorTotal > 0 ? Math.min(1, Math.max(0, entrada.recebido / entrada.valorTotal)) : null;

  let regra: RegraFormato2;
  if (entrada.contrato) regra = 'contrato'; // contrato vale qualquer que seja o pagamento
  else if (percentualPago === null) regra = 'sem-financeiro';
  else if (percentualPago >= 0.7) regra = 'pago-70-100';
  else if (percentualPago >= 0.3) regra = 'pago-30-69';
  else regra = 'abaixo-30';

  if (regra === 'sem-financeiro') {
    return { regra, regraRotulo: 'Calculando…', percentualPago, diasUteis: null, prazoInicio: null, prazoFim: null, status: 'calculando', diasAtraso: 0, diasParaPrazo: null };
  }
  const { rotulo, diasUteisMin, diasUteisMax } = REGRAS_FORMATO2[regra];
  if (diasUteisMax === null) {
    return { regra, regraRotulo: rotulo, percentualPago, diasUteis: null, prazoInicio: null, prazoFim: null, status: 'sem-regra', diasAtraso: 0, diasParaPrazo: null };
  }
  const prazoFim = somarDiasUteis(entrada.dataEmissao, diasUteisMax);
  const prazoInicio = diasUteisMin !== null ? somarDiasUteis(entrada.dataEmissao, diasUteisMin) : null;
  const diasParaPrazo = diasUteisEntre(hoje, prazoFim); // negativo = já passou do limite
  const passou = hoje > prazoFim; // venceu (pode ser fim de semana logo depois do limite: 0 dias úteis)
  return {
    regra, regraRotulo: rotulo, percentualPago, diasUteis: diasUteisMax, prazoInicio, prazoFim,
    status: passou ? 'atrasado' : 'dentro-do-prazo',
    diasAtraso: passou ? -diasParaPrazo : 0,
    diasParaPrazo,
  };
}
