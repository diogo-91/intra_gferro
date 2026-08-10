// Estilos e cálculos compartilhados entre a lista e o detalhe do SAC —
// centralizado aqui pra badge de status/prioridade/procedência e o cálculo
// de prazo/SLA ficarem idênticos nas duas telas.

import { SacPrioridade, SacProcedencia, SacStatus } from '../types';
import { SAC_STATUS_ABERTOS, SAC_STATUS_ENCERRADOS } from '../data/sacOpcoes';

export const SAC_STATUS_BADGE: Record<SacStatus, string> = {
  'Novo': 'bg-sky-50 text-sky-700 border-sky-200',
  'Em atendimento': 'bg-sky-50 text-sky-700 border-sky-200',
  'Em análise interna': 'bg-amber-50 text-amber-700 border-amber-200',
  'Aguardando Qualidade': 'bg-amber-50 text-amber-700 border-amber-200',
  'Aguardando Produção': 'bg-amber-50 text-amber-700 border-amber-200',
  'Aguardando Logística': 'bg-amber-50 text-amber-700 border-amber-200',
  'Aguardando Comercial': 'bg-amber-50 text-amber-700 border-amber-200',
  'Aguardando Financeiro': 'bg-amber-50 text-amber-700 border-amber-200',
  'Aguardando cliente': 'bg-amber-50 text-amber-700 border-amber-200',
  'Solução proposta': 'bg-purple-50 text-purple-700 border-purple-200',
  'Resolvido': 'bg-emerald-50 text-emerald-700 border-emerald-200',
  'Cancelado': 'bg-neutral-100 text-neutral-500 border-neutral-200',
  'Improcedente': 'bg-neutral-100 text-neutral-500 border-neutral-200',
};

export const SAC_PRIORIDADE_BADGE: Record<SacPrioridade, string> = {
  Baixa: 'bg-neutral-100 text-neutral-500 border-neutral-200',
  Normal: 'bg-sky-50 text-sky-700 border-sky-200',
  Alta: 'bg-amber-50 text-amber-700 border-amber-200',
  Urgente: 'bg-red-50 text-red-700 border-red-200',
};

export const SAC_PROCEDENCIA_BADGE: Record<SacProcedencia, string> = {
  'Não analisado': 'bg-neutral-100 text-neutral-500 border-neutral-200',
  'Procedente': 'bg-red-50 text-red-700 border-red-200',
  'Parcialmente procedente': 'bg-amber-50 text-amber-700 border-amber-200',
  'Improcedente': 'bg-emerald-50 text-emerald-700 border-emerald-200',
};

export function statusEhAberto(status: SacStatus): boolean {
  return (SAC_STATUS_ABERTOS as string[]).includes(status);
}

export function statusEhEncerrado(status: SacStatus): boolean {
  return (SAC_STATUS_ENCERRADOS as string[]).includes(status);
}

export interface SituacaoPrazo {
  label: string;
  cor: 'verde' | 'amarelo' | 'vermelho' | 'neutro';
}

const COR_BADGE_PRAZO: Record<SituacaoPrazo['cor'], string> = {
  verde: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  amarelo: 'bg-amber-50 text-amber-700 border-amber-200',
  vermelho: 'bg-red-50 text-red-700 border-red-200',
  neutro: 'bg-neutral-100 text-neutral-500 border-neutral-200',
};

export function corBadgePrazo(cor: SituacaoPrazo['cor']): string {
  return COR_BADGE_PRAZO[cor];
}

// "1d 4h restantes" / "Vencido há 3h" / "Sem prazo definido".
export function situacaoPrazo(prazoIso: string | undefined, status: SacStatus): SituacaoPrazo {
  if (statusEhEncerrado(status)) return { label: 'Encerrado', cor: 'neutro' };
  if (!prazoIso) return { label: 'Sem prazo definido', cor: 'neutro' };

  const agora = Date.now();
  const prazo = new Date(prazoIso).getTime();
  const diffMs = prazo - agora;
  const diffHoras = Math.abs(diffMs) / (1000 * 60 * 60);
  const dias = Math.floor(diffHoras / 24);
  const horas = Math.floor(diffHoras % 24);
  const texto = dias > 0 ? `${dias}d ${horas}h` : `${horas}h`;

  if (diffMs < 0) return { label: `Vencido há ${texto}`, cor: 'vermelho' };
  if (diffHoras <= 4) return { label: `${texto} restantes`, cor: 'vermelho' };
  if (diffHoras <= 24) return { label: `${texto} restantes`, cor: 'amarelo' };
  return { label: `${texto} restantes`, cor: 'verde' };
}
