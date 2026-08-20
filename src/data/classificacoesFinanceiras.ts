// Catálogo oficial das Classificações Financeiras do Nomus da GFERRO — passado
// diretamente pelo usuário (consolidado das telas de Classificação do Nomus,
// pasta "Financeiro"). Isto substitui a tentativa anterior de "aprender" a
// tradução código -> nome a partir do histórico de baixas: aquilo cobria só
// os códigos usados recentemente e custava buscas extras no Nomus a cada
// atualização. Esta tabela é fixa, completa e não depende de nenhuma
// chamada de API — se a GFERRO cadastrar um código novo no Nomus, é só
// adicionar a linha aqui.

export const GRUPOS_CLASSIFICACAO_FINANCEIRA: Record<string, string> = {
  '1': 'Receita Bruta',
  '2': 'Dedução de Receita Bruta',
  '4': 'CMV / CPV / CSV',
  '6': 'Despesa Administrativa',
  '7': 'Despesas RH',
  '8': 'Manutenção',
  '9': 'Despesa Logística',
  '10': 'Marketing',
  '11': 'Pró-Labore',
  '12': 'Investimento e Aquisições',
  '13': 'Despesa Financeira',
  '14': 'Receita Financeira',
  '15': 'Empréstimos',
  '16': 'Ajustes de Saldo',
};

