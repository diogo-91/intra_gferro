import { Comunicado, Documento, Chamado, Colaborador, ChatChannel, ChatMessage, Department, NotificationItem, User } from '../types';

export const currentUser: User = {
  id: 'usr-001',
  name: 'Carlos Alberto Ferreira',
  role: 'Engenheiro de Processos Siderúrgicos',
  department: 'Engenharia & Qualidade',
  email: 'carlos.ferreira@gferro.com.br',
  phone: '(11) 98877-3322',
  ramal: '2014',
  avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&q=80&w=250',
  shift: 'Turno Adm - 07:30 às 17:18',
  hireDate: '15/03/2019',
  isCipaMember: true,
};

// Conteúdo real é criado pelos usuários dentro do app (modal "Novo
// Comunicado") — sem seed de demonstração pra produção.
export const initialComunicados: Comunicado[] = [];

// Sem upload/CRUD real de arquivos ainda — populado manualmente com os
// documentos oficiais da GFERRO antes de ir ao ar.
export const initialDocumentos: Documento[] = [];

// Conteúdo real é criado pelos usuários dentro do app (modal "Novo
// Chamado") — sem seed de demonstração pra produção.
export const initialChamados: Chamado[] = [];

// Sem cadastro de colaboradores ainda — populado manualmente com o quadro
// real do RH antes de ir ao ar. Alimenta também Chat Interno, Departamentos
// (headcount/gestores) e os aniversariantes do Dashboard.
export const colaboradoresList: Colaborador[] = [];

// Canais são estrutura/categorização de fato (não dado fake) — ficam.
export const initialChannels: ChatChannel[] = [
  {
    id: 'chn-geral',
    name: 'geral-gferro',
    description: 'Canal corporativo oficial para comunicados rápidos e integrativos de toda a empresa.',
    category: 'Geral & Social',
  },
  {
    id: 'chn-operacoes',
    name: 'operacoes-siderurgia',
    description: 'Acompanhamento do ritmo da fábrica, linhas de corte a laser, prensa CNC e estoque de bobinas.',
    category: 'Canais de Trabalho',
  },
  {
    id: 'chn-engenharia',
    name: 'engenharia-qualidade',
    description: 'Discussão de tolerâncias mecânicas, laudos ISO 9001, arquivos CAD e ordens de produção.',
    category: 'Projetos & ISO',
  },
  {
    id: 'chn-ti',
    name: 'ti-e-suporte',
    description: 'Atendimento rápido para dúvidas de sistemas, rede Wi-Fi fabril, ERP e ramais IP.',
    category: 'Canais de Trabalho',
  },
  {
    id: 'chn-rh',
    name: 'rh-comunicacao',
    description: 'Informaçoes sobre holerites, benefícios, cartão alimentação e comunicados de gestão.',
    category: 'Geral & Social',
  },
];

// Mensagens são conteúdo gerado pelos usuários — sem seed de demonstração.
export const initialChatMessages: ChatMessage[] = [];

// Estrutura real da empresa (nome, gestor, descrição, projetos e
// responsabilidades) — fica. Os KPIs "ao vivo" fake que existiam por
// departamento foram removidos (ver DepartamentosApp.tsx).
export const initialDepartments: Department[] = [
  {
    id: 'dep-com',
    code: 'DEP-COM',
    name: 'Comercial',
    manager: {
      name: 'Juliana Mendes',
      role: 'Coordenadora de Vendas',
      avatar: 'https://images.unsplash.com/photo-1580489944761-15a19d654956?auto=format&fit=crop&q=80&w=250',
      email: 'juliana.mendes@gferro.com.br',
      ramal: '5020',
    },
    description: 'Atendimento a indústrias automotivas, metalúrgicas e construção civil, cotações personalizadas e estratégias de expansão de mercado.',
    memberCount: 35,
    ramal: '5000',
    location: 'Escritório Central - 1º Andar',
    color: 'purple',
    keyProjects: [
      'Expansão de Vendas de Chapas Estruturais para o Agronegócio',
      'Portal B2B de Pedidos e Rastreio de Entregas',
      'Parcerias Estratégicas com Usinas Siderúrgicas',
    ],
    responsibilities: [
      'Elaboração de Propostas Comerciais de Aço',
      'Prospecção e Relacionamento B2B com Clientes',
      'Análise de Tendências de Preço de Commodity',
      'Acompanhamento de Satisfação do Cliente',
    ],
  },
  {
    id: 'dep-rh',
    code: 'DEP-RH',
    name: 'RH',
    manager: {
      name: 'Patrícia Souza',
      role: 'Gerente de Recursos Humanos',
      avatar: 'https://images.unsplash.com/photo-1573497019940-1c28c88b4f3e?auto=format&fit=crop&q=80&w=250',
      email: 'patricia.souza@gferro.com.br',
      ramal: '3010',
    },
    description: 'Gestão de pessoas, desenvolvimento profissional, saúde ocupacional, comitê CIPA e programas de segurança do trabalho.',
    memberCount: 18,
    ramal: '3000',
    location: 'Bloco Administrativo - Térreo',
    color: 'emerald',
    keyProjects: [
      'Campanha Exames Periódicos de Saúde 2026',
      'Programa Cultura Zero Acidentes GFERRO',
      'Plano de Carreira e Treinamentos Técnicos',
    ],
    responsibilities: [
      'Processamento de Folha e Benefícios',
      'Recrutamento e Seleção de Talentos',
      'Gestão de Segurança e Saúde do Trabalho (SST)',
      'Organização da SIPAT e Apoio à CIPA',
    ],
  },
  {
    id: 'dep-sac',
    code: 'DEP-SAC',
    name: 'SAC',
    description: '',
    memberCount: 0,
    ramal: '',
    location: '',
    color: 'sky',
    keyProjects: [],
    responsibilities: [],
  },
  {
    id: 'dep-pcp',
    code: 'DEP-PCP',
    name: 'PCP',
    description: '',
    memberCount: 0,
    ramal: '',
    location: '',
    color: 'indigo',
    keyProjects: [],
    responsibilities: [],
  },
  {
    id: 'dep-producao',
    code: 'DEP-PROD',
    name: 'Produção',
    description: '',
    memberCount: 0,
    ramal: '',
    location: '',
    color: 'yellow',
    keyProjects: [],
    responsibilities: [],
  },
  {
    id: 'dep-tecnologia',
    code: 'DEP-TEC',
    name: 'Tecnologia',
    description: '',
    memberCount: 0,
    ramal: '',
    location: '',
    color: 'orange',
    keyProjects: [],
    responsibilities: [],
  },
];

// Notificações são geradas por eventos reais do sistema — sem seed de
// demonstração pra produção.
export const notificationsList: NotificationItem[] = [];
