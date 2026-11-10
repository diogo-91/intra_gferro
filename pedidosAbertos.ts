// Dashboard > Pedidos (servidor): guarda em disco (e em memória) os pedidos com status Liberado no Nomus, o
// financeiro de cada um, os nomes dos vendedores e o que o PCP sabe de cada pedido. A tela lê SÓ desse estado
// guardado — nunca espera o Nomus nem o PCP —, e tudo é atualizado em segundo plano:
//  - leitura completa em etapas (os últimos 30 dias primeiro, depois 120 dias, depois o histórico), publicando a cada etapa;
//  - depois só entram os pedidos modificados desde a última leitura (segundos);
//  - se uma atualização falha, a última leitura continua valendo e a tela avisa.

import { copyFile, mkdir, readFile, rename, writeFile } from 'fs/promises';
import path from 'path';
import { buscarContasDosPedidos, buscarPedidosParaPainel, nomesDosVendedores, numeroDoCodigoPedido, type PedidoParaPainel } from './nomus';
import { obterDadosPcp, obterItensPcp } from './prazoGferro';
import { LOJAS, lojaDoVendedor } from './src/data/vendedorLoja';
import { dataBrParaIso } from './src/pedidosLoja';
import { ehPedidoLiberado, montarLinhaPedidoAberto, ordenarPedidosAbertos, type FinanceiroDoPedido, type PedidoAbertoLinha, type RespostaPedidosAbertos } from './src/pedidosAbertos';

const ARQUIVO = path.join(process.cwd(), 'data', 'pedidos-abertos.json');

const INTERVALO_ATUALIZACAO_MS = 10 * 60_000; // o que mudou nos pedidos, vendedores e PCP
const VARREDURA_COMPLETA_A_CADA_MS = 12 * 60 * 60_000; // rede de segurança caso uma mudança não apareça na data de modificação
const FINANCEIRO_VALIDO_POR_MS = 30 * 60_000;
const MARGEM_DA_MODIFICACAO_MS = 15 * 60_000;
const DIAS_DA_PRIMEIRA_ETAPA = 30; // pedidos emitidos nesse período entram primeiro, para a tela ter dados em poucos minutos
const DIAS_DA_SEGUNDA_ETAPA = 120;
const INICIO_DO_HISTORICO = '2019-12-31T23:59:59';
const FIM_DA_ETAPA_ANTIGA = '2025-07-01T00:00:00';
const INICIO_DA_ETAPA_INTERMEDIARIA = '2025-06-30T23:59:59';

interface FinanceiroGuardado {
  recebido: number; // já recebido nas parcelas (abertas e quitadas)
  parcelas: Array<{ vencimento: string; saldo: number }>; // parcelas ainda não quitadas (vencimento aaaa-mm-dd, "" se sem data)
  atualizadoEm: number;
}

interface PcpGuardado {
  cliente: string;
  prazo: string | null;
  status: string;
  itens: { total: number; abertos: number; entregues: number } | null;
}

interface Estado {
  versao: 3;
  pedidos: Record<string, PedidoParaPainel>; // só os com status Liberado
  varreduraCompletaEm: number;
  pedidosAtualizadoEm: number;
  historicoCompleto: boolean; // false enquanto a primeira leitura ainda traz os pedidos antigos
  financeiro: Record<string, FinanceiroGuardado>; // por número do pedido
  vendedores: Record<string, string>; // id -> nome
  pcp: Record<string, PcpGuardado>; // por número do pedido
  ultimoErro: { mensagem: string; em: number } | null;
}

const estadoVazio = (): Estado => ({
  versao: 3, pedidos: {}, varreduraCompletaEm: 0, pedidosAtualizadoEm: 0, historicoCompleto: false, financeiro: {}, vendedores: {}, pcp: {}, ultimoErro: null,
});

let estado: Estado | null = null;
let emAndamento: Promise<void> | null = null;

async function lerArquivo(arquivo: string): Promise<Estado | null> {
  try {
    const dados = JSON.parse(await readFile(arquivo, 'utf-8'));
    if (dados?.versao !== 2 && dados?.versao !== 3) return null;
    // A versão 2 (sem vendedores/PCP guardados) tem o mesmo formato de pedidos e financeiro.
    return { ...estadoVazio(), ...dados, versao: 3, historicoCompleto: dados.historicoCompleto ?? dados.varreduraCompletaEm > 0, ultimoErro: dados.ultimoErro ?? null };
  } catch {
    return null;
  }
}

