// Autenticação simples, sem banco de dados. As credenciais vêm do ambiente:
// AUTH_EMAIL/AUTH_PASSWORD, pares numerados AUTH_EMAIL_2/AUTH_PASSWORD_2 etc.
// ou AUTH_USERS em JSON. O token é um cookie httpOnly assinado com HMAC-SHA256.

import { Request, Response, NextFunction } from 'express';
import { createHmac, timingSafeEqual } from 'crypto';

const COOKIE_NAME = 'intranet_auth';
const TOKEN_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 dias

function getSecret(): string {
  const secret = process.env.SESSION_SECRET;
  if (!secret) throw new Error('SESSION_SECRET não configurado no .env');
  return secret;
}

function assinar(payload: string): string {
  return createHmac('sha256', getSecret()).update(payload).digest('hex');
}

function criarToken(email: string): string {
  const payload = JSON.stringify({ email, exp: Date.now() + TOKEN_TTL_MS });
  const payloadB64 = Buffer.from(payload, 'utf-8').toString('base64url');
  return `${payloadB64}.${assinar(payloadB64)}`;
}

function verificarToken(token: unknown): string | null {
  if (typeof token !== 'string') return null;
  const [payloadB64, assinatura] = token.split('.');
  if (!payloadB64 || !assinatura) return null;

  const esperada = Buffer.from(assinar(payloadB64));
  const recebida = Buffer.from(assinatura);
  if (esperada.length !== recebida.length || !timingSafeEqual(esperada, recebida)) return null;

  try {
    const payload = JSON.parse(Buffer.from(payloadB64, 'base64url').toString('utf-8'));
    if (typeof payload.exp !== 'number' || payload.exp < Date.now() || typeof payload.email !== 'string') return null;
    return payload.email;
  } catch {
    return null;
  }
}

// Comparação em tempo constante — evita que a duração da comparação vaze
// quantos caracteres da senha estão certos.
function compararConstante(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  return timingSafeEqual(bufA, bufB);
}

interface Credencial {
  email: string;
  password: string;
}

function carregarCredenciais(): Credencial[] {
  const credenciais: Credencial[] = [];

  const adicionar = (email: unknown, password: unknown) => {
    if (typeof email !== 'string' || typeof password !== 'string') return;
    const emailLimpo = email.trim().toLowerCase();
    if (!emailLimpo || !password) return;
    if (!credenciais.some((item) => item.email === emailLimpo)) {
      credenciais.push({ email: emailLimpo, password });
    }
  };

  adicionar(process.env.AUTH_EMAIL, process.env.AUTH_PASSWORD);

  // Permite AUTH_EMAIL_2/AUTH_PASSWORD_2, AUTH_EMAIL_3/AUTH_PASSWORD_3 etc.
  const sufixos = Object.keys(process.env)
    .map((nome) => nome.match(/^AUTH_EMAIL_(\d+)$/)?.[1])
    .filter((sufixo): sufixo is string => !!sufixo)
    .sort((a, b) => Number(a) - Number(b));

  for (const sufixo of sufixos) {
    adicionar(process.env[`AUTH_EMAIL_${sufixo}`], process.env[`AUTH_PASSWORD_${sufixo}`]);
  }

  // Alternativa compacta para o EasyPanel:
  // AUTH_USERS='[{"email":"usuario@empresa.com","password":"senha"}]'
  if (process.env.AUTH_USERS?.trim()) {
    let usuarios: unknown;
    try {
      usuarios = JSON.parse(process.env.AUTH_USERS);
    } catch {
      throw new Error('AUTH_USERS inválido: use um array JSON com email e password.');
    }
    if (!Array.isArray(usuarios)) {
      throw new Error('AUTH_USERS inválido: o valor precisa ser um array JSON.');
    }
    for (const usuario of usuarios) {
      if (usuario && typeof usuario === 'object') {
        const item = usuario as { email?: unknown; password?: unknown };
        adicionar(item.email, item.password);
      }
    }
  }

  return credenciais;
}

function cookieOptions() {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax' as const,
    maxAge: TOKEN_TTL_MS,
  };
}

export function loginHandler(req: Request, res: Response) {
  const { email, password } = req.body || {};
  let credenciais: Credencial[];
  try {
    credenciais = carregarCredenciais();
  } catch (error: any) {
    console.error('[auth] configuração de usuários inválida:', error.message);
    return res.status(500).json({ error: 'Configuração de usuários inválida no servidor.' });
  }

  if (credenciais.length === 0) {
    return res.status(500).json({ error: 'Login não configurado no servidor (nenhum usuário válido encontrado).' });
  }

  const emailInformado = typeof email === 'string' ? email.trim().toLowerCase() : '';
  const credencial = credenciais.find((item) => item.email === emailInformado);
  const senhaOk = !!credencial && typeof password === 'string' && compararConstante(password, credencial.password);

  if (!credencial || !senhaOk) {
    return res.status(401).json({ error: 'E-mail ou senha inválidos.' });
  }

  res.cookie(COOKIE_NAME, criarToken(credencial.email), cookieOptions());
  res.json({ ok: true, email: credencial.email });
}

export function logoutHandler(_req: Request, res: Response) {
  res.clearCookie(COOKIE_NAME);
  res.json({ ok: true });
}

export function meHandler(req: Request, res: Response) {
  const email = verificarToken(req.cookies?.[COOKIE_NAME]);
  if (!email) return res.status(401).json({ authenticated: false });
  res.json({ authenticated: true, email });
}

export function exigirAutenticacao(req: Request, res: Response, next: NextFunction) {
  const email = verificarToken(req.cookies?.[COOKIE_NAME]);
  if (!email) {
    return res.status(401).json({ error: 'Não autenticado.' });
  }
  next();
}
