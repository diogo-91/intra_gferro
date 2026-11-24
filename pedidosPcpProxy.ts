// Dashboard > Pedidos > "Pedidos em aberto (PCP)": tela do projeto irmão "nomus-local" (carteira de pedidos liberados no Nomus, financeiro, material,
// rota e assistente de IA), embutida na intranet. O navegador só fala com a intranet; este repasse (proxy) leva a chamada ao servidor do nomus-local.
//
// - Passa pelos mesmos middlewares de /api: exigirAutenticacao (cookie de sessão) e exigirPermissaoDeModulo ('dashboard-pedidos', ver auth.ts).
// - NÃO repassa cookies nem Authorization (a sessão da intranet não vaza para o outro serviço); só um conjunto fixo de cabeçalhos.
// - Endereço do serviço: PEDIDOS_PCP_URL (padrão http://127.0.0.1:3300). Se o serviço estiver fora do ar, o usuário vê uma explicação em vez de um erro seco.
import http from 'node:http';
import https from 'node:https';
import type { NextFunction, Request, Response } from 'express';

export const PREFIXO_PEDIDOS_PCP = '/api/pcp-pedidos';
const TEMPO_LIMITE_MS = 180_000; // o assistente de IA pode levar dezenas de segundos

const alvo = () => new URL((process.env.PEDIDOS_PCP_URL || 'http://127.0.0.1:3300').replace(/\/+$/, ''));

// Cabeçalhos da resposta que não devem ser copiados (controle de conexão do salto anterior).
const CABECALHOS_DE_SALTO = new Set(['connection', 'keep-alive', 'proxy-authenticate', 'proxy-authorization', 'te', 'trailer', 'transfer-encoding', 'upgrade']);

const paginaIndisponivel = () => `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Pedidos em aberto indisponível</title></head>
<body style="margin:0;font:14px/1.5 ui-sans-serif,system-ui,sans-serif;background:#fff;color:#171717;display:flex;align-items:center;justify-content:center;min-height:100vh">
<div style="max-width:440px;margin:16px;padding:24px;border:1px solid #e5e5e5;border-radius:16px;background:#fafafa;text-align:center">
<h1 style="margin:0 0 8px;font-size:18px;font-weight:900">Pedidos em aberto indisponível</h1>
<p style="margin:0;color:#737373;font-size:13px">O serviço que alimenta esta tela não respondeu. Se ele roda neste computador, abra o <b>iniciar-tela.cmd</b> da pasta <b>nomus-local</b> e recarregue.</p>
</div></body></html>`;

export function proxyPedidosPcp(req: Request, res: Response, _next: NextFunction) {
  if (req.method !== 'GET' && req.method !== 'POST') return res.status(405).json({ error: 'Método não permitido.' });

  const url = new URL(req.originalUrl, 'http://intranet.local');
  // Sem a barra final os caminhos relativos da página quebrariam (/api/pcp-pedidos + api/pedidos).
  if (url.pathname === PREFIXO_PEDIDOS_PCP) return res.redirect(302, `${PREFIXO_PEDIDOS_PCP}/${url.search}`);
  const caminho = url.pathname.slice(PREFIXO_PEDIDOS_PCP.length) || '/';

  const destino = alvo();
  const cliente = destino.protocol === 'https:' ? https : http;

  // express.json() já leu o corpo dos POSTs: reenvia o objeto já interpretado.
  const corpo = req.method === 'POST' ? Buffer.from(JSON.stringify(req.body ?? {})) : null;
  const cabecalhos: http.OutgoingHttpHeaders = { host: destino.host, accept: String(req.headers.accept || '*/*') };
  if (corpo) {
    cabecalhos['content-type'] = 'application/json';
    cabecalhos['content-length'] = corpo.length;
  }
  // Senha entre a intranet e o serviço (PEDIDOS_TOKEN do serviço = PEDIDOS_PCP_TOKEN daqui). Só o servidor conhece; o navegador nunca a vê.
  const token = (process.env.PEDIDOS_PCP_TOKEN || '').trim();
  if (token) cabecalhos['x-pedidos-token'] = token;
  if (req.headers['x-pedidos']) cabecalhos['x-pedidos'] = String(req.headers['x-pedidos']); // marca exigida pelo serviço nas rotas de escrita

  let respondido = false;
  const falhar = () => {
    if (respondido) return;
    respondido = true;
    if (res.headersSent) return void res.end();
    const querJson = caminho.startsWith('/api/');
    res.status(502);
    if (querJson) res.json({ error: 'O serviço de pedidos em aberto (PCP) está indisponível no momento.' });
    else res.type('html').send(paginaIndisponivel());
  };

  const saida = cliente.request(
    { protocol: destino.protocol, hostname: destino.hostname, port: destino.port || undefined, method: req.method, path: caminho + url.search, headers: cabecalhos },
    (resposta) => {
      respondido = true;
      res.status(resposta.statusCode ?? 502);
      for (const [nome, valor] of Object.entries(resposta.headers)) {
        if (valor === undefined || CABECALHOS_DE_SALTO.has(nome.toLowerCase())) continue;
        res.setHeader(nome, valor);
      }
      resposta.pipe(res);
    }
  );
  saida.setTimeout(TEMPO_LIMITE_MS, () => saida.destroy(new Error('tempo esgotado')));
  saida.on('error', falhar);
  res.on('close', () => { if (!res.writableEnded) saida.destroy(); });
  saida.end(corpo ?? undefined);
}
