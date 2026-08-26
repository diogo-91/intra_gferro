import { mkdir, readFile, writeFile } from 'fs/promises';
import path from 'path';

export const STATUS_ATENDIMENTO_PLANILHA = [
  'Atendimento aberto',
  'Aguardando compras',
  'Aguardado programação',
  'Aguardando produção',
  'Em Analise',
  'Aguardando retorno',
  'Resolvido',
] as const;

export type StatusAtendimentoPlanilha = typeof STATUS_ATENDIMENTO_PLANILHA[number];

export interface AtendimentoPlanilhaSac {
  id: string;
  linha: number;
  cliente: string;
  telefone: string;
  numeroPedido: string;
  statusPedido: string;
  prazoEntrega: string;
  atendimento: StatusAtendimentoPlanilha | null;
  responsavel?: string;
}

export interface DadosPlanilhaSac {
  atendimentos: AtendimentoPlanilhaSac[];
  contadores: Record<StatusAtendimentoPlanilha, number>;
  atualizadoEm: string;
  atualizando: boolean;
}

const PLANILHA_ID = '1LdXxN5A16kz2gFFMwu5dUzw8DrbpGTRbd_L4_lB4ni8';
const PLANILHA_CSV_URL = `https://docs.google.com/spreadsheets/d/${PLANILHA_ID}/gviz/tq?tqx=out:csv&gid=0`;
const ARQUIVO_CACHE = path.join(process.cwd(), 'data', 'sac-planilha-cache.json');
const CACHE_TTL_MS = 45_000;

interface CacheDisco extends DadosPlanilhaSac {
  versao: 2;
  geradoEm: number;
}

let cache: CacheDisco | null = null;
let carregamentoCache: Promise<void> | null = null;
let atualizacaoEmAndamento: Promise<CacheDisco> | null = null;
let atualizacaoAutomaticaIniciada = false;

function normalizar(texto: string): string {
  return texto
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .trim()
    .replace(/\s+/g, ' ')
    .toUpperCase();
}

function statusDaColunaF(valor: string): StatusAtendimentoPlanilha | null {
  const status = normalizar(valor);
  if (!status) return null;
  if (status === 'ATENDIMENTO ABERTO') return 'Atendimento aberto';
  if (status === 'AGUARDANDO COMPRAS') return 'Aguardando compras';
  if (status === 'AGUARDADO PROGRAMACAO' || status === 'AGUARDANDO PROGRAMACAO') return 'Aguardado programação';
  if (status === 'AGUARDANDO PRODUCAO') return 'Aguardando produção';
  if (status === 'EM ANALISE') return 'Em Analise';
  if (status === 'AGUARDANDO RETORNO') return 'Aguardando retorno';
  if (status === 'RESOLVIDO') return 'Resolvido';
  return null;
}

function parseCsv(conteudo: string): string[][] {
  const linhas: string[][] = [];
  let linha: string[] = [];
  let campo = '';
  let entreAspas = false;

  for (let indice = 0; indice < conteudo.length; indice += 1) {
    const caractere = conteudo[indice];
    const proximo = conteudo[indice + 1];
    if (caractere === '"') {
      if (entreAspas && proximo === '"') {
        campo += '"';
        indice += 1;
      } else {
        entreAspas = !entreAspas;
      }
    } else if (caractere === ',' && !entreAspas) {
      linha.push(campo.trim());
      campo = '';
    } else if ((caractere === '\n' || caractere === '\r') && !entreAspas) {
      if (caractere === '\r' && proximo === '\n') indice += 1;
      linha.push(campo.trim());
      if (linha.some(Boolean)) linhas.push(linha);
      linha = [];
      campo = '';
    } else {
      campo += caractere;
    }
  }

  if (campo || linha.length > 0) {
    linha.push(campo.trim());
    if (linha.some(Boolean)) linhas.push(linha);
  }
  return linhas;
}

function linhaEhResponsavel(telefone: string): boolean {
  return /[A-Za-zÀ-ÿ]/.test(telefone);
}

