// Pedidos problemáticos (urgentes, devoluções e clientes/defeitos): os registros moram no PCP (banco do Gferro-PCP). A
// intranet só repassa as consultas e as gravações para a API do PCP, para os dois sistemas mostrarem a mesma lista.

const PCP_URL = (process.env.PCP_URL || 'https://pcp-pcp.matojc.easypanel.host').replace(/\/+$/, '');
const PCP_TOKEN = (process.env.PCP_TOKEN || '').trim();
// O PCP espera até 25 s pela Nomus ao preencher os dados de um pedido; damos uma folga a mais.
const TEMPO_LIMITE_MS = 40_000;

export const TIPOS_PROBLEMATICOS = ['urgentes', 'devolucoes', 'defeitos'] as const;
export type TipoProblematico = (typeof TIPOS_PROBLEMATICOS)[number];

export class ErroProblematicos extends Error {
  constructor(mensagem: string, public readonly status = 400) {
    super(mensagem);
  }
}

export function tipoProblematico(valor: unknown): TipoProblematico {
  if (!(TIPOS_PROBLEMATICOS as readonly string[]).includes(String(valor))) throw new ErroProblematicos('Tabela desconhecida.', 404);
  return valor as TipoProblematico;
}

export function idPositivo(valor: unknown): number {
  const numero = Number(valor);
  if (!Number.isInteger(numero) || numero <= 0) throw new ErroProblematicos('Número inválido.');
  return numero;
}

/** Chama a API do PCP em nome de `usuario` (aparece como "atualizado por" no PCP) e devolve o JSON dela. */
export async function chamarPcp(metodo: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE', caminho: string, usuario: string, corpo?: unknown): Promise<any> {
  const cabecalhos: Record<string, string> = { Accept: 'application/json', 'x-pcp-usuario': encodeURIComponent(usuario.slice(0, 60)) };
  if (PCP_TOKEN) cabecalhos['x-pcp-token'] = PCP_TOKEN;
  if (corpo !== undefined) cabecalhos['Content-Type'] = 'application/json';

  let resposta: Response;
  try {
    resposta = await fetch(`${PCP_URL}${caminho}`, { method: metodo, headers: cabecalhos, body: corpo === undefined ? undefined : JSON.stringify(corpo), signal: AbortSignal.timeout(TEMPO_LIMITE_MS) });
  } catch (erro: any) {
    throw new ErroProblematicos(`Não foi possível falar com o PCP agora (${erro?.name === 'TimeoutError' ? 'demorou demais' : erro?.message ?? 'sem resposta'}). Tente de novo em instantes.`, 502);
  }
  const dados: any = await resposta.json().catch(() => null);
  if (!resposta.ok) throw new ErroProblematicos(String(dados?.erro ?? dados?.error ?? `O PCP respondeu com erro ${resposta.status}.`), resposta.status === 401 || resposta.status === 403 ? 502 : resposta.status);
  return dados;
}

/** Busca uma imagem anexada (print de uma devolução) no PCP. Só repassa imagens comuns, nunca outro tipo de arquivo. */
export async function buscarPrintNoPcp(id: number, usuario: string): Promise<{ tipo: string; dados: Buffer }> {
  const cabecalhos: Record<string, string> = { 'x-pcp-usuario': encodeURIComponent(usuario.slice(0, 60)) };
  if (PCP_TOKEN) cabecalhos['x-pcp-token'] = PCP_TOKEN;
  let resposta: Response;
  try {
    resposta = await fetch(`${PCP_URL}/api/problematicos/prints/${id}`, { headers: cabecalhos, signal: AbortSignal.timeout(TEMPO_LIMITE_MS) });
  } catch {
    throw new ErroProblematicos('Não foi possível falar com o PCP agora. Tente de novo em instantes.', 502);
  }
  if (!resposta.ok) throw new ErroProblematicos('Print não encontrado.', resposta.status === 404 ? 404 : 502);
  const tipo = (resposta.headers.get('content-type') || '').split(';')[0].trim().toLowerCase();
  if (!['image/png', 'image/jpeg', 'image/webp', 'image/gif'].includes(tipo)) throw new ErroProblematicos('O arquivo não é uma imagem válida.', 502);
  return { tipo, dados: Buffer.from(await resposta.arrayBuffer()) };
}
