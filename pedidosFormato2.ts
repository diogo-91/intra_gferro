// Dashboard > Pedidos > Pedidos Formato 2 (servidor): todos os pedidos com status Liberado no Nomus, cada um classificado
// pela regra de prazo da GFERRO (contrato, % pago — ver src/pedidosFormato2.ts). Sai dos pedidos já guardados no
// servidor (nunca espera o Nomus) e acompanha a atualização deles em segundo plano. Ficam de fora: pedidos emitidos antes
// da data de corte, pedidos não contratuais com menos de 30% pago e pedidos que o PCP já deu como entregues ou cancelados
// (saem da lista assim que o status muda; o servidor atualiza a cada 2 minutos enquanto a tela está aberta).

import { mkdir, readFile, rename, writeFile } from 'fs/promises';
import path from 'path';
import { montarRespostaPedidosAbertos } from './pedidosAbertos';
import { classificarFormato2, dividirValorDoPedido, entraNoFormato2, type ClassificacaoFormato2 } from './src/pedidosFormato2';
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
  /** 70% do valor total: o que a produção custa. */
  custoProducao: number;
  /** 30% do valor total: o lucro, que precisa ser transferido. */
  lucro: number;
  /** Confirmação (feita à mão) de que o lucro do pedido foi transferido; null enquanto não foi. */
  lucroTransferido: LucroTransferido | null;
}

export interface LucroTransferido { valor: number; por: string; em: string }

export class ErroPedidosFormato2 extends Error {
  constructor(mensagem: string, public readonly status = 400) {
    super(mensagem);
  }
}

// ---- Confirmação de transferência do lucro (por pedido, digitada à mão) ----
// Guardada em data/pedidos-formato2-lucro.json, pelo código do pedido ("PD 02525"). O valor confirmado fica registrado junto
// (o lucro do pedido no momento da confirmação), com quem confirmou e quando.

const ARQUIVO_LUCRO = path.join(process.cwd(), 'data', 'pedidos-formato2-lucro.json');
let transferencias: Record<string, LucroTransferido> | null = null;
let filaGravacao: Promise<unknown> = Promise.resolve();

async function carregarTransferencias(): Promise<Record<string, LucroTransferido>> {
  if (transferencias) return transferencias;
  try {
    const lido = JSON.parse(await readFile(ARQUIVO_LUCRO, 'utf-8'));
    transferencias = lido && typeof lido === 'object' && !Array.isArray(lido) ? lido : {};
  } catch {
    transferencias = {};
  }
  return transferencias!;
}

/** Grava no disco (uma gravação por vez; arquivo temporário + troca, para um corte no meio não estragar o arquivo). */
function gravarTransferencias(): Promise<void> {
  const proxima = filaGravacao.then(async () => {
    await mkdir(path.dirname(ARQUIVO_LUCRO), { recursive: true });
    const temporario = `${ARQUIVO_LUCRO}.tmp`;
    await writeFile(temporario, JSON.stringify(transferencias), 'utf-8');
    await rename(temporario, ARQUIVO_LUCRO);
  });
  filaGravacao = proxima.catch(() => undefined);
  return proxima;
}

const chaveDoPedido = (codigo: string) => codigo.trim().toUpperCase().replace(/\s+/g, ' ');

/** Marca (ou desmarca) o lucro do pedido como transferido. O valor registrado é o lucro atual do pedido na lista. */
export async function salvarLucroTransferido(codigo: unknown, transferido: unknown, usuario: string): Promise<LucroTransferido | null> {
  if (typeof codigo !== 'string' || !/^PD\s*\d{1,8}$/i.test(codigo.trim())) throw new ErroPedidosFormato2('Pedido inválido.');
  if (typeof transferido !== 'boolean') throw new ErroPedidosFormato2('Informe se o lucro foi transferido (true ou false).');
  const chave = chaveDoPedido(codigo);
  const todas = await carregarTransferencias();
  if (!transferido) {
    if (!(chave in todas)) return null;
    delete todas[chave];
    await gravarTransferencias();
    return null;
  }
  const { pedidos } = await montarRespostaPedidosFormato2();
  const pedido = pedidos.find((p) => chaveDoPedido(p.codigo) === chave);
  if (!pedido) throw new ErroPedidosFormato2('Esse pedido não está mais na lista (foi entregue ou cancelado).', 404);
  const registro: LucroTransferido = { valor: pedido.lucro, por: usuario, em: new Date().toISOString() };
  todas[chave] = registro;
  await gravarTransferencias();
  return registro;
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
  const [r, confirmadas] = await Promise.all([montarRespostaPedidosAbertos(false, ATUALIZAR_A_CADA_MS), carregarTransferencias()]);
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
        ...dividirValorDoPedido(p.valorTotal),
        lucroTransferido: confirmadas[chaveDoPedido(p.codigo)] ?? null,
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
