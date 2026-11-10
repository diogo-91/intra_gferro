// Dashboard > Mapa: pedidos por cidade e por estado. A cidade vem do cadastro do cliente no Nomus. Sem dependências de
// servidor/navegador — usado pelos dois.

export const SIGLAS_UF = [
  'AC', 'AL', 'AP', 'AM', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA', 'MT', 'MS', 'MG', 'PA',
  'PB', 'PR', 'PE', 'PI', 'RJ', 'RN', 'RS', 'RO', 'RR', 'SC', 'SP', 'SE', 'TO',
] as const;

/** "Itapevi-SP", "São Paulo" -> "ITAPEVI", "SAO PAULO": comparação sem acento, caixa nem pontuação. */
export function normalizarCidade(texto: string): string {
  return String(texto ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^A-Za-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim().toUpperCase();
}

/** Município e UF do cadastro; aceita "Itapevi-SP" / "Itapevi/SP" no nome quando a UF vier vazia. */
export function separarCidadeEUf(municipio: string, uf: string): { cidade: string; uf: string } {
  let cidade = String(municipio ?? '').trim();
  let sigla = String(uf ?? '').trim().toUpperCase();
  const m = /^(.*?)\s*[-/]\s*([A-Za-z]{2})$/.exec(cidade);
  if (m && (SIGLAS_UF as readonly string[]).includes(m[2].toUpperCase())) {
    if (!(SIGLAS_UF as readonly string[]).includes(sigla)) sigla = m[2].toUpperCase();
    cidade = m[1].trim();
  }
  return { cidade, uf: (SIGLAS_UF as readonly string[]).includes(sigla) ? sigla : '' };
}

export interface LinhaMapa {
  cidade: string;
  uf: string;
  loja: string; // nome da loja do vendedor, ou "Sem loja"
  pedidos: number;
  valor: number;
}

/** Um pedido no mapa, para a lista que abre ao clicar na cidade. */
export interface PedidoDoMapa {
  codigo: string; // "PD 02208"
  cliente: string;
  cidade: string;
  uf: string;
  vendedor: string;
  loja: string;
  dataEmissao: string; // aaaa-mm-dd
  prazo: string | null; // aaaa-mm-dd — só na visão "a entregar"
  valor: number;
}

export interface RespostaMapa {
  /** 'periodo': pedidos emitidos no período. 'a-entregar': todos os pedidos que ainda não foram entregues (sem período). */
  modo: 'periodo' | 'a-entregar';
  inicio: string; // aaaa-mm-dd
  fim: string; // aaaa-mm-dd
  atualizadoEm: string; // ISO
  /** Só em 'a-entregar': o servidor está relendo os pedidos no Nomus. */
  atualizando?: boolean;
  /** Só em 'a-entregar': o histórico de pedidos em aberto ainda não foi lido por completo. */
  historicoParcial?: boolean;
  /** Nenhum dos meses do período foi lido ainda (primeira vez: leva alguns minutos). */
  carregando?: boolean;
  /** Meses do período que ainda estão sendo lidos no Nomus (os números são parciais). */
  mesesPendentes?: number;
  /** Pedidos cujo cliente ainda não teve a cidade lida no Nomus (os números são parciais). */
  pedidosPendentes?: number;
  erroAtualizacao?: string;
  totalPedidos: number;
  /** Pedidos cujo cliente não tem cidade/UF no cadastro. */
  semLocalizacao: { pedidos: number; valor: number };
  lojas: string[];
  linhas: LinhaMapa[];
  /** Cada pedido localizado (os mesmos que formam as linhas), do maior para o menor valor. */
  pedidos: PedidoDoMapa[];
}

export interface AgregadoCidade {
  cidade: string;
  uf: string;
  pedidos: number;
  valor: number;
}

export interface AgregadoEstado {
  uf: string;
  pedidos: number;
  valor: number;
  cidades: AgregadoCidade[]; // da maior para a menor
}

const arredondar = (valor: number) => Math.round(valor * 100) / 100;

/** Junta as linhas (opcionalmente só de uma loja) por cidade e por estado, do maior para o menor número de pedidos. */
export function agregarMapa(linhas: LinhaMapa[], loja: string | null = null): { estados: AgregadoEstado[]; cidades: AgregadoCidade[]; pedidos: number; valor: number } {
  const porCidade = new Map<string, AgregadoCidade>();
  for (const linha of linhas) {
    if (loja !== null && linha.loja !== loja) continue;
    const chave = `${linha.uf}|${normalizarCidade(linha.cidade)}`;
    const atual = porCidade.get(chave) ?? { cidade: linha.cidade, uf: linha.uf, pedidos: 0, valor: 0 };
    atual.pedidos += linha.pedidos;
    atual.valor += linha.valor;
    porCidade.set(chave, atual);
  }
  const cidades = [...porCidade.values()].map((c) => ({ ...c, valor: arredondar(c.valor) })).sort((a, b) => b.pedidos - a.pedidos || a.cidade.localeCompare(b.cidade, 'pt-BR'));
  const porEstado = new Map<string, AgregadoEstado>();
  for (const cidade of cidades) {
    const atual = porEstado.get(cidade.uf) ?? { uf: cidade.uf, pedidos: 0, valor: 0, cidades: [] };
    atual.pedidos += cidade.pedidos;
    atual.valor += cidade.valor;
    atual.cidades.push(cidade);
    porEstado.set(cidade.uf, atual);
  }
  const estados = [...porEstado.values()].map((e) => ({ ...e, valor: arredondar(e.valor) })).sort((a, b) => b.pedidos - a.pedidos);
  return { estados, cidades, pedidos: cidades.reduce((s, c) => s + c.pedidos, 0), valor: arredondar(cidades.reduce((s, c) => s + c.valor, 0)) };
}
