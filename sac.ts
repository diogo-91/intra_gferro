// SAC / Pós-Vendas — atendimento externo ao cliente (reclamação, dúvida,
// troca, devolução, etc.), separado dos chamados internos (RH/TI/EPI, ver
// ServicosRH.tsx). O SAC é sempre o responsável pelo atendimento do cliente;
// "solicitar análise interna" pede parecer de outro setor SEM transferir
// essa responsabilidade — ver types.ts (SacAtendimento) pro modelo completo.
//
// Sem conta por pessoa nesta intranet (login único compartilhado) — por
// isso toda ação recebe o nome de quem fez como texto livre, informado pelo
// próprio formulário, em vez de vir de uma sessão autenticada por usuário.
//
// Persistência simples em arquivo JSON — este app não tem banco de dados.

import { readFile, writeFile, mkdir } from 'fs/promises';
import { randomUUID } from 'crypto';
import path from 'path';
import type {
  SacAtendimento,
  SacInteracao,
  SacSolicitacaoInterna,
  SacRespostaSolicitacao,
  SacSolucao,
  SacAnexo,
  SacHistoricoEvento,
  SacNaoConformidade,
  SacStatus,
  SacPrioridade,
  SacProcedencia,
} from './src/types';

const ARQUIVO = path.join(process.cwd(), 'data', 'sac-atendimentos.json');
export const PASTA_UPLOADS_SAC = path.join(process.cwd(), 'data', 'uploads', 'sac');

let cache: SacAtendimento[] | null = null;

async function carregar(): Promise<SacAtendimento[]> {
  if (cache) return cache;
  try {
    const conteudo = await readFile(ARQUIVO, 'utf-8');
    cache = JSON.parse(conteudo);
  } catch {
    cache = [];
  }
  return cache!;
}

async function persistir(lista: SacAtendimento[]): Promise<void> {
  cache = lista;
  await mkdir(path.dirname(ARQUIVO), { recursive: true });
  await writeFile(ARQUIVO, JSON.stringify(lista, null, 2), 'utf-8');
}

function erro(mensagem: string, status = 400): never {
  throw Object.assign(new Error(mensagem), { status });
}

function novoEventoHistorico(usuario: string, acao: string, valorAnterior?: string, valorNovo?: string): SacHistoricoEvento {
  return { id: randomUUID(), usuario, acao, valorAnterior, valorNovo, data: new Date().toISOString() };
}

async function proximoProtocolo(): Promise<string> {
  const lista = await carregar();
  const maiorNumero = lista.reduce((max, a) => {
    const numero = Number(a.protocolo.replace('SAC-', ''));
    return Number.isFinite(numero) && numero > max ? numero : max;
  }, 0);
  return `SAC-${String(maiorNumero + 1).padStart(6, '0')}`;
}

async function localizar(id: string): Promise<{ lista: SacAtendimento[]; indice: number; atendimento: SacAtendimento }> {
  const lista = await carregar();
  const indice = lista.findIndex((a) => a.id === id);
  if (indice === -1) erro('Atendimento não encontrado.', 404);
  return { lista, indice, atendimento: lista[indice] };
}

async function salvarAlteracao(lista: SacAtendimento[], indice: number, atendimento: SacAtendimento): Promise<SacAtendimento> {
  atendimento.atualizadoEm = new Date().toISOString();
  lista[indice] = atendimento;
  await persistir(lista);
  return atendimento;
}

export async function listarAtendimentos(): Promise<SacAtendimento[]> {
  const lista = await carregar();
  return [...lista].sort((a, b) => b.criadoEm.localeCompare(a.criadoEm));
}

export async function obterAtendimento(id: string): Promise<SacAtendimento> {
  const { atendimento } = await localizar(id);
  return atendimento;
}

export type NovoAtendimentoDados = Omit<
  SacAtendimento,
  | 'id'
  | 'protocolo'
  | 'status'
  | 'procedencia'
  | 'interacoes'
  | 'solicitacoesInternas'
  | 'anexos'
  | 'historico'
  | 'criadoEm'
  | 'atualizadoEm'
> & { produtos: SacAtendimento['produtos'] };

