export const STATUS_NC = ['Aberta', 'Em análise', 'Em tratamento', 'Concluída', 'Cancelada'] as const;
export const PRIORIDADES_NC = ['Baixa', 'Média', 'Alta', 'Urgente'] as const;
export type StatusNC = typeof STATUS_NC[number];
export type PrioridadeNC = typeof PRIORIDADES_NC[number];

export interface RegistroNC {
  id: string;
  autorNome: string;
  autorEmail: string;
  descricao: string;
  criadoEm: string;
}

export interface NaoConformidade {
  id: string;
  protocolo: string;
  titulo: string;
  departamentoOrigemId: string;
  departamentoResponsavelId: string;
  descricao: string;
  evidencia: string;
  prioridade: PrioridadeNC;
  status: StatusNC;
  responsavel: string;
  prazo: string;
  causa: string;
  acaoCorretiva: string;
  verificacao: string;
  criadoPor: string;
  criadoPorEmail: string;
  criadoEm: string;
  atualizadoEm: string;
  concluidoEm?: string;
  versao: number;
  historico: RegistroNC[];
}

export type NovaNC = Pick<NaoConformidade, 'titulo' | 'departamentoOrigemId' | 'departamentoResponsavelId' | 'descricao' | 'evidencia' | 'prioridade' | 'responsavel' | 'prazo'>;
export type TratamentoNC = Pick<NaoConformidade, 'status' | 'prioridade' | 'departamentoResponsavelId' | 'responsavel' | 'prazo' | 'causa' | 'acaoCorretiva' | 'verificacao'>;

export function ncFinalizada(nc: Pick<NaoConformidade, 'status'>) {
  return nc.status === 'Concluída' || nc.status === 'Cancelada';
}

export function ncAtrasada(nc: Pick<NaoConformidade, 'status' | 'prazo'>, hoje = new Date()) {
  const data = `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, '0')}-${String(hoje.getDate()).padStart(2, '0')}`;
  return !ncFinalizada(nc) && !!nc.prazo && nc.prazo < data;
}
