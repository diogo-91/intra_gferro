import { mkdir, readFile, writeFile } from 'fs/promises';
import { randomBytes, randomUUID, scrypt as scryptCallback, timingSafeEqual } from 'crypto';
import { promisify } from 'util';
import path from 'path';
import { ModuloId, SubmoduloId, moduloValido, submoduloValido } from './src/modulos';

const scrypt = promisify(scryptCallback);
const ARQUIVO = path.join(process.cwd(), 'data', 'usuarios.json');

export interface UsuarioArmazenado {
  id: string;
  nome: string;
  email: string;
  senhaHash: string;
  modulos: ModuloId[];
  submodulos?: SubmoduloId[];
  criadoEm: string;
}

export type UsuarioPublico = Omit<UsuarioArmazenado, 'senhaHash'>;
let cache: UsuarioArmazenado[] | null = null;

async function carregar(): Promise<UsuarioArmazenado[]> {
  if (cache) return cache;
  try {
    const dados = JSON.parse(await readFile(ARQUIVO, 'utf-8'));
    cache = Array.isArray(dados) ? dados : [];
  } catch {
    cache = [];
  }
  return cache!;
}

async function persistir(usuarios: UsuarioArmazenado[]) {
  cache = usuarios;
  await mkdir(path.dirname(ARQUIVO), { recursive: true });
  await writeFile(ARQUIVO, JSON.stringify(usuarios, null, 2), 'utf-8');
}

function publico(usuario: UsuarioArmazenado): UsuarioPublico {
  const { senhaHash: _senhaHash, ...dados } = usuario;
  return { ...dados, submodulos: dados.submodulos ?? [] };
}

async function gerarHash(senha: string): Promise<string> {
  const salt = randomBytes(16).toString('hex');
  const hash = (await scrypt(senha, salt, 64)) as Buffer;
  return `${salt}:${hash.toString('hex')}`;
}

export async function verificarSenha(senha: string, senhaHash: string): Promise<boolean> {
  const [salt, hashHex] = senhaHash.split(':');
  if (!salt || !hashHex) return false;
  const esperado = Buffer.from(hashHex, 'hex');
  const recebido = (await scrypt(senha, salt, esperado.length)) as Buffer;
  return esperado.length === recebido.length && timingSafeEqual(esperado, recebido);
}

export async function buscarUsuarioPorEmail(email: string) {
  return (await carregar()).find((usuario) => usuario.email === email.trim().toLowerCase()) ?? null;
}

export async function listarUsuarios(): Promise<UsuarioPublico[]> {
  return (await carregar()).map(publico).sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
}

function normalizarPermissoes(modulosInformados: unknown[], submodulosInformados: unknown[]) {
  const modulos = [...new Set(modulosInformados.filter(moduloValido))];
  if (modulos.length !== modulosInformados.length) throw Object.assign(new Error('Há um módulo inválido na seleção.'), { status: 400 });
  const submodulos = [...new Set(submodulosInformados.filter(submoduloValido))];
  if (submodulos.length !== submodulosInformados.length) throw Object.assign(new Error('Há um submódulo inválido na seleção.'), { status: 400 });
  if (!modulos.includes('vendas') && submodulos.some((item) => item.startsWith('vendas:'))) {
    throw Object.assign(new Error('Selecione o Dashboard de Vendas para liberar suas lojas.'), { status: 400 });
  }
  if (modulos.includes('vendas') && submodulos.length === 0) {
    throw Object.assign(new Error('Selecione ao menos um submódulo do Dashboard de Vendas.'), { status: 400 });
  }
  return { modulos, submodulos };
}

export async function cadastrarUsuario(dados: { nome: string; email: string; senha: string; modulos: unknown[]; submodulos?: unknown[] }) {
  const nome = dados.nome.trim();
  const email = dados.email.trim().toLowerCase();
  if (nome.length < 2) throw Object.assign(new Error('Informe o nome do usuário.'), { status: 400 });
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw Object.assign(new Error('Informe um e-mail válido.'), { status: 400 });
  if (dados.senha.length < 8) throw Object.assign(new Error('A senha deve ter pelo menos 8 caracteres.'), { status: 400 });
  const { modulos, submodulos } = normalizarPermissoes(dados.modulos, dados.submodulos ?? []);
  const usuarios = await carregar();
  if (usuarios.some((usuario) => usuario.email === email)) throw Object.assign(new Error('Já existe um usuário com este e-mail.'), { status: 409 });
  const novo: UsuarioArmazenado = { id: randomUUID(), nome, email, senhaHash: await gerarHash(dados.senha), modulos, submodulos, criadoEm: new Date().toISOString() };
  await persistir([...usuarios, novo]);
  return publico(novo);
}

export async function atualizarPermissoesUsuario(id: string, dados: { modulos: unknown[]; submodulos: unknown[] }) {
  const { modulos, submodulos } = normalizarPermissoes(dados.modulos, dados.submodulos);
  const usuarios = await carregar();
  const usuario = usuarios.find((item) => item.id === id);
  if (!usuario) throw Object.assign(new Error('Usuário não encontrado.'), { status: 404 });
  const atualizado: UsuarioArmazenado = { ...usuario, modulos, submodulos };
  await persistir(usuarios.map((item) => item.id === id ? atualizado : item));
  return publico(atualizado);
}

export async function removerUsuario(id: string) {
  const usuarios = await carregar();
  if (!usuarios.some((usuario) => usuario.id === id)) throw Object.assign(new Error('Usuário não encontrado.'), { status: 404 });
  await persistir(usuarios.filter((usuario) => usuario.id !== id));
}