export async function criarAtendimento(dados: NovoAtendimentoDados, usuario: string): Promise<SacAtendimento> {
  if (!dados.cliente?.trim()) erro('Informe o cliente.');
  if (!dados.assunto?.trim()) erro('Informe o assunto do atendimento.');
  if (!dados.tipo) erro('Informe o tipo de atendimento.');

  const lista = await carregar();
  const protocolo = await proximoProtocolo();
  const agora = new Date().toISOString();

  const atendimento: SacAtendimento = {
    ...dados,
    id: randomUUID(),
    protocolo,
    status: 'Novo',
    procedencia: 'Não analisado',
    produtos: dados.produtos || [],
    interacoes: [],
    solicitacoesInternas: [],
    anexos: [],
    historico: [novoEventoHistorico(usuario, `${usuario} criou o atendimento ${protocolo}.`)],
    criadoPor: usuario,
    criadoEm: agora,
    atualizadoEm: agora,
  };

  await persistir([...lista, atendimento]);
  return atendimento;
}

export async function editarDadosGerais(
  id: string,
  patch: Partial<
    Pick<
      SacAtendimento,
      | 'cliente' | 'nomeFantasia' | 'cnpjCpf' | 'contato' | 'telefone' | 'whatsapp' | 'email' | 'cidade' | 'estado'
      | 'vendedor' | 'numeroPedido' | 'numeroNF' | 'dataVenda' | 'dataEmissaoNF' | 'dataEntrega' | 'transportadora' | 'numeroOC'
      | 'produtos' | 'assunto' | 'descricao' | 'canal' | 'prazo'
    >
  >,
  usuario: string
): Promise<SacAtendimento> {
  const { lista, indice, atendimento } = await localizar(id);
  Object.assign(atendimento, patch);
  atendimento.historico.push(novoEventoHistorico(usuario, `${usuario} editou os dados do atendimento.`));
  return salvarAlteracao(lista, indice, atendimento);
}

export async function alterarStatus(id: string, novoStatus: SacStatus, usuario: string): Promise<SacAtendimento> {
  const { lista, indice, atendimento } = await localizar(id);
  const anterior = atendimento.status;
  if (anterior === novoStatus) return atendimento;
  atendimento.status = novoStatus;
  atendimento.historico.push(novoEventoHistorico(usuario, `${usuario} alterou status de "${anterior}" para "${novoStatus}".`, anterior, novoStatus));
  return salvarAlteracao(lista, indice, atendimento);
}

export async function alterarPrioridade(id: string, novaPrioridade: SacPrioridade, usuario: string): Promise<SacAtendimento> {
  const { lista, indice, atendimento } = await localizar(id);
  const anterior = atendimento.prioridade;
  if (anterior === novaPrioridade) return atendimento;
  atendimento.prioridade = novaPrioridade;
  atendimento.historico.push(
    novoEventoHistorico(usuario, `${usuario} alterou prioridade de "${anterior}" para "${novaPrioridade}".`, anterior, novaPrioridade)
  );
  return salvarAlteracao(lista, indice, atendimento);
}

export async function alterarResponsavel(id: string, novoResponsavel: string, usuario: string): Promise<SacAtendimento> {
  const { lista, indice, atendimento } = await localizar(id);
  const anterior = atendimento.responsavelSac || '(sem responsável)';
  atendimento.responsavelSac = novoResponsavel;
  atendimento.historico.push(
    novoEventoHistorico(usuario, `${usuario} alterou o responsável de "${anterior}" para "${novoResponsavel}".`, anterior, novoResponsavel)
  );
  return salvarAlteracao(lista, indice, atendimento);
}

export async function adicionarInteracao(
  id: string,
  dados: Omit<SacInteracao, 'id' | 'data' | 'anexos'> & { anexos?: SacAnexo[] },
  usuario: string
): Promise<SacAtendimento> {
  const { lista, indice, atendimento } = await localizar(id);
  const interacao: SacInteracao = { ...dados, id: randomUUID(), data: new Date().toISOString(), anexos: dados.anexos || [] };
  atendimento.interacoes.push(interacao);
  if (atendimento.status === 'Novo') atendimento.status = 'Em atendimento';
  atendimento.historico.push(novoEventoHistorico(usuario, `${usuario} registrou uma interação (${dados.canal}).`));
  return salvarAlteracao(lista, indice, atendimento);
}

