import { mkdir, readFile, writeFile } from 'fs/promises';
import path from 'path';
import { buscarPedidosLiberadosParaGestao, type FontePedidoGestao } from './nomus';

export const STATUS_PEDIDO = ['AGUARDANDO', 'PEDIDO LIBERADO', 'EM PRODUÇÃO', 'EXPEDIÇÃO', 'ROTA DE ENTREGA', 'ENCERRADO', 'CANCELADO'] as const;
export const STATUS_ATENDIMENTO = ['Aguardando programação', 'Aguardando compras', 'Aguardando produção', 'Em análise', 'Aguardando retorno', 'Pronto para entrega', 'Concluído'] as const;

export type StatusPedidoGestao = typeof STATUS_PEDIDO[number];
export type StatusAtendimentoPedido = typeof STATUS_ATENDIMENTO[number];

export interface HistoricoPedidoGestao {
  id: string;
  usuario: string;
  acao: string;
  criadoEm: string;
}

interface EdicaoPedidoGestao {
  status?: StatusPedidoGestao;
  atendimento?: StatusAtendimentoPedido;
  prazo?: string;
  observacao?: string;
  cliente?: string;
  telefone?: string;
  responsavel?: string;
  atualizadoEm?: string;
  atualizadoPor?: string;
  historico?: HistoricoPedidoGestao[];
}

export interface PedidoGestao extends FontePedidoGestao {
  status: StatusPedidoGestao;
  atendimento: StatusAtendimentoPedido;
  prazo: string;
  prazoOriginal: string;
  observacao: string;
  responsavel: string;
  atualizadoEm?: string;
  atualizadoPor?: string;
  historico: HistoricoPedidoGestao[];
}

export interface PainelPedidosGestao {
  pedidos: PedidoGestao[];
  atualizadoEm: string;
  sincronizando: boolean;
  origem: 'nomus' | 'cache-inicial';
}

const PASTA_DATA = path.join(process.cwd(), 'data');
const ARQUIVO_FONTE = path.join(PASTA_DATA, 'pedidos-gestao-fonte.json');
const ARQUIVO_EDICOES = path.join(PASTA_DATA, 'pedidos-gestao-edicoes.json');
const ARQUIVO_RELATORIO_INICIAL = path.join(process.cwd(), 'relatorios', 'pedidos-liberados-nao-finalizados-2026-09-24.json');
const ARQUIVO_VENDEDORES = path.join(PASTA_DATA, 'vendas-cache-vendedores.json');
const ARQUIVO_PRODUTOS = path.join(PASTA_DATA, 'vendas-cache-produtos.json');
const ARQUIVO_FINANCEIRO_PEDIDOS = path.join(PASTA_DATA, 'vendas-emissao-somente-liberados-cache-financeiro-v5.json');
const TTL_MS = 3 * 60 * 1000;

interface CacheFonte {
  pedidos: FontePedidoGestao[];
  atualizadoEm: string;
  origem: 'nomus' | 'cache-inicial';
  sincronizacaoCompletaEm?: string;
}

let cacheFonte: CacheFonte | null = null;
let cacheEdicoes: Record<string, EdicaoPedidoGestao> | null = null;
let atualizacaoEmAndamento: Promise<CacheFonte> | null = null;

async function lerJson<T>(arquivo: string, fallback: T): Promise<T> {
  try {
    return JSON.parse(await readFile(arquivo, 'utf-8')) as T;
  } catch {
    return fallback;
  }
}

function parseNumeroBr(valor: unknown): number {
  if (typeof valor === 'number') return valor;
  const texto = String(valor || '').replace(/\./g, '').replace(',', '.');
  const numero = Number(texto);
  return Number.isFinite(numero) ? numero : 0;
}

function dataNomusParaIso(valor?: string): string {
  if (!valor) return '';
  const [data] = valor.split(' ');
  const partes = data.split('/');
  return partes.length === 3 ? `${partes[2]}-${partes[1]}-${partes[0]}` : data.slice(0, 10);
}

async function enriquecerComCacheFinanceiro(pedidos: FontePedidoGestao[]): Promise<FontePedidoGestao[]> {
  const cache = await lerJson<Record<string, { contas?: Array<{ idPessoa?: number; nomePessoa?: string; telefonePessoa?: string }> }>>(ARQUIVO_FINANCEIRO_PEDIDOS, {});
  const pessoas = new Map<number, { nome?: string; telefone?: string }>();
  for (const periodo of Object.values(cache)) {
    for (const conta of periodo.contas || []) {
      if (conta.idPessoa) pessoas.set(conta.idPessoa, { nome: conta.nomePessoa, telefone: conta.telefonePessoa });
    }
  }
  return pedidos.map((pedido) => {
    const pessoa = pedido.idPessoaCliente ? pessoas.get(pedido.idPessoaCliente) : undefined;
    return pessoa ? { ...pedido, cliente: pessoa.nome || pedido.cliente, telefone: pessoa.telefone || pedido.telefone } : pedido;
  });
}

