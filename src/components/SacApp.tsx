import React, { useState } from 'react';
import { User } from '../types';
import { SacPlanilhaGoogle } from './SacPlanilhaGoogle';
import { SacListaPlanilha } from './SacListaPlanilha';

interface SacAppProps {
  user: User;
}

export const SacApp: React.FC<SacAppProps> = ({ user: _user }) => {
  const [visualizandoPlanilha, setVisualizandoPlanilha] = useState(false);

  if (visualizandoPlanilha) {
    return <SacPlanilhaGoogle onVoltar={() => setVisualizandoPlanilha(false)} />;
  }

  return <SacListaPlanilha onAbrirPlanilha={() => setVisualizandoPlanilha(true)} />;
};
