// Dashboard > Entregas (servidor): lê as entregas lançadas no apontamento de produção (APONTAMENTO_BASE_URL) e as liga ao
// pedido do Nomus (valor, vendedor, parcelas, prazo prometido) e ao financeiro dele (recebimento na entrega). Tudo fica
// guardado em disco e é atualizado em segundo plano: a tela lê só do que está guardado e nunca espera o Nomus.

import { copyFile, mkdir, readFile, rename, writeFile } from 'fs/promises';
import path from 'path';
import { buscarContasDosPedidos, buscarFormasPagamento, buscarPedidosDasEntregas, nomesDosVendedores, pedidosDoCacheDoPainel, type ContaDoPedidoNomus, type PedidoDaEntregaNomus } from './nomus';
import { numerosLiberadosNoNomus } from './pedidosAbertos';
import { obterDadosPcp } from './prazoGferro';
import { LOJAS, lojaDoVendedor } from './src/data/vendedorLoja';
import { classificarPrazoEntrega, codigoDoPedido, numeroDoPedido, resumirRecebimento, type EntregaLinha, type RespostaEntregas } from './src/entregas';

const ARQUIVO = path.join(process.cwd(), 'data', 'entregas-painel.json');

const INTERVALO_ATUALIZACAO_MS = 10 * 60_000;
const PEDIDO_VALIDO_POR_MS = 24 * 60 * 60_000; // valor, vendedor, parcelas e prazo de pedido já entregue quase não mudam
const CONTAS_RECENTES_VALIDAS_POR_MS = 30 * 60_000; // entregas dos últimos dias: o recebimento ainda muda
const CONTAS_ANTIGAS_VALIDAS_POR_MS = 24 * 60 * 60_000;
const DIAS_DE_ENTREGA_RECENTE = 21;
const PEDIDOS_POR_ETAPA = 40; // duas consultas de 20 pedidos; cada etapa já é guardada (a tela vai enchendo)
const TIMEOUT_APONTAMENTO_MS = 20_000;
const MAXIMO_DE_DIAS_NA_CONSULTA = 366;

interface Lancamento {
  id: string;
  data: string; // aaaa-mm-dd
  pedido: string;
  cliente: string | null;
  metragem: number | null;
  valor: number | null;
  motoristaId: string;
  caminhaoId: string;
}

interface PedidoGuardado {
  encontrado: boolean;
  valorTotal: number | null;
  vendedorId: number | null;
  parcelas: PedidoDaEntregaNomus['parcelas'];
  prazoIso: string | null;
  prazoOrigem: 'itens' | 'padrao' | null;
  atualizadoEm: number;
}

interface ContasGuardadas {
  contas: ContaDoPedidoNomus[];
  atualizadoEm: number;
}

interface Estado {
  versao: 1;
  entregas: Lancamento[];
  entregasAtualizadoEm: number;
  motoristas: Record<string, string>;
  caminhoes: Record<string, string>;
  pedidos: Record<string, PedidoGuardado>; // por número do pedido
  contas: Record<string, ContasGuardadas>; // por número do pedido
  formas: Record<string, string>;
  vendedores: Record<string, string>;
  pcp: Record<string, { prazo: string | null }>; // prazo Gferro (PCP) por número do pedido
  formatoParcelas?: number; // 2 = valores de parcela lidos com o ponto de milhar certo (4.575 = 4575)
  ultimoErro: { mensagem: string; em: number } | null;
}

const estadoVazio = (): Estado => ({ versao: 1, entregas: [], entregasAtualizadoEm: 0, motoristas: {}, caminhoes: {}, pedidos: {}, contas: {}, formas: {}, vendedores: {}, pcp: {}, ultimoErro: null });

let estado: Estado | null = null;
let emAndamento: Promise<void> | null = null;

async function lerArquivo(arquivo: string): Promise<Estado | null> {
  try {
    const dados = JSON.parse(await readFile(arquivo, 'utf-8'));
    return dados?.versao === 1 ? { ...estadoVazio(), ...dados } : null;
  } catch {
    return null;
  }
}

