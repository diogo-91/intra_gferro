// Dashboard > Entregas: as entregas lançadas no apontamento de produção, ligadas ao pedido do Nomus (vendedor, loja,
// valor, recebimento na entrega e prazo prometido). As regras de recebimento e de prazo são as do relatório de entregas
// do próprio apontamento (server/relatorioEntregas.js e relatorioPrazo.js), para os números baterem com o PDF de lá.
// Sem dependências de servidor/navegador — usado pelos dois.

export type SituacaoRecebimento = 'RECEBIDO' | 'PARCIAL' | 'A_RECEBER' | 'PAGO_ANTES' | 'NAO';
export type SituacaoPrazoEntrega = 'atrasado' | 'no-prazo' | 'sem-prazo';

export interface RecebimentoEntrega {
  cobranca: number; // o que se cobra na entrega (parcelas marcadas ENTREGA; senão, o que foi baixado no dia)
  naEntrega: number; // quanto dessa cobrança já foi recebido
  antes: number; // recebido fora da entrega (entrada, pagamento antecipado)
  total: number; // todo o recebido do pedido
  emAberto: number | null; // valor do pedido que ainda falta receber (null se o valor do pedido não é conhecido)
  formas: string[]; // formas de pagamento da cobrança na entrega
  situacao: SituacaoRecebimento;
  criterio: 'parcela' | 'dia';
}

export interface EntregaLinha {
  id: string;
  data: string; // aaaa-mm-dd — dia da entrega
  pedido: string; // "PD 01889"
  cliente: string | null;
  metragem: number | null;
  motorista: string;
  caminhao: string;
  vendedor: string | null;
  loja: string; // nome da loja, ou "Sem loja"
  /** false enquanto o servidor ainda não leu este pedido no Nomus. */
  pedidoLido: boolean;
  pedidoEncontrado: boolean;
  valorPedido: number | null;
  recebimento: RecebimentoEntrega | null; // null enquanto o financeiro do pedido ainda não foi lido
  prazo: string | null; // aaaa-mm-dd — prazo combinado no PCP (Gferro) ou, sem ele, a data prometida no Nomus
  fontePrazo: 'gferro' | 'nomus' | null;
  /** O pedido ainda consta como Liberado no Nomus (aparece na tela de Pedidos): entregue, mas falta dar a baixa. */
  liberadoNoNomus: boolean;
  situacaoPrazo: SituacaoPrazoEntrega;
  diasAtraso: number;
  diasAntecipado: number;
  /** Primeira entrega lançada do pedido: só ela conta na pontualidade (lançamentos repetidos costumam ser duplicidade). */
  primeiraDoPedido: boolean;
  lancamentosDoPedido: number; // quantas vezes o pedido foi lançado como entregue (>1 merece conferência)
}

export interface RespostaEntregas {
  inicio: string;
  fim: string;
  atualizadoEm: string; // ISO
  carregando?: boolean; // ainda não leu as entregas pela primeira vez
  atualizando?: boolean;
  /** Linhas cujos dados do Nomus (pedido ou financeiro) ainda estão sendo lidos. */
  pendentes?: number;
  /** A lista de pedidos Liberados (tela de Pedidos) ainda não foi lida: "liberadoNoNomus" pode estar incompleto. */
  liberadosIndisponivel?: boolean;
  erroAtualizacao?: string;
  entregas: EntregaLinha[];
}

const arredondar = (valor: number) => Math.round(valor * 100) / 100;

/** Codigo digitado ("1889", "PD 01889") -> numero do pedido; null se não houver. */
export function numeroDoPedido(texto: string | number | null | undefined): number | null {
  const digitos = String(texto ?? '').replace(/\D/g, '');
  if (!digitos || digitos.length > 9) return null;
  const numero = Number(digitos);
  return numero > 0 ? numero : null;
}

export const codigoDoPedido = (numero: number) => `PD ${String(numero).padStart(5, '0')}`;

