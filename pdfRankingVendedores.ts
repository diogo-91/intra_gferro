// Desenha o Ranking de Vendedores num PDFDocument já criado (ver server.ts,
// GET /api/vendas/ranking/pdf) — mesmo padrão do projeto irmão
// (GFERO - APONTAMENTO PRODUCAO/server/relatorioProducaoPdf.js): client e
// server nunca compartilham módulo de formatação, cada um tem o seu.

import PDFDocument from 'pdfkit';
import { VendedorRanking } from './nomus';

type PDFDoc = InstanceType<typeof PDFDocument>;

function formatarMoeda(v: number): string {
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 });
}

function formatarArea(v: number): string {
  return `${v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} m²`;
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
  { titulo: 'Vendedor', largura: 220, alinhamento: 'left' },
  { titulo: 'Total Vendido', largura: 100, alinhamento: 'right' },
  { titulo: 'Área Vendida', largura: 90, alinhamento: 'right' },
  { titulo: 'Pedidos', largura: 60, alinhamento: 'right' },
];

interface GerarPdfParams {
  periodoRotulo: string;
  ranking: VendedorRanking[];
  atualizadoEm: string;
}

export function gerarPdfRankingVendedores(doc: PDFDoc, { periodoRotulo, ranking, atualizadoEm }: GerarPdfParams) {
  const margemX = doc.page.margins.left;
  const margemSuperior = doc.page.margins.top;
  const margemInferior = doc.page.margins.bottom;
  const larguraUtil = doc.page.width - margemX - doc.page.margins.right;

  doc.fontSize(18).font('Helvetica-Bold').fillColor('#000').text('Ranking de Vendedores', margemX, margemSuperior);
  doc.fontSize(11).font('Helvetica').fillColor('#555').text(`Período: ${periodoRotulo}`, margemX, doc.y + 4);
  doc.fontSize(9).fillColor('#888').text(`Atualizado em ${atualizadoEm}`, margemX, doc.y + 2);
  doc.fontSize(9).fillColor('#888').text('Valores somados a partir dos pedidos do Nomus.', margemX, doc.y + 2);

  let y = doc.y + 16;
  const alturaLinha = 20;

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

  if (ranking.length === 0) {
    doc.fontSize(10).fillColor('#888').text('Nenhum vendedor encontrado nesse período.', margemX, y);
    return;
  }

  ranking.forEach((v, index) => {
    if (y + alturaLinha > doc.page.height - margemInferior) {
      doc.addPage();
      y = margemSuperior;
      desenharCabecalho();
    }

    doc.fillColor('#000').font('Helvetica').fontSize(9);

    const valores = [
      String(index + 1),
      truncar(doc, v.nome, COLUNAS[1].largura - 4),
      formatarMoeda(v.valorTotal),
      formatarArea(v.metrosQuadrados),
      formatarInteiro(v.pedidos),
    ];

    let x = margemX;
    COLUNAS.forEach((col, i) => {
      doc.text(valores[i], x, y, { width: col.largura, align: col.alinhamento, lineBreak: false });
      x += col.largura;
    });
    y += alturaLinha;
  });
}