async function carregarFonteInicial(): Promise<CacheFonte> {
  if (cacheFonte) return cacheFonte;
  const salvo = await lerJson<CacheFonte | null>(ARQUIVO_FONTE, null);
  if (salvo?.pedidos?.length) return (cacheFonte = salvo);

  const relatorio = await lerJson<{ pedidos?: any[]; geradoEm?: string }>(ARQUIVO_RELATORIO_INICIAL, {});
  const vendedoresRaw = await lerJson<any>(ARQUIVO_VENDEDORES, {});
  const produtosRaw = await lerJson<Record<string, { descricao?: string }>>(ARQUIVO_PRODUTOS, {});
  const vendedoresLista = Array.isArray(vendedoresRaw) ? vendedoresRaw : vendedoresRaw?.vendedores || [];
  const vendedores = new Map<number, string>(vendedoresLista.map((item: any) => [Number(item.id), item.nome || `Vendedor #${item.id}`]));

  const pedidosBase: FontePedidoGestao[] = (relatorio.pedidos || []).map((pedido: any) => {
    const itens = Array.isArray(pedido.itensPedido) ? pedido.itensPedido : [];
    const prazos = itens.map((item: any) => item.dataEntrega || '').filter(Boolean).sort();
    return {
      id: Number(pedido.id),
      codigoPedido: pedido.codigoPedido || String(pedido.id),
      dataEmissao: pedido.dataEmissao || '',
      dataModificacao: pedido.dataModificacao,
      idPessoaCliente: pedido.idPessoaCliente,
      cliente: pedido.idPessoaCliente ? `Cliente #${pedido.idPessoaCliente}` : 'Cliente não informado',
      telefone: '',
      cidade: '',
      idPessoaVendedor: pedido.idPessoaVendedor,
      vendedor: vendedores.get(Number(pedido.idPessoaVendedor)) || `Vendedor #${pedido.idPessoaVendedor}`,
      valorTotal: parseNumeroBr(pedido.valorTotal),
      prazoNomus: prazos.at(-1),
      observacoesNomus: [pedido.observacoes, pedido.observacoesInternas].filter(Boolean).join('\n'),
      produtos: itens.map((item: any) => {
        const descricao = produtosRaw[String(item.idProduto)]?.descricao || `Produto #${item.idProduto}`;
        return item.informacoesAdicionaisProduto ? `${descricao} - ${item.informacoesAdicionaisProduto}` : descricao;
      }),
      quantidadeItens: itens.length,
    };
  });
  const pedidos = await enriquecerComCacheFinanceiro(pedidosBase);
  return (cacheFonte = {
    pedidos,
    atualizadoEm: relatorio.geradoEm || new Date(0).toISOString(),
    sincronizacaoCompletaEm: relatorio.geradoEm,
    origem: 'cache-inicial',
  });
}

async function carregarEdicoes(): Promise<Record<string, EdicaoPedidoGestao>> {
  if (cacheEdicoes) return cacheEdicoes;
  cacheEdicoes = await lerJson<Record<string, EdicaoPedidoGestao>>(ARQUIVO_EDICOES, {});
  return cacheEdicoes;
}

async function persistirJson(arquivo: string, conteudo: unknown): Promise<void> {
  await mkdir(PASTA_DATA, { recursive: true });
  await writeFile(arquivo, JSON.stringify(conteudo, null, 2), 'utf-8');
}

function mesclarPedido(fonte: FontePedidoGestao, edicao?: EdicaoPedidoGestao): PedidoGestao {
  const prazoOriginal = dataNomusParaIso(fonte.prazoNomus);
  return {
    ...fonte,
    cliente: edicao?.cliente || fonte.cliente,
    telefone: edicao?.telefone ?? fonte.telefone,
    status: edicao?.status || 'PEDIDO LIBERADO',
    atendimento: edicao?.atendimento || 'Aguardando programação',
    prazo: edicao?.prazo ?? prazoOriginal,
    prazoOriginal,
    observacao: edicao?.observacao || '',
    responsavel: edicao?.responsavel || '',
    atualizadoEm: edicao?.atualizadoEm,
    atualizadoPor: edicao?.atualizadoPor,
    historico: edicao?.historico || [],
  };
}

function inicioIncremental(): string {
  const dataCache = new Date(cacheFonte?.atualizadoEm || 0);
  const data = Number.isNaN(dataCache.getTime()) || dataCache.getTime() === 0 ? new Date() : dataCache;
  // Sobreposição de um dia evita perder pedidos criados durante a virada de data.
  data.setDate(data.getDate() - 1);
  data.setHours(0, 0, 0, 0);
  const pad = (numero: number) => String(numero).padStart(2, '0');
  return `${data.getFullYear()}-${pad(data.getMonth() + 1)}-${pad(data.getDate())}T00:00:00`;
}