export interface ContaParaRecebimento {
  descricaoLancamento: string;
  recebido: number;
  quitada: boolean;
  dataBaixa: string; // "dd/mm/aaaa"
  forma: string;
}

export interface ParcelaDoPedido {
  observacao: string;
  valor: number;
  idFormaPagamento: number | null;
}

const dataBrParaIso = (texto: string): string | null => {
  const m = /^(\d{2})\/(\d{2})\/(\d{4})/.exec(String(texto ?? '').trim());
  return m ? `${m[3]}-${m[2]}-${m[1]}` : null;
};

/** A equipe marca a observação da parcela a cobrar na entrega: ENTREGA, "PAGAR NA ENTREGA"... (retirada não conta). */
export const parcelaEhDaEntrega = (parcela: ParcelaDoPedido) => /entrega/i.test(parcela.observacao) && !/retira/i.test(parcela.observacao);

/** "Pedido PD 02158 - Parcela 2 de 3" -> 2. */
function numeroDaParcela(conta: ContaParaRecebimento): number | null {
  const m = /Parcela\s+(\d+)\s+de\s+\d+/i.exec(conta.descricaoLancamento);
  return m ? Number(m[1]) : null;
}

/**
 * Resume a cobrança e o recebimento de um pedido em relação à entrega. As parcelas do pedido cuja observação diz ENTREGA
 * são o que se cobra na entrega; a conta a receber "Parcela N de M" diz se a N-ésima parcela foi recebida. Pedido sem
 * parcela marcada ENTREGA cai no critério de reserva: o que foi baixado no DIA da entrega.
 */
export function resumirRecebimento(
  contas: ContaParaRecebimento[],
  dataEntregaIso: string,
  valorPedido: number | null,
  parcelas: ParcelaDoPedido[],
  nomeDaForma: (id: number | null) => string | null = () => null
): RecebimentoEntrega {
  // Conta tudo o que já entrou (inclusive pagamento parcial de uma parcela ainda aberta), igual à tela de Pedidos.
  const recebidoDaConta = (c: ContaParaRecebimento) => c.recebido;
  const contasValidas = contas.filter((c) => recebidoDaConta(c) > 0);
  const total = arredondar(contasValidas.reduce((soma, c) => soma + recebidoDaConta(c), 0));
  const emAberto = valorPedido != null ? arredondar(Math.max(0, valorPedido - total)) : null;

  const daEntrega = parcelas.map((p, i) => ({ ...p, numero: i + 1 })).filter(parcelaEhDaEntrega);
  let cobranca = 0;
  let recebidoNaEntrega = 0;
  const formas = new Set<string>();
  let criterio: 'parcela' | 'dia' = 'parcela';
  if (daEntrega.length > 0) {
    for (const parcela of daEntrega) {
      cobranca += parcela.valor ?? 0;
      recebidoNaEntrega += contasValidas.filter((c) => numeroDaParcela(c) === parcela.numero).reduce((soma, c) => soma + recebidoDaConta(c), 0);
      const forma = nomeDaForma(parcela.idFormaPagamento);
      if (forma) formas.add(forma);
    }
  } else {
    criterio = 'dia';
    for (const conta of contasValidas) {
      if (dataBrParaIso(conta.dataBaixa) === dataEntregaIso) {
        recebidoNaEntrega += recebidoDaConta(conta);
        if (conta.forma) formas.add(conta.forma);
      }
    }
    cobranca = recebidoNaEntrega;
  }
  cobranca = arredondar(cobranca);
  recebidoNaEntrega = arredondar(recebidoNaEntrega);
  const antes = arredondar(Math.max(0, total - recebidoNaEntrega));

  let situacao: SituacaoRecebimento = 'NAO';
  if (cobranca > 0 && recebidoNaEntrega >= cobranca - 0.01) situacao = 'RECEBIDO';
  else if (recebidoNaEntrega > 0) situacao = 'PARCIAL';
  else if (cobranca > 0) situacao = 'A_RECEBER';
  else if (antes > 0 && emAberto != null && emAberto <= 0.01) situacao = 'PAGO_ANTES';
  return { cobranca, naEntrega: recebidoNaEntrega, antes, total, emAberto, formas: [...formas], situacao, criterio };
}

