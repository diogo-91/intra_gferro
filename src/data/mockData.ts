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
    id: 'chn-dep-com',
    name: 'comercial',
    description: 'Canal do departamento Comercial.',
    category: 'Canais de Trabalho',
  },
  {
    id: 'chn-dep-rh',
    name: 'rh',
    description: 'Canal do departamento de Recursos Humanos.',
    category: 'Canais de Trabalho',
  },
  {
    id: 'chn-dep-sac',
    name: 'sac',
    description: 'Canal do departamento de Atendimento ao Cliente.',
    category: 'Canais de Trabalho',
  },
  {
    id: 'chn-dep-pcp',
    name: 'pcp',
    description: 'Canal do departamento de Planejamento e Controle da Produção.',
    category: 'Canais de Trabalho',
  },
  {
    id: 'chn-dep-producao',
    name: 'producao',
    description: 'Canal do departamento de Produção.',
    category: 'Canais de Trabalho',
  },
  {
    id: 'chn-dep-tecnologia',
    name: 'tecnologia',
    description: 'Canal do departamento de Tecnologia.',
    category: 'Canais de Trabalho',
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
    description: '',
    memberCount: 0,
    ramal: '',
    location: '',
    color: 'purple',
    keyProjects: [],
    responsibilities: [],
  },
  {
    id: 'dep-rh',
    code: 'DEP-RH',
    name: 'RH',
    description: '',
    memberCount: 0,
    ramal: '',
    location: '',
    color: 'emerald',
    keyProjects: [],
    responsibilities: [],
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
