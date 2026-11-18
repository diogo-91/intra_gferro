// Dashboard > Pedidos > Pedidos Formato 2 (servidor): todos os pedidos com status Liberado no Nomus, cada um classificado
// pela regra de prazo da GFERRO (contrato, % pago — ver src/pedidosFormato2.ts). Sai dos pedidos já guardados no
// servidor (nunca espera o Nomus) e acompanha a atualização deles em segundo plano. Ficam de fora: pedidos emitidos antes
// da data de corte, pedidos não contratuais com menos de 30% pago e pedidos que o PCP já deu como entregues ou cancelados
// (saem da lista assim que o status muda; o servidor atualiza a cada 2 minutos enquanto a tela está aberta).

import { montarRespostaPedidosAbertos } from './pedidosAbertos';
import { classificarFormato2, entraNoFormato2, type ClassificacaoFormato2 } from './src/pedidosFormato2';
const ATUALIZAR_A_CADA_MS = 2 * 60_000;

export interface PedidoFormato2 extends ClassificacaoFormato2 {
  id: number;
  codigo: string; // "PD 02208"
  cliente: string;
  vendedor: string;
  loja: string;
  dataEmissao: string; // aaaa-mm-dd
  valorTotal: number;
  /** Já recebido do pedido; null enquanto o financeiro não foi lido. */
  pago: number | null;
  aReceber: number | null;
  contrato: boolean;
}

export interface RespostaPedidosFormato2 {
  atualizadoEm: string;
  carregando?: boolean;
  atualizando?: boolean;
  /** O financeiro de alguns pedidos ainda está sendo lido: pago e % aparecem em instantes. */
  financeiroPendente?: boolean;
  /** As observações (contrato) ainda estão sendo lidas do Nomus: a classificação pode mudar nos próximos minutos. */
  observacoesPendentes?: boolean;
  erroAtualizacao?: string;
  pedidos: PedidoFormato2[];
}

const numero = (codigo: string) => Number(codigo.replace(/\D/g, '')) || 0;

export async function montarRespostaPedidosFormato2(): Promise<RespostaPedidosFormato2> {
  const r = await montarRespostaPedidosAbertos(false, ATUALIZAR_A_CADA_MS);
  const hoje = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' });

  const pedidos = r.pedidos
    .filter((p) => p.situacao !== 'entregue-pcp' && p.situacao !== 'cancelado-pcp')
    .flatMap((p): PedidoFormato2[] => {
      const contrato = p.contrato === true;
      const classificacao = classificarFormato2({ contrato, valorTotal: p.valorTotal, recebido: p.recebido, dataEmissao: p.dataEmissao }, hoje);
      if (!entraNoFormato2(classificacao, p.dataEmissao)) return [];
      return [{
        ...classificacao,
        id: p.id, codigo: p.codigo, cliente: p.cliente, vendedor: p.vendedor, loja: p.loja, dataEmissao: p.dataEmissao, valorTotal: p.valorTotal,
        pago: p.recebido, aReceber: p.aReceber, contrato,
      }];
    })
    // Atrasados primeiro (os mais atrasados no topo); depois pelo prazo mais próximo; sem prazo no fim.
    .sort((a, b) => b.diasAtraso - a.diasAtraso || (a.prazoFim === null ? 1 : b.prazoFim === null ? -1 : a.prazoFim.localeCompare(b.prazoFim)) || numero(b.codigo) - numero(a.codigo));

  return {
    atualizadoEm: r.atualizadoEm,
    ...(r.carregando ? { carregando: true } : {}),
    ...(r.atualizando ? { atualizando: true } : {}),
    ...(r.financeiroPendente ? { financeiroPendente: true } : {}),
    ...(r.observacoesPendentes ? { observacoesPendentes: true } : {}),
    ...(r.erroAtualizacao ? { erroAtualizacao: r.erroAtualizacao } : {}),
    pedidos,
  };
}
