import React from 'react';
import { SearchX } from 'lucide-react';

interface RankingEmptyStateProps {
  mensagem?: string;
}

export const RankingEmptyState: React.FC<RankingEmptyStateProps> = ({
  mensagem = 'Nenhum vendedor encontrado para esse filtro.',
}) => {
  return (
    <div className="px-5 py-10 flex flex-col items-center gap-2 text-center">
      <SearchX className="w-5 h-5 text-neutral-500" aria-hidden="true" />
      <span className="text-neutral-500 text-xs">{mensagem}</span>
    </div>
  );
};
