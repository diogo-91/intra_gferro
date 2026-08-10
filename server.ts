import express from 'express';
import path from 'path';
import cookieParser from 'cookie-parser';
import PDFDocument from 'pdfkit';
import { GoogleGenAI } from '@google/genai';
import dotenv from 'dotenv';
import { getRankingVendedores, getResumoVendas, getResumoFinanceiro, Periodo } from './nomus';
import { getKanbanProducao, getRelatorioProducao, getPdfRelatorioProducaoUrl } from './producao';
import { gerarPdfRankingVendedores } from './pdfRankingVendedores';
import { gerarPdfResumoVendas } from './pdfResumoVendas';
import { gerarPdfRelatorioFinanceiro } from './pdfRelatorioFinanceiro';
import { gerarPdfRelatorioDetalhado } from './pdfRelatorioDetalhado';
import { COMPOSICAO_MATERIA_PRIMA } from './src/data/composicaoMateriaPrima';
import { salvarReprogramacao, removerReprogramacao, TipoConta } from './reprogramacoes';
import { listarFuncionarios, cadastrarFuncionario, removerFuncionario } from './funcionarios';
import { obterEnqueteAtual, criarEnquete, registrarVoto } from './enquetes';
import { loginHandler, logoutHandler, meHandler, exigirAutenticacao } from './auth';

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
function rotuloPeriodo(periodo: Periodo, mes?: string): string {
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
      const periodo = (req.query.periodo as string) || 'mes';
      if (!['dia', 'semana', 'mes'].includes(periodo)) {
        return res.status(400).json({ error: 'periodo inválido (use dia, semana ou mes)' });
      }
      const mes = validarMesQuery(req.query.mes);
      const resultado = await getRankingVendedores(periodo as Periodo, mes);
      res.json(resultado);
    } catch (error: any) {
      console.error('Erro ao buscar ranking de vendedores no Nomus:', error);
      res.status(error.status || 500).json({ error: error.status ? error.message : 'Erro ao buscar dados do Nomus', details: error.message });
    }
  });

  app.get('/api/vendas/resumo', async (req, res) => {
    try {
      const periodo = (req.query.periodo as string) || 'mes';
      if (!['dia', 'semana', 'mes'].includes(periodo)) {
        return res.status(400).json({ error: 'periodo inválido (use dia, semana ou mes)' });
      }
      const mes = validarMesQuery(req.query.mes);
      const resultado = await getResumoVendas(periodo as Periodo, mes);
      res.json(resultado);
    } catch (error: any) {
      console.error('Erro ao buscar resumo de vendas no Nomus:', error);
      res.status(error.status || 500).json({ error: error.status ? error.message : 'Erro ao buscar dados do Nomus', details: error.message });
    }
  });

  app.get('/api/vendas/ranking/pdf', async (req, res) => {
    try {
      const periodo = (req.query.periodo as string) || 'mes';
      if (!['dia', 'semana', 'mes'].includes(periodo)) {
        return res.status(400).json({ error: 'periodo inválido (use dia, semana ou mes)' });
      }
      const mes = validarMesQuery(req.query.mes);
      const { ranking, atualizadoEm } = await getRankingVendedores(periodo as Periodo, mes);

      const doc = new PDFDocument({ margin: 40, size: 'A4', bufferPages: true });
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="ranking-vendedores-${mes || periodo}.pdf"`);
      doc.pipe(res);
      gerarPdfRankingVendedores(doc, {
        periodoRotulo: rotuloPeriodo(periodo as Periodo, mes),
        ranking,
        atualizadoEm: new Date(atualizadoEm).toLocaleString('pt-BR'),
      });
      doc.end();
    } catch (error: any) {
      console.error('Erro ao gerar PDF do ranking de vendedores:', error);
      res.status(error.status || 500).json({ error: error.status ? error.message : 'Erro ao gerar PDF', details: error.message });
    }
  });

  app.get('/api/vendas/resumo/pdf', async (req, res) => {
    try {
      const periodo = (req.query.periodo as string) || 'mes';
      if (!['dia', 'semana', 'mes'].includes(periodo)) {
        return res.status(400).json({ error: 'periodo inválido (use dia, semana ou mes)' });
      }
      const mes = validarMesQuery(req.query.mes);
      const resumo = await getResumoVendas(periodo as Periodo, mes);

      const doc = new PDFDocument({ margin: 40, size: 'A4', bufferPages: true });
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="painel-vendas-${mes || periodo}.pdf"`);
      doc.pipe(res);
      gerarPdfResumoVendas(doc, {
        periodoRotulo: rotuloPeriodo(periodo as Periodo, mes),
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
  });
}

startServer();
