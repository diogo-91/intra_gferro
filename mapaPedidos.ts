// Dashboard > Mapa (servidor): conta os pedidos do período por cidade e estado do cliente. Os pedidos vêm do cache mensal
// que a intranet já guarda; a cidade de cada cliente é lida no Nomus (cadastro da pessoa) uma única vez e fica guardada em
// disco. A tela lê só do que está guardado e nunca espera o Nomus.

import { copyFile, mkdir, readFile, rename, writeFile } from 'fs/promises';
import path from 'path';
import { buscarLocalDasPessoas, nomesDosVendedores, pedidosDoMesParaMapa, type PedidoParaMapa } from './nomus';
import { pedidosAEntregarParaMapa } from './pedidosAbertos';
import { LOJAS, lojaDoVendedor } from './src/data/vendedorLoja';
import { normalizarCidade, separarCidadeEUf, type LinhaMapa, type PedidoDoMapa, type RespostaMapa } from './src/mapaPedidos';

const ARQUIVO = path.join(process.cwd(), 'data', 'mapa-clientes.json');

const CLIENTES_POR_ETAPA = 60; // três consultas de 20; cada etapa é guardada e a tela vai enchendo
const MAXIMO_DE_MESES = 13;
const MAXIMO_DE_DIAS_NA_CONSULTA = 400;

interface LocalDoCliente {
  nome?: string; // ausente nos clientes lidos antes de o nome ser guardado
  municipio: string; // vazio se o cadastro não tem
  uf: string;
  lidoEm: number;
}

interface Estado {
  versao: 1;
  clientes: Record<string, LocalDoCliente>;
  ultimoErro: { mensagem: string; em: number } | null;
}

let estado: Estado | null = null;
let lendoClientes: Promise<void> | null = null;

async function lerArquivo(arquivo: string): Promise<Estado | null> {
  try {
    const dados = JSON.parse(await readFile(arquivo, 'utf-8'));
    return dados?.versao === 1 ? { versao: 1, clientes: dados.clientes ?? {}, ultimoErro: dados.ultimoErro ?? null } : null;
  } catch {
    return null;
  }
}

async function carregarDoDisco(): Promise<Estado> {
  if (estado) return estado;
  estado = (await lerArquivo(ARQUIVO)) ?? (await lerArquivo(`${ARQUIVO}.bak`)) ?? { versao: 1, clientes: {}, ultimoErro: null };
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
    console.error('[mapa] não foi possível salvar o estado:', e.message);
  }
}

/** Lê no Nomus a cidade dos clientes que ainda não estão guardados (uma leitura por vez, em segundo plano). */
function lerClientesFaltantes(ids: number[]): void {
  if (lendoClientes || ids.length === 0) return;
  lendoClientes = (async () => {
    const atual = await carregarDoDisco();
    for (let i = 0; i < ids.length; i += CLIENTES_POR_ETAPA) {
      const etapa = ids.slice(i, i + CLIENTES_POR_ETAPA).filter((id) => atual.clientes[id]?.nome === undefined);
      if (etapa.length === 0) continue;
      const lidos = new Map((await buscarLocalDasPessoas(etapa)).map((pessoa) => [pessoa.id, pessoa]));
      const agora = Date.now();
      for (const id of etapa) {
        const pessoa = lidos.get(id);
        const { cidade, uf } = pessoa ? separarCidadeEUf(pessoa.municipio, pessoa.uf) : { cidade: '', uf: '' };
        atual.clientes[id] = { nome: pessoa?.nome ?? '', municipio: cidade, uf, lidoEm: agora }; // sem cidade no cadastro também fica guardado: não relê toda hora
      }
      atual.ultimoErro = null;
      await persistir();
    }
    console.log(`[mapa] cidades de ${ids.length} clientes lidas`);
  })()
    .catch(async (erro) => {
      console.error('[mapa] falha ao ler as cidades dos clientes; tenta de novo depois:', erro?.message ?? erro);
      if (estado) {
        estado.ultimoErro = { mensagem: String(erro?.message ?? erro).slice(0, 200), em: Date.now() };
        await persistir();
      }
    })
    .finally(() => { lendoClientes = null; });
}

// ---- Resposta da tela ----

const dataValida = (texto: unknown): texto is string => typeof texto === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(texto) && !Number.isNaN(Date.parse(texto));

