export type TabType =
  | 'dashboard'
  | 'vendas'
  | 'financeiro'
  | 'producao'
  | 'gestao'
  | 'informativos'
  | 'comunicados'
  | 'documentos'
  | 'servicos'
  | 'pessoas'
  | 'chat'
  | 'departamentos'
  | 'ia-assistente'
  | 'usuarios';

export interface VendedorRanking {
  nome: string;
  pedidos: number;
  valorTotal: number;
  metrosQuadrados: number;
  pedidosParafusos: number;
  quantidadeParafusos: number;
  valorParafusos: number;
  pedidosComFrete: number;
  valorFrete: number;
  ticketMedio: number;
  valorRecebido: number;
}

export interface PedidoVendedorDetalhe {
  id: number;
  codigo: string;
  dataEmissao: string;
  quantidadeItens: number;
  quantidadeParafusos: number;
  valorRecebido: number;
  valorPendente: number;
  valorTotal: number;
  valorFrete: number;
}

export interface ProdutoRanking {
  nome: string;
  valorTotal: number;
  quantidade: number;
  unidade: string;
}

export interface ResumoVendas {
  totalVendas: number;
  totalValorParafusos: number;
  totalFrete: number;
  valorRecebidoPedidos: number;
  valorPendentePedidos: number;
  financeiroPedidosCarregando: boolean;
  totalPedidos: number;
  totalMetrosQuadrados: number;
  vendedoresAtivos: number;
  produtos: ProdutoRanking[];
  atualizadoEm: string;
}

export interface ComparativoMensalVendasItem {
  mes: string;
  rotulo: string;
  totalVendas: number;
  totalPedidos: number;
  vendedoresAtivos: number;
  ticketMedio: number;
  valorRecebido: number;
  valorPendente: number;
  totalValorParafusos: number;
  totalFrete: number;
  financeiroCarregando: boolean;
}

// ================== Produção (app irmão "GFERO - APONTAMENTO PRODUCAO") ==================

export type StatusCardProducao = 'EM_PRODUCAO' | 'PARADO' | 'AGUARDANDO' | 'CONCLUIDO';

export interface CardProducao {
  idOrdem: number;
  nomeOrdem: string;
  pedido?: string;
  idPedido?: number;
  idProduto?: number;
  produto?: string;
  codigoProduto?: string;
  quantidade?: string;
  unidadeMedida?: string;
  statusOrdem?: string;
  valorTotal?: string;
  descricao?: string;
  dataPedido?: string;
  operacao?: number;
  idOperacaoOrdem?: number;
  coluna: string;
  status: StatusCardProducao;
  dataHoraInicial?: string | null;
  operadorAtual?: string | null;
  motivoParada?: string | null;
  tempoGravadoMs: number;
  etapasConcluidas: number;
  totalEtapas: number;
}

export interface ColunaKanbanProducao {
  nome: string;
  cards: CardProducao[];
}

export interface KanbanProducao {
  colunas: ColunaKanbanProducao[];
  filaAguardando: CardProducao[];
  concluidos: CardProducao[];
  atualizadoEm: string;
}

export interface MaterialPlanejamento {
  codigo: string;
  descricao: string;
  unidadeMedida: string;
  quantidade: number;
}

// Item já agendado no calendário de Planejamento da Produção (app irmão
// Apontamento de Produção, aba "Planejamento" — protegida por senha lá).
export interface ItemPlanejamentoProducao {
  id: string;
  idOrdem: number;
  idOperacaoOrdem: number;
  nomeOrdem: string;
  pedido?: string;
  idPedido?: number;
  idProduto?: number;
  produto?: string;
  codigoProduto?: string;
  quantidade?: string;
  unidadeMedida?: string;
  valorTotal?: string;
  data: string; // aaaa-mm-dd — dia agendado pra iniciar a produção
  criadoEm: string; // ISO
  atrasado?: boolean;
  materiais: MaterialPlanejamento[];
}

export interface QuantidadeProduzida {
  unidade: string;
  total: number;
}

export interface CentroProducao {
  centro: string;
  apontamentos: number;
  ordens: number;
  tempoMs: number;
  quantidades: QuantidadeProduzida[];
  /** Estimado (rateio do valor do pedido) — nunca um número exato do Nomus. Pode vir null. */
  valorProduzido: number | null;
}

export interface ApontamentoDetalhado {
  id: number;
  centro: string;
  idOrdem: number;
  nomeOrdem: string;
  operacao: number;
  descricaoEtapa: string;
  quantidade: number | null;
  unidadeMedida: string | null;
  funcionario: string;
  dataHoraInicial: string;
  dataHoraFinal: string;
  duracaoMs: number;
  /** Estimado (rateio do valor do pedido) — nunca um número exato do Nomus. Pode vir null. */
  valorProduzido: number | null;
}

