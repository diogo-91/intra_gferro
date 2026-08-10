// Opções fixas do módulo SAC — listas de domínio (status, prioridade,
// tipo de atendimento...), não dado de negócio. Centralizado aqui pra
// filtros, formulário e badges usarem exatamente as mesmas opções.

import {
  SacStatus,
  SacPrioridade,
  SacProcedencia,
  SacTipoAtendimento,
  SacCanal,
  SacDepartamentoInterno,
  SacTipoSolucao,
} from '../types';

export const SAC_STATUS: SacStatus[] = [
  'Novo',
  'Em atendimento',
  'Em análise interna',
  'Aguardando Qualidade',
  'Aguardando Produção',
  'Aguardando Logística',
  'Aguardando Comercial',
  'Aguardando Financeiro',
  'Aguardando cliente',
  'Solução proposta',
  'Resolvido',
  'Cancelado',
  'Improcedente',
];

// Status que contam como "aberto" (não encerrado) pros KPIs e badges.
export const SAC_STATUS_ABERTOS: SacStatus[] = SAC_STATUS.filter(
  (s) => s !== 'Resolvido' && s !== 'Cancelado' && s !== 'Improcedente'
);

export const SAC_STATUS_EM_ANALISE: SacStatus[] = [
  'Em análise interna',
  'Aguardando Qualidade',
  'Aguardando Produção',
  'Aguardando Logística',
  'Aguardando Comercial',
  'Aguardando Financeiro',
];

export const SAC_STATUS_AGUARDANDO: SacStatus[] = ['Aguardando cliente', 'Solução proposta'];

export const SAC_STATUS_ENCERRADOS: SacStatus[] = ['Resolvido', 'Cancelado', 'Improcedente'];

export const SAC_PRIORIDADES: SacPrioridade[] = ['Baixa', 'Normal', 'Alta', 'Urgente'];

export const SAC_PROCEDENCIAS: SacProcedencia[] = ['Não analisado', 'Procedente', 'Parcialmente procedente', 'Improcedente'];

export const SAC_TIPOS_ATENDIMENTO: SacTipoAtendimento[] = [
  'Reclamação de qualidade',
  'Divergência de quantidade',
  'Material avariado',
  'Produto incorreto',
  'Atraso na entrega',
  'Problema com transporte',
  'Problema com nota fiscal',
  'Problema comercial',
  'Solicitação de certificado',
  'Dúvida técnica',
  'Troca',
  'Devolução',
  'Solicitação de crédito',
  'Elogio',
  'Sugestão',
  'Outros',
];

export const SAC_CANAIS: SacCanal[] = ['Telefone', 'WhatsApp', 'E-mail', 'Site', 'Presencial', 'Vendedor', 'Outro'];

export const SAC_DEPARTAMENTOS: SacDepartamentoInterno[] = [
  'Qualidade',
  'Produção',
  'PCP',
  'Logística',
  'Comercial',
  'Financeiro',
  'Tecnologia',
  'Outro',
];

export const SAC_TIPOS_SOLUCAO: SacTipoSolucao[] = [
  'Orientação ao cliente',
  'Reposição de material',
  'Troca',
  'Devolução',
  'Reentrega',
  'Crédito',
  'Desconto',
  'Bonificação',
  'Ressarcimento',
  'Emissão de novo documento',
  'Novo certificado',
  'Ajuste financeiro',
  'Reclamação improcedente',
  'Outro',
];

// Tipos de solução que envolvem valor financeiro e por isso disparam a
// pergunta "necessita aprovação?" com default sim.
export const SAC_TIPOS_SOLUCAO_SENSIVEIS: SacTipoSolucao[] = [
  'Crédito',
  'Desconto',
  'Bonificação',
  'Ressarcimento',
  'Reposição de material',
  'Devolução',
];