export const CLASSIFICACOES_FINANCEIRAS: Record<string, string> = {
  // 1 — Receita Bruta
  '1.1': 'Entrada por entrega',
  '1.4': 'Vendas de Sucatas',
  '1.6': 'Entrada por vendas',

  // 2 — Dedução de Receita Bruta
  '2.1': 'Comissão de Vendas Externas',
  '2.2': 'Comissão Vendas Internas',
  '2.3': 'Devoluções',
  '2.4': 'DAS — Simples Nacional',
  '2.5': 'Frete',

  // 4 — CMV / CPV / CSV
  '4.1': 'Compra de Aço',
  '4.2': 'Compra de Bobinas',
  '4.3': 'Compra de Cola',
  '4.4': 'Compra de EPS',
  '4.5': 'Compra de Parafusos',
  '4.6': 'Compra de Forro Metálico',
  '4.7': 'Compra de Forro PVC',
  '4.8': 'Compra de Tinta',
  '4.9': 'Energia Elétrica',
  '4.10': 'Consigás',
  '4.11': 'Insumo de Produção',
  '4.12': 'Locação e Equipamentos',

  // 6 — Despesa Administrativa
  '6.1': 'Água',
  '6.2': 'Aluguel',
  '6.3': 'Assessoria Financeira',
  '6.4': 'Assessoria Jurídica',
  '6.5': 'Contador',
  '6.6': 'Internet',
  '6.7': 'IPTU',
  '6.8': 'Material de Escritório',
  '6.9': 'Material de Limpeza',
  '6.10': 'Reembolso de Despesa',
  '6.11': 'EPIs',
  '6.12': 'Uniforme',
  '6.13': 'Sistema ERP',
  '6.14': 'Sistema de Ponto Eletrônico',
  '6.15': 'Despesas com Café/Padaria',
  '6.16': 'Entrega/Coleta de Ofícios — Motoboy',
  '6.17': 'Plataformas de Divulgação de Vagas',

  // 7 — Despesas RH
  '7.1': 'Adiantamento Salário',
  '7.2': 'Salário',
  '7.3': 'Horas Extras — Administrativo',
  '7.4': 'Premiação',
  '7.5': '13º Salário',
  '7.6': 'Férias',
  '7.7': 'Rescisão',
  '7.8': 'Refeitório — Vale-Alimentação',
  '7.9': 'Vale-Transporte',
  '7.10': 'Cesta Básica',
  '7.11': 'Convênio',
  '7.12': 'INSS',
  '7.13': 'FGTS',
  '7.14': 'Imposto de Renda — IR',
  '7.15': 'Contribuição Sindical',
  '7.16': 'Despesas Saúde Ocupacional',
  '7.17': 'Ajuda de Custos',
  '7.18': 'Seguro de Vida de Colaboradores',
  '7.19': 'Pagamento de Serviços a Parceiros',
  '7.20': 'Hora Extra — Produção',
  '7.21': 'Hora Extra — Logística',

  // 8 — Manutenção
  '8.1': 'Manutenção de Ar-Condicionado',
  '8.2': 'Manutenção de Telefonia',
  '8.3': 'Manutenção de Equipamentos de Informática',
  '8.4': 'Manutenção de Infraestrutura',
  '8.5': 'Manutenção de Máquinas',
  '8.6': 'Manutenção de Ferramentas',

  // 9 — Despesa Logística
  '9.1': 'Seguro Veicular',
  '9.2': 'Aluguel de Caminhão',
  '9.3': 'IPVA',
  '9.4': 'Licenciamento',
  '9.5': 'Diesel',
  '9.6': 'Combustível',
  '9.7': 'Manutenção Veicular',
  '9.8': 'Pedágio',
  '9.9': 'Frete',
  '9.10': 'Multa',
  '9.11': 'Refeição',
  '9.12': 'Despesas de Hospedagem',

  // 10 — Marketing
  '10.1': 'Redes Sociais',
  '10.2': 'Site',
  '10.3': 'E-mail',
  '10.4': 'Publicidade',
  '10.5': 'Layout — Gráfica',
  '10.6': 'Brindes',

  // 11 — Pró-Labore
  '11.1': 'Raquel',
  '11.2': 'Samara',
  '11.3': 'Wellington',
  '11.4': 'Wesley',

  // 12 — Investimento e Aquisições
  '12.1': 'Compra de Veículos',
  '12.2': 'Compra de Equipamentos',
  '12.3': 'Compra de Mobiliário',
  '12.4': 'Investimentos em Infraestrutura',
  '12.5': 'Venda de veículos',
  '12.6': 'Venda de equipamentos',
  '12.7': 'Seguro Patrimonial',

  // 13 — Despesa Financeira
  '13.1': 'IOF',
  '13.2': 'Tarifas Bancárias',
  '13.3': 'Tarifas PIX',
  '13.4': 'Taxa de Máquina de Cartão',
  '13.5': 'Tarifa de Cheque',
  '13.6': 'Juros de Fornecedores',

  // 14 — Receita Financeira
  '14.1': 'Investimento em Aplicações Financeiras',
  '14.2': 'Resgate de aplicações financeiras',
  '14.3': 'Ganhos com aplicações financeiras',
  '14.4': 'Perdas com Aplicações Financeiras',

  // 15 — Empréstimos
  '15.1': 'Liberação de empréstimo',
  '15.2': 'Pagamento de Empréstimo',
  '15.3': 'Aporte de investimento de sócios',
  '15.4': 'Pagamento de Investimento de Sócios',
  '15.5': 'Parcelamento de Impostos',
  '15.6': 'Acordos Judiciais — Fornecedores',
  '15.7': 'Acordos Judiciais — Cliente',

  // 16 — Ajustes de Saldo
  '16.2': 'Saída para Ajuste de Saldo Inicial',
  '16.4': 'Saída por Transferência Bancária',
};

export function nomeClassificacaoFinanceira(codigo: string): string | undefined {
  return CLASSIFICACOES_FINANCEIRAS[codigo];
}

export function grupoDaClassificacao(codigo: string): string | undefined {
  const codigoGrupo = codigo.split('.')[0];
  return GRUPOS_CLASSIFICACAO_FINANCEIRA[codigoGrupo];
}

// Índice reverso nome -> código "grupo.sub" — para endpoints que só devolvem
// o nome já resolvido (ex.: /recebimentos, /pagamentos), sem o código.
function normalizarNomeClassificacao(nome: string): string {
  return nome
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9]/g, '')
    .toLowerCase();
}

const CODIGO_POR_NOME: Record<string, string> = Object.fromEntries(
  Object.entries(CLASSIFICACOES_FINANCEIRAS).map(([codigo, nome]) => [normalizarNomeClassificacao(nome), codigo])
);

export function grupoDaClassificacaoPorNome(nome: string): string | undefined {
  const codigo = codigoClassificacaoPorNome(nome);
  return codigo ? grupoDaClassificacao(codigo) : undefined;
}

export function codigoClassificacaoPorNome(nome: string): string | undefined {
  return CODIGO_POR_NOME[normalizarNomeClassificacao(nome)];
}
