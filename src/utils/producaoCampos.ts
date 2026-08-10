// Funções puras portadas de "GFERO - APONTAMENTO PRODUCAO"
// (client/src/producaoCampos.js) — cálculo de período (dia/semana/mês),
// tendência vs período anterior, sparkline dos últimos dias, paginação local
// e exportação em CSV. Mantém a mesma semântica do painel original pra exibir
// exatamente as mesmas informações aqui na Intranet.

import { ApontamentoDetalhado, CentroProducao, QuantidadeProduzida } from '../types';

export type ModoPeriodoProducao = 'dia' | 'semana' | 'mes';

export interface IntervaloProducao {
  inicio: string; // "AAAA-MM-DD"
  fim: string; // "AAAA-MM-DD"
  rotulo: string;
}

function chaveData(d: Date): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

function inicioDaSemana(data: Date): Date {
  const d = new Date(data.getFullYear(), data.getMonth(), data.getDate());
  d.setDate(d.getDate() - d.getDay());
  return d;
}

const NOME_MES = [
  'janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho',
  'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro',
];

function rotuloDia(d: Date): string {
  return `${d.getDate()} de ${NOME_MES[d.getMonth()]} de ${d.getFullYear()}`;
}
function rotuloDiaSemAno(d: Date): string {
  return `${d.getDate()} de ${NOME_MES[d.getMonth()]}`;
}

export function intervaloDoPeriodo(modo: ModoPeriodoProducao, referencia: Date): IntervaloProducao {
  if (modo === 'dia') {
    const chave = chaveData(referencia);
    return { inicio: chave, fim: chave, rotulo: referencia.toLocaleDateString('pt-BR', { dateStyle: 'long' }) };
  }
  if (modo === 'semana') {
    const inicio = inicioDaSemana(referencia);
    const fim = new Date(inicio);
    fim.setDate(fim.getDate() + 6);
    const rotulo =
      inicio.getFullYear() === fim.getFullYear()
        ? `${rotuloDiaSemAno(inicio)} a ${rotuloDia(fim)}`
        : `${rotuloDia(inicio)} a ${rotuloDia(fim)}`;
    return { inicio: chaveData(inicio), fim: chaveData(fim), rotulo };
  }
  const inicio = new Date(referencia.getFullYear(), referencia.getMonth(), 1);
  const fim = new Date(referencia.getFullYear(), referencia.getMonth() + 1, 0);
  return {
    inicio: chaveData(inicio),
    fim: chaveData(fim),
    rotulo: `${NOME_MES[referencia.getMonth()]} de ${referencia.getFullYear()}`,
  };
}

export function navegarPeriodo(modo: ModoPeriodoProducao, referencia: Date, delta: number): Date {
  const d = new Date(referencia);
  if (modo === 'dia') d.setDate(d.getDate() + delta);
  else if (modo === 'semana') d.setDate(d.getDate() + delta * 7);
  else d.setMonth(d.getMonth() + delta);
  return d;
}

// ms -> "1h30" / "45min" / "2h" — formato compacto.
export function formatarDuracao(ms: number | null | undefined): string {
  const totalMin = Math.round((ms ?? 0) / 60_000);
  const h = Math.floor(totalMin / 60);
  const min = totalMin % 60;
  if (h === 0) return `${min}min`;
  if (min === 0) return `${h}h`;
  return `${h}h${String(min).padStart(2, '0')}`;
}

// A quantidade "principal" de um centro (unidade com maior total) — null se
// o centro não produziu nada no período.
export function quantidadePrincipal(quantidades: QuantidadeProduzida[] | undefined): QuantidadeProduzida | null {
  if (!quantidades || quantidades.length === 0) return null;
  return quantidades.reduce((maior, atual) => (atual.total > maior.total ? atual : maior));
}

export interface Tendencia {
  percentual: number | null;
  direcao: 'estavel' | 'novo' | 'alta' | 'baixa';
}

// Variação percentual vs período equivalente anterior. 'novo' quando não
// tinha nada antes mas passou a ter agora. 'estavel' quando os dois são zero,
// ou a diferença fica abaixo de 0,5%.
export function calcularTendencia(atual: number, anterior: number): Tendencia {
  if (anterior === 0) {
    if (atual === 0) return { percentual: 0, direcao: 'estavel' };
    return { percentual: null, direcao: 'novo' };
  }
  const percentual = ((atual - anterior) / anterior) * 100;
  if (Math.abs(percentual) < 0.5) return { percentual: 0, direcao: 'estavel' };
  return { percentual, direcao: percentual > 0 ? 'alta' : 'baixa' };
}

// "27/07/2026 17:53:07" (formato do Nomus) -> "2026-07-27".
export function chaveDoDiaNomus(dataHoraNomus: string | null | undefined): string | null {
  const [dataParte] = String(dataHoraNomus ?? '').split(' ');
  const [d, m, a] = dataParte.split('/');
  if (!d || !m || !a) return null;
  return `${a}-${m}-${d}`;
}