// Solicitar análise interna NÃO transfere o atendimento — o SAC continua
// responsável. Só encaminha um pedido de parecer pro setor indicado.
export async function solicitarAnaliseInterna(
  id: string,
  dados: Omit<SacSolicitacaoInterna, 'id' | 'status' | 'anexos' | 'resposta' | 'criadoPor' | 'criadoEm'> & { anexos?: SacAnexo[] },
  usuario: string
): Promise<SacAtendimento> {
  const { lista, indice, atendimento } = await localizar(id);
  const solicitacao: SacSolicitacaoInterna = {
    ...dados,
    id: randomUUID(),
    status: 'Pendente',
    anexos: dados.anexos || [],
    criadoPor: usuario,
    criadoEm: new Date().toISOString(),
  };
  atendimento.solicitacoesInternas.push(solicitacao);
  const statusPorDepartamento: Partial<Record<SacSolicitacaoInterna['departamento'], SacStatus>> = {
    Qualidade: 'Aguardando Qualidade',
    Produção: 'Aguardando Produção',
    Logística: 'Aguardando Logística',
    Comercial: 'Aguardando Comercial',
    Financeiro: 'Aguardando Financeiro',
  };
  atendimento.status = statusPorDepartamento[dados.departamento] || 'Em análise interna';
  atendimento.historico.push(novoEventoHistorico(usuario, `${usuario} solicitou análise do setor ${dados.departamento}.`));
  return salvarAlteracao(lista, indice, atendimento);
}

export async function responderSolicitacao(
  id: string,
  solicitacaoId: string,
  resposta: Omit<SacRespostaSolicitacao, 'data' | 'anexos'> & { anexos?: SacAnexo[] },
  usuario: string
): Promise<SacAtendimento> {
  const { lista, indice, atendimento } = await localizar(id);
  const solicitacao = atendimento.solicitacoesInternas.find((s) => s.id === solicitacaoId);
  if (!solicitacao) erro('Solicitação interna não encontrada.', 404);
  solicitacao.resposta = { ...resposta, anexos: resposta.anexos || [], data: new Date().toISOString() };
  solicitacao.status = 'Respondido';
  atendimento.historico.push(novoEventoHistorico(usuario, `${usuario} (${solicitacao.departamento}) respondeu a solicitação interna.`));
  return salvarAlteracao(lista, indice, atendimento);
}

export async function definirProcedencia(
  id: string,
  dados: { procedencia: SacProcedencia; motivo?: string; responsavel: string },
  usuario: string
): Promise<SacAtendimento> {
  const { lista, indice, atendimento } = await localizar(id);
  atendimento.procedencia = dados.procedencia;
  atendimento.procedenciaMotivo = dados.motivo;
  atendimento.procedenciaResponsavel = dados.responsavel;
  atendimento.procedenciaData = new Date().toISOString();
  atendimento.historico.push(novoEventoHistorico(usuario, `${usuario} definiu a procedência como "${dados.procedencia}".`));
  return salvarAlteracao(lista, indice, atendimento);
}

export async function abrirNaoConformidade(
  id: string,
  dados: Pick<SacNaoConformidade, 'departamentoResponsavel' | 'descricao'>,
  usuario: string
): Promise<SacAtendimento> {
  const { lista, indice, atendimento } = await localizar(id);
  if (atendimento.naoConformidade) erro('Já existe uma Não Conformidade vinculada a este atendimento.');
  const todos = await carregar();
  const maiorNumero = todos.reduce((max, a) => {
    if (!a.naoConformidade) return max;
    const numero = Number(a.naoConformidade.numero.replace('NC-', ''));
    return Number.isFinite(numero) && numero > max ? numero : max;
  }, 0);
  const numero = `NC-${String(maiorNumero + 1).padStart(6, '0')}`;
  atendimento.naoConformidade = {
    numero,
    departamentoResponsavel: dados.departamentoResponsavel,
    descricao: dados.descricao,
    status: 'Aberta',
    criadoEm: new Date().toISOString(),
  };
  atendimento.historico.push(novoEventoHistorico(usuario, `${usuario} abriu a Não Conformidade ${numero}.`));
  return salvarAlteracao(lista, indice, atendimento);
}

