import type { TabType } from './types';

export const MODULOS = [
  { id: 'informativos', nome: 'Informativos Internos' },
  { id: 'comunicados', nome: 'Comunicados & Feed' },
  { id: 'documentos', nome: 'Documentos & NRs' },
  { id: 'servicos', nome: 'Meus Chamados' },
  { id: 'pessoas', nome: 'Diretório de Pessoas / RH' },
  { id: 'chat', nome: 'Chat Interno' },
  { id: 'departamentos', nome: 'Departamentos & Áreas' },
  { id: 'ia-assistente', nome: 'Ideias e Sugestões' },
  { id: 'vendas', nome: 'Dashboard de Vendas' },
  { id: 'financeiro', nome: 'Dashboard Financeiro' },
  { id: 'producao', nome: 'Produção' },
  { id: 'gestao', nome: 'Dashboard de Gestão' },
] as const satisfies ReadonlyArray<{ id: TabType; nome: string }>;

export type ModuloId = (typeof MODULOS)[number]['id'];
export const TODOS_MODULOS: ModuloId[] = MODULOS.map((modulo) => modulo.id);

export function moduloValido(valor: unknown): valor is ModuloId {
  return typeof valor === 'string' && TODOS_MODULOS.includes(valor as ModuloId);
}