export interface RelatorioProducao {
  porCentro: CentroProducao[];
  detalhado: ApontamentoDetalhado[];
  totalApontamentos: number;
  atualizadoEm: string;
}

export interface ContaReceber {
  id: string;
  cliente: string;
  categoria: string;
  /** Grupo superior da classificação (ex.: "Receita Bruta") — ver src/data/classificacoesFinanceiras.ts. */
  grupo?: string;
  valor: number;
  /** Data efetiva pro calendário — é a replanejada quando existe, senão a do Nomus. */
  vencimento: string;
  status: 'Em Dia' | 'A Vencer' | 'Vencida';
  /** Presente só quando o usuário moveu esta conta pra outro dia (replanejamento local, não altera o Nomus). */
  vencimentoOriginal?: string;
}

export interface ContaPagar {
  id: string;
  fornecedor: string;
  categoria: string;
  /** Grupo superior da classificação (ex.: "Despesa Administrativa") — ver src/data/classificacoesFinanceiras.ts. */
  grupo?: string;
  valor: number;
  /** Data efetiva pro calendário — é a replanejada quando existe, senão a de agendamento do Nomus (não a de vencimento contratual). */
  vencimento: string;
  status: 'Agendada' | 'A Vencer' | 'Vencida';
  /** Presente só quando o usuário moveu esta conta pra outro dia (replanejamento local, não altera o Nomus). */
  vencimentoOriginal?: string;
}

export interface FluxoCaixaMes {
  mes: string;
  receitas: number;
  despesas: number;
}

export interface ContaConcluida {
  id: string;
  tipo: 'receber' | 'pagar';
  /** Nome do cliente (receber) ou fornecedor (pagar). */
  pessoa: string;
  categoria: string;
  /** Grupo superior da classificação — ver src/data/classificacoesFinanceiras.ts. */
  grupo?: string;
  valor: number;
  /** Data em que foi de fato baixada/liquidada no Nomus. */
  dataBaixa: string;
}

export interface ResumoFinanceiro {
  /** "AAAA-MM" do mês selecionado no filtro (não necessariamente o mês corrente). */
  mesReferencia: string;
  faturamentoMes: number;
  variacaoFaturamento: number;
  totalReceber: number;
  totalPagar: number;
  /** Recebido - Pago no mês corrente (movimentação real de caixa, não o saldo bancário). */
  saldoMes: number;
  valorVencidoReceber: number;
  inadimplencia: number;
  fluxoCaixa: FluxoCaixaMes[];
  contasReceber: ContaReceber[];
  contasPagar: ContaPagar[];
  /** Contas já baixadas (recebidas/pagas) dentro do mês selecionado — pra aba "Concluídas". */
  contasConcluidas: ContaConcluida[];
  atualizadoEm: string;
}

export interface DreLinha {
  codigoGrupo: string;
  grupo: string;
  programado: number;
  realizado: number;
  contas: DreConta[];
}

export interface DreConta {
  codigo: string;
  nome: string;
  programado: number;
  realizado: number;
}

export interface DreFinanceira {
  versao: 2;
  mesReferencia: string;
  linhas: DreLinha[];
  atualizadoEm: string;
}

export interface User {
  id: string;
  name: string;
  role: string;
  department: string;
  email: string;
  phone: string;
  ramal: string;
  avatar: string;
  shift: string;
  hireDate: string;
  isCipaMember?: boolean;
}

export interface Comunicado {
  id: string;
  title: string;
  summary: string;
  content: string;
  author: {
    name: string;
    role: string;
    avatar: string;
  };
  category: 'Institucional' | 'Segurança' | 'Eventos' | 'Operações' | 'Recursos Humanos';
  date: string;
  pinned?: boolean;
  image?: string;
  likes: number;
  likedByMe?: boolean;
  commentsCount: number;
  comments?: Comment[];
  tags: string[];
}

export interface Comment {
  id: string;
  authorName: string;
  authorAvatar: string;
  content: string;
  createdAt: string;
}

export interface Documento {
  id: string;
  title: string;
  description: string;
  category: 'Normas de Segurança' | 'Recursos Humanos' | 'Qualidade & ISO' | 'TI & Sistemas' | 'Formulários';
  fileType: 'PDF' | 'DOCX' | 'XLSX' | 'ZIP';
  fileSize: string;
  version: string;
  updatedAt: string;
  downloads: number;
  requiredFor: string;
}

export interface Chamado {
  id: string;
  protocol: string;
  type: 'EPI / Segurança' | 'RH / Holerite' | 'Suporte TI' | 'Manutenção Predial' | 'Reembolso' | 'Férias';
  subject: string;
  description: string;
  priority: 'Baixa' | 'Média' | 'Alta' | 'Urgente';
  status: 'Aberto' | 'Em Atendimento' | 'Concluído' | 'Cancelado';
  createdAt: string;
  updatedAt: string;
  requesterName: string;
  requesterDepartment: string;
  assignedTo?: string;
}

