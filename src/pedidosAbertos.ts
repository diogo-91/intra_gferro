// Dashboard > Pedidos: pedidos com status Liberado no Nomus (ainda em aberto), com vendedor, loja, atraso em dias e o
// que ainda há a receber. Sem dependências de servidor/navegador — usado pelos dois.

import { DIAS_ALERTA_PRAZO, classificarPrazoPedido, dataBrParaIso, type ItemParaPrazo } from './pedidosLoja';

export type SituacaoPedidoAberto = 'atrasado' | 'vence-em-breve' | 'no-prazo' | 'sem-prazo' | 'entregue-pcp';

export interface PedidoAbertoLinha {
  id: number;
  codigo: string; // "PD 02208"
  cliente: string;
  vendedor: string;
  loja: string; // nome da loja, ou "Sem loja"
  dataEmissao: string; // aaaa-mm-dd
  valorTotal: number;
  etapa: string; // fase no Nomus (Aguardando liberação, Liberado...)
  statusPcp: string; // status na tela "Controle de pedidos" do PCP ("" se o PCP não conhece o pedido)
  prazoNomus: string | null; // aaaa-mm-dd — próxima entrega pendente nos itens
  prazoGferro: string | null; // aaaa-mm-dd — prazo combinado no PCP
  prazo: string | null; // o prazo usado no cálculo: o Gferro, ou o do Nomus quando o PCP não tem
  fontePrazo: 'gferro' | 'nomus' | null;
  situacao: SituacaoPedidoAberto;
  diasParaPrazo: number | null; // negativo = dias de atraso
  diasAtraso: number; // 0 quando não está atrasado
  /** null enquanto o servidor ainda lê o financeiro deste pedido. */
  recebido: number | null;
  aReceber: number | null; // valor do pedido que ainda não entrou (mesmo sem parcela lançada)
  titulosAbertos: number; // parcelas lançadas e ainda não quitadas
  saldoEmTitulos: number; // soma do que falta nessas parcelas
  vencidoReceber: number; // parte desse saldo com vencimento já passado
  proximoVencimento: string | null; // aaaa-mm-dd — vencimento mais próximo (ou o mais antigo, se já venceu)
}

export interface RespostaPedidosAbertos {
  atualizadoEm: string; // ISO
  /** O servidor ainda está lendo o Nomus pela primeira vez: pergunte de novo em instantes. */
  carregando?: boolean;
  /** Há uma atualização em andamento (os dados mostrados são os da última leitura). */
  atualizando?: boolean;
  /** Existem pedidos cujo financeiro ainda está sendo lido. */
  financeiroPendente?: boolean;
  /** A primeira leitura ainda está trazendo os pedidos mais antigos: a lista pode crescer. */
  historicoParcial?: boolean;
  /** A última tentativa de atualizar falhou: a lista é a da última leitura bem-sucedida. */
  erroAtualizacao?: string;
  pedidos: PedidoAbertoLinha[];
}

export interface FinanceiroDoPedido {
  recebido: number;
  saldoEmTitulos: number;
  titulosAbertos: number;
  vencidoReceber: number;
  proximoVencimento: string | null;
}

export interface EntradaPedidoAberto {
  id: number;
  codigo: string;
  dataEmissao: string; // "dd/mm/aaaa" como vem do Nomus
  valorTotal: number;
  itens: ItemParaPrazo[];
  cliente: string;
  vendedor: string;
  loja: string;
  statusPcp: string;
  prazoGferro: string | null;
  /** Itens do pedido na Programação do PCP (null = o PCP não tem o pedido ou não respondeu). */
  itensPcp: { total: number; abertos: number; entregues: number } | null;
  /** null = financeiro ainda não lido. */
  financeiro: FinanceiroDoPedido | null;
}

const arredondar = (valor: number) => Math.round(valor * 100) / 100;

// Status do item de pedido no Nomus: 2 = Liberado; 4/5/10 = atendido/entregue; 6/8 = cancelado/devolvido; 7 = devolvido parcialmente.
const STATUS_ITEM_LIBERADO = 2;
const STATUS_ITEM_ENCERRADO = new Set([4, 5, 6, 7, 8, 10]);

