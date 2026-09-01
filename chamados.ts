import path from 'path';
import { mkdir, readFile, rename, writeFile } from 'fs/promises';
import { randomUUID } from 'crypto';

export type ChamadoStatus = 'Aberto' | 'Em atendimento' | 'Aguardando solicitante' | 'Resolvido' | 'Encerrado' | 'Cancelado';
export type ChamadoPrioridade = 'Baixa' | 'Média' | 'Alta' | 'Urgente';

export interface ChamadoInteracao {
  id: string;
  tipo: 'mensagem' | 'nota_interna' | 'evento';
  conteudo: string;
  autorNome: string;
  autorEmail: string;
  criadoEm: string;
}

export interface Chamado {
  id: string;
  protocolo: string;
  departamentoId: string;
  departamentoNome: string;
  categoria: string;
  assunto: string;
  descricao: string;
  prioridade: ChamadoPrioridade;
  status: ChamadoStatus;
  solicitanteNome: string;
  solicitanteEmail: string;
  solicitanteDepartamento: string;
  contato?: string;
  local?: string;
  patrimonio?: string;
  impacto?: string;
  dataDesejada?: string;
  responsavel?: string;
  prazo?: string;
  solucao?: string;
  encerradoEm?: string;
  criadoEm: string;
  atualizadoEm: string;
  interacoes: ChamadoInteracao[];
}

const ARQUIVO = path.join(process.cwd(), 'data', 'chamados.json');
let filaPersistencia = Promise.resolve();

async function carregar(): Promise<Chamado[]> {
  try {
    const dados = JSON.parse(await readFile(ARQUIVO, 'utf-8'));
    return Array.isArray(dados) ? dados : [];
  } catch (error: any) {
    if (error?.code === 'ENOENT') return [];
    throw error;
  }
}

async function persistir(chamados: Chamado[]) {
  filaPersistencia = filaPersistencia.then(async () => {
    await mkdir(path.dirname(ARQUIVO), { recursive: true });
    const temporario = `${ARQUIVO}.${process.pid}.tmp`;
    await writeFile(temporario, JSON.stringify(chamados, null, 2), 'utf-8');
    await rename(temporario, ARQUIVO);
  });
  await filaPersistencia;
}

function protocolo(chamados: Chamado[]) {
  const ano = new Date().getFullYear();
  const prefixo = `GF-${ano}-`;
  const maior = chamados.reduce((max, item) => {
    if (!item.protocolo.startsWith(prefixo)) return max;
    return Math.max(max, Number(item.protocolo.slice(prefixo.length)) || 0);
  }, 0);
  return `${prefixo}${String(maior + 1).padStart(5, '0')}`;
}

function texto(valor: unknown, max = 5000) {
  return typeof valor === 'string' ? valor.trim().slice(0, max) : '';
}

function evento(conteudo: string, autorNome: string, autorEmail: string): ChamadoInteracao {
  return { id: randomUUID(), tipo: 'evento', conteudo, autorNome, autorEmail, criadoEm: new Date().toISOString() };
}

export async function listarChamados() {
  return (await carregar()).sort((a, b) => b.atualizadoEm.localeCompare(a.atualizadoEm));
}

