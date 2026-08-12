// Desenha o relatório de Planejamento da Produção (PCP) num PDFDocument já
// criado — ver server.ts, GET /api/producao/planejamento/pdf. Mesmo padrão
// visual dos outros relatórios (pdfRankingVendedores.ts).

import PDFDocument from 'pdfkit';
import { ItemPlanejamentoProducao } from './src/types';

type PDFDoc = InstanceType<typeof PDFDocument>;

function truncar(doc: PDFDoc, texto: string, largura: number): string {
  if (doc.widthOfString(texto) <= largura) return texto;
  let cortado = texto;
  while (cortado.length > 1 && doc.widthOfString(cortado + '…') > largura) {
    cortado = cortado.slice(0, -1);
  }
  return cortado + '…';
}

function formatarDataBr(dataIso: string): string {
  const [ano, mes, dia] = dataIso.split('-');
  return `${dia}/${mes}/${ano}`;
}

function parseValorBr(valor: string | undefined): number {
  if (!valor) return 0;
  const numero = Number(valor.replace(/\./g, '').replace(',', '.'));
  return Number.isFinite(numero) ? numero : 0;
}

function formatarMoeda(v: number): string {
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 2 });
}

const COLUNAS: { titulo: string; largura: number; alinhamento: 'left' | 'right' | 'center' }[] = [
  { titulo: 'OS', largura: 75, alinhamento: 'left' },
  { titulo: 'Pedido', largura: 65, alinhamento: 'left' },
  { titulo: 'Produto', largura: 185, alinhamento: 'left' },
  { titulo: 'Quantidade', largura: 65, alinhamento: 'right' },
  { titulo: 'Valor', largura: 75, alinhamento: 'right' },
  { titulo: 'Data', largura: 50, alinhamento: 'right' },
];

interface GerarPdfParams {
  periodoRotulo: string;
  itens: ItemPlanejamentoProducao[];
  atualizadoEm: string;
}

export function gerarPdfPlanejamentoProducao(doc: PDFDoc, { periodoRotulo, itens, atualizadoEm }: GerarPdfParams) {
  const margemX = doc.page.margins.left;
  const margemSuperior = doc.page.margins.top;
  const margemInferior = doc.page.margins.bottom;
  const larguraUtil = doc.page.width - margemX - doc.page.margins.right;

  doc.fontSize(18).font('Helvetica-Bold').fillColor('#000').text('Planejamento da Produção', margemX, margemSuperior);
  doc.fontSize(11).font('Helvetica').fillColor('#555').text(`Período: ${periodoRotulo}`, margemX, doc.y + 4);
  doc.fontSize(9).fillColor('#888').text(`Gerado em ${atualizadoEm}`, margemX, doc.y + 2);
  doc.fontSize(9).fillColor('#888').text('Ordens de serviço agendadas no calendário — dado do Apontamento de Produção.', margemX, doc.y + 2);

  const valorTotal = itens.reduce((soma, item) => soma + parseValorBr(item.valorTotal), 0);
  const atrasadas = itens.filter((i) => i.atrasado).length;
  doc.fontSize(10).font('Helvetica-Bold').fillColor('#000').text(
    `${itens.length} ordem${itens.length === 1 ? '' : 's'} agendada${itens.length === 1 ? '' : 's'} · ${formatarMoeda(valorTotal)}${atrasadas > 0 ? ` · ${atrasadas} atrasada${atrasadas === 1 ? '' : 's'}` : ''}`,
    margemX,
    doc.y + 8
  );

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

  if (itens.length === 0) {
    doc.fontSize(10).fillColor('#888').text('Nenhuma ordem agendada nesse período.', margemX, y);
    return;
  }

  const ordenados = [...itens].sort((a, b) => a.data.localeCompare(b.data));

  ordenados.forEach((item) => {
    if (y + alturaLinha > doc.page.height - margemInferior) {
      doc.addPage();
      y = margemSuperior;
      desenharCabecalho();
    }

    doc.fillColor(item.atrasado ? '#b91c1c' : '#000').font('Helvetica').fontSize(9);

    const valores = [
      truncar(doc, item.nomeOrdem, COLUNAS[0].largura - 4),
      truncar(doc, item.pedido || '—', COLUNAS[1].largura - 4),
      truncar(doc, item.produto || '—', COLUNAS[2].largura - 4),
      `${item.quantidade || '—'}${item.unidadeMedida ? ' ' + item.unidadeMedida : ''}`,
      item.valorTotal ? `R$ ${item.valorTotal}` : '—',
      formatarDataBr(item.data),
    ];

    let x = margemX;
    COLUNAS.forEach((col, i) => {
      doc.text(valores[i], x, y, { width: col.largura, align: col.alinhamento, lineBreak: false });
      x += col.largura;
    });
    y += alturaLinha;
  });
}
