// Composição fixa da Matéria Prima por tipo de material — informada pela
// GFERRO (não vem do Nomus, que não classifica insumo por material). Usada
// tanto na tela do Relatório Detalhado (src/components/ProgramacaoFinanceira.tsx)
// quanto no PDF equivalente (pdfRelatorioDetalhado.ts), pra nunca divergir.
export interface ItemComposicaoMateriaPrima {
  nome: string;
  pct: number;
}

export const COMPOSICAO_MATERIA_PRIMA: ItemComposicaoMateriaPrima[] = [
  { nome: 'Bobina', pct: 61 },
  { nome: 'EPS', pct: 17 },
  { nome: 'Forro Metálico', pct: 11 },
  { nome: 'Tinta', pct: 5 },
  { nome: 'Translúcida', pct: 2 },
  { nome: 'Aço', pct: 1 },
  { nome: 'Cola', pct: 1 },
  { nome: 'Consigás', pct: 1 },
];