async function carregarDoDisco(): Promise<Estado> {
  if (estado) return estado;
  estado = (await lerArquivo(ARQUIVO)) ?? (await lerArquivo(`${ARQUIVO}.bak`)) ?? estadoVazio();
  return estado;
}

// Grava num arquivo temporário e troca (nunca deixa o arquivo principal pela metade); guarda a cópia anterior.
async function persistir(): Promise<void> {
  try {
    await mkdir(path.dirname(ARQUIVO), { recursive: true });
    const temporario = `${ARQUIVO}.tmp`;
    await writeFile(temporario, JSON.stringify(estado), 'utf-8');
    await copyFile(ARQUIVO, `${ARQUIVO}.bak`).catch(() => undefined);
    await rename(temporario, ARQUIVO);
  } catch (e: any) {
    console.error('[pedidos-abertos] não foi possível salvar o estado:', e.message);
  }
}

const dois = (n: number) => String(n).padStart(2, '0');
const dataDoServidor = (ms: number) => { const d = new Date(ms); return `${d.getFullYear()}-${dois(d.getMonth() + 1)}-${dois(d.getDate())}`; };

// AAAA-MM-DDTHH:mm:ss no horário do servidor (o mesmo fuso em que o Nomus grava as datas).
function formatarParaNomus(ms: number): string {
  const d = new Date(ms);
  return `${dataDoServidor(ms)}T${dois(d.getHours())}:${dois(d.getMinutes())}:${dois(d.getSeconds())}`;
}

const ehDataBr = (texto: string) => /^\d{2}\/\d{2}\/\d{4}$/.test(texto);

async function atualizarVendedores(atual: Estado): Promise<void> {
  try {
    const nomes = await nomesDosVendedores();
    if (nomes.size > 0) atual.vendedores = Object.fromEntries([...nomes].map(([id, nome]) => [String(id), nome]));
  } catch (e: any) {
    console.error('[pedidos-abertos] não foi possível ler os vendedores; mantendo os guardados:', e?.message ?? e);
  }
}

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

// Guarda o que o PCP sabe (cliente, prazo Gferro, status, entregas) dos pedidos da lista. Se o PCP não responder,
// continuam valendo os dados da última leitura.
async function atualizarPcp(atual: Estado): Promise<void> {
  const [dados, itens] = await Promise.all([obterDadosPcp().catch(() => null), obterItensPcp().catch(() => null)]);
  if (!dados && !itens) return;
  const pcp: Record<string, PcpGuardado> = {};
  for (const pedido of Object.values(atual.pedidos)) {
    const numero = numeroDoCodigoPedido(pedido.codigoPedido);
    if (numero === null) continue;
    const anterior = atual.pcp[numero];
    const doPedido = dados?.get(numero);
    pcp[numero] = {
      cliente: doPedido ? doPedido.cliente : anterior?.cliente ?? '',
      prazo: doPedido ? doPedido.prazo : anterior?.prazo ?? null,
      status: doPedido ? doPedido.status : anterior?.status ?? '',
      itens: itens ? itens.get(numero) ?? null : anterior?.itens ?? null,
    };
  }
  atual.pcp = pcp;
}

// Leitura completa em etapas. Com a lista ainda vazia ou incompleta (primeira vez, depois de um deploy sem dados),
// cada etapa já é publicada; com dados anteriores, a lista antiga só é trocada no fim (nunca fica menor no meio).
async function varreduraCompleta(atual: Estado, inicio: number): Promise<void> {
  const publicarAoLongoDoCaminho = !atual.historicoCompleto;
  // Fronteira entre duas etapas: um lado é "depois da véspera às 23:59:59", o outro "antes das 00:00:00 do dia" — sem
  // sobrepor nem deixar pedido de fora.
  const fronteira = (dias: number) => ({
    dia: `${dataDoServidor(inicio - dias * 86_400_000)}T00:00:00`,
    vespera: `${dataDoServidor(inicio - (dias + 1) * 86_400_000)}T23:59:59`,
  });
  const primeira = fronteira(DIAS_DA_PRIMEIRA_ETAPA);
  const segunda = fronteira(DIAS_DA_SEGUNDA_ETAPA);
  const etapas = [
    { emitidosApos: primeira.vespera },
    { emitidosApos: segunda.vespera, emitidosAntes: primeira.dia },
    { emitidosApos: INICIO_DA_ETAPA_INTERMEDIARIA, emitidosAntes: segunda.dia },
    { emitidosApos: INICIO_DO_HISTORICO, emitidosAntes: FIM_DA_ETAPA_ANTIGA },
  ];

  const novos: Record<string, PedidoParaPainel> = {};
  for (const etapa of etapas) {
    for (const pedido of await buscarPedidosParaPainel(etapa)) if (ehPedidoLiberado(pedido.itens)) novos[pedido.id] = pedido;
    if (publicarAoLongoDoCaminho) {
      atual.pedidos = { ...novos };
      await atualizarPcp(atual); // rápido: os nomes dos clientes já entram junto com os pedidos
      await persistir();
      await atualizarFinanceiro(atual, new Set(), false);
      await persistir();
    }
  }
  atual.pedidos = novos;
  atual.pedidosAtualizadoEm = inicio;
  atual.varreduraCompletaEm = inicio;
  atual.historicoCompleto = true;
}