/** Dias corridos de `deIso` até `paraIso` (positivo se `para` é depois). */
function diasEntre(deIso: string, paraIso: string): number {
  const [a1, m1, d1] = deIso.split('-').map(Number);
  const [a2, m2, d2] = paraIso.split('-').map(Number);
  return Math.round((Date.UTC(a2, m2 - 1, d2) - Date.UTC(a1, m1 - 1, d1)) / 86_400_000);
}

/** Entrega depois do prazo = atrasada (dias corridos); no dia ou antes = no prazo. */
export function classificarPrazoEntrega(prazoIso: string | null, realIso: string): { situacao: SituacaoPrazoEntrega; diasAtraso: number; diasAntecipado: number } {
  if (!prazoIso) return { situacao: 'sem-prazo', diasAtraso: 0, diasAntecipado: 0 };
  const dif = diasEntre(prazoIso, realIso);
  if (dif > 0) return { situacao: 'atrasado', diasAtraso: dif, diasAntecipado: 0 };
  return { situacao: 'no-prazo', diasAtraso: 0, diasAntecipado: Math.max(0, -dif) };
}

export interface TotaisEntregas {
  entregas: number;
  pedidos: number;
  metragem: number;
  valorPedidos: number;
  recebidoNaEntrega: number;
  comRecebimentoNaEntrega: number;
  aReceberNaEntrega: number;
  emAberto: number;
  comPrazo: number;
  noPrazo: number;
  atrasados: number;
  pctNoPrazo: number | null;
}

/**
 * Totais de um conjunto de linhas. Metragem e número de entregas contam TODAS as linhas; mas o valor do pedido e o
 * recebimento são do PEDIDO — um pedido entregue em duas viagens aparece em duas linhas e não pode somar duas vezes.
 * A pontualidade conta só a primeira entrega lançada de cada pedido.
 */
export function totaisDasLinhas(linhas: EntregaLinha[]): TotaisEntregas {
  const porPedido = new Map<string, EntregaLinha>();
  for (const linha of linhas) if (!porPedido.has(linha.pedido)) porPedido.set(linha.pedido, linha);
  const unicos = [...porPedido.values()];
  const comPrazo = linhas.filter((l) => l.primeiraDoPedido && l.situacaoPrazo !== 'sem-prazo');
  const atrasados = comPrazo.filter((l) => l.situacaoPrazo === 'atrasado').length;
  return {
    entregas: linhas.length,
    pedidos: porPedido.size,
    metragem: arredondar(linhas.reduce((soma, l) => soma + (l.metragem ?? 0), 0)),
    valorPedidos: arredondar(unicos.reduce((soma, l) => soma + (l.valorPedido ?? 0), 0)),
    recebidoNaEntrega: arredondar(unicos.reduce((soma, l) => soma + (l.recebimento?.naEntrega ?? 0), 0)),
    comRecebimentoNaEntrega: unicos.filter((l) => (l.recebimento?.naEntrega ?? 0) > 0).length,
    aReceberNaEntrega: arredondar(unicos.reduce((soma, l) => soma + Math.max(0, (l.recebimento?.cobranca ?? 0) - (l.recebimento?.naEntrega ?? 0)), 0)),
    emAberto: arredondar(unicos.reduce((soma, l) => soma + (l.recebimento?.emAberto ?? 0), 0)),
    comPrazo: comPrazo.length,
    noPrazo: comPrazo.length - atrasados,
    atrasados,
    pctNoPrazo: comPrazo.length > 0 ? Math.round(((comPrazo.length - atrasados) / comPrazo.length) * 1000) / 10 : null,
  };
}
