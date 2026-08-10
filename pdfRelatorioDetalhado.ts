// Desenha o Relatório Detalhado do dia (Entrou no Caixa / Saiu do Caixa /
// Composição da Matéria Prima) num PDFDocument já criado — ver server.ts,
// GET /api/financeiro/relatorio-detalhado/pdf. Mesmo padrão de
// pdfRelatorioFinanceiro.ts.

import PDFDocument from 'pdfkit';
import { ContaConcluida } from './src/types';
import { ItemComposicaoMateriaPrima } from './src/data/composicaoMateriaPrima';

type PDFDoc = InstanceType<typeof PDFDocument>;

function formatarMoeda(v: number): string {
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 });
}

function truncar(doc: PDFDoc, texto: string, largura: number): string {
  if (doc.widthOfString(texto) <= largura) return texto;
  let cortado = texto;
  while (cortado.length > 1 && doc.widthOfString(cortado + '…') > largura) {
    cortado = cortado.slice(0, -1);
  }
  return cortado + '…';
}

const COLUNAS_MOVIMENTACAO: { titulo: string; largura: number; alinhamento: 'left' | 'right' }[] = [
  { titulo: 'Pessoa', largura: 260, alinhamento: 'left' },
  { titulo: 'Categoria', largura: 195, alinhamento: 'left' },
  { titulo: 'Valor', largura: 60, alinhamento: 'right' },
];

interface GerarPdfParams {
  diaRotulo: string;
  recebido: ContaConcluida[];
  totalRecebido: number;
  pago: ContaConcluida[];
  totalPago: number;
  valorMateriaPrima: number;
  composicao: ItemComposicaoMateriaPrima[];
  atualizadoEm: string;
}

export function gerarPdfRelatorioDetalhado(
  doc: PDFDoc,
  { diaRotulo, recebido, totalRecebido, pago, totalPago, valorMateriaPrima, composicao, atualizadoEm }: GerarPdfParams
) {
  const margemX = doc.page.margins.left;
  const margemSuperior = doc.page.margins.top;
  const margemInferior = doc.page.margins.bottom;
  const larguraUtil = doc.page.width - margemX - doc.page.margins.right;

  doc.fontSize(18).font('Helvetica-Bold').fillColor('#000').text('Relatório Detalhado', margemX, margemSuperior);
  doc.fontSize(11).font('Helvetica').fillColor('#555').text(`Dia: ${diaRotulo}`, margemX, doc.y + 4);
  doc.fontSize(9).fillColor('#888').text(`Atualizado em ${atualizadoEm}`, margemX, doc.y + 2);

  // KPIs — Entrou / Saiu / Matéria Prima (Meta), lado a lado.
  let y = doc.y + 16;
  const larguraCard = larguraUtil / 3 - 8;
  const kpis: { titulo: string; valor: string; cor: string }[] = [
    { titulo: 'Entrou no Caixa', valor: formatarMoeda(totalRecebido), cor: '#059669' },
    { titulo: 'Saiu do Caixa', valor: formatarMoeda(totalPago), cor: '#dc2626' },
    { titulo: 'Matéria Prima (Meta 70%)', valor: formatarMoeda(valorMateriaPrima), cor: '#d97706' },
  ];
  kpis.forEach((kpi, i) => {
    const x = margemX + i * (larguraCard + 12);
    doc.roundedRect(x, y, larguraCard, 48, 4).strokeColor('#ddd').lineWidth(0.75).stroke();
    doc.fontSize(8).font('Helvetica').fillColor('#888').text(kpi.titulo, x + 8, y + 8, { width: larguraCard - 16 });
    doc.fontSize(13).font('Helvetica-Bold').fillColor(kpi.cor).text(kpi.valor, x + 8, y + 24, { width: larguraCard - 16 });
  });
  y += 48 + 22;

  // ---- Composição da Matéria Prima ----
  // Normaliza pra somar 100% (as % informadas podem não fechar exato),
  // mesma lógica da tela (ver RelatorioDetalhadoConteudo em ProgramacaoFinanceira.tsx).
  const somaPct = composicao.reduce((s, item) => s + item.pct, 0);

  if (y + 60 > doc.page.height - margemInferior) {
    doc.addPage();
    y = margemSuperior;
  }
  doc.fontSize(13).font('Helvetica-Bold').fillColor('#000').text('Composição da Matéria Prima', margemX, y);
  doc.fontSize(8).font('Helvetica').fillColor('#888').text('Fatia fixa aplicada sobre o valor Meta do KPI Matéria Prima (não vem do Nomus)', margemX, doc.y + 2);
  y = doc.y + 10;

  if (valorMateriaPrima === 0 || somaPct === 0) {
    doc.fontSize(10).fillColor('#888').text('Sem valor de Matéria Prima neste dia.', margemX, y);
    y = doc.y + 16;
  } else {
    const larguraColComp = larguraUtil / 3;
    doc.font('Helvetica-Bold').fontSize(9).fillColor('#555');
    ['Material', '%', 'Valor'].forEach((titulo, i) => {
      const alinhamento = i === 0 ? 'left' : 'right';
      doc.text(titulo, margemX + i * larguraColComp, y, { width: larguraColComp, align: alinhamento, lineBreak: false });
    });
    y += 14;
    doc.moveTo(margemX, y).lineTo(margemX + larguraUtil, y).strokeColor('#ccc').lineWidth(0.5).stroke();
    y += 6;

    doc.font('Helvetica').fontSize(9).fillColor('#000');
    composicao.forEach((item) => {
      const pctExibido = (item.pct / somaPct) * 100;
      const valor = (valorMateriaPrima * pctExibido) / 100;
      const linha = [item.nome, `${pctExibido.toFixed(1)}%`, formatarMoeda(valor)];
      linha.forEach((texto, i) => {
        const alinhamento = i === 0 ? 'left' : 'right';
        doc.text(texto, margemX + i * larguraColComp, y, { width: larguraColComp, align: alinhamento, lineBreak: false });
      });
      y += 16;
    });
    y += 18;
  }

  // ---- Entrou no Caixa / Saiu do Caixa ----
  function desenharTabelaMovimentacao(titulo: string, contas: ContaConcluida[], corValor: string) {
    if (y + 60 > doc.page.height - margemInferior) {
      doc.addPage();
      y = margemSuperior;
    }

    doc.fontSize(13).font('Helvetica-Bold').fillColor('#000').text(titulo, margemX, y);
    y = doc.y + 10;

    function desenharCabecalho() {
      let x = margemX;
      doc.font('Helvetica-Bold').fontSize(9).fillColor('#555');
      for (const col of COLUNAS_MOVIMENTACAO) {
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
      doc.fontSize(10).fillColor('#888').text('Nada nesse dia.', margemX, y);
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
      const valores = [truncar(doc, c.pessoa, COLUNAS_MOVIMENTACAO[0].largura - 4), truncar(doc, c.categoria, COLUNAS_MOVIMENTACAO[1].largura - 4), formatarMoeda(c.valor)];

      let x = margemX;
      COLUNAS_MOVIMENTACAO.forEach((col, i) => {
        doc.fillColor(i === 2 ? corValor : '#000');
        doc.text(valores[i], x, y, { width: col.largura, align: col.alinhamento, lineBreak: false });
        x += col.largura;
      });
      y += alturaLinha;
    });

    y += 18;
  }

  desenharTabelaMovimentacao('Entrou no Caixa', recebido, '#059669');
  desenharTabelaMovimentacao('Saiu do Caixa', pago, '#dc2626');
}