function montarAtendimentos(csv: string): AtendimentoPlanilhaSac[] {
  const linhas = parseCsv(csv).slice(1).map((colunas, indice) => ({
    linha: indice + 2,
    cliente: colunas[0] || '',
    telefone: colunas[1] || '',
    numeroPedido: colunas[2] || '',
    statusPedido: colunas[3] || '',
    prazoEntrega: colunas[4] || '',
    atendimentoOriginal: colunas[5] || '',
  })).filter((linha) => linha.numeroPedido || linha.cliente || linha.telefone);

  const porPedido = new Map<string, typeof linhas>();
  for (const linha of linhas) {
    const chave = linha.numeroPedido || `linha-${linha.linha}`;
    const grupo = porPedido.get(chave) ?? [];
    grupo.push(linha);
    porPedido.set(chave, grupo);
  }

  const atendimentos: AtendimentoPlanilhaSac[] = [];
  for (const grupo of porPedido.values()) {
    const clientes = grupo.filter((linha) => !linhaEhResponsavel(linha.telefone));
    const registros = clientes.length > 0 ? clientes : [grupo[0]];

    for (const registro of registros) {
      const demaisPorProximidade = [...grupo]
        .filter((linha) => linha.linha !== registro.linha)
        .sort((a, b) => Math.abs(a.linha - registro.linha) - Math.abs(b.linha - registro.linha));
      const responsavel = demaisPorProximidade.find((linha) => linhaEhResponsavel(linha.telefone));
      const complemento = demaisPorProximidade.find((linha) => linha.atendimentoOriginal || linha.statusPedido || linha.prazoEntrega);
      const atendimentoOriginal = registro.atendimentoOriginal || complemento?.atendimentoOriginal || '';

      atendimentos.push({
        id: `planilha-linha-${registro.linha}`,
        linha: registro.linha,
        cliente: registro.cliente || 'Cliente não informado',
        telefone: registro.telefone,
        numeroPedido: registro.numeroPedido,
        statusPedido: registro.statusPedido || complemento?.statusPedido || '',
        prazoEntrega: registro.prazoEntrega || complemento?.prazoEntrega || '',
        atendimento: statusDaColunaF(atendimentoOriginal),
        responsavel: responsavel?.cliente || undefined,
      });
    }
  }

  const pesoStatus: Record<StatusAtendimentoPlanilha, number> = {
    'Atendimento aberto': 0,
    'Em Analise': 1,
    'Aguardando compras': 2,
    'Aguardado programação': 3,
    'Aguardando produção': 4,
    'Aguardando retorno': 5,
    'Resolvido': 6,
  };
  return atendimentos.sort((a, b) =>
    (a.atendimento === null ? 7 : pesoStatus[a.atendimento]) - (b.atendimento === null ? 7 : pesoStatus[b.atendimento])
    || Number(b.numeroPedido) - Number(a.numeroPedido)
    || b.linha - a.linha
  );
}

function criarContadores(atendimentos: AtendimentoPlanilhaSac[]): Record<StatusAtendimentoPlanilha, number> {
  const contadores = Object.fromEntries(STATUS_ATENDIMENTO_PLANILHA.map((status) => [status, 0])) as Record<StatusAtendimentoPlanilha, number>;
  for (const atendimento of atendimentos) {
    if (atendimento.atendimento !== null) contadores[atendimento.atendimento] += 1;
  }
  return contadores;
}

async function carregarCacheDoDisco(): Promise<void> {
  if (cache || carregamentoCache) return carregamentoCache ?? undefined;
  carregamentoCache = readFile(ARQUIVO_CACHE, 'utf-8')
    .then((conteudo) => {
      const salvo = JSON.parse(conteudo) as CacheDisco;
      if (salvo?.versao === 2 && Array.isArray(salvo.atendimentos) && salvo.atualizadoEm) cache = salvo;
    })
    .catch(() => undefined)
    .finally(() => {
      carregamentoCache = null;
    });
  return carregamentoCache;
}

async function persistirCache(novo: CacheDisco): Promise<void> {
  cache = novo;
  await mkdir(path.dirname(ARQUIVO_CACHE), { recursive: true });
  await writeFile(ARQUIVO_CACHE, JSON.stringify(novo, null, 2), 'utf-8');
}

async function consultarPlanilha(): Promise<CacheDisco> {
  const controlador = new AbortController();
  const limite = setTimeout(() => controlador.abort(), 30_000);
  try {
    const resposta = await fetch(PLANILHA_CSV_URL, {
      signal: controlador.signal,
      headers: { 'User-Agent': 'GFERRO-Intranet/1.0' },
    });
    if (!resposta.ok) throw new Error(`Google Sheets respondeu ${resposta.status}`);
    const atendimentos = montarAtendimentos(await resposta.text());
    const agora = Date.now();
    const novo: CacheDisco = {
      versao: 2,
      atendimentos,
      contadores: criarContadores(atendimentos),
      atualizadoEm: new Date(agora).toISOString(),
      atualizando: false,
      geradoEm: agora,
    };
    await persistirCache(novo);
    return novo;
  } finally {
    clearTimeout(limite);
  }
}

function iniciarConsulta(): Promise<CacheDisco> {
  if (!atualizacaoEmAndamento) {
    atualizacaoEmAndamento = consultarPlanilha()
      .catch((erro) => {
        if (cache) return cache;
        throw erro;
      })
      .finally(() => {
        atualizacaoEmAndamento = null;
      });
  }
  return atualizacaoEmAndamento;
}

export async function obterDadosPlanilhaSac(): Promise<DadosPlanilhaSac> {
  await carregarCacheDoDisco();
  if (!cache) return iniciarConsulta();
  if (Date.now() - cache.geradoEm >= CACHE_TTL_MS) void iniciarConsulta();
  return { ...cache, atualizando: atualizacaoEmAndamento !== null };
}

export async function atualizarDadosPlanilhaSac(): Promise<DadosPlanilhaSac> {
  await carregarCacheDoDisco();
  return iniciarConsulta();
}

export function iniciarAtualizacaoAutomaticaPlanilhaSac(): void {
  if (atualizacaoAutomaticaIniciada) return;
  atualizacaoAutomaticaIniciada = true;

  const executar = async () => {
    try {
      await atualizarDadosPlanilhaSac();
    } catch (erro) {
      console.error('[sac-planilha] falha ao atualizar; mantendo o último cache:', erro);
    } finally {
      const proximo = setTimeout(executar, 60_000);
      proximo.unref();
    }
  };

  void executar();
}
