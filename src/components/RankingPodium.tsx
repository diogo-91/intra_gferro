import React from 'react';
import { VendedorRanking } from '../types';
import { RankingPodiumCard } from './RankingPodiumCard';

interface RankingComPosicao extends VendedorRanking {
  posicao: number;
}

interface RankingPodiumProps {
  top3: RankingComPosicao[];
}

// Mostra só quem sobreviveu ao filtro atual (busca/checkbox) entre as 3
// primeiras posições reais do ranking — a posição exibida é sempre a
// original, nunca recalculada a partir da lista filtrada.
export const RankingPodium: React.FC<RankingPodiumProps> = ({ top3 }) => {
  if (top3.length === 0) return null;

  const porPosicao = new Map(top3.map((v) => [v.posicao, v]));
  const primeiro = porPosicao.get(1);
  const segundo = porPosicao.get(2);
  const terceiro = porPosicao.get(3);

  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 sm:items-end">
      {segundo && (
        <RankingPodiumCard posicao={2} vendedor={segundo} className="order-2 sm:order-1" />
      )}
      {primeiro && (
        <RankingPodiumCard posicao={1} vendedor={primeiro} className="order-1 sm:order-2" />
      )}
      {terceiro && (
        <RankingPodiumCard posicao={3} vendedor={terceiro} className="order-3 sm:order-3" />
      )}
    </div>
  );
};