export async function atualizarNaoConformidade(
  id: string,
  patch: Partial<Pick<SacNaoConformidade, 'causa' | 'acaoCorretiva' | 'status' | 'responsavel' | 'dataConclusao'>>,
  usuario: string
): Promise<SacAtendimento> {
  const { lista, indice, atendimento } = await localizar(id);
  if (!atendimento.naoConformidade) erro('Este atendimento não tem Não Conformidade vinculada.', 404);
  Object.assign(atendimento.naoConformidade, patch);
  atendimento.historico.push(
    novoEventoHistorico(usuario, `${usuario} atualizou a Não Conformidade ${atendimento.naoConformidade.numero}.`)
  );
  return salvarAlteracao(lista, indice, atendimento);
}

export async function definirSolucao(
  id: string,
  dados: Omit<SacSolucao, 'statusAprovacao' | 'definidoPor' | 'definidoEm'>,
  usuario: string
): Promise<SacAtendimento> {
  const { lista, indice, atendimento } = await localizar(id);
  atendimento.solucao = {
    ...dados,
    statusAprovacao: dados.necessitaAprovacao ? 'Aguardando aprovação' : undefined,
    definidoPor: usuario,
    definidoEm: new Date().toISOString(),
  };
  atendimento.status = 'Solução proposta';
  atendimento.historico.push(novoEventoHistorico(usuario, `${usuario} definiu a solução: ${dados.tipo}.`));
  return salvarAlteracao(lista, indice, atendimento);
}

export async function decidirAprovacaoSolucao(
  id: string,
  aprovado: boolean,
  aprovador: string,
  usuario: string
): Promise<SacAtendimento> {
  const { lista, indice, atendimento } = await localizar(id);
  if (!atendimento.solucao) erro('Este atendimento não tem solução definida.', 404);
  atendimento.solucao.statusAprovacao = aprovado ? 'Aprovado' : 'Reprovado';
  atendimento.solucao.aprovador = aprovador;
  atendimento.solucao.dataAprovacao = new Date().toISOString();
  atendimento.historico.push(
    novoEventoHistorico(usuario, `${aprovador} ${aprovado ? 'aprovou' : 'reprovou'} a solução proposta.`)
  );
  return salvarAlteracao(lista, indice, atendimento);
}

export async function encerrarAtendimento(
  id: string,
  dados: {
    observacaoFinal?: string;
    clienteComunicado: boolean;
    canalComunicacaoEncerramento?: SacAtendimento['canalComunicacaoEncerramento'];
    clienteConfirmouSolucao: SacAtendimento['clienteConfirmouSolucao'];
    resultado: 'Resolvido' | 'Improcedente';
  },
  usuario: string
): Promise<SacAtendimento> {
  const { lista, indice, atendimento } = await localizar(id);

  const pendentes = atendimento.solicitacoesInternas.filter((s) => s.status === 'Pendente' || s.status === 'Em análise');
  if (pendentes.length > 0) {
    erro(`Existem ${pendentes.length} solicitação(ões) interna(s) pendente(s) — responda antes de encerrar.`);
  }
  if (atendimento.solucao?.necessitaAprovacao && atendimento.solucao.statusAprovacao === 'Aguardando aprovação') {
    erro('A solução proposta ainda aguarda aprovação.');
  }

  atendimento.status = dados.resultado;
  atendimento.observacaoFinal = dados.observacaoFinal;
  atendimento.clienteComunicado = dados.clienteComunicado;
  atendimento.canalComunicacaoEncerramento = dados.canalComunicacaoEncerramento;
  atendimento.clienteConfirmouSolucao = dados.clienteConfirmouSolucao;
  atendimento.dataResolucao = new Date().toISOString();
  atendimento.historico.push(novoEventoHistorico(usuario, `${usuario} encerrou o atendimento como "${dados.resultado}".`));
  return salvarAlteracao(lista, indice, atendimento);
}

export async function reabrirAtendimento(id: string, motivo: string, usuario: string): Promise<SacAtendimento> {
  const { lista, indice, atendimento } = await localizar(id);
  if (!['Resolvido', 'Cancelado', 'Improcedente'].includes(atendimento.status)) {
    erro('Só é possível reabrir um atendimento encerrado.');
  }
  atendimento.status = 'Em atendimento';
  atendimento.motivoReabertura = motivo;
  atendimento.historico.push(novoEventoHistorico(usuario, `${usuario} reabriu o atendimento. Motivo: ${motivo}`));
  return salvarAlteracao(lista, indice, atendimento);
}

