// Fechamento comercial conferido e informado pela GFERRO.
// Agosto/2026 e um periodo encerrado: estes valores nao devem ser
// recalculados pelo Nomus nem alterados pelo botao "Atualizar dados".

export interface FechamentoVendedorAgosto2026 {
  nome: string;
  pedidosCodigos: string[];
  valorTotal: number;
  valorRecebido: number;
  percentualIndicado: number | null;
  comissaoVendas: number | null;
  quantidadeParafusos: number;
  valorParafusos: number;
  valorFrete: number;
  comissaoFretes: number | null;
  observacao?: string;
}

const pedidos = (lista: string) => lista ? lista.split(',').map((codigo) => codigo.trim()) : [];

export const MES_FECHAMENTO_VENDAS_AGOSTO_2026 = '2026-08';
export const ATUALIZADO_EM_FECHAMENTO_AGOSTO_2026 = '2026-09-01T02:59:59.000Z';

export const FECHAMENTO_VENDAS_AGOSTO_2026: readonly FechamentoVendedorAgosto2026[] = [
  { nome: 'Paulo', pedidosCodigos: [], valorTotal: 0, valorRecebido: 0, percentualIndicado: null, comissaoVendas: 0, quantidadeParafusos: 0, valorParafusos: 0, valorFrete: 0, comissaoFretes: 0 },
  { nome: 'SAMUEL WOLFGAN SILVA', pedidosCodigos: pedidos('PD1442,PD1445,PD1454,PD1465,PD1472,PD1480,PD1508,PD1509,PD1527,PD1570,PD1573,PD1576,PD1582,PD1608,PD1618,PD1621,PD1629,PD1644,PD1645,PD1651,PD1652,PD1659,PD1661,PD1670,PD1692,PD1693,PD1695,PD1702'), valorTotal: 194055.97, valorRecebido: 134991.72, percentualIndicado: 78, comissaoVendas: 2699.83, quantidadeParafusos: 2837, valorParafusos: 3380.65, valorFrete: 2787.16, comissaoFretes: 192.50 },
  { nome: 'SUMAIA LUCENA', pedidosCodigos: pedidos('PD1441,PD1448,PD1450,PD1491,PD1495,PD1514,PD1537,PD1541,PD1566,PD1569,PD1585,PD1594,PD1601,PD1609,PD1616,PD1622,PD1626,PD1631,PD593,PD1635,PD1668,PD1689,PD1694,PD1703'), valorTotal: 199331.48, valorRecebido: 115240.90, percentualIndicado: 69, comissaoVendas: 2304.82, quantidadeParafusos: 2781, valorParafusos: 3642.38, valorFrete: 3927.55, comissaoFretes: 226.50, observacao: '“PD593” aparece dessa forma na imagem; pode ser PD1593.' },
  { nome: 'Elson Marcelo Braga da Silva', pedidosCodigos: pedidos('PD1436,PD1440,PD1452,PD1453,PD1457,PD1497,PD1502,PD1505,PD1518,PD1521,PD1540,PD1542,PD1545,PD1547,PD1548,PD1550,PD1567,PD1592,PD1602,PD1604,PD1611,PD1617,PD1620,PD1636,PD1640,PD1641,PD1649,PD1658,PD1660,PD1663,PD1678'), valorTotal: 147558.42, valorRecebido: 114706.48, percentualIndicado: 72, comissaoVendas: 2294.13, quantidadeParafusos: 3041, valorParafusos: 3395.21, valorFrete: 2354.09, comissaoFretes: 193 },
  { nome: 'Andreza Soares Ribeiro de Andrade', pedidosCodigos: pedidos('PD1438,PD1439,PD1443,PD1455,PD1456,PD1485,PD1504,PD1512,PD1529,PD1534,PD1543,PD1557,PD1591,PD1625,PD1676'), valorTotal: 71039.07, valorRecebido: 54557.72, percentualIndicado: 78, comissaoVendas: 1666.73, quantidadeParafusos: 1528, valorParafusos: 1846.50, valorFrete: 1400, comissaoFretes: 123.50 },
  { nome: 'EDER PULLHEIS', pedidosCodigos: pedidos('PD641,PD1475,PD1476,PD1477,PD1578,PD1484,PD1499,PD1472,PD1510,PD1516,PD1523,PD1538,PD1541,PD1575,PD1584,PD1596,PD1624,PD1687,PD1477,PD1701'), valorTotal: 221457.18, valorRecebido: 158766.86, percentualIndicado: 65, comissaoVendas: 3175.34, quantidadeParafusos: 6915, valorParafusos: 9189.30, valorFrete: 1560, comissaoFretes: 128, observacao: 'Alguns pedidos estão pouco nítidos na imagem original e precisam ser conferidos.' },
  { nome: 'Lucas', pedidosCodigos: [], valorTotal: 0, valorRecebido: 0, percentualIndicado: null, comissaoVendas: 0, quantidadeParafusos: 0, valorParafusos: 0, valorFrete: 0, comissaoFretes: 0 },
  { nome: 'Myrene Aparecida da Silva', pedidosCodigos: pedidos('PD1447,PD1452,PD1454,PD1470,PD1471,PD1473,PD1483,PD1500,PD1503,PD1513,PD1528,PD1558,PD1546,PD1559,PD1562,PD1586,PD1593,PD1610,PD1647,PD1674,PD1684,PD1685,PD1686'), valorTotal: 132966.76, valorRecebido: 83032.82, percentualIndicado: 69, comissaoVendas: 1660.66, quantidadeParafusos: 1983, valorParafusos: 2641.75, valorFrete: 2100, comissaoFretes: 160.50 },
  { nome: 'REBECA GONÇALVES', pedidosCodigos: pedidos('PD1456,PD1459,PD1474,PD1498'), valorTotal: 46884.36, valorRecebido: 6002.36, percentualIndicado: 52, comissaoVendas: 121.25, quantidadeParafusos: 463, valorParafusos: 686, valorFrete: 250, comissaoFretes: 22 },
  { nome: 'Ana Caroline Paz Basseto', pedidosCodigos: pedidos('PD1583,PD1643,PD1662,PD1655,PD1672,PD1675'), valorTotal: 32183.58, valorRecebido: 27782.07, percentualIndicado: 79, comissaoVendas: 555.64, quantidadeParafusos: 953, valorParafusos: 1182.50, valorFrete: 420, comissaoFretes: 36 },
  { nome: 'Telma Carlos Gomes de Camargo', pedidosCodigos: pedidos('PD1507,PD1519,PD1605,PD1628,PD1654'), valorTotal: 26622.37, valorRecebido: 27296, percentualIndicado: 100, comissaoVendas: 545.92, quantidadeParafusos: 412, valorParafusos: 491.40, valorFrete: 220, comissaoFretes: 20 },
  { nome: 'MARIA DE FATIMA DE SOUZA CAMPOS', pedidosCodigos: pedidos('PD1579,PD1581,PD1615,PD1688,PD1706'), valorTotal: 38152.05, valorRecebido: 25731.48, percentualIndicado: 92, comissaoVendas: 514.63, quantidadeParafusos: 2147, valorParafusos: 2578.80, valorFrete: 880, comissaoFretes: 70 },
  { nome: 'Vanessa Pereira Bezerra', pedidosCodigos: pedidos('PD1526,PD1552,PD1612,PD1614,PD1633,PD1646'), valorTotal: 43048.59, valorRecebido: 14275.56, percentualIndicado: 50, comissaoVendas: null, quantidadeParafusos: 2301, valorParafusos: 2323.95, valorFrete: 250, comissaoFretes: 22 },
  { nome: 'JAYMES JANOLLA', pedidosCodigos: pedidos('PD1466,PD1482,PD1488,PD1353,PD1524,PD1530,PD1535,PD1544,PD1555,PD1556,PD1568,PD1577,PD1595,PD1597,PD1600,PD1603,PD1656,PD1664,PD1667,PD1671,PD1673,PD1677,PD1681,PD1682,PD1683,PD1696,PD1707'), valorTotal: 234238.28, valorRecebido: 163299.32, percentualIndicado: 62, comissaoVendas: 4898.98, quantidadeParafusos: 4373, valorParafusos: 4410.07, valorFrete: 2110.50, comissaoFretes: 154.50 },
  { nome: 'MARCELO BUGANZA JUNIOR', pedidosCodigos: pedidos('PD1437,PD1444,PD1469,PD1493,PD1531,PD1539,PD1558,PD1598,PD1613,PD1623,PD1657,PD1666,PD1690,PD1697'), valorTotal: 77980.86, valorRecebido: 42451.14, percentualIndicado: 68, comissaoVendas: 849.02, quantidadeParafusos: 717, valorParafusos: 932.48, valorFrete: 1570, comissaoFretes: 140 },
  { nome: 'Marcos Felipe Alcântara Sanson', pedidosCodigos: pedidos('PD1486'), valorTotal: 2743.75, valorRecebido: 2743.75, percentualIndicado: 100, comissaoVendas: 54.88, quantidadeParafusos: 141, valorParafusos: 176.25, valorFrete: 100, comissaoFretes: null },
  { nome: 'RAFAEL LUIZ AURO', pedidosCodigos: pedidos('PD1478,PD1489,PD1500,PD1517,PD1520,PD1563,PD1580,PD1588,PD1599,PD1606,PD1619,PD1634,PD1642,PD1643,PD1680'), valorTotal: 112594.62, valorRecebido: 83566.20, percentualIndicado: 78, comissaoVendas: 1671.32, quantidadeParafusos: 1439, valorParafusos: 1858.15, valorFrete: 834, comissaoFretes: 59 },
  { nome: 'Laís da Silva Gomes', pedidosCodigos: pedidos('PD1490,PD1501,PD1559,PD1564,PD1607'), valorTotal: 18350.12, valorRecebido: 16383.96, percentualIndicado: 90, comissaoVendas: 327.68, quantidadeParafusos: 258, valorParafusos: 354.50, valorFrete: 400, comissaoFretes: 27 },
] as const;

export const TOTAIS_FECHAMENTO_VENDAS_AGOSTO_2026 = {
  totalVendas: 1599207.46,
  valorRecebido: 1070828.34,
  vendedoresAtivos: 16,
  vendedoresSemVendas: ['Paulo', 'Lucas'],
} as const;

export function periodoEhFechamentoAgosto2026(periodo: string, mes?: string, intervalo?: unknown): boolean {
  return periodo === 'mes' && mes === MES_FECHAMENTO_VENDAS_AGOSTO_2026 && intervalo == null;
}