/** Valida o período pedido (De/Até, até 400 dias e 13 meses); lança erro 400 se estiver errado. */
export function validarPeriodoMapa(inicio: unknown, fim: unknown): { inicio: string; fim: string; meses: string[] } {
  const erro = (mensagem: string) => Object.assign(new Error(mensagem), { status: 400 });
  if (!dataValida(inicio) || !dataValida(fim)) throw erro('Informe inicio e fim no formato AAAA-MM-DD.');
  if (inicio > fim) throw erro('A data inicial deve ser anterior ou igual à data final.');
  if ((Date.parse(fim) - Date.parse(inicio)) / 86_400_000 > MAXIMO_DE_DIAS_NA_CONSULTA) throw erro(`O período pode ter no máximo ${MAXIMO_DE_DIAS_NA_CONSULTA} dias.`);
  const meses: string[] = [];
  const [anoFim, mesFim] = fim.split('-').map(Number);
  for (let [ano, mes] = inicio.split('-').map(Number); ano < anoFim || (ano === anoFim && mes <= mesFim); mes === 12 ? (ano += 1, mes = 1) : (mes += 1)) {
    meses.push(`${ano}-${String(mes).padStart(2, '0')}`);
    if (meses.length > MAXIMO_DE_MESES) throw erro(`O período pode abranger no máximo ${MAXIMO_DE_MESES} meses.`);
  }
  return { inicio, fim, meses };
}

/** Monta a tela só do que está guardado (os meses vêm do cache de pedidos; a cidade, do que já foi lida do Nomus). */
export async function montarRespostaMapa(periodo: { inicio: string; fim: string; meses: string[] }): Promise<RespostaMapa> {
  const atual = await carregarDoDisco();
  const lidos = await Promise.all(periodo.meses.map((mes) => pedidosDoMesParaMapa(mes)));
  const mesesPendentes = lidos.filter((m) => m === null).length;
  if (mesesPendentes === periodo.meses.length) {
    return { modo: 'periodo', inicio: periodo.inicio, fim: periodo.fim, atualizadoEm: new Date().toISOString(), carregando: true, totalPedidos: 0, semLocalizacao: { pedidos: 0, valor: 0 }, lojas: [], linhas: [], pedidos: [] };
  }

  const pedidos: PedidoParaMapa[] = lidos.flatMap((m) => m?.pedidos ?? []).filter((p) => p.dataEmissao >= periodo.inicio && p.dataEmissao <= periodo.fim);
  const nomesVendedores = await nomesDosVendedores().catch(() => new Map<number, string>());
  const nomesLojas = new Map<string, string>(LOJAS.map((l) => [l.id, l.nome]));

  const agrupado = await agruparPorCidade(pedidos.map((pedido) => {
    const nomeVendedor = pedido.idPessoaVendedor != null ? nomesVendedores.get(pedido.idPessoaVendedor) : undefined;
    const lojaId = nomeVendedor ? lojaDoVendedor(nomeVendedor) : undefined;
    return {
      idPessoaCliente: pedido.idPessoaCliente,
      codigo: pedido.codigoPedido,
      cliente: '',
      vendedor: pedido.idPessoaVendedor == null ? 'Sem vendedor' : nomeVendedor ?? `Vendedor #${pedido.idPessoaVendedor}`,
      loja: (lojaId && nomesLojas.get(lojaId)) || 'Sem loja',
      dataEmissao: pedido.dataEmissao,
      prazo: null,
      valorTotal: pedido.valorTotal,
    };
  }));

  const atualizadoEm = Math.min(...lidos.filter((m): m is NonNullable<typeof m> => m !== null).map((m) => m.atualizadoEm));
  return {
    modo: 'periodo',
    inicio: periodo.inicio,
    fim: periodo.fim,
    atualizadoEm: new Date(atualizadoEm).toISOString(),
    ...(mesesPendentes > 0 ? { mesesPendentes } : {}),
    ...agrupado,
  };
}

