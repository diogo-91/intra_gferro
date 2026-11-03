// Dashboard > Pedidos (servidor): mantém em disco os pedidos com status Liberado no Nomus e o financeiro de cada um,
// e os atualiza em segundo plano. A primeira leitura completa leva minutos (limite de consultas do Nomus); depois
// só entram os pedidos modificados desde a última leitura, e a tela nunca espera o Nomus.

import { mkdir, readFile, writeFile } from 'fs/promises';
import path from 'path';
import { buscarContasDosPedidos, buscarPedidosParaPainel, nomesDosVendedores, numeroDoCodigoPedido, type PedidoParaPainel } from './nomus';
import { obterDadosPcp, obterItensPcp } from './prazoGferro';
import { LOJAS, lojaDoVendedor } from './src/data/vendedorLoja';
import { dataBrParaIso } from './src/pedidosLoja';
import { ehPedidoLiberado, montarLinhaPedidoAberto, ordenarPedidosAbertos, type FinanceiroDoPedido, type PedidoAbertoLinha, type RespostaPedidosAbertos } from './src/pedidosAbertos';

const ARQUIVO = path.join(process.cwd(), 'data', 'pedidos-abertos.json');

const INTERVALO_ATUALIZACAO_MS = 10 * 60_000; // o que mudou nos pedidos
const VARREDURA_COMPLETA_A_CADA_MS = 12 * 60 * 60_000; // rede de segurança caso uma mudança não apareça na data de modificação
const FINANCEIRO_VALIDO_POR_MS = 30 * 60_000;
const MARGEM_DA_MODIFICACAO_MS = 15 * 60_000;

interface FinanceiroGuardado {
  recebido: number; // já recebido nas parcelas (abertas e quitadas)
  parcelas: Array<{ vencimento: string; saldo: number }>; // parcelas ainda não quitadas (vencimento aaaa-mm-dd, "" se sem data)
  atualizadoEm: number;
}

interface Estado {
  versao: 2;
  pedidos: Record<string, PedidoParaPainel>; // só os com status Liberado
  varreduraCompletaEm: number;
  pedidosAtualizadoEm: number;
  financeiro: Record<string, FinanceiroGuardado>; // por número do pedido
}

const estadoVazio = (): Estado => ({ versao: 2, pedidos: {}, varreduraCompletaEm: 0, pedidosAtualizadoEm: 0, financeiro: {} });

let estado: Estado | null = null;
let emAndamento: Promise<void> | null = null;

async function carregarDoDisco(): Promise<Estado> {
  if (estado) return estado;
  try {
    const dados = JSON.parse(await readFile(ARQUIVO, 'utf-8'));
    estado = dados?.versao === 2 ? { ...estadoVazio(), ...dados } : estadoVazio();
  } catch {
    estado = estadoVazio();
  }
  return estado!;
}

async function persistir(): Promise<void> {
  try {
    await mkdir(path.dirname(ARQUIVO), { recursive: true });
    await writeFile(ARQUIVO, JSON.stringify(estado), 'utf-8');
  } catch (e: any) {
    console.error('[pedidos-abertos] não foi possível salvar o estado:', e.message);
  }
}

