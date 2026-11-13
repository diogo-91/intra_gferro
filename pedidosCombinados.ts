// Dashboard > Pedidos > Pedidos combinados: os pedidos liberados no Nomus cuja observação cita o Dirceu (é assim que a
// equipe marca os pedidos liberados por ele — a API do Nomus não informa quem liberou). A lista sai dos pedidos já
// guardados no servidor (nunca espera o Nomus) e acompanha a atualização deles em segundo plano.

import { montarRespostaPedidosAbertos } from './pedidosAbertos';
import type { SituacaoPedidoAberto } from './src/pedidosAbertos';

export interface PedidoCombinado {
  id: number;
  codigo: string; // "PD 02208"
  cliente: string;
  vendedor: string;
  loja: string;
  dataEmissao: string; // aaaa-mm-dd
  valorTotal: number;
  /** Prazo combinado: o do PCP, ou o do Nomus quando o PCP não tem. */
  prazo: string | null;
  fontePrazo: 'gferro' | 'nomus' | null;
  situacao: SituacaoPedidoAberto;
  diasAtraso: number;
  diasParaPrazo: number | null;
  /** O que está escrito na observação do pedido (cita o Dirceu). */
  observacao: string;
}

export interface RespostaPedidosCombinados {
  atualizadoEm: string;
  carregando?: boolean;
  atualizando?: boolean;
  /** As observações ainda estão sendo lidas do Nomus: a lista pode crescer nos próximos minutos. */
  observacoesPendentes?: boolean;
  erroAtualizacao?: string;
  pedidos: PedidoCombinado[];
}

const numero = (codigo: string) => Number(codigo.replace(/\D/g, '')) || 0;

export async function montarRespostaPedidosCombinados(): Promise<RespostaPedidosCombinados> {
  const r = await montarRespostaPedidosAbertos(false);
  const pedidos = r.pedidos
    .filter((p) => p.observacaoDirceu)
    .map((p): PedidoCombinado => ({
      id: p.id, codigo: p.codigo, cliente: p.cliente, vendedor: p.vendedor, loja: p.loja, dataEmissao: p.dataEmissao, valorTotal: p.valorTotal,
      prazo: p.prazo, fontePrazo: p.fontePrazo, situacao: p.situacao, diasAtraso: p.diasAtraso, diasParaPrazo: p.diasParaPrazo, observacao: p.observacaoDirceu ?? '',
    }))
    // Prazo mais próximo primeiro (os atrasados no topo); sem prazo no fim.
    .sort((a, b) => (a.prazo === null ? 1 : b.prazo === null ? -1 : a.prazo.localeCompare(b.prazo)) || numero(b.codigo) - numero(a.codigo));
  return {
    atualizadoEm: r.atualizadoEm,
    ...(r.carregando ? { carregando: true } : {}),
    ...(r.atualizando ? { atualizando: true } : {}),
    ...(r.observacoesPendentes ? { observacoesPendentes: true } : {}),
    ...(r.erroAtualizacao ? { erroAtualizacao: r.erroAtualizacao } : {}),
    pedidos,
  };
}
