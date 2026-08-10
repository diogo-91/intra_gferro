// Integração com o app irmão "GFERO - APONTAMENTO PRODUCAO" (terminal de chão
// de fábrica) — NÃO é o Nomus, é uma API própria sem autenticação, hospedada
// em APONTAMENTO_BASE_URL:
// - GET /api/kanban: foto de AGORA (o que está em produção/parado/aguardando
//   por centro de trabalho) — só existe aqui, o Nomus não guarda esse estado
//   intermediário (um apontamento só é gravado lá quando começa E termina).
// - GET /api/relatorio-producao?inicio=AAAA-MM-DD&fim=AAAA-MM-DD: histórico já
//   apontado (finalizado), agregado por centro e detalhado por apontamento.
//   "valorProduzido" é sempre uma ESTIMATIVA (rateio do valor do pedido pela
//   quantidade), nunca um número exato do Nomus.

import type { KanbanProducao, RelatorioProducao } from './src/types';

const REQUEST_TIMEOUT_MS = 20_000;
// Kanban é "agora" — cache bem curto, só pra suavizar cliques repetidos/re-render.
const CACHE_TTL_KANBAN_MS = 20 * 1000;
// Relatório é histórico (finalizado) — mesmo padrão de TTL de vendas/financeiro.
const CACHE_TTL_RELATORIO_MS = 3 * 60 * 1000;

function getBaseUrl(): string {
  const url = (process.env.APONTAMENTO_BASE_URL || '').replace(/\/+$/, '');
  if (!url) throw new Error('APONTAMENTO_BASE_URL não configurado no .env');
  return url;
}

async function fetchJson(url: string): Promise<any> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const resp = await fetch(url, { signal: controller.signal });
    if (!resp.ok) {
      throw new Error(`Apontamento de Produção respondeu ${resp.status} em ${url}`);
    }
    return await resp.json();
  } finally {
    clearTimeout(timeoutId);
  }
}

// ---- Kanban (estado ao vivo) ----

let cacheKanban: { atualizadoEm: number; dado: KanbanProducao } | null = null;
let cacheKanbanEmAndamento: Promise<KanbanProducao> | null = null;

export async function getKanbanProducao(): Promise<KanbanProducao> {
  const agora = Date.now();
  if (cacheKanban && agora - cacheKanban.atualizadoEm < CACHE_TTL_KANBAN_MS) {
    return cacheKanban.dado;
  }

  if (!cacheKanbanEmAndamento) {
    cacheKanbanEmAndamento = fetchJson(`${getBaseUrl()}/api/kanban`)
      .then((dado) => {
        cacheKanban = { atualizadoEm: Date.now(), dado };
        return dado as KanbanProducao;
      })
      .finally(() => {
        cacheKanbanEmAndamento = null;
      });
  }

  return cacheKanban?.dado ?? (await cacheKanbanEmAndamento);
}

// ---- Relatório de produção (histórico por intervalo de datas) ----
// inicio/fim ("AAAA-MM-DD") vêm prontos do cliente — o cálculo de
// dia/semana/mês, período anterior (tendência) e janela do sparkline é feito
// lá (ver src/utils/producaoCampos.ts), igual ao painel original.

const cacheRelatorioPorChave = new Map<string, { atualizadoEm: number; dado: RelatorioProducao }>();
const cacheRelatorioEmAndamento = new Map<string, Promise<RelatorioProducao>>();

export async function getRelatorioProducao(inicio: string, fim: string): Promise<RelatorioProducao> {
  const chave = `${inicio}_${fim}`;

  const agora = Date.now();
  const cacheado = cacheRelatorioPorChave.get(chave);
  if (cacheado && agora - cacheado.atualizadoEm < CACHE_TTL_RELATORIO_MS) {
    return cacheado.dado;
  }

  let emAndamento = cacheRelatorioEmAndamento.get(chave);
  if (!emAndamento) {
    const url = `${getBaseUrl()}/api/relatorio-producao?inicio=${inicio}&fim=${fim}`;
    emAndamento = fetchJson(url)
      .then((dado) => {
        cacheRelatorioPorChave.set(chave, { atualizadoEm: Date.now(), dado });
        return dado as RelatorioProducao;
      })
      .finally(() => {
        cacheRelatorioEmAndamento.delete(chave);
      });
    cacheRelatorioEmAndamento.set(chave, emAndamento);
  }

  return cacheado?.dado ?? (await emAndamento);
}

// PDF pronto (mesmo gerador do painel original) — repassamos a URL pro
// servidor buscar e devolver os bytes, sem reimplementar o layout do zero.
export function getPdfRelatorioProducaoUrl(inicio: string, fim: string, rotulo: string): string {
  const params = new URLSearchParams({ inicio, fim, rotulo });
  return `${getBaseUrl()}/api/relatorio-producao/pdf?${params.toString()}`;
}
