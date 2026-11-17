// Dashboard > Financeiro > Placas de EPS (servidor): lê os lançamentos de placas de EPS do Apontamento de Produção
// (APONTAMENTO_BASE_URL, rota /api/eps) para o relatório de custo interno x fornecedor. Cache curto em memória; se o
// Apontamento não responder, vale a última resposta daquele período.

const TTL_MS = 30_000;
const TEMPO_LIMITE_MS = 20_000;

interface Lancamento {
  id: string;
  data: string; // aaaa-mm-dd
  em: string;
  tipo: string; // TRAPEZIO_TR25, TRAPEZIO_TR40, FORRO_TR25, FORRO_TR40
  tipoRotulo: string;
  blocos: number;
  placas: number;
  esperado: number;
  diferenca: number;
  colaborador: { nome: string | null; matricula: string | null };
  observacao: string | null;
}

export interface RespostaEps {
  atualizadoEm: string;
  /** O Apontamento não respondeu agora: estes são os dados da última leitura. */
  desatualizado?: boolean;
  lancamentos: Lancamento[];
}

const cache = new Map<string, { em: number; dado: RespostaEps }>();

export async function buscarEps(inicio: string, fim: string): Promise<RespostaEps> {
  const base = (process.env.APONTAMENTO_BASE_URL || '').replace(/\/+$/, '');
  if (!base) throw new Error('APONTAMENTO_BASE_URL não configurado no .env');
  const chave = `${inicio}|${fim}`;
  const guardado = cache.get(chave);
  if (guardado && Date.now() - guardado.em < TTL_MS) return guardado.dado;

  try {
    const resposta = await fetch(`${base}/api/eps?inicio=${encodeURIComponent(inicio)}&fim=${encodeURIComponent(fim)}`, { signal: AbortSignal.timeout(TEMPO_LIMITE_MS) });
    if (!resposta.ok) throw new Error(`Apontamento de Produção respondeu ${resposta.status}`);
    const corpo: any = await resposta.json();
    if (!Array.isArray(corpo?.lancamentos)) throw new Error('Resposta inesperada do Apontamento de Produção.');
    const dado: RespostaEps = { atualizadoEm: new Date().toISOString(), lancamentos: corpo.lancamentos };
    cache.set(chave, { em: Date.now(), dado });
    return dado;
  } catch (erro) {
    if (guardado) return { ...guardado.dado, desatualizado: true };
    throw erro;
  }
}