export interface Colaborador {
  id: string;
  name: string;
  role: string;
  department: 'Operações & Siderurgia' | 'Engenharia & Qualidade' | 'Recursos Humanos' | 'Financeiro' | 'Comercial & Vendas' | 'Logística' | 'TI & Sistemas';
  email: string;
  ramal: string;
  whatsapp: string;
  avatar: string;
  location: string;
  status: 'Disponível' | 'Em Reunião' | 'Em Férias' | 'Em Turno de Fábrica';
  birthMonthDay: string; // e.g. "12/08"
}

export interface ChatChannel {
  id: string;
  name: string;
  description: string;
  category: 'Canais de Trabalho' | 'Geral & Social' | 'Projetos & ISO';
  unreadCount?: number;
  isPrivate?: boolean;
}

export interface ChatMessage {
  id: string;
  senderId: string;
  senderName: string;
  senderAvatar: string;
  senderRole?: string;
  content: string;
  timestamp: string;
  channelId?: string; // If null/undefined, it's a DM
  receiverId?: string;
  attachments?: { name: string; url: string; size: string }[];
}

export interface Department {
  id: string;
  code: string;
  name: string;
  manager?: {
    name: string;
    role: string;
    avatar: string;
    email: string;
    ramal: string;
  };
  description: string;
  memberCount: number;
  ramal: string;
  location: string;
  color: string;
  keyProjects: string[];
  responsibilities: string[];
}

export interface Funcionario {
  id: string;
  nome: string;
  cargo: string;
  setor: string;
  email?: string;
  telefone?: string;
  dataAdmissao?: string; // aaaa-mm-dd
  dataNascimento?: string; // aaaa-mm-dd
  status: 'Ativo' | 'Inativo' | 'Férias';
  criadoEm: string; // ISO
}

export interface Enquete {
  id: string;
  pergunta: string;
  opcoes: string[];
  votos: number[]; // mesmo tamanho de opcoes — contagem por opção
  criadoEm: string; // ISO
}

// ---- SAC / Pós-Vendas ----
// Atendimento externo ao cliente (reclamação, dúvida, troca, devolução...).
// O SAC é sempre o responsável pelo atendimento; "solicitações internas"
// pedem análise de outro setor SEM transferir a responsabilidade.

export type SacStatus =
  | 'Novo'
  | 'Em atendimento'
  | 'Em análise interna'
  | 'Aguardando Qualidade'
  | 'Aguardando Produção'
  | 'Aguardando Logística'
  | 'Aguardando Comercial'
  | 'Aguardando Financeiro'
  | 'Aguardando cliente'
  | 'Solução proposta'
  | 'Resolvido'
  | 'Cancelado'
  | 'Improcedente';

export type SacPrioridade = 'Baixa' | 'Normal' | 'Alta' | 'Urgente';

export type SacProcedencia = 'Não analisado' | 'Procedente' | 'Parcialmente procedente' | 'Improcedente';

export type SacTipoAtendimento =
  | 'Reclamação de qualidade'
  | 'Divergência de quantidade'
  | 'Material avariado'
  | 'Produto incorreto'
  | 'Atraso na entrega'
  | 'Problema com transporte'
  | 'Problema com nota fiscal'
  | 'Problema comercial'
  | 'Solicitação de certificado'
  | 'Dúvida técnica'
  | 'Troca'
  | 'Devolução'
  | 'Solicitação de crédito'
  | 'Elogio'
  | 'Sugestão'
  | 'Outros';

export type SacCanal = 'Telefone' | 'WhatsApp' | 'E-mail' | 'Site' | 'Presencial' | 'Vendedor' | 'Outro';

export type SacDepartamentoInterno = 'Qualidade' | 'Produção' | 'PCP' | 'Logística' | 'Comercial' | 'Financeiro' | 'Tecnologia' | 'Outro';

export type SacStatusSolicitacao = 'Pendente' | 'Em análise' | 'Respondido' | 'Cancelado';

export type SacTipoSolucao =
  | 'Orientação ao cliente'
  | 'Reposição de material'
  | 'Troca'
  | 'Devolução'
  | 'Reentrega'
  | 'Crédito'
  | 'Desconto'
  | 'Bonificação'
  | 'Ressarcimento'
  | 'Emissão de novo documento'
  | 'Novo certificado'
  | 'Ajuste financeiro'
  | 'Reclamação improcedente'
  | 'Outro';

export type SacStatusAprovacao = 'Aguardando aprovação' | 'Aprovado' | 'Reprovado';

