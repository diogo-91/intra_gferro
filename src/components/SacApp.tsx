import React, { useState } from 'react';
import { User } from '../types';
import { SacListaAtendimentos, SacAbaDetalhe } from './SacListaAtendimentos';
import { SacAtendimentoDetalhe } from './SacAtendimentoDetalhe';
import { SacPlanilhaGoogle } from './SacPlanilhaGoogle';

interface SacAppProps {
  user: User;
}

export const SacApp: React.FC<SacAppProps> = ({ user }) => {
  const [visualizandoPlanilha, setVisualizandoPlanilha] = useState(false);
  const [atendimentoSelecionadoId, setAtendimentoSelecionadoId] = useState<string | null>(null);
  const [abaInicial, setAbaInicial] = useState<SacAbaDetalhe | undefined>(undefined);

  function selecionar(id: string, aba?: SacAbaDetalhe) {
    setAtendimentoSelecionadoId(id);
    setAbaInicial(aba);
  }

  if (atendimentoSelecionadoId) {
    return (
      <SacAtendimentoDetalhe
        id={atendimentoSelecionadoId}
        user={user}
        abaInicial={abaInicial}
        onVoltar={() => setAtendimentoSelecionadoId(null)}
      />
    );
  }

  if (visualizandoPlanilha) {
    return <SacPlanilhaGoogle onVoltar={() => setVisualizandoPlanilha(false)} />;
  }

  return (
    <SacListaAtendimentos
      user={user}
      onSelecionarAtendimento={selecionar}
      onAbrirPlanilha={() => setVisualizandoPlanilha(true)}
    />
  );
};
