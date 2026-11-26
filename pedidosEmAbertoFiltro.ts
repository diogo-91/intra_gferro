// "Pedidos liberados" mostra os mesmos pedidos de "Pedidos em aberto (PCP)": quem define o que está em aberto é o serviço
// nomus-local (o mesmo da tela embutida). Daqui saem as duas regras dele: o número mínimo de pedido (os anteriores não entram)
// e os pedidos encerrados (entregues ou cancelados, baixados lá). Filtra-se por EXCLUSÃO de propósito: pedido novo, que o
// serviço ainda não sincronizou (ele atualiza de hora em hora), não some desta tela.

export interface FiltroEmAberto {
  pedidoMinimo: number;
  encerrados: Set<number>;
}

const VALIDO_POR_MS = 60_000;
const TEMPO_LIMITE_MS = 5_000;
let guardado: { filtro: FiltroEmAberto; em: number } | null = null;
let consulta: Promise<FiltroEmAberto> | null = null;

async function perguntarAoServico(): Promise<FiltroEmAberto> {
  const base = (process.env.PEDIDOS_PCP_URL || 'http://127.0.0.1:3300').replace(/\/+$/, '');
  const token = (process.env.PEDIDOS_PCP_TOKEN || '').trim();
  const ler = async (caminho: string) => {
    const resposta = await fetch(`${base}${caminho}`, { headers: token ? { 'x-pedidos-token': token } : {}, signal: AbortSignal.timeout(TEMPO_LIMITE_MS) });
    if (!resposta.ok) throw new Error(`o serviço de pedidos em aberto respondeu ${resposta.status}`);
    return resposta.json() as Promise<any>;
  };
  const [sincronizacao, encerrados] = await Promise.all([ler('/api/sync'), ler('/api/pedidos?encerrados=so')]);
  const pedidoMinimo = Number(sincronizacao?.pedidoMinimo);
  if (!Number.isFinite(pedidoMinimo) || !Array.isArray(encerrados?.pedidos)) throw new Error('resposta inesperada do serviço de pedidos em aberto');
  return { pedidoMinimo, encerrados: new Set(encerrados.pedidos.map((p: any) => Number(p.numero))) };
}

/** As regras atuais do "em aberto". Se o serviço não responder, vale a última leitura; sem nenhuma, null (a tela mostra tudo e avisa). */
export async function filtroDosPedidosEmAberto(): Promise<FiltroEmAberto | null> {
  if (guardado && Date.now() - guardado.em < VALIDO_POR_MS) return guardado.filtro;
  consulta ??= perguntarAoServico()
    .then((filtro) => { guardado = { filtro, em: Date.now() }; return filtro; })
    .finally(() => { consulta = null; });
  try {
    return await consulta;
  } catch (erro: any) {
    console.error('[pedidos-liberados] não foi possível consultar os pedidos em aberto (PCP):', erro?.message ?? erro);
    return guardado?.filtro ?? null;
  }
}
