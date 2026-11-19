// Dashboard > Financeiro > Comissões Fábrica: as regras da planilha "03 FABRICA" (fechamento mensal das comissões dos
// vendedores da fábrica). Sem dependências de servidor/navegador: a tela e o servidor usam o mesmo cálculo.
//
//  - Comissão de vendas: 2% do valor RECEBIDO dos pedidos do vendedor (taxa própria por vendedor em TAXAS_ESPECIAIS).
//  - Comissão de frete (por pedido, pelo valor do frete cobrado): R$110 a 149,99 = 10; R$150 a 199,99 = 13,50;
//    R$200 a 249,99 = 16; a partir de R$250 = 22. Abaixo de R$110 não há comissão.
//  - % recebido do vendedor: média simples do % de cada pedido (recebido ÷ valor da venda), como na planilha.
//  - Semana: WEEKNUM(data) − WEEKNUM(1º dia do mês) + 1 (o Excel conta a semana começando no domingo; a semana 1 é a que
//    tem o dia 1, mesmo parcial).
//  - Termo de aceite (Sim/Não) e ajustes (ex.: "descontar R$ 8") são digitados à mão.
//  - O mês é o da data de emissão do pedido; o primeiro mês da tela é novembro/2026.

/** Loja (src/data/vendedorLoja.ts) cujos vendedores são os da fábrica ("Unidade 3"). */
export const LOJA_FABRICA = 'paulo';
export const MES_INICIAL_COMISSOES = '2026-11';

export const TAXA_COMISSAO_PADRAO = 0.02;
/** Taxa diferente da padrão para algum vendedor (nome como vem do Nomus -> taxa, ex.: 0.03). */
export const TAXAS_ESPECIAIS: Record<string, number> = {};

export const FAIXAS_COMISSAO_FRETE: ReadonlyArray<{ minimo: number; comissao: number }> = [
  { minimo: 250, comissao: 22 },
  { minimo: 200, comissao: 16 },
  { minimo: 150, comissao: 13.5 },
  { minimo: 110, comissao: 10 },
];

export const NUMERO_DE_SEMANAS = 5;

export type TermoAceite = 'sim' | 'nao';

/** Um pedido do Nomus, já com os valores que a planilha usa. */
export interface PedidoComissao {
  id: number;
  codigo: string; // "PD 02338"
  dataEmissao: string; // aaaa-mm-dd
  vendedor: string;
  valorTotal: number;
  valorRecebido: number;
  quantidadeParafusos: number;
  valorParafusos: number;
  valorFrete: number;
}

export interface AjusteVendedor {
  valor: number; // positivo soma, negativo desconta
  observacao: string;
}

export interface PedidoCalculado extends PedidoComissao {
  /** Recebido ÷ valor da venda (0 a ~1); null se o valor da venda é zero. */
  percentual: number | null;
  semana: number;
  comissaoFrete: number;
  termoAceite: TermoAceite | null;
}

export interface ResumoVendedor {
  vendedor: string;
  pedidos: PedidoCalculado[];
  totalVendas: number;
  totalRecebido: number;
  /** Média simples dos % dos pedidos; null sem pedidos. */
  mediaPercentual: number | null;
  vendasPorSemana: number[];
  recebidoPorSemana: number[];
  quantidadeParafusos: number;
  valorParafusos: number;
  totalFrete: number;
  comissaoFrete: number;
  taxa: number;
  comissaoVendas: number;
  ajuste: AjusteVendedor | null;
  /** Comissão de vendas + comissão de frete + ajuste. */
  totalComissao: number;
}

const centavos = (n: number) => Math.round(n * 100) / 100;

export function comissaoDoFrete(valorFrete: number): number {
  return FAIXAS_COMISSAO_FRETE.find((faixa) => valorFrete >= faixa.minimo)?.comissao ?? 0;
}

/** Número da semana do ano como o WEEKNUM do Excel (a semana começa no domingo; a que tem 1º de janeiro é a 1). */
function semanaDoAno(ano: number, mes: number, dia: number): number {
  const data = Date.UTC(ano, mes - 1, dia);
  const primeiroDeJaneiro = Date.UTC(ano, 0, 1);
  const diaDoAno = Math.round((data - primeiroDeJaneiro) / 86_400_000) + 1;
  const diaDaSemanaDeJaneiro = new Date(primeiroDeJaneiro).getUTCDay();
  return Math.floor((diaDoAno - 1 + diaDaSemanaDeJaneiro) / 7) + 1;
}

/** Semana do mês (1 a 5, às vezes 6 em meses que começam no sábado) de uma data aaaa-mm-dd. */
export function semanaDoMes(dataIso: string): number {
  const [ano, mes, dia] = dataIso.split('-').map(Number);
  return semanaDoAno(ano, mes, dia) - semanaDoAno(ano, mes, 1) + 1;
}

export interface DadosManuais {
  /** Termo de aceite de cada pedido, pelo código ("PD 02338"). */
  termos: Record<string, TermoAceite>;
  /** Ajuste de cada vendedor, pelo nome. */
  ajustes: Record<string, AjusteVendedor>;
}