/**
 * Pedido com status Liberado: tem item Liberado e nenhum item em outra fase (aguardando liberação, atendido
 * parcialmente, enviado). Itens já entregues ou cancelados dentro do mesmo pedido não o tiram da lista.
 */
export function ehPedidoLiberado(itens: ItemParaPrazo[]): boolean {
  return itens.some((item) => item.status === STATUS_ITEM_LIBERADO)
    && itens.every((item) => item.status === STATUS_ITEM_LIBERADO || (item.status != null && STATUS_ITEM_ENCERRADO.has(item.status)));
}

function isoParaData(iso: string): Date {
  const [ano, mes, dia] = iso.split('-').map(Number);
  return new Date(ano, mes - 1, dia);
}

/** Linha do dashboard, ou null quando o pedido não está com status Liberado. */
export function montarLinhaPedidoAberto(entrada: EntradaPedidoAberto, hoje: Date = new Date()): PedidoAbertoLinha | null {
  if (!ehPedidoLiberado(entrada.itens)) return null;
  const nomus = classificarPrazoPedido(entrada.itens, hoje);

  const prazo = entrada.prazoGferro ?? nomus.prazo;
  const fontePrazo = entrada.prazoGferro ? 'gferro' : nomus.prazo ? 'nomus' : null;
  const hoje0h = new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate());
  const diasParaPrazo = prazo ? Math.round((isoParaData(prazo).getTime() - hoje0h.getTime()) / 86_400_000) : null;

  // Se o PCP já deu todos os itens como entregues (o Nomus só fecha o pedido depois), o atraso não vale mais.
  const entreguePcp = !!entrada.itensPcp && entrada.itensPcp.total > 0 && entrada.itensPcp.abertos === 0 && entrada.itensPcp.entregues > 0;
  const situacao: SituacaoPedidoAberto = entreguePcp
    ? 'entregue-pcp'
    : diasParaPrazo === null ? 'sem-prazo' : diasParaPrazo < 0 ? 'atrasado' : diasParaPrazo <= DIAS_ALERTA_PRAZO ? 'vence-em-breve' : 'no-prazo';

  const fin = entrada.financeiro;
  const aReceber = fin ? Math.max(0, arredondar(entrada.valorTotal - fin.recebido)) : null;

  return {
    id: entrada.id,
    codigo: entrada.codigo,
    cliente: entrada.cliente,
    vendedor: entrada.vendedor,
    loja: entrada.loja,
    dataEmissao: dataBrParaIso(entrada.dataEmissao),
    valorTotal: arredondar(entrada.valorTotal),
    etapa: nomus.etapa,
    statusPcp: entrada.statusPcp,
    prazoNomus: nomus.prazo,
    prazoGferro: entrada.prazoGferro,
    prazo,
    fontePrazo,
    situacao,
    diasParaPrazo,
    diasAtraso: diasParaPrazo !== null && diasParaPrazo < 0 && !entreguePcp ? -diasParaPrazo : 0,
    recebido: fin ? arredondar(fin.recebido) : null,
    aReceber: aReceber !== null && aReceber < 1 ? 0 : aReceber,
    titulosAbertos: fin?.titulosAbertos ?? 0,
    saldoEmTitulos: arredondar(fin?.saldoEmTitulos ?? 0),
    vencidoReceber: arredondar(fin?.vencidoReceber ?? 0),
    proximoVencimento: fin?.proximoVencimento ?? null,
  };
}

// Mais urgente primeiro: atrasados (do mais antigo), vence em breve, no prazo, sem prazo; entregues no PCP por último.
const PESO: Record<SituacaoPedidoAberto, number> = { 'atrasado': 0, 'vence-em-breve': 1, 'no-prazo': 2, 'sem-prazo': 3, 'entregue-pcp': 4 };

export function ordenarPedidosAbertos(linhas: PedidoAbertoLinha[]): PedidoAbertoLinha[] {
  return [...linhas].sort((a, b) =>
    PESO[a.situacao] - PESO[b.situacao]
    || (a.diasParaPrazo ?? 0) - (b.diasParaPrazo ?? 0)
    || b.valorTotal - a.valorTotal
    || b.codigo.localeCompare(a.codigo)
  );
}
