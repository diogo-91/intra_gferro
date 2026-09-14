import assert from 'node:assert/strict';
import { test } from 'node:test';
import { calcularMetasSemanais, semanasDoMes } from './metasSemanais';

const semanas = semanasDoMes(2026, 8);
const calcular = (dia: number, realizados?: number[], metaMensal = 700000) => calcularMetasSemanais({
  metaMensal, semanas, realizados, ano: 2026, mes: 8, hoje: new Date(2026, 8, dia),
});
const centavos = (valores: number[]) => valores.reduce((total, valor) => total + Math.round(valor * 100), 0);

test('preserva o rateio inicial por dias úteis antes do primeiro encerramento', () => {
  assert.deepEqual(semanas.map((semana) => semana.diasTrabalhados), [5, 6, 6, 6, 3]);
  const metas = calcular(6, [75761.46]);
  assert.equal(metas[0], 134615.38);
  assert.equal(centavos(metas), 70000000);
  assert.deepEqual(metas, calcular(1));
});

test('distribui o saldo da primeira semana igualmente entre as quatro restantes', () => {
  const metas = calcular(7, [75761.46]);
  assert.deepEqual(metas, [134615.38, 156059.64, 156059.64, 156059.63, 156059.63]);
  assert.equal(centavos(metas.slice(1)) + 7576146, 70000000);
});

test('recalcula após o segundo encerramento sem duplicar o saldo e preserva metas anteriores', () => {
  const metas = calcular(14, [75761.46, 37295.36, 30235.21]);
  assert.deepEqual(metas, [134615.38, 156059.64, 195647.73, 195647.73, 195647.72]);
  assert.equal(centavos(metas.slice(2)) + 7576146 + 3729536, 70000000);
  // Vendas da semana em andamento não mudam sua própria meta.
  assert.deepEqual(metas, calcular(20, [75761.46, 37295.36, 100000]));
});

test('aplica o exemplo de 100 mil restantes divididos em quatro semanas', () => {
  assert.deepEqual(calcular(7, [0], 100000).slice(1), [25000, 25000, 25000, 25000]);
});

test('considera vendas acima do planejado e limita o saldo mínimo a zero', () => {
  assert.deepEqual(calcular(7, [200000]).slice(1), [125000, 125000, 125000, 125000]);
  assert.deepEqual(calcular(7, [800000]).slice(1), [0, 0, 0, 0]);
  assert.deepEqual(calcular(14, [0, 0], 0), [0, 0, 0, 0, 0]);
});

test('não redistribui sem dados carregados ou em meses futuros', () => {
  assert.deepEqual(calcular(14), calcular(1));
  assert.deepEqual(calcular(0, [0, 0]), calcular(1));
});

test('leva todo o saldo para a última semana e mantém o histórico depois do mês', () => {
  const realizados = [100000, 100000, 100000, 100000, 50000];
  const metas = calcular(28, realizados);
  assert.equal(metas[4], 300000);
  assert.deepEqual(calcular(31, realizados), metas);
});

test('trata meses que começam no domingo e têm seis semanas', () => {
  const semanasMarco = semanasDoMes(2026, 2);
  assert.equal(semanasMarco.length, 6);
  assert.equal(semanasMarco[0].diasTrabalhados, 0);
  const metas = calcularMetasSemanais({
    metaMensal: 100.01, semanas: semanasMarco, realizados: [0],
    ano: 2026, mes: 2, hoje: new Date(2026, 2, 2),
  });
  assert.deepEqual(metas, [0, 20.01, 20, 20, 20, 20]);
  assert.equal(centavos(metas), 10001);
});