/** Pedidos que ainda não foram entregues (sem filtro de período), do estado guardado da tela Pedidos. */
export async function montarRespostaMapaAEntregar(forcar = false): Promise<RespostaMapa> {
  const fonte = await pedidosAEntregarParaMapa(forcar);
  const hoje = new Date().toISOString().slice(0, 10);
  if (fonte.carregando) {
    return { modo: 'a-entregar', inicio: hoje, fim: hoje, atualizadoEm: fonte.atualizadoEm, carregando: true, totalPedidos: 0, semLocalizacao: { pedidos: 0, valor: 0 }, lojas: [], linhas: [], pedidos: [] };
  }
  return {
    modo: 'a-entregar',
    inicio: hoje,
    fim: hoje,
    atualizadoEm: fonte.atualizadoEm,
    ...(fonte.atualizando ? { atualizando: true } : {}),
    ...(fonte.historicoParcial ? { historicoParcial: true } : {}),
    ...(fonte.erroAtualizacao ? { erroAtualizacao: fonte.erroAtualizacao } : {}),
    ...(await agruparPorCidade(fonte.pedidos)),
  };
}

interface PedidoParaAgrupar {
  idPessoaCliente?: number;
  codigo: string;
  cliente: string; // nome vindo da fonte, usado quando o cadastro do Nomus ainda não foi lido
  vendedor: string;
  loja: string;
  dataEmissao: string;
  prazo: string | null;
  valorTotal: number;
}

/** Junta os pedidos por cidade/UF/loja usando a cidade guardada de cada cliente; dispara a leitura dos clientes que faltam. */
async function agruparPorCidade(pedidos: PedidoParaAgrupar[]): Promise<Pick<RespostaMapa, 'pedidosPendentes' | 'erroAtualizacao' | 'totalPedidos' | 'semLocalizacao' | 'lojas' | 'linhas' | 'pedidos'>> {
  const atual = await carregarDoDisco();
  const faltantes = new Set<number>();
  const linhas = new Map<string, LinhaMapa>();
  const detalhes: PedidoDoMapa[] = [];
  let semLocalizacao = { pedidos: 0, valor: 0 };
  let pedidosPendentes = 0;
  let total = 0;
  for (const pedido of pedidos) {
    const local = pedido.idPessoaCliente != null ? atual.clientes[pedido.idPessoaCliente] : undefined;
    if (pedido.idPessoaCliente != null && local?.nome === undefined) faltantes.add(pedido.idPessoaCliente); // também relê quem ficou sem nome guardado
    if (pedido.idPessoaCliente != null && !local) {
      pedidosPendentes += 1;
      continue;
    }
    total += 1;
    if (!local || !local.municipio || !local.uf) {
      semLocalizacao = { pedidos: semLocalizacao.pedidos + 1, valor: semLocalizacao.valor + pedido.valorTotal };
      continue;
    }
    const chave = `${local.uf}|${normalizarCidade(local.municipio)}|${pedido.loja}`;
    const linha = linhas.get(chave) ?? { cidade: local.municipio, uf: local.uf, loja: pedido.loja, pedidos: 0, valor: 0 };
    linha.pedidos += 1;
    linha.valor += pedido.valorTotal;
    linhas.set(chave, linha);
    detalhes.push({
      codigo: pedido.codigo,
      cliente: local.nome || pedido.cliente || (pedido.idPessoaCliente != null ? `Cliente #${pedido.idPessoaCliente}` : '—'),
      cidade: local.municipio,
      uf: local.uf,
      vendedor: pedido.vendedor,
      loja: pedido.loja,
      dataEmissao: pedido.dataEmissao,
      prazo: pedido.prazo,
      valor: Math.round(pedido.valorTotal * 100) / 100,
    });
  }
  if (faltantes.size > 0) lerClientesFaltantes([...faltantes]);
  return {
    ...(pedidosPendentes > 0 ? { pedidosPendentes } : {}),
    ...(atual.ultimoErro ? { erroAtualizacao: atual.ultimoErro.mensagem } : {}),
    totalPedidos: total,
    semLocalizacao: { pedidos: semLocalizacao.pedidos, valor: Math.round(semLocalizacao.valor * 100) / 100 },
    lojas: [...new Set([...linhas.values()].map((l) => l.loja))].sort((a, b) => a.localeCompare(b, 'pt-BR')),
    linhas: [...linhas.values()].map((l) => ({ ...l, valor: Math.round(l.valor * 100) / 100 })),
    pedidos: detalhes.sort((a, b) => b.valor - a.valor || a.codigo.localeCompare(b.codigo)),
  };
}
