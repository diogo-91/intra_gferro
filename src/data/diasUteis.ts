// Dias úteis: segunda a sexta, menos os feriados nacionais (fixos e móveis) e o Carnaval. Sem dependências de
// servidor/navegador. Datas sempre em "AAAA-MM-DD"; as contas usam UTC para não sofrer com fuso e horário de verão.

const pad = (n: number) => String(n).padStart(2, '0');
const paraIso = (d: Date) => `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
const deIso = (iso: string) => { const [a, m, d] = iso.split('-').map(Number); return new Date(Date.UTC(a, m - 1, d)); };
const somarDiasCorridos = (iso: string, n: number) => { const d = deIso(iso); d.setUTCDate(d.getUTCDate() + n); return paraIso(d); };

/** Domingo de Páscoa (algoritmo de Meeus/Jones/Butcher). */
function pascoa(ano: number): string {
  const a = ano % 19, b = Math.floor(ano / 100), c = ano % 100;
  const d = Math.floor(b / 4), e = b % 4, f = Math.floor((b + 8) / 25), g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30, i = Math.floor(c / 4), k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7, m = Math.floor((a + 11 * h + 22 * l) / 451);
  const mes = Math.floor((h + l - 7 * m + 114) / 31), dia = ((h + l - 7 * m + 114) % 31) + 1;
  return `${ano}-${pad(mes)}-${pad(dia)}`;
}

const cacheFeriados = new Map<number, Set<string>>();

/** Feriados nacionais do ano, mais a terça e a segunda de Carnaval e a Sexta-feira Santa. */
export function feriadosDoAno(ano: number): Set<string> {
  const guardado = cacheFeriados.get(ano);
  if (guardado) return guardado;
  const p = pascoa(ano);
  const feriados = new Set<string>([
    `${ano}-01-01`, // Confraternização Universal
    somarDiasCorridos(p, -48), // Segunda de Carnaval
    somarDiasCorridos(p, -47), // Terça de Carnaval
    somarDiasCorridos(p, -2), // Sexta-feira Santa
    `${ano}-04-21`, // Tiradentes
    `${ano}-05-01`, // Dia do Trabalho
    `${ano}-09-07`, // Independência
    `${ano}-10-12`, // Nossa Senhora Aparecida
    `${ano}-11-02`, // Finados
    `${ano}-11-15`, // Proclamação da República
    ...(ano >= 2024 ? [`${ano}-11-20`] : []), // Consciência Negra (nacional desde 2024)
    `${ano}-12-25`, // Natal
  ]);
  cacheFeriados.set(ano, feriados);
  return feriados;
}

export function ehDiaUtil(iso: string): boolean {
  const dia = deIso(iso).getUTCDay();
  return dia !== 0 && dia !== 6 && !feriadosDoAno(Number(iso.slice(0, 4))).has(iso);
}

/** A data `n` dias úteis depois de `inicio` (o próprio dia de início não conta). */
export function somarDiasUteis(inicio: string, n: number): string {
  let atual = inicio;
  let restantes = n;
  while (restantes > 0) {
    atual = somarDiasCorridos(atual, 1);
    if (ehDiaUtil(atual)) restantes--;
  }
  return atual;
}

/** Dias úteis de `de` até `ate`, sem contar `de` e contando `ate` (negativo se `ate` é anterior). */
export function diasUteisEntre(de: string, ate: string): number {
  const [inicio, fim, sinal] = ate >= de ? [de, ate, 1] : [ate, de, -1];
  let atual = inicio;
  let n = 0;
  while (atual < fim) {
    atual = somarDiasCorridos(atual, 1);
    if (ehDiaUtil(atual)) n++;
  }
  return n * sinal;
}

/** Dias corridos de `de` até `ate` (negativo se `ate` é anterior). */
export const diasCorridosEntre = (de: string, ate: string) => Math.round((deIso(ate).getTime() - deIso(de).getTime()) / 86_400_000);
