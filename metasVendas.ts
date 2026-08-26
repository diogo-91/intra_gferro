import { mkdirSync, readFileSync, writeFileSync } from 'fs';
import path from 'path';
import { LOJAS } from './src/data/vendedorLoja';

type MetasPorMes = Record<string, Record<string, number>>;

const PASTA_DADOS = path.join(process.cwd(), 'data');
const ARQUIVO_METAS = path.join(PASTA_DADOS, 'vendas-metas-mensais.json');

function carregar(): MetasPorMes {
  try {
    return JSON.parse(readFileSync(ARQUIVO_METAS, 'utf-8')) as MetasPorMes;
  } catch {
    return {};
  }
}

function persistir(dados: MetasPorMes): void {
  mkdirSync(PASTA_DADOS, { recursive: true });
  writeFileSync(ARQUIVO_METAS, JSON.stringify(dados, null, 2), 'utf-8');
}

export function obterMetasMensais(mes: string): Record<string, number> {
  const salvas = carregar()[mes] ?? {};
  return Object.fromEntries(LOJAS.map((loja) => [
    loja.id,
    Number.isFinite(salvas[loja.id]) ? Math.max(0, salvas[loja.id]) : loja.metaVendas ?? 0,
  ]));
}

export function salvarMetasMensais(mes: string, metas: Record<string, unknown>): Record<string, number> {
  if (!/^\d{4}-\d{2}$/.test(mes)) throw Object.assign(new Error('Mês inválido. Use AAAA-MM.'), { status: 400 });
  const idsValidos = new Set(LOJAS.map((loja) => loja.id));
  const normalizadas: Record<string, number> = {};
  for (const [lojaId, valorBruto] of Object.entries(metas || {})) {
    if (!idsValidos.has(lojaId)) continue;
    const valor = Number(valorBruto);
    if (!Number.isFinite(valor) || valor < 0) {
      throw Object.assign(new Error(`Meta inválida para a unidade ${lojaId}.`), { status: 400 });
    }
    normalizadas[lojaId] = Math.round(valor * 100) / 100;
  }
  if (Object.keys(normalizadas).length === 0) {
    throw Object.assign(new Error('Informe ao menos uma meta mensal.'), { status: 400 });
  }

  const dados = carregar();
  dados[mes] = { ...obterMetasMensais(mes), ...normalizadas };
  persistir(dados);
  return dados[mes];
}
