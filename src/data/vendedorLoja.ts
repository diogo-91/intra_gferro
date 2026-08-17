// Mapeamento vendedor -> loja/unidade, passado diretamente pelo usuário
// (GFERRO) — mesmo padrão de classificacoesFinanceiras.ts. O Nomus não tem
// esse conceito de "loja" pros vendedores, então essa tabela é mantida à
// mão aqui. Confirmado com o usuário: "JAMES" = Jaymes Janolla e
// "ANDRESSA" = Andreza Soares Ribeiro de Andrade (grafias diferentes do
// Nomus). Alguns nomes da lista original (Laís, Ana Caroline, Maria,
// Virgínia, Telma, Vanessa) não batem com nenhum vendedor cadastrado no
// Nomus — provavelmente não têm perfil de vendedor lá, só de funcionário —
// e por isso ficam de fora até a GFERRO confirmar o nome exato.

export interface Loja {
  id: string;
  nome: string;
  /** Meta de vendas do mês, em R$ — passada diretamente pelo usuário (GFERRO). Sem meta definida = undefined. */
  metaVendas?: number;
}

export const LOJAS: Loja[] = [
  { id: 'petter', nome: 'Unidade 1 — Petter', metaVendas: 650000 },
  { id: 'lucas', nome: 'Unidade 2 — Lucas', metaVendas: 700000 },
  { id: 'paulo', nome: 'Unidade 3 — Paulo', metaVendas: 750000 },
  { id: 'correa', nome: 'Unidade 4 — Correa' },
];

// Nome do vendedor exatamente como vem do Nomus -> id da loja.
const VENDEDOR_LOJA: Record<string, string> = {
  'JAYMES JANOLLA': 'petter',
  'MARCELO BUGANZA JUNIOR': 'petter',
  'RAFAEL LUIZ AURO': 'petter',
  'Laís da Silva Gomes': 'petter',

  'EDER PULLHEIS': 'lucas',
  'Myrene Aparecida da Silva': 'lucas',
  'REBECA GONÇALVES': 'lucas',
  'Andreza Soares Ribeiro de Andrade': 'lucas',

  'SAMUEL WOLFGAN SILVA': 'paulo',
  'Elson Marcelo Braga da Silva': 'paulo',
  'SUMAIA LUCENA': 'paulo',
};

function normalizar(texto: string): string {
  return texto
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .trim()
    .toUpperCase();
}

const VENDEDOR_LOJA_NORMALIZADO: Record<string, string> = Object.fromEntries(
  Object.entries(VENDEDOR_LOJA).map(([nome, lojaId]) => [normalizar(nome), lojaId])
);

export function lojaDoVendedor(nome: string): string | undefined {
  return VENDEDOR_LOJA_NORMALIZADO[normalizar(nome)];
}