async function carregarDoDisco(): Promise<Estado> {
  if (estado) return estado;
  estado = (await lerArquivo(ARQUIVO)) ?? (await lerArquivo(`${ARQUIVO}.bak`)) ?? estadoVazio();
  // Estados guardados antes da correção leram parcelas de "4.575" como 4,575: manda reler os pedidos (vem do cache, na hora).
  if (estado.formatoParcelas !== 2) {
    for (const pedido of Object.values(estado.pedidos)) pedido.atualizadoEm = 0;
    estado.formatoParcelas = 2;
  }
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
    console.error('[entregas] não foi possível salvar o estado:', e.message);
  }
}

// ---- Apontamento de produção ----

async function lerApontamento(rota: string): Promise<any[]> {
  const base = (process.env.APONTAMENTO_BASE_URL || '').replace(/\/+$/, '');
  if (!base) throw new Error('APONTAMENTO_BASE_URL não configurado no .env');
  const resposta = await fetch(`${base}${rota}`, { signal: AbortSignal.timeout(TIMEOUT_APONTAMENTO_MS) });
  if (!resposta.ok) throw new Error(`Apontamento de Produção respondeu ${resposta.status} em ${rota}`);
  const dados = await resposta.json();
  if (!Array.isArray(dados)) throw new Error(`Resposta inesperada do Apontamento de Produção em ${rota}`);
  return dados;
}

const numeroOuNull = (valor: unknown): number | null => (typeof valor === 'number' && Number.isFinite(valor) ? valor : null);

async function atualizarDoApontamento(atual: Estado): Promise<void> {
  const [entregas, motoristas, caminhoes] = await Promise.all([lerApontamento('/api/entregas'), lerApontamento('/api/motoristas'), lerApontamento('/api/caminhoes')]);
  atual.entregas = entregas
    .filter((e) => typeof e?.id === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(e?.data ?? '') && numeroDoPedido(e?.pedido) !== null)
    .map((e): Lancamento => ({
      id: e.id,
      data: e.data,
      pedido: String(e.pedido),
      cliente: typeof e.cliente === 'string' && e.cliente.trim() ? e.cliente.trim() : null,
      metragem: numeroOuNull(e.metragem),
      valor: numeroOuNull(e.valor),
      motoristaId: String(e.motoristaId ?? ''),
      caminhaoId: String(e.caminhaoId ?? ''),
    }));
  atual.motoristas = Object.fromEntries(motoristas.filter((m) => m?.id && m?.nome).map((m) => [String(m.id), String(m.nome)]));
  atual.caminhoes = Object.fromEntries(caminhoes.filter((c) => c?.id).map((c) => [String(c.id), String(c.placa ?? c.nome ?? '—')]));
  atual.entregasAtualizadoEm = Date.now();
}

// ---- Nomus ----

