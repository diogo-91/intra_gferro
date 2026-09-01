import express from 'express';
import path from 'path';
import { mkdir } from 'fs/promises';
import { randomUUID } from 'crypto';
import cookieParser from 'cookie-parser';
import multer from 'multer';
import PDFDocument from 'pdfkit';
import { GoogleGenAI } from '@google/genai';
import dotenv from 'dotenv';
import { atualizarDadosVendas, atualizarRankingVendas, atualizarResumosVendas, getRankingVendedores, getPedidosDoVendedor, getResumoVendas, getResumoVendasPorLoja, getComparativoMensalVendas, getGestaoMetasMensais, getResumoFinanceiro, getDreFinanceira, Periodo, IntervaloVendas } from './nomus';
import { getKanbanProducao, getRelatorioProducao, getPdfRelatorioProducaoUrl, getPlanejamentoProducao } from './producao';
import { gerarPdfRankingVendedores } from './pdfRankingVendedores';
import { gerarPdfResumoVendas } from './pdfResumoVendas';
import { gerarPdfRelatorioFinanceiro } from './pdfRelatorioFinanceiro';
import { gerarPdfRelatorioDetalhado } from './pdfRelatorioDetalhado';
import { gerarPdfPlanejamentoProducao } from './pdfPlanejamentoProducao';
import { COMPOSICAO_MATERIA_PRIMA } from './src/data/composicaoMateriaPrima';
import { salvarReprogramacao, removerReprogramacao, TipoConta } from './reprogramacoes';
import { listarFuncionarios, cadastrarFuncionario, removerFuncionario } from './funcionarios';
import { salvarMetasMensais } from './metasVendas';
import { obterEnqueteAtual, criarEnquete, registrarVoto } from './enquetes';
import * as sac from './sac';
import { obterDadosPlanilhaSac, atualizarDadosPlanilhaSac, iniciarAtualizacaoAutomaticaPlanilhaSac } from './sacPlanilha';
import * as lojasFotos from './lojasFotos';
import { LOJAS, lojaDoVendedor, type LojaId } from './src/data/vendedorLoja';
import { submoduloLojaVendas } from './src/modulos';
import { loginHandler, logoutHandler, meHandler, exigirAutenticacao, exigirAdministrador, exigirPermissaoDeModulo, obterSessao } from './auth';
import { atualizarPermissoesUsuario, cadastrarUsuario, listarUsuarios, removerUsuario } from './usuarios';
import * as chamados from './chamados';

type SessaoAutenticada = NonNullable<Awaited<ReturnType<typeof obterSessao>>>;

function podeVerVendasGerais(sessao: SessaoAutenticada) {
  return sessao.administrador || sessao.submodulos.includes('vendas:geral');
}

function podeVerGestaoVendas(sessao: SessaoAutenticada) {
  return sessao.administrador || sessao.submodulos.includes('vendas:gestao');
}

function podeVerRankingVendas(sessao: SessaoAutenticada) {
  return sessao.administrador || sessao.submodulos.includes('vendas:ranking');
}

function podeVerLoja(sessao: SessaoAutenticada, lojaId: string): lojaId is LojaId {
  const loja = LOJAS.find((item) => item.id === lojaId);
  return !!loja && (sessao.administrador || sessao.submodulos.includes(submoduloLojaVendas(loja.id)));
}

async function obterSessaoVendas(req: express.Request) {
  const sessao = await obterSessao(req);
  if (!sessao) throw Object.assign(new Error('Não autenticado.'), { status: 401 });
  return sessao;
}

function exigirVendasGerais(sessao: SessaoAutenticada) {
  if (!podeVerVendasGerais(sessao)) {
    throw Object.assign(new Error('Seu acesso ao Dashboard de Vendas está limitado à sua loja.'), { status: 403 });
  }
}

function exigirGestaoVendas(sessao: SessaoAutenticada) {
  if (!podeVerGestaoVendas(sessao)) {
    throw Object.assign(new Error('Você não possui acesso à Gestão de Vendas.'), { status: 403 });
  }
}

function exigirRankingVendas(sessao: SessaoAutenticada) {
  if (!podeVerRankingVendas(sessao)) {
    throw Object.assign(new Error('Você não possui acesso ao Ranking de Vendedores.'), { status: 403 });
  }
}

function filtrarRankingPorSessao<T extends { nome: string }>(sessao: SessaoAutenticada, ranking: T[]): T[] {
  if (podeVerRankingVendas(sessao)) return ranking;
  return ranking.filter((vendedor) => {
    const lojaId = lojaDoVendedor(vendedor.nome);
    return !!lojaId && podeVerLoja(sessao, lojaId);
  });
}

function validarDataIsoQuery(valor: unknown, nomeParametro: string): string {
  if (typeof valor !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(valor)) {
    throw Object.assign(new Error(`${nomeParametro} inválido (use o formato AAAA-MM-DD)`), { status: 400 });
  }
  return valor;
}

// "DD/MM/AAAA" (formato de ContaConcluida.dataBaixa, vindo do Nomus) -> "AAAA-MM-DD".
function dataBrParaIso(dataBr: string): string {
  const [dia, mes, ano] = dataBr.split('/');
  return `${ano}-${mes}-${dia}`;
}

const ROTULO_PERIODO: Record<Periodo, string> = {
  dia: 'Hoje',
  semana: 'Esta semana',
  mes: 'Este mês',
};

const NOMES_MES_COMPLETO = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
];

// Quando um mês específico é selecionado (periodo=mes&mes=AAAA-MM), o rótulo do
// PDF mostra o mês escolhido (ex.: "Julho de 2026") em vez do genérico "Este mês".
function rotuloPeriodo(periodo: Periodo, mes?: string, intervalo?: IntervaloVendas): string {
  if (intervalo) {
    const paraBr = (data: string) => data.split('-').reverse().join('/');
    return intervalo.inicio === intervalo.fim
      ? paraBr(intervalo.inicio)
      : `${paraBr(intervalo.inicio)} a ${paraBr(intervalo.fim)}`;
  }
  if (periodo === 'mes' && mes) {
    const [anoStr, mesStr] = mes.split('-');
    const mesIndex = Number(mesStr) - 1;
    if (mesIndex >= 0 && mesIndex <= 11) {
      return `${NOMES_MES_COMPLETO[mesIndex]} de ${anoStr}`;
    }
  }
  return ROTULO_PERIODO[periodo];
}

// "AAAA-MM" -> "Julho de 2026", pro cabeçalho do relatório financeiro em PDF.
function rotuloMesFinanceiro(mesReferencia: string): string {
  const [anoStr, mesStr] = mesReferencia.split('-');
  const mesIndex = Number(mesStr) - 1;
  return mesIndex >= 0 && mesIndex <= 11 ? `${NOMES_MES_COMPLETO[mesIndex]} de ${anoStr}` : mesReferencia;
}

function validarMesQuery(mes: unknown): string | undefined {
  if (mes === undefined) return undefined;
  if (typeof mes !== 'string' || !/^\d{4}-\d{2}$/.test(mes)) {
    throw Object.assign(new Error('mes inválido (use o formato AAAA-MM)'), { status: 400 });
  }
  return mes;
}

