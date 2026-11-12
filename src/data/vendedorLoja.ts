// Mapeamento vendedor -> loja/unidade, passado diretamente pelo usuário
// (GFERRO) — mesmo padrão de classificacoesFinanceiras.ts. O Nomus não tem
// esse conceito de "loja" pros vendedores, então essa tabela é mantida à
// mão aqui. Confirmado com o usuário: "JAMES" = Jaymes Janolla e
// "ANDRESSA" = Andreza Soares Ribeiro de Andrade (grafias diferentes do
// Nomus). Virgínia ainda não aparece no cadastro de vendedores retornado
// pela API; alguns vínculos por primeiro nome ficam preparados e passam a
// valer quando o vendedor for cadastrado com seu nome completo.

export interface Loja {
  id: string;
  nome: string;
  /** Meta de vendas do mês, em R$ — passada diretamente pelo usuário (GFERRO). Sem meta definida = undefined. */
  metaVendas?: number;
}

export const LOJAS = [
  { id: 'petter', nome: 'Unidade 1 — Petter', metaVendas: 650000 },
  { id: 'lucas', nome: 'Unidade 2', metaVendas: 700000 },
  { id: 'paulo', nome: 'Unidade 3 — Paulo', metaVendas: 750000 },
  { id: 'correa', nome: 'Unidade 4 — José', metaVendas: 250000 },
  { id: 'tatui', nome: 'Unidade 5 — Tatuí', metaVendas: 250000 },
] as const satisfies readonly Loja[];

export type LojaId = (typeof LOJAS)[number]['id'];

// Nome do vendedor exatamente como vem do Nomus -> id da loja.
const VENDEDOR_LOJA: Record<string, string> = {
  'JAYMES JANOLLA': 'petter',
  'MARCELO BUGANZA JUNIOR': 'petter',
  'RAFAEL LUIZ AURO': 'petter',
  'Laís da Silva Gomes': 'petter',

  'Myrene Aparecida da Silva': 'lucas',
  'REBECA GONÇALVES': 'lucas',
  'Andreza Soares Ribeiro de Andrade': 'lucas',
  'Ana Caroline Paz Basseto': 'lucas',
  'Gilberto Del Poço': 'lucas',
  'Luiz Monteiro': 'lucas',
  'LUIZ MARCOS MONTEIRO': 'lucas', // cadastro antigo do mesmo vendedor
  'Edson Cavalcante': 'lucas',
  'EDSON RODRIGUES CAVALCANTE': 'lucas', // cadastro antigo do mesmo vendedor
  'LUCAS AMARAL COSTA': 'lucas',

  'SAMUEL WOLFGAN SILVA': 'paulo',
  'Elson Marcelo Braga da Silva': 'paulo',
  'SUMAIA LUCENA': 'paulo',
  'Tatiane Cristina de Moraes': 'paulo',
  'EDER PULLHEIS': 'paulo',

  'MARIA DE FATIMA DE SOUZA CAMPOS': 'correa',
  'Telma Carlos Gomes de Camargo': 'correa',
  'Vanessa Pereira Bezerra': 'correa',
  'Virgínia': 'correa',
  'Daniele Cardoso Vargas': 'correa',

  'Bruno Felipe Santos Bezerra': 'tatui',
  'Jeferson Antonio Corrêa': 'tatui',
  'Ana Claudia Bastos Vieira': 'tatui',
  'Rodrigo Carriel Ferreira Reigota': 'tatui',
  'Sabrina Fernanda Rodrigues dos Santos': 'tatui',
  'Alisson': 'tatui',
  'Rosemeire Lopes Eleutério': 'tatui',
  'Hamilton Ricardo Gonçalves': 'tatui',
  'Samuel Rodrigues da silva': 'tatui', // gerente da Unidade 5
  'Luiz Felipe Cury Hilal': 'tatui',
};

// Vendedores informados pela GFERRO que ainda não aparecem na API do Nomus.
// O prefixo permite reconhecer automaticamente "Nome + sobrenomes" quando o
// cadastro for criado, sem exigir uma nova publicação da intranet.
const VENDEDOR_LOJA_POR_PRIMEIRO_NOME: Record<string, string> = {
  'JEFERSON': 'tatui',
  'JEFFERSON': 'tatui',
  'RODRIGO': 'tatui',
  'SABRINA': 'tatui',
  'ALISSON': 'tatui',
  'ROSEMEIRE': 'tatui',
};

function normalizar(texto: string): string {
  return texto
    .replace(/(?:&#x20;|&#32;|&nbsp;)/gi, ' ')
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .trim()
    .toUpperCase();
}

const VENDEDOR_LOJA_NORMALIZADO: Record<string, string> = Object.fromEntries(
  Object.entries(VENDEDOR_LOJA).map(([nome, lojaId]) => [normalizar(nome), lojaId])
);

// Vendedores que têm dois cadastros no Nomus (o antigo e o novo) são a mesma pessoa: nas telas aparecem como um só,
// com as vendas somadas. Chave: nome do cadastro antigo; valor: nome que passa a valer.
const NOME_CANONICO_NORMALIZADO: Record<string, string> = {
  [normalizar('LUIZ MARCOS MONTEIRO')]: 'Luiz Monteiro',
  [normalizar('EDSON RODRIGUES CAVALCANTE')]: 'Edson Cavalcante',
};

export function nomeCanonicoDoVendedor(nome: string): string {
  return NOME_CANONICO_NORMALIZADO[normalizar(nome)] ?? nome;
}

export function lojaDoVendedor(nome: string): string | undefined {
  const nomeNormalizado = normalizar(nome);
  const vinculoExato = VENDEDOR_LOJA_NORMALIZADO[nomeNormalizado];
  if (vinculoExato) return vinculoExato;

  const primeiroNome = nomeNormalizado.split(/\s+/)[0];
  return VENDEDOR_LOJA_POR_PRIMEIRO_NOME[primeiroNome];
}
