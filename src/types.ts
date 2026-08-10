export type TabType =
  | 'dashboard'
  | 'vendas'
  | 'financeiro'
  | 'producao'
  | 'informativos'
  | 'comunicados'
  | 'documentos'
  | 'servicos'
  | 'pessoas'
  | 'chat'
  | 'departamentos'
  | 'ia-assistente';

export interface VendedorRanking {
  nome: string;
  pedidos: number;
  valorTotal: number;
  metrosQuadrados: number;
}

export interface ProdutoRanking {
  nome: string;
  valorTotal: number;
  quantidade: number;
  unidade: string;
}

export interface ResumoVendas {
  totalVendas: number;
  totalPedidos: number;
  totalMetrosQuadrados: number;
  vendedoresAtivos: number;
  produtos: ProdutoRanking[];
  atualizadoEm: string;
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
  /** Data efetiva pro calendário — é a replanejada quando existe, senão a do Nomus. */
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
  dataAdmissao?: string; // dd/mm/aaaa
  status: 'Ativo' | 'Inativo';
  criadoEm: string; // ISO
}

export interface NotificationItem {
  id: string;
  title: string;
  message: string;
  time: string;
  unread: boolean;
  type: 'seguranca' | 'rh' | 'comunicado' | 'chamado';
}