async function executarAtualizacao(relerFinanceiro: boolean): Promise<void> {
  const atual = await carregarDoDisco();
  const inicio = Date.now();
  await atualizarVendedores(atual);

  const completa = !atual.historicoCompleto || inicio - atual.varreduraCompletaEm > VARREDURA_COMPLETA_A_CADA_MS;
  const modificados = new Set<number>();
  if (completa) {
    await varreduraCompleta(atual, inicio);
  } else {
    const lidos = await buscarPedidosParaPainel({ modificadosDesde: formatarParaNomus(atual.pedidosAtualizadoEm - MARGEM_DA_MODIFICACAO_MS) });
    const pedidos = { ...atual.pedidos };
    for (const pedido of lidos) {
      if (ehPedidoLiberado(pedido.itens)) pedidos[pedido.id] = pedido;
      else delete pedidos[pedido.id];
      const numero = numeroDoCodigoPedido(pedido.codigoPedido);
      if (numero !== null) modificados.add(numero);
    }
    atual.pedidos = pedidos;
    atual.pedidosAtualizadoEm = inicio;
  }
  await atualizarPcp(atual); // rápido; o financeiro (mais lento) vem depois
  await persistir(); // a tela já pode mostrar os pedidos enquanto o financeiro é lido

  await atualizarFinanceiro(atual, modificados, relerFinanceiro);
  atual.ultimoErro = null;
  await persistir();
  console.log(`[pedidos-abertos] ${completa ? 'leitura completa' : 'atualização'}: ${Object.keys(atual.pedidos).length} pedidos liberados em ${Math.round((Date.now() - inicio) / 1000)}s`);
}

/** Dispara uma atualização em segundo plano (uma por vez). Nunca rejeita: a falha fica registrada no estado. */
export function atualizarPedidosAbertos(relerFinanceiro = false): Promise<void> {
  if (!emAndamento) {
    emAndamento = executarAtualizacao(relerFinanceiro)
      .catch(async (erro) => {
        console.error('[pedidos-abertos] falha na atualização; mantendo os dados anteriores:', erro?.message ?? erro);
        if (estado) {
          estado.ultimoErro = { mensagem: String(erro?.message ?? erro).slice(0, 200), em: Date.now() };
          await persistir();
        }
      })
      .finally(() => { emAndamento = null; });
  }
  return emAndamento;
}

/** Carrega o último estado do disco e mantém a atualização automática em segundo plano. */
export function iniciarAtualizacaoPedidosAbertos(): void {
  const ciclo = async () => {
    await atualizarPedidosAbertos();
    setTimeout(ciclo, INTERVALO_ATUALIZACAO_MS).unref();
  };
  void carregarDoDisco().then(() => setTimeout(ciclo, 15_000).unref());
}

const hojeIso = (d: Date) => `${d.getFullYear()}-${dois(d.getMonth() + 1)}-${dois(d.getDate())}`;

/**
 * Números dos pedidos que hoje têm status Liberado no Nomus (os da tela de Pedidos), ou null se essa lista ainda não
 * foi lida nenhuma vez. Só lê o que está guardado.
 */
export async function numerosLiberadosNoNomus(): Promise<Set<number> | null> {
  const atual = await carregarDoDisco();
  if (Object.keys(atual.pedidos).length === 0 && !atual.historicoCompleto) return null;
  return new Set(Object.values(atual.pedidos).map((pedido) => numeroDoCodigoPedido(pedido.codigoPedido)).filter((n): n is number => n !== null));
}

