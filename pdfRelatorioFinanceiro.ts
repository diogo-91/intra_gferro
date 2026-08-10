// Desenha o Relatório Financeiro (Planejamento Financeiro) num PDFDocument já
// criado (ver server.ts, GET /api/financeiro/relatorio/pdf) — mesmo padrão de
// pdfResumoVendas.ts/pdfRankingVendedores.ts.

import PDFDocument from 'pdfkit';
import { ResumoFinanceiro, ContaReceber, ContaPagar } from './src/types';

type PDFDoc = InstanceType<typeof PDFDocument>;

function formatarMoeda(v: number): string {
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 });
}

// "dd/mm/aaaa" -> Date local, pra ordenar as tabelas por vencimento.
function parseDataBr(data: string): Date {
  const [dia, mes, ano] = data.split('/').map(Number);
  return new Date(ano, mes - 1, dia);
}

/** Corta o texto (com "…" no fim) pra caber em `largura` pontos, na fonte/tamanho atuais do doc. */
function truncar(doc: PDFDoc, texto: string, largura: number): string {
  if (doc.widthOfString(texto) <= largura) return texto;
  let cortado = texto;
  while (cortado.length > 1 && doc.widthOfString(cortado + '…') > largura) {
    cortado = cortado.slice(0, -1);
  }
  return cortado + '…';
}

interface ContaUnificada {
  tipo: 'receber' | 'pagar';
  pessoa: string;
  categoria: string;
  valor: number;
  vencimento: string;
  vencida: boolean;
}

function unificarContas(contasReceber: ContaReceber[], contasPagar: ContaPagar[]): ContaUnificada[] {
  return [
    ...contasReceber.map((c): ContaUnificada => ({ tipo: 'receber', pessoa: c.cliente, categoria: c.categoria, valor: c.valor, vencimento: c.vencimento, vencida: c.status === 'Vencida' })),
    ...contasPagar.map((c): ContaUnificada => ({ tipo: 'pagar', pessoa: c.fornecedor, categoria: c.categoria, valor: c.valor, vencimento: c.vencimento, vencida: c.status === 'Vencida' })),
  ];
}

const COLUNAS_CONTAS: { titulo: string; largura: number; alinhamento: 'left' | 'right' | 'center' }[] = [
  { titulo: 'Tipo', largura: 55, alinhamento: 'left' },
  { titulo: 'Cliente/Fornecedor', largura: 190, alinhamento: 'left' },
  { titulo: 'Categoria', largura: 140, alinhamento: 'left' },
  { titulo: 'Vencimento', largura: 65, alinhamento: 'center' },
  { titulo: 'Valor', largura: 65, alinhamento: 'right' },
];

interface GerarPdfParams {
  periodoRotulo: string;
  resumo: ResumoFinanceiro;
  atualizadoEm: string;
}

