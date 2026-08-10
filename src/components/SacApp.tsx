import React, { useState } from 'react';
import { User } from '../types';
import { SacListaAtendimentos, SacAbaDetalhe } from './SacListaAtendimentos';
import { SacAtendimentoDetalhe } from './SacAtendimentoDetalhe';

interface SacAppProps {
  user: User;
}

export const SacApp: React.FC<SacAppProps> = ({ user }) => {
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

  return <SacListaAtendimentos user={user} onSelecionarAtendimento={selecionar} />;
};