export function calcularComissoes(pedidos: PedidoComissao[], manuais: DadosManuais): ResumoVendedor[] {
  const porVendedor = new Map<string, PedidoComissao[]>();
  for (const pedido of pedidos) {
    const lista = porVendedor.get(pedido.vendedor) ?? [];
    lista.push(pedido);
    porVendedor.set(pedido.vendedor, lista);
  }
  // Vendedor sem pedido no mês mas com ajuste lançado também aparece.
  for (const nome of Object.keys(manuais.ajustes)) if (!porVendedor.has(nome)) porVendedor.set(nome, []);

  const resumos = [...porVendedor.entries()].map(([vendedor, lista]): ResumoVendedor => {
    const calculados = lista
      .map((p): PedidoCalculado => ({
        ...p,
        percentual: p.valorTotal > 0 ? p.valorRecebido / p.valorTotal : null,
        semana: semanaDoMes(p.dataEmissao),
        comissaoFrete: comissaoDoFrete(p.valorFrete),
        termoAceite: manuais.termos[p.codigo] ?? null,
      }))
      .sort((a, b) => a.dataEmissao.localeCompare(b.dataEmissao) || a.codigo.localeCompare(b.codigo, 'pt-BR', { numeric: true }));

    const vendasPorSemana = Array<number>(NUMERO_DE_SEMANAS).fill(0);
    const recebidoPorSemana = Array<number>(NUMERO_DE_SEMANAS).fill(0);
    for (const p of calculados) {
      const i = Math.min(Math.max(p.semana, 1), NUMERO_DE_SEMANAS) - 1; // uma 6ª semana (rara) soma na 5ª
      vendasPorSemana[i] += p.valorTotal;
      recebidoPorSemana[i] += p.valorRecebido;
    }
    const comPercentual = calculados.filter((p) => p.percentual !== null);
    const taxa = TAXAS_ESPECIAIS[vendedor] ?? TAXA_COMISSAO_PADRAO;
    const totalRecebido = centavos(calculados.reduce((s, p) => s + p.valorRecebido, 0));
    const comissaoFrete = centavos(calculados.reduce((s, p) => s + p.comissaoFrete, 0));
    const comissaoVendas = centavos(totalRecebido * taxa);
    const ajuste = manuais.ajustes[vendedor] ?? null;
    return {
      vendedor,
      pedidos: calculados,
      totalVendas: centavos(calculados.reduce((s, p) => s + p.valorTotal, 0)),
      totalRecebido,
      mediaPercentual: comPercentual.length > 0 ? comPercentual.reduce((s, p) => s + (p.percentual as number), 0) / comPercentual.length : null,
      vendasPorSemana: vendasPorSemana.map(centavos),
      recebidoPorSemana: recebidoPorSemana.map(centavos),
      quantidadeParafusos: calculados.reduce((s, p) => s + p.quantidadeParafusos, 0),
      valorParafusos: centavos(calculados.reduce((s, p) => s + p.valorParafusos, 0)),
      totalFrete: centavos(calculados.reduce((s, p) => s + p.valorFrete, 0)),
      comissaoFrete,
      taxa,
      comissaoVendas,
      ajuste,
      totalComissao: centavos(comissaoVendas + comissaoFrete + (ajuste?.valor ?? 0)),
    };
  });
  return resumos.sort((a, b) => b.totalVendas - a.totalVendas || a.vendedor.localeCompare(b.vendedor, 'pt-BR'));
}

export function somarResumos(resumos: ResumoVendedor[]) {
  const soma = (f: (r: ResumoVendedor) => number) => centavos(resumos.reduce((s, r) => s + f(r), 0));
  const comPercentual = resumos.flatMap((r) => r.pedidos).filter((p) => p.percentual !== null);
  return {
    pedidos: resumos.reduce((s, r) => s + r.pedidos.length, 0),
    totalVendas: soma((r) => r.totalVendas),
    totalRecebido: soma((r) => r.totalRecebido),
    mediaPercentual: comPercentual.length > 0 ? comPercentual.reduce((s, p) => s + (p.percentual as number), 0) / comPercentual.length : null,
    vendasPorSemana: Array.from({ length: NUMERO_DE_SEMANAS }, (_, i) => soma((r) => r.vendasPorSemana[i])),
    recebidoPorSemana: Array.from({ length: NUMERO_DE_SEMANAS }, (_, i) => soma((r) => r.recebidoPorSemana[i])),
    quantidadeParafusos: resumos.reduce((s, r) => s + r.quantidadeParafusos, 0),
    valorParafusos: soma((r) => r.valorParafusos),
    totalFrete: soma((r) => r.totalFrete),
    comissaoFrete: soma((r) => r.comissaoFrete),
    comissaoVendas: soma((r) => r.comissaoVendas),
    ajustes: soma((r) => r.ajuste?.valor ?? 0),
    totalComissao: soma((r) => r.totalComissao),
  };
}