function validarIntervaloVendas(inicio: unknown, fim: unknown): IntervaloVendas | undefined {
  if (inicio === undefined && fim === undefined) return undefined;
  if (typeof inicio !== 'string' || typeof fim !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(inicio) || !/^\d{4}-\d{2}-\d{2}$/.test(fim)) {
    throw Object.assign(new Error('intervalo inválido (informe início e fim no formato AAAA-MM-DD)'), { status: 400 });
  }
  const dataInicio = new Date(`${inicio}T00:00:00`);
  const dataFim = new Date(`${fim}T00:00:00`);
  if (Number.isNaN(dataInicio.getTime()) || Number.isNaN(dataFim.getTime()) || dataInicio > dataFim) {
    throw Object.assign(new Error('intervalo inválido (a data inicial deve ser anterior ou igual à final)'), { status: 400 });
  }
  return { inicio, fim };
}

dotenv.config();

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json({ limit: '10mb' }));
  app.use(cookieParser());

  const ai = new GoogleGenAI({
    apiKey: process.env.GEMINI_API_KEY || '',
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      }
    }
  });

  // API Routes
  app.get('/api/health', (_req, res) => {
    res.json({ status: 'ok', app: 'GFERRO Intranet', time: new Date().toISOString() });
  });

  // Autenticação — únicas rotas de /api que ficam públicas. Tudo abaixo do
  // middleware exigirAutenticacao passa a exigir o cookie de sessão.
  app.post('/api/auth/login', loginHandler);
  app.post('/api/auth/logout', logoutHandler);
  app.get('/api/auth/me', meHandler);
  app.use('/api', exigirAutenticacao);

  app.get('/api/usuarios', exigirAdministrador, async (_req, res) => {
    res.json(await listarUsuarios());
  });
  app.post('/api/usuarios', exigirAdministrador, async (req, res) => {
    try {
      const { nome, email, senha, modulos, submodulos } = req.body || {};
      if (typeof nome !== 'string' || typeof email !== 'string' || typeof senha !== 'string' || !Array.isArray(modulos) || !Array.isArray(submodulos)) {
        return res.status(400).json({ error: 'Nome, e-mail, senha e módulos são obrigatórios.' });
      }
      res.status(201).json(await cadastrarUsuario({ nome, email, senha, modulos, submodulos }));
    } catch (error: any) {
      res.status(error.status || 500).json({ error: error.message || 'Não foi possível cadastrar o usuário.' });
    }
  });
  app.delete('/api/usuarios/:id', exigirAdministrador, async (req, res) => {
    try {
      await removerUsuario(req.params.id);
      res.status(204).end();
    } catch (error: any) {
      res.status(error.status || 500).json({ error: error.message || 'Não foi possível remover o usuário.' });
    }
  });
  app.patch('/api/usuarios/:id/permissoes', exigirAdministrador, async (req, res) => {
    try {
      const { modulos, submodulos } = req.body || {};
      if (!Array.isArray(modulos) || !Array.isArray(submodulos)) {
        return res.status(400).json({ error: 'Módulos e submódulos são obrigatórios.' });
      }
      res.json(await atualizarPermissoesUsuario(req.params.id, { modulos, submodulos }));
    } catch (error: any) {
      res.status(error.status || 500).json({ error: error.message || 'Não foi possível atualizar os acessos.' });
    }
  });
  app.use('/api', exigirPermissaoDeModulo);

  const autorChamado = async (req: express.Request) => {
    const sessao = await obterSessao(req);
    if (!sessao) throw Object.assign(new Error('Não autenticado.'), { status: 401 });
    return { sessao, autor: { nome: sessao.nome || sessao.email.split('@')[0], email: sessao.email } };
  };
  const podeAtenderChamado = (sessao: Awaited<ReturnType<typeof obterSessao>>) =>
    !!sessao && (sessao.administrador || sessao.modulos.includes('departamentos'));
  const chamadoPublico = (item: chamados.Chamado, atendente: boolean) => atendente
    ? item
    : { ...item, interacoes: item.interacoes.filter((interacao) => interacao.tipo !== 'nota_interna') };

  app.get('/api/chamados', async (req, res) => {
    try {
      const { sessao } = await autorChamado(req);
      const todos = await chamados.listarChamados();
      const atendimento = req.query.escopo === 'departamento';
      if (atendimento && !podeAtenderChamado(sessao)) return res.status(403).json({ error: 'Sem permissão para atender chamados.' });
      const filtrados = atendimento
        ? todos.filter((item) => !req.query.departamentoId || item.departamentoId === req.query.departamentoId)
        : todos.filter((item) => item.solicitanteEmail === sessao.email);
      res.json(filtrados.map((item) => chamadoPublico(item, atendimento)));
    } catch (error: any) { res.status(error.status || 500).json({ error: error.message || 'Erro ao listar chamados.' }); }
  });
  app.get('/api/chamados/:id', async (req, res) => {
    try {
      const { sessao } = await autorChamado(req);
      const item = (await chamados.listarChamados()).find((chamado) => chamado.id === req.params.id);
      if (!item) return res.status(404).json({ error: 'Chamado não encontrado.' });
      const atendente = podeAtenderChamado(sessao);
      if (!atendente && item.solicitanteEmail !== sessao.email) return res.status(403).json({ error: 'Sem acesso a este chamado.' });
      res.json(chamadoPublico(item, atendente));
    } catch (error: any) { res.status(error.status || 500).json({ error: error.message || 'Erro ao consultar chamado.' }); }
  });
  app.post('/api/chamados', async (req, res) => {
    try {
      const { sessao, autor } = await autorChamado(req);
      if (!sessao.administrador && !sessao.modulos.some((m) => m === 'servicos' || m === 'departamentos')) return res.status(403).json({ error: 'Sem permissão para abrir chamados.' });
      res.status(201).json(await chamados.criarChamado(req.body, autor));
    } catch (error: any) { res.status(error.status || 500).json({ error: error.message || 'Erro ao abrir chamado.' }); }
  });
  app.patch('/api/chamados/:id', async (req, res) => {
    try {
      const { sessao, autor } = await autorChamado(req);
      if (!podeAtenderChamado(sessao)) return res.status(403).json({ error: 'Sem permissão para atender chamados.' });
      res.json(await chamados.atualizarChamado(req.params.id, req.body, autor));
    } catch (error: any) { res.status(error.status || 500).json({ error: error.message || 'Erro ao atualizar chamado.' }); }
  });
  app.post('/api/chamados/:id/interacoes', async (req, res) => {
    try {
      const { sessao, autor } = await autorChamado(req);
      const item = (await chamados.listarChamados()).find((chamado) => chamado.id === req.params.id);
      if (!item) return res.status(404).json({ error: 'Chamado não encontrado.' });
      const atendente = podeAtenderChamado(sessao);
      if (!atendente && item.solicitanteEmail !== sessao.email) return res.status(403).json({ error: 'Sem acesso a este chamado.' });
      if (req.body?.tipo === 'nota_interna' && !atendente) return res.status(403).json({ error: 'Notas internas são restritas ao atendimento.' });
      res.json(chamadoPublico(await chamados.adicionarInteracao(req.params.id, req.body, autor), atendente));
    } catch (error: any) { res.status(error.status || 500).json({ error: error.message || 'Erro ao registrar interação.' }); }
  });

  // Anexos do SAC — servidos como arquivo estático, mas atrás do mesmo login
  // da intranet (não é rota /api, então o middleware acima não cobre).
  app.use('/uploads/sac', exigirAutenticacao, express.static(sac.PASTA_UPLOADS_SAC));
  // Fotos de fachada das lojas — mesmo esquema.
  app.use('/uploads/lojas', exigirAutenticacao, express.static(lojasFotos.PASTA_UPLOADS_LOJAS));

  app.post('/api/chat', async (req, res) => {
    try {
      const { message, history } = req.body;
      if (!message) {
        return res.status(400).json({ error: 'Mensagem é obrigatória' });
      }

      const systemInstruction = `Você é a IA Assistente Oficial da GFERRO Intranet (GFERRO Siderurgia & Soluções em Aço).
Sua missão é ajudar colaboradores com dúvidas corporativas, normas de segurança (EPIs, NR-12, NR-35, CIPA), procedimentos de RH (férias, holerite, benefícios), chamados de TI, e redação de comunicados internos.

Responda sempre em português do Brasil de forma profissional, objetiva, amigável e clara, utilizando formatação Markdown quando útil (tabelas, tópicos, negrito).

Contexto da GFERRO:
- Nome da Empresa: GFERRO Soluções em Aço
- Setor: Siderurgia, Corte, Dobra, Estruturas Metálicas e Distribuição de Aço
- Valores: Segurança em 1º Lugar, Excelência Operacional, Respeito às Pessoas e Inovação.
- Contatos de Emergência Interna: Segurança do Trabalho (Ramal 190 / Cel (11) 99888-0190), Ambulatório (Ramal 192), TI Chamados (Ramal 4004).`;

      const contents: any[] = [];
      if (history && Array.isArray(history)) {
        for (const h of history) {
          contents.push({
            role: h.role === 'user' ? 'user' : 'model',
            parts: [{ text: h.content }]
          });
        }
      }
      contents.push({
        role: 'user',
        parts: [{ text: message }]
      });

      const response = await ai.models.generateContent({
        model: 'gemini-3.6-flash',
        contents: contents,
        config: {
          systemInstruction,
          temperature: 0.7,
        }
      });

      const reply = response.text || 'Desculpe, não consegui processar sua mensagem no momento.';
      res.json({ reply });
    } catch (error: any) {
      console.error('Erro na API do Gemini Chat:', error);
      res.status(500).json({
        error: 'Erro ao comunicar com a Assistente IA GFERRO.',
        details: error.message
      });
    }
  });

  app.get('/api/vendas/ranking', async (req, res) => {
    try {
      const sessao = await obterSessaoVendas(req);
      const periodo = (req.query.periodo as string) || 'mes';
      if (!['dia', 'semana', 'mes'].includes(periodo)) {
        return res.status(400).json({ error: 'periodo inválido (use dia, semana ou mes)' });
      }
      const mes = validarMesQuery(req.query.mes);
      const intervalo = validarIntervaloVendas(req.query.inicio, req.query.fim);
      const resultado = await getRankingVendedores(periodo as Periodo, mes, intervalo);
      res.json({ ...resultado, ranking: filtrarRankingPorSessao(sessao, resultado.ranking) });
    } catch (error: any) {
      console.error('Erro ao buscar ranking de vendedores no Nomus:', error);
      res.status(error.status || 500).json({ error: error.status ? error.message : 'Erro ao buscar dados do Nomus', details: error.message });
    }
  });

  app.get('/api/vendas/resumo', async (req, res) => {
    try {
      exigirVendasGerais(await obterSessaoVendas(req));
      const periodo = (req.query.periodo as string) || 'mes';
      if (!['dia', 'semana', 'mes'].includes(periodo)) {
        return res.status(400).json({ error: 'periodo inválido (use dia, semana ou mes)' });
      }
      const mes = validarMesQuery(req.query.mes);
      const intervalo = validarIntervaloVendas(req.query.inicio, req.query.fim);
      const resultado = await getResumoVendas(periodo as Periodo, mes, false, intervalo);
      res.json(resultado);
    } catch (error: any) {
      console.error('Erro ao buscar resumo de vendas no Nomus:', error);
      res.status(error.status || 500).json({ error: error.status ? error.message : 'Erro ao buscar dados do Nomus', details: error.message });
    }
  });

  app.get('/api/vendas/comparativo-mensal', async (req, res) => {
    try {
      exigirVendasGerais(await obterSessaoVendas(req));
      const mes = validarMesQuery(req.query.mes);
      res.json(await getComparativoMensalVendas(mes));
    } catch (error: any) {
      console.error('Erro ao buscar comparativo mensal de vendas:', error);
      res.status(error.status || 500).json({
        error: error.status ? error.message : 'Erro ao buscar comparativo mensal de vendas',
        details: error.message,
      });
    }
  });

  app.get('/api/vendas/gestao-metas', async (req, res) => {
    try {
      exigirGestaoVendas(await obterSessaoVendas(req));
      const mes = validarMesQuery(req.query.mes);
      if (!mes) return res.status(400).json({ error: 'Informe o mês no formato AAAA-MM.' });
      res.json(await getGestaoMetasMensais(mes));
    } catch (error: any) {
      console.error('Erro ao buscar metas mensais de gestão:', error);
      res.status(error.status || 500).json({
        error: error.status ? error.message : 'Erro ao buscar metas mensais de gestão',
        details: error.message,
      });
    }
  });

  app.put('/api/vendas/gestao-metas', exigirAdministrador, async (req, res) => {
    try {
      const mes = validarMesQuery(req.body?.mes);
      if (!mes) return res.status(400).json({ error: 'Informe o mês no formato AAAA-MM.' });
      const metas = salvarMetasMensais(mes, req.body?.metas || {});
      res.json({ mes, metas, salvoEm: new Date().toISOString() });
    } catch (error: any) {
      res.status(error.status || 500).json({ error: error.message || 'Não foi possível salvar as metas mensais.' });
    }
  });

  app.get('/api/vendas/vendedores/pedidos', async (req, res) => {
    try {
      const sessao = await obterSessaoVendas(req);
      const periodo = (req.query.periodo as string) || 'mes';
      if (!['dia', 'semana', 'mes'].includes(periodo)) {
        return res.status(400).json({ error: 'periodo inválido (use dia, semana ou mes)' });
      }
      const nome = typeof req.query.nome === 'string' ? req.query.nome.trim() : '';
      if (!nome) return res.status(400).json({ error: 'Informe o vendedor.' });
      const lojaId = lojaDoVendedor(nome);
      if (!podeVerVendasGerais(sessao) && (!lojaId || !podeVerLoja(sessao, lojaId))) {
        return res.status(403).json({ error: 'Você não possui acesso aos pedidos deste vendedor.' });
      }
      const mes = validarMesQuery(req.query.mes);
      const intervalo = validarIntervaloVendas(req.query.inicio, req.query.fim);
      res.json(await getPedidosDoVendedor(periodo as Periodo, nome, mes, intervalo));
    } catch (error: any) {
      console.error('Erro ao buscar pedidos do vendedor no Nomus:', error);
      res.status(error.status || 500).json({
        error: error.status ? error.message : 'Erro ao buscar pedidos do vendedor',
        details: error.message,
      });
    }
  });

  app.post('/api/vendas/atualizar', async (req, res) => {
    try {
      const sessao = await obterSessaoVendas(req);
      const periodo = (req.query.periodo as string) || 'mes';
      if (!['dia', 'semana', 'mes'].includes(periodo)) {
        return res.status(400).json({ error: 'periodo inválido (use dia, semana ou mes)' });
      }
      const mes = validarMesQuery(req.query.mes);
      const intervalo = validarIntervaloVendas(req.query.inicio, req.query.fim);
      const resultado = await atualizarDadosVendas(periodo as Periodo, mes, intervalo);
      if (podeVerVendasGerais(sessao)) {
        return res.json({ ...resultado, ranking: filtrarRankingPorSessao(sessao, resultado.ranking) });
      }
      const resumosLojas = Object.fromEntries(
        Object.entries(resultado.resumosLojas).filter(([lojaId]) => podeVerLoja(sessao, lojaId))
      );
      res.json({
        ranking: filtrarRankingPorSessao(sessao, resultado.ranking),
        atualizadoEm: resultado.atualizadoEm,
        resumosLojas,
      });
    } catch (error: any) {
      console.error('Erro ao forçar atualização das vendas no Nomus:', error);
      res.status(error.status || 500).json({
        error: error.status ? error.message : 'Erro ao atualizar os dados de vendas',
        details: error.message,
      });
    }
  });

  app.post('/api/vendas/ranking/atualizar', async (req, res) => {
    try {
      const sessao = await obterSessaoVendas(req);
      exigirRankingVendas(sessao);
      const periodo = (req.query.periodo as string) || 'mes';
      if (!['dia', 'semana', 'mes'].includes(periodo)) {
        return res.status(400).json({ error: 'periodo inválido (use dia, semana ou mes)' });
      }
      const mes = validarMesQuery(req.query.mes);
      const intervalo = validarIntervaloVendas(req.query.inicio, req.query.fim);
      const resultado = await atualizarRankingVendas(periodo as Periodo, mes, intervalo);
      res.json({ ...resultado, ranking: filtrarRankingPorSessao(sessao, resultado.ranking) });
    } catch (error: any) {
      console.error('Erro ao atualizar ranking de vendedores no Nomus:', error);
      res.status(error.status || 500).json({
        error: error.status ? error.message : 'Erro ao atualizar o ranking de vendedores',
        details: error.message,
      });
    }
  });

  app.get('/api/vendas/lojas/:lojaId/resumo', async (req, res) => {
    try {
      const sessao = await obterSessaoVendas(req);
      const { lojaId } = req.params;
      if (!LOJAS.some((l) => l.id === lojaId)) {
        return res.status(400).json({ error: 'Loja desconhecida.' });
      }
      if (!podeVerLoja(sessao, lojaId)) {
        return res.status(403).json({ error: 'Você não possui acesso a esta loja.' });
      }
      const periodo = (req.query.periodo as string) || 'mes';
      if (!['dia', 'semana', 'mes'].includes(periodo)) {
        return res.status(400).json({ error: 'periodo inválido (use dia, semana ou mes)' });
      }
      const mes = validarMesQuery(req.query.mes);
      const intervalo = validarIntervaloVendas(req.query.inicio, req.query.fim);
      const resultado = await getResumoVendasPorLoja(periodo as Periodo, lojaId, mes, intervalo);
      res.json(resultado);
    } catch (error: any) {
      console.error('Erro ao buscar resumo de vendas por loja no Nomus:', error);
      res.status(error.status || 500).json({ error: error.status ? error.message : 'Erro ao buscar dados do Nomus', details: error.message });
    }
  });

  app.get('/api/vendas/ranking/pdf', async (req, res) => {
    try {
      const sessao = await obterSessaoVendas(req);
      exigirRankingVendas(sessao);
      const periodo = (req.query.periodo as string) || 'mes';
      if (!['dia', 'semana', 'mes'].includes(periodo)) {
        return res.status(400).json({ error: 'periodo inválido (use dia, semana ou mes)' });
      }
      const mes = validarMesQuery(req.query.mes);
      const intervalo = validarIntervaloVendas(req.query.inicio, req.query.fim);
      const { ranking, atualizadoEm } = await getRankingVendedores(periodo as Periodo, mes, intervalo);
      const rankingPermitido = filtrarRankingPorSessao(sessao, ranking);

      const doc = new PDFDocument({ margin: 40, size: 'A4', bufferPages: true });
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="ranking-vendedores-${mes || periodo}.pdf"`);
      doc.pipe(res);
      gerarPdfRankingVendedores(doc, {
        periodoRotulo: rotuloPeriodo(periodo as Periodo, mes, intervalo),
        // Mesma regra da tela: o ranking geral representa a empresa inteira,
        // inclusive vendedores ainda sem unidade cadastrada.
        ranking: rankingPermitido,
        atualizadoEm: new Date(atualizadoEm).toLocaleString('pt-BR'),
      });
      doc.end();
    } catch (error: any) {
      console.error('Erro ao gerar PDF do ranking de vendedores:', error);
      res.status(error.status || 500).json({ error: error.status ? error.message : 'Erro ao gerar PDF', details: error.message });
    }
  });

  const IDS_LOJAS_VALIDOS = new Set<string>(LOJAS.map((l) => l.id));

  const uploadLojaFoto = multer({
    storage: multer.diskStorage({
      destination: async (_req, _file, cb) => {
        await mkdir(lojasFotos.PASTA_UPLOADS_LOJAS, { recursive: true });
        cb(null, lojasFotos.PASTA_UPLOADS_LOJAS);
      },
      filename: (_req, file, cb) => {
        cb(null, `${randomUUID()}-${file.originalname.replace(/[^a-zA-Z0-9.\-_]/g, '_')}`);
      },
    }),
    fileFilter: (_req, file, cb) => {
      if (!file.mimetype.startsWith('image/')) {
        return cb(new Error('Envie um arquivo de imagem.'));
      }
      cb(null, true);
    },
    limits: { fileSize: 8 * 1024 * 1024 },
  });

  app.get('/api/vendas/lojas/fotos', async (_req, res) => {
    res.json(await lojasFotos.listarFotosLojas());
  });

  app.post('/api/vendas/lojas/:lojaId/foto', uploadLojaFoto.single('foto'), async (req, res) => {
    try {
      const sessao = await obterSessaoVendas(req);
      const { lojaId } = req.params;
      if (!IDS_LOJAS_VALIDOS.has(lojaId)) {
        return res.status(400).json({ error: 'Loja desconhecida.' });
      }
      if (!podeVerLoja(sessao, lojaId)) {
        return res.status(403).json({ error: 'Você não possui acesso a esta loja.' });
      }
      if (!req.file) {
        return res.status(400).json({ error: 'Nenhuma imagem enviada.' });
      }
      const url = `/uploads/lojas/${req.file.filename}`;
      await lojasFotos.definirFotoLoja(lojaId, url);
      res.json({ url });
    } catch (error: any) {
      console.error('Erro ao salvar foto da loja:', error);
      res.status(500).json({ error: 'Erro ao salvar a foto', details: error.message });
    }
  });

  app.get('/api/vendas/resumo/pdf', async (req, res) => {
    try {
      exigirVendasGerais(await obterSessaoVendas(req));
      const periodo = (req.query.periodo as string) || 'mes';
      if (!['dia', 'semana', 'mes'].includes(periodo)) {
        return res.status(400).json({ error: 'periodo inválido (use dia, semana ou mes)' });
      }
      const mes = validarMesQuery(req.query.mes);
      const intervalo = validarIntervaloVendas(req.query.inicio, req.query.fim);
      const resumo = await getResumoVendas(periodo as Periodo, mes, false, intervalo);

      const doc = new PDFDocument({ margin: 40, size: 'A4', bufferPages: true });
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="painel-vendas-${mes || periodo}.pdf"`);
      doc.pipe(res);
      gerarPdfResumoVendas(doc, {
        periodoRotulo: rotuloPeriodo(periodo as Periodo, mes, intervalo),
        resumo,
        atualizadoEm: new Date(resumo.atualizadoEm).toLocaleString('pt-BR'),
      });
      doc.end();
    } catch (error: any) {
      console.error('Erro ao gerar PDF do resumo de vendas:', error);
      res.status(error.status || 500).json({ error: error.status ? error.message : 'Erro ao gerar PDF', details: error.message });
    }
  });

  app.get('/api/financeiro/resumo', async (req, res) => {
    try {
      const mes = req.query.mes as string | undefined;
      if (mes && !/^\d{4}-\d{2}$/.test(mes)) {
        return res.status(400).json({ error: 'mes inválido (use o formato AAAA-MM)' });
      }
      const resumo = await getResumoFinanceiro(mes);
      res.json(resumo);
    } catch (error: any) {
      console.error('Erro ao buscar resumo financeiro no Nomus:', error);
      res.status(500).json({ error: 'Erro ao buscar dados do Nomus', details: error.message });
    }
  });

  app.get('/api/financeiro/dre', async (req, res) => {
    try {
      const mes = req.query.mes as string | undefined;
      if (mes && !/^\d{4}-\d{2}$/.test(mes)) {
        return res.status(400).json({ error: 'mes inválido (use o formato AAAA-MM)' });
      }
      res.json(await getDreFinanceira(mes));
    } catch (error: any) {
      console.error('Erro ao montar DRE no Nomus:', error);
      res.status(500).json({ error: 'Erro ao buscar dados da DRE no Nomus', details: error.message });
    }
  });

  app.get('/api/financeiro/relatorio/pdf', async (req, res) => {
    try {
      const mes = req.query.mes as string | undefined;
      if (mes && !/^\d{4}-\d{2}$/.test(mes)) {
        return res.status(400).json({ error: 'mes inválido (use o formato AAAA-MM)' });
      }
      const resumo = await getResumoFinanceiro(mes);

      const doc = new PDFDocument({ margin: 40, size: 'A4', bufferPages: true });
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="relatorio-financeiro-${resumo.mesReferencia}.pdf"`);
      doc.pipe(res);
      gerarPdfRelatorioFinanceiro(doc, {
        periodoRotulo: rotuloMesFinanceiro(resumo.mesReferencia),
        resumo,
        atualizadoEm: new Date(resumo.atualizadoEm).toLocaleString('pt-BR'),
      });
      doc.end();
    } catch (error: any) {
      console.error('Erro ao gerar PDF do relatório financeiro:', error);
      res.status(500).json({ error: 'Erro ao gerar PDF', details: error.message });
    }
  });

  app.get('/api/financeiro/relatorio-detalhado/pdf', async (req, res) => {
    try {
      const dia = validarDataIsoQuery(req.query.dia, 'dia');
      const mes = dia.slice(0, 7);
      const resumo = await getResumoFinanceiro(mes);

      const recebido = resumo.contasConcluidas.filter((c) => c.tipo === 'receber' && dataBrParaIso(c.dataBaixa) === dia);
      const pago = resumo.contasConcluidas.filter((c) => c.tipo === 'pagar' && dataBrParaIso(c.dataBaixa) === dia);
      const totalRecebido = recebido.reduce((s, c) => s + c.valor, 0);
      const totalPago = pago.reduce((s, c) => s + c.valor, 0);
      // Meta 70% da receita do dia — mesmo cálculo do card "Matéria Prima" no frontend.
      const valorMateriaPrima = 0.7 * totalRecebido;

      const [ano, mesNum, diaNum] = dia.split('-').map(Number);
      const diaRotulo = new Date(ano, mesNum - 1, diaNum).toLocaleDateString('pt-BR', { dateStyle: 'long' });

      const doc = new PDFDocument({ margin: 40, size: 'A4', bufferPages: true });
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="relatorio-detalhado-${dia}.pdf"`);
      doc.pipe(res);
      gerarPdfRelatorioDetalhado(doc, {
        diaRotulo,
        recebido,
        totalRecebido,
        pago,
        totalPago,
        valorMateriaPrima,
        composicao: COMPOSICAO_MATERIA_PRIMA,
        atualizadoEm: new Date(resumo.atualizadoEm).toLocaleString('pt-BR'),
      });
      doc.end();
    } catch (error: any) {
      console.error('Erro ao gerar PDF do relatório detalhado:', error);
      res.status(error.status || 500).json({ error: error.status ? error.message : 'Erro ao gerar PDF', details: error.message });
    }
  });

  app.get('/api/producao/kanban', async (_req, res) => {
    try {
      const dado = await getKanbanProducao();
      res.json(dado);
    } catch (error: any) {
      console.error('Erro ao buscar kanban de produção no Apontamento:', error);
      res.status(500).json({ error: 'Erro ao buscar dados do Apontamento de Produção', details: error.message });
    }
  });

  app.get('/api/producao/planejamento', async (_req, res) => {
    try {
      const dado = await getPlanejamentoProducao();
      res.json(dado);
    } catch (error: any) {
      console.error('Erro ao buscar planejamento de produção no Apontamento:', error);
      res.status(500).json({ error: 'Erro ao buscar dados do Apontamento de Produção', details: error.message });
    }
  });

  app.get('/api/producao/planejamento/pdf', async (req, res) => {
    try {
      const inicio = validarDataIsoQuery(req.query.inicio, 'inicio');
      const fim = validarDataIsoQuery(req.query.fim, 'fim');
      const rotulo = (req.query.rotulo as string) || `${inicio} a ${fim}`;
      const todos = await getPlanejamentoProducao();
      const itens = todos.filter((item) => item.data >= inicio && item.data <= fim);

      const doc = new PDFDocument({ margin: 40, size: 'A4', bufferPages: true });
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="planejamento-producao-${inicio}-a-${fim}.pdf"`);
      doc.pipe(res);
      gerarPdfPlanejamentoProducao(doc, { periodoRotulo: rotulo, itens, atualizadoEm: new Date().toLocaleString('pt-BR') });
      doc.end();
    } catch (error: any) {
      console.error('Erro ao gerar PDF do planejamento de produção:', error);
      res.status(error.status || 500).json({ error: error.status ? error.message : 'Erro ao gerar PDF', details: error.message });
    }
  });

  app.get('/api/producao/relatorio', async (req, res) => {
    try {
      const inicio = validarDataIsoQuery(req.query.inicio, 'inicio');
      const fim = validarDataIsoQuery(req.query.fim, 'fim');
      const dado = await getRelatorioProducao(inicio, fim);
      res.json(dado);
    } catch (error: any) {
      console.error('Erro ao buscar relatório de produção no Apontamento:', error);
      res.status(error.status || 500).json({ error: error.status ? error.message : 'Erro ao buscar dados do Apontamento de Produção', details: error.message });
    }
  });

  app.get('/api/producao/relatorio/pdf', async (req, res) => {
    try {
      const inicio = validarDataIsoQuery(req.query.inicio, 'inicio');
      const fim = validarDataIsoQuery(req.query.fim, 'fim');
      const rotulo = (req.query.rotulo as string) || `${inicio} a ${fim}`;
      const resp = await fetch(getPdfRelatorioProducaoUrl(inicio, fim, rotulo));
      if (!resp.ok) throw new Error(`Apontamento de Produção respondeu ${resp.status}`);
      const buffer = Buffer.from(await resp.arrayBuffer());
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="relatorio-producao-${inicio}-a-${fim}.pdf"`);
      res.send(buffer);
    } catch (error: any) {
      console.error('Erro ao baixar PDF do relatório de produção:', error);
      res.status(error.status || 500).json({ error: error.status ? error.message : 'Erro ao gerar PDF', details: error.message });
    }
  });

  app.get('/api/financeiro/previsao-ia', async (req, res) => {
    try {
      const mes = req.query.mes as string | undefined;
      if (mes && !/^\d{4}-\d{2}$/.test(mes)) {
        return res.status(400).json({ error: 'mes inválido (use o formato AAAA-MM)' });
      }
      const resumo = await getResumoFinanceiro(mes);

      const contasVencidasReceber = resumo.contasReceber.filter((c) => c.status === 'Vencida');
      const contasVencidasPagar = resumo.contasPagar.filter((c) => c.status === 'Vencida');

      const dadosResumo = `
Mês de referência: ${rotuloMesFinanceiro(resumo.mesReferencia)}
Faturamento do mês: ${resumo.faturamentoMes.toFixed(2)} (variação de ${resumo.variacaoFaturamento.toFixed(1)}% em relação ao mês anterior)
Saldo do mês (recebido - pago, realizado): ${resumo.saldoMes.toFixed(2)}
Total em aberto a receber: ${resumo.totalReceber.toFixed(2)} (${resumo.contasReceber.length} contas)
Total em aberto a pagar: ${resumo.totalPagar.toFixed(2)} (${resumo.contasPagar.length} contas)
Valor vencido a receber: ${resumo.valorVencidoReceber.toFixed(2)}
Taxa de inadimplência: ${resumo.inadimplencia.toFixed(1)}%
Contas a receber vencidas: ${contasVencidasReceber.length}
Contas a pagar vencidas: ${contasVencidasPagar.length}
Fluxo de caixa realizado dos últimos meses (mês: receitas / despesas):
${resumo.fluxoCaixa.map((f) => `- ${f.mes}: R$ ${f.receitas.toFixed(2)} / R$ ${f.despesas.toFixed(2)}`).join('\n')}
`.trim();

      const systemInstruction = `Você é um analista financeiro sênior da GFERRO Siderurgia analisando o fluxo de caixa da empresa.
Com base nos números reais abaixo, escreva uma previsão objetiva em português do Brasil, em TEXTO SIMPLES (sem markdown, sem asteriscos, sem títulos com #), organizada em 3 blocos separados por linha em branco:
1. Tendência esperada para os próximos 30 dias (com base no saldo, faturamento e fluxo de caixa recente).
2. Principais riscos (inadimplência, contas vencidas, concentração de vencimentos).
3. 2 a 3 recomendações objetivas e acionáveis.
Seja direto, use os números fornecidos, e não invente dados que não estão no resumo.`;

      const response = await ai.models.generateContent({
        model: 'gemini-3.6-flash',
        contents: [{ role: 'user', parts: [{ text: dadosResumo }] }],
        config: { systemInstruction, temperature: 0.4 },
      });

      const previsao = response.text || 'Não foi possível gerar a previsão no momento.';
      res.json({ previsao, geradoEm: new Date().toISOString() });
    } catch (error: any) {
      console.error('Erro ao gerar previsão financeira com IA:', error);
      res.status(500).json({ error: 'Erro ao gerar previsão com IA', details: error.message });
    }
  });

  // Replanejamento LOCAL de data — o Nomus não expõe edição de vencimento via
  // API (ver comentário em reprogramacoes.ts), então isso NUNCA muda nada lá.
  app.post('/api/financeiro/reprogramar', async (req, res) => {
    try {
      const { id, tipo, vencimentoOriginal, novaData } = req.body || {};
      if (!id || (tipo !== 'receber' && tipo !== 'pagar') || !vencimentoOriginal || !novaData) {
        return res.status(400).json({ error: 'Informe id, tipo ("receber" ou "pagar"), vencimentoOriginal e novaData.' });
      }
      if (!/^\d{4}-\d{2}-\d{2}$/.test(novaData)) {
        return res.status(400).json({ error: 'novaData inválida (use o formato AAAA-MM-DD).' });
      }
      const [ano, mes, dia] = novaData.split('-');
      const novaDataBr = `${dia}/${mes}/${ano}`;
      await salvarReprogramacao(String(id), tipo as TipoConta, vencimentoOriginal, novaDataBr);
      res.json({ ok: true });
    } catch (error: any) {
      console.error('Erro ao salvar replanejamento financeiro:', error);
      res.status(500).json({ error: 'Erro ao salvar replanejamento', details: error.message });
    }
  });

  app.delete('/api/financeiro/reprogramar/:tipo/:id', async (req, res) => {
    try {
      const { tipo, id } = req.params;
      if (tipo !== 'receber' && tipo !== 'pagar') {
        return res.status(400).json({ error: 'tipo inválido (use "receber" ou "pagar").' });
      }
      await removerReprogramacao(id, tipo as TipoConta);
      res.json({ ok: true });
    } catch (error: any) {
      console.error('Erro ao remover replanejamento financeiro:', error);
      res.status(500).json({ error: 'Erro ao remover replanejamento', details: error.message });
    }
  });

  // Cadastro de funcionários do módulo RH — dado próprio da intranet (ver
  // comentário em funcionarios.ts sobre por que não vem do Nomus).
  app.get('/api/rh/funcionarios', async (_req, res) => {
    try {
      const lista = await listarFuncionarios();
      res.json(lista);
    } catch (error: any) {
      console.error('Erro ao listar funcionários:', error);
      res.status(500).json({ error: 'Erro ao listar funcionários', details: error.message });
    }
  });

  app.post('/api/rh/funcionarios', async (req, res) => {
    try {
      const { nome, cargo, setor, email, telefone, dataAdmissao, dataNascimento, status } = req.body || {};
      if (typeof nome !== 'string' || !nome.trim()) {
        return res.status(400).json({ error: 'Informe o nome do funcionário.' });
      }
      if (typeof cargo !== 'string' || !cargo.trim()) {
        return res.status(400).json({ error: 'Informe o cargo do funcionário.' });
      }
      if (typeof setor !== 'string' || !setor.trim()) {
        return res.status(400).json({ error: 'Informe o setor do funcionário.' });
      }
      const novo = await cadastrarFuncionario({
        nome: nome.trim(),
        cargo: cargo.trim(),
        setor: setor.trim(),
        email: typeof email === 'string' && email.trim() ? email.trim() : undefined,
        telefone: typeof telefone === 'string' && telefone.trim() ? telefone.trim() : undefined,
        dataAdmissao: typeof dataAdmissao === 'string' && dataAdmissao.trim() ? dataAdmissao.trim() : undefined,
        dataNascimento: typeof dataNascimento === 'string' && dataNascimento.trim() ? dataNascimento.trim() : undefined,
        status: status === 'Inativo' ? 'Inativo' : status === 'Férias' ? 'Férias' : 'Ativo',
      });
      res.json(novo);
    } catch (error: any) {
      console.error('Erro ao cadastrar funcionário:', error);
      res.status(500).json({ error: 'Erro ao cadastrar funcionário', details: error.message });
    }
  });

  app.delete('/api/rh/funcionarios/:id', async (req, res) => {
    try {
      await removerFuncionario(req.params.id);
      res.json({ ok: true });
    } catch (error: any) {
      console.error('Erro ao remover funcionário:', error);
      res.status(500).json({ error: 'Erro ao remover funcionário', details: error.message });
    }
  });

  // Enquete ativa do Dashboard ("Enquete da Semana") — cadastrada pelo RH.
  app.get('/api/enquetes/atual', async (_req, res) => {
    try {
      const enquete = await obterEnqueteAtual();
      res.json(enquete);
    } catch (error: any) {
      console.error('Erro ao buscar enquete atual:', error);
      res.status(500).json({ error: 'Erro ao buscar enquete', details: error.message });
    }
  });

  app.post('/api/enquetes', async (req, res) => {
    try {
      const { pergunta, opcoes } = req.body || {};
      if (typeof pergunta !== 'string' || !pergunta.trim()) {
        return res.status(400).json({ error: 'Informe a pergunta da enquete.' });
      }
      const opcoesLimpas = Array.isArray(opcoes)
        ? opcoes.filter((o: unknown): o is string => typeof o === 'string' && o.trim().length > 0).map((o: string) => o.trim())
        : [];
      if (opcoesLimpas.length < 2) {
        return res.status(400).json({ error: 'Informe ao menos 2 opções.' });
      }
      const nova = await criarEnquete({ pergunta: pergunta.trim(), opcoes: opcoesLimpas });
      res.json(nova);
    } catch (error: any) {
      console.error('Erro ao criar enquete:', error);
      res.status(500).json({ error: 'Erro ao criar enquete', details: error.message });
    }
  });

  app.post('/api/enquetes/:id/votar', async (req, res) => {
    try {
      const { opcaoIndex } = req.body || {};
      if (typeof opcaoIndex !== 'number') {
        return res.status(400).json({ error: 'Informe a opção escolhida.' });
      }
      const atualizada = await registrarVoto(req.params.id, opcaoIndex);
      res.json(atualizada);
    } catch (error: any) {
      console.error('Erro ao registrar voto na enquete:', error);
      res.status(error.status || 500).json({ error: error.status ? error.message : 'Erro ao registrar voto', details: error.message });
    }
  });

  // ---- SAC / Pós-Vendas ----
  // Atendimento externo ao cliente — ver comentário no topo de sac.ts.
  function rotaSac(handler: (req: express.Request, res: express.Response) => Promise<void | express.Response>) {
    return async (req: express.Request, res: express.Response) => {
      try {
        await handler(req, res);
      } catch (error: any) {
        console.error('Erro no SAC:', error);
        res.status(error.status || 500).json({ error: error.status ? error.message : 'Erro ao processar solicitação', details: error.message });
      }
    };
  }

  function usuarioDe(req: express.Request): string {
    const usuario = req.body?.usuario;
    if (typeof usuario !== 'string' || !usuario.trim()) {
      throw Object.assign(new Error('Usuário não informado.'), { status: 400 });
    }
    return usuario.trim();
  }

  const uploadSac = multer({
    storage: multer.diskStorage({
      destination: async (_req, _file, cb) => {
        await mkdir(sac.PASTA_UPLOADS_SAC, { recursive: true });
        cb(null, sac.PASTA_UPLOADS_SAC);
      },
      filename: (_req, file, cb) => {
        cb(null, `${randomUUID()}-${file.originalname.replace(/[^a-zA-Z0-9.\-_]/g, '_')}`);
      },
    }),
    limits: { fileSize: 25 * 1024 * 1024 },
  });

  app.get(
    '/api/sac/planilha',
    rotaSac(async (_req, res) => {
      res.json(await obterDadosPlanilhaSac());
    })
  );

  app.post(
    '/api/sac/planilha/atualizar',
    rotaSac(async (_req, res) => {
      res.json(await atualizarDadosPlanilhaSac());
    })
  );

  app.get(
    '/api/sac/atendimentos',
    rotaSac(async (_req, res) => {
      res.json(await sac.listarAtendimentos());
    })
  );

  app.get(
    '/api/sac/atendimentos/:id',
    rotaSac(async (req, res) => {
      res.json(await sac.obterAtendimento(req.params.id));
    })
  );

  app.get(
    '/api/sac/atendimentos/:id/alertas',
    rotaSac(async (req, res) => {
      res.json(await sac.calcularAlertasReincidencia(req.params.id));
    })
  );

  app.post(
    '/api/sac/atendimentos',
    rotaSac(async (req, res) => {
      const { usuario, ...dados } = req.body || {};
      res.json(await sac.criarAtendimento(dados, usuarioDe(req)));
    })
  );

  app.patch(
    '/api/sac/atendimentos/:id',
    rotaSac(async (req, res) => {
      const { usuario, ...patch } = req.body || {};
      res.json(await sac.editarDadosGerais(req.params.id, patch, usuarioDe(req)));
    })
  );

  app.post(
    '/api/sac/atendimentos/:id/status',
    rotaSac(async (req, res) => {
      if (!req.body?.status) return res.status(400).json({ error: 'Informe o novo status.' });
      res.json(await sac.alterarStatus(req.params.id, req.body.status, usuarioDe(req)));
    })
  );

  app.post(
    '/api/sac/atendimentos/:id/prioridade',
    rotaSac(async (req, res) => {
      if (!req.body?.prioridade) return res.status(400).json({ error: 'Informe a nova prioridade.' });
      res.json(await sac.alterarPrioridade(req.params.id, req.body.prioridade, usuarioDe(req)));
    })
  );

  app.post(
    '/api/sac/atendimentos/:id/responsavel',
    rotaSac(async (req, res) => {
      if (!req.body?.responsavel) return res.status(400).json({ error: 'Informe o novo responsável.' });
      res.json(await sac.alterarResponsavel(req.params.id, req.body.responsavel, usuarioDe(req)));
    })
  );

  app.post(
    '/api/sac/atendimentos/:id/interacoes',
    rotaSac(async (req, res) => {
      const { usuario, ...dados } = req.body || {};
      if (!dados.canal || !dados.tipo || !dados.descricao?.trim()) {
        return res.status(400).json({ error: 'Informe canal, tipo e descrição da interação.' });
      }
      res.json(await sac.adicionarInteracao(req.params.id, dados, usuarioDe(req)));
    })
  );

  app.post(
    '/api/sac/atendimentos/:id/solicitacoes',
    rotaSac(async (req, res) => {
      const { usuario, ...dados } = req.body || {};
      if (!dados.departamento || !dados.solicitacao?.trim() || !dados.prioridade) {
        return res.status(400).json({ error: 'Informe departamento, solicitação e prioridade.' });
      }
      res.json(await sac.solicitarAnaliseInterna(req.params.id, dados, usuarioDe(req)));
    })
  );

  app.post(
    '/api/sac/atendimentos/:id/solicitacoes/:solicitacaoId/resposta',
    rotaSac(async (req, res) => {
      const { usuario, ...resposta } = req.body || {};
      if (!resposta.parecer?.trim() || !resposta.responsavel?.trim()) {
        return res.status(400).json({ error: 'Informe o parecer e o responsável pela resposta.' });
      }
      res.json(await sac.responderSolicitacao(req.params.id, req.params.solicitacaoId, resposta, usuarioDe(req)));
    })
  );

  app.post(
    '/api/sac/atendimentos/:id/procedencia',
    rotaSac(async (req, res) => {
      const { usuario, ...dados } = req.body || {};
      if (!dados.procedencia || !dados.responsavel?.trim()) {
        return res.status(400).json({ error: 'Informe a procedência e o responsável pela análise.' });
      }
      res.json(await sac.definirProcedencia(req.params.id, dados, usuarioDe(req)));
    })
  );

  app.post(
    '/api/sac/atendimentos/:id/nao-conformidade',
    rotaSac(async (req, res) => {
      const { usuario, ...dados } = req.body || {};
      if (!dados.departamentoResponsavel || !dados.descricao?.trim()) {
        return res.status(400).json({ error: 'Informe o departamento responsável e a descrição da não conformidade.' });
      }
      res.json(await sac.abrirNaoConformidade(req.params.id, dados, usuarioDe(req)));
    })
  );

  app.patch(
    '/api/sac/atendimentos/:id/nao-conformidade',
    rotaSac(async (req, res) => {
      const { usuario, ...patch } = req.body || {};
      res.json(await sac.atualizarNaoConformidade(req.params.id, patch, usuarioDe(req)));
    })
  );

  app.post(
    '/api/sac/atendimentos/:id/solucao',
    rotaSac(async (req, res) => {
      const { usuario, ...dados } = req.body || {};
      if (!dados.tipo || !dados.descricao?.trim()) {
        return res.status(400).json({ error: 'Informe o tipo e a descrição da solução.' });
      }
      res.json(await sac.definirSolucao(req.params.id, dados, usuarioDe(req)));
    })
  );

  app.post(
    '/api/sac/atendimentos/:id/solucao/aprovacao',
    rotaSac(async (req, res) => {
      if (typeof req.body?.aprovado !== 'boolean' || !req.body?.aprovador?.trim()) {
        return res.status(400).json({ error: 'Informe a decisão (aprovado) e o aprovador.' });
      }
      res.json(await sac.decidirAprovacaoSolucao(req.params.id, req.body.aprovado, req.body.aprovador, usuarioDe(req)));
    })
  );

  app.post(
    '/api/sac/atendimentos/:id/encerrar',
    rotaSac(async (req, res) => {
      const { usuario, ...dados } = req.body || {};
      if (!dados.resultado || !dados.clienteConfirmouSolucao || typeof dados.clienteComunicado !== 'boolean') {
        return res.status(400).json({ error: 'Informe o resultado, se o cliente foi comunicado e se confirmou a solução.' });
      }
      res.json(await sac.encerrarAtendimento(req.params.id, dados, usuarioDe(req)));
    })
  );

  app.post(
    '/api/sac/atendimentos/:id/reabrir',
    rotaSac(async (req, res) => {
      if (!req.body?.motivo?.trim()) return res.status(400).json({ error: 'Informe o motivo da reabertura.' });
      res.json(await sac.reabrirAtendimento(req.params.id, req.body.motivo, usuarioDe(req)));
    })
  );

  app.post(
    '/api/sac/atendimentos/:id/cancelar',
    rotaSac(async (req, res) => {
      if (!req.body?.motivo?.trim()) return res.status(400).json({ error: 'Informe o motivo do cancelamento.' });
      res.json(await sac.cancelarAtendimento(req.params.id, req.body.motivo, usuarioDe(req)));
    })
  );

  app.post('/api/sac/atendimentos/:id/anexos', uploadSac.single('arquivo'), rotaSac(async (req, res) => {
    if (!req.file) return res.status(400).json({ error: 'Nenhum arquivo enviado.' });
    const usuario = usuarioDe(req);
    const anexo = {
      nome: req.file.originalname,
      url: `/uploads/sac/${req.file.filename}`,
      tipo: req.file.mimetype,
      tamanho: req.file.size,
      descricao: typeof req.body?.descricao === 'string' && req.body.descricao.trim() ? req.body.descricao.trim() : undefined,
      enviadoPor: usuario,
    };
    res.json(await sac.adicionarAnexo(req.params.id, anexo, usuario));
  }));

  // Vite middleware in dev mode
  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Servidor GFERRO Intranet rodando em http://0.0.0.0:${PORT}`);

    // A planilha é a fonte única da visão principal do SAC. Mantém um último
    // snapshot em /app/data e consulta o Google silenciosamente a cada minuto.
    iniciarAtualizacaoAutomaticaPlanilhaSac();

    // Mantém o mês corrente de Vendas aquecido mesmo quando ninguém está com
    // o dashboard aberto. O ciclo é agendado somente depois que a consulta
    // anterior termina, evitando duas varreduras concorrentes no Nomus.
    const intervaloAtualizacaoVendasMs = 3 * 60 * 1000;
    const atualizarVendasContinuamente = async () => {
      const inicio = Date.now();
      try {
        const resultado = await atualizarRankingVendas('mes');
        // Recalcula e persiste também produtos, quantidades e preços médios do
        // painel geral e de todas as unidades. O snapshot anterior continua
        // disponível enquanto esta etapa roda em segundo plano.
        await atualizarResumosVendas('mes');
        const totalPedidos = resultado.ranking.reduce((soma, vendedor) => soma + vendedor.pedidos, 0);
        console.log(
          `[vendas] cache automático atualizado: ${totalPedidos} pedidos em ${((Date.now() - inicio) / 1000).toFixed(1)}s`
        );
      } catch (error) {
        console.error('[vendas] falha na atualização automática; mantendo último cache bom:', error);
      } finally {
        const proximoCiclo = setTimeout(atualizarVendasContinuamente, intervaloAtualizacaoVendasMs);
        proximoCiclo.unref();
      }
    };

    // Reabre imediatamente o último snapshot persistido em /app/data, antes
    // mesmo do primeiro ciclo automático do Nomus. Assim o primeiro usuário
    // após um restart também recebe os KPIs prontos.
    void Promise.allSettled([
      getResumoVendas('mes'),
      ...LOJAS.map((loja) => getResumoVendasPorLoja('mes', loja.id)),
    ]).then((resultados) => {
      const falhas = resultados.filter((resultado) => resultado.status === 'rejected');
      if (falhas.length > 0) {
        console.error(`[vendas] ${falhas.length} snapshot(s) não puderam ser pré-aquecidos; os caches existentes foram preservados.`);
      }
    });

    // Pequeno atraso para não disputar CPU/rede com a inicialização do app.
    const primeiroCiclo = setTimeout(atualizarVendasContinuamente, 10_000);
    primeiroCiclo.unref();
  });
}

startServer();