export async function criarChamado(dados: any, autor: { nome: string; email: string }) {
  const obrigatorios = ['departamentoId', 'departamentoNome', 'categoria', 'assunto', 'descricao', 'prioridade'];
  if (obrigatorios.some((campo) => !texto(dados?.[campo]))) {
    throw Object.assign(new Error('Preencha departamento, categoria, assunto, descrição e prioridade.'), { status: 400 });
  }
  if (!['Baixa', 'Média', 'Alta', 'Urgente'].includes(dados.prioridade)) {
    throw Object.assign(new Error('Prioridade inválida.'), { status: 400 });
  }
  const chamados = await carregar();
  const agora = new Date().toISOString();
  const chamado: Chamado = {
    id: randomUUID(), protocolo: protocolo(chamados),
    departamentoId: texto(dados.departamentoId, 80), departamentoNome: texto(dados.departamentoNome, 120),
    categoria: texto(dados.categoria, 120), assunto: texto(dados.assunto, 180), descricao: texto(dados.descricao),
    prioridade: dados.prioridade, status: 'Aberto', solicitanteNome: autor.nome, solicitanteEmail: autor.email,
    solicitanteDepartamento: texto(dados.solicitanteDepartamento, 120), contato: texto(dados.contato, 120) || undefined,
    local: texto(dados.local, 180) || undefined, patrimonio: texto(dados.patrimonio, 120) || undefined,
    impacto: texto(dados.impacto, 1000) || undefined, dataDesejada: texto(dados.dataDesejada, 30) || undefined,
    criadoEm: agora, atualizadoEm: agora,
    interacoes: [evento('Chamado aberto', autor.nome, autor.email)],
  };
  await persistir([...chamados, chamado]);
  return chamado;
}

export async function atualizarChamado(id: string, patch: any, autor: { nome: string; email: string }) {
  const chamados = await carregar();
  const indice = chamados.findIndex((item) => item.id === id);
  if (indice < 0) throw Object.assign(new Error('Chamado não encontrado.'), { status: 404 });
  const atual = chamados[indice];
  const alteracoes: string[] = [];
  const novo = { ...atual };
  if (patch.prioridade && ['Baixa', 'Média', 'Alta', 'Urgente'].includes(patch.prioridade) && patch.prioridade !== atual.prioridade) {
    novo.prioridade = patch.prioridade; alteracoes.push(`Prioridade alterada de ${atual.prioridade} para ${patch.prioridade}`);
  }
  if (patch.status && ['Aberto', 'Em atendimento', 'Aguardando solicitante', 'Resolvido', 'Encerrado', 'Cancelado'].includes(patch.status) && patch.status !== atual.status) {
    novo.status = patch.status; alteracoes.push(`Status alterado de ${atual.status} para ${patch.status}`);
    if (patch.status === 'Em atendimento' && !atual.responsavel && !texto(patch.responsavel, 120)) {
      novo.responsavel = autor.nome;
      alteracoes.push(`Responsável definido como ${autor.nome}`);
    }
  }
  for (const [campo, rotulo, limite] of [
    ['responsavel', 'Responsável', 120], ['prazo', 'Prazo', 40], ['solucao', 'Solução', 5000],
  ] as const) {
    if (patch[campo] !== undefined && texto(patch[campo], limite) !== (atual[campo] || '')) {
      (novo as any)[campo] = texto(patch[campo], limite) || undefined;
      alteracoes.push(`${rotulo} atualizado`);
    }
  }
  const agora = new Date().toISOString();
  if (novo.status === 'Encerrado' && atual.status !== 'Encerrado') novo.encerradoEm = agora;
  if (novo.status !== 'Encerrado') novo.encerradoEm = undefined;
  novo.atualizadoEm = agora;
  novo.interacoes = [...atual.interacoes, ...alteracoes.map((item) => evento(item, autor.nome, autor.email))];
  chamados[indice] = novo;
  await persistir(chamados);
  return novo;
}

export async function adicionarInteracao(id: string, dados: any, autor: { nome: string; email: string }) {
  const chamados = await carregar();
  const indice = chamados.findIndex((item) => item.id === id);
  if (indice < 0) throw Object.assign(new Error('Chamado não encontrado.'), { status: 404 });
  const conteudo = texto(dados?.conteudo, 5000);
  const tipo = dados?.tipo === 'nota_interna' ? 'nota_interna' : 'mensagem';
  if (!conteudo) throw Object.assign(new Error('Digite o conteúdo da interação.'), { status: 400 });
  const agora = new Date().toISOString();
  const interacao: ChamadoInteracao = { id: randomUUID(), tipo, conteudo, autorNome: autor.nome, autorEmail: autor.email, criadoEm: agora };
  chamados[indice] = { ...chamados[indice], atualizadoEm: agora, interacoes: [...chamados[indice].interacoes, interacao] };
  await persistir(chamados);
  return chamados[indice];
}