export function gerarPdfRelatorioFinanceiro(doc: PDFDoc, { periodoRotulo, resumo, atualizadoEm }: GerarPdfParams) {
  const margemX = doc.page.margins.left;
  const margemSuperior = doc.page.margins.top;
  const margemInferior = doc.page.margins.bottom;
  const larguraUtil = doc.page.width - margemX - doc.page.margins.right;

  doc.fontSize(18).font('Helvetica-Bold').fillColor('#000').text('Relatório Financeiro', margemX, margemSuperior);
  doc.fontSize(11).font('Helvetica').fillColor('#555').text(`Período: ${periodoRotulo}`, margemX, doc.y + 4);
  doc.fontSize(9).fillColor('#888').text(`Atualizado em ${atualizadoEm}`, margemX, doc.y + 2);

  // Cards de KPI, lado a lado, em 4 colunas — mesma fórmula do "Saldo projetado" no frontend.
  const saldoProjetado = resumo.saldoMes + resumo.totalReceber - resumo.totalPagar;
  let y = doc.y + 16;
  const larguraCard = larguraUtil / 4 - 8;
  const kpis: { titulo: string; valor: string }[] = [
    { titulo: 'Saldo do mês', valor: formatarMoeda(resumo.saldoMes) },
    { titulo: 'A receber', valor: formatarMoeda(resumo.totalReceber) },
    { titulo: 'A pagar', valor: formatarMoeda(resumo.totalPagar) },
    { titulo: 'Saldo projetado', valor: formatarMoeda(saldoProjetado) },
  ];

  kpis.forEach((kpi, i) => {
    const x = margemX + i * (larguraCard + 10.67);
    doc.roundedRect(x, y, larguraCard, 48, 4).strokeColor('#ddd').lineWidth(0.75).stroke();
    doc.fontSize(8).font('Helvetica').fillColor('#888').text(kpi.titulo, x + 8, y + 8, { width: larguraCard - 16 });
    doc.fontSize(13).font('Helvetica-Bold').fillColor('#000').text(kpi.valor, x + 8, y + 24, { width: larguraCard - 16 });
  });

  y += 48 + 20;

  // Fluxo de caixa (últimos meses) — mini-tabela.
  doc.fontSize(13).font('Helvetica-Bold').fillColor('#000').text('Fluxo de Caixa', margemX, y);
  y = doc.y + 10;

  const larguraColFluxo = larguraUtil / 4;
  doc.font('Helvetica-Bold').fontSize(9).fillColor('#555');
  ['Mês', 'Receitas', 'Despesas', 'Saldo'].forEach((titulo, i) => {
    const alinhamento = i === 0 ? 'left' : 'right';
    doc.text(titulo, margemX + i * larguraColFluxo, y, { width: larguraColFluxo, align: alinhamento, lineBreak: false });
  });
  y += 14;
  doc.moveTo(margemX, y).lineTo(margemX + larguraUtil, y).strokeColor('#ccc').lineWidth(0.5).stroke();
  y += 6;

  doc.font('Helvetica').fontSize(9).fillColor('#000');
  resumo.fluxoCaixa.forEach((f) => {
    const saldo = f.receitas - f.despesas;
    const valores = [f.mes, formatarMoeda(f.receitas), formatarMoeda(f.despesas), formatarMoeda(saldo)];
    valores.forEach((valor, i) => {
      const alinhamento = i === 0 ? 'left' : 'right';
      doc.text(valor, margemX + i * larguraColFluxo, y, { width: larguraColFluxo, align: alinhamento, lineBreak: false });
    });
    y += 16;
  });

  y += 18;

  function desenharTabelaContas(titulo: string, contas: ContaUnificada[]) {
    if (y + 60 > doc.page.height - margemInferior) {
      doc.addPage();
      y = margemSuperior;
    }

    doc.fontSize(13).font('Helvetica-Bold').fillColor('#000').text(titulo, margemX, y);
    y = doc.y + 10;

    function desenharCabecalho() {
      let x = margemX;
      doc.font('Helvetica-Bold').fontSize(9).fillColor('#555');
      for (const col of COLUNAS_CONTAS) {
        doc.text(col.titulo, x, y, { width: col.largura, align: col.alinhamento, lineBreak: false });
        x += col.largura;
      }
      y += 14;
      doc.moveTo(margemX, y).lineTo(margemX + larguraUtil, y).strokeColor('#ccc').lineWidth(0.5).stroke();
      y += 6;
      doc.fillColor('#000').font('Helvetica').fontSize(9);
    }

    desenharCabecalho();

    if (contas.length === 0) {
      doc.fontSize(10).fillColor('#888').text('Nenhuma conta encontrada.', margemX, y);
      y = doc.y + 16;
      return;
    }

    const alturaLinha = 16;
    contas.forEach((c) => {
      if (y + alturaLinha > doc.page.height - margemInferior) {
        doc.addPage();
        y = margemSuperior;
        desenharCabecalho();
      }

      doc.fillColor('#000').font('Helvetica').fontSize(9);
      const valores = [
        c.tipo === 'receber' ? 'Receber' : 'Pagar',
        truncar(doc, c.pessoa, COLUNAS_CONTAS[1].largura - 4),
        truncar(doc, c.categoria, COLUNAS_CONTAS[2].largura - 4),
        c.vencimento,
        formatarMoeda(c.valor),
      ];

      let x = margemX;
      COLUNAS_CONTAS.forEach((col, i) => {
        doc.text(valores[i], x, y, { width: col.largura, align: col.alinhamento, lineBreak: false });
        x += col.largura;
      });
      y += alturaLinha;
    });

    y += 18;
  }

  const todasContas = unificarContas(resumo.contasReceber, resumo.contasPagar);
  const porVencimento = (a: ContaUnificada, b: ContaUnificada) => parseDataBr(a.vencimento).getTime() - parseDataBr(b.vencimento).getTime();

  const atrasadas = todasContas.filter((c) => c.vencida).sort(porVencimento);
  const proximosVencimentos = todasContas.filter((c) => !c.vencida).sort(porVencimento);

  desenharTabelaContas('Contas Atrasadas', atrasadas);
  desenharTabelaContas('Próximos Vencimentos', proximosVencimentos);
}