// As últimas `quantidade` chaves de dia, terminando (inclusive) em `fimChave`.
export function ultimosDias(fimChave: string, quantidade: number): string[] {
  const [a, m, d] = fimChave.split('-').map(Number);
  const fim = new Date(a, m - 1, d);
  const p = (n: number) => String(n).padStart(2, '0');
  return Array.from({ length: quantidade }, (_, i) => {
    const dia = new Date(fim);
    dia.setDate(dia.getDate() - (quantidade - 1 - i));
    return `${dia.getFullYear()}-${p(dia.getMonth() + 1)}-${p(dia.getDate())}`;
  });
}

// Soma a quantidade de todos os apontamentos de `centro` em cada dia — pro
// sparkline dos cards (mistura unidades, é só uma linha de tendência decorativa).
export function serieDiariaPorCentro(
  detalhado: ApontamentoDetalhado[],
  centro: string,
  diasChaves: string[]
): number[] {
  const porDia = new Map(diasChaves.map((d) => [d, 0]));
  for (const item of detalhado) {
    if (item.centro !== centro || item.quantidade == null) continue;
    const chave = chaveDoDiaNomus(item.dataHoraFinal);
    if (chave && porDia.has(chave)) porDia.set(chave, (porDia.get(chave) ?? 0) + item.quantidade);
  }
  return diasChaves.map((d) => porDia.get(d) ?? 0);
}

export function paginar<T>(itens: T[], pagina: number, tamanhoPagina: number) {
  const total = itens.length;
  const totalPaginas = Math.max(1, Math.ceil(total / tamanhoPagina));
  const paginaValida = Math.min(Math.max(1, pagina), totalPaginas);
  const inicio = (paginaValida - 1) * tamanhoPagina;
  return { pagina: paginaValida, totalPaginas, total, itens: itens.slice(inicio, inicio + tamanhoPagina) };
}

// Soma o valor estimado de todos os centros do período — null quando NENHUM
// centro tem valor resolvido ainda, pra distinguir de "somou e deu zero".
export function somarValorProduzido(porCentro: CentroProducao[] | undefined): number | null {
  const comValor = (porCentro ?? []).filter((c) => c.valorProduzido != null);
  if (comValor.length === 0) return null;
  return comValor.reduce((soma, c) => soma + (c.valorProduzido ?? 0), 0);
}

// Paleta fixa (não semântica) pra identificar cada centro nos gráficos/cards,
// na mesma ordem que já vem do servidor (fluxo físico: Corte, Pintura...).
const PALETA_CENTROS = ['#16a34a', '#2563eb', '#ea580c', '#7c3aed', '#db2777', '#0891b2', '#65a30d', '#d97706'];
export function corDoCentro(indice: number): string {
  return PALETA_CENTROS[indice % PALETA_CENTROS.length];
}

export function formatarNumeroBr(numero: number): string {
  return numero.toLocaleString('pt-BR', { maximumFractionDigits: 2 });
}

// Mesma formatação do painel original (2 casas decimais) — diferente do
// formatCurrency global da Intranet (que arredonda pra inteiro nos outros
// painéis), porque aqui os valores são estimativas rateadas e o original
// sempre mostra centavos.
export function formatarMoedaNumero(numero: number): string {
  return numero.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

const ABREVIACOES_UNIDADE: Record<string, string> = {
  'METRO QUADRADO': 'm²',
  'METRO CUBICO': 'm³',
  METRO: 'm',
  QUILOGRAMA: 'kg',
  GRAMA: 'g',
  TONELADA: 't',
  LITRO: 'l',
  UNIDADE: 'un',
  PECA: 'pç',
  CAIXA: 'cx',
};

export function formatarUnidade(unidade: string | null | undefined): string {
  if (!unidade) return '';
  const chave = unidade.trim().toUpperCase();
  if (ABREVIACOES_UNIDADE[chave]) return ABREVIACOES_UNIDADE[chave];
  return unidade.charAt(0) + unidade.slice(1).toLowerCase();
}

export function pluralizar(n: number, singular: string, plural: string): string {
  return n === 1 ? singular : plural;
}

function escaparCsv(valor: unknown): string {
  const texto = String(valor ?? '');
  return /[;"\n]/.test(texto) ? `"${texto.replace(/"/g, '""')}"` : texto;
}

// CSV pronto pra abrir no Excel em pt-BR: BOM UTF-8, ";" como separador.
export function gerarCsvRelatorioProducao(linhas: ApontamentoDetalhado[]): string {
  const cabecalho = ['Data/hora final', 'Centro de trabalho', 'OS', 'Etapa', 'Quantidade', 'Unidade', 'Colaborador', 'Duração', 'Valor estimado (R$)'];
  const corpo = linhas.map((d) =>
    [
      d.dataHoraFinal ?? '',
      d.centro,
      d.nomeOrdem ?? '',
      d.descricaoEtapa ?? '',
      d.quantidade != null ? String(d.quantidade).replace('.', ',') : '',
      d.unidadeMedida ?? '',
      d.funcionario ?? '',
      formatarDuracao(d.duracaoMs),
      d.valorProduzido != null ? d.valorProduzido.toFixed(2).replace('.', ',') : '',
    ]
      .map(escaparCsv)
      .join(';')
  );
  return '﻿' + [cabecalho.join(';'), ...corpo].join('\r\n');
}
