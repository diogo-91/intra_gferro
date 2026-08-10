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
    id: 'dep-ops',
    code: 'DEP-OPS',
    name: 'Operações & Siderurgia',
    manager: {
      name: 'Henrique Andrade',
      role: 'Diretor de Operações',
      avatar: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&q=80&w=250',
      email: 'henrique.andrade@gferro.com.br',
      ramal: '1001',
    },
    description: 'Responsável pelo processamento industrial, pátio de bobinas, laminação a quente e a frio, usinagem e corte a laser de alta precisão.',
    memberCount: 142,
    ramal: '1000',
    location: 'Galpões A, B e C - Planta Principal',
    color: 'yellow',
    keyProjects: [
      'Ampliação da Dobra CNC de 400 Toneladas',
      'Iniciativa Zero Perda de Aço na Oxicorte',
      'Automação de Pontes Rolantes do Pátio',
    ],
    responsibilities: [
      'Execução de Ordens de Produção (OP)',
      'Controle do Fluxo de Bobinas de Aço',
      'Manutenção Preditiva dos Equipamentos Fabris',
      'Despacho para o Centro de Distribuição',
    ],
  },
  {
    id: 'dep-eng',
    code: 'DEP-ENG',
    name: 'Engenharia & Qualidade',
    manager: {
      name: 'Carlos Alberto Ferreira',
      role: 'Engenheiro Principal de Processos',
      avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&q=80&w=250',
      email: 'carlos.ferreira@gferro.com.br',
      ramal: '2014',
    },
    description: 'Garante o desenvolvimento de novas ligas de aço, modelagem CAD 3D, certificações ISO 9001 e análises laboratóriais de tração e flexão.',
    memberCount: 28,
    ramal: '2000',
    location: 'Bloco Administrativo - Sala 202',
    color: 'sky',
    keyProjects: [
      'Rastreabilidade Digital via QR Code na Corrida do Aço',
      'Revisão da Matriz de Qualidade ISO 9001:2015',
      'Otimização de Nesting de Chapas de Aço Inox',
    ],
    responsibilities: [
      'Desenvolvimento de Projetos em CAD/CAM',
      'Inspeção Metrológica e Ensaios Destrutivos',
      'Emissão de Certificados de Qualidade de Aço',
      'Suporte Técnico aos Clientes Industriais',
    ],
  },
  {
    id: 'dep-rh',
    code: 'DEP-RH',
    name: 'Recursos Humanos & SST',
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
    id: 'dep-com',
    code: 'DEP-COM',
    name: 'Comercial & Vendas',
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
    id: 'dep-ti',
    code: 'DEP-TI',
    name: 'TI & Sistemas',
    manager: {
      name: 'Lucas Martins',
      role: 'Analista de Infraestrutura TI',
      avatar: 'https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?auto=format&fit=crop&q=80&w=250',
      email: 'lucas.martins@gferro.com.br',
      ramal: '4004',
    },
    description: 'Infraestrutura tecnológica, servidores de alta disponibilidade, conectividade nos galpões, segurança cibernética e governança LGPD.',
    memberCount: 12,
    ramal: '4000',
    location: 'Bloco de TI & Datacenter Fabril',
    color: 'indigo',
    keyProjects: [
      'Atualização do Servidor do ERP Siderúrgico',
      'Rede Wi-Fi Industrial de Alta Velocidade nos Galpões',
      'Segurança de Dados e Backups em Nuvem Híbrida',
    ],
    responsibilities: [
      'Suporte Técnico aos Colaboradores e Ramais IP',
      'Gestão de Licenças de Software (CAD, ERP, Office)',
      'Monitoramento de Servidores e Redes Industriais',
      'Proteção e Governança de Dados Corporativos',
    ],
  },
  {
    id: 'dep-fin',
    code: 'DEP-FIN',
    name: 'Financeiro & Controladoria',
    manager: {
      name: 'Marcelo Oliveira',
      role: 'Especialista Financeiro',
      avatar: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?auto=format&fit=crop&q=80&w=250',
      email: 'marcelo.oliveira@gferro.com.br',
      ramal: '6012',
    },
    description: 'Gestão econômico-financeira, planejamento orçamentário, faturamento de cargas de aço, tesouraria e conciliação de contas.',
    memberCount: 15,
    ramal: '6000',
    location: 'Escritório Central - 2º Andar',
    color: 'amber',
    keyProjects: [
      'Planejamento Orçamentário Anual 2027',
      'Faturamento Automatizado de Notas Fiscais Eletrônicas',
      'Otimização do Capital de Giro em Compras de Bobinas',
    ],
    responsibilities: [
      'Contas a Pagar e Contas a Receber',
      'Emissão de NFs e Conhecimentos de Transporte',
      'Relatórios de Desempenho e Margem por Linha',
      'Gestão Tributária e Fiscal Siderúrgica',
    ],
  },
  {
    id: 'dep-log',
    code: 'DEP-LOG',
    name: 'Logística & Frota',
    manager: {
      name: 'Roberto Lima',
      role: 'Supervisor de Logística',
      avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&q=80&w=250',
      email: 'roberto.lima@gferro.com.br',
      ramal: '2205',
    },
    description: 'Coordenação das frotas de caminhões carretas e utilitários para entrega pontual de perfis, bobinas e tubos de aço em todo o país.',
    memberCount: 48,
    ramal: '2200',
    location: 'Centro de Distribuição de Cargas',
    color: 'orange',
    keyProjects: [
      'Telemetria e Rastreamento de Caminhões de Carga',
      'Redução do Tempo de Amarra e Carga de Bobinas',
      'Manutenção Preventiva da Frota GFERRO',
    ],
    responsibilities: [
      'Programação de Rotas de Entrega aos Clientes',
      'Gestão dos Motoristas e Veículos da Empresa',
      'Conferência Física do Carregamento com NF',
      'Manutenção e Abastecimento da Frota Comercial',
    ],
  },
];

// Notificações são geradas por eventos reais do sistema — sem seed de
// demonstração pra produção.
export const notificationsList: NotificationItem[] = [];
