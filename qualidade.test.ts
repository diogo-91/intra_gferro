import assert from 'node:assert/strict';
import { test } from 'node:test';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { once } from 'node:events';
import { randomUUID } from 'node:crypto';
import express from 'express';
import cookieParser from 'cookie-parser';
import { criarRepositorioQualidade } from './qualidade';
import { criarRotasQualidade } from './qualidadeRotas';
import { loginHandler } from './auth';
import { ncAtrasada } from './src/data/qualidade';

const autor = { nome: 'Pessoa de teste', email: 'qualidade@example.test' };
const abertura = { titulo: 'Material divergente', departamentoOrigemId: 'dep-com', departamentoResponsavelId: 'dep-producao', descricao: 'O material produzido diverge da especificação no pedido.', prioridade: 'Alta', prazo: '2026-10-01' };

async function ambiente(t: any) {
  const prefixo = path.join(tmpdir(), 'gferro-qualidade-teste-');
  const pasta = await mkdtemp(prefixo);
  t.after(async () => {
    assert.ok(path.resolve(pasta).startsWith(path.resolve(prefixo)));
    await rm(pasta, { recursive: true, force: true });
  });
  const arquivo = path.join(pasta, 'registros.json');
  return { repositorio: criarRepositorioQualidade(arquivo), arquivo };
}

test('abertura persiste o protocolo, autor da sessão e departamento de destino', async (t) => {
  const { repositorio, arquivo } = await ambiente(t);
  const nc = await repositorio.criar({ ...abertura, criadoPor: 'Autor forjado', status: 'Concluída' }, autor);
  assert.match(nc.protocolo, /^NC-\d{4}-00001$/);
  assert.equal(nc.status, 'Aberta');
  assert.equal(nc.criadoPorEmail, autor.email);
  assert.equal(nc.departamentoResponsavelId, 'dep-producao');
  assert.equal(nc.historico.length, 1);
  assert.deepEqual(await criarRepositorioQualidade(arquivo).listar(), [nc]);
});

test('aberturas simultâneas preservam todos os registros e geram protocolos únicos', async (t) => {
  const { repositorio } = await ambiente(t);
  const registros = await Promise.all(Array.from({ length: 15 }, () => repositorio.criar(abertura, autor)));
  assert.equal(new Set(registros.map((nc) => nc.protocolo)).size, 15);
  assert.equal((await repositorio.listar()).length, 15);
});

test('valida campos obrigatórios, departamentos, datas e prioridade sem interromper a fila', async (t) => {
  const { repositorio } = await ambiente(t);
  for (const patch of [{ titulo: ' ' }, { descricao: '' }, { departamentoOrigemId: 'inexistente' }, { departamentoResponsavelId: '' }, { prioridade: 'Inválida' }, { prazo: '2026-02-30' }, { prazo: 'amanhã' }]) {
    await assert.rejects(repositorio.criar({ ...abertura, ...patch }, autor), { status: 400 });
  }
  assert.equal((await repositorio.criar(abertura, autor)).versao, 1);
  assert.equal((await repositorio.listar()).length, 1);
});

test('tratamento permite encaminhar entre áreas e registra autor e alterações', async (t) => {
  const { repositorio } = await ambiente(t);
  const nc = await repositorio.criar(abertura, autor);
  const atualizada = await repositorio.atualizar(nc.id, { versao: nc.versao, status: 'Em tratamento', responsavel: 'Maria', departamentoResponsavelId: 'dep-pcp', comentario: 'Conferência iniciada.' }, { nome: 'Maria', email: 'maria@example.test' });
  assert.equal(atualizada.departamentoOrigemId, 'dep-com');
  assert.equal(atualizada.departamentoResponsavelId, 'dep-pcp');
  assert.equal(atualizada.versao, 2);
  assert.ok(atualizada.historico.some((e) => e.descricao.includes('Produção → PCP')));
  assert.equal(atualizada.historico.at(-1)?.autorEmail, 'maria@example.test');
});

test('conclusão exige tratamento e verificação; reabertura limpa data de conclusão', async (t) => {
  const { repositorio } = await ambiente(t);
  const nc = await repositorio.criar(abertura, autor);
  await assert.rejects(repositorio.atualizar(nc.id, { versao: 1, status: 'Concluída' }, autor), { status: 400 });
  const concluida = await repositorio.atualizar(nc.id, { versao: 1, status: 'Concluída', responsavel: 'Maria', causa: 'Falha na conferência', acaoCorretiva: 'Revisão do material', verificacao: 'Conferência aprovada' }, autor);
  assert.ok(concluida.concluidoEm);
  await assert.rejects(repositorio.atualizar(nc.id, { versao: 2, causa: '' }, autor), { status: 400 });
  const reaberta = await repositorio.atualizar(nc.id, { versao: 2, status: 'Em análise' }, autor);
  assert.equal(reaberta.concluidoEm, undefined);
});

