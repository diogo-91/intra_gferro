// Autenticação simples de um usuário administrativo — sem banco de dados,
// credenciais vêm do .env (AUTH_EMAIL/AUTH_PASSWORD/SESSION_SECRET). O token
// é um cookie httpOnly assinado com HMAC-SHA256, sem lib de sessão.

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
  const emailEsperado = process.env.AUTH_EMAIL || '';
  const senhaEsperada = process.env.AUTH_PASSWORD || '';

  if (!emailEsperado || !senhaEsperada) {
    return res.status(500).json({ error: 'Login não configurado no servidor (AUTH_EMAIL/AUTH_PASSWORD ausentes).' });
  }

  const emailOk = typeof email === 'string' && email.trim().toLowerCase() === emailEsperado.toLowerCase();
  const senhaOk = typeof password === 'string' && compararConstante(password, senhaEsperada);

  if (!emailOk || !senhaOk) {
    return res.status(401).json({ error: 'E-mail ou senha inválidos.' });
  }

  res.cookie(COOKIE_NAME, criarToken(emailEsperado), cookieOptions());
  res.json({ ok: true, email: emailEsperado });
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