export interface SacAnexo {
  id: string;
  nome: string;
  url: string;
  tipo: string; // mime type
  tamanho: number; // bytes
  descricao?: string;
  enviadoPor: string;
  criadoEm: string; // ISO
}

export interface SacInteracao {
  id: string;
  data: string; // ISO
  usuario: string;
  canal: SacCanal;
  tipo: 'Ligação' | 'WhatsApp' | 'E-mail' | 'Reunião' | 'Retorno ao cliente' | 'Informação recebida' | 'Observação';
  descricao: string;
  anexos: SacAnexo[];
}

export interface SacRespostaSolicitacao {
  parecer: string;
  descricaoTecnica?: string;
  anexos: SacAnexo[];
  responsavel: string;
  data: string; // ISO
}

export interface SacSolicitacaoInterna {
  id: string;
  departamento: SacDepartamentoInterno;
  usuarioResponsavel?: string;
  solicitacao: string;
  prazo?: string; // ISO
  prioridade: SacPrioridade;
  status: SacStatusSolicitacao;
  anexos: SacAnexo[];
  resposta?: SacRespostaSolicitacao;
  criadoPor: string;
  criadoEm: string; // ISO
}

export interface SacNaoConformidade {
  numero: string; // NC-000001
  departamentoResponsavel: SacDepartamentoInterno;
  descricao: string;
  causa?: string;
  acaoCorretiva?: string;
  status: 'Aberta' | 'Em andamento' | 'Concluída';
  responsavel?: string;
  dataConclusao?: string; // ISO
  criadoEm: string; // ISO
}

export interface SacSolucao {
  tipo: SacTipoSolucao;
  descricao: string;
  quantidadeEnvolvida?: string;
  valorFinanceiro?: number;
  necessitaAprovacao: boolean;
  statusAprovacao?: SacStatusAprovacao;
  aprovador?: string;
  dataAprovacao?: string; // ISO
  observacoes?: string;
  definidoPor: string;
  definidoEm: string; // ISO
}

export interface SacHistoricoEvento {
  id: string;
  usuario: string;
  acao: string;
  valorAnterior?: string;
  valorNovo?: string;
  data: string; // ISO
}

export interface SacProdutoReclamado {
  id: string;
  produto: string;
  descricao?: string;
  codigo?: string;
  bitola?: string;
  espessura?: string;
  largura?: string;
  comprimento?: string;
  quantidadeVendida?: string;
  quantidadeReclamada?: string;
  unidadeMedida?: string;
  peso?: string;
  lote?: string;
  corrida?: string;
  certificado?: boolean;
  numeroCertificado?: string;
}

export interface SacAtendimento {
  id: string;
  protocolo: string; // SAC-000001

  // Dados do cliente
  cliente: string;
  nomeFantasia?: string;
  cnpjCpf?: string;
  contato?: string;
  telefone?: string;
  whatsapp?: string;
  email?: string;
  cidade?: string;
  estado?: string;

  // Dados comerciais
  vendedor?: string;
  numeroPedido?: string;
  numeroNF?: string;
  dataVenda?: string; // aaaa-mm-dd
  dataEmissaoNF?: string; // aaaa-mm-dd
  dataEntrega?: string; // aaaa-mm-dd
  transportadora?: string;
  numeroOC?: string;

  // Produtos envolvidos
  produtos: SacProdutoReclamado[];

  // Dados do atendimento
  tipo: SacTipoAtendimento;
  assunto: string;
  descricao: string;
  prioridade: SacPrioridade;
  canal: SacCanal;
  responsavelSac?: string;
  prazo?: string; // ISO

  status: SacStatus;

  // Procedência
  procedencia: SacProcedencia;
  procedenciaMotivo?: string;
  procedenciaResponsavel?: string;
  procedenciaData?: string; // ISO

  naoConformidade?: SacNaoConformidade;
  solucao?: SacSolucao;

  // Encerramento
  clienteComunicado?: boolean;
  canalComunicacaoEncerramento?: SacCanal;
  clienteConfirmouSolucao?: 'Sim' | 'Não' | 'Não aplicável';
  observacaoFinal?: string;
  dataResolucao?: string; // ISO

  // Motivo de cancelamento/reabertura
  motivoCancelamento?: string;
  motivoReabertura?: string;

  interacoes: SacInteracao[];
  solicitacoesInternas: SacSolicitacaoInterna[];
  anexos: SacAnexo[];
  historico: SacHistoricoEvento[];

  criadoPor: string;
  criadoEm: string; // ISO
  atualizadoEm: string; // ISO
}

export interface NotificationItem {
  id: string;
  title: string;
  message: string;
  time: string;
  unread: boolean;
  type: 'seguranca' | 'rh' | 'comunicado' | 'chamado';
}