test('cancelamento exige justificativa e edição concorrente retorna conflito', async (t) => {
  const { repositorio } = await ambiente(t);
  const nc = await repositorio.criar(abertura, autor);
  await assert.rejects(repositorio.atualizar(nc.id, { versao: 1, status: 'Cancelada' }, autor), { status: 400 });
  const cancelada = await repositorio.atualizar(nc.id, { versao: 1, status: 'Cancelada', comentario: 'Registro duplicado.' }, autor);
  await assert.rejects(repositorio.atualizar(nc.id, { versao: 1, status: 'Em análise' }, autor), { status: 409 });
  await assert.rejects(repositorio.atualizar('inexistente', { versao: 1 }, autor), { status: 404 });
  assert.equal((await repositorio.listar())[0].status, cancelada.status);
});

test('prazo vence no dia seguinte e registros finalizados não ficam atrasados', () => {
  const hoje = new Date(2026, 8, 14);
  assert.equal(ncAtrasada({ status: 'Aberta', prazo: '2026-09-14' }, hoje), false);
  assert.equal(ncAtrasada({ status: 'Em tratamento', prazo: '2026-09-13' }, hoje), true);
  assert.equal(ncAtrasada({ status: 'Concluída', prazo: '2026-09-13' }, hoje), false);
  assert.equal(ncAtrasada({ status: 'Cancelada', prazo: '2026-09-13' }, hoje), false);
});

test('API exige sessão e executa abertura, consulta, tratamento e validação', async (t) => {
  const { repositorio } = await ambiente(t);
  const anteriores = { AUTH_EMAIL: process.env.AUTH_EMAIL, AUTH_PASSWORD: process.env.AUTH_PASSWORD, SESSION_SECRET: process.env.SESSION_SECRET };
  const senha = randomUUID();
  process.env.AUTH_EMAIL = autor.email;
  process.env.AUTH_PASSWORD = senha;
  process.env.SESSION_SECRET = randomUUID();
  t.after(() => { for (const [chave, valor] of Object.entries(anteriores)) { if (valor === undefined) delete process.env[chave]; else process.env[chave] = valor; } });
  const app = express();
  app.use(express.json(), cookieParser());
  app.post('/login', loginHandler);
  app.use('/api/qualidade', criarRotasQualidade(repositorio));
  const server = app.listen(0, '127.0.0.1');
  await once(server, 'listening');
  t.after(() => new Promise<void>((resolve, reject) => { server.close((error) => error ? reject(error) : resolve()); server.closeAllConnections(); }));
  const endereco = server.address() as { port: number };
  const base = `http://127.0.0.1:${endereco.port}`;
  const api = `${base}/api/qualidade/nao-conformidades`;
  for (const method of ['GET', 'POST', 'PATCH']) {
    assert.equal((await fetch(method === 'PATCH' ? `${api}/inexistente` : api, { method })).status, 401);
  }
  const login = await fetch(`${base}/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: autor.email, password: senha }) });
  assert.equal(login.status, 200);
  const headers = { Cookie: login.headers.get('set-cookie')!.split(';')[0], 'Content-Type': 'application/json' };
  const criada = await fetch(api, { method: 'POST', headers, body: JSON.stringify(abertura) });
  assert.equal(criada.status, 201);
  const nc = await criada.json() as { id: string };
  assert.equal((await (await fetch(api, { headers })).json() as any[]).length, 1);
  const tratamento = await fetch(`${api}/${nc.id}`, { method: 'PATCH', headers, body: JSON.stringify({ versao: 1, status: 'Em análise' }) });
  assert.equal(tratamento.status, 200);
  const invalida = await fetch(`${api}/${nc.id}`, { method: 'PATCH', headers, body: JSON.stringify({ versao: 2, status: 'Concluída' }) });
  assert.equal(invalida.status, 400);
  assert.match((await invalida.json() as { error: string }).error, /Para concluir/);
  // A mesma sessão deixa de ter acesso quando o usuário perde sua autorização.
  process.env.AUTH_EMAIL = 'outra-pessoa@example.test';
  assert.equal((await fetch(api, { headers })).status, 401);
});
