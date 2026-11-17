// Relatório de placas de EPS (Dashboard Financeiro): custo da produção interna contra o preço de compra no fornecedor.
// Valores passados pela GFERRO. Sem dependências de servidor/navegador.

export type FamiliaEps = 'trapezio' | 'forro';

export interface PrecosFamiliaEps {
  familia: FamiliaEps;
  nome: string;
  /** Preço de um bloco de EPS (matéria-prima da produção interna), em R$. */
  precoBloco: number;
  /** Placas que saem de um bloco. */
  placasPorBloco: number;
  /** Preço de compra de uma placa pronta no fornecedor, em R$. */
  precoFornecedor: number;
}

export const PRECOS_EPS: Record<FamiliaEps, PrecosFamiliaEps> = {
  trapezio: { familia: 'trapezio', nome: 'Trapézio', precoBloco: 230, placasPorBloco: 40, precoFornecedor: 9.5 },
  forro: { familia: 'forro', nome: 'Telha forro', precoBloco: 230, placasPorBloco: 20, precoFornecedor: 9.5 },
};

/** Família do tipo de placa do Apontamento (TRAPEZIO_TR25, TRAPEZIO_TR40, FORRO_TR25, FORRO_TR40). */
export const familiaDoTipoEps = (tipo: string): FamiliaEps => (tipo.toUpperCase().startsWith('FORRO') ? 'forro' : 'trapezio');

const arredondar = (n: number) => Math.round(n * 100) / 100;

/** Custo de uma placa pela produção interna, sem perda (preço do bloco ÷ placas por bloco). */
export const custoPlacaInterna = (p: PrecosFamiliaEps) => arredondar(p.precoBloco / p.placasPorBloco);

export interface ComparativoEps {
  blocos: number;
  placas: number;
  /** O que a produção interna custou: blocos usados × preço do bloco (a perda já está no custo). */
  custoInterno: number;
  /** O que seria pago ao fornecedor por essas mesmas placas. */
  valorFornecedor: number;
  /** Fornecedor − produção interna. Positivo = a produção interna saiu mais barata. É o valor apontado como "Caixa 2". */
  diferenca: number;
  /** Diferença sobre o valor do fornecedor (null sem placas). */
  percentual: number | null;
}

export function compararEps(familia: FamiliaEps, blocos: number, placas: number): ComparativoEps {
  const p = PRECOS_EPS[familia];
  const custoInterno = arredondar(blocos * p.precoBloco);
  const valorFornecedor = arredondar(placas * p.precoFornecedor);
  const diferenca = arredondar(valorFornecedor - custoInterno);
  return { blocos, placas, custoInterno, valorFornecedor, diferenca, percentual: valorFornecedor > 0 ? diferenca / valorFornecedor : null };
}

/** Soma de vários comparativos (o percentual é refeito sobre o total). */
export function somarComparativos(lista: ComparativoEps[]): ComparativoEps {
  const blocos = lista.reduce((s, c) => s + c.blocos, 0);
  const placas = lista.reduce((s, c) => s + c.placas, 0);
  const custoInterno = arredondar(lista.reduce((s, c) => s + c.custoInterno, 0));
  const valorFornecedor = arredondar(lista.reduce((s, c) => s + c.valorFornecedor, 0));
  const diferenca = arredondar(valorFornecedor - custoInterno);
  return { blocos, placas, custoInterno, valorFornecedor, diferenca, percentual: valorFornecedor > 0 ? diferenca / valorFornecedor : null };
}
