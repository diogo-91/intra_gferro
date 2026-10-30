// Saídas do caixa (Financeiro > Saídas): o que foi pago no período, agrupado pelos
// títulos da DRE (grupo da classificação financeira) e, dentro de cada um, por
// classificação e por fornecedor. Sem dependências de servidor/navegador — usado pelos dois.

import { grupoDaClassificacaoPorNome } from './data/classificacoesFinanceiras';
import type { ContaConcluida } from './types';

export const GRUPO_SEM_CLASSIFICACAO = 'Sem classificação';

export interface SaidaItem {
  nome: string;
  total: number;
  quantidade: number;
}

export interface SaidaGrupo extends SaidaItem {
  /** Fatia do total pago no período (0 a 100). */
  percentual: number;
  categorias: SaidaItem[];
  fornecedores: SaidaItem[];
}

export interface RespostaSaidas {
  inicio: string; // aaaa-mm-dd
  fim: string; // aaaa-mm-dd
  total: number;
  quantidade: number;
  atualizadoEm: string; // ISO
  grupos: SaidaGrupo[]; // do que mais saiu para o que menos saiu
}

// "dd/mm/aaaa" (data de baixa do Nomus) -> "aaaa-mm-dd"; vazio quando não for uma data.
function dataBrParaIso(texto: string): string {
  const m = /^(\d{2})\/(\d{2})\/(\d{4})/.exec(texto ?? '');
  return m ? `${m[3]}-${m[2]}-${m[1]}` : '';
}

function somar(mapa: Map<string, SaidaItem>, nome: string, valor: number) {
  const atual = mapa.get(nome) ?? { nome, total: 0, quantidade: 0 };
  atual.total += valor;
  atual.quantidade += 1;
  mapa.set(nome, atual);
}

const arredondar = (valor: number) => Math.round(valor * 100) / 100;
const maiorPrimeiro = (a: SaidaItem, b: SaidaItem) => b.total - a.total || a.nome.localeCompare(b.nome, 'pt-BR');
const finalizar = (mapa: Map<string, SaidaItem>): SaidaItem[] =>
  [...mapa.values()].map((item) => ({ ...item, total: arredondar(item.total) })).sort(maiorPrimeiro);

/** Agrupa os pagamentos (tipo "pagar") feitos entre `inicio` e `fim`, inclusive. */
export function agruparSaidas(contas: ContaConcluida[], inicio: string, fim: string, atualizadoEm: string): RespostaSaidas {
  const grupos = new Map<string, { item: SaidaItem; categorias: Map<string, SaidaItem>; fornecedores: Map<string, SaidaItem> }>();
  let total = 0;
  let quantidade = 0;

  for (const conta of contas) {
    if (conta.tipo !== 'pagar') continue;
    const dia = dataBrParaIso(conta.dataBaixa);
    if (!dia || dia < inicio || dia > fim) continue;
    const valor = Math.abs(conta.valor);
    if (!Number.isFinite(valor) || valor === 0) continue;

    // Resumos guardados antes de existir o grupo não o trazem: descobre pelo nome da classificação.
    const nomeGrupo = conta.grupo || (conta.categoria && grupoDaClassificacaoPorNome(conta.categoria)) || GRUPO_SEM_CLASSIFICACAO;
    const grupo = grupos.get(nomeGrupo) ?? { item: { nome: nomeGrupo, total: 0, quantidade: 0 }, categorias: new Map(), fornecedores: new Map() };
    grupo.item.total += valor;
    grupo.item.quantidade += 1;
    somar(grupo.categorias, conta.categoria || GRUPO_SEM_CLASSIFICACAO, valor);
    somar(grupo.fornecedores, conta.pessoa || 'Sem fornecedor', valor);
    grupos.set(nomeGrupo, grupo);
    total += valor;
    quantidade += 1;
  }

  const lista: SaidaGrupo[] = [...grupos.values()]
    .map(({ item, categorias, fornecedores }) => ({
      ...item,
      total: arredondar(item.total),
      percentual: total > 0 ? Math.round((item.total / total) * 1000) / 10 : 0,
      categorias: finalizar(categorias),
      fornecedores: finalizar(fornecedores).slice(0, 10),
    }))
    .sort(maiorPrimeiro);

  return { inicio, fim, total: arredondar(total), quantidade, atualizadoEm, grupos: lista };
}