async function atualizarDadosDoNomus(atual: Estado): Promise<void> {
  try {
    const nomes = await nomesDosVendedores();
    if (nomes.size > 0) atual.vendedores = Object.fromEntries([...nomes].map(([id, nome]) => [String(id), nome]));
  } catch (e: any) {
    console.error('[entregas] não foi possível ler os vendedores; mantendo os guardados:', e?.message ?? e);
  }
  // Formas de pagamento ("Pix", "Dinheiro"...): só enfeitam o recebimento, então são lidas em segundo plano, sem segurar o resto.
  if (Object.keys(atual.formas).length === 0) {
    void buscarFormasPagamento()
      .then(async (formas) => {
        atual.formas = Object.fromEntries([...formas].map(([id, nome]) => [String(id), nome]));
        await persistir();
      })
      .catch((e: any) => console.error('[entregas] não foi possível ler as formas de pagamento:', e?.message ?? e));
  }

  // Prazo combinado no PCP (Gferro): é o que vale para dizer se a entrega foi no prazo, como na tela de Pedidos.
  try {
    const dadosPcp = await obterDadosPcp();
    if (dadosPcp) {
      const pcp: Record<string, { prazo: string | null }> = {};
      for (const entrega of atual.entregas) {
        const numero = numeroDoPedido(entrega.pedido)!;
        const doPedido = dadosPcp.get(numero);
        if (doPedido) pcp[numero] = { prazo: doPedido.prazo };
      }
      atual.pcp = pcp;
    }
  } catch (e: any) {
    console.error('[entregas] não foi possível ler os prazos do PCP; mantendo os guardados:', e?.message ?? e);
  }

  // Pedidos das entregas, das mais recentes para as mais antigas: o mês corrente enche primeiro.
  const ultimaEntrega = new Map<number, string>();
  for (const entrega of atual.entregas) {
    const numero = numeroDoPedido(entrega.pedido)!;
    if (!ultimaEntrega.has(numero) || entrega.data > ultimaEntrega.get(numero)!) ultimaEntrega.set(numero, entrega.data);
  }
  const numeros = [...ultimaEntrega.keys()].sort((a, b) => ultimaEntrega.get(b)!.localeCompare(ultimaEntrega.get(a)!));
  const hoje = new Date();
  const limiteRecente = new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate() - DIAS_DE_ENTREGA_RECENTE);
  const limiteRecenteIso = `${limiteRecente.getFullYear()}-${String(limiteRecente.getMonth() + 1).padStart(2, '0')}-${String(limiteRecente.getDate()).padStart(2, '0')}`;

  // Primeira passada, instantânea: tudo o que a intranet já tem guardado (cache mensal dos pedidos) entra de uma vez, para a
  // tela mostrar vendedor, loja, valor e prazo de quase todas as entregas logo; o Nomus só entra nas etapas abaixo.
  const agoraDaPassada = Date.now();
  const precisamDoPedido = numeros.filter((n) => !atual.pedidos[n] || agoraDaPassada - atual.pedidos[n].atualizadoEm > PEDIDO_VALIDO_POR_MS);
  const doCache = pedidosDoCacheDoPainel(precisamDoPedido);
  for (const pedido of doCache) {
    atual.pedidos[pedido.numero] = { encontrado: true, valorTotal: pedido.valorTotal, vendedorId: pedido.idPessoaVendedor ?? null, parcelas: pedido.parcelas, prazoIso: pedido.prazoIso, prazoOrigem: pedido.prazoOrigem, atualizadoEm: agoraDaPassada };
  }
  if (doCache.length > 0) await persistir();

  for (let i = 0; i < numeros.length; i += PEDIDOS_POR_ETAPA) {
    const etapa = numeros.slice(i, i + PEDIDOS_POR_ETAPA);
    const agora = Date.now();

    const faltamPedidos = etapa.filter((n) => !atual.pedidos[n] || agora - atual.pedidos[n].atualizadoEm > PEDIDO_VALIDO_POR_MS);
    if (faltamPedidos.length > 0) {
      const guardarPedido = (pedido: PedidoDaEntregaNomus) => {
        atual.pedidos[pedido.numero] = { encontrado: true, valorTotal: pedido.valorTotal, vendedorId: pedido.idPessoaVendedor ?? null, parcelas: pedido.parcelas, prazoIso: pedido.prazoIso, prazoOrigem: pedido.prazoOrigem, atualizadoEm: agora };
      };
      // Primeiro o que a intranet já tem guardado (cache mensal dos pedidos): entra na hora, sem esperar o Nomus.
      const resolvidos = new Set<number>();
      for (const pedido of pedidosDoCacheDoPainel(faltamPedidos)) {
        guardarPedido(pedido);
        resolvidos.add(pedido.numero);
      }
      const restantes = faltamPedidos.filter((n) => !resolvidos.has(n));
      if (restantes.length > 0) {
        if (resolvidos.size > 0) await persistir();
        for (const pedido of await buscarPedidosDasEntregas(restantes)) {
          guardarPedido(pedido);
          resolvidos.add(pedido.numero);
        }
        for (const numero of restantes) {
          if (!resolvidos.has(numero)) atual.pedidos[numero] = { encontrado: false, valorTotal: null, vendedorId: null, parcelas: [], prazoIso: null, prazoOrigem: null, atualizadoEm: agora };
        }
      }
    }

    const faltamContas = etapa.filter((n) => {
      if (!atual.pedidos[n]?.encontrado) return false;
      const guardadas = atual.contas[n];
      const validade = ultimaEntrega.get(n)! >= limiteRecenteIso ? CONTAS_RECENTES_VALIDAS_POR_MS : CONTAS_ANTIGAS_VALIDAS_POR_MS;
      return !guardadas || agora - guardadas.atualizadoEm > validade;
    });
    if (faltamContas.length > 0) {
      const contas = await buscarContasDosPedidos(faltamContas);
      const porPedido = new Map<number, ContaDoPedidoNomus[]>(faltamContas.map((n) => [n, []]));
      for (const conta of contas) {
        const numero = numeroDoPedido(conta.descricaoLancamento);
        if (numero !== null) porPedido.get(numero)?.push(conta);
      }
      for (const [numero, lista] of porPedido) atual.contas[numero] = { contas: lista, atualizadoEm: agora };
    }
    if (faltamPedidos.length > 0 || faltamContas.length > 0) await persistir();
  }
}

