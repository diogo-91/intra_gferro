export interface SemanaMes {
  inicio: number;
  fim: number;
  diasTrabalhados: number;
}

export function semanasDoMes(ano: number, mes: number): SemanaMes[] {
  const ultimoDia = new Date(ano, mes + 1, 0).getDate();
  const semanas: SemanaMes[] = [];
  let inicio = 1;
  while (inicio <= ultimoDia) {
    const diaSemana = new Date(ano, mes, inicio).getDay();
    const ateDomingo = diaSemana === 0 ? 0 : 7 - diaSemana;
    const fim = Math.min(ultimoDia, inicio + ateDomingo);
    let diasTrabalhados = 0;
    for (let dia = inicio; dia <= fim; dia += 1) {
      if (new Date(ano, mes, dia).getDay() !== 0) diasTrabalhados += 1;
    }
    semanas.push({ inicio, fim, diasTrabalhados });
    inicio = fim + 1;
  }
  return semanas;
}

export function calcularMetasSemanais({
  metaMensal,
  semanas,
  realizados,
  ano,
  mes,
  hoje = new Date(),
}: {
  metaMensal: number;
  semanas: readonly SemanaMes[];
  realizados?: readonly number[];
  ano: number;
  mes: number;
  hoje?: Date;
}): number[] {
  const metaCentavos = Math.round(Math.max(0, metaMensal) * 100);
  const diasTrabalhados = semanas.reduce((total, semana) => total + semana.diasTrabalhados, 0);
  let diasAcumulados = 0;
  let distribuido = 0;
  // Antes do primeiro fechamento, mantém o planejamento por dias úteis.
  const metas = semanas.map((semana) => {
    diasAcumulados += semana.diasTrabalhados;
    const acumulado = diasTrabalhados ? Math.round(metaCentavos * diasAcumulados / diasTrabalhados) : 0;
    const valor = acumulado - distribuido;
    distribuido = acumulado;
    return valor;
  });

  // Sem dados carregados, não considera semanas sem vendas como déficit.
  if (!realizados) return metas.map((valor) => valor / 100);

  let realizadoAcumulado = 0;
  for (let indice = 0; indice < semanas.length - 1; indice += 1) {
    const encerramento = new Date(ano, mes, semanas[indice].fim + 1);
    if (hoje < encerramento) break;
    realizadoAcumulado += Math.round((realizados[indice] ?? 0) * 100);
    // Subtrair o realizado fechado da meta mensal evita contar o saldo duas vezes.
    const restante = Math.max(0, metaCentavos - realizadoAcumulado);
    const quantidade = semanas.length - indice - 1;
    const parcela = Math.floor(restante / quantidade);
    const centavosExtras = restante % quantidade;
    for (let proxima = indice + 1; proxima < semanas.length; proxima += 1) {
      metas[proxima] = parcela + (proxima - indice - 1 < centavosExtras ? 1 : 0);
    }
  }
  return metas.map((valor) => valor / 100);
}
