import type { TabType } from './types';
import { LOJAS, type LojaId } from './data/vendedorLoja';

export type SubmoduloId = 'vendas:geral' | 'vendas:gestao' | 'vendas:ranking' | `vendas:loja:${LojaId}`;

export interface Submodulo {
  id: SubmoduloId;
  nome: string;
}

export const SUBMODULOS_VENDAS: readonly Submodulo[] = [
  { id: 'vendas:geral', nome: 'Painel de Vendas — visão geral' },
  { id: 'vendas:gestao', nome: 'Gestão' },
  { id: 'vendas:ranking', nome: 'Ranking de Vendedores' },
  ...LOJAS.map((loja) => ({ id: `vendas:loja:${loja.id}` as SubmoduloId, nome: loja.nome })),
];

export const MODULOS = [
  { id: 'informativos', nome: 'Informativos Internos' },
  { id: 'comunicados', nome: 'Comunicados & Feed' },
  { id: 'documentos', nome: 'Documentos & NRs' },
  { id: 'servicos', nome: 'Meus Chamados' },
  { id: 'pessoas', nome: 'Diretório de Pessoas / RH' },
  { id: 'chat', nome: 'Chat Interno' },
  { id: 'departamentos', nome: 'Departamentos & Áreas' },
  { id: 'ia-assistente', nome: 'Ideias e Sugestões' },
  { id: 'vendas', nome: 'Dashboard de Vendas', submodulos: SUBMODULOS_VENDAS },
  { id: 'financeiro', nome: 'Dashboard Financeiro' },
  { id: 'producao', nome: 'Produção' },
  { id: 'gestao', nome: 'Dashboard de Gestão' },
] as const satisfies ReadonlyArray<{ id: TabType; nome: string; submodulos?: readonly Submodulo[] }>;

export type ModuloId = (typeof MODULOS)[number]['id'];
export const TODOS_MODULOS: ModuloId[] = MODULOS.map((modulo) => modulo.id);
export const TODOS_SUBMODULOS: SubmoduloId[] = MODULOS.flatMap((modulo) => 'submodulos' in modulo ? [...modulo.submodulos] : []).map((submodulo) => submodulo.id);

export function moduloValido(valor: unknown): valor is ModuloId {
  return typeof valor === 'string' && TODOS_MODULOS.includes(valor as ModuloId);
}

export function submoduloValido(valor: unknown): valor is SubmoduloId {
  return typeof valor === 'string' && TODOS_SUBMODULOS.includes(valor as SubmoduloId);
}

export function submoduloLojaVendas(lojaId: LojaId): SubmoduloId {
  return `vendas:loja:${lojaId}`;
}