function iniciarAtualizacao(completa = false): Promise<CacheFonte> {
  if (atualizacaoEmAndamento) return atualizacaoEmAndamento;
  const corte = completa ? '2019-12-31T23:59:59' : inicioIncremental();
  atualizacaoEmAndamento = buscarPedidosLiberadosParaGestao(corte)
    .then(enriquecerComCacheFinanceiro)
    .then(async (pedidos) => {
      const agora = new Date().toISOString();
      const anteriores = cacheFonte?.pedidos || [];
      const inicioIso = corte.slice(0, 10);
      const antigos = completa ? [] : anteriores.filter((pedido) => dataNomusParaIso(pedido.dataEmissao) < inicioIso);
      const porId = new Map([...antigos, ...pedidos].map((pedido) => [pedido.id, pedido]));
      const novo: CacheFonte = {
        pedidos: [...porId.values()],
        atualizadoEm: agora,
        sincronizacaoCompletaEm: completa ? agora : cacheFonte?.sincronizacaoCompletaEm,
        origem: 'nomus',
      };
      cacheFonte = novo;
      await persistirJson(ARQUIVO_FONTE, novo);
      return novo;
    })
    .finally(() => { atualizacaoEmAndamento = null; });
  return atualizacaoEmAndamento;
}

export async function listarPedidosGestao(forcarAtualizacao = false): Promise<PainelPedidosGestao> {
  let fonte = await carregarFonteInicial();
  const idade = Date.now() - new Date(fonte.atualizadoEm).getTime();
  const idadeCompleta = Date.now() - new Date(fonte.sincronizacaoCompletaEm || 0).getTime();
  if (forcarAtualizacao) fonte = await iniciarAtualizacao(false);
  else if (!Number.isFinite(idade) || idade > TTL_MS) {
    void iniciarAtualizacao(false)
      .then(() => {
        if (!Number.isFinite(idadeCompleta) || idadeCompleta > 24 * 60 * 60 * 1000) {
          void iniciarAtualizacao(true).catch((erro) => console.error('[pedidos] falha na reconciliação completa:', erro));
        }
      })
      .catch((erro) => console.error('[pedidos] falha ao sincronizar com Nomus:', erro));
  }
  const edicoes = await carregarEdicoes();
  return {
    pedidos: fonte.pedidos.map((pedido) => mesclarPedido(pedido, edicoes[String(pedido.id)])),
    atualizadoEm: fonte.atualizadoEm,
    sincronizando: !!atualizacaoEmAndamento,
    origem: fonte.origem,
  };
}

export async function atualizarPedidoGestao(id: number, alteracoes: Partial<EdicaoPedidoGestao>, usuario: string): Promise<PedidoGestao> {
  const fonte = await carregarFonteInicial();
  const pedidoFonte = fonte.pedidos.find((pedido) => pedido.id === id);
  if (!pedidoFonte) throw Object.assign(new Error('Pedido não encontrado na lista de liberados.'), { status: 404 });
  const edicoes = await carregarEdicoes();
  const anterior = edicoes[String(id)] || {};

  if (alteracoes.status && !STATUS_PEDIDO.includes(alteracoes.status)) throw Object.assign(new Error('Status inválido.'), { status: 400 });
  if (alteracoes.atendimento && !STATUS_ATENDIMENTO.includes(alteracoes.atendimento)) throw Object.assign(new Error('Atendimento inválido.'), { status: 400 });
  if (alteracoes.prazo !== undefined && alteracoes.prazo !== '' && !/^\d{4}-\d{2}-\d{2}$/.test(alteracoes.prazo)) throw Object.assign(new Error('Prazo inválido.'), { status: 400 });

  const campos: Array<keyof EdicaoPedidoGestao> = ['status', 'atendimento', 'prazo', 'observacao', 'cliente', 'telefone', 'responsavel'];
  const descricoes: string[] = [];
  for (const campo of campos) {
    if (alteracoes[campo] !== undefined && alteracoes[campo] !== anterior[campo]) descricoes.push(`${campo}: ${String(alteracoes[campo] || 'vazio')}`);
  }
  const agora = new Date().toISOString();
  const historico = [...(anterior.historico || [])];
  if (descricoes.length) historico.unshift({ id: `${id}-${Date.now()}`, usuario, acao: descricoes.join(' | '), criadoEm: agora });
  const novaEdicao: EdicaoPedidoGestao = { ...anterior, ...alteracoes, atualizadoEm: agora, atualizadoPor: usuario, historico: historico.slice(0, 100) };
  edicoes[String(id)] = novaEdicao;
  await persistirJson(ARQUIVO_EDICOES, edicoes);
  return mesclarPedido(pedidoFonte, novaEdicao);
}
