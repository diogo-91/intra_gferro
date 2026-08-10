// Formatação centralizada, padrão brasileiro. Não altera os valores reais,
// só a apresentação.

export const formatCurrency = (value: number) =>
  value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 });

export const formatMetrosQuadrados = (value: number) =>
  `${value.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} m²`;

export const formatInteiro = (value: number) => value.toLocaleString('pt-BR');

// Converte "dd/mm/aaaa" (formato usado nos vencimentos financeiros) pra Date local,
// sem passar por fusos/UTC do Date.parse (que interpretaria errado o formato BR).
export const parseDataBr = (data: string): Date => {
  const [dia, mes, ano] = data.split('/').map(Number);
  return new Date(ano, mes - 1, dia);
};

export const chaveDia = (data: Date): string => {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${data.getFullYear()}-${p(data.getMonth() + 1)}-${p(data.getDate())}`;
};

const PREPOSICOES_MINUSCULAS = new Set(['de', 'da', 'do', 'das', 'dos', 'e']);

// O Nomus retorna alguns nomes inteiramente em CAIXA ALTA. Convertemos só a
// exibição para Title Case; nomes já com capitalização mista (a maioria)
// passam direto, sem alterar o dado original.
export const formatNomeVendedor = (nome: string): string => {
  if (nome !== nome.toUpperCase()) return nome;

  return nome
    .toLowerCase()
    .split(' ')
    .map((palavra, index) =>
      index > 0 && PREPOSICOES_MINUSCULAS.has(palavra)
        ? palavra
        : palavra.charAt(0).toUpperCase() + palavra.slice(1)
    )
    .join(' ');
};
