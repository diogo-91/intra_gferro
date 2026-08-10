// Desenha o Resumo de Vendas (Painel de Vendas) num PDFDocument já criado
// (ver server.ts, GET /api/vendas/resumo/pdf) — mesmo padrão de
// pdfRankingVendedores.ts.

import PDFDocument from 'pdfkit';
import { ResumoVendas } from './nomus';

type PDFDoc = InstanceType<typeof PDFDocument>;

function formatarMoeda(v: number): string {
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 });
}

function formatarNumero(v: number): string {
  return v.toLocaleString('pt-BR', { maximumFractionDigits: 2 });
}

function formatarInteiro(v: number): string {
  return v.toLocaleString('pt-BR');
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

const COLUNAS: { titulo: string; largura: number; alinhamento: 'left' | 'right' | 'center' }[] = [
  { titulo: '#', largura: 28, alinhamento: 'center' },
  { titulo: 'Produto', largura: 260, alinhamento: 'left' },
  { titulo: 'Quantidade', largura: 90, alinhamento: 'right' },
  { titulo: 'Valor Vendido', largura: 100, alinhamento: 'right' },
];

interface GerarPdfParams {
  periodoRotulo: string;
  resumo: ResumoVendas;
  atualizadoEm: string;
}

export function gerarPdfResumoVendas(doc: PDFDoc, { periodoRotulo, resumo, atualizadoEm }: GerarPdfParams) {
  const margemX = doc.page.margins.left;
  const margemSuperior = doc.page.margins.top;
  const margemInferior = doc.page.margins.bottom;
  const larguraUtil = doc.page.width - margemX - doc.page.margins.right;

  doc.fontSize(18).font('Helvetica-Bold').fillColor('#000').text('Painel de Vendas', margemX, margemSuperior);
  doc.fontSize(11).font('Helvetica').fillColor('#555').text(`Período: ${periodoRotulo}`, margemX, doc.y + 4);
  doc.fontSize(9).fillColor('#888').text(`Atualizado em ${atualizadoEm}`, margemX, doc.y + 2);

  // Cards de KPI, lado a lado, em 4 colunas.
  let y = doc.y + 16;
  const larguraCard = larguraUtil / 4 - 8;
  const kpis: { titulo: string; valor: string }[] = [
    { titulo: 'Total de Vendas', valor: formatarMoeda(resumo.totalVendas) },
    { titulo: 'Pedidos', valor: formatarInteiro(resumo.totalPedidos) },
    { titulo: 'Área Vendida', valor: `${formatarNumero(resumo.totalMetrosQuadrados)} m²` },
    { titulo: 'Vendedores Ativos', valor: formatarInteiro(resumo.vendedoresAtivos) },
  ];

  kpis.forEach((kpi, i) => {
    const x = margemX + i * (larguraCard + 10.67);
    doc.roundedRect(x, y, larguraCard, 48, 4).strokeColor('#ddd').lineWidth(0.75).stroke();
    doc.fontSize(8).font('Helvetica').fillColor('#888').text(kpi.titulo, x + 8, y + 8, { width: larguraCard - 16 });
    doc.fontSize(13).font('Helvetica-Bold').fillColor('#000').text(kpi.valor, x + 8, y + 24, { width: larguraCard - 16 });
  });

  y += 48 + 20;

  doc.fontSize(13).font('Helvetica-Bold').fillColor('#000').text('Vendas por Produto', margemX, y);
  y = doc.y + 10;

  const alturaLinha = 18;

  function desenharCabecalho() {
    let x = margemX;
    doc.font('Helvetica-Bold').fontSize(9).fillColor('#555');
    for (const col of COLUNAS) {
      doc.text(col.titulo, x, y, { width: col.largura, align: col.alinhamento, lineBreak: false });
      x += col.largura;
    }
    y += 14;
    doc.moveTo(margemX, y).lineTo(margemX + larguraUtil, y).strokeColor('#ccc').lineWidth(0.5).stroke();
    y += 6;
    doc.fillColor('#000').font('Helvetica').fontSize(9);
  }

  desenharCabecalho();

  if (resumo.produtos.length === 0) {
    doc.fontSize(10).fillColor('#888').text('Nenhuma venda de produto encontrada nesse período.', margemX, y);
    return;
  }

  resumo.produtos.forEach((p, index) => {
    if (y + alturaLinha > doc.page.height - margemInferior) {
      doc.addPage();
      y = margemSuperior;
      desenharCabecalho();
    }

    doc.fillColor('#000').font('Helvetica').fontSize(9);

    const quantidadeTexto = p.unidade ? `${formatarNumero(p.quantidade)} ${p.unidade}` : formatarNumero(p.quantidade);
    const valores = [
      String(index + 1),
      truncar(doc, p.nome, COLUNAS[1].largura - 4),
      quantidadeTexto,
      formatarMoeda(p.valorTotal),
    ];

    let x = margemX;
    COLUNAS.forEach((col, i) => {
      doc.text(valores[i], x, y, { width: col.largura, align: col.alinhamento, lineBreak: false });
      x += col.largura;
    });
    y += alturaLinha;
  });
}