/** Monta a tela só do que está guardado (não consulta o Nomus nem o PCP). */
export async function montarRespostaPedidosAbertos(forcarAtualizacao = false): Promise<RespostaPedidosAbertos> {
  const atual = await carregarDoDisco();
  const vencido = Date.now() - atual.pedidosAtualizadoEm > INTERVALO_ATUALIZACAO_MS;
  if (forcarAtualizacao || vencido || !atual.historicoCompleto) void atualizarPedidosAbertos(forcarAtualizacao);

  const semDados = Object.keys(atual.pedidos).length === 0 && !atual.historicoCompleto;
  if (semDados) {
    return { atualizadoEm: new Date().toISOString(), carregando: true, atualizando: true, pedidos: [] };
  }

  const hoje = new Date();
  const hojeTexto = hojeIso(hoje);
  const nomesLojas = new Map<string, string>(LOJAS.map((l) => [l.id, l.nome]));

  let financeiroPendente = false;
  const linhas: PedidoAbertoLinha[] = [];
  for (const pedido of Object.values(atual.pedidos)) {
    const numero = numeroDoCodigoPedido(pedido.codigoPedido);
    const pcp = numero !== null ? atual.pcp[numero] : undefined;
    const nomeVendedor = pedido.idPessoaVendedor != null ? atual.vendedores[pedido.idPessoaVendedor] : undefined;
    const vendedor = pedido.idPessoaVendedor == null ? 'Sem vendedor' : nomeVendedor ?? `Vendedor #${pedido.idPessoaVendedor}`;
    const lojaId = nomeVendedor ? lojaDoVendedor(nomeVendedor) : undefined;

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
      itensPcp: pcp?.itens ?? null,
      financeiro,
    }, hoje);
    if (linha) linhas.push(linha);
  }

  return {
    atualizadoEm: new Date(atual.pedidosAtualizadoEm || Date.now()).toISOString(),
    ...(emAndamento ? { atualizando: true } : {}),
    ...(financeiroPendente ? { financeiroPendente: true } : {}),
    ...(!atual.historicoCompleto ? { historicoParcial: true } : {}),
    ...(atual.ultimoErro ? { erroAtualizacao: atual.ultimoErro.mensagem } : {}),
    pedidos: ordenarPedidosAbertos(linhas),
  };
}

export interface PedidoAEntregarParaMapa {
  idPessoaCliente?: number;
  codigo: string;
  cliente: string;
  vendedor: string;
  loja: string;
  dataEmissao: string;
  prazo: string | null;
  valorTotal: number;
}

/**
 * Pedidos que ainda não foram entregues (liberados no Nomus, sem entrega nem cancelamento dados pelo PCP), com o cliente
 * para o mapa. Sai do mesmo estado guardado da tela Pedidos; `forcar` pede uma releitura no Nomus agora.
 */
export async function pedidosAEntregarParaMapa(forcar = false): Promise<{ atualizadoEm: string; carregando?: boolean; atualizando?: boolean; historicoParcial?: boolean; erroAtualizacao?: string; pedidos: PedidoAEntregarParaMapa[] }> {
  const resposta = await montarRespostaPedidosAbertos(forcar);
  if (resposta.carregando) return { atualizadoEm: resposta.atualizadoEm, carregando: true, atualizando: true, pedidos: [] };
  const atual = await carregarDoDisco();
  const clientePorId = new Map(Object.values(atual.pedidos).map((pedido) => [pedido.id, pedido.idPessoaCliente]));
  return {
    atualizadoEm: resposta.atualizadoEm,
    ...(resposta.atualizando ? { atualizando: true } : {}),
    ...(resposta.historicoParcial ? { historicoParcial: true } : {}),
    ...(resposta.erroAtualizacao ? { erroAtualizacao: resposta.erroAtualizacao } : {}),
    pedidos: resposta.pedidos
      .filter((linha) => linha.situacao !== 'entregue-pcp' && linha.situacao !== 'cancelado-pcp')
      .map((linha) => ({ idPessoaCliente: clientePorId.get(linha.id), codigo: linha.codigo, cliente: linha.cliente, vendedor: linha.vendedor, loja: linha.loja, dataEmissao: linha.dataEmissao, prazo: linha.prazo, valorTotal: linha.valorTotal })),
  };
}