// AAAA-MM-DDTHH:mm:ss no horário do servidor (o mesmo fuso em que o Nomus grava as datas).
function formatarParaNomus(ms: number): string {
  const d = new Date(ms);
  const dois = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${dois(d.getMonth() + 1)}-${dois(d.getDate())}T${dois(d.getHours())}:${dois(d.getMinutes())}:${dois(d.getSeconds())}`;
}

const estaEmAberto = (pedido: PedidoParaPainel): boolean => ehPedidoLiberado(pedido.itens);

const ehDataBr = (texto: string) => /^\d{2}\/\d{2}\/\d{4}$/.test(texto);

async function atualizarFinanceiro(atual: Estado, modificados: Set<number>, relerQuemTemParcelaAberta: boolean): Promise<void> {
  const agora = Date.now();
  const numeros = Object.values(atual.pedidos)
    .map((pedido) => numeroDoCodigoPedido(pedido.codigoPedido))
    .filter((n): n is number => n !== null);
  const desatualizados = numeros.filter((n) => {
    const guardado = atual.financeiro[n];
    return !guardado || modificados.has(n) || agora - guardado.atualizadoEm > FINANCEIRO_VALIDO_POR_MS || (relerQuemTemParcelaAberta && guardado.parcelas.length > 0);
  });

  if (desatualizados.length > 0) {
    const contas = await buscarContasDosPedidos(desatualizados);
    const porPedido = new Map<number, Omit<FinanceiroGuardado, 'atualizadoEm'>>(desatualizados.map((n) => [n, { recebido: 0, parcelas: [] }]));
    for (const conta of contas) {
      const numero = numeroDoCodigoPedido(conta.descricaoLancamento);
      const soma = numero !== null ? porPedido.get(numero) : undefined;
      if (!soma) continue;
      soma.recebido += conta.recebido;
      if (!conta.quitada && conta.saldo > 0) soma.parcelas.push({ vencimento: ehDataBr(conta.dataVencimento) ? dataBrParaIso(conta.dataVencimento) : '', saldo: conta.saldo });
    }
    for (const [numero, soma] of porPedido) atual.financeiro[numero] = { ...soma, atualizadoEm: agora };
  }

  const emAberto = new Set(numeros.map(String));
  for (const chave of Object.keys(atual.financeiro)) if (!emAberto.has(chave)) delete atual.financeiro[chave];
}

async function executarAtualizacao(relerFinanceiro: boolean): Promise<void> {
  const atual = await carregarDoDisco();
  const inicio = Date.now();
  const completa = atual.varreduraCompletaEm === 0 || inicio - atual.varreduraCompletaEm > VARREDURA_COMPLETA_A_CADA_MS;

  const lidos = await buscarPedidosParaPainel(completa ? undefined : formatarParaNomus(atual.pedidosAtualizadoEm - MARGEM_DA_MODIFICACAO_MS));
  const pedidos: Record<string, PedidoParaPainel> = completa ? {} : { ...atual.pedidos };
  const modificados = new Set<number>();
  for (const pedido of lidos) {
    if (estaEmAberto(pedido)) pedidos[pedido.id] = pedido;
    else delete pedidos[pedido.id];
    const numero = numeroDoCodigoPedido(pedido.codigoPedido);
    if (numero !== null) modificados.add(numero);
  }
  atual.pedidos = pedidos;
  atual.pedidosAtualizadoEm = inicio;
  if (completa) atual.varreduraCompletaEm = inicio;
  await persistir(); // a tela já pode mostrar os pedidos enquanto o financeiro é lido

  await atualizarFinanceiro(atual, modificados, relerFinanceiro);
  await persistir();
  console.log(`[pedidos-abertos] ${completa ? 'leitura completa' : 'atualização'}: ${Object.keys(atual.pedidos).length} pedidos em aberto, ${lidos.length} lidos, em ${Math.round((Date.now() - inicio) / 1000)}s`);
}

/** Dispara uma atualização em segundo plano (uma por vez). */
export function atualizarPedidosAbertos(relerFinanceiro = false): Promise<void> {
  if (!emAndamento) {
    emAndamento = executarAtualizacao(relerFinanceiro)
      .catch((erro) => console.error('[pedidos-abertos] falha na atualização; mantendo os dados anteriores:', erro?.message ?? erro))
      .finally(() => { emAndamento = null; });
  }
  return emAndamento;
}

/** Carrega o último estado do disco e mantém a atualização automática. */
export function iniciarAtualizacaoPedidosAbertos(): void {
  const ciclo = async () => {
    await atualizarPedidosAbertos();
    setTimeout(ciclo, INTERVALO_ATUALIZACAO_MS).unref();
  };
  void carregarDoDisco().then(() => setTimeout(ciclo, 30_000).unref());
}

const hojeIso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

export async function montarRespostaPedidosAbertos(forcarAtualizacao = false): Promise<RespostaPedidosAbertos> {
  const atual = await carregarDoDisco();
  const vencido = Date.now() - atual.pedidosAtualizadoEm > INTERVALO_ATUALIZACAO_MS;
  if (forcarAtualizacao || vencido || atual.pedidosAtualizadoEm === 0) void atualizarPedidosAbertos(forcarAtualizacao);

  if (atual.pedidosAtualizadoEm === 0) {
    return { atualizadoEm: new Date().toISOString(), carregando: true, atualizando: true, pedidos: [] };
  }

  const hoje = new Date();
  const [nomes, dadosPcp, itensPcp] = await Promise.all([
    nomesDosVendedores().catch(() => new Map<number, string>()),
    obterDadosPcp().catch(() => null),
    obterItensPcp().catch(() => null),
  ]);
  const nomesLojas = new Map<string, string>(LOJAS.map((l) => [l.id, l.nome]));
  const hojeTexto = hojeIso(hoje);

  let financeiroPendente = false;
  const linhas: PedidoAbertoLinha[] = [];
  for (const pedido of Object.values(atual.pedidos)) {
    const numero = numeroDoCodigoPedido(pedido.codigoPedido);
    const pcp = numero !== null ? dadosPcp?.get(numero) : undefined;
    const vendedor = pedido.idPessoaVendedor != null ? nomes.get(pedido.idPessoaVendedor) ?? `Vendedor #${pedido.idPessoaVendedor}` : 'Sem vendedor';
    const lojaId = pedido.idPessoaVendedor != null && nomes.has(pedido.idPessoaVendedor) ? lojaDoVendedor(vendedor) : undefined;

    const guardado = numero !== null ? atual.financeiro[numero] : undefined;
    let financeiro: FinanceiroDoPedido | null = null;
    if (guardado) {
      const datadas = guardado.parcelas.filter((parcela) => parcela.vencimento).sort((a, b) => a.vencimento.localeCompare(b.vencimento));
      financeiro = {
        recebido: guardado.recebido,
        saldoEmTitulos: guardado.parcelas.reduce((soma, parcela) => soma + parcela.saldo, 0),
        titulosAbertos: guardado.parcelas.length,
        // O vencimento é comparado com o dia de hoje na hora de montar a tela.
        vencidoReceber: guardado.parcelas.reduce((soma, parcela) => (parcela.vencimento && parcela.vencimento < hojeTexto ? soma + parcela.saldo : soma), 0),
        proximoVencimento: datadas[0]?.vencimento ?? null, // o mais antigo (se já venceu) ou o mais próximo
      };
    } else {
      financeiroPendente = true;
    }

    const linha = montarLinhaPedidoAberto({
      id: pedido.id,
      codigo: pedido.codigoPedido,
      dataEmissao: pedido.dataEmissao,
      valorTotal: pedido.valorTotal,
      itens: pedido.itens,
      cliente: pcp?.cliente || (pedido.idPessoaCliente != null ? `Cliente #${pedido.idPessoaCliente}` : '—'),
      vendedor,
      loja: (lojaId && nomesLojas.get(lojaId)) || 'Sem loja',
      statusPcp: pcp?.status ?? '',
      prazoGferro: pcp?.prazo ?? null,
      itensPcp: numero !== null ? itensPcp?.get(numero) ?? null : null,
      financeiro,
    }, hoje);
    if (linha) linhas.push(linha);
  }

  return {
    atualizadoEm: new Date(atual.pedidosAtualizadoEm).toISOString(),
    ...(emAndamento ? { atualizando: true } : {}),
    ...(financeiroPendente ? { financeiroPendente: true } : {}),
    pedidos: ordenarPedidosAbertos(linhas),
  };
}