async function executarAtualizacao(): Promise<void> {
  const atual = await carregarDoDisco();
  const inicio = Date.now();
  await atualizarDoApontamento(atual);
  await persistir(); // as entregas já aparecem na tela enquanto o Nomus é lido
  await atualizarDadosDoNomus(atual);
  atual.ultimoErro = null;
  await persistir();
  console.log(`[entregas] atualização: ${atual.entregas.length} entregas em ${Math.round((Date.now() - inicio) / 1000)}s`);
}

/** Dispara uma atualização em segundo plano (uma por vez). Nunca rejeita: a falha fica registrada no estado. */
export function atualizarEntregas(): Promise<void> {
  if (!emAndamento) {
    emAndamento = executarAtualizacao()
      .catch(async (erro) => {
        console.error('[entregas] falha na atualização; mantendo os dados anteriores:', erro?.message ?? erro);
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
export function iniciarAtualizacaoEntregas(): void {
  const ciclo = async () => {
    await atualizarEntregas();
    setTimeout(ciclo, INTERVALO_ATUALIZACAO_MS).unref();
  };
  void carregarDoDisco().then(() => setTimeout(ciclo, 20_000).unref());
}

// ---- Resposta da tela ----

const dataValida = (texto: unknown): texto is string => typeof texto === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(texto) && !Number.isNaN(Date.parse(texto));

/** Valida o período pedido (De/Até, até 366 dias); lança erro 400 se estiver errado. */
export function validarPeriodoEntregas(inicio: unknown, fim: unknown): { inicio: string; fim: string } {
  const erro = (mensagem: string) => Object.assign(new Error(mensagem), { status: 400 });
  if (!dataValida(inicio) || !dataValida(fim)) throw erro('Informe inicio e fim no formato AAAA-MM-DD.');
  if (inicio > fim) throw erro('A data inicial deve ser anterior ou igual à data final.');
  if ((Date.parse(fim) - Date.parse(inicio)) / 86_400_000 > MAXIMO_DE_DIAS_NA_CONSULTA) throw erro(`O período pode ter no máximo ${MAXIMO_DE_DIAS_NA_CONSULTA} dias.`);
  return { inicio, fim };
}

/** Monta a tela só do que está guardado (não consulta o apontamento nem o Nomus). */
export async function montarRespostaEntregas(inicio: string, fim: string, forcarAtualizacao = false): Promise<RespostaEntregas> {
  const atual = await carregarDoDisco();
  const vencido = Date.now() - atual.entregasAtualizadoEm > INTERVALO_ATUALIZACAO_MS;
  if (forcarAtualizacao || vencido) void atualizarEntregas();

  if (atual.entregasAtualizadoEm === 0) {
    return { inicio, fim, atualizadoEm: new Date().toISOString(), carregando: true, atualizando: true, entregas: [] };
  }

  const liberados = await numerosLiberadosNoNomus();
  const nomesLojas = new Map<string, string>(LOJAS.map((l) => [l.id, l.nome]));
  const nomeDaForma = (id: number | null) => (id === null ? null : atual.formas[id] ?? null);

  // Primeira entrega lançada de cada pedido (em todo o histórico) e quantas vezes ele foi lançado.
  const ordenadas = [...atual.entregas].sort((a, b) => a.data.localeCompare(b.data) || a.id.localeCompare(b.id));
  const primeira = new Map<number, Lancamento>();
  const quantidade = new Map<number, number>();
  for (const entrega of ordenadas) {
    const numero = numeroDoPedido(entrega.pedido)!;
    if (!primeira.has(numero)) primeira.set(numero, entrega);
    quantidade.set(numero, (quantidade.get(numero) ?? 0) + 1);
  }

  let pendentes = 0;
  const linhas: EntregaLinha[] = [];
  for (const entrega of ordenadas) {
    if (entrega.data < inicio || entrega.data > fim) continue;
    const numero = numeroDoPedido(entrega.pedido)!;
    const pedido = atual.pedidos[numero];
    const contas = atual.contas[numero];
    const encontrado = !!pedido?.encontrado;
    const vendedor = pedido?.vendedorId != null ? atual.vendedores[pedido.vendedorId] ?? null : null;
    const lojaId = vendedor ? lojaDoVendedor(vendedor) : undefined;
    const valorPedido = encontrado ? pedido.valorTotal : entrega.valor;
    const recebimento = encontrado && contas ? resumirRecebimento(contas.contas, entrega.data, valorPedido, pedido.parcelas, nomeDaForma) : null;
    if (!pedido || (encontrado && !contas)) pendentes += 1;

    const real = primeira.get(numero)!.data;
    const prazoGferro = atual.pcp[numero]?.prazo ?? null;
    const prazoEscolhido = prazoGferro ?? pedido?.prazoIso ?? null;
    const prazoDaEntrega = classificarPrazoEntrega(prazoEscolhido, real);
    linhas.push({
      id: entrega.id,
      data: entrega.data,
      pedido: codigoDoPedido(numero),
      cliente: entrega.cliente,
      metragem: entrega.metragem,
      motorista: atual.motoristas[entrega.motoristaId] ?? '—',
      caminhao: atual.caminhoes[entrega.caminhaoId] ?? '—',
      vendedor,
      loja: (lojaId && nomesLojas.get(lojaId)) || 'Sem loja',
      pedidoLido: !!pedido,
      pedidoEncontrado: encontrado,
      valorPedido,
      recebimento,
      prazo: prazoEscolhido,
      fontePrazo: prazoGferro ? 'gferro' : pedido?.prazoIso ? 'nomus' : null,
      liberadoNoNomus: liberados?.has(numero) ?? false,
      situacaoPrazo: prazoDaEntrega.situacao,
      diasAtraso: prazoDaEntrega.diasAtraso,
      diasAntecipado: prazoDaEntrega.diasAntecipado,
      primeiraDoPedido: primeira.get(numero)!.id === entrega.id,
      lancamentosDoPedido: quantidade.get(numero) ?? 1,
    });
  }

  return {
    inicio,
    fim,
    atualizadoEm: new Date(atual.entregasAtualizadoEm).toISOString(),
    ...(emAndamento ? { atualizando: true } : {}),
    ...(pendentes > 0 ? { pendentes } : {}),
    ...(liberados === null ? { liberadosIndisponivel: true } : {}),
    ...(atual.ultimoErro ? { erroAtualizacao: atual.ultimoErro.mensagem } : {}),
    entregas: linhas.reverse(), // mais recentes primeiro
  };
}
