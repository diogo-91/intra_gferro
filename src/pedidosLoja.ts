// Relação de pedidos de uma loja (Vendas > loja > Pedidos): situação de prazo de
// cada pedido, calculada a partir da data de entrega (dataEntrega) e do status
// dos itens no Nomus. Sem dependências de servidor/navegador — usado pelos dois.

export type SituacaoPrazo = 'atrasado' | 'vence-em-breve' | 'no-prazo' | 'concluido' | 'cancelado' | 'sem-prazo';

// Um pedido "vence em breve" quando faltam até esta quantidade de dias para a entrega.
export const DIAS_ALERTA_PRAZO = 3;

export interface PedidoLojaLinha {
  id: number;
  codigo: string; // ex.: "PD 02208"
  dataEmissao: string; // aaaa-mm-dd
  vendedor: string;
  valorTotal: number;
  situacao: SituacaoPrazo;
  etapa: string; // fase do pedido no Nomus (Aguardando liberação, Liberado...)
  prazo: string | null; // aaaa-mm-dd — próxima data de entrega ainda pendente
  diasParaPrazo: number | null; // negativo = dias de atraso
  prazoGferro?: string | null; // aaaa-mm-dd — prazo de entrega combinado no PCP (preenchido pelo servidor)
  prazoGferroPendente?: boolean; // true enquanto o PCP ainda não respondeu para este pedido
}

export interface RespostaPedidosLoja {
  lojaId: string;
  atualizadoEm: string; // ISO
  fechamentoOficial?: boolean; // período fechado à mão: não há pedidos individuais
  carregando?: boolean; // o servidor ainda está lendo o período no Nomus (primeira vez): pergunte de novo em instantes
  pedidos: PedidoLojaLinha[];
}

// Status do item de pedido de venda no Nomus (ver doc da API de pedidos).
const CANCELADOS = new Set([6, 8]); // Cancelado, Devolvido totalmente
const CONCLUIDOS = new Set([4, 5, 7, 10]); // Atendido totalmente/com corte, Devolvido parcialmente, Entregue
const ETAPA_PENDENTE: Record<number, string> = { 1: 'Aguardando liberação', 2: 'Liberado', 3: 'Atendido parcialmente', 9: 'Enviado' };
const ORDEM_PENDENTE = [1, 2, 3, 9];

export interface ItemParaPrazo {
  status?: number;
  dataEntrega?: string; // "dd/mm/aaaa" ou "dd/mm/aaaa HH:mm:ss"
}

function lerDataBr(texto?: string): Date | null {
  if (!texto) return null;
  const [dia, mes, ano] = texto.split(' ')[0].split('/').map(Number);
  if (!dia || !mes || !ano) return null;
  const data = new Date(ano, mes - 1, dia);
  return data.getFullYear() === ano && data.getMonth() === mes - 1 && data.getDate() === dia ? data : null;
}

export function dataBrParaIso(texto?: string): string {
  const data = lerDataBr(texto);
  if (!data) return '';
  return `${data.getFullYear()}-${String(data.getMonth() + 1).padStart(2, '0')}-${String(data.getDate()).padStart(2, '0')}`;
}

export function classificarPrazoPedido(
  itens: ItemParaPrazo[],
  hoje: Date,
  diasAlerta: number = DIAS_ALERTA_PRAZO
): { situacao: SituacaoPrazo; etapa: string; prazo: string | null; diasParaPrazo: number | null } {
  const hoje0h = new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate());
  if (itens.length === 0) return { situacao: 'sem-prazo', etapa: 'Sem itens', prazo: null, diasParaPrazo: null };

  if (itens.every((item) => item.status != null && CANCELADOS.has(item.status))) {
    return { situacao: 'cancelado', etapa: itens.every((item) => item.status === 8) ? 'Devolvido' : 'Cancelado', prazo: null, diasParaPrazo: null };
  }

  const ativos = itens.filter((item) => !(item.status != null && CANCELADOS.has(item.status)));
  const pendentes = ativos.filter((item) => !(item.status != null && CONCLUIDOS.has(item.status)));

  if (pendentes.length === 0) {
    return { situacao: 'concluido', etapa: ativos.every((item) => item.status === 10) ? 'Entregue' : 'Atendido', prazo: null, diasParaPrazo: null };
  }

  // Fase do pedido = a menos avançada entre os itens que ainda faltam.
  const statusPendentes = pendentes.map((item) => item.status ?? 1);
  const faseMenosAvancada = ORDEM_PENDENTE.find((codigo) => statusPendentes.includes(codigo)) ?? statusPendentes[0];
  const etapa = ETAPA_PENDENTE[faseMenosAvancada] ?? 'Em andamento';

  // Prazo = a entrega mais próxima entre os itens pendentes.
  const datas = pendentes.map((item) => lerDataBr(item.dataEntrega)).filter((data): data is Date => data !== null);
  if (datas.length === 0) return { situacao: 'sem-prazo', etapa, prazo: null, diasParaPrazo: null };
  const prazoData = new Date(Math.min(...datas.map((data) => data.getTime())));
  const diasParaPrazo = Math.round((prazoData.getTime() - hoje0h.getTime()) / 86_400_000);
  const prazo = `${prazoData.getFullYear()}-${String(prazoData.getMonth() + 1).padStart(2, '0')}-${String(prazoData.getDate()).padStart(2, '0')}`;
  const situacao: SituacaoPrazo = diasParaPrazo < 0 ? 'atrasado' : diasParaPrazo <= diasAlerta ? 'vence-em-breve' : 'no-prazo';
  return { situacao, etapa, prazo, diasParaPrazo };
}

// Estrutura mínima do pedido do Nomus usada aqui (evita importar o módulo pesado do Nomus).
export interface PedidoNomusMinimo {
  id: number;
  codigoPedido?: string;
  dataEmissao?: string;
  valorTotal?: string | number;
  itensPedido?: ItemParaPrazo[];
}

function lerValorBr(valor: unknown): number {
  if (typeof valor === 'number') return valor;
  let s = String(valor ?? '0').trim();
  if (s.includes(',') && s.includes('.')) s = s.replace(/\./g, '').replace(',', '.');
  else if (s.includes(',')) s = s.replace(',', '.');
  const n = parseFloat(s);
  return Number.isNaN(n) ? 0 : n;
}

// Ordem da relação: o que exige ação primeiro (mais atrasado, depois o que vence primeiro).
const PESO_SITUACAO: Record<SituacaoPrazo, number> = { 'atrasado': 0, 'vence-em-breve': 1, 'no-prazo': 2, 'sem-prazo': 3, 'concluido': 4, 'cancelado': 5 };

export function montarLinhasPedidosLoja(
  pedidos: Array<{ pedido: PedidoNomusMinimo; vendedor: string }>,
  hoje: Date = new Date()
): PedidoLojaLinha[] {
  return pedidos
    .map(({ pedido, vendedor }): PedidoLojaLinha => ({
      id: pedido.id,
      codigo: pedido.codigoPedido || `Pedido #${pedido.id}`,
      dataEmissao: dataBrParaIso(pedido.dataEmissao),
      vendedor,
      valorTotal: lerValorBr(pedido.valorTotal),
      ...classificarPrazoPedido(pedido.itensPedido ?? [], hoje),
    }))
    .sort((a, b) =>
      PESO_SITUACAO[a.situacao] - PESO_SITUACAO[b.situacao]
      || (a.diasParaPrazo ?? 0) - (b.diasParaPrazo ?? 0)
      || b.dataEmissao.localeCompare(a.dataEmissao)
      || b.codigo.localeCompare(a.codigo)
    );
}