export async function cancelarAtendimento(id: string, motivo: string, usuario: string): Promise<SacAtendimento> {
  const { lista, indice, atendimento } = await localizar(id);
  atendimento.status = 'Cancelado';
  atendimento.motivoCancelamento = motivo;
  atendimento.dataResolucao = new Date().toISOString();
  atendimento.historico.push(novoEventoHistorico(usuario, `${usuario} cancelou o atendimento. Motivo: ${motivo}`));
  return salvarAlteracao(lista, indice, atendimento);
}

export async function adicionarAnexo(id: string, anexo: Omit<SacAnexo, 'id' | 'criadoEm'>, usuario: string): Promise<SacAtendimento> {
  const { lista, indice, atendimento } = await localizar(id);
  atendimento.anexos.push({ ...anexo, id: randomUUID(), criadoEm: new Date().toISOString() });
  atendimento.historico.push(novoEventoHistorico(usuario, `${usuario} anexou o arquivo "${anexo.nome}".`));
  return salvarAlteracao(lista, indice, atendimento);
}

// ---- Alertas de reincidência (seção 26/27 do spec) ----
// Calculado sob demanda, sem tabela própria — varre os atendimentos já
// carregados em memória (volume baixo, não justifica índice).
export interface AlertaReincidencia {
  tipo: 'cliente' | 'lote' | 'corrida' | 'transportadora';
  mensagem: string;
  atendimentoIds: string[];
}

export async function calcularAlertasReincidencia(id: string): Promise<AlertaReincidencia[]> {
  const lista = await carregar();
  const atual = lista.find((a) => a.id === id);
  if (!atual) return [];

  const limiteData = new Date();
  limiteData.setDate(limiteData.getDate() - 90);
  const outros = lista.filter((a) => a.id !== id && new Date(a.criadoEm) >= limiteData);

  const alertas: AlertaReincidencia[] = [];

  const mesmoCliente = outros.filter((a) => a.cliente === atual.cliente);
  if (mesmoCliente.length > 0) {
    alertas.push({
      tipo: 'cliente',
      mensagem: `Este cliente possui ${mesmoCliente.length} outro(s) atendimento(s) nos últimos 90 dias.`,
      atendimentoIds: mesmoCliente.map((a) => a.id),
    });
  }

  const lotesAtuais = atual.produtos.map((p) => p.lote).filter(Boolean);
  if (lotesAtuais.length > 0) {
    const mesmoLote = outros.filter((a) => a.produtos.some((p) => p.lote && lotesAtuais.includes(p.lote)));
    if (mesmoLote.length > 0) {
      alertas.push({
        tipo: 'lote',
        mensagem: `Este lote possui ${mesmoLote.length} outra(s) reclamação(ões) registrada(s).`,
        atendimentoIds: mesmoLote.map((a) => a.id),
      });
    }
  }

  const corridasAtuais = atual.produtos.map((p) => p.corrida).filter(Boolean);
  if (corridasAtuais.length > 0) {
    const mesmaCorrida = outros.filter((a) => a.produtos.some((p) => p.corrida && corridasAtuais.includes(p.corrida)));
    if (mesmaCorrida.length > 0) {
      alertas.push({
        tipo: 'corrida',
        mensagem: `Esta corrida está associada a ${mesmaCorrida.length} outra(s) ocorrência(s).`,
        atendimentoIds: mesmaCorrida.map((a) => a.id),
      });
    }
  }

  if (atual.transportadora) {
    const mesmaTransportadora = outros.filter((a) => a.transportadora === atual.transportadora && a.tipo === atual.tipo);
    if (mesmaTransportadora.length >= 2) {
      alertas.push({
        tipo: 'transportadora',
        mensagem: `A transportadora "${atual.transportadora}" aparece em ${mesmaTransportadora.length} outro(s) atendimento(s) do mesmo tipo.`,
        atendimentoIds: mesmaTransportadora.map((a) => a.id),
      });
    }
  }

  return alertas;
}
